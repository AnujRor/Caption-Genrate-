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
      
      const MAX_HEIGHT = 1280;
      let targetHeight = Math.min(video.videoHeight, MAX_HEIGHT);
      let targetWidth = Math.round(targetHeight * (9 / 16));
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      const canvasStream = canvas.captureStream(30);
      const stream = new MediaStream();
      
      const videoTracks = canvasStream.getVideoTracks();
      if (videoTracks.length > 0) {
        stream.addTrack(videoTracks[0]);
      }
      
      // Capture audio from the main video
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
      let cachedWordMetrics: { word: any, width: number }[] = [];
      let cachedTotalWidth = 0;
      
      let animationFrameId: number;
      const drawFrame = () => {
        if (video.paused || video.ended) {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
          return;
        }
        
        const videoRatio = video.videoWidth / video.videoHeight;
        const canvasRatio = canvas.width / canvas.height;
        let drawX = 0, drawY = 0, drawW = canvas.width, drawH = canvas.height;
        let sourceX = 0, sourceY = 0, sourceW = video.videoWidth, sourceH = video.videoHeight;
        
        if (videoRatio > canvasRatio) {
           sourceW = video.videoHeight * canvasRatio;
           sourceX = (video.videoWidth - sourceW) / 2;
        } else {
           sourceH = video.videoWidth / canvasRatio;
           sourceY = (video.videoHeight - sourceH) / 2;
        }
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, drawX, drawY, drawW, drawH);
        
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
        
        if ('requestVideoFrameCallback' in video) {
          (video as any).requestVideoFrameCallback(drawFrame);
        } else {
          animationFrameId = requestAnimationFrame(drawFrame);
        }
      };
      
      if ('requestVideoFrameCallback' in video) {
        (video as any).requestVideoFrameCallback(drawFrame);
      } else {
        animationFrameId = requestAnimationFrame(drawFrame);
      }
      
    } catch (e) {
      console.error(e);
      alert("Export failed: " + (e as Error).message);
      setIsExporting(false);
    }
  };

  `;

code = code.substring(0, exportStart) + newExport + code.substring(exportEnd);

fs.writeFileSync('src/components/Editor.tsx', code);
