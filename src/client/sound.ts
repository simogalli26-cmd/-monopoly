import { loadPref, savePref } from './profile';

let ctx: AudioContext | null = null;
let enabled = loadPref('sound', '1') === '1';

export const isSoundOn = () => enabled;
export function setSound(on: boolean) {
  enabled = on;
  savePref('sound', on ? '1' : '0');
}

function tone(freq: number, dur = 0.08, type: OscillatorType = 'sine', gain = 0.06, delay = 0) {
  if (!enabled) return;
  try {
    ctx ||= new AudioContext();
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    /* audio not available */
  }
}

export const sfx = {
  dice: () => [0, 0.05, 0.1, 0.16, 0.22].forEach((d) => tone(180 + Math.random() * 220, 0.04, 'square', 0.03, d)),
  step: () => tone(520, 0.04, 'triangle', 0.035),
  cash: () => [660, 880, 1320].forEach((f, i) => tone(f, 0.09, 'sine', 0.05, i * 0.07)),
  pay: () => [440, 330].forEach((f, i) => tone(f, 0.1, 'sawtooth', 0.03, i * 0.08)),
  turn: () => [523, 659, 784].forEach((f, i) => tone(f, 0.12, 'sine', 0.05, i * 0.09)),
  card: () => [392, 523].forEach((f, i) => tone(f, 0.1, 'triangle', 0.05, i * 0.08)),
  build: () => [300, 600].forEach((f, i) => tone(f, 0.07, 'square', 0.03, i * 0.06)),
  bid: () => tone(990, 0.06, 'triangle', 0.04),
  jail: () => [300, 250, 200].forEach((f, i) => tone(f, 0.15, 'sawtooth', 0.03, i * 0.12)),
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.16, 'sine', 0.06, i * 0.12)),
  chat: () => tone(1200, 0.05, 'sine', 0.025),
  error: () => tone(160, 0.15, 'square', 0.03),
};
