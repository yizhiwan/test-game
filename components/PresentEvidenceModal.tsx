"use client";

/**
 * Evidence picker for an interrogation.
 *
 * Two steps on purpose: choosing an item then confirming it, because slapping
 * the wrong file on the table costs trust and the player should feel the
 * commitment before it happens.
 */

import { useState } from "react";
import { EVIDENCE, NPC_ROSTER } from "@/lib/caseData";
import { play } from "@/lib/audio";
import { selectInventory, useGameStore } from "@/stores/gameStore";
import type { EvidenceId, NPCId } from "@/lib/types";

export interface PresentEvidenceModalProps {
  npcId: NPCId;
  open: boolean;
  onClose: () => void;
  /** Fires with the chosen evidence once the player confirms. */
  onConfirm: (evidenceId: EvidenceId) => void;
}

export default function PresentEvidenceModal({
  npcId,
  open,
  onClose,
  onConfirm,
}: PresentEvidenceModalProps) {
  const inventory = useGameStore(selectInventory);
  const [selected, setSelected] = useState<EvidenceId | null>(null);

  const npc = NPC_ROSTER[npcId];
  const chosen = selected ? EVIDENCE[selected] : null;

  const close = () => {
    setSelected(null);
    onClose();
  };

  return (
    <>
      {open ? (
        <div
          className="overlay-in fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Present evidence"
            className="dialog-in w-full max-w-lg rounded-lg border-2 border-neon-magenta bg-bg-panel/95 p-5 shadow-neon-magenta"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.3em] text-neon-magenta">
              Present evidence
            </h2>

            {inventory.length === 0 ? (
              <p className="py-8 text-center text-xs uppercase tracking-[0.3em] text-white/30">
                No evidence collected
              </p>
            ) : (
              <ul className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {inventory.map((id) => {
                  const item = EVIDENCE[id];
                  const active = selected === id;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          play("blip");
                          setSelected(id);
                        }}
                        className={[
                          "min-h-[44px] w-full rounded border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-neon-magenta",
                          active
                            ? "border-neon-magenta bg-neon-magenta/15"
                            : "border-white/15 bg-black/40 hover:border-neon-magenta/60",
                        ].join(" ")}
                      >
                        <span className="block text-xs font-bold uppercase tracking-widest text-neon-green">
                          <span aria-hidden="true">{item.icon}</span> {item.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {chosen ? (
              <div className="mb-4 rounded border border-neon-magenta/50 bg-black/50 p-3">
                <p className="text-sm text-white">
                  Present {chosen.name} to {npc.name}?
                </p>
                <p className="mt-1 text-xs text-white/50">
                  Showing the wrong file will cost you.
                </p>
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={close}
                aria-label="Cancel presenting evidence"
                className="min-h-[44px] flex-1 rounded border border-white/20 text-xs font-bold uppercase tracking-[0.2em] text-white/70 transition hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-neon-cyan"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selected}
                onClick={() => {
                  if (!selected) return;
                  play("blip");
                  onConfirm(selected);
                  setSelected(null);
                }}
                aria-label="Confirm and present this evidence"
                className="min-h-[44px] flex-1 rounded border border-neon-magenta bg-neon-magenta/15 text-xs font-bold uppercase tracking-[0.2em] text-neon-magenta transition hover:bg-neon-magenta hover:text-bg-deep focus:outline-none focus:ring-2 focus:ring-neon-magenta disabled:cursor-not-allowed disabled:opacity-30"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
