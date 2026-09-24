import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Project, StyleOptions, DEFAULT_STYLES } from '../types';
import { ChevronLeft, Download, FileText, Loader2, Pause, Play, Captions, Clock, Palette, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { cn, formatTime } from '../lib/utils';
import { saveProject } from '../lib/db';
import { prepareUpload } from '../lib/audioExtractor';
import { buildPhrases, downloadBlob, repairWords, retimePhrase, toSrt } from '../lib/captionUtils';
import { drawCaptions, ensureFontLoaded, findActive, FONTS } from '../lib/captionRenderer';
import { CaptionsPanel, StylePanel, TimingPanel } from './EditorPanels';

interface EditorProps {
  project: Project;
  onBack: () => void;
}

type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null;

function normalizeProject(p: Project): Project {
  const styles: StyleOptions = { ...DEFAULT_STYLES, ...p.styles };
  if (!FONTS.some((f) => f.value === styles.fontFamily)) {
    const match = FONTS.find((f) => styles.fontFamily.toLowerCase().includes(f.label.split(' ')[0].toLowerCase()));
    styles.fontFamily = match ? match.value : /impact/i.test(styles.fontFamily) ? FONTS[2].value : FONTS[0].value;
  }
  return { ...p, styles, phrases: Array.isArray(p.phrases) ? p.phrases : [] };
}

/** Uploads with progress so the user sees real movement instead of a frozen spinner. */
function postTranscribe(form: FormData, onUploadProgress: (pct: number) => void): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/transcribe');
    xhr.timeout = 15 * 60 * 1000;
    xhr.upload.onprogress = (e) => e.lengthComputable && onUploadProgress(Math.round((e.loaded / e.total) * 100));
    xhr.upload.onload = () => onUploadProgress(100);
    xhr.onload = () => {
      let data: any = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = { error: xhr.status === 413 ? 'This file is too large to upload.' : 'The server is waking up or busy. Please try again.' };
      }
      resolve({ status: xhr.status, data });
    };
    xhr.onerror = () => reject(new Error('Network error — check your internet connection.'));
    xhr.ontimeout = () => reject(new Error('The request took too long. Try a shorter clip.'));
    xhr.send(form);
  });
}

function pickRecorderMime(): string {
  const candidates = [
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) || '';
}

