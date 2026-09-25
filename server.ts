import "dotenv/config";
import express from "express";
import path from "path";
import os from "os";
import fs from "fs";
import multer from "multer";
import { execFile } from "child_process";
import util from "util";
import { GoogleGenAI, Type } from "@google/genai";
import { devanagariToHinglish, expectedScript, needsScriptFix } from "./server/scripts";

const execFileAsync = util.promisify(execFile);

const MAX_UPLOAD_MB = 250;
const GROQ_MAX_BYTES = 25 * 1024 * 1024; // Groq free-tier file limit
const GEMINI_INLINE_MAX_BYTES = 18 * 1024 * 1024; // keep under 20MB request cap

const uploadDir = path.join(os.tmpdir(), "caption-uploads");
fs.mkdirSync(uploadDir, { recursive: true });

// Self-healing: crashed or aborted requests can leave temp files behind; sweep them
// regularly so the disk never fills up on long-running free-tier hosts.
function sweepUploads(maxAgeMs = 60 * 60 * 1000) {
  fs.promises
    .readdir(uploadDir)
    .then((names) =>
      Promise.all(
        names.map(async (name) => {
          const p = path.join(uploadDir, name);
          const st = await fs.promises.stat(p).catch(() => null);
          if (st && Date.now() - st.mtimeMs > maxAgeMs) await fs.promises.unlink(p).catch(() => {});
        })
      )
    )
    .catch(() => fs.promises.mkdir(uploadDir, { recursive: true }).catch(() => {}));
}
sweepUploads(0);
setInterval(() => sweepUploads(), 30 * 60 * 1000).unref();

// Never let a stray async error take the whole server down.
process.on("unhandledRejection", (reason) => console.error("[process] unhandled rejection:", reason));
process.on("uncaughtException", (err) => console.error("[process] uncaught exception:", err));

