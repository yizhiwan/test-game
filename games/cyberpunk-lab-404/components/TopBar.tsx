"use client";

/**
 * Fixed heads-up bar: the clock, the room label, and the toggles.
 */

import { useEffect } from "react";
import Link from "next/link";
import Timer from "./Timer";
import { setMuted } from "@/lib/audio";
import {
  selectMuted,
  selectReduceMotion,
  useUIStore,
} from "@/stores/uiStore";

const BUTTON =
  "flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-white/15 px-2 text-xs uppercase tracking-widest text-white/70 transition hover:border-neon-cyan hover:text-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan";

export default function TopBar({ label = "LAB 404" }: { label?: string }) {
  const muted = useUIStore(selectMuted);
  const reduceMotion = useUIStore(selectReduceMotion);
  const toggleMute = useUIStore((s) => s.toggleMute);
  const toggleReduceMotion = useUIStore((s) => s.toggleReduceMotion);

  // Keep Howler in step with the persisted preference.
  useEffect(() => {
    setMuted(muted);
  }, [muted]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-2 border-b border-neon-cyan/20 bg-bg-deep/90 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-lg">
          &#x1F5FA;
        </span>
        <span className="hidden text-[10px] uppercase tracking-[0.3em] text-white/40 sm:inline">
          {label}
        </span>
      </div>

      <Timer />

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleReduceMotion}
          aria-pressed={reduceMotion}
          aria-label="Toggle reduced motion"
          className={BUTTON}
        >
          {reduceMotion ? "Motion off" : "Motion on"}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-pressed={muted}
          aria-label={muted ? "Unmute audio" : "Mute audio"}
          className={BUTTON}
        >
          <span aria-hidden="true">{muted ? "\u{1F507}" : "\u{1F50A}"}</span>
        </button>
        <Link
          href="/"
          aria-label="Abandon the case and return to the title screen"
          className={BUTTON}
        >
          Menu
        </Link>
      </div>
    </header>
  );
}
