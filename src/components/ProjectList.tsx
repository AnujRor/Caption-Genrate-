import React, { useState, useEffect, useRef } from 'react';
import { Project, DEFAULT_STYLES } from '../types';
import type { User } from '@supabase/supabase-js';
import { getProjects, saveProject, deleteProject, ensureVideo } from '../lib/db';
import { supabase } from '../lib/supabase';
import { Plus, Film, Trash2, UploadCloud, Sparkles, Languages, Download, Loader2, AlertTriangle, Captions, CloudDownload } from 'lucide-react';
import { cn, formatDuration, readVideoInfo } from '../lib/utils';
import AuthButton from './AuthButton';
import LandingContent, { SiteFooter } from './LandingContent';

interface ProjectListProps {
  onSelectProject: (project: Project) => void;
}

const MAX_FILE_MB = 1024;

export default function ProjectList({ onSelectProject }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [serverWarning, setServerWarning] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase) return;
    // Fires once on load with the stored session, then on every sign-in / sign-out.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') loadProjects();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadProjects();
    fetch('/api/health')
      .then((r) => r.json())
      .then((h) => {
        if (h?.engines && !h.engines.groq && !h.engines.gemini) {
          setServerWarning('No AI key is configured on the server yet, so caption generation will not work. Add GROQ_API_KEY or GEMINI_API_KEY in your hosting environment variables.');
        }
      })
      .catch(() => {});
  }, []);

  const loadProjects = async () => {
    try {
      setProjects(await getProjects());
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Could not open local storage. Private/incognito mode may block saving projects.');
    } finally {
      setIsLoading(false);
    }
  };

  const importFile = async (file: File | undefined) => {
    if (!file || isImporting) return;
    setError(null);
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm|mkv|m4v)$/i.test(file.name)) {
      setError('Please choose a video file (MP4, MOV, WEBM).');
      return;
    }
    // A few KB is only a file header, e.g. a screen recording that was stopped instantly.
    if (file.size < 20 * 1024) {
      setError('This video file is empty or damaged (it is only a few KB). Record or download it again.');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`This video is larger than ${MAX_FILE_MB}MB. Please trim or compress it first.`);
      return;
    }

    setIsImporting(true);
    try {
      const info = await readVideoInfo(file);
      const project: Project = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        name: file.name.replace(/\.[^/.]+$/, '') || 'Untitled video',
        videoBlob: file,
        phrases: [],
        styles: { ...DEFAULT_STYLES },
        thumbnail: info.thumbnail,
        duration: info.duration,
        createdAt: Date.now(),
      };
      try {
        await saveProject(project);
        // Ask the browser not to auto-delete stored videos when disk space runs low.
        navigator.storage?.persist?.().catch(() => {});
      } catch (err) {
        // Phones with little free space (or in-app browsers) can refuse to store the video.
        // Captioning and export work from memory, so open the editor anyway; it warns that saving failed.
        console.error('Failed to save project locally; continuing without saving:', err);
      }
      onSelectProject(project);
    } catch (err) {
      console.error('Failed to open video:', err);
      setError('Could not read this video. Try a different file or browser.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openProject = async (project: Project) => {
    if (openingId) return;
    if (project.videoBlob) return onSelectProject(project);
    setError(null);
    setOpeningId(project.id);
    try {
      onSelectProject(await ensureVideo(project));
    } catch (err: any) {
      console.error('Failed to download video:', err);
      setError(err?.message || 'Could not download this video from the cloud. Check your connection and try again.');
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, project: Project) => {
    const id = project.id;
    e.stopPropagation();
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete((c) => (c === id ? null : c)), 3000);
      return;
    }
    setConfirmDelete(null);
    setProjects((list) => list.filter((p) => p.id !== id));
    try {
      await deleteProject(project);
    } catch {
      loadProjects();
    }
  };

  const openPicker = () => fileInputRef.current?.click();

  return (
    <div
      className="min-h-full bg-aurora"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        importFile(e.dataTransfer.files?.[0]);
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-violet-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <input
        type="file"
        accept="video/*"
        className="hidden"
        ref={fileInputRef}
        aria-label="Upload a video file to generate captions"
        onChange={(e) => importFile(e.target.files?.[0])}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <header className="flex items-center justify-between gap-3 py-5">
          <a href="/" className="flex items-center gap-2.5" aria-label="AutoCaption Studio home">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
              <Captions size={18} className="text-white" aria-hidden="true" />
            </div>
            <span className="font-display font-extrabold text-lg tracking-tight">AutoCaption<span className="text-violet-400"> Studio</span></span>
          </a>
          <div className="flex items-center gap-2">
            <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
              {[
                ['#features', 'Features'],
                ['#how-it-works', 'How it works'],
                ['#languages', 'Languages'],
                ['#faq', 'FAQ'],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {label}
                </a>
              ))}
            </nav>
            <AuthButton user={user} />
            <button
              type="button"
              onClick={openPicker}
              disabled={isImporting}
              className="btn-primary px-4 py-2.5 text-sm"
              aria-label="Create a new caption project"
            >
              {isImporting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              <span className="hidden sm:inline">New project</span>
            </button>
          </div>
        </header>

        <main id="main-content">

        <section aria-labelledby="hero-title" className="pt-8 sm:pt-14 pb-10 text-center animate-fadeUp">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1 mb-5">
            <Sparkles size={12} aria-hidden="true" /> Free AI captions · Hindi, Hinglish, English &amp; 25+ languages
          </div>
          <h1
            id="hero-title"
            className="font-display font-black text-3xl sm:text-5xl tracking-tight leading-[1.1]"
          >
            Free AI video caption generator{' '}
            <br />
            <span className="text-gradient">for Hindi, Hinglish &amp; English.</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
            Upload a video, get word-by-word animated subtitles in seconds, style them, and export a ready-to-post MP4 or
            SRT file — free, with no watermark.
          </p>
        </section>

        {serverWarning && (
          <div className="mb-6 flex gap-3 items-start rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <p>{serverWarning}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 flex gap-3 items-start rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200 animate-fadeUp">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <p className="flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-rose-300 hover:text-white text-xs">Dismiss</button>
          </div>
        )}

        <section aria-labelledby="upload-title">
          <h2 id="upload-title" className="sr-only">
            Upload a video to generate AI captions
          </h2>
          <button
            type="button"
            onClick={openPicker}
            disabled={isImporting}
            aria-label="Upload a video to generate captions"
            className={cn(
              'group w-full rounded-2xl border-2 border-dashed transition-all duration-200 py-12 sm:py-16 px-6 flex flex-col items-center gap-4',
              isDragging
                ? 'border-violet-400 bg-violet-500/10 scale-[1.01]'
                : 'border-white/10 bg-white/[0.02] hover:border-violet-500/50 hover:bg-violet-500/[0.04]'
            )}
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 group-hover:scale-110 transition-transform">
              {isImporting ? (
                <Loader2 size={28} className="animate-spin" aria-hidden="true" />
              ) : (
                <UploadCloud size={28} aria-hidden="true" />
              )}
            </div>
            <div>
              <p className="font-semibold text-base sm:text-lg">{isImporting ? 'Preparing your video…' : isDragging ? 'Drop it here' : 'Drop a video or click to upload'}</p>
              <p className="text-xs text-zinc-500 mt-1">MP4, MOV or WEBM · Reels, Shorts, landscape — any size up to {MAX_FILE_MB}MB</p>
            </div>
          </button>
        </section>

        <section aria-labelledby="highlights-title" className="mt-4">
          <h2 id="highlights-title" className="sr-only">
            Why creators choose AutoCaption Studio
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Sparkles, title: 'Accurate AI timing', text: 'Whisper + Gemini word-level sync' },
              { icon: Languages, title: '25+ languages', text: 'Hindi, Hinglish, Punjabi, Tamil…' },
              { icon: Download, title: 'Export video + SRT', text: 'Burned-in captions in full quality' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="panel p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-violet-300 shrink-0">
                  <Icon size={17} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="text-xs text-zinc-500">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="projects" aria-labelledby="projects-title" className="mt-12">
          <h2 id="projects-title" className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Your projects</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="panel aspect-[4/5] shimmer" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="panel py-12 text-center text-sm text-zinc-500">
              <Film size={28} className="mx-auto mb-3 text-zinc-600" />
              No projects yet — your uploaded videos will appear here.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {projects.map((project, i) => (
                <div
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openProject(project)}
                  onKeyDown={(e) => e.key === 'Enter' && openProject(project)}
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  className="group relative panel overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-900/20 animate-fadeUp"
                >
                  <div className="aspect-video bg-black/60 relative overflow-hidden">
                    {project.thumbnail ? (
                      <img
                        src={project.thumbnail}
                        alt={project.name ? `Thumbnail of ${project.name}` : 'Video project thumbnail'}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700">
                        <Film size={32} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    {project.duration ? (
                      <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/70 px-1.5 py-0.5 rounded">{formatDuration(project.duration)}</span>
                    ) : null}
                    {!project.videoBlob && (
                      <span className="absolute inset-0 flex items-center justify-center gap-1.5 text-xs font-medium bg-black/50">
                        {openingId === project.id ? <Loader2 size={16} className="animate-spin" /> : <CloudDownload size={16} />}
                        {openingId === project.id ? 'Downloading…' : 'In cloud'}
                      </span>
                    )}
                    {project.phrases.length > 0 && (
                      <span className="absolute bottom-2 left-2 text-[10px] font-semibold bg-emerald-500/90 text-black px-1.5 py-0.5 rounded">Captioned</span>
                    )}
                  </div>
                  <div className="p-3 pr-10">
                    <h3 className="font-medium text-sm truncate">{project.name}</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{new Date(project.updatedAt || project.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, project)}
                    className={cn(
                      'absolute right-2 bottom-2.5 p-1.5 rounded-lg transition-all text-xs flex items-center gap-1',
                      confirmDelete === project.id
                        ? 'bg-rose-500 text-white'
                        : 'text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10'
                    )}
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                    {confirmDelete === project.id && <span className="pr-0.5">Sure?</span>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <LandingContent onUpload={openPicker} isImporting={isImporting} />
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
