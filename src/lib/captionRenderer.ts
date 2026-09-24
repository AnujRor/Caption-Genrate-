// Single caption renderer shared by the live preview and the video export,
// so what you see in the editor is exactly what gets burned into the video.
import { Phrase, StyleOptions, Word } from '../types';

const HOLD_AFTER_PHRASE = 0.35; // keep a line on screen briefly after the last word
const WORD_GAP_BRIDGE = 0.3; // bridge tiny silences between words to avoid flicker
const ANIM_DURATION = 0.2;
const REFERENCE_SIZE = 400; // fontSize is defined for a 400px short-side frame

export const FONTS: { label: string; value: string; weight: number }[] = [
  { label: 'Montserrat', value: "'Montserrat', 'Hind', sans-serif", weight: 900 },
  { label: 'Poppins', value: "'Poppins', 'Hind', sans-serif", weight: 800 },
  { label: 'Anton', value: "'Anton', 'Hind', sans-serif", weight: 400 },
  { label: 'Bebas Neue', value: "'Bebas Neue', 'Hind', sans-serif", weight: 400 },
  { label: 'Bangers', value: "'Bangers', 'Hind', cursive", weight: 400 },
  { label: 'Inter', value: "'Inter', 'Hind', sans-serif", weight: 800 },
  { label: 'Hind (हिन्दी)', value: "'Hind', sans-serif", weight: 700 },
];

export function fontWeight(family: string): number {
  const match = FONTS.find((f) => f.value === family || family.includes(f.label.split(' ')[0]));
  return match ? match.weight : 800;
}

export function ensureFontLoaded(family: string): Promise<unknown> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  return document.fonts.load(`${fontWeight(family)} 40px ${family}`, 'Aaअ').catch(() => undefined);
}

export const PRESETS: { name: string; styles: Partial<StyleOptions> }[] = [
  {
    name: 'Viral Yellow',
    styles: { fontFamily: FONTS[0].value, textColor: '#ffffff', highlightColor: '#facc15', strokeColor: '#000000', strokeWidth: 3, displayMode: 'karaoke', animationStyle: 'pop', uppercase: true, highlightBox: false, background: false },
  },
  {
    name: 'Green Box',
    styles: { fontFamily: FONTS[0].value, textColor: '#ffffff', highlightColor: '#22c55e', strokeColor: '#000000', strokeWidth: 3, displayMode: 'karaoke', animationStyle: 'pop', uppercase: true, highlightBox: true, background: false },
  },
  {
    name: 'Comic Bounce',
    styles: { fontFamily: FONTS[4].value, textColor: '#ffffff', highlightColor: '#f43f5e', strokeColor: '#000000', strokeWidth: 4, displayMode: 'single-word', animationStyle: 'bounce', uppercase: true, highlightBox: false, background: false },
  },
  {
    name: 'Neon Glow',
    styles: { fontFamily: FONTS[1].value, textColor: '#e0e7ff', highlightColor: '#22d3ee', strokeColor: '#0f172a', strokeWidth: 1, displayMode: 'progressive', animationStyle: 'glow', uppercase: false, highlightBox: false, background: false },
  },
  {
    name: 'Clean Subtitle',
    styles: { fontFamily: FONTS[5].value, textColor: '#ffffff', highlightColor: '#ffffff', strokeColor: '#000000', strokeWidth: 0, displayMode: 'karaoke', animationStyle: 'classic', uppercase: false, highlightBox: false, background: true },
  },
  {
    name: 'Bold Pink',
    styles: { fontFamily: FONTS[2].value, textColor: '#ffffff', highlightColor: '#f472b6', strokeColor: '#000000', strokeWidth: 3, displayMode: 'single-word', animationStyle: 'pop', uppercase: true, highlightBox: false, background: false },
  },
];

export interface ActiveCaption {
  phrase: number;
  word: number;
  speaking: boolean;
}

const NONE: ActiveCaption = { phrase: -1, word: -1, speaking: false };

