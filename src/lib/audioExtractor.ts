// Decoding audio in the browser keeps uploads tiny (16kHz mono WAV ≈ 1.9MB/min),
// but full decode holds the whole track in memory, so only do it for clips that
// are short enough to be safe on phones. Longer videos go to the server as-is,
// where ffmpeg extracts the audio.
const SAFE_DECODE_SECONDS = 180;
const LARGE_FILE_DECODE_SECONDS = 900;
const LARGE_FILE_BYTES = 200 * 1024 * 1024;

export async function prepareUpload(
  media: Blob,
  durationSec?: number
): Promise<{ blob: Blob; filename: string }> {
  const ext = media.type.includes('webm') ? 'webm' : media.type.includes('quicktime') ? 'mov' : 'mp4';
  const original = { blob: media, filename: `upload.${ext}` };

  if (media.type.startsWith('audio/')) {
    const audioExt = media.type.split('/')[1]?.split(';')[0].replace('mpeg', 'mp3') || 'mp3';
    return { blob: media, filename: `upload_audio.${audioExt}` };
  }
  if (media.size < 4 * 1024 * 1024) return original; // already small

  const limit = media.size > LARGE_FILE_BYTES ? LARGE_FILE_DECODE_SECONDS : SAFE_DECODE_SECONDS;
  if (!durationSec || durationSec > limit) return original;

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx || typeof OfflineAudioContext === 'undefined') return original;

  let ctx: AudioContext | null = null;
  try {
    ctx = new AudioCtx();
    const decoded = await ctx.decodeAudioData(await media.arrayBuffer());
    const rate = 16000;
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    return { blob: encodeWav(rendered), filename: 'upload_audio.wav' };
  } catch {
    return original;
  } finally {
    ctx?.close().catch(() => {});
  }
}

function encodeWav(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0, o = 44; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}
