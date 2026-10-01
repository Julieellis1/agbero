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
}
