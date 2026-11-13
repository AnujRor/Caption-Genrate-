import React from 'react';
import {
  ArrowRight,
  Captions,
  Check,
  Clock3,
  Download,
  FileText,
  Film,
  Github,
  GraduationCap,
  Instagram,
  Languages,
  Loader2,
  Megaphone,
  Mic,
  ShieldCheck,
  Sparkles,
  Type,
  UploadCloud,
  Wand2,
  Youtube,
  Zap,
} from 'lucide-react';
import { FAQS, LANGUAGES } from '../lib/seo';

interface LandingContentProps {
  onUpload: () => void;
  isImporting: boolean;
}

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI transcription with word-level timing',
    text: 'Whisper and Gemini detect every spoken word and sync each caption to the exact moment it is said — no manual timing needed.',
  },
  {
    icon: Languages,
    title: 'Hindi, Hinglish and 25+ languages',
    text: 'Caption Hindi videos in Devanagari or Roman Hinglish, plus English, Punjabi, Marathi, Bengali, Tamil, Telugu, Urdu, Spanish and more.',
  },
  {
    icon: Wand2,
    title: 'Viral caption styles and animations',
    text: 'Choose karaoke, single-word or progressive captions with pop, glow, bounce and classic animations, 8 premium fonts and custom colors.',
  },
  {
    icon: Type,
    title: 'Edit captions like a script',
    text: 'Click any line to fix a word, fine-tune the sync offset, split phrases on pauses and undo changes without leaving the editor.',
  },
  {
    icon: Download,
    title: 'Export MP4 with burned-in captions',
    text: 'Render a ready-to-post video in full quality, sized for Instagram Reels, YouTube Shorts and TikTok — no watermark added.',
  },
  {
    icon: FileText,
    title: 'Download SRT subtitles',
    text: 'Export a clean .srt file that works with YouTube, Instagram, TikTok, Premiere Pro, DaVinci Resolve and other editors.',
  },
];

const STEPS = [
  {
    icon: UploadCloud,
    title: 'Upload your video',
    text: 'Open AutoCaption Studio and drop an MP4, MOV, WEBM, M4V or MKV file — or an MP3, WAV or M4A audio track. Videos up to 1 GB are supported.',
  },
  {
    icon: Zap,
    title: 'Generate AI captions',
    text: 'Keep Auto-detect on or pick the spoken language. Whisper and Gemini transcribe the audio with word-by-word timestamps in seconds.',
  },
  {
    icon: Wand2,
    title: 'Style and export',
    text: 'Pick a caption style, fix any word, then export a captioned MP4 or download an SRT subtitle file for YouTube, Reels and Shorts.',
  },
];

const USE_CASES = [
  {
    icon: Instagram,
    title: 'Instagram Reels and TikTok',
    text: 'Keep viewers watching with bold, animated captions that follow every spoken word, even when the sound is off.',
  },
  {
    icon: Youtube,
    title: 'YouTube Shorts and long videos',
    text: 'Add accurate subtitles to Shorts, vlogs and tutorials, and download an SRT file for YouTube Studio.',
  },
  {
    icon: Mic,
    title: 'Podcasts and interviews',
    text: 'Turn interviews and podcast clips into readable, shareable videos with speaker-ready subtitles in minutes.',
  },
  {
    icon: GraduationCap,
    title: 'Online courses and tutorials',
    text: 'Make lessons easier to follow with synced captions in Hindi, Hinglish or English, then export an SRT for your course platform.',
  },
  {
    icon: Megaphone,
    title: 'Ads and product demos',
    text: 'Ship promotional videos faster with styled captions that highlight offers, features and calls to action.',
  },
  {
    icon: Film,
    title: 'Movies and short films',
    text: 'Caption dialogue-heavy clips with precise timing and a clean subtitle file ready for your editor.',
  },
];

