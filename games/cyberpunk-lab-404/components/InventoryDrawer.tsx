"use client";

/**
 * Slide-up evidence drawer.
 */

import { EVIDENCE } from "@/lib/caseData";
import { selectInventory, useGameStore } from "@/stores/gameStore";
import { selectInventoryOpen, useUIStore } from "@/stores/uiStore";

export default function InventoryDrawer() {
  const isOpen = useUIStore(selectInventoryOpen);
  const setOpen = useUIStore((s) => s.setInventoryOpen);
  const inventory = useGameStore(selectInventory);

  return (
    <>
      {isOpen ? (
        <>
          <div
            className="overlay-in fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside
            className="drawer-in crt-overlay fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t-2 border-neon-cyan bg-bg-panel/95 p-4 pb-8"
            role="dialog"
            aria-label="Evidence inventory"
          >
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-neon-cyan">
                  Evidence
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close inventory"
                  className="min-h-[44px] min-w-[44px] rounded border border-white/20 px-3 text-xs uppercase tracking-widest text-white/70 transition hover:border-neon-magenta hover:text-neon-magenta focus:outline-none focus:ring-2 focus:ring-neon-cyan"
                >
                  Close
                </button>
              </div>

              {inventory.length === 0 ? (
                <p className="py-10 text-center text-xs uppercase tracking-[0.3em] text-white/30">
                  No evidence collected
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {inventory.map((id) => {
                    const item = EVIDENCE[id];
                    return (
                      <li
                        key={id}
                        className="rounded border border-neon-cyan/30 bg-black/40 p-3"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span aria-hidden="true" className="text-xl">
                            {item.icon}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-widest text-neon-green">
                            {item.name}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-white/60">
                          {item.desc}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
