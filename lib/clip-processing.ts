export type ClipChannel = 'mix' | 'left' | 'right';
export type ClipFilter = 'original' | 'rumble' | 'hiss' | 'both';
export type ClipSettings = { start: number; speed: number; normalize: boolean; channel: ClipChannel; filter: ClipFilter };
export const DEFAULT_CLIP_SETTINGS: ClipSettings = { start: 0, speed: 1, normalize: false, channel: 'mix', filter: 'original' };
export const CLIP_RATE = 22050;

type AudioSource = { duration: number; sampleRate: number; length: number; numberOfChannels: number; getChannelData: (channel: number) => Float32Array };

export function clipWindow(audio: AudioSource, start: number, speed: number, seconds = 12) {
  if (!Number.isFinite(start) || start < 0 || start >= audio.duration || !Number.isFinite(speed) || speed < .65 || speed > 1.35 || !Number.isFinite(seconds) || seconds < 2 || seconds > 12) {
    throw new Error('Choose a valid start time and a 2–12 second section.');
  }
  const duration = Math.min(seconds, (audio.duration - start) / speed);
  if (duration < 2 - 1 / CLIP_RATE) throw new Error('Move the start time earlier so there are at least 2 seconds to identify.');
  return { duration: Math.max(2, duration), startFrame: Math.floor(start * audio.sampleRate), endFrame: Math.min(audio.length, Math.ceil((start + duration * speed) * audio.sampleRate)) };
}

export function selectChannel(channels: Float32Array[], channel: ClipChannel) {
  if (!channels.length || !['mix', 'left', 'right'].includes(channel)) throw new Error('Choose an available audio channel.');
  if (channel === 'right' && channels.length < 2) throw new Error('This recording only has one audio channel.');
  const selected = channel === 'mix' ? channels : [channels[channel === 'right' ? 1 : 0]];
  const samples = new Float32Array(selected[0].length);
  for (const data of selected) {
    if (data.length !== samples.length) throw new Error('The audio channels have different lengths.');
    for (let i = 0; i < samples.length; i++) samples[i] += data[i] / selected.length;
  }
  return samples;
}

export function signalStats(samples: Float32Array) {
  let peak = 0, energy = 0, clipped = 0;
  for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; if (Math.abs(sample) >= .999) clipped++; }
  return { peak, rms: Math.sqrt(energy / Math.max(1, samples.length)), clippedFraction: clipped / Math.max(1, samples.length) };
}

export function inspectClip(audio: AudioSource, settings: ClipSettings) {
  const window = clipWindow(audio, settings.start, settings.speed);
  const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i).subarray(window.startFrame, window.endFrame));
  const channelStats = channels.map(signalStats);
  const mixed = selectChannel(channels, 'mix');
  const mixStats = signalStats(mixed);
  const selected = settings.channel === 'mix' ? mixStats : channelStats[settings.channel === 'right' ? 1 : 0];
  if (!selected) throw new Error('Choose an available audio channel.');
  const strongest = Math.max(...channelStats.map(s => s.rms));
  const cancellation = channels.length === 2 && strongest > .005 && mixStats.rms < strongest * .18;
  return {
    ...selected, duration: window.duration, cancellation,
    suggestedChannel: (channelStats[1]?.rms > channelStats[0].rms ? 'right' : 'left') as ClipChannel,
    silent: selected.peak < .00005,
    quiet: selected.rms < .006,
    clipped: selected.clippedFraction > .005,
  };
}

// Butterworth low/high-pass biquads, using the W3C Audio EQ Cookbook formulae:
// https://www.w3.org/TR/audio-eq-cookbook/ . Process only the short rendered clip.
function biquad(samples: Float32Array, sampleRate: number, frequency: number, highpass: boolean) {
  const omega = 2 * Math.PI * frequency / sampleRate, cosine = Math.cos(omega), alpha = Math.sin(omega) / Math.SQRT2;
  const a0 = 1 + alpha, a1 = -2 * cosine / a0, a2 = (1 - alpha) / a0;
  const b0 = (highpass ? 1 + cosine : 1 - cosine) / (2 * a0), b1 = (highpass ? -(1 + cosine) : 1 - cosine) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i], y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    samples[i] = y; x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
}

export function processClip(samples: Float32Array, filter: ClipFilter, normalize: boolean, sampleRate = CLIP_RATE) {
  if (!['original', 'rumble', 'hiss', 'both'].includes(filter) || !Number.isFinite(sampleRate) || sampleRate < 16000) throw new Error('Choose a supported audio filter.');
  const output = new Float32Array(samples);
  if (filter === 'rumble' || filter === 'both') biquad(output, sampleRate, 120, true);
  if (filter === 'hiss' || filter === 'both') biquad(output, sampleRate, 6000, false);
  const beforeGain = signalStats(output);
  // Bound boost and attenuate filter overshoot before PCM encoding.
  const gain = beforeGain.peak > 0 ? (normalize ? Math.min(5, .94 / beforeGain.peak) : filter === 'original' ? 1 : Math.min(1, .99 / beforeGain.peak)) : 1;
  if (gain !== 1) for (let i = 0; i < output.length; i++) output[i] *= gain;
  return { samples: output, gain, ...signalStats(output) };
}

export function encodeClipWav(samples: Float32Array): Blob {
  const bytes = new ArrayBuffer(44 + samples.length * 2), view = new DataView(bytes);
  const write = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, CLIP_RATE, true);
  view.setUint32(28, CLIP_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const sample = Math.max(-1, Math.min(1, samples[i])); view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true); }
  return new Blob([bytes], { type: 'audio/wav' });
}

export function clipDownloadName(filename: string, settings: ClipSettings) {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'recording';
  return `${base}-${settings.start.toFixed(1)}s-${settings.speed.toFixed(2)}x-prepared.wav`;
}
