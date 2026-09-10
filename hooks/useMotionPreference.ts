"use client";

/**
 * Whether animation should be suppressed.
 *
 * The operating system preference cannot be consulted during the first render:
 * the server has no media queries, so branching on it there and on the client
 * produces different markup and React refuses to patch the difference. So the
 * first render sees only the in-game toggle, which is `false` on both sides,
 * and the OS preference folds in after mount.
 *
 * Motion is configured with `reducedMotion="never"` in AppShell precisely so
 * that entry animations always run to completion. Reduced motion is honoured
 * deliberately here and in the CSS kill-switch instead, because an element
 * whose only route to `opacity: 1` is an animation the library declined to run
 * never becomes visible at all.
 */

import { useEffect, useState } from "react";
import { selectReduceMotion, useUIStore } from "@/stores/uiStore";

export function useMotionPreference(): boolean {
  const playerPrefers = useUIStore(selectReduceMotion);
  const [systemPrefers, setSystemPrefers] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystemPrefers(query.matches);

    const onChange = (event: MediaQueryListEvent) =>
      setSystemPrefers(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return playerPrefers || systemPrefers;
}