const upload = multer({
  storage: multer.diskStorage({
    // Recreate the folder if the OS cleaned the temp dir while the server was running.
    destination: (_req, _file, cb) => fs.mkdir(uploadDir, { recursive: true }, (err) => cb(err, uploadDir)),
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
const LANG_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(WHISPER_LANG).filter(([name]) => !["Haryanvi", "Bhojpuri"].includes(name)).map(([name, iso]) => [iso, name])
);

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
// large-v3 is the most accurate; turbo has its own free quota, so it takes over when v3 is busy.
const GROQ_WHISPER_MODELS = ["whisper-large-v3", "whisper-large-v3-turbo"];
// No "prompt" is sent: on unclear audio Whisper copies prompt text into the captions.

interface GroqResult extends TranscribeResult {
  /** Whisper's own confidence (mean log-probability of the text); higher is better. */
  score: number;
}

async function transcribeWithGroq(file: string, iso: string | null): Promise<GroqResult> {
  const buf = await fs.promises.readFile(file);
  let lastErr: Error | null = null;
  for (const model of GROQ_WHISPER_MODELS) {
    try {
      return await groqWhisperRequest(buf, file, iso, model);
    } catch (err) {
      lastErr = err as Error;
      // A bad key or bad file fails the same way on every model.
      if (/Groq (400|401|403|413)/.test(lastErr.message)) break;
      console.warn(`[Groq] ${model} failed, trying next model:`, lastErr.message.slice(0, 150));
    }
  }
  throw lastErr || new Error("Groq transcription failed");
}

async function groqWhisperRequest(buf: Buffer, file: string, iso: string | null, model: string): Promise<GroqResult> {
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mimeFor(file, "audio/mp3") }), path.basename(file));
  form.append("model", model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  form.append("temperature", "0");
  if (iso) form.append("language", iso);

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_KEY}` },
        body: form,
        signal: AbortSignal.timeout(4 * 60 * 1000),
      });
    } catch (err) {
      // Network blip or timeout: back off and retry instead of failing the whole request.
      lastErr = new Error(`Groq network error: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
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
      const segs: any[] = data.segments || [];
      const span = segs.reduce((n, s) => n + Math.max(0.01, (s.end ?? 0) - (s.start ?? 0)), 0);
      const score = span
        ? segs.reduce((n, s) => n + (Number(s.avg_logprob) || -2) * Math.max(0.01, (s.end ?? 0) - (s.start ?? 0)), 0) / span
        : -5;
      return {
        detectedLanguage: titleCase(String(data.language || (iso ? LANG_NAME[iso] : "") || "Unknown")),
        words: normalizeWords(rawWords, data.duration ?? null),
        engine: `Groq ${model.replace("whisper-", "Whisper ")}`,
        score,
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

// Whisper's names for some languages differ from the ones used in the app.
const LANG_ALIASES: Record<string, string> = { panjabi: "Punjabi", castilian: "Spanish", bangla: "Bengali", oriya: "Odia" };
const titleCase = (s: string) => LANG_ALIASES[s.toLowerCase()] || s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/**
 * Picks the right Whisper mode per language:
 * - Hinglish: transcribe as Hindi (keeps every word + timing), then convert to Roman letters.
 * - Auto-detect: Whisper often mislabels Hindi/Hinglish speech as English or Urdu, which drops
 *   or mangles the Hindi words. In that case, also listen in Hindi mode and keep the better one.
 * - Any other language: transcribe in that language directly.
 */
async function transcribeGroqFor(file: string, language: string): Promise<TranscribeResult> {
  if (language === "Hinglish") return transcribeWithGroq(file, "hi");
  if (language !== "Auto-detect") return transcribeWithGroq(file, WHISPER_LANG[language] || null);

  let best = await transcribeWithGroq(file, null);
  const detected = best.detectedLanguage.toLowerCase();

  if (detected === "english" || detected === "urdu") {
    try {
      const hindi = await transcribeWithGroq(file, "hi");
      let useHindi: boolean;
      let reason: string;
      if (detected === "urdu") {
        useHindi = hindi.score >= best.score - 0.2; // same speech, but Indian viewers expect Devanagari
        reason = "score";
      } else {
        // English speech forced into Hindi mode comes out as English spelled in Devanagari,
        // so read the Hindi-mode text to decide. Confidence scores are only the fallback.
        const verdict = await identifyLanguage(hindi.words.map((w) => w.word).join(" "));
        const moreWords = hindi.words.length > best.words.length * 1.25;
        useHindi = verdict ? verdict !== "English" : hindi.score > best.score + 0.1 || (moreWords && hindi.score > best.score);
        reason = verdict ? `text looks like ${verdict}` : "score";
      }
      console.log(
        `[Auto-detect] Whisper said ${best.detectedLanguage} (score ${best.score.toFixed(3)}, ${best.words.length} words); ` +
          `Hindi pass score ${hindi.score.toFixed(3)}, ${hindi.words.length} words; ${reason} -> ${useHindi ? "Hindi" : best.detectedLanguage}`
      );
      if (useHindi) best = { ...hindi, detectedLanguage: "Hindi" };
    } catch {
      /* keep the first result */
    }
  }

  // Close Indian languages (Hindi/Punjabi/Marathi/...) get a second opinion from the transcript text.
  if (CONFUSABLE.has(best.detectedLanguage.toLowerCase()) && best.words.length >= 3) {
    const named = await identifyLanguage(best.words.map((w) => w.word).join(" "));
    const currentIso = WHISPER_LANG[best.detectedLanguage];
    if (named && CONFUSABLE.has(named.toLowerCase()) && WHISPER_LANG[named] !== currentIso) {
      try {
        const redo = await transcribeWithGroq(file, WHISPER_LANG[named]);
        const accept = redo.words.length && redo.score >= best.score - 0.3;
        console.log(`[Auto-detect] text looks like ${named}; re-listen score ${redo.score.toFixed(3)} vs ${best.score.toFixed(3)} -> ${accept ? named : best.detectedLanguage}`);
        if (accept) best = { ...redo, detectedLanguage: named };
      } catch {
        /* keep current result */
      }
    } else if (named && named !== best.detectedLanguage && WHISPER_LANG[named] === currentIso) {
      best = { ...best, detectedLanguage: named }; // e.g. Bhojpuri/Haryanvi use the Hindi model
    }
  }
  return best;
}

/** Converts the result to the script the chosen language should be shown in. */
async function finalizeScript(result: TranscribeResult, language: string): Promise<TranscribeResult> {
  const target = language === "Auto-detect" ? result.detectedLanguage : language;
  const text = result.words.map((w) => w.word).join(" ");
  let out = result;
  if (result.words.length && expectedScript(target) && needsScriptFix(text, target)) {
    const fixed = await fixScript(result.words, target);
    out = { ...result, words: fixed.words, engine: `${result.engine} + ${fixed.method} ${target === "Hinglish" ? "Hinglish" : "script"} conversion` };
  }
  return language === "Hinglish" ? { ...out, detectedLanguage: "Hinglish" } : out;
}

// ---------- Script correction (Hinglish, wrong-script output) ----------
const GROQ_TEXT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];

function scriptInstruction(target: string): string {
  if (target === "Hinglish") {
    return 'Rewrite each word in Hinglish: Roman/English letters the way Indians type on WhatsApp (e.g. "नमस्ते"→"namaste", "करेंगे"→"karenge", "नहीं"→"nahi", "वीडियो"→"video", "सब्सक्राइब"→"subscribe"). English loanwords must use normal English spelling. Words already in English letters stay unchanged.';
  }
  return `Rewrite each word in the native script of ${target} (transliterate, do NOT translate). Words already in that script stay unchanged.`;
}

/** Asks a free LLM to transliterate words one-to-one. Returns null if it can't do it reliably. */
async function llmTransliterate(words: string[], target: string): Promise<string[] | null> {
  const system = `You are a transliteration engine for subtitles. ${scriptInstruction(target)}
Never translate, never merge or split words, never drop words.
Input is a JSON array of N words. Reply ONLY with JSON: {"words": [ ...exactly N strings, same order... ]}`;
  const user = JSON.stringify(words);

  return askJson(system, user, (reply) => {
    const out = reply?.words;
    if (Array.isArray(out) && out.length === words.length && out.every((w) => typeof w === "string" && w.trim())) {
      return out.map((w: string) => w.trim().replace(/\s+/g, " "));
    }
    return null;
  });
}

/**
 * Sends a JSON-only prompt to free LLMs (Groq models, then Gemini) until one gives a
 * reply that passes `accept`. Returns null if none does — callers always have a fallback.
 */
async function askJson<T>(system: string, user: string, accept: (reply: any) => T | null, models = GROQ_TEXT_MODELS): Promise<T | null> {
  const attempts: (() => Promise<string>)[] = [];
  if (GROQ_KEY) {
    for (const model of models) {
      attempts.push(async () => {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            temperature: 0,
            response_format: { type: "json_object" },
            ...(model.startsWith("openai/") ? { reasoning_effort: "low" } : {}),
            messages: [{ role: "system", content: system }, { role: "user", content: user }],
          }),
          signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) throw new Error(`Groq ${model} ${res.status}: ${(await res.text()).slice(0, 150)}`);
        const data: any = await res.json();
        return String(data.choices?.[0]?.message?.content || "");
      });
    }
  }
  if (ai && geminiAvailable()) {
    attempts.push(async () => {
      const [model] = await getGeminiModels();
      const r = await ai!.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
        config: { temperature: 0, responseMimeType: "application/json" },
      });
      return r.text || "";
    });
  }

  for (const attempt of attempts) {
    try {
      const text = (await attempt()).replace(/```json|```/gi, "").trim();
      const accepted = accept(JSON.parse(text));
      if (accepted !== null) return accepted;
      console.warn("[LLM] reply had wrong shape, trying next model");
    } catch (err) {
      noteGeminiFailure(err);
      console.warn("[LLM]", (err as Error).message.slice(0, 200));
    }
  }
  return null;
}

