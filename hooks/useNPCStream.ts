"use client";

/**
 * Drives one interrogation turn end to end.
 *
 * Sends the player's line, streams the reply into the transcript as tokens
 * arrive, then scores the exchange and applies the consequences: trust and
 * suspicion move, a broken alibi fires its alarm, a revealed access code lands
 * in the inventory, and a suspect pushed too far locks the player out.
 *
 * Reads the stream by hand rather than through `useChat` because the transcript
 * already lives in the NPC store, and a second source of truth for the same
 * messages would have to be reconciled on every render.
 */

import { useCallback, useRef, useState } from "react";
import { EVIDENCE, EXIT_CODE } from "@/lib/caseData";
import { play } from "@/lib/audio";
import { useGameStore } from "@/stores/gameStore";
import { LOCKOUT_TRUST, useNPCStore } from "@/stores/npcStore";
import { useUIStore } from "@/stores/uiStore";
import type { Evaluation, EvidenceId, NPCId } from "@/lib/types";

/**
 * Where the API lives.
 *
 * Empty on the web build, so requests go to this app's own origin. The
 * Capacitor build has no server of its own, so it needs an absolute URL to a
 * deployment; set NEXT_PUBLIC_API_BASE_URL at build time.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export interface SendOptions {
  presentedEvidence?: EvidenceId | null;
}

export interface NPCStream {
  sendMessage: (
    npcId: NPCId,
    message: string,
    options?: SendOptions,
  ) => Promise<void>;
  isStreaming: boolean;
  error: string | null;
}

export function useNPCStream(): NPCStream {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const sendMessage = useCallback(
    async (npcId: NPCId, message: string, options: SendOptions = {}) => {
      const trimmed = message.trim();
      if (!trimmed || inFlight.current) return;

      const npcStore = useNPCStore.getState();
      const gameStore = useGameStore.getState();

      if (npcStore.npcs[npcId].lockedOut) return;

      inFlight.current = true;
      setIsStreaming(true);
      setError(null);

      const presentedEvidence = options.presentedEvidence ?? null;

      // History is captured before the new lines are appended, so the server
      // sees the conversation as it stood when the player spoke.
      const history = npcStore.npcs[npcId].history.slice();
      npcStore.addMessage(npcId, "player", trimmed);
      const reply = npcStore.addMessage(npcId, "npc", "", true);

      let replyText = "";

      try {
        const response = await fetch(apiUrl("/api/npc/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            npcId,
            playerMessage: trimmed,
            presentedEvidence,
            inventory: gameStore.inventory,
            trust: npcStore.npcs[npcId].trust,
            suspicion: npcStore.npcs[npcId].suspicion,
            history,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Dialogue request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          replyText += decoder.decode(value, { stream: true });
          useNPCStore
            .getState()
            .updateMessage(npcId, reply.id, replyText, true);
        }

        replyText += decoder.decode();
      } catch (cause) {
        console.error("[useNPCStream] dialogue failed", cause);
        setError("Signal lost. The line went dead.");
        replyText = replyText || "[static]";
      }

      useNPCStore.getState().updateMessage(npcId, reply.id, replyText, false);
      setIsStreaming(false);
      inFlight.current = false;

      await scoreExchange({
        npcId,
        playerMessage: trimmed,
        npcReply: replyText,
        presentedEvidence,
      });
    },
    [],
  );

  return { sendMessage, isStreaming, error };
}

/* ── Consequences ──────────────────────────────────────────── */

interface ScoreArgs {
  npcId: NPCId;
  playerMessage: string;
  npcReply: string;
  presentedEvidence: EvidenceId | null;
}

async function scoreExchange({
  npcId,
  playerMessage,
  npcReply,
  presentedEvidence,
}: ScoreArgs): Promise<void> {
  const npcStore = useNPCStore.getState();
  const before = npcStore.npcs[npcId];

  let evaluation: Evaluation;
  try {
    const response = await fetch(apiUrl("/api/npc/evaluate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        npcId,
        playerMessage,
        npcReply,
        presentedEvidence,
        currentTrust: before.trust,
        currentSuspicion: before.suspicion,
      }),
    });
    evaluation = (await response.json()) as Evaluation;
  } catch (cause) {
    console.error("[useNPCStream] evaluation failed", cause);
    return;
  }

  const ui = useUIStore.getState();
  const game = useGameStore.getState();

  npcStore.updateTrust(npcId, evaluation.trustDelta ?? 0);
  npcStore.updateSuspicion(npcId, evaluation.suspicionDelta ?? 0);
  if (evaluation.npcEmotionalState) {
    npcStore.setEmotionalState(npcId, evaluation.npcEmotionalState);
  }

  if (evaluation.alibiBroken && !before.alibiBroken) {
    npcStore.markAlibiBroken(npcId);
    play("alarm");
    ui.pushToast("ALIBI BROKEN", "danger");
  }

  if (evaluation.revealedClue) {
    npcStore.addRevealedClue(npcId, evaluation.revealedClue);

    // The access code is the only revealed clue that becomes an inventory item.
    if (evaluation.revealedClue.toUpperCase().includes(EXIT_CODE)) {
      if (game.addEvidence("access_code")) {
        play("blip");
        ui.pushToast(
          `NEW CLUE UNLOCKED: ${EVIDENCE.access_code.name}`,
          "success",
        );
      }
    }
  }

  const after = useNPCStore.getState().npcs[npcId];
  if (after.lockedOut && !before.lockedOut) {
    play("alarm");
    ui.pushToast(
      `${npcId.toUpperCase()} HAS STOPPED COOPERATING (TRUST < ${LOCKOUT_TRUST})`,
      "danger",
    );
  }
}
