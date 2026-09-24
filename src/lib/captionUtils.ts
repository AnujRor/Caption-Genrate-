import { Phrase, Word } from '../types';

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

/**
 * Cleans raw word timestamps so playback never glitches:
 * sorts, removes empty tokens, fixes backwards/overlapping times and
 * enforces a minimum on-screen duration per word.
 */
export function repairWords(raw: Word[]): Word[] {
  const sorted = (Array.isArray(raw) ? raw : [])
    .filter((w) => w && typeof w.word === 'string' && w.word.trim() && Number.isFinite(w.start))
    .map((w) => ({
      word: w.word.trim(),
      start: Math.max(0, Number(w.start)),
      end: Number.isFinite(w.end) ? Number(w.end) : Number(w.start) + 0.25,
    }))
    .sort((a, b) => a.start - b.start);

  const out: Word[] = [];
  let lastEnd = 0;
  for (const w of sorted) {
    let start = Math.max(w.start, lastEnd);
    let end = w.end;
    if (end - start < 0.08) end = start + 0.12;
    // Speech models often stretch the word before a pause across the silence;
    // cap it at a realistic spoken length so captions don't linger during pauses.
    const maxSpoken = Math.max(0.5, 0.08 * w.word.length + 0.3);
    if (end - start > maxSpoken) end = start + maxSpoken;
    lastEnd = end;
    out.push({ word: w.word, start: +start.toFixed(3), end: +end.toFixed(3) });
  }
  return out;
}

/**
 * Groups words into short, readable caption lines that break on natural pauses.
 */
export function buildPhrases(words: Word[], maxWords = 5): Phrase[] {
  const phrases: Phrase[] = [];
  let current: Word[] = [];

  const flush = () => {
    if (!current.length) return;
    phrases.push({
      id: newId(),
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current,
    });
    current = [];
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    current.push(word);
    const next = words[i + 1];
    const pause = next ? next.start - word.end : 0;
    const duration = word.end - current[0].start;
    const chars = current.reduce((n, w) => n + w.word.length + 1, 0);
    const endsSentence = /[.!?।|]$/.test(word.word);

    if (!next || pause >= 0.35 || endsSentence || current.length >= maxWords || duration >= 2.4 || chars >= 28) {
      flush();
    }
  }
  flush();
  return phrases;
}

/** Re-times a phrase after its text was edited by spreading words across its span. */
export function retimePhrase(phrase: Phrase, text: string): Phrase {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const span = Math.max(0.2, phrase.end - phrase.start);
  const step = span / Math.max(1, tokens.length);
  return {
    ...phrase,
    words: tokens.map((word, i) => ({
      word,
      start: +(phrase.start + i * step).toFixed(3),
      end: +(phrase.start + (i + 1) * step).toFixed(3),
    })),
  };
}

function srtTime(sec: number) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

export function toSrt(phrases: Phrase[], offset = 0): string {
  return phrases
    .map((p, i) => {
      const text = p.words.map((w) => w.word).join(' ');
      return `${i + 1}\n${srtTime(p.start - offset)} --> ${srtTime(p.end - offset)}\n${text}\n`;
    })
    .join('\n');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