// Languages that share vocabulary/script and that Whisper's audio detector often mixes up.
const CONFUSABLE = new Set(["hindi", "urdu", "punjabi", "marathi", "gujarati", "bengali", "nepali", "assamese", "sindhi"]);

/** Reads the transcript and names the language actually spoken (text-based second opinion). */
async function identifyLanguage(text: string): Promise<string | null> {
  const options = Object.values(LANG_NAME);
  const system = `You identify the spoken language of a speech transcript. The speech recogniser may have written it in the WRONG script,
e.g. Punjabi or Marathi words written in Hindi's Devanagari letters, or English words spelled out in Devanagari.
Judge by the vocabulary and grammar, not by the script:
- Punjabi clues: "asi", "tusi", "gal", "karange", "haan/han", "nu", "vich", "ki haal".
- Hindi mixed with some English words (Hinglish) is Hindi.
- English sentences merely spelled in another script are English.
Choose exactly one of: ${options.join(", ")}.
Reply ONLY with JSON: {"language": "<one option>"}`;
  return askJson(system, text.slice(0, 1500), (reply) => {
    const name = options.find((o) => o.toLowerCase() === String(reply?.language || "").toLowerCase());
    return name || null;
  });
}

/**
 * Makes sure words are in the script the user expects. Uses a free LLM in chunks,
 * and for Hinglish falls back to the built-in converter so it can never fail.
 */
