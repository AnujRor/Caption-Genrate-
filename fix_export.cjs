const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

const exportStart = code.indexOf('const exportVideo = async () => {');
const exportEnd = code.indexOf('return (', exportStart);

let newExport = `const exportVideo = async () => {
    if (!videoRef.current || !exportCanvasRef.current) return;
    setIsExporting(true);
    
    try {
      const video = videoRef.current;
      const canvas = exportCanvasRef.current;
      const ctx = canvas.getContext('2d')!;
      
      const MAX_HEIGHT = 720;
      let targetWidth = video.videoWidth;
      let targetHeight = video.videoHeight;
      if (targetHeight > MAX_HEIGHT) {
        const ratio = MAX_HEIGHT / targetHeight;
        targetHeight = MAX_HEIGHT;
        targetWidth = Math.round(targetWidth * ratio);
      }
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      const canvasStream = canvas.captureStream(30);
      const stream = new MediaStream();
      
      const videoTracks = canvasStream.getVideoTracks();
      if (videoTracks.length > 0) {
        stream.addTrack(videoTracks[0]);
      }
      
      // Create a dedicated audio element for the export to ensure audio plays and is captured
      const exportAudio = document.createElement('audio');
      exportAudio.src = video.src;
      exportAudio.crossOrigin = "anonymous";
      
      let audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(exportAudio);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      source.connect(audioCtx.destination);
      
      const audioTracks = dest.stream.getAudioTracks();
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
        audioCtx.close();
      };
      
      mediaRecorder.start(100); // 100ms chunks to keep it smooth
      
      // Sync video and audio
      video.currentTime = 0;
      exportAudio.currentTime = 0;
      
      if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
      }
      
      await Promise.all([video.play(), exportAudio.play()]);
      
      let lastPhraseIndex = -1;
      let cachedWordMetrics: { word: any, width: number }[] = [];
      let cachedTotalWidth = 0;
      
      const drawFrame = () => {
        if (video.paused || video.ended) {
          mediaRecorder.stop();
          exportAudio.pause();
          return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const currentT = video.currentTime;
        const phraseIndex = currentProject.phrases.findIndex(
          (p) => currentT >= p.start && currentT <= p.end
        );
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
          
          phrase.words.forEach((w, i) => {
            let activeWordIndex = phrase.words.findIndex(
              (w) => currentT >= w.start && currentT <= w.end
            );
            if (activeWordIndex === -1) {
              for(let j = phrase.words.length - 1; j >= 0; j--) {
                if (currentT >= phrase.words[j].start) {
                  activeWordIndex = j;
                  break;
                }
              }
            }
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
        
        requestAnimationFrame(drawFrame);
      };
      
      requestAnimationFrame(drawFrame);
    } catch (e) {
      console.error(e);
      alert("Export failed: " + (e as Error).message);
      setIsExporting(false);
    }
  };

  `;

code = code.substring(0, exportStart) + newExport + code.substring(exportEnd);

fs.writeFileSync('src/components/Editor.tsx', code);
