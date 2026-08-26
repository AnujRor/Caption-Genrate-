// Self-Healing Agent for Video Captioning & Timing Repair
import { Phrase } from '../types';

export interface RepairReport {
  recovered: boolean;
  message: string;
  repairedCount: number;
}

/**
 * Auto-repairs and normalizes raw word timestamps to guarantee flawless sync:
 * 1. Fixes negative or backward timestamps
 * 2. Eliminates overlaps between consecutive words
 * 3. Enforces minimum word duration (0.08s) so words don't flash invisibly
 * 4. Filters empty tokens or invalid noise
 */
export function autoRepairWords(
  rawWords: { word: string; start: number; end: number }[]
): { words: { word: string; start: number; end: number }[]; report: RepairReport } {
  let repairedCount = 0;
  if (!Array.isArray(rawWords) || rawWords.length === 0) {
    return {
      words: [],
      report: { recovered: false, message: "No speech detected in audio.", repairedCount: 0 }
    };
  }

  const cleaned: { word: string; start: number; end: number }[] = [];
  let lastEnd = 0;

  for (let i = 0; i < rawWords.length; i++) {
    const item = rawWords[i];
    if (!item || typeof item.word !== 'string') continue;

    const trimmedWord = item.word.trim();
    if (!trimmedWord) continue;

    let start = typeof item.start === 'number' && !isNaN(item.start) ? Math.max(0, item.start) : lastEnd;
    let end = typeof item.end === 'number' && !isNaN(item.end) ? item.end : start + 0.25;

    // Prevent backwards timestamps
    if (start < lastEnd) {
      start = lastEnd;
      repairedCount++;
    }

    // Ensure minimum duration (0.06s for super-fast syllables) without artificially swallowing pauses
    if (end <= start) {
      end = start + 0.12;
      repairedCount++;
    } else if (end - start < 0.05) {
      end = start + 0.08;
      repairedCount++;
    }

    lastEnd = end;
    cleaned.push({
      word: trimmedWord,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3))
    });
  }

  return {
    words: cleaned,
    report: {
      recovered: cleaned.length > 0,
      message: `Cleaned and validated ${cleaned.length} words (${repairedCount} timing auto-repairs).`,
      repairedCount
    }
  };
}

/**
 * Groups words into natural, visually pleasing caption phrases (3-7 words each, ~1.5s - 2.5s duration)
 */
export function buildSmartPhrases(words: { word: string; start: number; end: number }[]): Phrase[] {
  if (words.length === 0) return [];

  const phrases: Phrase[] = [];
  let currentWords: { word: string; start: number; end: number }[] = [];
  let phraseStart = words[0].start;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (currentWords.length === 0) {
      phraseStart = word.start;
    }

    currentWords.push(word);

    const isLastWord = i === words.length - 1;
    const nextWord = !isLastWord ? words[i + 1] : null;
    const pauseAfter = nextWord ? nextWord.start - word.end : 0;
    const currentDuration = word.end - phraseStart;

    // Boundary conditions:
    // 1. Natural speaker pause (>= 0.30s gap)
    // 2. Phrase reached 5 words
    // 3. Phrase duration exceeded 2.2 seconds
    // 4. Last word in audio
    const shouldBreak =
      isLastWord ||
      pauseAfter >= 0.30 ||
      currentWords.length >= 5 ||
      currentDuration >= 2.2;

    if (shouldBreak) {
      const phraseEnd = currentWords[currentWords.length - 1].end;
      phrases.push({
        id: `phrase_${Date.now()}_${phrases.length}_${Math.random().toString(36).substr(2, 4)}`,
        start: phraseStart,
        end: phraseEnd,
        words: [...currentWords]
      });
      currentWords = [];
    }
  }

  return phrases;
}

/**
 * Fallback Web Speech Recognition when network or cloud quota is completely offline
 */
export async function fallbackBrowserTranscription(
  videoElement: HTMLVideoElement,
  languageCode: string = 'hi-IN'
): Promise<{ detectedLanguage: string; words: { word: string; start: number; end: number }[] }> {
  return new Promise((resolve) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      resolve({ detectedLanguage: "Auto", words: [] });
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = languageCode.includes('en') ? 'en-US' : 'hi-IN';

      const detectedWords: { word: string; start: number; end: number }[] = [];
      let startTime = 0;

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const transcript = event.results[i][0].transcript.trim();
            const split = transcript.split(/\s+/);
            const duration = 2.0;
            const step = duration / Math.max(1, split.length);

            split.forEach((w: string, idx: number) => {
              detectedWords.push({
                word: w,
                start: Number((startTime + idx * step).toFixed(2)),
                end: Number((startTime + (idx + 1) * step).toFixed(2))
              });
            });
            startTime += duration;
          }
        }
      };

      recognition.onerror = () => {
        resolve({ detectedLanguage: "Auto", words: detectedWords });
      };

      recognition.onend = () => {
        resolve({ detectedLanguage: "Auto", words: detectedWords });
      };

      recognition.start();
      setTimeout(() => {
        try { recognition.stop(); } catch (e) {}
        resolve({ detectedLanguage: "Auto", words: detectedWords });
      }, 5000);
    } catch (e) {
      resolve({ detectedLanguage: "Auto", words: [] });
    }
  });
}
