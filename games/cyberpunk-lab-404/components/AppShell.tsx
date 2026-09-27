"use client";

/**
 * Client-side shell mounted once in the root layout.
 *
 * Rehydrates the persisted stores, mirrors the player's motion preference onto
 * <html> so the CSS kill-switch in globals.css can reach every animation, keeps
 * Howler in step with the mute toggle, and hosts the toast stack.
 */

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import ToastHost from "./ToastHost";
import { setMuted } from "@/lib/audio";
import { useStoreHydration } from "@/hooks/useStoreHydration";
import { selectMuted, selectReduceMotion, useUIStore } from "@/stores/uiStore";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useStoreHydration();

  const reduceMotion = useUIStore(selectReduceMotion);
  const muted = useUIStore(selectMuted);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    setMuted(muted);
  }, [muted]);

  // "never" keeps Motion from silently declining entry animations for
  // reduced-motion users, which would leave content stuck at opacity 0.
  // The preference is honoured explicitly by useMotionPreference and the CSS.
  return (
    <MotionConfig reducedMotion="never">
      {children}
      <ToastHost />
    </MotionConfig>
  );
}
