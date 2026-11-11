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
├── index.html                # Meta tags, Open Graph, JSON-LD structured data
├── public/
│   ├── robots.txt            # Crawler rules + sitemap reference
│   ├── sitemap.xml           # Indexable URLs
│   ├── sitemap.xsl           # Human-readable browser view of the sitemap
│   ├── og-image.png          # 1200×630 social preview image
│   ├── icon-192.png / icon-512.png / apple-touch-icon.png / favicon-32.png
│   ├── favicon.svg           # Scalable app icon
│   ├── site.webmanifest      # PWA manifest
│   ├── 404.html              # No-index not-found page
│   └── llms.txt              # Summary for AI search engines
├── scripts/
│   ├── prerender.tsx         # Renders landing HTML, injects verification tags + IndexNow key
│   ├── check-seo.mjs         # 20-point SEO audit of dist/ (runs in CI)
│   ├── indexnow.mjs          # Instant indexing ping for Bing/Yandex/Seznam/Naver
│   └── generate-seo-assets.ps1 # Regenerates OG image and icons
├── src/
│   ├── App.tsx               # App shell / routing
│   ├── components/
│   │   ├── ProjectList.tsx   # Landing page + project gallery
│   │   ├── LandingContent.tsx# SEO content: features, how-to, languages, FAQ
│   │   ├── Editor.tsx        # Caption editor & export
│   │   └── EditorPanels.tsx  # Captions / timing / style panels
│   └── lib/
│       ├── seo.ts            # Site metadata, FAQ copy and useSeo hook
│       ├── captionUtils.ts   # Phrases, SRT builder, word repair
│       ├── captionRenderer.ts# Canvas caption renderer + font presets
│       ├── audioExtractor.ts # Client-side upload prep
│       ├── selfHeal.ts       # Auto-recovery helpers
│       ├── db.ts             # IndexedDB + cloud sync
│       ├── cloud.ts          # Supabase storage adapter
│       └── supabase.ts       # Optional auth
├── docs/
│   └── off-page-seo.md       # Search Console, IndexNow, backlinks and launch kit
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
| `VITE_SITE_URL` / `SITE_URL` | No | Canonical production URL. Defaults to the Render URL; when set, the build rewrites canonical, Open Graph, `robots.txt` and `sitemap.xml` |
| `GOOGLE_SITE_VERIFICATION` / `VITE_GOOGLE_SITE_VERIFICATION` | No | Google Search Console HTML-tag token, injected as `<meta name="google-site-verification">` |
| `BING_SITE_VERIFICATION` / `VITE_BING_SITE_VERIFICATION` | No | Bing Webmaster token, injected as `<meta name="msvalidate.01">` |
| `INDEXNOW_KEY` | No | Overrides the default IndexNow key; the build writes `<key>.txt` into `dist/` |
| `NODE_ENV` | No | `production` (set automatically in the Docker image) |

---

## 📝 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Express + Vite HMR) |
| `npm run build` | Production build (frontend + bundled server) |
| `npm start` | Run the production server |
| `npm run lint` | TypeScript type-check |
| `npm run seo:check` | Audit `dist/` SEO after a build (title, headings, schema, sitemap, OG image, IndexNow key) |
| `npm run seo:indexnow` | Ping IndexNow partners after a deploy (optionally pass URLs) |
| `npm run preview` | Preview the Vite build |

---

## 🔍 SEO

The landing page ships with complete on-page SEO:

| Area | Implementation |
|------|----------------|
| Title & description | Keyword-focused `<title>` (63 chars) and meta description (156 chars) in `index.html`, kept in sync by `src/lib/seo.ts` |
| Keywords | `meta name="keywords"` plus natural keyword coverage in headings and body copy |
| Canonical | `<link rel="canonical">`, `hreflang` and matching Open Graph URLs |
| Social | Open Graph + Twitter `summary_large_image` with a generated 1200×630 `og-image.png` |
| Headings | Exactly one `<h1>`; section `<h2>`s; feature/step/language/FAQ `<h3>`s |
| Structured data | `WebApplication`, `WebSite`, `Organization`, `FAQPage` and `HowTo` JSON-LD |
| Content | Features, how-it-works, 28 languages, six use cases, seven FAQs, CTA and footer |
| Crawlers | `robots.txt`, `sitemap.xml`, `llms.txt`, `site.webmanifest`, semantic landmarks, skip link |
| Performance | gzip compression, preconnect to Google Fonts, lazy-loaded editor chunk, lazy project thumbnails |
| Rendering | `scripts/prerender.tsx` renders the landing page into `dist/index.html` at build time so crawlers get full HTML without running JS |
| Verification | Google Search Console and Bing Webmaster meta tags are injected from env vars — no HTML edits needed |
| Indexing | `npm run seo:indexnow` instantly notifies Bing/Yandex/Seznam/Naver after each deploy |
| Errors | Unknown paths return a real `404` page instead of a soft-404 copy of the home page |

Run `npm run seo:check` after `npm run build` to verify all 20 checks still pass;
CI runs it on every push.

### Off-page SEO

Search Console/Bing submission, IndexNow usage, GitHub repo optimization,
copy-paste launch posts, directory targets, anchor-text guidance and a 30-day
plan live in **[docs/off-page-seo.md](docs/off-page-seo.md)**.

### Set your production domain

The canonical URL defaults to `https://caption-generator-9ch5.onrender.com`. For a
custom domain, set `VITE_SITE_URL` (or `SITE_URL`) in the build environment —
`scripts/prerender.tsx` rewrites the canonical, Open Graph, Twitter and JSON-LD
URLs in `dist/index.html` plus `robots.txt` and `sitemap.xml` automatically. You
can also change the fallback in `src/lib/seo.ts` (`SITE_URL`).

### After deploying

1. Run `npm run seo:indexnow` to notify Bing, Yandex, Seznam and Naver instantly.
2. Verify the site in [Google Search Console](https://search.google.com/search-console) and submit `https://your-domain/sitemap.xml`.
3. Do the same in [Bing Webmaster Tools](https://www.bing.com/webmasters).
4. Preview a link in WhatsApp, X/Twitter or Facebook and check the Open Graph image appears.
5. Regenerate the social image and icons after branding changes: `powershell -ExecutionPolicy Bypass -File scripts/generate-seo-assets.ps1`.
6. Rebuild (`npm run build`) so the prerendered HTML is refreshed, then run `npm run seo:check`.

---

## 🙏 Credits

- **Google Gemini** — speech-to-text transcription engine
- **FFmpeg** — audio extraction
- **React, Vite, Tailwind CSS** — the UI foundation

---

## 📄 License

This project is for personal/learning use. All generated captions belong to you.