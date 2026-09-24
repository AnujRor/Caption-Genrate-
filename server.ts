import "dotenv/config";
import express from "express";
import path from "path";
import os from "os";
import fs from "fs";
import multer from "multer";
import { execFile } from "child_process";
import util from "util";
import { GoogleGenAI, Type } from "@google/genai";

const execFileAsync = util.promisify(execFile);

const MAX_UPLOAD_MB = 250;
const GROQ_MAX_BYTES = 25 * 1024 * 1024; // Groq free-tier file limit
const GEMINI_INLINE_MAX_BYTES = 18 * 1024 * 1024; // keep under 20MB request cap

const uploadDir = path.join(os.tmpdir(), "caption-uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).replace(/[^.\w]/g, "") || ".bin";
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

const GEMINI_KEY = process.env.GEMINI_API_KEY?.trim() || "";
const GROQ_KEY = process.env.GROQ_API_KEY?.trim() || "";
const ai = GEMINI_KEY ? new GoogleGenAI({ apiKey: GEMINI_KEY }) : null;

interface Word {
  word: string;
  start: number;
  end: number;
}
interface TranscribeResult {
  detectedLanguage: string;
  words: Word[];
  engine: string;
}

// Maps UI language names to ISO-639-1 codes supported by Whisper.
const WHISPER_LANG: Record<string, string> = {
  Hindi: "hi", Haryanvi: "hi", Bhojpuri: "hi", English: "en", Punjabi: "pa",
  Marathi: "mr", Gujarati: "gu", Bengali: "bn", Urdu: "ur", Tamil: "ta",
  Telugu: "te", Kannada: "kn", Malayalam: "ml", Assamese: "as", Arabic: "ar",
  Spanish: "es", French: "fr", German: "de", Russian: "ru", Japanese: "ja",
  Korean: "ko", Chinese: "zh", Portuguese: "pt", Italian: "it", Turkish: "tr",
};

function safeUnlink(p: string | null | undefined) {
  if (!p) return;
  fs.promises.unlink(p).catch(() => {});
}

async function probeDuration(file: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
    ]);
    const d = parseFloat(stdout.trim());
    return Number.isFinite(d) && d > 0 ? d : null;
  } catch {
    return null;
  }
}

// Compress any audio/video into small mono 16kHz MP3: fast upload, same speech accuracy.
async function toSpeechMp3(input: string): Promise<string | null> {
  const out = `${input}_speech.mp3`;
  try {
    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", out],
      { timeout: 5 * 60 * 1000 }
    );
    if (fs.existsSync(out) && fs.statSync(out).size > 500) return out;
  } catch (err) {
    console.warn("[ffmpeg] audio extraction failed:", (err as Error).message.split("\n")[0]);
  }
  safeUnlink(out);
  return null;
}

function mimeFor(file: string, fallback: string): string {
  const ext = path.extname(file).toLowerCase();
  const map: Record<string, string> = {
    ".mp3": "audio/mp3", ".wav": "audio/wav", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
    ".webm": "video/webm", ".mp4": "video/mp4", ".mov": "video/quicktime",
  };
  return map[ext] || fallback || "application/octet-stream";
}

function normalizeWords(list: any[], duration: number | null): Word[] {
  const words: Word[] = [];
  for (const item of list || []) {
    const text = String(item?.word ?? item?.text ?? "").trim();
    if (!text) continue;
    let start = Number(item.start);
    let end = Number(item.end);
    if (!Number.isFinite(start)) continue;
    if (!Number.isFinite(end) || end <= start) end = start + 0.25;
    if (duration) {
      if (start > duration + 0.5) continue;
      end = Math.min(end, duration + 0.1);
    }
    words.push({ word: text, start: +start.toFixed(3), end: +end.toFixed(3) });
  }
  return words;
}

