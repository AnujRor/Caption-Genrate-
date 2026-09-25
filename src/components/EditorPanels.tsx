import React, { useEffect, useRef, useState } from 'react';
import { Check, Pencil, Play, RefreshCw, Sparkles, Trash2, Wand2, X, Loader2, Globe, Languages } from 'lucide-react';
import { Phrase, Project, StyleOptions } from '../types';
import { FONTS, PRESETS } from '../lib/captionRenderer';
import { cn, formatTime } from '../lib/utils';

export const LANGUAGES: { value: string; label: string }[] = [
  { value: 'Auto-detect', label: 'Auto-detect language' },
  { value: 'Hindi', label: 'Hindi (हिन्दी)' },
  { value: 'Hinglish', label: 'Hinglish (Hindi in English letters)' },
  { value: 'English', label: 'English' },
  { value: 'Punjabi', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { value: 'Haryanvi', label: 'Haryanvi / Rajasthani' },
  { value: 'Bhojpuri', label: 'Bhojpuri' },
  { value: 'Marathi', label: 'Marathi (मराठी)' },
  { value: 'Gujarati', label: 'Gujarati (ગુજરાતી)' },
  { value: 'Bengali', label: 'Bengali (বাংলা)' },
  { value: 'Urdu', label: 'Urdu (اردو)' },
  { value: 'Tamil', label: 'Tamil (தமிழ்)' },
  { value: 'Telugu', label: 'Telugu (తెలుగు)' },
  { value: 'Kannada', label: 'Kannada (ಕನ್ನಡ)' },
  { value: 'Malayalam', label: 'Malayalam (മലയാളം)' },
  { value: 'Odia', label: 'Odia (ଓଡ଼ିଆ)' },
  { value: 'Assamese', label: 'Assamese (অসমীয়া)' },
  { value: 'Arabic', label: 'Arabic (العربية)' },
  { value: 'Spanish', label: 'Spanish' },
  { value: 'French', label: 'French' },
  { value: 'German', label: 'German' },
  { value: 'Portuguese', label: 'Portuguese' },
  { value: 'Italian', label: 'Italian' },
  { value: 'Russian', label: 'Russian' },
  { value: 'Turkish', label: 'Turkish' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Korean', label: 'Korean' },
  { value: 'Chinese', label: 'Chinese' },
];

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="slider"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ '--fill': `${fill}%` } as React.CSSProperties}
    />
  );
}

function Label({ children, value }: { children: React.ReactNode; value?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-medium text-zinc-400">{children}</span>
      {value !== undefined && <span className="text-[11px] font-mono text-zinc-500">{value}</span>}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-1 p-1 rounded-xl bg-ink-900 border border-white/5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'py-2 px-1 rounded-lg text-[11px] font-semibold transition-all',
            value === o.value ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          )}
          title={o.hint}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center justify-between w-full py-1.5 group">
      <span className="text-xs text-zinc-300">{label}</span>
      <span className={cn('w-9 h-5 rounded-full relative transition-colors', checked ? 'bg-violet-600' : 'bg-ink-600')}>
        <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 cursor-pointer">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span className="flex items-center gap-2 p-1.5 rounded-lg bg-ink-900 border border-white/10 hover:border-white/20 transition-colors">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-6 h-6 shrink-0" />
        <span className="text-[11px] font-mono text-zinc-400 uppercase">{value}</span>
      </span>
    </label>
  );
}

/* ------------------------------ Captions tab ------------------------------ */

