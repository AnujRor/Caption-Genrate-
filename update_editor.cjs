const fs = require('fs');

const editorContent = `import React, { useRef, useState, useEffect } from 'react';
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
  Check
} from 'lucide-react';
import { cn, formatTime } from '../lib/utils';
import { saveProject } from '../lib/db';

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
    try {
      const maxRetries = 3;
      let response;
      let text;
      let data;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1) {
            console.log(\`Retrying... (Attempt \${attempt}/\${maxRetries})\`);
            await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
          }

          const formData = new FormData();
          formData.append('video', currentProject.videoBlob, 'upload_video.mp4');
          formData.append('language', selectedLanguage);
          formData.append('mimeType', currentProject.videoBlob.type || 'video/mp4');
          
          response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });
          
          text = await response.text();
          
          try {
            data = JSON.parse(text);
          } catch (e) {
            console.error("API response was not JSON:", text.substring(0, 500));
            throw new Error("Server returned an invalid response.");
          }
          
          if (!response.ok) {
            if (response.status === 429) { 
              throw new Error('API Quota Exceeded. Please try a shorter video or wait a few moments.'); 
            } else { 
              throw new Error(data.error || 'Failed to generate captions'); 
            }
          }
          
          break;
        } catch (err) {
          console.error(\`Attempt \${attempt} failed:\`, err);
          if (attempt === maxRetries) {
            throw err;
          }
        }
      }
      
      // Clean and group raw words into natural phrases
      const rawWords: { word: string; start: number; end: number }[] = data.words || [];
      const words = rawWords.filter(w => w.word && typeof w.start === 'number' && typeof w.end === 'number');
      
      const phrases: Phrase[] = [];
      let currentWords: { word: string; start: number; end: number }[] = [];
      let phraseStart = 0;
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (currentWords.length === 0) {
          phraseStart = word.start;
        }
        currentWords.push(word);
        
        const isLast = i === words.length - 1;
        const nextWord = !isLast ? words[i + 1] : null;
        const gap = nextWord ? Math.max(0, nextWord.start - word.end) : 0;
        const endsSentence = /[.!?।,]$/.test(word.word);
        
        // Group into short, punchy phrases (3-4 words max) for best short-form video pacing
        if (currentWords.length >= 4 || gap > 0.4 || endsSentence || isLast) {
          const phraseEnd = nextWord ? Math.min(nextWord.start, word.end + 0.35) : word.end + 0.35;
          phrases.push({
            id: Math.random().toString(36).substring(2, 11),
            start: Number(phraseStart.toFixed(3)),
            end: Number(phraseEnd.toFixed(3)),
            words: [...currentWords],
          });
          currentWords = [];
        }
      }

      const updatedProject = { 
        ...currentProject, 
        phrases,
        styles: {
          ...currentProject.styles,
          syncOffset: currentProject.styles.syncOffset || 0
        }
      };
      
      setCurrentProject(updatedProject);
      await saveProject(updatedProject);
    } catch (error) {
      console.error(error);
      alert((error as Error).message || 'Failed to generate captions. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateStyle = (key: keyof typeof currentProject.styles, value: any) => {
    const updatedStyles = { ...currentProject.styles, [key]: value };
    const updatedProject = { ...currentProject, styles: updatedStyles };
    setCurrentProject(updatedProject);
    saveProject(updatedProject);
  };

  const updatePhraseText = (phraseId: string, newText: string) => {
    const newWordsArr = newText.trim().split(/\\s+/);
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
        a.download = \`\${currentProject.name}_captioned.\${extension}\`;
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
        
        let phraseIndex = currentProject.phrases.findIndex(
          (p) => currentT >= p.start && currentT <= p.end
        );
        if (phraseIndex === -1) {
          for (let i = 0; i < currentProject.phrases.length; i++) {
            const p = currentProject.phrases[i];
            const nextP = currentProject.phrases[i + 1];
            if (currentT >= p.start && (!nextP || currentT < nextP.start) && currentT <= p.end + 0.35) {
              phraseIndex = i;
              break;
            }
          }
        }

        const phrase = phraseIndex !== -1 ? currentProject.phrases[phraseIndex] : undefined;

        if (phrase) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const scaleFactor = canvas.height / 800;
          const fontSize = currentProject.styles.fontSize * scaleFactor;
          ctx.font = \`bold \${fontSize}px \${currentProject.styles.fontFamily}\`;
          ctx.lineWidth = currentProject.styles.strokeWidth * scaleFactor;

          const y = (currentProject.styles.positionY / 100) * canvas.height;

          if (phraseIndex !== lastPhraseIndex) {
            cachedTotalWidth = 0;
            cachedWordMetrics = phrase.words.map((w) => {
              const width = ctx.measureText(w.word + ' ').width;
              cachedTotalWidth += width;
              return { word: w, width };
            });
            lastPhraseIndex = phraseIndex;
          }

          let currentX = (canvas.width / 2) - (cachedTotalWidth / 2);

          let activeWordIndex = phrase.words.findIndex(
            (w) => currentT >= w.start && currentT <= w.end
          );
          if (activeWordIndex === -1) {
            for (let j = phrase.words.length - 1; j >= 0; j--) {
              if (currentT >= phrase.words[j].start) {
                activeWordIndex = j;
                break;
              }
            }
            if (activeWordIndex === -1 && phrase.words.length > 0) {
              activeWordIndex = 0;
            }
          }

          phrase.words.forEach((w, i) => {
            const isWordActive = i === activeWordIndex;
            const wText = w.word + ' ';

            ctx.fillStyle = isWordActive ? currentProject.styles.highlightColor : currentProject.styles.textColor;
            ctx.strokeStyle = currentProject.styles.strokeColor;

            if (ctx.lineWidth > 0) {
              ctx.strokeText(wText, currentX + (cachedWordMetrics[i].width / 2), y);
            }
            ctx.fillText(wText, currentX + (cachedWordMetrics[i].width / 2), y);

            currentX += cachedWordMetrics[i].width;
          });
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
          {activeTab === 'captions' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Video Language</h3>
                <div className="space-y-1.5">
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
                  >
                    <option value="Auto-detect">Auto-detect (Auto)</option>
                    <option value="Hindi">Hindi (हिन्दी)</option>
                    <option value="English">English</option>
                    <option value="Indian English">Hinglish / Indian English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Chinese">Chinese</option>
                    <option value="Japanese">Japanese</option>
                    <option value="Korean">Korean</option>
                    <option value="Arabic">Arabic</option>
                    <option value="Russian">Russian</option>
                    <option value="Portuguese">Portuguese</option>
                    <option value="Italian">Italian</option>
                  </select>
                </div>
              </div>

              {currentProject.phrases.length === 0 ? (
                <button
                  onClick={generateCaptions}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-70 shadow-lg shadow-indigo-600/30"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Analyzing Voice & Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} />
                      Generate AI Captions
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-md text-xs border border-indigo-500/20 flex items-center gap-2 font-medium">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                      {currentProject.phrases.length} Captions Ready
                    </div>
                    <button
                      onClick={generateCaptions}
                      disabled={isGenerating}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors"
                      title="Re-run transcription"
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

                <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/70 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300">Sync Offset</label>
                    <span className={cn(
                      "text-xs font-mono px-2 py-0.5 rounded font-bold",
                      syncOffset === 0 ? "bg-slate-700 text-slate-300" :
                      syncOffset > 0 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                      "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    )}>
                      {syncOffset > 0 ? \`+\${syncOffset.toFixed(2)}s (Earlier)\` : syncOffset < 0 ? \`\${syncOffset.toFixed(2)}s (Later)\` : '0.00s (Default)'}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="-1.0"
                    max="1.0"
                    step="0.05"
                    value={syncOffset}
                    onChange={(e) => updateStyle('syncOffset', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => updateStyle('syncOffset', Math.max(-1.0, Number((syncOffset - 0.05).toFixed(2))))}
                      className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-[11px] font-mono text-slate-200 transition-colors"
                    >
                      -0.05s
                    </button>
                    <button
                      onClick={() => updateStyle('syncOffset', 0)}
                      className="py-1.5 px-3 bg-slate-700/60 hover:bg-slate-600 rounded text-[11px] text-slate-400 hover:text-white transition-colors"
                    >
                      Reset (0s)
                    </button>
                    <button
                      onClick={() => updateStyle('syncOffset', Math.min(1.0, Number((syncOffset + 0.05).toFixed(2))))}
                      className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-[11px] font-mono text-slate-200 transition-colors"
                    >
                      +0.05s
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20 text-[11px] text-indigo-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  💡 Sync Tip:
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
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Subtitle Appearance</h3>
              
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500">Font Family</label>
                <select
                  value={currentProject.styles.fontFamily}
                  onChange={(e) => updateStyle('fontFamily', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="Inter, sans-serif">Inter (Modern Clean)</option>
                  <option value="Impact, sans-serif">Impact (Viral Reels)</option>
                  <option value="'Bebas Neue', sans-serif">Bebas Neue (Bold Display)</option>
                  <option value="'Montserrat', sans-serif">Montserrat Bold</option>
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
  const [activeWordIdx, setActiveWordIdx] = useState<{phrase: number, word: number}>({phrase: -1, word: -1});

  useEffect(() => {
    let animationFrameId: number;
    const updateLoop = () => {
      if (!videoRef.current) return;
      
      const syncOffset = project.styles.syncOffset || 0;
      const t = videoRef.current.currentTime + syncOffset;
      
      let pIdx = project.phrases.findIndex(p => t >= p.start && t <= p.end);
      if (pIdx === -1) {
        // Keep active phrase visible through short breath gaps (up to 0.35s)
        for (let i = 0; i < project.phrases.length; i++) {
          const p = project.phrases[i];
          const nextP = project.phrases[i + 1];
          if (t >= p.start && (!nextP || t < nextP.start) && t <= p.end + 0.35) {
            pIdx = i;
            break;
          }
        }
      }

      let wIdx = -1;
      if (pIdx !== -1) {
        const phrase = project.phrases[pIdx];
        wIdx = phrase.words.findIndex(w => t >= w.start && t <= w.end);
        if (wIdx === -1) {
          for (let i = phrase.words.length - 1; i >= 0; i--) {
            if (t >= phrase.words[i].start) {
              wIdx = i;
              break;
            }
          }
          if (wIdx === -1 && phrase.words.length > 0) {
            wIdx = 0;
          }
        }
      }
      
      setActiveWordIdx(prev => {
        if (prev.phrase !== pIdx || prev.word !== wIdx) {
          return { phrase: pIdx, word: wIdx };
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

  const activePhrase = activeWordIdx.phrase !== -1 ? project.phrases[activeWordIdx.phrase] : null;

  if (!activePhrase) return null;

  return (
    <div 
      className="absolute left-0 w-full flex justify-center px-6 pointer-events-none"
      style={{ top: \`\${project.styles.positionY}%\`, transform: 'translateY(-50%) translateZ(0)', willChange: 'transform' }}
    >
      <div 
        className="text-center font-bold"
        style={{ 
          fontFamily: project.styles.fontFamily,
          fontSize: \`\${project.styles.fontSize}px\`,
          lineHeight: '1.2'
        }}
      >
        {activePhrase.words.map((w, i) => {
          const isWordActive = i === activeWordIdx.word;
          return (
            <span
              key={i}
              className={cn(
                "inline-block mx-[4px] uppercase tracking-tighter transition-all duration-75",
                isWordActive ? "scale-110 drop-shadow-lg" : "scale-100 opacity-90"
              )}
              style={{
                color: isWordActive ? project.styles.highlightColor : project.styles.textColor,
                WebkitTextStroke: \`\${project.styles.strokeWidth}px \${project.styles.strokeColor}\`,
                textShadow: project.styles.strokeWidth > 0 ? \`3px 3px 0px rgba(0,0,0,0.9)\` : 'none'
              }}
            >
              {w.word}
            </span>
          );
        })}
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
`;

fs.writeFileSync('src/components/Editor.tsx', editorContent);
