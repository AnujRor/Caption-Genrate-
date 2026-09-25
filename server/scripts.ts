// Writing-system helpers: detect which script a caption is in, know which script each
// language should use, and convert Hindi (Devanagari) to Hinglish offline.

export type Script =
  | "Latin" | "Devanagari" | "Bengali" | "Gurmukhi" | "Gujarati" | "Odia"
  | "Tamil" | "Telugu" | "Kannada" | "Malayalam" | "Arabic" | "Other";

const RANGES: [Script, number, number][] = [
  ["Devanagari", 0x0900, 0x097f],
  ["Bengali", 0x0980, 0x09ff],
  ["Gurmukhi", 0x0a00, 0x0a7f],
  ["Gujarati", 0x0a80, 0x0aff],
  ["Odia", 0x0b00, 0x0b7f],
  ["Tamil", 0x0b80, 0x0bff],
  ["Telugu", 0x0c00, 0x0c7f],
  ["Kannada", 0x0c80, 0x0cff],
  ["Malayalam", 0x0d00, 0x0d7f],
  ["Arabic", 0x0600, 0x06ff],
  ["Arabic", 0x0750, 0x077f],
  ["Arabic", 0xfb50, 0xfdff],
  ["Arabic", 0xfe70, 0xfeff],
];

export function charScript(ch: string): Script | null {
  const c = ch.codePointAt(0)!;
  if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0xc0 && c <= 0x24f)) return "Latin";
  for (const [s, lo, hi] of RANGES) if (c >= lo && c <= hi) return s;
  if (/\p{L}/u.test(ch)) return "Other";
  return null; // digits, punctuation, spaces
}

/** Share of letters (0..1) written in each script. */
export function scriptShares(text: string): Partial<Record<Script, number>> {
  const counts: Partial<Record<Script, number>> = {};
  let total = 0;
  for (const ch of text) {
    const s = charScript(ch);
    if (!s) continue;
    counts[s] = (counts[s] || 0) + 1;
    total++;
  }
  if (total) for (const k in counts) counts[k as Script]! /= total;
  return counts;
}

/** The script captions should be written in for a language (null = don't enforce). */
export function expectedScript(language: string): Script | null {
  const l = language.toLowerCase();
  if (l === "hinglish") return "Latin";
  if (["hindi", "marathi", "haryanvi", "bhojpuri", "nepali", "sanskrit", "maithili", "rajasthani"].includes(l)) return "Devanagari";
  if (["bengali", "bangla", "assamese"].includes(l)) return "Bengali";
  if (l === "punjabi") return "Gurmukhi";
  if (l === "gujarati") return "Gujarati";
  if (l === "odia" || l === "oriya") return "Odia";
  if (l === "tamil") return "Tamil";
  if (l === "telugu") return "Telugu";
  if (l === "kannada") return "Kannada";
  if (l === "malayalam") return "Malayalam";
  if (["urdu", "arabic", "persian", "sindhi"].includes(l)) return "Arabic";
  if (["english", "spanish", "french", "german", "portuguese", "italian", "turkish"].includes(l)) return "Latin";
  return null;
}

/** True when most letters are not in the language's expected script. */
export function needsScriptFix(text: string, language: string): boolean {
  const target = expectedScript(language);
  if (!target || !text.trim()) return false;
  return (scriptShares(text)[target] || 0) < 0.7;
}

/* ------------------ Offline Devanagari -> Hinglish converter ------------------ */

const CONSONANTS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "ळ": "l", "व": "v",
  "श": "sh", "ष": "sh", "स": "s", "ह": "h",
  "क़": "q", "ख़": "kh", "ग़": "g", "ज़": "z", "ड़": "d", "ढ़": "dh", "फ़": "f", "य़": "y",
};
const VOWELS: Record<string, string> = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ऋ": "ri", "ए": "e", "ऐ": "ai",
  "ओ": "o", "औ": "au", "ऑ": "o", "ऍ": "e",
};
const MATRAS: Record<string, string> = {
  "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e",
};
const DIGITS = "०१२३४५६७८९";
const NUKTA = "़";
const HALANT = "्";

interface Unit {
  cons: string; // "" for a standalone vowel
  vowel: string; // "" = none (halant or deleted schwa)
  inherent: boolean; // vowel is the implicit "a"
  nasal: string;
}

function transliterateWord(word: string): string {
  // Precomposed nukta letters -> base + nukta, so one lookup table handles both.
  const chars = Array.from(word.normalize("NFD"));
  const units: Unit[] = [];
  let out = "";
  const flush = () => {
    out += render(units);
    units.length = 0;
  };

  for (let i = 0; i < chars.length; i++) {
    let ch = chars[i];
    if (chars[i + 1] === NUKTA && CONSONANTS[ch + NUKTA]) {
      ch += NUKTA;
      i++;
    }
    const last = units[units.length - 1];
    if (CONSONANTS[ch] !== undefined) {
      units.push({ cons: CONSONANTS[ch], vowel: "a", inherent: true, nasal: "" });
    } else if (VOWELS[ch] !== undefined) {
      units.push({ cons: "", vowel: VOWELS[ch], inherent: false, nasal: "" });
    } else if (MATRAS[ch] !== undefined && last) {
      last.vowel = MATRAS[ch];
      last.inherent = false;
    } else if (ch === HALANT && last) {
      last.vowel = "";
      last.inherent = false;
    } else if ((ch === "ं" || ch === "ँ") && last) {
      last.nasal = "n"; // anusvara / chandrabindu
    } else if (ch === "ः" && last) {
      last.nasal += "h"; // visarga
    } else if (ch === NUKTA) {
      // stray nukta: ignore
    } else if (DIGITS.includes(ch)) {
      flush();
      out += String(DIGITS.indexOf(ch));
    } else {
      flush();
      out += ch; // Latin letters, punctuation, etc. pass through
    }
  }
  flush();
  return out;
}

function render(units: Unit[]): string {
  if (!units.length) return "";
  const n = units.length;
  // Hindi drops the final inherent "a" (बात -> baat), except in one-letter words.
  if (n > 1 && units[n - 1].inherent && !units[n - 1].nasal) units[n - 1].vowel = "";
  // Schwa deletion, right to left: V C(a) C V -> drop the "a" (करना -> karna, अपने -> apne).
  for (let i = n - 2; i >= 1; i--) {
    const u = units[i];
    if (u.inherent && u.vowel && !u.nasal && units[i - 1].vowel && units[i + 1].vowel && units[i + 1].cons) {
      u.vowel = "";
    }
  }
  let s = "";
  units.forEach((u, i) => {
    let v = u.vowel;
    const isLast = i === n - 1;
    // Hinglish spelling: final long vowels are written short (करना -> karna, नहीं -> nahin).
    if (isLast && v === "aa" && u.cons && !u.nasal) v = "a"; // but हाँ stays "haan"
    if (isLast && v === "ee") v = "i";
    s += u.cons + v + u.nasal;
  });
  return s;
}

/** Converts Devanagari text to Hinglish (Roman letters). Other text is left unchanged. */
export function devanagariToHinglish(text: string): string {
  return text
    .split(/(\s+)/)
    .map((part) => (/[ऀ-ॿ]/.test(part) ? transliterateWord(part) : part))
    .join("")
    .replace(/[।॥]/g, ".");
}
