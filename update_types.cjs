const fs = require('fs');
const content = `export interface Word {
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
  syncOffset?: number; // Timing offset in seconds (-1.0 to 1.0)
}

export interface Project {
  id: string;
  name: string;
  videoBlob: Blob;
  phrases: Phrase[];
  styles: StyleOptions;
  createdAt: number;
}
`;
fs.writeFileSync('src/types.ts', content);
