"use client";

/**
 * Title screen.
 *
 * Rain and particle positions are derived from the index rather than
 * Math.random, so the server and client render the same markup and React does
 * not tear the tree down on hydration.
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Typewriter from "@/components/Typewriter";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { CASE_FILE } from "@/lib/caseData";
import { play, startAmbient } from "@/lib/audio";
import { useGameStore } from "@/stores/gameStore";
import { useNPCStore } from "@/stores/npcStore";

const BRIEFING = [
  `SUBJECT: ${CASE_FILE.victim}`,
  `STATUS: ${CASE_FILE.status}`,
  `LOCATION: ${CASE_FILE.location}`,
  `CLIENT: ${CASE_FILE.client}`,
  "DEADLINE: 60:00 minutes",
].join("\n");

/**
 * Deterministic pseudo-random in [0, 1), rounded to three decimals.
 *
 * The rounding matters: React serializes a full-precision float into the
 * server HTML differently from how the browser reflects it back, which shows
 * up as a hydration mismatch on every streak. Fixed precision makes both
 * sides agree byte for byte.
 */
function seeded(index: number, salt: number): number {
  const raw =
    (((Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453) % 1) + 1) % 1;
  return Math.round(raw * 1000) / 1000;
}

function Rain() {
  const streaks = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: (seeded(i, 1) * 100).toFixed(2),
        delay: (seeded(i, 2) * 4).toFixed(2),
        duration: (1.1 + seeded(i, 3) * 1.6).toFixed(2),
        opacity: (0.2 + seeded(i, 4) * 0.5).toFixed(2),
      })),
    [],
  );

  return (
    <div className="rain-layer" aria-hidden="true">
      {streaks.map((streak, i) => (
        <span
          key={i}
          className="rain-streak"
          style={{
            left: `${streak.left}%`,
            animationDelay: `${streak.delay}s`,
            animationDuration: `${streak.duration}s`,
            opacity: streak.opacity,
          }}
        />
      ))}
    </div>
  );
}

function Particles() {
  const dots = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: (seeded(i, 11) * 100).toFixed(2),
        top: (seeded(i, 12) * 100).toFixed(2),
        size: (2 + seeded(i, 13) * 3).toFixed(2),
        delay: (seeded(i, 14) * 5).toFixed(2),
        duration: (5 + seeded(i, 15) * 6).toFixed(2),
      })),
    [],
  );

  return (
    <div className="rain-layer" aria-hidden="true">
      {dots.map((dot, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: `${dot.left}%`,
            top: `${dot.top}%`,
            width: `${dot.size}px`,
            height: `${dot.size}px`,
            animationDelay: `${dot.delay}s`,
            animationDuration: `${dot.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function TitleScreen() {
  const router = useRouter();
  const reduceMotion = useMotionPreference();

  const begin = () => {
    play("blip");
    startAmbient();
    useNPCStore.getState().resetAll();
    useGameStore.getState().startGame();
    router.push("/room/lab404");
  };

  return (
    <main className="crt-overlay relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-bg-deep px-4 py-10">
      {/* Neon wash behind everything */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 20% 15%, rgba(0,240,255,0.16), transparent 70%), radial-gradient(55% 45% at 82% 78%, rgba(255,0,170,0.16), transparent 70%)",
        }}
      />
      <Rain />
      <Particles />

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center">
        <h1
          className="enter-fade animate-glitch text-center text-5xl font-black tracking-[0.15em] text-neon-cyan sm:text-7xl"
          style={{ textShadow: "0 0 18px rgba(0,240,255,0.55)" }}
        >
          LAB 404
        </h1>

        <p className="mt-3 text-center text-[10px] uppercase tracking-[0.35em] text-neon-magenta sm:text-xs">
          {CASE_FILE.tower} // CASE FILE {CASE_FILE.id}
        </p>

        <section
          aria-label="Case briefing"
          className="enter-rise enter-delay-1 mt-8 w-full rounded-lg border border-neon-cyan/60 bg-white/[0.04] p-5 shadow-neon backdrop-blur-md"
        >
          <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-white/40">
            Briefing
          </p>
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-neon-green sm:text-sm">
            <Typewriter text={BRIEFING} speed={16} startDelay={400} />
          </pre>
        </section>

        <motion.button
          type="button"
          onClick={begin}
          aria-label="Initiate investigation and enter Lab 404"
          whileTap={reduceMotion ? undefined : { scale: 0.95 }}
          whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          className="group enter-rise enter-delay-2 mt-8 min-h-[56px] w-full rounded border-2 border-neon-cyan bg-neon-cyan/10 px-6 text-sm font-bold uppercase tracking-[0.25em] text-neon-cyan shadow-neon transition-colors animate-pulse-neon hover:border-neon-magenta hover:bg-neon-magenta/15 hover:text-neon-magenta focus:outline-none focus:ring-2 focus:ring-neon-cyan focus:ring-offset-2 focus:ring-offset-bg-deep"
        >
          [ Initiate Investigation ]
        </motion.button>
      </div>

      <footer className="relative z-10 mt-10 text-[9px] uppercase tracking-[0.4em] text-white/25">
        v1.0 // Anthropic-Powered
      </footer>
    </main>
  );
}
