# 🎬 AutoCaption Studio

<div align="center">

**AI-powered animated captions for your videos — Hindi, Hinglish, English and 25+ languages**

[![Live Demo](https://img.shields.io/badge/LIVE-Demo-7c3aed?style=for-the-badge&logo=render)](https://caption-generator-9ch5.onrender.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Gemini](https://img.shields.io/badge/Gemini-AI-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev)

</div>

AutoCaption Studio uploads your video or audio, automatically **transcribes the speech with word-by-word timestamps using Google Gemini AI**, and lets you style, time, and export beautiful **animated captions** — all in your browser.

No video editing skills needed. Upload → Auto-transcribe → Style → Export.

---

## ✨ Features

### 🧠 AI Transcription
- Upload any video/audio file (MP4, WebM, WAV, MP3...)
- Automatic **language detection** — supports Hindi, Hinglish, English, Punjabi, Haryanvi, Bhojpuri, Bengali, Marathi, Gujarati, Urdu, Tamil, Telugu, Kannada, Malayalam, Spanish, Arabic, French, German, Russian, Japanese & **25+ languages**
- Hinglish mode: Hindi spoken in Roman script (e.g. *"Aap kaise ho"*)
- Hindi mode: verbatim Devanagari script (e.g. *"नमस्ते दोस्तों"*)
- **Word-by-word timestamps** with accurate pause detection
- Intelligent fallback across multiple Gemini models for maximum reliability

### 🎨 Caption Styles
- 3 display modes: **Karaoke · Single-word · Progressive**
- 4 animations: **Pop · Glow · Bounce · Classic**
- 8 premium fonts (Montserrat, Anton, Bangers, Bebas Neue, Hind, Poppins...)
- Custom text color, highlight color, stroke, size & vertical position
- Highlight pill / background box options
- **Live preview** — exactly what you see is what gets exported

### ✏️ Full Editor
- Click any caption to edit its text
- Fine-tune timing & sync offset (+/- 1.5s)
- Auto word-count-per-line, smart phrase splitting on pauses
- Undo / redo support

### 📤 Export
- **Burn captions directly into the video** (MP4)
- Download as **.SRT subtitle file** (works with YouTube, TikTok, Instagram, etc.)

### ☁️ Projects & Sync
- Projects auto-saved locally (IndexedDB) — no force-save needed
- Optional sign-in for **cloud sync** across devices
- Works offline for previously downloaded projects

---

## 🚀 Live Demo

Try it right now:

**https://caption-generator-9ch5.onrender.com**

> Note: Hosted on Render's free tier, the service may take ~30-60s to wake up after inactivity.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 6 |
| Styling | Tailwind CSS 4, Motion |
| Backend | Node.js, Express |
| AI Transcription | Google Gemini (`@google/genai`) |
| Audio Extraction | FFmpeg |
| Uploads | Multer |
| Local Storage | IndexedDB |
| Cloud Sync | Supabase Storage *(optional)* |
| Deployment | Docker · Render |

---

## 🛠️ How It Works

```
1. Upload video ──────────▶ FFmpeg extracts clean audio (WAV 16kHz)
2. Audio + prompt ────────▶ Google Gemini (word-by-word timestamps, JSON)
3. JSON ─────────────────▶ Phrases built (auto line-break on pauses)
4. Editor ────────────────▶ Real-time styled caption preview
5. Export ────────────────▶ Burn-in MP4 or .SRT download
```

The server (`server.ts`) handles the heavy lifting: file upload, ffmpeg audio extraction, and multi-model Gemini transcription with a resilient Tier-1 (inline base64) → Tier-2 (Files API) fallback chain.

---

## 📁 Project Structure

```
├── server.ts                 # Express API + Gemini transcription + ffmpeg
├── src/
│   ├── App.tsx               # App shell / routing
│   ├── components/
│   │   ├── ProjectList.tsx   # Project gallery
│   │   ├── Editor.tsx        # Caption editor & export
│   │   └── EditorPanels.tsx  # Captions / timing / style panels
│   └── lib/
│       ├── captionUtils.ts   # Phrases, SRT builder, word repair
│       ├── captionRenderer.ts# Canvas caption renderer + font presets
│       ├── audioExtractor.ts # Client-side upload prep
│       ├── selfHeal.ts       # Auto-recovery helpers
│       ├── db.ts             # IndexedDB + cloud sync
│       ├── cloud.ts          # Supabase storage adapter
│       └── supabase.ts       # Optional auth
├── Dockerfile                # Production image (Node 20 + ffmpeg)
├── render.yaml               # Render blueprint
└── vite.config.ts
```

---

## 🧑‍💻 Run Locally

### Prerequisites
- Node.js **18+**
- A free [Google Gemini API key](https://aistudio.google.com/apikey)

### Install & run

```bash
# 1. Clone
git clone https://github.com/AnujRor/Caption-Genrate-.git
cd Caption-Genrate-

# 2. Install dependencies
npm install

# 3. Add your Gemini API key
#    Create a .env file in the project root:
echo "GEMINI_API_KEY=YOUR_KEY_HERE" > .env

# 4. Start dev server
npm run dev
```

Open **http://localhost:3000** — the Vite dev server runs inside the Express app.

### Production build

```bash
npm run build      # builds dist/ (frontend + bundled server)
npm start          # serves the app in production mode
```

---

## ☁️ Deploy on Render

This repo ships with a `Dockerfile` (includes **FFmpeg**) and a `render.yaml` blueprint.

**Option A — One-click (blueprint):**
1. Go to [Render Dashboard](https://dashboard.render.com) → **New → Blueprint**
2. Connect the `Caption-Genrate-` repo
3. Add environment variable: `GEMINI_API_KEY`
4. **Apply** → Render handles the rest

**Option B — Manual web service:**
- Runtime: **Docker**
- Root directory: repo root
- Env var: `GEMINI_API_KEY`

> **Why not Vercel?** This app needs a long-running Express server plus FFmpeg for audio extraction — Vercel's serverless model can't run those.

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | Google Gemini API key from [AI Studio](https://aistudio.google.com/apikey) |
| `PORT` | No | Server port (Render injects this automatically; defaults to 3000) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | No | Optional cloud sync backend |
| `NODE_ENV` | No | `production` (set automatically in the Docker image) |

---

## 📝 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Express + Vite HMR) |
| `npm run build` | Production build (frontend + bundled server) |
| `npm start` | Run the production server |
| `npm run lint` | TypeScript type-check |
| `npm run preview` | Preview the Vite build |

---

## 🙏 Credits

- **Google Gemini** — speech-to-text transcription engine
- **FFmpeg** — audio extraction
- **React, Vite, Tailwind CSS** — the UI foundation

---

## 📄 License

This project is for personal/learning use. All generated captions belong to you.