// ---------- Groq Whisper (free tier, precise word timestamps) ----------
async function transcribeWithGroq(file: string, language: string): Promise<TranscribeResult> {
  const buf = await fs.promises.readFile(file);
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mimeFor(file, "audio/mp3") }), path.basename(file));
  form.append("model", "whisper-large-v3");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  form.append("temperature", "0");

  const iso = WHISPER_LANG[language];
  if (iso) form.append("language", iso);
  if (language === "Hinglish") {
    // Roman-script prompt nudges Whisper to write Hindi words in English letters.
    form.append("prompt", "Haan bhai, aaj hum baat karenge. Video ko like aur share karo, channel ko subscribe karo.");
  }

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_KEY}` },
      body: form,
    });
    if (res.ok) {
      const data: any = await res.json();
      // Drop words that fall inside segments Whisper itself marks as "probably not speech"
      // (this removes classic hallucinations like "Thanks for watching" over silence).
      const badSegments = (data.segments || []).filter(
        (s: any) => s.no_speech_prob > 0.6 && s.avg_logprob < -0.8
      );
      const rawWords = (data.words || []).filter(
        (w: any) => !badSegments.some((s: any) => w.start >= s.start - 0.01 && w.end <= s.end + 0.01)
      );
      const lang = String(data.language || language || "Auto");
      return {
        detectedLanguage: lang.charAt(0).toUpperCase() + lang.slice(1),
        words: normalizeWords(rawWords, data.duration ?? null),
        engine: "Groq Whisper large-v3",
      };
    }
    const body = await res.text();
    lastErr = new Error(`Groq ${res.status}: ${body.slice(0, 200)}`);
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    break;
  }
  throw lastErr || new Error("Groq transcription failed");
}

// ---------- Gemini (free tier via AI Studio key) ----------
let geminiModelCache: string[] | null = null;
const badGeminiModels = new Set<string>();

async function getGeminiModels(): Promise<string[]> {
  if (geminiModelCache) return geminiModelCache.filter((m) => !badGeminiModels.has(m));
  const preferred = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"];
  const discovered: string[] = [];
  try {
    const pager = await ai!.models.list();
    for await (const m of pager as any) {
      const name = String(m.name || "").replace(/^models\//, "");
      const actions: string[] = m.supportedActions || [];
      if (!/^gemini-[\d.]+-flash(-lite)?$/.test(name)) continue;
      if (actions.length && !actions.includes("generateContent")) continue;
      discovered.push(name);
    }
  } catch (err) {
    console.warn("[Gemini] model discovery failed:", (err as Error).message);
  }
  // Newest non-lite flash first, then lite variants.
  discovered.sort((a, b) => {
    const lite = Number(a.includes("lite")) - Number(b.includes("lite"));
    if (lite) return lite;
    return parseFloat(b.split("-")[1]) - parseFloat(a.split("-")[1]);
  });
  geminiModelCache = Array.from(new Set([...discovered.slice(0, 2), ...preferred, ...discovered.slice(2)]));
  console.log("[Gemini] model order:", geminiModelCache.join(", "));
  return geminiModelCache;
}

function geminiPrompt(language: string, duration: number | null) {
  let lang = "Detect the spoken language automatically (Hindi, Hinglish, English, Punjabi, Haryanvi, Bhojpuri, Bengali, Marathi, Gujarati, Urdu, Tamil, Telugu, Kannada, Malayalam, Spanish, Arabic, etc.).";
  if (language === "Hinglish") {
    lang = 'Write Hindi speech in Roman/English letters (Hinglish), e.g. "Aap kaise ho", "video ko like karo". English words stay English.';
  } else if (language && language !== "Auto-detect") {
    lang = `The speech is in ${language}. Write it verbatim in its native script. Do NOT translate.`;
  }
  return `You are a professional subtitle transcription engine.
Transcribe EVERY spoken word of this audio verbatim, in order, with word-level timestamps.

LANGUAGE: ${lang}
Never translate. Keep the speaker's original words and script.

