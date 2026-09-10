/**
 * Per-character interrogation state: trust, suspicion, transcript, what they
 * let slip. Persisted alongside the game store so a refresh keeps the room's
 * social history intact.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { NPC_ROSTER } from "@/lib/caseData";
import type {
  ChatMessage,
  ChatRole,
  NPCEmotionalState,
  NPCId,
  NPCRuntimeState,
} from "@/lib/types";

/** Trust at or below this locks the suspect out of further questioning. */
export const LOCKOUT_TRUST = 20;

export const NPC_PERSIST_KEY = "cyberpunk-lab-404-npcs";

const NPC_IDS = Object.keys(NPC_ROSTER) as NPCId[];

function blankNPC(id: NPCId): NPCRuntimeState {
  return {
    trust: NPC_ROSTER[id].startingTrust,
    suspicion: 0,
    history: [],
    revealedClues: [],
    alibiBroken: false,
    lockedOut: false,
    emotionalState: "calm",
  };
}

function blankRoster(): Record<NPCId, NPCRuntimeState> {
  return NPC_IDS.reduce(
    (acc, id) => {
      acc[id] = blankNPC(id);
      return acc;
    },
    {} as Record<NPCId, NPCRuntimeState>,
  );
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

let messageSeq = 0;
function nextMessageId(npcId: NPCId): string {
  messageSeq += 1;
  return `${npcId}-${messageSeq}-${Date.now().toString(36)}`;
}

export interface NPCStoreState {
  npcs: Record<NPCId, NPCRuntimeState>;
  hasHydrated: boolean;
}

export interface NPCStoreActions {
  updateTrust: (npcId: NPCId, delta: number) => number;
  updateSuspicion: (npcId: NPCId, delta: number) => number;
  addMessage: (
    npcId: NPCId,
    role: ChatRole,
    content: string,
    isStreaming?: boolean,
  ) => ChatMessage;
  /** Replace the body of an in-flight message as tokens arrive. */
  updateMessage: (
    npcId: NPCId,
    messageId: string,
    content: string,
    isStreaming?: boolean,
  ) => void;
  addRevealedClue: (npcId: NPCId, clue: string) => void;
  setEmotionalState: (npcId: NPCId, state: NPCEmotionalState) => void;
  markAlibiBroken: (npcId: NPCId) => void;
  lockOut: (npcId: NPCId) => void;
  /** Locks the suspect out when trust has fallen too far. Returns true if locked. */
  checkLockout: (npcId: NPCId) => boolean;
  resetNPC: (npcId: NPCId) => void;
  resetAll: () => void;
  setHydrated: () => void;
}

export type NPCStore = NPCStoreState & NPCStoreActions;

export const useNPCStore = create<NPCStore>()(
  persist(
    (set, get) => ({
      npcs: blankRoster(),
      hasHydrated: false,

      setHydrated: () => set({ hasHydrated: true }),

      updateTrust: (npcId, delta) => {
        const next = clamp(get().npcs[npcId].trust + delta);
        set((state) => ({
          npcs: {
            ...state.npcs,
            [npcId]: { ...state.npcs[npcId], trust: next },
          },
        }));
        get().checkLockout(npcId);
        return next;
      },

      updateSuspicion: (npcId, delta) => {
        const next = clamp(get().npcs[npcId].suspicion + delta);
        set((state) => ({
          npcs: {
            ...state.npcs,
            [npcId]: { ...state.npcs[npcId], suspicion: next },
          },
        }));
        return next;
      },

      addMessage: (npcId, role, content, isStreaming = false) => {
        const message: ChatMessage = {
          id: nextMessageId(npcId),
          role,
          content,
          timestamp: Date.now(),
          isStreaming,
        };

        set((state) => ({
          npcs: {
            ...state.npcs,
            [npcId]: {
              ...state.npcs[npcId],
              history: [...state.npcs[npcId].history, message],
            },
          },
        }));

        return message;
      },

      updateMessage: (npcId, messageId, content, isStreaming = true) =>
        set((state) => ({
          npcs: {
            ...state.npcs,
            [npcId]: {
              ...state.npcs[npcId],
              history: state.npcs[npcId].history.map((msg) =>
                msg.id === messageId ? { ...msg, content, isStreaming } : msg,
              ),
            },
          },
        })),

      addRevealedClue: (npcId, clue) =>
        set((state) => {
          const npc = state.npcs[npcId];
          if (npc.revealedClues.includes(clue)) return state;
          return {
            npcs: {
              ...state.npcs,
              [npcId]: { ...npc, revealedClues: [...npc.revealedClues, clue] },
            },
          };
        }),

      setEmotionalState: (npcId, emotionalState) =>
        set((state) => ({
          npcs: {
            ...state.npcs,
            [npcId]: { ...state.npcs[npcId], emotionalState },
          },
        })),

      markAlibiBroken: (npcId) =>
        set((state) => ({
          npcs: {
            ...state.npcs,
            [npcId]: { ...state.npcs[npcId], alibiBroken: true },
          },
        })),

      lockOut: (npcId) =>
        set((state) => ({
          npcs: {
            ...state.npcs,
            [npcId]: { ...state.npcs[npcId], lockedOut: true },
          },
        })),

      checkLockout: (npcId) => {
        const npc = get().npcs[npcId];
        if (npc.lockedOut) return true;
        if (npc.trust >= LOCKOUT_TRUST) return false;

        get().lockOut(npcId);
        return true;
      },

      resetNPC: (npcId) =>
        set((state) => ({
          npcs: { ...state.npcs, [npcId]: blankNPC(npcId) },
        })),

      resetAll: () => {
        messageSeq = 0;
        set({ npcs: blankRoster(), hasHydrated: true });
      },
    }),
    {
      name: NPC_PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ hasHydrated: _ignored, ...rest }) => rest,
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

/* ── Selectors ─────────────────────────────────────────────── */

export const selectNPC = (npcId: NPCId) => (s: NPCStore) => s.npcs[npcId];
export const selectTrust = (npcId: NPCId) => (s: NPCStore) =>
  s.npcs[npcId].trust;
export const selectSuspicion = (npcId: NPCId) => (s: NPCStore) =>
  s.npcs[npcId].suspicion;
export const selectHistory = (npcId: NPCId) => (s: NPCStore) =>
  s.npcs[npcId].history;
export const selectLockedOut = (npcId: NPCId) => (s: NPCStore) =>
  s.npcs[npcId].lockedOut;
