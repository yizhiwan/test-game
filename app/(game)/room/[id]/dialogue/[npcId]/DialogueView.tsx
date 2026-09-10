"use client";

/**
 * Interrogation view.
 *
 * Stacks on mobile (suspect on top, transcript below) and splits 40/60 on
 * desktop. The transcript is the NPC store's history, so a refresh mid-case
 * brings the conversation back with it.
 */

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ChatBubble from "@/components/ChatBubble";
import ChatInput from "@/components/ChatInput";
import PresentEvidenceModal from "@/components/PresentEvidenceModal";
import SuspicionMeter from "@/components/SuspicionMeter";
import TopBar from "@/components/TopBar";
import TrustMeter from "@/components/TrustMeter";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { EVIDENCE, NPC_ROSTER, isNPCId } from "@/lib/caseData";
import { play } from "@/lib/audio";
import { useNPCStream } from "@/hooks/useNPCStream";
import { selectInventory, useGameStore } from "@/stores/gameStore";
import { useNPCStore } from "@/stores/npcStore";
import { useUIStore } from "@/stores/uiStore";
import type { EvidenceId, NPCId } from "@/lib/types";

/** Below this a suspect is visibly coming apart. */
const GLITCH_TRUST = 30;

export default function DialogueView() {
  const params = useParams<{ id: string; npcId: string }>();
  const router = useRouter();

  const rawId = params?.npcId ?? "";
  const npcId = (isNPCId(rawId) ? rawId : "aris") as NPCId;
  const npc = NPC_ROSTER[npcId];

  const state = useNPCStore((s) => s.npcs[npcId]);
  const inventory = useGameStore(selectInventory);
  const setPresentingEvidence = useUIStore((s) => s.setPresentingEvidence);

  const { sendMessage, isStreaming, error } = useNPCStream();
  const reduceMotion = useMotionPreference();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [alarmGlitch, setAlarmGlitch] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const alibiWasBroken = useRef(state.alibiBroken);

  // Follow the conversation as it grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.history]);

  // A freshly broken alibi tears the portrait up for a moment.
  useEffect(() => {
    if (state.alibiBroken && !alibiWasBroken.current) {
      setAlarmGlitch(true);
      const id = setTimeout(() => setAlarmGlitch(false), 800);
      return () => clearTimeout(id);
    }
    alibiWasBroken.current = state.alibiBroken;
  }, [state.alibiBroken]);

  const presentEvidence = (evidenceId: EvidenceId) => {
    const item = EVIDENCE[evidenceId];
    setPickerOpen(false);
    setPresentingEvidence(true);
    void sendMessage(npcId, `[EVIDENCE PRESENTED: ${item.name}]`, {
      presentedEvidence: evidenceId,
    }).finally(() => setPresentingEvidence(false));
  };

  const glitching = state.trust < GLITCH_TRUST || alarmGlitch;

  return (
    <main className="enter-fade flex min-h-dvh flex-col bg-bg-deep pt-14 md:flex-row">
      <TopBar label={npc.name} />

      {/* Suspect panel */}
      <aside className="flex shrink-0 flex-col gap-3 border-b border-neon-cyan/20 p-4 md:w-2/5 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 text-3xl",
              state.alibiBroken
                ? "border-blood-red shadow-neon-blood"
                : "border-neon-cyan shadow-neon",
              glitching && !reduceMotion ? "glitch-avatar" : "",
            ].join(" ")}
            aria-hidden="true"
          >
            {npc.avatar}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold uppercase tracking-widest text-neon-cyan">
              {npc.name}
            </h1>
            <p className="truncate text-[10px] uppercase tracking-wider text-white/40">
              {npc.role}
            </p>
            {state.alibiBroken ? (
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-blood-red">
                Alibi broken
              </p>
            ) : null}
          </div>
        </div>

        <TrustMeter value={state.trust} />
        <SuspicionMeter value={state.suspicion} />

        <button
          type="button"
          disabled={inventory.length === 0 || state.lockedOut}
          onClick={() => {
            play("blip");
            setPickerOpen(true);
          }}
          aria-label="Present evidence to this suspect"
          className="min-h-[44px] rounded border border-neon-magenta/60 text-xs font-bold uppercase tracking-[0.2em] text-neon-magenta transition hover:bg-neon-magenta hover:text-bg-deep focus:outline-none focus:ring-2 focus:ring-neon-magenta disabled:cursor-not-allowed disabled:opacity-30"
        >
          &#x1F4CE; Present Evidence
        </button>

        <button
          type="button"
          onClick={() => router.push("/room/lab404")}
          aria-label="Return to Lab 404"
          className="min-h-[44px] rounded border border-white/20 text-xs font-bold uppercase tracking-[0.2em] text-white/70 transition hover:border-neon-cyan hover:text-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan"
        >
          &larr; Back to Lab
        </button>
      </aside>

      {/* Transcript */}
      <section className="crt-overlay relative flex min-h-[50vh] flex-1 flex-col md:min-h-0">
        <div
          ref={scrollRef}
          className="relative z-10 flex-1 space-y-3 overflow-y-auto p-4"
          aria-live="polite"
          aria-label="Interrogation transcript"
        >
          {state.history.length === 0 ? (
            <p className="pt-10 text-center text-[10px] uppercase tracking-[0.3em] text-white/25">
              No questions asked yet
            </p>
          ) : (
            state.history.map((message) => (
              <ChatBubble
                key={message.id}
                role={message.role}
                content={message.content}
                isStreaming={message.isStreaming}
              />
            ))
          )}
          {error ? (
            <p className="text-center text-[10px] uppercase tracking-widest text-blood-red">
              {error}
            </p>
          ) : null}
        </div>

        <div className="relative z-10">
          <ChatInput
            onSend={(message) => void sendMessage(npcId, message)}
            disabled={isStreaming || state.lockedOut}
          />
        </div>

        {state.lockedOut ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <p className="px-6 text-center text-sm font-bold uppercase tracking-[0.3em] text-blood-red">
              Suspect refuses to cooperate
            </p>
          </div>
        ) : null}
      </section>

      <PresentEvidenceModal
        npcId={npcId}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={presentEvidence}
      />
    </main>
  );
}