export default function Editor({ project: initialProject, onBack }: EditorProps) {
  const [project, setProject] = useState<Project>(() => normalizeProject(initialProject));
  const projectRef = useRef(project);
  const saveTimer = useRef<number | undefined>(undefined);

  const [videoUrl, setVideoUrl] = useState('');
  const [videoSize, setVideoSize] = useState({ w: 9, h: 16 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePhrase, setActivePhrase] = useState(-1);
  const [tab, setTab] = useState<'captions' | 'timing' | 'style'>('captions');
  const [language, setLanguage] = useState('Auto-detect');
  const [wordsPerLine, setWordsPerLine] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [exportProgress, setExportProgress] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [fit, setFit] = useState({ w: 0, h: 0 });
  const audioRef = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode } | null>(null);
  const exportCancel = useRef<(() => void) | null>(null);

  /* ---------------------------- persistence ---------------------------- */

  const flushSave = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    try {
      await saveProject(projectRef.current);
    } catch (err) {
      console.error('Save failed', err);
    }
  }, []);

  const commit = useCallback((updater: (p: Project) => Project, immediate = false) => {
    const next = updater(projectRef.current);
    projectRef.current = next;
    setProject(next);
    window.clearTimeout(saveTimer.current);
    if (immediate) flushSave();
    else saveTimer.current = window.setTimeout(flushSave, 500);
  }, [flushSave]);

  useEffect(() => {
    return () => {
      if (saveTimer.current !== undefined) saveProject(projectRef.current).catch(() => {});
      exportCancel.current?.();
      audioRef.current?.ctx.close().catch(() => {});
    };
  }, []);

  const handleBack = async () => {
    exportCancel.current?.();
    await flushSave();
    onBack();
  };

  const updateStyle = useCallback(<K extends keyof StyleOptions>(key: K, value: StyleOptions[K]) => {
    commit((p) => ({ ...p, styles: { ...p.styles, [key]: value } }));
  }, [commit]);

  /* ------------------------------- video ------------------------------- */

  useEffect(() => {
    const url = URL.createObjectURL(project.videoBlob);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [project.videoBlob]);

  useEffect(() => {
    ensureFontLoaded(project.styles.fontFamily);
  }, [project.styles.fontFamily]);

  // Fit the video (at its real aspect ratio) inside the stage.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const compute = () => {
      const pad = window.innerWidth < 640 ? 16 : 40;
      const aw = stage.clientWidth - pad;
      const ah = stage.clientHeight - pad;
      const ratio = videoSize.w / videoSize.h;
      let w = aw;
      let h = w / ratio;
      if (h > ah) {
        h = ah;
        w = h * ratio;
      }
      setFit({ w: Math.max(0, Math.floor(w)), h: Math.max(0, Math.floor(h)) });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [videoSize]);

  // Live caption preview drawn with the same renderer as the export.
  useEffect(() => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !fit.w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(fit.w * dpr);
    canvas.height = Math.round(fit.h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const p = projectRef.current;
      drawCaptions(ctx, canvas.width, canvas.height, video.currentTime, p.phrases, p.styles);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fit]);

  // Track the active caption line for the list (cheap: only changes a few times per second).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      const p = projectRef.current;
      const idx = findActive(p.phrases, video.currentTime + (p.styles.syncOffset || 0)).phrase;
      setActivePhrase((prev) => (prev === idx ? prev : idx));
    };
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('seeked', onTime);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('seeked', onTime);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || exportProgress !== null) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, [exportProgress]);

  const seekTo = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v || exportProgress !== null) return;
    v.currentTime = Math.max(0, Math.min(t, v.duration || t));
    if (v.paused) v.play().catch(() => {});
  }, [exportProgress]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && tag !== 'BUTTON') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay]);

  /* ----------------------------- generation ---------------------------- */

  const generateCaptions = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setNotice(null);
    try {
      setGenerationStep('Preparing audio…');
      const duration = videoRef.current?.duration || project.duration;
      const { blob, filename } = await prepareUpload(project.videoBlob, Number.isFinite(duration) ? duration : undefined);

      let result: { status: number; data: any } | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const form = new FormData();
        form.append('video', blob, filename);
        form.append('language', language);
        setGenerationStep(attempt > 1 ? `Retrying (${attempt}/3)…` : 'Uploading 0%');
        try {
          result = await postTranscribe(form, (pct) =>
            setGenerationStep(pct < 100 ? `Uploading ${pct}%` : 'AI is listening…')
          );
        } catch (err) {
          if (attempt === 3) throw err;
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
        // Retry only temporary failures (server waking up / gateway hiccups).
        if ((result.status >= 500 && result.status !== 503) || result.status === 0) {
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1500 * attempt));
            continue;
          }
        }
        break;
      }

      if (!result || result.status >= 400 || !result.data || !Array.isArray(result.data.words)) {
        throw new Error(result?.data?.error || 'Caption generation failed. Please try again.');
      }

      setGenerationStep('Syncing captions…');
      const words = repairWords(result.data.words);
      const phrases = buildPhrases(words, wordsPerLine);
      commit(
        (p) => ({
          ...p,
          phrases,
          detectedLanguage: result!.data.detectedLanguage || language,
          engine: result!.data.engine,
          styles: { ...p.styles, syncOffset: 0 },
        }),
        true
      );

      if (!phrases.length) {
        setNotice({ kind: 'error', text: 'No speech was found in this video. Make sure it has clear spoken audio, or pick the language manually and retry.' });
      } else {
        setNotice({ kind: 'success', text: `${phrases.length} caption lines created · ${result.data.detectedLanguage || language}` });
      }
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message || 'Something went wrong. Please try again.' });
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const editPhrase = (id: string, text: string) => {
    commit((p) => ({
      ...p,
      phrases: text.trim()
        ? p.phrases.map((ph) => (ph.id === id ? retimePhrase(ph, text) : ph))
        : p.phrases.filter((ph) => ph.id !== id),
    }));
  };

  const deletePhrase = (id: string) => commit((p) => ({ ...p, phrases: p.phrases.filter((ph) => ph.id !== id) }));

  const resplit = (n: number) => {
    setWordsPerLine(n);
    commit((p) => ({ ...p, phrases: buildPhrases(p.phrases.flatMap((ph) => ph.words), n) }));
  };

  /* ------------------------------- export ------------------------------ */

  const downloadSrt = () => {
    const p = projectRef.current;
    if (!p.phrases.length) return setNotice({ kind: 'info', text: 'Generate captions first, then download the SRT file.' });
    downloadBlob(new Blob([toSrt(p.phrases, p.styles.syncOffset || 0)], { type: 'text/plain' }), `${p.name}.srt`);
  };

  const exportVideo = async () => {
    const video = videoRef.current;
    if (!video || exportProgress !== null) return;
    const p = projectRef.current;
    if (!p.phrases.length) return setNotice({ kind: 'info', text: 'Generate captions first, then export the video.' });
    if (typeof MediaRecorder === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) {
      return setNotice({ kind: 'error', text: 'Video export is not supported in this browser. Please use Chrome, Edge or a recent Safari. You can still download the SRT file.' });
    }
    const mimeType = pickRecorderMime();
    if (!mimeType) return setNotice({ kind: 'error', text: 'This browser cannot record video. Please use Chrome or Edge.' });

    setNotice(null);
    setExportProgress(0);
    let cancelled = false;
    let raf = 0;

    try {
      await ensureFontLoaded(p.styles.fontFamily);
      video.pause();

      const vw = video.videoWidth || 1080;
      const vh = video.videoHeight || 1920;
      const k = Math.min(1, 1920 / Math.max(vw, vh));
      const W = Math.round((vw * k) / 2) * 2;
      const H = Math.round((vh * k) / 2) * 2;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      const stream = (canvas as any).captureStream(30) as MediaStream;

      // Route the video's own audio into the recording (can only be wired once per element).
      if (!audioRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const actx: AudioContext = new AudioCtx();
        const source = actx.createMediaElementSource(video);
        const dest = actx.createMediaStreamDestination();
        source.connect(dest);
        source.connect(actx.destination);
        audioRef.current = { ctx: actx, dest };
      }
      if (audioRef.current.ctx.state === 'suspended') await audioRef.current.ctx.resume();
      audioRef.current.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: Math.round(Math.min(12e6, Math.max(3e6, W * H * 30 * 0.15))),
        audioBitsPerSecond: 160_000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const stopped = new Promise<void>((r) => (recorder.onstop = () => r()));

      await new Promise<void>((resolve) => {
        const done = () => resolve();
        video.addEventListener('seeked', done, { once: true });
        setTimeout(done, 1500);
        video.currentTime = 0;
      });

      const finished = new Promise<void>((resolve) => {
        exportCancel.current = () => {
          cancelled = true;
          resolve();
        };
        video.addEventListener('ended', () => resolve(), { once: true });
      });
      // Keep playing if the browser pauses the video mid-export (e.g. media key).
      const keepPlaying = () => !cancelled && !video.ended && video.play().catch(() => {});
      video.addEventListener('pause', keepPlaying);

      const duration = video.duration || 1;
      let lastPct = -1;
      const draw = () => {
        ctx.drawImage(video, 0, 0, W, H);
        const cur = projectRef.current;
        drawCaptions(ctx, W, H, video.currentTime, cur.phrases, cur.styles);
        const pct = Math.min(99, Math.floor((video.currentTime / duration) * 100));
        if (pct !== lastPct) {
          lastPct = pct;
          setExportProgress(pct);
        }
        raf = requestAnimationFrame(draw);
      };
      draw();
      recorder.start(500);
      await video.play();

      await finished;
      video.removeEventListener('pause', keepPlaying);
      cancelAnimationFrame(raf);
      video.pause();
      if (recorder.state !== 'inactive') recorder.stop();
      await stopped;
      stream.getVideoTracks().forEach((t) => t.stop());

      if (!cancelled && chunks.length) {
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        downloadBlob(new Blob(chunks, { type: mimeType.split(';')[0] }), `${p.name}_captioned.${ext}`);
        setNotice({ kind: 'success', text: `Export complete — your ${ext.toUpperCase()} is downloading.` });
      } else if (cancelled) {
        setNotice({ kind: 'info', text: 'Export cancelled.' });
      }
    } catch (err) {
      console.error(err);
      setNotice({ kind: 'error', text: 'Export failed: ' + ((err as Error).message || 'unknown error') });
    } finally {
      cancelAnimationFrame(raf);
      exportCancel.current = null;
      setExportProgress(null);
      video.currentTime = 0;
    }
  };

  /* -------------------------------- UI -------------------------------- */

  const isExporting = exportProgress !== null;

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-ink-950 text-zinc-200 overflow-hidden">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-white/5 bg-ink-900/80 backdrop-blur flex items-center justify-between px-2 sm:px-4 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button onClick={handleBack} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors" title="Back to projects">
            <ChevronLeft size={20} />
          </button>
          <input
            value={project.name}
            onChange={(e) => commit((p) => ({ ...p, name: e.target.value }))}
            onBlur={(e) => !e.target.value.trim() && commit((p) => ({ ...p, name: 'Untitled video' }))}
            className="bg-transparent font-semibold text-sm sm:text-base truncate min-w-0 w-full max-w-[40vw] sm:max-w-xs rounded-md px-1.5 py-1 outline-none hover:bg-white/5 focus:bg-white/5"
            title="Rename project"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={downloadSrt} disabled={isExporting} className="btn-ghost px-3 py-2 text-xs" title="Download subtitles (.srt)">
            <FileText size={15} /> <span className="hidden sm:inline">SRT</span>
          </button>
          <button onClick={exportVideo} disabled={isExporting || isGenerating} className="btn-primary px-3.5 py-2 text-xs sm:text-sm">
            {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {isExporting ? `${exportProgress}%` : 'Export video'}
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Stage */}
        <div className="flex flex-col min-h-0 h-[52dvh] lg:h-auto lg:flex-1 shrink-0">
          <div ref={stageRef} className="flex-1 min-h-0 relative flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_#1a1a2a_0%,_#07070c_70%)]">
            <div className="relative rounded-xl overflow-hidden bg-black shadow-2xl shadow-black/60 ring-1 ring-white/10" style={{ width: fit.w, height: fit.h }}>
              <video
                ref={videoRef}
                src={videoUrl || undefined}
                className="absolute inset-0 w-full h-full object-contain"
                playsInline
                preload="auto"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (v.videoWidth && v.videoHeight) setVideoSize({ w: v.videoWidth, h: v.videoHeight });
                  if (!project.duration && Number.isFinite(v.duration)) commit((p) => ({ ...p, duration: v.duration }));
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onClick={togglePlay}
              />
              <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />

              {!isPlaying && !isExporting && (
                <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center bg-black/25 transition-opacity" aria-label="Play">
                  <span className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-xl hover:scale-110 transition-transform">
                    <Play size={22} fill="currentColor" className="ml-1" />
                  </span>
                </button>
              )}

              {isExporting && (
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
                  <div className="flex items-center justify-between text-[11px] text-white/90 mb-1.5">
                    <span>Rendering {exportProgress}% · keep this tab open</span>
                    <button onClick={() => exportCancel.current?.()} className="flex items-center gap-1 text-white/70 hover:text-white">
                      <X size={12} /> Cancel
                    </button>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-300" style={{ width: `${exportProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
          <Timeline videoRef={videoRef} isPlaying={isPlaying} togglePlay={togglePlay} project={project} disabled={isExporting} />
        </div>

        {/* Side panel */}
        <aside className="flex-1 lg:flex-none lg:w-[380px] min-h-0 flex flex-col border-t lg:border-t-0 lg:border-l border-white/5 bg-ink-900">
          <div className="p-3 border-b border-white/5">
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-ink-950 border border-white/5">
              {([
                { id: 'captions', label: 'Captions', icon: Captions },
                { id: 'timing', label: 'Timing', icon: Clock },
                { id: 'style', label: 'Style', icon: Palette },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    'py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                    tab === id ? 'bg-ink-700 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {notice && (
              <div
                className={cn(
                  'mb-4 flex gap-2.5 items-start rounded-xl border p-3 text-xs leading-relaxed animate-fadeUp',
                  notice.kind === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
                  notice.kind === 'error' && 'border-rose-500/30 bg-rose-500/10 text-rose-200',
                  notice.kind === 'info' && 'border-violet-500/30 bg-violet-500/10 text-violet-200'
                )}
              >
                {notice.kind === 'success' ? <CheckCircle2 size={15} className="shrink-0 mt-px" /> : <AlertTriangle size={15} className="shrink-0 mt-px" />}
                <p className="flex-1">{notice.text}</p>
                <button onClick={() => setNotice(null)} className="opacity-60 hover:opacity-100">
                  <X size={13} />
                </button>
              </div>
            )}

            {tab === 'captions' && (
              <CaptionsPanel
                project={project}
                language={language}
                setLanguage={setLanguage}
                isGenerating={isGenerating}
                generationStep={generationStep}
                onGenerate={generateCaptions}
                activePhrase={activePhrase}
                isPlaying={isPlaying}
                onSeek={seekTo}
                onEditPhrase={editPhrase}
                onDeletePhrase={deletePhrase}
              />
            )}
            {tab === 'timing' && (
              <TimingPanel styles={project.styles} hasCaptions={project.phrases.length > 0} wordsPerLine={wordsPerLine} onStyle={updateStyle} onResplit={resplit} />
            )}
            {tab === 'style' && (
              <StylePanel styles={project.styles} onStyle={updateStyle} onPreset={(s) => commit((p) => ({ ...p, styles: { ...p.styles, ...s } }))} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Timeline({
  videoRef,
  isPlaying,
  togglePlay,
  project,
  disabled,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  togglePlay: () => void;
  project: Project;
  disabled: boolean;
}) {
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    const onTime = () => setTime(v.currentTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('durationchange', onMeta);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('seeked', onTime);
    onMeta();
    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('durationchange', onMeta);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('seeked', onTime);
    };
  }, [videoRef]);

  // Smooth playhead while playing (timeupdate alone only fires ~4x/sec).
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => {
      if (videoRef.current) setTime(videoRef.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, videoRef]);

  const offset = project.styles.syncOffset || 0;
  const pct = duration ? (time / duration) * 100 : 0;

  return (
    <div className="h-14 shrink-0 border-t border-white/5 bg-ink-900 flex items-center gap-3 px-3 sm:px-5">
      <button
        onClick={togglePlay}
        disabled={disabled}
        className="w-9 h-9 shrink-0 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-40"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
      </button>
      <span className="text-[11px] font-mono text-zinc-400 w-[52px] shrink-0">{formatTime(time)}</span>

      <div className="relative flex-1 h-8 flex items-center">
        {/* caption markers */}
        <div className="absolute inset-x-0 bottom-0 h-1 pointer-events-none">
          {duration > 0 &&
            project.phrases.map((ph) => (
              <span
                key={ph.id}
                className="absolute top-0 h-full rounded-sm bg-violet-400/50"
                style={{
                  left: `${Math.max(0, ((ph.start - offset) / duration) * 100)}%`,
                  width: `${Math.max(0.3, ((ph.end - ph.start) / duration) * 100)}%`,
                }}
              />
            ))}
        </div>
        <input
          type="range"
          className="slider relative"
          min={0}
          max={duration || 1}
          step={0.01}
          value={Math.min(time, duration || 1)}
          disabled={disabled}
          onChange={(e) => {
            const t = parseFloat(e.target.value);
            if (videoRef.current) videoRef.current.currentTime = t;
            setTime(t);
          }}
          style={{ '--fill': `${pct}%` } as React.CSSProperties}
        />
      </div>
      <span className="text-[11px] font-mono text-zinc-500 w-[52px] shrink-0 text-right">{formatTime(duration)}</span>
    </div>
  );
}
