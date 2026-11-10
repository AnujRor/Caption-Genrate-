import { useEffect } from 'react';

const configuredUrl = ((import.meta as any).env?.VITE_SITE_URL as string | undefined)?.trim();

/**
 * Canonical production URL used by canonical tags, Open Graph, Twitter cards,
 * structured data and the sitemap. Override it at build time with VITE_SITE_URL.
 */
export const SITE_URL = (configuredUrl || 'https://caption-generator-9ch5.onrender.com').replace(/\/+$/, '');

export const SITE_NAME = 'AutoCaption Studio';

export const DEFAULT_TITLE = 'Free AI Video Caption Generator — Hindi, Hinglish & English';

export const DEFAULT_DESCRIPTION =
  'Generate accurate animated captions for your videos free with AI. Word-by-word subtitles in Hindi, Hinglish, English & 25+ languages, export MP4 or SRT.';

export const DEFAULT_KEYWORDS = [
  'AI video caption generator',
  'free caption generator',
  'auto subtitles',
  'Hindi captions',
  'Hinglish captions',
  'video subtitle generator',
  'SRT generator',
  'animated captions',
  'Instagram Reels captions',
  'YouTube Shorts subtitles',
  'TikTok captions',
  'add subtitles to video',
];

/** Languages shown on the landing page (kept in sync with server/scripts.ts). */
export const LANGUAGES = {
  indian: [
    'Hindi',
    'Hinglish',
    'Punjabi',
    'Haryanvi',
    'Bhojpuri',
    'Marathi',
    'Gujarati',
    'Bengali',
    'Urdu',
    'Tamil',
    'Telugu',
    'Kannada',
    'Malayalam',
    'Assamese',
    'Odia',
  ],
  global: [
    'English',
    'Arabic',
    'Spanish',
    'French',
    'German',
    'Russian',
    'Japanese',
    'Korean',
    'Chinese',
    'Portuguese',
    'Italian',
    'Turkish',
    'Nepali',
  ],
};

export interface FaqItem {
  question: string;
  answer: string;
}

/** FAQ content — also mirrored in the FAQPage JSON-LD inside index.html. */
export const FAQS: FaqItem[] = [
  {
    question: 'Is AutoCaption Studio free to use?',
    answer:
      'Yes. You can generate AI captions, style them and export captioned videos or SRT files for free. No credit card and no watermark are required.',
  },
  {
    question: 'Which languages does the caption generator support?',
    answer:
      'It supports Hindi, Hinglish, English, Punjabi, Haryanvi, Bhojpuri, Marathi, Gujarati, Bengali, Urdu, Tamil, Telugu, Kannada, Malayalam, Assamese, Odia, Arabic, Spanish, French, German, Russian, Japanese, Korean, Chinese, Portuguese, Italian and Turkish.',
  },
  {
    question: 'How accurate are the AI-generated captions?',
    answer:
      'Captions are generated with word-level timestamps by Whisper and Gemini. Accuracy is highest with clear audio; you can click any caption in the editor to fix a word or adjust the sync before exporting.',
  },
  {
    question: 'Can I download subtitles as an SRT file?',
    answer:
      'Yes. Use the SRT button in the editor to download a standard .srt file that works with YouTube, Instagram, TikTok, Premiere Pro and DaVinci Resolve.',
  },
  {
    question: 'Do I need video editing experience?',
    answer:
      'No. Upload a video, let the AI create the captions, choose a style and export. Everything runs in your browser, so there is nothing to install.',
  },
  {
    question: 'What video formats and sizes are supported?',
    answer:
      'You can upload MP4, MOV, WEBM, M4V and MKV videos or MP3, WAV and M4A audio up to 1 GB. The server extracts the audio for transcription and deletes temporary files after processing.',
  },
  {
    question: 'Are my videos private?',
    answer:
      'Your video is only uploaded for transcription, and temporary files are deleted after processing. Projects are stored locally in your browser unless you choose optional cloud sync.',
  },
];

interface SeoOptions {
  title: string;
  description: string;
  /** Path relative to SITE_URL, always starting with "/". */
  path?: string;
  robots?: string;
}

function setMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
}

function setLink(rel: string, href: string, extra: Record<string, string> = {}) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
  for (const [name, value] of Object.entries(extra)) element.setAttribute(name, value);
}

/**
 * Keeps the document title, description, canonical, robots and social tags in
 * sync with the current view. index.html already contains the defaults, so
 * crawlers get complete metadata even before React hydrates.
 */
export function useSeo({ title, description, path = '/', robots = 'index, follow, max-image-preview:large' }: SeoOptions) {
  useEffect(() => {
    const url = `${SITE_URL}${path}`;
    const image = `${SITE_URL}/og-image.png`;

    document.title = title;
    setMeta('meta[name="description"]', { name: 'description', content: description });
    setMeta('meta[name="robots"]', { name: 'robots', content: robots });
    setLink('canonical', url);

    setMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: url });
    setMeta('meta[property="og:image"]', { property: 'og:image', content: image });

    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
  }, [title, description, path, robots]);
}