export function findActive(phrases: Phrase[], t: number): ActiveCaption {
  let lo = 0;
  let hi = phrases.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (phrases[mid].start <= t) {
      idx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (idx === -1) return NONE;
  const phrase = phrases[idx];
  const next = phrases[idx + 1];
  const visibleUntil = Math.min(phrase.end + HOLD_AFTER_PHRASE, next ? next.start : Infinity);
  if (t > visibleUntil) return NONE;

  let word = -1;
  for (let i = 0; i < phrase.words.length; i++) {
    if (phrase.words[i].start <= t) word = i;
    else break;
  }
  const speaking = word >= 0 && t <= phrase.words[word].end;
  return { phrase: idx, word, speaking };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function easeOutBack(x: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function easeOutBounce(x: number) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

function isLight(hex: string) {
  const h = hex.replace('#', '');
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  ctx.fill();
}

interface LaidOutWord {
  word: Word;
  text: string;
  width: number;
  index: number;
}

export function drawCaptions(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  phrases: Phrase[],
  styles: StyleOptions
) {
  const t = time + (styles.syncOffset || 0);
  const active = findActive(phrases, t);
  if (active.phrase === -1) return;
  const phrase = phrases[active.phrase];
  if (!phrase || phrase.words.length === 0) return;

  const mode = styles.displayMode || 'karaoke';
  const anim = styles.animationStyle || 'pop';
  const scale = Math.min(width, height) / REFERENCE_SIZE;
  let fontPx = Math.max(6, styles.fontSize * scale);
  const weight = fontWeight(styles.fontFamily);

  const current = active.word >= 0 ? phrase.words[active.word] : null;
  const highlightLive = !!current && (active.speaking || t - current.end < WORD_GAP_BRIDGE);

  let visible: Word[];
  if (mode === 'single-word') {
    if (!current || !highlightLive) return;
    visible = [current];
  } else if (mode === 'progressive') {
    visible = phrase.words.slice(0, Math.max(1, active.word + 1));
  } else {
    visible = phrase.words;
  }
  const hiIndex = mode === 'single-word' ? 0 : highlightLive ? active.word : -1;

  // Social-style captions read cleaner without trailing commas/periods (SRT keeps them).
  const transform = (s: string) => {
    const clean = s.replace(/[,.;:।]+$/, '') || s;
    return styles.uppercase === false ? clean : clean.toLocaleUpperCase();
  };
  const maxLineWidth = width * 0.86;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  const setFont = () => (ctx.font = `${weight} ${fontPx}px ${styles.fontFamily}`);
  setFont();

  // Single words that don't fit get shrunk instead of overflowing the frame.
  if (visible.length === 1) {
    const w = ctx.measureText(transform(visible[0].word)).width;
    if (w > maxLineWidth) {
      fontPx *= maxLineWidth / w;
      setFont();
    }
  }

  const spaceWidth = ctx.measureText(' ').width * 1.1;
  const items: LaidOutWord[] = visible.map((word, index) => {
    const text = transform(word.word);
    return { word, text, width: ctx.measureText(text).width, index };
  });

  // Greedy line wrapping
  const lines: LaidOutWord[][] = [];
  let line: LaidOutWord[] = [];
  let lineWidth = 0;
  for (const item of items) {
    const added = line.length ? lineWidth + spaceWidth + item.width : item.width;
    if (line.length && added > maxLineWidth) {
      lines.push(line);
      line = [item];
      lineWidth = item.width;
    } else {
      line.push(item);
      lineWidth = added;
    }
  }
  if (line.length) lines.push(line);

  const lineHeight = fontPx * 1.22;
  const blockHeight = lines.length * lineHeight;
  const pad = fontPx * 0.4;
  let top = (styles.positionY / 100) * height - blockHeight / 2;
  top = Math.max(pad, Math.min(height - blockHeight - pad, top));

  const lineWidths = lines.map((ln) => ln.reduce((sum, it, i) => sum + it.width + (i ? spaceWidth : 0), 0));

  if (styles.background) {
    const bw = Math.max(...lineWidths) + pad * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, (width - bw) / 2, top - pad * 0.6, bw, blockHeight + pad * 1.2, fontPx * 0.3);
  }

  const strokePx = styles.strokeWidth * scale * 2;
  const boxTextColor = isLight(styles.highlightColor) ? '#111111' : '#ffffff';

  lines.forEach((ln, li) => {
    let x = (width - lineWidths[li]) / 2;
    const y = top + lineHeight * li + lineHeight / 2;

    for (const item of ln) {
      const cx = x + item.width / 2;
      x += item.width + spaceWidth;

      const isHi = item.index === hiIndex;
      const a = isHi ? clamp01((t - item.word.start) / ANIM_DURATION) : 1;
      let wordScale = 1;
      let yOffset = 0;
      let alpha = 1;
      let glow = 0;

      if (isHi) {
        const settle = mode === 'single-word' ? 1 : 1.08;
        if (anim === 'pop') {
          wordScale = settle * (0.78 + 0.22 * easeOutBack(a));
          if (mode === 'single-word') alpha = clamp01(a * 3);
        } else if (anim === 'bounce') {
          wordScale = settle;
          yOffset = -(1 - easeOutBounce(a)) * fontPx * 0.35;
        } else if (anim === 'glow') {
          wordScale = settle;
          glow = fontPx * (0.35 + 0.35 * (1 - a));
        }
      } else if (mode === 'karaoke' && item.word.start > t) {
        alpha = 0.88; // upcoming words slightly softer
      }

      const useBox = isHi && !!styles.highlightBox;
      const fill = useBox ? boxTextColor : isHi ? styles.highlightColor : styles.textColor;

      ctx.save();
      ctx.translate(cx, y + yOffset);
      ctx.scale(wordScale, wordScale);
      ctx.globalAlpha = alpha;

      if (useBox) {
        const bx = fontPx * 0.18;
        ctx.fillStyle = styles.highlightColor;
        roundRect(ctx, -item.width / 2 - bx, -fontPx * 0.62, item.width + bx * 2, fontPx * 1.2, fontPx * 0.18);
      }

      if (strokePx > 0 && !useBox) {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = fontPx * 0.08;
        ctx.shadowOffsetY = fontPx * 0.05;
        ctx.lineWidth = strokePx;
        ctx.strokeStyle = styles.strokeColor;
        ctx.strokeText(item.text, 0, 0);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      } else if (!useBox && !styles.background) {
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = fontPx * 0.15;
        ctx.shadowOffsetY = fontPx * 0.04;
      }

      if (glow > 0) {
        ctx.shadowColor = styles.highlightColor;
        ctx.shadowBlur = glow;
        ctx.shadowOffsetY = 0;
      }

      ctx.fillStyle = fill;
      ctx.fillText(item.text, 0, 0);
      ctx.restore();
    }
  });

  ctx.restore();
}