TIMING RULES:
- "start"/"end" are seconds from the beginning of the audio as decimal numbers (e.g. 65.42 means 1 minute 5.42 seconds, NOT 1:05).
- ${duration ? `The audio is ${duration.toFixed(2)} seconds long; no timestamp may exceed it.` : ""}
- Do not stretch words across pauses or silence.
- Timestamps must increase monotonically.
- Remove punctuation from "word". No speech → empty "words" array.`;
}

async function transcribeWithGemini(file: string, mime: string, language: string, duration: number | null): Promise<TranscribeResult> {
  const size = fs.statSync(file).size;
  let mediaPart: any;
  let uploadedName: string | null = null;

  if (size <= GEMINI_INLINE_MAX_BYTES) {
    mediaPart = { inlineData: { mimeType: mime, data: (await fs.promises.readFile(file)).toString("base64") } };
  } else {
    let uploaded = await ai!.files.upload({ file, config: { mimeType: mime } });
    uploadedName = uploaded.name || null;
    for (let i = 0; i < 60 && uploaded.state === "PROCESSING"; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      uploaded = await ai!.files.get({ name: uploaded.name! });
    }
    if (uploaded.state === "FAILED") throw new Error("Gemini could not process the media file");
    mediaPart = { fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType || mime } };
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      detectedLanguage: { type: Type.STRING },
      words: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            start: { type: Type.NUMBER },
            end: { type: Type.NUMBER },
          },
          required: ["word", "start", "end"],
        },
      },
    },
    required: ["detectedLanguage", "words"],
  };

  try {
    let lastErr: any = null;
    for (const model of await getGeminiModels()) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai!.models.generateContent({
            model,
            contents: [{ role: "user", parts: [mediaPart, { text: geminiPrompt(language, duration) }] }],
            config: { temperature: 0, responseMimeType: "application/json", responseSchema: schema },
          });
          const text = (response.text || "").replace(/```json|```/gi, "").trim();
          const parsed = JSON.parse(text || "{}");
          return {
            detectedLanguage: parsed.detectedLanguage || language,
            words: normalizeWords(parsed.words || [], duration),
            engine: `Gemini ${model}`,
          };
        } catch (err: any) {
          lastErr = err;
          const msg = String(err?.message || err);
          if (/404|NOT_FOUND|not found|not supported/i.test(msg)) {
            badGeminiModels.add(model);
            break; // try next model
          }
          if (/429|503|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(msg) && attempt === 0) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          if (/API key|PERMISSION_DENIED|401|403/i.test(msg)) throw err;
          break;
        }
      }
    }
    throw lastErr || new Error("No Gemini model available");
  } finally {
    if (uploadedName) ai!.files.delete({ name: uploadedName }).catch(() => {});
  }
}

function friendlyError(err: unknown): string {
  const msg = String((err as any)?.message || err);
  if (/API key not valid|API_KEY_INVALID|invalid_api_key|401/i.test(msg)) return "The server's AI API key is invalid. Check GEMINI_API_KEY / GROQ_API_KEY in your hosting settings.";
  if (/429|RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg)) return "Free AI quota is busy right now. Please wait a minute and try again.";
  if (/503|UNAVAILABLE|overloaded|high demand/i.test(msg)) return "The AI service is overloaded right now. Please try again in a moment.";
  return "Transcription failed. Please try again.";
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, engines: { groq: !!GROQ_KEY, gemini: !!GEMINI_KEY }, maxUploadMb: MAX_UPLOAD_MB });
  });

  app.post("/api/transcribe", upload.single("video"), async (req, res) => {
    const file = req.file;
    let speechFile: string | null = null;
    try {
      if (!file) return res.status(400).json({ error: "No media file received." });
      if (!GROQ_KEY && !GEMINI_KEY) {
        return res.status(503).json({ error: "No AI key configured on the server. Add GROQ_API_KEY or GEMINI_API_KEY in your hosting environment variables." });
      }

      const language = String(req.body.language || "Auto-detect");
      console.log(`[Transcribe] ${file.originalname} ${(file.size / 1048576).toFixed(1)}MB lang=${language}`);

      speechFile = await toSpeechMp3(file.path);
      const mediaFile = speechFile || file.path;
      const mediaMime = speechFile ? "audio/mp3" : mimeFor(file.path, file.mimetype);
      const duration = await probeDuration(mediaFile);
      const mediaSize = fs.statSync(mediaFile).size;

      // Whisper gives far more precise word timing; Gemini handles Hinglish/Odia better.
      const groqOk = !!GROQ_KEY && mediaSize <= GROQ_MAX_BYTES;
      const geminiFirst = language === "Hinglish" || (language !== "Auto-detect" && !WHISPER_LANG[language]);
      const engines: (() => Promise<TranscribeResult>)[] = [];
      const groq = () => transcribeWithGroq(mediaFile, language);
      const gemini = () => transcribeWithGemini(mediaFile, mediaMime, language, duration);
      if (geminiFirst) {
        if (ai) engines.push(gemini);
        if (groqOk) engines.push(groq);
      } else {
        if (groqOk) engines.push(groq);
        if (ai) engines.push(gemini);
      }
      if (!engines.length) {
        return res.status(413).json({ error: "This audio is too long for the configured AI engine. Try a shorter clip." });
      }

      let lastErr: unknown = null;
      for (const run of engines) {
        try {
          const result = await run();
          console.log(`[Transcribe] ${result.engine}: ${result.words.length} words (${result.detectedLanguage})`);
          if (result.words.length === 0 && run !== engines[engines.length - 1]) continue;
          return res.json(result);
        } catch (err) {
          lastErr = err;
          console.warn("[Transcribe] engine failed:", (err as Error).message?.slice(0, 300));
        }
      }
      if (lastErr) throw lastErr;
      return res.json({ detectedLanguage: language, words: [], engine: "none" });
    } catch (err) {
      console.error("[Transcribe] error:", err);
      res.status(502).json({ error: friendlyError(err) });
    } finally {
      safeUnlink(file?.path);
      safeUnlink(speechFile);
    }
  });

  // JSON errors for upload problems instead of HTML stack traces.
  app.use("/api", (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? `File too large. Maximum is ${MAX_UPLOAD_MB}MB.` : err.message;
      return res.status(413).json({ error: msg });
    }
    console.error("[API] error:", err);
    res.status(500).json({ error: "Server error. Please try again." });
  });

  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { maxAge: "7d", index: false }));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}  (groq=${!!GROQ_KEY}, gemini=${!!GEMINI_KEY})`);
  });
}

startServer();
