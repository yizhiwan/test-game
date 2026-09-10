"use client";

/**
 * Corner notifications. Each toast clears itself after a few seconds.
 */

import { useEffect } from "react";
import { selectToasts, useUIStore } from "@/stores/uiStore";
import type { Toast } from "@/lib/types";

const TONE_CLASS: Record<Toast["tone"], string> = {
  info: "border-neon-cyan/70 text-neon-cyan",
  success: "border-neon-green/70 text-neon-green",
  danger: "border-blood-red/70 text-blood-red",
};

const LIFETIME_MS = 4000;

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useUIStore((s) => s.dismissToast);

  useEffect(() => {
    const id = setTimeout(() => dismiss(toast.id), LIFETIME_MS);
    return () => clearTimeout(id);
  }, [toast.id, dismiss]);

  return (
    <div
      className={`overlay-in pointer-events-auto rounded border bg-bg-panel/95 px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-neon backdrop-blur ${TONE_CLASS[toast.tone]}`}
    >
      {toast.message}
    </div>
  );
}

export default function ToastHost() {
  const toasts = useUIStore(selectToasts);

  return (
    <div
      className="pointer-events-none fixed right-3 top-16 z-[60] flex flex-col items-end gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
