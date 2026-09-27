/**
 * Synthesised sound: every effect is built from oscillators and noise at
 * runtime, so the game ships no audio files. Browsers only allow audio after
 * a user gesture, so the context is created lazily on the first click/key.
 */

const MUTE_KEY = 'abyss.muted';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambience: { stop: () => void } | null = null;
let muted = readMuted();
const listeners = new Set<(m: boolean) => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master! };
}

// Unlock on the first gesture anywhere.
for (const ev of ['pointerdown', 'keydown']) {
  window.addEventListener(ev, () => audio(), { once: true, capture: true });
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    // Not remembered; still applies now.
  }
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.05);
  listeners.forEach((l) => l(m));
}

export function onMuteChange(l: (m: boolean) => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number; delay?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + (opts.delay ?? 0);
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(dur: number, opts: { gain?: number; freq?: number; q?: number; delay?: number; to?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + (opts.delay ?? 0);
  const buf = a.ctx.createBuffer(1, Math.ceil(a.ctx.sampleRate * dur), a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(opts.freq ?? 800, t);
  if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  filter.Q.value = opts.q ?? 1;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(opts.gain ?? 0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(a.out);
  src.start(t);
}

export const sfx = {
  click: () => tone(900, 0.05, { type: 'square', gain: 0.08 }),
  taskDone: () => {
    tone(660, 0.18, { gain: 0.2 });
    tone(990, 0.3, { gain: 0.2, delay: 0.1 });
  },
  kill: () => {
    noise(0.5, { gain: 0.7, freq: 300, to: 80, q: 0.7 });
    tone(110, 0.6, { type: 'sawtooth', gain: 0.25, to: 40 });
  },
  meeting: () => {
    for (let i = 0; i < 3; i++) {
      tone(880, 0.22, { type: 'square', gain: 0.18, delay: i * 0.45 });
      tone(660, 0.22, { type: 'square', gain: 0.18, delay: i * 0.45 + 0.22 });
    }
  },
  klaxon: () => tone(420, 0.45, { type: 'sawtooth', gain: 0.16, to: 300 }),
  lightsOut: () => tone(440, 1.1, { type: 'sawtooth', gain: 0.2, to: 40 }),
  fixed: () => {
    tone(523, 0.15, { gain: 0.2 });
    tone(784, 0.35, { gain: 0.2, delay: 0.12 });
  },
  vent: () => noise(0.45, { gain: 0.5, freq: 1800, to: 300, q: 2 }),
  eject: () => tone(600, 1.6, { type: 'triangle', gain: 0.25, to: 60 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { gain: 0.18, delay: i * 0.12 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.6, { type: 'triangle', gain: 0.2, delay: i * 0.18 })),
  roleReveal: (mimic: boolean) =>
    mimic ? tone(110, 1.4, { type: 'sawtooth', gain: 0.25, to: 70 }) : tone(330, 1.2, { type: 'triangle', gain: 0.2, to: 440 }),
};

/** Low hull hum with occasional sonar pings, while a round is running. */
export function startAmbience(): void {
  const a = audio();
  if (!a || ambience) return;
  const hum = a.ctx.createOscillator();
  const lfo = a.ctx.createOscillator();
  const lfoGain = a.ctx.createGain();
  const g = a.ctx.createGain();
  hum.type = 'sine';
  hum.frequency.value = 55;
  lfo.frequency.value = 0.15;
  lfoGain.gain.value = 0.025;
  g.gain.value = 0.05;
  lfo.connect(lfoGain).connect(g.gain);
  hum.connect(g).connect(a.out);
  hum.start();
  lfo.start();
  const ping = setInterval(() => {
    if (Math.random() < 0.5) tone(1400, 1.2, { gain: 0.05, to: 1380 });
  }, 7000);
  ambience = {
    stop: () => {
      clearInterval(ping);
      g.gain.setTargetAtTime(0, a.ctx.currentTime, 0.3);
      hum.stop(a.ctx.currentTime + 1.5);
      lfo.stop(a.ctx.currentTime + 1.5);
    },
  };
}

export function stopAmbience(): void {
  ambience?.stop();
  ambience = null;
}
