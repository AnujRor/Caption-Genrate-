import React, { useRef, useState, useEffect } from 'react';
import { Project, Phrase } from '../types';
import { 
  Play, 
  Pause, 
  Download, 
  ChevronLeft, 
  Loader2, 
  RefreshCw, 
  Settings2, 
  PanelRightClose,
  Sliders,
  Type,
  AlignLeft,
  Clock,
  Edit3,
  Check,
  ShieldCheck,
  Wand2,
  Sparkles,
  Globe
} from 'lucide-react';
import { cn, formatTime } from '../lib/utils';
import { saveProject } from '../lib/db';
import { extractAudioFromBlob } from '../lib/audioExtractor';
import { autoRepairWords, buildSmartPhrases, fallbackBrowserTranscription } from '../lib/selfHealingAgent';

interface EditorProps {
  project: Project;
  onBack: () => void;
}

export default function Editor({ project, onBack }: EditorProps) {
  const [currentProject, setCurrentProject] = useState<Project>(() => ({
    ...project,
    styles: {
      syncOffset: 0,
      ...project.styles,
    }
  }));
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [healingNotice, setHealingNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'captions' | 'style' | 'timing'>('captions');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Auto-detect');
  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<any>(null);
  const audioSourceRef = useRef<any>(null);
  const audioDestRef = useRef<any>(null);

  useEffect(() => {
    const url = URL.createObjectURL(currentProject.videoBlob);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [currentProject.videoBlob]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const seekToTime = (timeInSeconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, timeInSeconds);
      if (!isPlaying) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const generateCaptions = async () => {
    setIsGenerating(true);
    setHealingNotice(null);
    setGenerationStep("Analyzing audio track...");
    
    try {
      // 1. Extract lightweight audio track on client to make upload instant and prevent proxy drops
      setGenerationStep("Optimizing voice stream...");
      console.log("[Self-Healing Agent] Extracting audio stream from video...");
      const { blob: audioOrVideoBlob, mimeType: uploadMimeType } = await extractAudioFromBlob(currentProject.videoBlob);
      const isAudio = uploadMimeType.startsWith('audio/');
      const uploadFilename = isAudio ? (uploadMimeType.includes('wav') ? 'upload_audio.wav' : 'upload_audio.mp3') : 'upload_video.mp4';

      const maxRetries = 3;
      let data: any = null;
      
      setGenerationStep("AI Detecting Language & Synchronizing...");

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1) {
            setGenerationStep(`Auto-Recovering & Retrying (${attempt}/${maxRetries})...`);
            await new Promise(r => setTimeout(r, 1200 * attempt));
          }

          const formData = new FormData();
          formData.append('video', audioOrVideoBlob, uploadFilename);
          formData.append('language', selectedLanguage);
          formData.append('mimeType', uploadMimeType);
          
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });
          
          const text = await response.text();
          
          // Check if proxy returned HTML (cookie check / auth challenge)
          if (text.includes("Cookie check") || text.startsWith("<!doctype html>") || text.startsWith("<html")) {
            console.warn(`[Self-Healing Agent] Proxy cookie challenge detected. Self-recovering...`);
            throw new Error("Proxy handshake refresh. Auto-retrying...");
          }

          try {
            data = JSON.parse(text);
          } catch (e) {
            console.error("API response was not JSON:", text.substring(0, 300));
            throw new Error("Invalid response format. Retrying...");
          }
          
          if (!response.ok) {
            if (response.status === 429) { 
              throw new Error('API Quota Exceeded. Switching to browser speech engine fallback...'); 
            } else { 
              throw new Error(data.error || 'Failed to generate captions'); 
            }
          }
          
          if (data && Array.isArray(data.words)) {
            break;
          }
        } catch (err) {
          console.warn(`[Self-Healing Agent] Server attempt ${attempt} failed:`, err);
          if (attempt === maxRetries) {
            // Self-Healing Fallback Tier 3: Browser Web Speech API
            console.log("[Self-Healing Agent] Activating browser speech fallback engine...");
            setGenerationStep("Activating Offline Speech Recognition...");
            if (videoRef.current) {
              data = await fallbackBrowserTranscription(videoRef.current, selectedLanguage === 'English' ? 'en-US' : 'hi-IN');
            }
          }
        }
      }

      setGenerationStep("Auto-Repairing & Aligning Timestamps...");

      // 2. Run Self-Healing Auto-Repair on all timestamps
      const rawWords: { word: string; start: number; end: number }[] = (data && data.words) || [];
      const { words: repairedWords, report } = autoRepairWords(rawWords);
      
      // 3. Build smart, perfectly paced phrases
      const phrases = buildSmartPhrases(repairedWords);

      const detectedLang = (data && data.detectedLanguage) || selectedLanguage;
      
      const updatedProject: Project = { 
        ...currentProject, 
        phrases,
        detectedLanguage: detectedLang,
        styles: {
          ...currentProject.styles,
          syncOffset: currentProject.styles.syncOffset || 0
        }
      };
      
      setCurrentProject(updatedProject);
      await saveProject(updatedProject);

      if (phrases.length === 0) {
        setHealingNotice("⚠️ No audible speech was detected in this clip. Please ensure your video has clear audio and retry.");
      } else if (report.repairedCount > 0) {
        setHealingNotice(`✨ ${phrases.length} Captions Generated! Language: ${detectedLang} (${report.repairedCount} timings auto-synced)`);
      } else {
        setHealingNotice(`✨ ${phrases.length} Captions Generated! Language: ${detectedLang}`);
      }
    } catch (error) {
      console.error("[Self-Healing Agent] Handled error:", error);
      setHealingNotice("⚠️ Caption generation encountered an error. Please click 'Generate AI Captions' to retry.");
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const autoHealExistingCaptions = async () => {
    if (currentProject.phrases.length === 0) return;
    
    // Flatten all existing words
    const allWords = currentProject.phrases.flatMap(p => p.words);
    const { words: repairedWords, report } = autoRepairWords(allWords);
    const newPhrases = buildSmartPhrases(repairedWords);

    const updatedProject = {
      ...currentProject,
      phrases: newPhrases,
      styles: {
        ...currentProject.styles,
        syncOffset: 0
      }
    };

    setCurrentProject(updatedProject);
    await saveProject(updatedProject);
    setHealingNotice(`✨ Auto-Heal Complete: Synchronized ${repairedWords.length} words into ${newPhrases.length} clean phrases (Offset reset to 0s).`);
  };

  const updateStyle = (key: keyof typeof currentProject.styles, value: any) => {
    const updatedStyles = { ...currentProject.styles, [key]: value };
    const updatedProject = { ...currentProject, styles: updatedStyles };
    setCurrentProject(updatedProject);
    saveProject(updatedProject);
  };

  const updatePhraseText = (phraseId: string, newText: string) => {
    const newWordsArr = newText.trim().split(/\s+/);
    const updatedPhrases = currentProject.phrases.map(phrase => {
      if (phrase.id !== phraseId) return phrase;
      
      // Distribute timestamps across new words
      const totalDuration = Math.max(0.1, phrase.end - phrase.start);
      const step = totalDuration / Math.max(1, newWordsArr.length);
      
      const newWords = newWordsArr.map((w, idx) => ({
        word: w,
        start: Number((phrase.start + idx * step).toFixed(3)),
        end: Number((phrase.start + (idx + 1) * step).toFixed(3)),
      }));

      return {
        ...phrase,
        words: newWords
      };
    });

    const updatedProject = { ...currentProject, phrases: updatedPhrases };
    setCurrentProject(updatedProject);
    saveProject(updatedProject);
    setEditingPhraseId(null);
  };

  const exportVideo = async () => {
    if (!videoRef.current || !exportCanvasRef.current) return;
    setIsExporting(true);
    
    try {
      const video = videoRef.current;
      const canvas = exportCanvasRef.current;
      const ctx = canvas.getContext('2d')!;

      const MAX_HEIGHT = 1280;
      let targetHeight = Math.min(video.videoHeight || 1280, MAX_HEIGHT);
      let targetWidth = Math.round(targetHeight * (9 / 16));

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const canvasStream = canvas.captureStream(30);
      const stream = new MediaStream();
      
      const videoTracks = canvasStream.getVideoTracks();
      if (videoTracks.length > 0) {
        stream.addTrack(videoTracks[0]);
      }

      // Audio setup
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioSourceRef.current = audioCtxRef.current.createMediaElementSource(video);
        audioDestRef.current = audioCtxRef.current.createMediaStreamDestination();
        audioSourceRef.current.connect(audioDestRef.current);
        audioSourceRef.current.connect(audioCtxRef.current.destination);
      }
      
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }

      const audioTracks = audioDestRef.current.stream.getAudioTracks();
      if (audioTracks.length > 0) {
        stream.addTrack(audioTracks[0]);
      }

      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
         mimeType = 'video/webm;codecs=vp9,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
         mimeType = 'video/webm;codecs=vp8,opus';
      } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
         mimeType = 'video/mp4';
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `${currentProject.name}_captioned.${extension}`;
        a.click();
        URL.revokeObjectURL(url);
        setIsExporting(false);
      };

      mediaRecorder.start(100);

      video.currentTime = 0;
      await video.play();

      let lastPhraseIndex = -1;
      let cachedWordMetrics: { word: any; width: number }[] = [];
      let cachedTotalWidth = 0;

      const drawFrame = () => {
        if (video.paused || video.ended) {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
          return;
        }

        const videoRatio = (video.videoWidth || 9) / (video.videoHeight || 16);
        const canvasRatio = canvas.width / canvas.height;
        let drawX = 0, drawY = 0, drawW = canvas.width, drawH = canvas.height;
        let sourceX = 0, sourceY = 0, sourceW = video.videoWidth || canvas.width, sourceH = video.videoHeight || canvas.height;

        if (videoRatio > canvasRatio) { 
           sourceW = (video.videoHeight || canvas.height) * canvasRatio; 
           sourceX = ((video.videoWidth || canvas.width) - sourceW) / 2;
        } else { 
           sourceH = (video.videoWidth || canvas.width) / canvasRatio; 
           sourceY = ((video.videoHeight || canvas.height) - sourceH) / 2;
        }

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, drawX, drawY, drawW, drawH);

        const syncOffset = currentProject.styles.syncOffset || 0;
        const currentT = video.currentTime + syncOffset;
        
        let phraseIndex = -1;
        let activeWordIndex = -1;
        let isSpeaking = false;

        for (let p = 0; p < currentProject.phrases.length; p++) {
          const ph = currentProject.phrases[p];
          if (currentT >= ph.start && currentT <= ph.end) {
            phraseIndex = p;
            for (let w = 0; w < ph.words.length; w++) {
              if (currentT >= ph.words[w].start && currentT <= ph.words[w].end) {
                activeWordIndex = w;
                isSpeaking = true;
                break;
              }
            }
            break;
          }
        }

        const phrase = phraseIndex !== -1 ? currentProject.phrases[phraseIndex] : undefined;

        if (phrase) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const scaleFactor = canvas.height / 800;
          const fontSize = currentProject.styles.fontSize * scaleFactor;
          ctx.font = `bold ${fontSize}px ${currentProject.styles.fontFamily}`;
          ctx.lineWidth = currentProject.styles.strokeWidth * scaleFactor;

          const y = (currentProject.styles.positionY / 100) * canvas.height;
          const displayMode = currentProject.styles.displayMode || 'single-word';

          if (displayMode === 'single-word') {
            // ONLY draw if the speaker is actively speaking the word right now
            if (isSpeaking && activeWordIndex !== -1) {
              const activeWord = phrase.words[activeWordIndex];
              if (activeWord) {
                const text = activeWord.word.toUpperCase();
                ctx.fillStyle = currentProject.styles.highlightColor;
                ctx.strokeStyle = currentProject.styles.strokeColor;
                
                if (ctx.lineWidth > 0) {
                  ctx.strokeText(text, canvas.width / 2, y);
                }
                ctx.fillText(text, canvas.width / 2, y);
              }
            }
          } else if (displayMode === 'progressive') {
            // Draw words progressively up to active word
            const wordsToDraw = phrase.words.slice(0, activeWordIndex !== -1 ? activeWordIndex + 1 : phrase.words.length);
            let totalW = 0;
            const metrics = wordsToDraw.map(w => {
              const wWidth = ctx.measureText(w.word.toUpperCase() + ' ').width;
              totalW += wWidth;
              return { word: w, width: wWidth };
            });

            let curX = (canvas.width / 2) - (totalW / 2);
            wordsToDraw.forEach((w, i) => {
              const isWordActive = i === activeWordIndex;
              const wText = w.word.toUpperCase() + ' ';
              ctx.fillStyle = isWordActive ? currentProject.styles.highlightColor : currentProject.styles.textColor;
              ctx.strokeStyle = currentProject.styles.strokeColor;

              if (ctx.lineWidth > 0) {
                ctx.strokeText(wText, curX + (metrics[i].width / 2), y);
              }
              ctx.fillText(wText, curX + (metrics[i].width / 2), y);
              curX += metrics[i].width;
            });
          } else {
            // Full line Karaoke mode
            if (phraseIndex !== lastPhraseIndex) {
              cachedTotalWidth = 0;
              cachedWordMetrics = phrase.words.map((w) => {
                const width = ctx.measureText(w.word.toUpperCase() + ' ').width;
                cachedTotalWidth += width;
                return { word: w, width };
              });
              lastPhraseIndex = phraseIndex;
            }

            let currentX = (canvas.width / 2) - (cachedTotalWidth / 2);
            cachedWordMetrics.forEach((item, i) => {
              const isWordActive = i === activeWordIndex;
              const text = item.word.word.toUpperCase() + ' ';
              ctx.fillStyle = isWordActive ? currentProject.styles.highlightColor : currentProject.styles.textColor;
              ctx.strokeStyle = currentProject.styles.strokeColor;

              if (ctx.lineWidth > 0) {
                ctx.strokeText(text, currentX + (item.width / 2), y);
              }
              ctx.fillText(text, currentX + (item.width / 2), y);
              currentX += item.width;
            });
          }
        }

        if ('requestVideoFrameCallback' in video) {
          (video as any).requestVideoFrameCallback(drawFrame);
        } else {
          requestAnimationFrame(drawFrame);
        }
      };

      if ('requestVideoFrameCallback' in video) {
        (video as any).requestVideoFrameCallback(drawFrame);
      } else {
        requestAnimationFrame(drawFrame);
      }

    } catch (e) {
      console.error(e);
      alert("Export failed: " + (e as Error).message);
      setIsExporting(false);
    }
  };

  const syncOffset = currentProject.styles.syncOffset || 0;

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Hidden canvas for export */}
      <canvas ref={exportCanvasRef} className="fixed top-[-9999px] left-[-9999px] opacity-0 pointer-events-none" />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-1.5 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white"
              title="Back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">V</div>
            <h1 className="text-lg font-semibold tracking-tight truncate">{currentProject.name}</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportVideo}
              disabled={isExporting}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 shadow-lg shadow-indigo-600/20"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {isExporting ? 'Exporting...' : 'Export High Quality'}
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col relative">
          <div className="flex-1 flex items-center justify-center p-8 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950 overflow-hidden relative">
            {/* Video Container */}
            <div className="relative rounded-xl overflow-hidden shadow-2xl bg-black border border-white/10" style={{ maxHeight: '100%', maxWidth: '100%', aspectRatio: '9/16' }}>
              <video
                ref={videoRef}
                src={videoUrl || undefined}
                className="w-full h-full object-cover" 
                style={{ transform: "translateZ(0)", willChange: "transform" }}
                onEnded={() => setIsPlaying(false)}
                onClick={togglePlay}
                playsInline
              />

              {/* Play/Pause Overlay */}
              {!isPlaying && (
                <div 
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer"
                >
                  <div className="w-16 h-16 border-4 border-white/20 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-sm text-white">
                    <Play size={24} fill="currentColor" className="ml-1" />
                  </div>
                </div>
              )}

              <CaptionOverlay videoRef={videoRef} project={currentProject} />
            </div>
          </div>

          <TimelineBar videoRef={videoRef} isPlaying={isPlaying} togglePlay={togglePlay} />
        </div>
      </div>

      {/* Sidebar Toggle Button (if closed) */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="absolute right-4 top-20 bg-slate-800 p-3 rounded-full text-white shadow-lg z-20 hover:bg-slate-700 transition-all border border-slate-700"
          title="Open Settings"
        >
          <Settings2 size={24} />
        </button>
      )}

      {/* Sidebar */}
      <div className={cn(
        "bg-slate-900 border-l border-slate-800 flex flex-col z-10 shrink-0 transition-all duration-300",
        isSidebarOpen ? "w-[340px]" : "w-0 overflow-hidden"
      )}>
        <div className="flex items-center justify-between p-4 border-b border-slate-800 w-[340px]">
          <div className="flex flex-1 p-1 bg-slate-950 rounded-lg mr-2 gap-1">
            <button 
              onClick={() => setActiveTab('captions')}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5",
                activeTab === 'captions' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-300"
              )}
            >
              <AlignLeft size={13} />
              Captions
            </button>
            <button 
              onClick={() => setActiveTab('timing')}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5",
                activeTab === 'timing' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-300"
              )}
            >
              <Clock size={13} />
              Voice Sync
            </button>
            <button 
              onClick={() => setActiveTab('style')}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5",
                activeTab === 'style' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-300"
              )}
            >
              <Type size={13} />
              Style
            </button>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white p-1">
             <PanelRightClose size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 w-[340px]">
          {/* Persistent Self-Healing Shield Badge */}
          <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 flex items-center justify-between text-[11px] text-emerald-400">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
              Self-Healing Error Guard Active
            </span>
            <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-300 font-mono">
              Auto-Protected
            </span>
          </div>

          {healingNotice && (
            <div className="mb-4 bg-indigo-500/15 border border-indigo-500/30 rounded-lg p-2.5 text-xs text-indigo-200 flex items-start gap-2 animate-fadeIn">
              <Sparkles size={14} className="text-indigo-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{healingNotice}</div>
            </div>
          )}

          {activeTab === 'captions' && (
            <div className="space-y-5">
              {/* Language Selection Option */}
              <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Globe size={14} className="text-indigo-400" />
                    Language / Dialect
                  </label>
                  {currentProject.detectedLanguage && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-medium border border-emerald-500/30">
                      Detected: {currentProject.detectedLanguage}
                    </span>
                  )}
                </div>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 font-medium transition-colors cursor-pointer"
                >
                  <option value="Auto-detect">⚡ Auto-detect (All Languages & Regional Dialects)</option>
                  <option value="Hindi">🇮🇳 Hindi (हिन्दी - शुद्ध देवनागरी)</option>
                  <option value="Hinglish">🇮🇳 Hinglish (Hindi in English letters / Roman Script)</option>
                  <option value="English">🌐 English (Global / Indian / US / UK)</option>
                  <option value="Punjabi">🇮🇳 Punjabi (ਪੰਜਾਬੀ)</option>
                  <option value="Haryanvi">🇮🇳 Haryanvi / Rajasthani (हरियाणवी / मारवाड़ी)</option>
                  <option value="Bhojpuri">🇮🇳 Bhojpuri / Maithili (भोजपुरी)</option>
                  <option value="Marathi">🇮🇳 Marathi (मराठी)</option>
                  <option value="Gujarati">🇮🇳 Gujarati (ગુજરાતી)</option>
                  <option value="Bengali">🇮🇳 Bengali (বাংলা)</option>
                  <option value="Urdu">🇵🇰 Urdu (اردو)</option>
                  <option value="Tamil">🇮🇳 Tamil (தமிழ்)</option>
                  <option value="Telugu">🇮🇳 Telugu (తెలుగు)</option>
                  <option value="Kannada">🇮🇳 Kannada (ಕನ್ನಡ)</option>
                  <option value="Malayalam">🇮🇳 Malayalam (മലയാളം)</option>
                  <option value="Odia">🇮🇳 Odia (ଓଡ଼ିଆ)</option>
                  <option value="Assamese">🇮🇳 Assamese (অসমীয়া)</option>
                  <option value="Arabic">🇸🇦 Arabic (العربية)</option>
                  <option value="Spanish">🇪🇸 Spanish (Español)</option>
                  <option value="French">🇫🇷 French (Français)</option>
                  <option value="German">🇩🇪 German (Deutsch)</option>
                  <option value="Russian">🇷🇺 Russian (Русский)</option>
                  <option value="Japanese">🇯🇵 Japanese (日本語)</option>
                  <option value="Korean">🇰🇷 Korean (한국어)</option>
                  <option value="Chinese">🇨🇳 Chinese (中文)</option>
                  <option value="Portuguese">🇧🇷 Portuguese (Português)</option>
                  <option value="Italian">🇮🇹 Italian (Italiano)</option>
                  <option value="Turkish">🇹🇷 Turkish (Türkçe)</option>
                </select>
              </div>

              {currentProject.phrases.length === 0 ? (
                <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                    <Wand2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-200">Smart Voice Captions</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Automatically detects spoken language, words, pauses, and synchronizes captions with vocal timing.
                    </p>
                  </div>

                  <button
                    onClick={generateCaptions}
                    disabled={isGenerating}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-70 shadow-lg shadow-indigo-600/30 cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {generationStep || "Analyzing Voice & Generating..."}
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Auto-Generate Captions
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-md text-xs border border-indigo-500/20 flex items-center gap-2 font-medium">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                      {currentProject.phrases.length} Captions Synced
                    </div>
                    <button
                      onClick={generateCaptions}
                      disabled={isGenerating}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors"
                      title="Re-run transcription with AI"
                    >
                      <RefreshCw size={12} className={isGenerating ? "animate-spin" : ""} />
                      Regenerate
                    </button>
                  </div>

                  {/* Phrase list */}
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {currentProject.phrases.map((phrase, pIdx) => {
                      const isEditing = editingPhraseId === phrase.id;
                      const phraseText = phrase.words.map(w => w.word).join(' ');

                      return (
                        <div 
                          key={phrase.id}
                          className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60 hover:border-slate-600 transition-all text-xs group"
                        >
                          <div className="flex items-center justify-between mb-1.5 text-[10px] text-slate-400">
                            <button
                              onClick={() => seekToTime(phrase.start)}
                              className="font-mono text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                              title="Click to play from here"
                            >
                              <Play size={10} fill="currentColor" />
                              {formatTime(phrase.start)} - {formatTime(phrase.end)}
                            </button>
                            
                            {!isEditing && (
                              <button
                                onClick={() => {
                                  setEditingPhraseId(phrase.id);
                                  setEditingText(phraseText);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition-opacity p-0.5"
                                title="Edit text"
                              >
                                <Edit3 size={12} />
                              </button>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="space-y-2 mt-1">
                              <input
                                type="text"
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="w-full bg-slate-900 border border-indigo-500 rounded p-1.5 text-xs text-white outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') updatePhraseText(phrase.id, editingText);
                                  if (e.key === 'Escape') setEditingPhraseId(null);
                                }}
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => setEditingPhraseId(null)}
                                  className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-white"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => updatePhraseText(phrase.id, editingText)}
                                  className="px-2 py-0.5 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center gap-1"
                                >
                                  <Check size={10} />
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              onClick={() => seekToTime(phrase.start)}
                              className="cursor-pointer text-slate-200 font-medium leading-relaxed hover:text-white"
                            >
                              {phraseText}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'timing' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Voice & Audio Sync</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                  Fine-tune the exact millisecond caption timing to match your voice perfectly.
                </p>

                {/* 1-Click Auto-Heal & Re-Sync Button */}
                {currentProject.phrases.length > 0 && (
                  <button
                    onClick={autoHealExistingCaptions}
                    className="w-full mb-4 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-emerald-500/40 text-emerald-300 px-3 py-2 rounded-lg text-xs font-medium transition-all shadow-sm"
                  >
                    <Wand2 size={13} className="text-emerald-400" />
                    Auto-Heal & Re-Align All Timestamps (1-Click)
                  </button>
                )}

                <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/70 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300">Sync Offset</label>
                    <span className={cn(
                      "text-xs font-mono px-2 py-0.5 rounded font-bold",
                      syncOffset === 0 ? "bg-slate-700 text-slate-300" :
                      syncOffset > 0 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                      "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    )}>
                      {syncOffset > 0 ? `+${syncOffset.toFixed(2)}s (Earlier)` : syncOffset < 0 ? `${syncOffset.toFixed(2)}s (Later)` : '0.00s (Exact)'}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="-1.5"
                    max="1.5"
                    step="0.02"
                    value={syncOffset}
                    onChange={(e) => updateStyle('syncOffset', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />

                  {/* Fine Adjustment Presets */}
                  <div className="grid grid-cols-5 gap-1 pt-1">
                    <button
                      onClick={() => updateStyle('syncOffset', Math.max(-1.5, Number((syncOffset - 0.20).toFixed(2))))}
                      className="py-1 bg-slate-700/80 hover:bg-slate-600 rounded text-[10px] font-mono text-slate-200 transition-colors"
                      title="-0.20s"
                    >
                      -0.20s
                    </button>
                    <button
                      onClick={() => updateStyle('syncOffset', Math.max(-1.5, Number((syncOffset - 0.05).toFixed(2))))}
                      className="py-1 bg-slate-700/80 hover:bg-slate-600 rounded text-[10px] font-mono text-slate-200 transition-colors"
                      title="-0.05s"
                    >
                      -0.05s
                    </button>
                    <button
                      onClick={() => updateStyle('syncOffset', 0)}
                      className="py-1 bg-slate-700/50 hover:bg-slate-600 rounded text-[10px] font-medium text-slate-300 hover:text-white transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => updateStyle('syncOffset', Math.min(1.5, Number((syncOffset + 0.05).toFixed(2))))}
                      className="py-1 bg-slate-700/80 hover:bg-slate-600 rounded text-[10px] font-mono text-slate-200 transition-colors"
                      title="+0.05s"
                    >
                      +0.05s
                    </button>
                    <button
                      onClick={() => updateStyle('syncOffset', Math.min(1.5, Number((syncOffset + 0.20).toFixed(2))))}
                      className="py-1 bg-slate-700/80 hover:bg-slate-600 rounded text-[10px] font-mono text-slate-200 transition-colors"
                      title="+0.20s"
                    >
                      +0.20s
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20 text-[11px] text-indigo-300 space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5">
                  💡 Sync Guide:
                </div>
                <div>
                  • If captions appear <strong>after</strong> you speak, move the slider to <strong>+ (positive)</strong>.
                </div>
                <div>
                  • If captions appear <strong>before</strong> you speak, move the slider to <strong>- (negative)</strong>.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'style' && (
            <div className="space-y-6">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Subtitle Appearance</h3>
              
              {/* Display Mode Selector - User Requested Word-by-Word Feature */}
              <div className="space-y-2 pb-2 border-b border-slate-800">
                <label className="text-[11px] text-indigo-400 font-semibold flex items-center gap-1.5">
                  <Sparkles size={13} />
                  Caption Display Mode
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => updateStyle('displayMode', 'single-word')}
                    className={cn(
                      "p-2 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1",
                      (currentProject.styles.displayMode || 'single-word') === 'single-word'
                        ? "bg-indigo-600/25 border-indigo-500 text-white shadow-sm"
                        : "bg-slate-800 border-slate-700/80 text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <span className="text-sm">⚡</span>
                    <span className="text-[10px] font-bold leading-tight">1-Word Pop</span>
                    <span className="text-[8px] text-slate-400 leading-tight">Spoken word only</span>
                  </button>

                  <button
                    onClick={() => updateStyle('displayMode', 'progressive')}
                    className={cn(
                      "p-2 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1",
                      currentProject.styles.displayMode === 'progressive'
                        ? "bg-indigo-600/25 border-indigo-500 text-white shadow-sm"
                        : "bg-slate-800 border-slate-700/80 text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <span className="text-sm">🌊</span>
                    <span className="text-[10px] font-bold leading-tight">Progressive</span>
                    <span className="text-[8px] text-slate-400 leading-tight">Words add up</span>
                  </button>

                  <button
                    onClick={() => updateStyle('displayMode', 'karaoke')}
                    className={cn(
                      "p-2 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1",
                      currentProject.styles.displayMode === 'karaoke'
                        ? "bg-indigo-600/25 border-indigo-500 text-white shadow-sm"
                        : "bg-slate-800 border-slate-700/80 text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <span className="text-sm">🎤</span>
                    <span className="text-[10px] font-bold leading-tight">Karaoke</span>
                    <span className="text-[8px] text-slate-400 leading-tight">Full line glow</span>
                  </button>
                </div>
              </div>

              {/* Word Animation Style */}
              <div className="space-y-1.5 pb-2 border-b border-slate-800">
                <label className="text-[11px] text-slate-400 font-medium">Vocal Speed Animation</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => updateStyle('animationStyle', 'pop')}
                    className={cn(
                      "py-1.5 px-2 rounded border text-[10px] font-medium transition-colors",
                      (currentProject.styles.animationStyle || 'pop') === 'pop'
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    )}
                  >
                    💥 Bouncy Pop
                  </button>
                  <button
                    onClick={() => updateStyle('animationStyle', 'glow')}
                    className={cn(
                      "py-1.5 px-2 rounded border text-[10px] font-medium transition-colors",
                      currentProject.styles.animationStyle === 'glow'
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    )}
                  >
                    ✨ Neon Glow
                  </button>
                  <button
                    onClick={() => updateStyle('animationStyle', 'classic')}
                    className={cn(
                      "py-1.5 px-2 rounded border text-[10px] font-medium transition-colors",
                      currentProject.styles.animationStyle === 'classic'
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    )}
                  >
                    🌟 Classic
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500">Font Family</label>
                <select
                  value={currentProject.styles.fontFamily}
                  onChange={(e) => updateStyle('fontFamily', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="'Montserrat', sans-serif">Montserrat Bold (Popular Reels)</option>
                  <option value="Impact, sans-serif">Impact (Viral Shorts)</option>
                  <option value="Inter, sans-serif">Inter (Modern Clean)</option>
                  <option value="'Bebas Neue', sans-serif">Bebas Neue (Bold Display)</option>
                  <option value="'Courier New', monospace">Typewriter Monospace</option>
                </select>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-500">Font Size</label>
                  <span className="text-[10px] text-slate-400 font-mono">{currentProject.styles.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="80"
                  value={currentProject.styles.fontSize}
                  onChange={(e) => updateStyle('fontSize', parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-500">Text Color</label>
                  <div className="flex items-center gap-2 p-1 bg-slate-800 rounded border border-slate-700">
                    <input
                      type="color"
                      value={currentProject.styles.textColor}
                      onChange={(e) => updateStyle('textColor', e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">{currentProject.styles.textColor}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-500">Highlight / Accent</label>
                  <div className="flex items-center gap-2 p-1 bg-slate-800 rounded border border-slate-700">
                    <input
                      type="color"
                      value={currentProject.styles.highlightColor}
                      onChange={(e) => updateStyle('highlightColor', e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">{currentProject.styles.highlightColor}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-500">Outline / Stroke</label>
                  <div className="flex items-center gap-2 p-1 bg-slate-800 rounded border border-slate-700 w-1/2">
                    <input
                      type="color"
                      value={currentProject.styles.strokeColor}
                      onChange={(e) => updateStyle('strokeColor', e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">{currentProject.styles.strokeColor}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-slate-500">Stroke Thickness</label>
                    <span className="text-[10px] text-slate-400 font-mono">{currentProject.styles.strokeWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={currentProject.styles.strokeWidth}
                    onChange={(e) => updateStyle('strokeWidth', parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-500">Vertical Position</label>
                  <span className="text-[10px] text-slate-400 font-mono">{currentProject.styles.positionY}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={currentProject.styles.positionY}
                  onChange={(e) => updateStyle('positionY', parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CaptionOverlay({ videoRef, project }: { videoRef: React.RefObject<HTMLVideoElement>, project: Project }) {
  const [activeWordIdx, setActiveWordIdx] = useState<{phrase: number, word: number, isSpeaking: boolean}>({phrase: -1, word: -1, isSpeaking: false});

  useEffect(() => {
    let animationFrameId: number;
    const updateLoop = () => {
      if (!videoRef.current) return;
      
      const syncOffset = project.styles.syncOffset || 0;
      const t = videoRef.current.currentTime + syncOffset;
      
      let pIdx = -1;
      let wIdx = -1;
      let isSpeaking = false;

      // Find if current playback time is inside any word
      for (let p = 0; p < project.phrases.length; p++) {
        const phrase = project.phrases[p];
        if (t >= phrase.start && t <= phrase.end) {
          pIdx = p;
          for (let w = 0; w < phrase.words.length; w++) {
            const word = phrase.words[w];
            // Precise word boundary check: only speaking when vocal track is uttering the word
            if (t >= word.start && t <= word.end) {
              wIdx = w;
              isSpeaking = true;
              break;
            }
          }
          break;
        }
      }
      
      setActiveWordIdx(prev => {
        if (prev.phrase !== pIdx || prev.word !== wIdx || prev.isSpeaking !== isSpeaking) {
          return { phrase: pIdx, word: wIdx, isSpeaking };
        }
        return prev;
      });

      if ('requestVideoFrameCallback' in videoRef.current) {
        animationFrameId = (videoRef.current as any).requestVideoFrameCallback(updateLoop);
      } else {
        animationFrameId = requestAnimationFrame(updateLoop);
      }
    };

    if (videoRef.current && 'requestVideoFrameCallback' in videoRef.current) {
      animationFrameId = (videoRef.current as any).requestVideoFrameCallback(updateLoop);
    } else {
      animationFrameId = requestAnimationFrame(updateLoop);
    }

    return () => {
      if (videoRef.current && 'cancelVideoFrameCallback' in videoRef.current) {
        (videoRef.current as any).cancelVideoFrameCallback(animationFrameId);
      } else {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [videoRef, project.phrases, project.styles.syncOffset]);

  const displayMode = project.styles.displayMode || 'single-word';
  const animStyle = project.styles.animationStyle || 'pop';

  // 1. Single-Word Mode: IF SPEAKER IS PAUSING / SILENT, DISPLAY NOTHING!
  if (displayMode === 'single-word') {
    if (!activeWordIdx.isSpeaking || activeWordIdx.phrase === -1 || activeWordIdx.word === -1) {
      return null;
    }
    const phrase = project.phrases[activeWordIdx.phrase];
    const activeWord = phrase ? phrase.words[activeWordIdx.word] : null;
    if (!activeWord) return null;

    // Speech tempo based animation speed
    const wordDuration = Math.max(0.06, activeWord.end - activeWord.start);
    const animDurationMs = Math.min(220, Math.max(60, Math.round(wordDuration * 320)));

    return (
      <div 
        className="absolute left-0 w-full flex justify-center px-6 pointer-events-none"
        style={{ top: `${project.styles.positionY}%`, transform: 'translateY(-50%) translateZ(0)', willChange: 'transform' }}
      >
        <div 
          className="text-center font-bold"
          style={{ 
            fontFamily: project.styles.fontFamily,
            fontSize: `${project.styles.fontSize}px`,
            lineHeight: '1.15'
          }}
        >
          <div
            key={`${phrase.id}-${activeWordIdx.word}-${activeWord.word}`}
            className={cn(
              "inline-block uppercase tracking-tight transition-transform select-none",
              animStyle === 'pop' ? "animate-wordPop" : animStyle === 'glow' ? "animate-wordGlow" : "scale-105"
            )}
            style={{
              color: project.styles.highlightColor,
              WebkitTextStroke: `${project.styles.strokeWidth}px ${project.styles.strokeColor}`,
              textShadow: project.styles.strokeWidth > 0 
                ? `3px 3px 0px rgba(0,0,0,0.9), 0 0 16px ${project.styles.highlightColor}66` 
                : `0 0 16px ${project.styles.highlightColor}66`,
              transitionDuration: `${animDurationMs}ms`
            }}
          >
            {activeWord.word}
          </div>
        </div>
      </div>
    );
  }

  // 2. Progressive or Karaoke Mode
  if (activeWordIdx.phrase === -1) return null;
  const activePhrase = project.phrases[activeWordIdx.phrase];
  if (!activePhrase) return null;

  return (
    <div 
      className="absolute left-0 w-full flex justify-center px-6 pointer-events-none"
      style={{ top: `${project.styles.positionY}%`, transform: 'translateY(-50%) translateZ(0)', willChange: 'transform' }}
    >
      <div 
        className="text-center font-bold"
        style={{ 
          fontFamily: project.styles.fontFamily,
          fontSize: `${project.styles.fontSize}px`,
          lineHeight: '1.15'
        }}
      >
        {displayMode === 'progressive' && (
          <div className="flex flex-wrap justify-center items-center">
            {activePhrase.words.slice(0, activeWordIdx.word !== -1 ? activeWordIdx.word + 1 : activePhrase.words.length).map((w, i) => {
              const isWordActive = i === activeWordIdx.word;
              return (
                <span
                  key={i}
                  className={cn(
                    "inline-block mx-[4px] uppercase tracking-tighter transition-all",
                    isWordActive ? "scale-115 drop-shadow-xl" : "scale-100 opacity-95"
                  )}
                  style={{
                    color: isWordActive ? project.styles.highlightColor : project.styles.textColor,
                    WebkitTextStroke: `${project.styles.strokeWidth}px ${project.styles.strokeColor}`,
                    textShadow: project.styles.strokeWidth > 0 ? `3px 3px 0px rgba(0,0,0,0.9)` : 'none',
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        )}

        {displayMode === 'karaoke' && (
          <div className="flex flex-wrap justify-center items-center">
            {activePhrase.words.map((w, i) => {
              const isWordActive = i === activeWordIdx.word;
              return (
                <span
                  key={i}
                  className={cn(
                    "inline-block mx-[4px] uppercase tracking-tighter transition-all",
                    isWordActive ? "scale-115 drop-shadow-xl" : "scale-100 opacity-75"
                  )}
                  style={{
                    color: isWordActive ? project.styles.highlightColor : project.styles.textColor,
                    WebkitTextStroke: `${project.styles.strokeWidth}px ${project.styles.strokeColor}`,
                    textShadow: project.styles.strokeWidth > 0 ? `3px 3px 0px rgba(0,0,0,0.9)` : 'none',
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineBar({ videoRef, isPlaying, togglePlay }: { videoRef: React.RefObject<HTMLVideoElement>, isPlaying: boolean, togglePlay: () => void }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoRef]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  return (
    <div className="h-14 bg-slate-900 border-t border-slate-800 flex items-center px-6 gap-4 z-10">
      <button 
        onClick={togglePlay}
        className="text-white hover:text-indigo-400 transition-colors p-1"
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
      </button>

      <span className="text-xs font-mono text-slate-400 w-12">{formatTime(currentTime)}</span>

      <div className="flex-1 relative flex items-center">
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.01"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
      </div>

      <span className="text-xs font-mono text-slate-400 w-12">{formatTime(duration)}</span>
    </div>
  );
}