async function fixScript(words: Word[], target: string): Promise<{ words: Word[]; method: string }> {
  if (!words.length) return { words, method: "none" };
  const CHUNK = 120;
  const out: Word[] = [];
  let usedFallback = false;
  for (let i = 0; i < words.length; i += CHUNK) {
    const chunk = words.slice(i, i + CHUNK);
    const converted = await llmTransliterate(chunk.map((w) => w.word), target);
    chunk.forEach((w, j) => {
      let text = converted?.[j];
      if (!text) {
        usedFallback = true;
        text = target === "Hinglish" ? devanagariToHinglish(w.word) : w.word;
      }
      out.push({ ...w, word: text });
    });
  }
  return { words: out, method: usedFallback ? "built-in" : "AI" };
}

// ---------- Gemini (free tier via AI Studio key) ----------
// If the key/project is rejected, stop calling Gemini for a while instead of
// wasting time on a guaranteed failure in every request.
let geminiBlockedUntil = 0;
const geminiAvailable = () => !!ai && Date.now() > geminiBlockedUntil;
function noteGeminiFailure(err: unknown) {
  const msg = String((err as any)?.message || err);
  if (/API key|API_KEY_INVALID|PERMISSION_DENIED|denied access|\b401\b|\b403\b/i.test(msg)) {
    if (Date.now() > geminiBlockedUntil) console.warn("[Gemini] key/project rejected; pausing Gemini for 15 minutes:", msg.slice(0, 160));
    geminiBlockedUntil = Date.now() + 15 * 60 * 1000;
  }
}

let geminiModelCache: string[] | null = null;
const badGeminiModels = new Set<string>();

async function getGeminiModels(): Promise<string[]> {
  if (geminiModelCache) {
    const usable = geminiModelCache.filter((m) => !badGeminiModels.has(m));
    if (usable.length) return usable;
    // Every known model failed: forget the blacklist and rediscover instead of staying broken until restart.
    badGeminiModels.clear();
    geminiModelCache = null;
  }
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
          if (/API key|PERMISSION_DENIED|denied access|401|403/i.test(msg)) {
            noteGeminiFailure(err);
            throw err;
          }
          break;
        }
      }
    }
    throw lastErr || new Error("No Gemini model available");
  } finally {
    if (uploadedName) ai!.files.delete({ name: uploadedName }).catch(() => {});
  }
}

// ---------- Protection for free-tier hosting ----------

// Per-IP limit so one visitor (or bot) can't burn the whole free AI quota.
const RATE_LIMIT_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR) || 30;
const requestLog = new Map<string, number[]>();

function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const recent = (requestLog.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= RATE_LIMIT_PER_HOUR) {
    const retryMin = Math.ceil((recent[0] + 60 * 60 * 1000 - now) / 60000);
    res.setHeader("Retry-After", String(retryMin * 60));
    return res.status(429).json({ error: `Too many caption requests from your network. Please try again in ${retryMin} minute${retryMin === 1 ? "" : "s"}.` });
  }
  recent.push(now);
  requestLog.set(ip, recent);
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of requestLog) {
    if (!times.some((t) => now - t < 60 * 60 * 1000)) requestLog.delete(ip);
  }
}, 10 * 60 * 1000).unref();

// Only a few ffmpeg + AI jobs at once; extra requests wait their turn instead of
// running the small free instance out of memory.
const MAX_CONCURRENT_JOBS = Number(process.env.MAX_CONCURRENT_JOBS) || 2;
let activeJobs = 0;
const jobQueue: (() => void)[] = [];

function acquireJobSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const grant = () => {
      activeJobs++;
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        activeJobs--;
        jobQueue.shift()?.();
      });
    };
    if (activeJobs < MAX_CONCURRENT_JOBS) grant();
    else jobQueue.push(grant);
  });
}

