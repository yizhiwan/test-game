"use client";

/**
 * Hotspot examine overlay.
 *
 * Awards evidence on the first look. The store decides what a hotspot yields
 * and whether it is still bolted shut; this component only reports the verdict.
 */

import { useEffect, useRef, useState } from "react";
import Typewriter from "./Typewriter";
import { play } from "@/lib/audio";
import { getHotspot } from "@/lib/caseData";
import { useGameStore } from "@/stores/gameStore";
import {
  selectActiveHotspot,
  selectExamineOpen,
  useUIStore,
} from "@/stores/uiStore";
import type { Evidence } from "@/lib/types";

interface Outcome {
  title: string;
  body: string;
  evidence?: Evidence;
  locked: boolean;
}

export default function ExamineModal() {
  const isOpen = useUIStore(selectExamineOpen);
  const hotspotId = useUIStore(selectActiveHotspot);
  const closeExamine = useUIStore((s) => s.closeExamine);
  const pushToast = useUIStore((s) => s.pushToast);

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Each hotspot must resolve exactly once per opening, even under StrictMode's
  // double-invoked effects, or a second call would report a repeat visit.
  const resolvedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !hotspotId) {
      resolvedFor.current = null;
      setOutcome(null);
      return;
    }
    if (resolvedFor.current === hotspotId) return;
    resolvedFor.current = hotspotId;

    const hotspot = getHotspot(hotspotId);
    if (!hotspot) return;

    const result = useGameStore.getState().examineHotspot(hotspotId);

    if (!result.ok) {
      setOutcome({ title: hotspot.label, body: result.message, locked: true });
      return;
    }

    if (result.evidence) {
      play("blip");
      pushToast(`EVIDENCE ACQUIRED: ${result.evidence.name}`, "success");
    }

    setOutcome({
      title: hotspot.label,
      body: hotspot.description,
      evidence: result.evidence,
      locked: false,
    });
  }, [isOpen, hotspotId, pushToast]);

  return (
    <>
      {isOpen && outcome ? (
        <div
          className="overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          onClick={closeExamine}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={outcome.title}
            className="dialog-in crt-overlay w-full max-w-lg rounded-lg border-2 border-neon-cyan bg-bg-panel/95 p-5 shadow-neon"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative z-10">
              <h2
                className={`mb-3 text-sm font-bold uppercase tracking-[0.3em] ${outcome.locked ? "text-blood-red" : "text-neon-cyan"}`}
              >
                {outcome.title}
              </h2>

              <div className="mb-4 min-h-[6rem] text-sm leading-relaxed text-white/80">
                <Typewriter text={outcome.body} speed={14} />
              </div>

              {outcome.evidence ? (
                <div className="mb-4 rounded border border-neon-green/60 bg-neon-green/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-neon-green">
                    Evidence acquired
                  </p>
                  <p className="mt-1 text-sm text-white">
                    <span aria-hidden="true">{outcome.evidence.icon}</span>{" "}
                    {outcome.evidence.name}
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={closeExamine}
                aria-label="Close examination"
                className="min-h-[44px] w-full rounded border border-neon-cyan/60 text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan transition hover:bg-neon-cyan hover:text-bg-deep focus:outline-none focus:ring-2 focus:ring-neon-cyan"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
