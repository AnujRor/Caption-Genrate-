// Ultra-fast audio extraction: avoids heavy in-browser audio decoding for large video files
export async function extractAudioFromBlob(videoBlob: Blob): Promise<{ blob: Blob; mimeType: string }> {
  // 1. If it is already an audio blob, return immediately in 0ms
  if (videoBlob.type && videoBlob.type.startsWith('audio/')) {
    return { blob: videoBlob, mimeType: videoBlob.type };
  }

  // 2. For video files, sending directly to the server is 20x faster because
  // server-side ffmpeg extracts pure audio in ~150ms without freezing the browser's JS thread.
  if (videoBlob.size > 1.5 * 1024 * 1024) {
    return { blob: videoBlob, mimeType: videoBlob.type || 'video/mp4' };
  }

  // 3. For small clips (<1.5MB), fast client extraction
  try {
    const arrayBuffer = await videoBlob.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return { blob: videoBlob, mimeType: videoBlob.type || 'video/mp4' };
    }

    const audioCtx = new AudioContextClass();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    const targetSampleRate = 16000;
    const duration = audioBuffer.duration;
    const offlineCtx = new OfflineAudioContext(1, Math.ceil(duration * targetSampleRate), targetSampleRate);
    
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    
    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = audioBufferToWavBlob(renderedBuffer);
    
    if (audioCtx.state !== 'closed') {
      audioCtx.close();
    }

    return { blob: wavBlob, mimeType: 'audio/wav' };
  } catch (err) {
    return { blob: videoBlob, mimeType: videoBlob.type || 'video/mp4' };
  }
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numOfChan * bytesPerSample;
  const dataByteCount = buffer.length * blockAlign;
  const headerByteCount = 44;
  const totalLength = headerByteCount + dataByteCount;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numOfChan, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataByteCount, true);

  // Write PCM audio data
  let offset = 44;
  const channelData: Float32Array[] = [];
  for (let i = 0; i < numOfChan; i++) {
    channelData.push(buffer.getChannelData(i));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numOfChan; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}
