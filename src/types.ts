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

export type DisplayMode = 'single-word' | 'karaoke' | 'progressive';
export type AnimationStyle = 'pop' | 'glow' | 'bounce' | 'classic';

export interface StyleOptions {
  fontFamily: string;
  fontSize: number; // px at a 400px-wide reference frame; scales with video resolution
  textColor: string;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number;
  positionY: number; // Percentage from top (0-100)
  syncOffset?: number; // Timing offset in seconds (-1.5 to 1.5)
  displayMode?: DisplayMode;
  animationStyle?: AnimationStyle;
  uppercase?: boolean;
  highlightBox?: boolean; // Draw a filled pill behind the active word
  background?: boolean; // Dark translucent box behind the caption block
}

export interface Project {
  id: string;
  name: string;
  videoBlob?: Blob; // missing for a cloud project not yet downloaded to this device
  videoPath?: string; // Supabase Storage path once the video is uploaded
  ownerId?: string; // Supabase user who owns it; unset for projects made while signed out
  phrases: Phrase[];
  styles: StyleOptions;
  detectedLanguage?: string;
  engine?: string;
  thumbnail?: string;
  duration?: number;
  createdAt: number;
  updatedAt?: number;
}

export const DEFAULT_STYLES: StyleOptions = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: 34,
  textColor: '#ffffff',
  highlightColor: '#facc15',
  strokeColor: '#000000',
  strokeWidth: 3,
  positionY: 72,
  syncOffset: 0,
  displayMode: 'karaoke',
  animationStyle: 'pop',
  uppercase: true,
  highlightBox: false,
  background: false,
};
