import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const output = resolve('.sites-runtime/clip-tests');
mkdirSync(output, { recursive: true });
for (const name of ['clip-processing', 'contracts']) {
  writeFileSync(`${output}/${name}.mjs`, ts.transpileModule(readFileSync(`lib/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
}
const { CLIP_RATE, DEFAULT_CLIP_SETTINGS, clipWindow, selectChannel, signalStats, inspectClip, processClip, encodeClipWav, clipDownloadName } = await import(pathToFileURL(`${output}/clip-processing.mjs`));
const { parsePCM } = await import(pathToFileURL(`${output}/contracts.mjs`));
const tone = (frequency, amplitude = .25, seconds = 3) => Float32Array.from({ length: CLIP_RATE * seconds }, (_, i) => amplitude * Math.sin(2 * Math.PI * frequency * i / CLIP_RATE));
const audio = (...channels) => ({ sampleRate: CLIP_RATE, length: channels[0].length, duration: channels[0].length / CLIP_RATE, numberOfChannels: channels.length, getChannelData: i => channels[i] });
const rms = samples => signalStats(samples.subarray(1000)).rms;

test('clip windows stay inside the source and reject invalid/too-short edits', () => {
  const source = audio(tone(440, .25, 20));
  assert.equal(clipWindow(source, 0, 1).duration, 12);
  const window = clipWindow(source, 17.4, 1.3);
  assert.ok(Math.abs(window.duration - 2) < 1 / CLIP_RATE);
  assert.equal(window.endFrame, source.length);
  assert.throws(() => clipWindow(source, 19, 1));
  for (const value of [NaN, Infinity, -1, 20]) assert.throws(() => clipWindow(source, value, 1));
  for (const speed of [0, NaN, 2]) assert.throws(() => clipWindow(source, 0, speed));
});

test('opposite stereo channels cancel in a mix but remain recoverable independently', () => {
  const left = tone(440), right = Float32Array.from(left, n => -n);
  const source = audio(left, right), mixed = inspectClip(source, DEFAULT_CLIP_SETTINGS);
  assert.equal(mixed.cancellation, true);
  assert.equal(mixed.silent, true);
  assert.ok(signalStats(selectChannel([left, right], 'left')).rms > .1);
  assert.equal(inspectClip(source, { ...DEFAULT_CLIP_SETTINGS, channel: 'right' }).silent, false);
  assert.deepEqual(left, tone(440), 'channel selection never mutates original samples');
  assert.throws(() => selectChannel([left], 'right'));
});

test('source checks distinguish silence, quiet sound, clipping and a normal tone', () => {
  assert.equal(inspectClip(audio(new Float32Array(CLIP_RATE * 3)), DEFAULT_CLIP_SETTINGS).silent, true);
  assert.equal(inspectClip(audio(tone(440, .001)), DEFAULT_CLIP_SETTINGS).quiet, true);
  const clean = inspectClip(audio(tone(440)), DEFAULT_CLIP_SETTINGS);
  assert.equal(clean.silent, false); assert.equal(clean.quiet, false); assert.equal(clean.clipped, false);
  const clipped = Float32Array.from(tone(440, 2), n => Math.max(-1, Math.min(1, n)));
  assert.equal(inspectClip(audio(clipped), DEFAULT_CLIP_SETTINGS).clipped, true);
});

test('rumble filtering attenuates low-frequency interference while retaining midrange', () => {
  const bass = tone(30), music = tone(1000);
  assert.ok(rms(processClip(bass, 'rumble', false).samples) < rms(bass) * .1);
  assert.ok(rms(processClip(music, 'rumble', false).samples) > rms(music) * .97);
});

test('hiss filtering attenuates high frequencies while retaining midrange', () => {
  const hiss = tone(10000), music = tone(1000);
  assert.ok(rms(processClip(hiss, 'hiss', false).samples) < rms(hiss) * .1);
  assert.ok(rms(processClip(music, 'hiss', false).samples) > rms(music) * .97);
  const combined = processClip(music, 'both', false);
  assert.ok(rms(combined.samples) > rms(music) * .95);
  assert.ok(combined.samples.every(Number.isFinite));
});

test('gain stays bounded, silence remains finite, and filtering preserves the source', () => {
  const source = tone(440, .001), copy = new Float32Array(source);
  const boosted = processClip(source, 'original', true);
  assert.equal(boosted.gain, 5); assert.ok(boosted.peak <= .00501);
  assert.deepEqual(source, copy);
  const loud = processClip(tone(440, 2), 'both', true);
  assert.ok(loud.peak < .941);
  const silent = processClip(new Float32Array(100), 'both', true);
  assert.equal(silent.peak, 0); assert.equal(silent.gain, 1);
  assert.deepEqual(processClip(tone(440), 'original', false).samples, tone(440));
});

test('downloaded processed WAV meets the real recognition handler format', async () => {
  for (const filter of ['original', 'rumble', 'hiss', 'both']) {
    const blob = encodeClipWav(processClip(tone(440), filter, true).samples);
    assert.equal(blob.type, 'audio/wav');
    assert.equal(parsePCM(await blob.arrayBuffer()), 3);
  }
  const filename = clipDownloadName('../../My <video>.mp4', { ...DEFAULT_CLIP_SETTINGS, start: 12.5, speed: .8 });
  assert.equal(filename, 'My-video-12.5s-0.80x-prepared.wav');
});
