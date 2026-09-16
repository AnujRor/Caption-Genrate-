import express from "express";
import path from "path";
import multer from "multer";
import fs from "fs";
import { exec } from "child_process";
import util from "util";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

const execPromise = util.promisify(exec);

const uploadDir = "/tmp/uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.includes("wav") ? ".wav" : file.mimetype.includes("audio") ? ".mp3" : ".mp4");
    cb(null, `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
  }
});
const upload = multer({ storage });

// Helper to extract crisp audio from video using ffmpeg at ultra-high speed
async function extractAudio(inputVideoPath: string, outputAudioPath: string): Promise<boolean> {
  try {
    await execPromise(`ffmpeg -y -i "${inputVideoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${outputAudioPath}"`);
    if (fs.existsSync(outputAudioPath) && fs.statSync(outputAudioPath).size > 200) {
      return true;
    }
    return false;
  } catch (err) {
    console.warn("FFmpeg audio extraction failed or no audio stream:", err);
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Initialize Gemini API with latest SDK pattern
  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Body parser
  app.use(express.json({ limit: "500mb" }));
  app.use(express.urlencoded({ extended: true, limit: "500mb" }));

  // API Route: Transcribe Audio/Video
  app.post("/api/transcribe", upload.single('video'), async (req, res) => {
    let tempFilePath: string | null = null;
    let audioFilePath: string | null = null;
    let uploadedFileName: string | null = null;

    try {
      const { language, mimeType } = req.body;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: "No video file provided." });
      }
      
      tempFilePath = file.path;
      console.log(`[Transcribe] Received upload: ${tempFilePath} (${mimeType || file.mimetype})`);

      // 1. Determine if file is already audio or needs ffmpeg extraction
      const isAlreadyAudio = (mimeType && mimeType.startsWith("audio/")) || (file.mimetype && file.mimetype.startsWith("audio/")) || file.originalname.endsWith(".wav") || file.originalname.endsWith(".mp3");
      let targetUploadFile = tempFilePath;
      let targetMimeType = mimeType || file.mimetype || "video/mp4";

      if (!isAlreadyAudio) {
        audioFilePath = `${tempFilePath}_audio.wav`;
        const hasAudio = await extractAudio(tempFilePath, audioFilePath);
        if (hasAudio) {
          targetUploadFile = audioFilePath;
          targetMimeType = "audio/wav";
          console.log(`[Transcribe] Extracted pure WAV audio stream: ${audioFilePath} (${Math.round(fs.statSync(audioFilePath).size / 1024)} KB)`);
        } else {
          console.log(`[Transcribe] Using raw media file directly: ${targetUploadFile}`);
        }
      } else {
        targetMimeType = targetMimeType.startsWith("audio/") ? targetMimeType : "audio/wav";
        console.log(`[Transcribe] Received direct audio stream (${targetMimeType})`);
      }

      // 2. Transcribe using Gemini with Multi-Tier Resilience & Fallbacks
      const targetLang = language || "Auto-detect";
      let langInstruction = `Identify and detect ANY spoken language or dialect automatically (Hindi, Hinglish, English, Punjabi, Haryanvi, Rajasthani, Bhojpuri, Bengali, Marathi, Gujarati, Urdu, Tamil, Telugu, Kannada, Malayalam, Spanish, Arabic, French, German, Russian, Japanese, etc.).`;
      
      if (targetLang && targetLang !== "Auto-detect") {
        if (targetLang.toLowerCase().includes("hinglish")) {
          langInstruction = `The user selected Hinglish (Hindi spoken words written in Roman/English alphabet, e.g. "Aap kaise ho", "Video ko like karo"). Transcribe verbatim in Roman script.`;
        } else if (targetLang.toLowerCase().includes("hindi")) {
          langInstruction = `The user selected Hindi. Transcribe verbatim in Devanagari script (e.g. "नमस्ते दोस्तों", "आज हम बात करेंगे"). DO NOT translate into English.`;
        } else {
          langInstruction = `The user selected ${targetLang}. Transcribe verbatim in ${targetLang} using native script. DO NOT translate into English.`;
        }
      }

      const prompt = `You are an expert multilingual speech-to-text subtitling engine.
Listen carefully to the audio track. Accurately detect the spoken language and generate exact word-by-word timestamps matching the vocal audio track.

LANGUAGE DETECTION & SCRIPT RULES:
1. ${langInstruction}
2. CRITICAL: Never translate spoken words into English unless the speaker is speaking English. Keep the original uttered words in authentic native script (e.g. Devanagari for Hindi/Haryanvi, Gurmukhi for Punjabi, Bengali for Bangla, etc., or Roman alphabet for Hinglish).
3. If no speech is present in the audio, return an empty "words" array [].

PRECISE TIMING & PAUSE RULES:
1. "start": The exact second (decimal e.g. 1.24) when the speaker begins vocalizing the word.
2. "end": The exact second (decimal e.g. 1.58) when the speaker stops vocalizing the word.
3. PAUSES & SILENCE: When the speaker takes a breath, pauses, or stops talking, DO NOT extend word durations across the silence. There must be an accurate gap between words.
4. Clean punctuation marks out of the "word" property.

Return the JSON object conforming to the schema with:
- "detectedLanguage": The specific detected language name (e.g. "Hindi (हिन्दी)", "Hinglish", "English", "Punjabi (ਪੰਜਾਬੀ)", "Haryanvi", "Bengali", "Spanish", etc.)
- "words": Array of word objects with { "word": string, "start": number, "end": number }`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          detectedLanguage: {
            type: Type.STRING,
            description: "The detected spoken language or dialect name (e.g. Hindi, Hinglish, English, Punjabi, Haryanvi, Marathi, Gujarati, etc.)"
          },
          words: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING, description: "Single uttered word without punctuation" },
                start: { type: Type.NUMBER, description: "Start timestamp in seconds" },
                end: { type: Type.NUMBER, description: "End timestamp in seconds" }
              },
              required: ["word", "start", "end"]
            }
          }
        },
        required: ["detectedLanguage", "words"]
      };

      let responseText = "";
      // Verified active official models with robust fallback chain
      const modelsToTry = [
        "gemini-3.6-flash",
        "gemini-3.1-flash-lite",
        "gemini-flash-latest",
        "gemini-3.7-flash",
        "gemini-3.6-pro"
      ];
      let transcriptionSuccess = false;
      let lastModelError: any = null;

      // Tier 1 (Fast & Reliable): Direct Inline Base64 for audio/video media
      const fileStats = fs.existsSync(targetUploadFile) ? fs.statSync(targetUploadFile) : null;
      const isUnderInlineLimit = fileStats && fileStats.size < 20 * 1024 * 1024;

      if (isUnderInlineLimit && fs.existsSync(targetUploadFile)) {
        try {
          console.log(`[Transcribe] Running Tier 1 (Fast Inline Base64): ${Math.round(fileStats.size / 1024)} KB, mime: ${targetMimeType}`);
          const fileBuffer = fs.readFileSync(targetUploadFile);
          const base64Data = fileBuffer.toString("base64");

          for (const modelName of modelsToTry) {
            try {
              console.log(`[Transcribe] Attempting with model: ${modelName}`);
              
              for (let retry = 0; retry < 3; retry++) {
                try {
                  const response = await ai.models.generateContent({
                    model: modelName,
                    contents: [
                      {
                        role: "user",
                        parts: [
                          { inlineData: { mimeType: targetMimeType, data: base64Data } },
                          { text: prompt }
                        ]
                      }
                    ],
                    config: {
                      temperature: 0.1,
                      responseMimeType: "application/json",
                      responseSchema: responseSchema,
                    },
                  });
                  responseText = response.text || "{}";
                  if (responseText && responseText.length > 5) {
                    transcriptionSuccess = true;
                    console.log(`[Transcribe] Success with model: ${modelName}`);
                    break;
                  }
                } catch (retryErr: any) {
                  const errMsg = String(retryErr?.message || retryErr);
                  const isTransient = errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand") || errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED");
                  if (isTransient && retry < 2) {
                    const delay = (retry + 1) * 1500;
                    console.log(`[Transcribe] Model ${modelName} temporary busy (503/429). Retrying in ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                  } else {
                    throw retryErr;
                  }
                }
              }

              if (transcriptionSuccess) break;
            } catch (mErr: any) {
              console.warn(`[Transcribe] Model ${modelName} failed on inline data (${mErr?.message || mErr}). Trying next model...`);
              lastModelError = mErr;
            }
          }
        } catch (tier1Err) {
          console.warn("[Transcribe] Tier 1 inline failed, proceeding to Tier 2 (Files API):", tier1Err);
        }
      }

      // Tier 2: Files API for larger media or if Tier 1 encountered an issue
      if (!transcriptionSuccess && fs.existsSync(targetUploadFile)) {
        try {
          console.log(`[Transcribe] Running Tier 2 (Files API upload)...`);
          let uploadedFile = await ai.files.upload({
            file: targetUploadFile,
            config: { mimeType: targetMimeType },
          });
          uploadedFileName = uploadedFile.name;
          console.log(`[Transcribe] Uploaded to Gemini Files API: ${uploadedFile.name}`);

          let attempts = 0;
          while (uploadedFile.state === "PROCESSING" && attempts < 20) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 800));
            uploadedFile = await ai.files.get({ name: uploadedFile.name });
          }

          if (uploadedFile.state === "ACTIVE" || uploadedFile.state === undefined) {
            for (const modelName of modelsToTry) {
              try {
                console.log(`[Transcribe Files API] Attempting with model: ${modelName}`);
                for (let retry = 0; retry < 3; retry++) {
                  try {
                    const response = await ai.models.generateContent({
                      model: modelName,
                      contents: [
                        {
                          role: "user",
                          parts: [
                            { fileData: { fileUri: uploadedFile.uri, mimeType: uploadedFile.mimeType || targetMimeType } },
                            { text: prompt }
                          ]
                        }
                      ],
                      config: {
                        temperature: 0.1,
                        responseMimeType: "application/json",
                        responseSchema: responseSchema,
                      },
                    });
                    responseText = response.text || "{}";
                    if (responseText && responseText.length > 5) {
                      transcriptionSuccess = true;
                      console.log(`[Transcribe Files API] Success with ${modelName}`);
                      break;
                    }
                  } catch (retryErr: any) {
                    const errMsg = String(retryErr?.message || retryErr);
                    const isTransient = errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand") || errMsg.includes("429");
                    if (isTransient && retry < 2) {
                      const delay = (retry + 1) * 1500;
                      console.log(`[Transcribe Files API] Model ${modelName} temporary busy (503/429). Retrying in ${delay}ms...`);
                      await new Promise(r => setTimeout(r, delay));
                    } else {
                      throw retryErr;
                    }
                  }
                }

                if (transcriptionSuccess) break;
              } catch (mErr: any) {
                console.warn(`[Transcribe Files API] ${modelName} failed (${mErr?.message || mErr}). Trying next model...`);
                lastModelError = mErr;
              }
            }
          }
        } catch (filesApiErr) {
          console.warn("[Transcribe] Files API attempt failed:", filesApiErr);
          lastModelError = filesApiErr;
        }
      }

      if (!transcriptionSuccess) {
        throw lastModelError || new Error("Failed to transcribe audio across all available AI models.");
      }

      // Robust JSON parsing and extraction
      responseText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
      let parsedData: any = {};
      
      try {
        parsedData = JSON.parse(responseText);
      } catch (parseErr) {
        const jsonMatch = responseText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
          try {
            parsedData = JSON.parse(jsonMatch[0]);
          } catch (nestedErr) {
            console.error("JSON regex extraction failed:", responseText);
            parsedData = { detectedLanguage: targetLang, words: [] };
          }
        } else {
          parsedData = { detectedLanguage: targetLang, words: [] };
        }
      }

      // Handle if root is array or nested
      const rawList: any[] = Array.isArray(parsedData) 
        ? parsedData 
        : (parsedData.words || parsedData.captions || parsedData.subtitles || parsedData.segments || parsedData.transcript || []);
      
      const words = rawList.map((item: any) => {
        const wordText = String(item.word || item.text || item.token || '').trim();
        const startSec = typeof item.start === 'number' ? item.start : Number(item.start_time || item.startTime || 0);
        const endSec = typeof item.end === 'number' ? item.end : Number(item.end_time || item.endTime || (startSec + 0.25));
        return {
          word: wordText,
          start: isNaN(startSec) ? 0 : Number(startSec.toFixed(2)),
          end: isNaN(endSec) ? Number((startSec + 0.25).toFixed(2)) : Number(endSec.toFixed(2)),
        };
      }).filter((w: any) => w.word.length > 0);

      const detectedLanguage = (!Array.isArray(parsedData) && parsedData.detectedLanguage) || targetLang;

      console.log(`[Transcribe] Done! Extracted ${words.length} words. Detected: ${detectedLanguage}`);

      // Cleanup local files
      if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      if (audioFilePath && fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);

      // Cleanup Gemini remote file
      if (uploadedFileName) {
        try {
          await ai.files.delete({ name: uploadedFileName });
        } catch (cleanupError) {
          console.error("Failed to delete remote file:", cleanupError);
        }
      }

      res.json({ detectedLanguage, words });
    } catch (error) {
      console.error("[Transcribe Error]:", error);
      if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      if (audioFilePath && fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
      res.status(500).json({ error: "Failed to transcribe video. " + (error as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
