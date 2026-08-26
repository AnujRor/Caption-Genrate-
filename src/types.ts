export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface Phrase {
  id: string;
  start: number;
  end: number;
  words: Word[];
}

export interface StyleOptions {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number;
  positionY: number; // Percentage from top (0-100)
  syncOffset?: number; // Timing offset in seconds (-1.5 to 1.5)
  displayMode?: 'single-word' | 'karaoke' | 'progressive'; // Display type
  animationStyle?: 'pop' | 'glow' | 'bounce' | 'classic';
}

export interface Project {
  id: string;
  name: string;
  videoBlob: Blob;
  phrases: Phrase[];
  styles: StyleOptions;
  detectedLanguage?: string;
  createdAt: number;
}