function friendlyError(err: unknown): string {
  const msg = String((err as any)?.message || err);
  if (/denied access|PERMISSION_DENIED/i.test(msg)) return "Google blocked the Gemini API key's project. Create a new key at aistudio.google.com, or add a free GROQ_API_KEY from console.groq.com.";
  if (/API key not valid|API_KEY_INVALID|invalid_api_key|401/i.test(msg)) return "The server's AI API key is invalid. Check GEMINI_API_KEY / GROQ_API_KEY in your hosting settings.";
  if (/429|RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg)) return "Free AI quota is busy right now. Please wait a minute and try again.";
  if (/503|UNAVAILABLE|overloaded|high demand/i.test(msg)) return "The AI service is overloaded right now. Please try again in a moment.";
  return "Transcription failed. Please try again.";
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  // Behind Render/Heroku-style proxies, trust the first hop so req.ip is the real visitor.
  app.set("trust proxy", 1);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, engines: { groq: !!GROQ_KEY, gemini: !!GEMINI_KEY }, maxUploadMb: MAX_UPLOAD_MB });
  });

  app.post("/api/transcribe", rateLimit, upload.single("video"), async (req, res) => {
    const file = req.file;
    let speechFile: string | null = null;
    let releaseSlot: (() => void) | null = null;
    try {
      if (!file) return res.status(400).json({ error: "No media file received." });
      if (!GROQ_KEY && !GEMINI_KEY) {
        return res.status(503).json({ error: "No AI key configured on the server. Add GROQ_API_KEY or GEMINI_API_KEY in your hosting environment variables." });
      }

      const language = String(req.body.language || "Auto-detect");
      console.log(`[Transcribe] ${file.originalname} ${(file.size / 1048576).toFixed(1)}MB lang=${language}`);

      releaseSlot = await acquireJobSlot();
      if (req.socket?.destroyed) return; // client gave up while waiting in the queue

      speechFile = await toSpeechMp3(file.path);
      const mediaFile = speechFile || file.path;
      const mediaMime = speechFile ? "audio/mp3" : mimeFor(file.path, file.mimetype);
      const duration = await probeDuration(mediaFile);
      const mediaSize = fs.statSync(mediaFile).size;

      // Whisper (Groq) gives the most precise word timing, so it goes first for every language
      // it knows. Gemini covers languages Whisper lacks (e.g. Odia) and is the backup.
      const groqOk = !!GROQ_KEY && mediaSize <= GROQ_MAX_BYTES;
      const whisperKnows = language === "Auto-detect" || language === "Hinglish" || !!WHISPER_LANG[language];
      const engines: (() => Promise<TranscribeResult>)[] = [];
      const groq = () => transcribeGroqFor(mediaFile, language);
      const gemini = () => transcribeWithGemini(mediaFile, mediaMime, language, duration);
      if (whisperKnows) {
        if (groqOk) engines.push(groq);
        if (geminiAvailable()) engines.push(gemini);
      } else {
        if (geminiAvailable()) engines.push(gemini);
        if (groqOk) engines.push(groq);
      }
      if (!engines.length) {
        if (!groqOk && GROQ_KEY) return res.status(413).json({ error: "This audio is too long for the free AI engine. Try a shorter clip." });
        return res.status(503).json({ error: "The AI service is not available right now. Please try again in a few minutes." });
      }

      let lastErr: unknown = null;
      for (const run of engines) {
        try {
          const raw = await run();
          if (raw.words.length === 0 && run !== engines[engines.length - 1]) continue;
          const result = await finalizeScript(raw, language);
          console.log(`[Transcribe] ${result.engine}: ${result.words.length} words (${result.detectedLanguage})`);
          return res.json(result);
        } catch (err) {
          lastErr = err;
          if (run === gemini) noteGeminiFailure(err);
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
      releaseSlot?.();
    }
  });

  // Switch existing captions between scripts (e.g. Hindi <-> Hinglish) without re-transcribing.
  app.post("/api/transliterate", rateLimit, express.json({ limit: "1mb" }), async (req, res) => {
    const words = req.body?.words;
    const target = String(req.body?.target || "");
    if (!Array.isArray(words) || !words.length || words.length > 5000 || !words.every((w) => typeof w === "string")) {
      return res.status(400).json({ error: "Invalid caption text." });
    }
    if (!expectedScript(target)) return res.status(400).json({ error: "Unsupported target language." });
    try {
      const fixed = await fixScript(words.map((word) => ({ word, start: 0, end: 0 })), target);
      if (fixed.method !== "AI" && target !== "Hinglish") {
        return res.status(503).json({ error: "The free AI is busy right now. Please try again in a minute." });
      }
      res.json({ words: fixed.words.map((w) => w.word), method: fixed.method });
    } catch (err) {
      console.error("[Transliterate] error:", err);
      res.status(502).json({ error: "Could not convert the captions. Please try again." });
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
    // index.html must never be cached, otherwise browsers keep requesting deleted asset hashes after a deploy.
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}  (groq=${!!GROQ_KEY}, gemini=${!!GEMINI_KEY})`);
  });
  // Node closes requests after 5 minutes by default, which kills long uploads + transcriptions.
  server.requestTimeout = 20 * 60 * 1000;
  server.headersTimeout = 2 * 60 * 1000;
  server.keepAliveTimeout = 65 * 1000;
}

startServer().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
