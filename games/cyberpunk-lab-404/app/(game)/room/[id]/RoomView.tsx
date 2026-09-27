"use client";

/**
 * Room view: the lab, its hotspots, and everyone willing to talk.
 *
 * Suspects unlock as the evidence that reaches them is collected, so the
 * portrait row doubles as a progress readout.
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ExamineModal from "@/components/ExamineModal";
import HotspotNode from "@/components/HotspotNode";
import InventoryDrawer from "@/components/InventoryDrawer";
import LabScene from "@/components/LabScene";
import TopBar from "@/components/TopBar";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { EVIDENCE, LAB_404, NPC_ROSTER, SUSPECT_LIST, getHotspot } from "@/lib/caseData";
import { play } from "@/lib/audio";
import { useGameStore } from "@/stores/gameStore";
import { useUIStore } from "@/stores/uiStore";
import type { HotspotId, NPCId } from "@/lib/types";

/** Aris talks from the start; everyone else is gated behind a clue. */
function unlockedNPCs(inventory: string[]): Set<NPCId> {
  const unlocked = new Set<NPCId>(["aris"]);
  for (const id of inventory) {
    const unlocks = EVIDENCE[id as keyof typeof EVIDENCE]?.unlocksNPC;
    if (unlocks) unlocked.add(unlocks);
  }
  return unlocked;
}

export default function RoomView() {
  const router = useRouter();
  const reduceMotion = useMotionPreference();
  const inventory = useGameStore((s) => s.inventory);
  const examined = useGameStore((s) => s.examinedHotspots);
  const openExamine = useUIStore((s) => s.openExamine);
  const toggleInventory = useUIStore((s) => s.toggleInventory);

  const unlocked = useMemo(() => unlockedNPCs(inventory), [inventory]);

  const onHotspot = (id: HotspotId) => {
    const hotspot = getHotspot(id);
    // The terminal is a screen of its own rather than a modal.
    if (hotspot?.navigatesTo) {
      router.push(hotspot.navigatesTo);
      return;
    }
    openExamine(id);
  };

  const onSuspect = (npcId: NPCId, available: boolean) => {
    if (!available) return;
    play("blip");
    router.push(`/room/lab404/dialogue/${npcId}`);
  };

  return (
    <main className="enter-fade relative flex min-h-dvh flex-col bg-bg-deep pt-14">
      <TopBar label="Lab 404" />

      {/* The scene */}
      <section className="crt-overlay relative mx-auto w-full max-w-4xl flex-1 px-3 py-4">
        <div className="relative aspect-[400/260] w-full overflow-hidden rounded-lg border border-neon-cyan/30">
          <LabScene />
          {LAB_404.map((hotspot) => (
            <HotspotNode
              key={hotspot.id}
              hotspot={hotspot}
              examined={examined.includes(hotspot.id)}
              onSelect={onHotspot}
            />
          ))}
        </div>
      </section>

      {/* Suspects */}
      <section
        aria-label="Suspects"
        className="mx-auto w-full max-w-4xl px-3 pb-28"
      >
        <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/35">
          Persons of interest
        </p>
        <ul className="grid grid-cols-3 gap-2">
          {SUSPECT_LIST.map((npc) => {
            const available = unlocked.has(npc.id);
            return (
              <li key={npc.id}>
                <button
                  type="button"
                  disabled={!available}
                  onClick={() => onSuspect(npc.id, available)}
                  aria-label={
                    available
                      ? `Interrogate ${npc.name}, ${npc.role}`
                      : `${npc.name} is not reachable yet`
                  }
                  className={[
                    "min-h-[44px] w-full rounded border p-3 text-center transition focus:outline-none focus:ring-2 focus:ring-neon-cyan",
                    available
                      ? "border-neon-cyan/50 bg-black/40 hover:border-neon-cyan hover:bg-neon-cyan/10"
                      : "cursor-not-allowed border-white/10 bg-black/20 opacity-40",
                  ].join(" ")}
                >
                  <span aria-hidden="true" className="block text-2xl">
                    {npc.avatar}
                  </span>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-white/80">
                    {npc.name.replace("Dr. ", "")}
                  </span>
                  <span className="block text-[9px] uppercase tracking-wider text-white/35">
                    {available ? npc.role : "Unreachable"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* NOVA floats separately: she is an ally, not a suspect. */}
      {unlocked.has("nova") ? (
        <motion.button
          type="button"
          onClick={() => onSuspect("nova", true)}
          aria-label="Talk to NOVA, netrunner hologram"
          animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          className="fixed bottom-24 left-3 z-30 flex min-h-[44px] items-center gap-2 rounded-full border border-neon-magenta/70 bg-neon-magenta/10 px-3 py-2 text-[10px] uppercase tracking-widest text-neon-magenta shadow-neon-magenta backdrop-blur focus:outline-none focus:ring-2 focus:ring-neon-magenta"
        >
          <span aria-hidden="true" className="text-lg">
            {NPC_ROSTER.nova.avatar}
          </span>
          Nova
        </motion.button>
      ) : null}

      {/* Inventory */}
      <button
        type="button"
        onClick={() => {
          play("blip");
          toggleInventory();
        }}
        aria-label="Open evidence inventory"
        className="fixed bottom-4 right-4 z-30 min-h-[44px] rounded-full border-2 border-neon-cyan bg-bg-panel/90 px-5 text-xs font-bold uppercase tracking-[0.2em] text-neon-cyan shadow-neon backdrop-blur transition hover:bg-neon-cyan hover:text-bg-deep focus:outline-none focus:ring-2 focus:ring-neon-cyan"
      >
        Inventory ({inventory.length}) &#x25BE;
      </button>

      <InventoryDrawer />
      <ExamineModal />
    </main>
  );
}
