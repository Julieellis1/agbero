// Hand-rolled WebAudio SFX — no assets needed.
import { S } from './state.js';

let ctx = null;
let ambienceNodes = null;

export function unlock() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function tone(freq, dur, type = 'sine', vol = 0.25, slideTo = null) {
  if (!ctx || S.muted) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  env(g, t0, 0.01, vol, dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0); o.stop(t0 + dur + 0.1);
}

function noise(dur, vol = 0.3, filterFreq = 1000) {
  if (!ctx || S.muted) return;
  const t0 = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = ctx.createGain(); env(g, t0, 0.005, vol, dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t0);
}

export const sfx = {
  tap() { tone(600, 0.06, 'square', 0.12); },
  cash() { tone(880, 0.08, 'sine', 0.2); setTimeout(() => tone(1320, 0.12, 'sine', 0.2), 70); },
  thump() { noise(0.15, 0.4, 300); tone(90, 0.15, 'sine', 0.35, 40); },
  smash() { noise(0.3, 0.5, 3000); tone(200, 0.2, 'sawtooth', 0.2, 60); },
  slap() { noise(0.08, 0.35, 2000); },
  horn() { tone(220, 0.5, 'sawtooth', 0.15, 180); tone(277, 0.5, 'sawtooth', 0.12, 230); },
  sms() { tone(1200, 0.07, 'square', 0.12); setTimeout(() => tone(900, 0.09, 'square', 0.12), 90); },
  stamp() { noise(0.12, 0.5, 500); },
  bad() { tone(220, 0.25, 'sawtooth', 0.2, 110); },
  good() { tone(523, 0.1, 'sine', 0.2); setTimeout(() => tone(659, 0.1, 'sine', 0.2), 90); setTimeout(() => tone(784, 0.18, 'sine', 0.2), 180); },
  engine() { tone(70, 0.8, 'sawtooth', 0.08, 120); },
};

export function startAmbience() {
  if (!ctx || ambienceNodes) return;
  try {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const g = ctx.createGain(); g.gain.value = 0.05;
    src.connect(f).connect(g).connect(ctx.destination); src.start();
    ambienceNodes = { src, g };
  } catch (e) {}
}

export function setMuted(m) {
  if (ambienceNodes) ambienceNodes.g.gain.value = m ? 0 : 0.05;
  if (musicBus) musicBus.gain.value = m ? 0 : 0.5;
}

// ---------- procedural Naija groove: original 2-bar Afrobeat loop, no samples ----------
let musicBus = null, musicTimer = null, mStep = 0, mNextT = 0;
const BPM = 100, STEPS = 32; // 2 bars of 16ths
const stepDur = () => 60 / BPM / 4;

const KICK = new Set([0, 7, 8, 14, 16, 23, 24, 30]);
const SNARE = new Set([4, 12, 20, 28]);
const SHAKER = new Set([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]);
const BASSN = { 0: 87.31, 3: 87.31, 6: 98.0, 10: 87.31, 12: 130.81, 16: 87.31, 19: 98.0, 22: 110.0, 26: 130.81, 28: 98.0 };
const STABN = { 2: [174.61, 220.0, 261.63, 329.63], 11: [174.61, 220.0, 261.63, 329.63], 18: [196.0, 246.94, 293.66], 27: [261.63, 329.63, 392.0] };

function mKick(t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.3);
}
function mNoiseBurst(t, dur, type, freq, vol) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(musicBus); src.start(t);
}
function mBass(t, f) { // log-drum-ish: pitch drop into a round sine
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
  g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.45);
}
function mStab(t, freqs) {
  for (const f of freqs) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.3);
  }
}

function scheduleStep(s, t) {
  if (KICK.has(s)) mKick(t);
  if (SNARE.has(s)) { mNoiseBurst(t, 0.16, 'bandpass', 1900, 0.28); }
  if (SHAKER.has(s)) mNoiseBurst(t, 0.05, 'highpass', 6500, s % 4 === 2 ? 0.11 : 0.06);
  if (BASSN[s]) mBass(t, BASSN[s]);
  if (STABN[s]) mStab(t, STABN[s]);
}

function musicTick() {
  if (!ctx) return;
  while (mNextT < ctx.currentTime + 0.3) {
    scheduleStep(mStep, mNextT);
    mNextT += stepDur();
    mStep = (mStep + 1) % STEPS;
  }
}

export function startMusic() {
  unlock();
  if (!ctx || musicTimer) return;
  musicBus = ctx.createGain();
  musicBus.gain.value = S.muted ? 0 : 0.5;
  musicBus.connect(ctx.destination);
  mStep = 0; mNextT = ctx.currentTime + 0.08;
  musicTimer = setInterval(musicTick, 90);
}

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  musicBus = null;
}
