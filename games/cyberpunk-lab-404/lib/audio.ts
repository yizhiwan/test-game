/**
 * Sound for CYBERPUNK LAB 404, built on Howler.
 *
 * No audio files ship with the repo, so every cue has a synthesized WebAudio
 * fallback. Drop real files into `public/audio/` using the names in SOURCES
 * below and Howler picks them up automatically; until then the game still
 * clicks, alarms and hums rather than running silent.
 *
 * Everything here is browser-only and lazily constructed, so importing this
 * module during a server render does nothing.
 */

import { Howl, Howler } from "howler";

export type Cue = "ambient" | "blip" | "alarm" | "glitch";

/** Expected file locations. Missing files fall back to synthesis. */
const SOURCES: Record<Cue, string> = {
  ambient: "/audio/ambient.mp3",
  blip: "/audio/blip.mp3",
  alarm: "/audio/alarm.mp3",
  glitch: "/audio/glitch.mp3",
};

const VOLUMES: Record<Cue, number> = {
  ambient: 0.25,
  blip: 0.4,
  alarm: 0.5,
  glitch: 0.35,
};

const howls = new Map<Cue, Howl>();
const unavailable = new Set<Cue>();
let muted = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function getHowl(cue: Cue): Howl | null {
  if (!isBrowser() || unavailable.has(cue)) return null;

  const existing = howls.get(cue);
  if (existing) return existing;

  const howl = new Howl({
    src: [SOURCES[cue]],
    loop: cue === "ambient",
    volume: VOLUMES[cue],
    html5: cue === "ambient",
    preload: true,
    onloaderror: () => {
      // No asset on disk. Stop trying and let the synth cover this cue.
      unavailable.add(cue);
      howls.delete(cue);
    },
  });

  howls.set(cue, howl);
  return howl;
}

/* ── Synthesized fallbacks ─────────────────────────────────── */

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (!isBrowser()) return null;
  if (ctx) return ctx;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  return ctx;
}

/** A short shaped tone, enough to read as a UI cue. */
function synth(cue: Cue): void {
  const context = audioContext();
  if (!context || muted) return;
  if (context.state === "suspended") void context.resume();

  const now = context.currentTime;
  const osc = context.createOscillator();
  const gain = context.createGain();

  const shape: Record<Cue, { type: OscillatorType; from: number; to: number; secs: number; peak: number }> = {
    blip: { type: "square", from: 880, to: 1320, secs: 0.07, peak: 0.12 },
    alarm: { type: "sawtooth", from: 320, to: 180, secs: 0.55, peak: 0.2 },
    glitch: { type: "square", from: 1400, to: 220, secs: 0.18, peak: 0.14 },
    ambient: { type: "sine", from: 110, to: 110, secs: 0.001, peak: 0 },
  };

  const { type, from, to, secs, peak } = shape[cue];
  if (peak === 0) return; // Ambient has no synth stand-in; silence is fine.

  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), now + secs);

  gain.gain.setValueAtTime(peak, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + secs);

  osc.connect(gain).connect(context.destination);
  osc.start(now);
  osc.stop(now + secs + 0.02);
}

/* ── Public API ────────────────────────────────────────────── */

/** Fire a one-shot cue. */
export function play(cue: Cue): void {
  if (!isBrowser() || muted) return;

  const howl = getHowl(cue);
  if (howl && howl.state() === "loaded") {
    howl.play();
    return;
  }
  synth(cue);
}

/** Start the ambient loop. Safe to call repeatedly. */
export function startAmbient(): void {
  const howl = getHowl("ambient");
  if (!howl || howl.playing()) return;
  howl.play();
}

/** Stop the ambient loop, e.g. on an ending screen. */
export function stopAmbient(): void {
  const howl = howls.get("ambient");
  howl?.stop();
}

/** Mute or unmute everything, Howler and synth alike. */
export function setMuted(next: boolean): void {
  muted = next;
  if (isBrowser()) Howler.mute(next);
}

export function isMuted(): boolean {
  return muted;
}

export const audio = {
  play,
  startAmbient,
  stopAmbient,
  setMuted,
  isMuted,
};
