"use client";

/**
 * The oxygen clock.
 *
 * Bills elapsed wall-clock time rather than counting interval fires, because
 * browsers throttle timers in background tabs and a naive one-second tick
 * would quietly gift the player minutes of air every time they switched away.
 * Hitting zero ends the run and sends them to the timeout ending.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  LOW_TIME_SECONDS,
  formatClock,
  selectEnding,
  selectTimeRemaining,
  useGameStore,
} from "@/stores/gameStore";

export default function Timer({ paused = false }: { paused?: boolean }) {
  const router = useRouter();
  const timeRemaining = useGameStore(selectTimeRemaining);
  const ending = useGameStore(selectEnding);
  const billedThrough = useRef<number | null>(null);

  const running = !paused && ending === null;

  useEffect(() => {
    if (!running) {
      billedThrough.current = null;
      return;
    }

    billedThrough.current = Date.now();

    const reconcile = () => {
      const now = Date.now();
      const last = billedThrough.current ?? now;
      const elapsed = Math.floor((now - last) / 1000);
      if (elapsed <= 0) return;
      // Carry the sub-second remainder so rounding never loses or gains time.
      billedThrough.current = last + elapsed * 1000;
      useGameStore.getState().tickTimer(elapsed);
    };

    const id = window.setInterval(reconcile, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") reconcile();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      billedThrough.current = null;
    };
  }, [running]);

  // Out of air: the store has already set the ending, this just moves the view.
  useEffect(() => {
    if (ending === "lose_time") router.replace("/ending/lose_time");
  }, [ending, router]);

  const critical = timeRemaining <= LOW_TIME_SECONDS;

  return (
    <div
      className={[
        "font-mono text-lg font-bold tabular-nums tracking-widest",
        critical ? "text-blood-red animate-pulse-neon" : "text-neon-cyan",
      ].join(" ")}
      role="timer"
      aria-live="off"
      aria-label={`Oxygen remaining ${formatClock(timeRemaining)}`}
    >
      {formatClock(timeRemaining)}
    </div>
  );
}