export function CaptionsPanel({
  project,
  language,
  setLanguage,
  isGenerating,
  generationStep,
  onGenerate,
  activePhrase,
  isPlaying,
  onSeek,
  onEditPhrase,
  onDeletePhrase,
  onConvertScript,
  convertingScript,
}: {
  project: Project;
  language: string;
  setLanguage: (v: string) => void;
  isGenerating: boolean;
  generationStep: string;
  onGenerate: () => void;
  onConvertScript: (target: 'Hinglish' | 'Hindi') => void;
  convertingScript: boolean;
  activePhrase: number;
  isPlaying: boolean;
  onSeek: (t: number) => void;
  onEditPhrase: (id: string, text: string) => void;
  onDeletePhrase: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const offset = project.styles.syncOffset || 0;

  useEffect(() => {
    if (!isPlaying || activePhrase < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activePhrase}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activePhrase, isPlaying]);

  const save = (p: Phrase) => {
    onEditPhrase(p.id, draft);
    setEditingId(null);
  };

  const hasCaptions = project.phrases.length > 0;
  const hasDevanagari = hasCaptions && project.phrases.some((p) => p.words.some((w) => /[ऀ-ॿ]/.test(w.word)));
  const scriptTarget: 'Hinglish' | 'Hindi' | null = hasDevanagari ? 'Hinglish' : hasCaptions && project.detectedLanguage === 'Hinglish' ? 'Hindi' : null;

  return (
    <div className="space-y-4">
      <div className="panel p-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Globe size={13} className="text-violet-400" /> Spoken language
          </span>
          {project.detectedLanguage && (
            <span className="text-[10px] bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/25 truncate max-w-[55%]">
              {project.detectedLanguage}
            </span>
          )}
        </div>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="field cursor-pointer" disabled={isGenerating}>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <p className="text-[10.5px] text-zinc-500 mt-2 leading-relaxed">Auto-detect recognises every listed language. Pick Hinglish to get Hindi written in English letters.</p>

        <button onClick={onGenerate} disabled={isGenerating} className={cn('mt-3 w-full py-3 text-sm', hasCaptions ? 'btn-ghost' : 'btn-primary')}>
          {isGenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span className="truncate">{generationStep || 'Working…'}</span>
            </>
          ) : hasCaptions ? (
            <>
              <RefreshCw size={15} /> Regenerate captions
            </>
          ) : (
            <>
              <Sparkles size={16} /> Generate captions
            </>
          )}
        </button>

        {scriptTarget && !isGenerating && (
          <button onClick={() => onConvertScript(scriptTarget)} disabled={convertingScript} className="btn-ghost mt-2 w-full py-2.5 text-xs">
            {convertingScript ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
            {convertingScript
              ? 'Converting…'
              : scriptTarget === 'Hinglish'
                ? 'Convert to Hinglish (English letters)'
                : 'हिन्दी लिपि में बदलें (Hindi script)'}
          </button>
        )}
      </div>

      {hasCaptions ? (
        <div>
          <div className="flex items-center justify-between mb-2 px-0.5">
            <span className="text-xs font-semibold text-zinc-400">{project.phrases.length} caption lines</span>
            <span className="text-[10.5px] text-zinc-500">Click to jump · pencil to edit</span>
          </div>
          <div ref={listRef} className="space-y-1.5">
            {project.phrases.map((phrase, idx) => {
              const isEditing = editingId === phrase.id;
              const isActive = idx === activePhrase;
              const text = phrase.words.map((w) => w.word).join(' ');
              return (
                <div
                  key={phrase.id}
                  data-idx={idx}
                  className={cn(
                    'group rounded-xl border px-3 py-2.5 transition-all',
                    isActive ? 'border-violet-500/60 bg-violet-500/10' : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => onSeek(phrase.start - offset)}
                      className="text-[10.5px] font-mono text-violet-300/90 hover:text-violet-200 flex items-center gap-1"
                    >
                      <Play size={9} fill="currentColor" /> {formatTime(Math.max(0, phrase.start - offset))}
                    </button>
                    {!isEditing && (
                      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingId(phrase.id);
                            setDraft(text);
                          }}
                          className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
                          title="Edit text"
                        >
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => onDeletePhrase(phrase.id)} className="p-1 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10" title="Delete line">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={2}
                        autoFocus
                        className="field resize-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            save(phrase);
                          }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setEditingId(null)} className="btn-ghost px-2.5 py-1 text-[11px]">
                          <X size={12} /> Cancel
                        </button>
                        <button onClick={() => save(phrase)} className="btn-primary px-2.5 py-1 text-[11px] rounded-lg">
                          <Check size={12} /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p onClick={() => onSeek(phrase.start - offset)} className="mt-1 text-[13px] leading-snug text-zinc-200 cursor-pointer">
                      {text}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        !isGenerating && (
          <div className="text-center px-4 py-8 text-xs text-zinc-500 leading-relaxed">
            <Wand2 size={22} className="mx-auto mb-2 text-zinc-600" />
            Press <span className="text-zinc-300 font-medium">Generate captions</span>. The AI listens to your video and creates word-by-word synced subtitles.
          </div>
        )
      )}
    </div>
  );
}

/* ------------------------------- Timing tab ------------------------------- */

export function TimingPanel({
  styles,
  hasCaptions,
  wordsPerLine,
  onStyle,
  onResplit,
}: {
  styles: StyleOptions;
  hasCaptions: boolean;
  wordsPerLine: number;
  onStyle: <K extends keyof StyleOptions>(key: K, value: StyleOptions[K]) => void;
  onResplit: (n: number) => void;
}) {
  const offset = styles.syncOffset || 0;
  const nudge = (d: number) => onStyle('syncOffset', Math.max(-1.5, Math.min(1.5, +(offset + d).toFixed(2))));

  return (
    <div className="space-y-5">
      <div className="panel p-4">
        <Label value={offset === 0 ? '0.00s' : `${offset > 0 ? '+' : ''}${offset.toFixed(2)}s`}>Caption timing offset</Label>
        <Slider value={offset} min={-1.5} max={1.5} step={0.01} onChange={(v) => onStyle('syncOffset', v)} />
        <div className="grid grid-cols-5 gap-1 mt-3">
          {[-0.2, -0.05, 0, 0.05, 0.2].map((d) => (
            <button key={d} onClick={() => (d === 0 ? onStyle('syncOffset', 0) : nudge(d))} className="btn-ghost py-1.5 text-[10.5px] font-mono">
              {d === 0 ? 'Reset' : `${d > 0 ? '+' : ''}${d}`}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
          Captions late? Move <span className="text-zinc-300">right (+)</span>. Captions early? Move <span className="text-zinc-300">left (−)</span>.
        </p>
      </div>

      <div className="panel p-4">
        <Label value={wordsPerLine}>Max words per line</Label>
        <Slider value={wordsPerLine} min={1} max={8} onChange={(v) => onResplit(v)} />
        <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
          Re-splits all captions into new lines. Lines also break automatically at natural pauses.
        </p>
        {!hasCaptions && <p className="text-[11px] text-amber-300/80 mt-2">Generate captions first.</p>}
      </div>
    </div>
  );
}

/* -------------------------------- Style tab ------------------------------- */

export function StylePanel({
  styles,
  onStyle,
  onPreset,
}: {
  styles: StyleOptions;
  onStyle: <K extends keyof StyleOptions>(key: K, value: StyleOptions[K]) => void;
  onPreset: (s: Partial<StyleOptions>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Presets</Label>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => {
            const s = p.styles;
            return (
              <button
                key={p.name}
                onClick={() => onPreset(s)}
                className="relative h-16 rounded-xl overflow-hidden border border-white/10 hover:border-violet-500/60 transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-br from-zinc-700 to-zinc-900"
              >
                <span
                  className="absolute inset-0 flex items-center justify-center gap-1 px-2"
                  style={{ fontFamily: s.fontFamily, fontWeight: 900, fontSize: 15, textTransform: s.uppercase ? 'uppercase' : 'none' }}
                >
                  <span style={{ color: s.textColor, WebkitTextStroke: s.strokeWidth ? `${Math.min(1.5, s.strokeWidth / 2)}px ${s.strokeColor}` : undefined }}>
                    Hey
                  </span>
                  <span
                    style={{
                      color: s.highlightBox ? '#111' : s.highlightColor,
                      background: s.highlightBox ? s.highlightColor : undefined,
                      padding: s.highlightBox ? '0 4px' : undefined,
                      borderRadius: 4,
                      textShadow: s.animationStyle === 'glow' ? `0 0 10px ${s.highlightColor}` : undefined,
                      WebkitTextStroke: s.strokeWidth && !s.highlightBox ? `${Math.min(1.5, s.strokeWidth / 2)}px ${s.strokeColor}` : undefined,
                    }}
                  >
                    there
                  </span>
                </span>
                <span className="absolute bottom-1 left-2 text-[9px] font-sans font-medium text-white/60 normal-case">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Display mode</Label>
        <Segmented
          value={styles.displayMode || 'karaoke'}
          onChange={(v) => onStyle('displayMode', v)}
          options={[
            { value: 'karaoke', label: 'Full line', hint: 'Whole line visible, spoken word highlighted' },
            { value: 'progressive', label: 'Build up', hint: 'Words appear as they are spoken' },
            { value: 'single-word', label: '1 word', hint: 'Only the current word' },
          ]}
        />
      </div>

      <div>
        <Label>Animation</Label>
        <Segmented
          value={styles.animationStyle || 'pop'}
          onChange={(v) => onStyle('animationStyle', v)}
          options={[
            { value: 'pop', label: 'Pop' },
            { value: 'bounce', label: 'Bounce' },
            { value: 'glow', label: 'Glow' },
            { value: 'classic', label: 'None' },
          ]}
        />
      </div>

      <div>
        <Label>Font</Label>
        <select value={styles.fontFamily} onChange={(e) => onStyle('fontFamily', e.target.value)} className="field cursor-pointer">
          {FONTS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label value={`${styles.fontSize}`}>Size</Label>
        <Slider value={styles.fontSize} min={14} max={72} onChange={(v) => onStyle('fontSize', v)} />
      </div>

      <div>
        <Label value={`${styles.positionY}%`}>Vertical position</Label>
        <Slider value={styles.positionY} min={8} max={92} onChange={(v) => onStyle('positionY', v)} />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <ColorField label="Text" value={styles.textColor} onChange={(v) => onStyle('textColor', v)} />
        <ColorField label="Highlight" value={styles.highlightColor} onChange={(v) => onStyle('highlightColor', v)} />
        <ColorField label="Outline" value={styles.strokeColor} onChange={(v) => onStyle('strokeColor', v)} />
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-zinc-500">Outline width · {styles.strokeWidth}</span>
          <div className="h-[38px] flex items-center">
            <Slider value={styles.strokeWidth} min={0} max={8} step={0.5} onChange={(v) => onStyle('strokeWidth', v)} />
          </div>
        </div>
      </div>

      <div className="panel px-3.5 py-2">
        <Toggle label="UPPERCASE text" checked={styles.uppercase !== false} onChange={(v) => onStyle('uppercase', v)} />
        <Toggle label="Box behind spoken word" checked={!!styles.highlightBox} onChange={(v) => onStyle('highlightBox', v)} />
        <Toggle label="Dark background" checked={!!styles.background} onChange={(v) => onStyle('background', v)} />
      </div>
    </div>
  );
}