export default function LandingContent({ onUpload, isImporting }: LandingContentProps) {
  return (
    <>
      {/* ------------------------------ Features ------------------------------ */}
      <section id="features" aria-labelledby="features-title" className="mt-16 scroll-mt-24">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300">Features</p>
          <h2 id="features-title" className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
            Everything you need to caption videos faster
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            AutoCaption Studio is a free AI video caption generator built for creators. Upload a video and get
            word-by-word animated subtitles in Hindi, Hinglish, English and 25+ languages — then edit, style and export
            without installing any software.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="panel p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-violet-300">
                <Icon size={17} aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-zinc-100">{title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------------------- How it works ---------------------------- */}
      <section id="how-it-works" aria-labelledby="how-it-works-title" className="mt-16 scroll-mt-24">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300">How it works</p>
          <h2 id="how-it-works-title" className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
            Add subtitles to a video in 3 steps
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            No editing skills, no timeline setup and no sign-up. The whole caption workflow runs in your browser in
            about two minutes.
          </p>
        </div>

        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="panel relative p-5">
              <span
                aria-hidden="true"
                className="absolute right-4 top-4 font-display text-3xl font-black text-white/5"
              >
                0{index + 1}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                <Icon size={17} aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-zinc-100">{title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------ Languages ----------------------------- */}
      <section id="languages" aria-labelledby="languages-title" className="mt-16 scroll-mt-24">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300">Languages</p>
          <h2 id="languages-title" className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
            A caption generator for Hindi, Hinglish and 25+ languages
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Code-mixed speech is handled properly: choose Hinglish to read Hindi in Roman letters the way people type on
            WhatsApp, or Hindi for Devanagari. Auto-detect works when you are not sure which language is spoken.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="panel p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Languages size={15} className="text-violet-300" aria-hidden="true" />
              Indian languages
            </h3>
            <ul className="mt-3 grid grid-cols-2 gap-1.5 text-xs text-zinc-400 sm:grid-cols-3">
              {LANGUAGES.indian.map((language) => (
                <li key={language} className="flex items-center gap-1.5">
                  <Check size={12} className="shrink-0 text-violet-400" aria-hidden="true" />
                  {language}
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Languages size={15} className="text-violet-300" aria-hidden="true" />
              Global languages
            </h3>
            <ul className="mt-3 grid grid-cols-2 gap-1.5 text-xs text-zinc-400 sm:grid-cols-3">
              {LANGUAGES.global.map((language) => (
                <li key={language} className="flex items-center gap-1.5">
                  <Check size={12} className="shrink-0 text-violet-400" aria-hidden="true" />
                  {language}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------ Use cases ----------------------------- */}
      <section id="use-cases" aria-labelledby="use-cases-title" className="mt-16 scroll-mt-24">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300">Use cases</p>
          <h2 id="use-cases-title" className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
            Made for Reels, Shorts, podcasts and courses
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Use the same AI caption generator for short-form social videos, long tutorials and everything in between.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="panel p-5">
              <div className="flex items-center gap-2 text-violet-300">
                <Icon size={16} aria-hidden="true" />
                <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* -------------------------------- FAQ -------------------------------- */}
      <section id="faq" aria-labelledby="faq-title" className="mt-16 scroll-mt-24">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300">FAQ</p>
          <h2 id="faq-title" className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
            Frequently asked questions
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Everything you need to know about the free AI caption generator, supported formats and exports.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {FAQS.map(({ question, answer }) => (
            <article key={question} className="panel p-5">
              <h3 className="text-sm font-semibold text-zinc-100">{question}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{answer}</p>
            </article>
          ))}
        </div>
      </section>

      {/* -------------------------------- CTA --------------------------------- */}
      <section aria-labelledby="cta-title" className="mt-16">
        <div className="panel relative overflow-hidden p-6 text-center sm:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_16rem_at_50%_0%,rgba(139,92,246,0.22),transparent_70%)]"
          />
          <div className="relative">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-600/30">
              <Captions size={22} className="text-white" aria-hidden="true" />
            </div>
            <h2 id="cta-title" className="mt-4 font-display text-2xl font-black tracking-tight sm:text-3xl">
              Start captioning your videos for free
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
              Upload a video, get word-by-word animated captions, and export a ready-to-post MP4 or SRT — no sign-up and
              no watermark.
            </p>
            <button
              type="button"
              onClick={onUpload}
              disabled={isImporting}
              className="btn-primary mt-5 px-5 py-3 text-sm"
            >
              {isImporting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <UploadCloud size={16} aria-hidden="true" />}
              Upload a video
              <ArrowRight size={15} aria-hidden="true" />
            </button>
            <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck size={12} aria-hidden="true" /> Private by default
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 size={12} aria-hidden="true" /> Captions in seconds
              </span>
              <span className="inline-flex items-center gap-1">
                <Sparkles size={12} aria-hidden="true" /> Powered by Whisper + Gemini
              </span>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-white/5 py-8">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600">
              <Captions size={15} className="text-white" aria-hidden="true" />
            </div>
            AutoCaption Studio
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Free AI video caption generator for Hindi, Hinglish and English creators. Make animated subtitles for
            Instagram Reels, YouTube Shorts, TikTok, podcasts and courses in minutes.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-8 sm:gap-10">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Product</h2>
            <ul className="mt-2 space-y-1.5 text-xs text-zinc-500">
              <li>
                <a href="#features" className="transition-colors hover:text-violet-300">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="transition-colors hover:text-violet-300">
                  How it works
                </a>
              </li>
              <li>
                <a href="#languages" className="transition-colors hover:text-violet-300">
                  Languages
                </a>
              </li>
              <li>
                <a href="#faq" className="transition-colors hover:text-violet-300">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Use cases</h2>
            <ul className="mt-2 space-y-1.5 text-xs text-zinc-500">
              <li>
                <a href="#use-cases" className="transition-colors hover:text-violet-300">
                  Instagram Reels
                </a>
              </li>
              <li>
                <a href="#use-cases" className="transition-colors hover:text-violet-300">
                  YouTube Shorts
                </a>
              </li>
              <li>
                <a href="#use-cases" className="transition-colors hover:text-violet-300">
                  Podcasts
                </a>
              </li>
              <li>
                <a href="#use-cases" className="transition-colors hover:text-violet-300">
                  Online courses
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Guides</h2>
            <ul className="mt-2 space-y-1.5 text-xs text-zinc-500">
              <li>
                <a href="/guides/hindi-video-captions.html" className="transition-colors hover:text-violet-300">
                  Hindi captions
                </a>
              </li>
              <li>
                <a href="/guides/hinglish-captions.html" className="transition-colors hover:text-violet-300">
                  Hinglish captions
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Project</h2>
            <ul className="mt-2 space-y-1.5 text-xs text-zinc-500">
              <li>
                <a
                  href="https://github.com/AnujRor/Caption-Genrate-"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-violet-300"
                >
                  <Github size={12} aria-hidden="true" />
                  GitHub
                </a>
              </li>
              <li>
                <a href="#faq" className="transition-colors hover:text-violet-300">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#faq" className="transition-colors hover:text-violet-300">
                  Supported formats
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <p className="mt-8 text-[11px] text-zinc-600">
        © {year} AutoCaption Studio. Built with Whisper, Gemini, React and FFmpeg.
      </p>
    </footer>
  );
}
