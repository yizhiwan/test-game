/**
 * Run state: where the player is, what they carry, how much time is left.
 *
 * Persisted to localStorage under "cyberpunk-lab-404" so a refresh mid-case
 * does not throw the run away. Hydration is deferred (`skipHydration`) and
 * driven by `useStoreHydration`, otherwise the server-rendered HTML and the
 * rehydrated client state disagree on the first paint.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { EVIDENCE, LAB_404, REQUIRED_FOR_CONVICTION, UNACCUSABLE, WINNING_KILLER } from "@/lib/caseData";
import type {
  EndingType,
  Evidence,
  EvidenceId,
  GamePhase,
  Hotspot,
  HotspotId,
  NPCId,
  RoomId,
} from "@/lib/types";

/** Seconds on the clock at the start of a run. */
export const GAME_DURATION_SECONDS = 3600;

/** Below this the timer should read as urgent. */
export const LOW_TIME_SECONDS = 600;

export const PERSIST_KEY = "cyberpunk-lab-404";

/* ── Results returned to the UI ────────────────────────────── */

export type ExamineResult =
  | { ok: false; reason: "locked"; message: string; requires: HotspotId }
  | {
      ok: true;
      hotspot: Hotspot;
      evidence?: Evidence;
      unlockedNPC?: NPCId;
      repeat: boolean;
    };

export type AccuseResult =
  | { ok: false; reason: "unaccusable" }
  | { ok: true; ending: EndingType; reason?: "insufficient_evidence" };

/* ── State ─────────────────────────────────────────────────── */

export interface GameState {
  phase: GamePhase;
  currentRoom: RoomId;
  /** Evidence the player can present in an interrogation. */
  inventory: EvidenceId[];
  /** Every clue discovered this run, including ones revealed in dialogue. */
  discoveredEvidence: EvidenceId[];
  /** Hotspots already examined, which gates `requiresFirst`. */
  examinedHotspots: HotspotId[];
  timeRemaining: number;
  accusedNPC: NPCId | null;
  ending: EndingType | null;
  gameStartedAt: number | null;
  /** True once localStorage has been read back. */
  hasHydrated: boolean;
}

export interface GameActions {
  startGame: () => void;
  addEvidence: (id: EvidenceId) => boolean;
  examineHotspot: (id: HotspotId) => ExamineResult;
  tickTimer: (seconds?: number) => void;
  accuse: (npcId: NPCId) => AccuseResult;
  setEnding: (type: EndingType) => void;
  setPhase: (phase: GamePhase) => void;
  resetGame: () => void;
  hasEvidence: (id: EvidenceId) => boolean;
  setHydrated: () => void;
}

export type GameStore = GameState & GameActions;

function initialState(): Omit<GameState, "hasHydrated"> {
  return {
    phase: "title",
    currentRoom: "lab404",
    inventory: [],
    discoveredEvidence: [],
    examinedHotspots: [],
    timeRemaining: GAME_DURATION_SECONDS,
    accusedNPC: null,
    ending: null,
    gameStartedAt: null,
  };
}

/* ── Store ─────────────────────────────────────────────────── */

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialState(),
      hasHydrated: false,

      setHydrated: () => set({ hasHydrated: true }),

      startGame: () =>
        set({
          ...initialState(),
          phase: "room",
          gameStartedAt: Date.now(),
        }),

      setPhase: (phase) => set({ phase }),

      addEvidence: (id) => {
        const { inventory, discoveredEvidence } = get();
        if (inventory.includes(id)) return false;

        set({
          inventory: [...inventory, id],
          discoveredEvidence: discoveredEvidence.includes(id)
            ? discoveredEvidence
            : [...discoveredEvidence, id],
        });
        return true;
      },

      hasEvidence: (id) => get().inventory.includes(id),

      examineHotspot: (id) => {
        const hotspot = LAB_404.find((spot) => spot.id === id);
        if (!hotspot) throw new Error(`Unknown hotspot: ${id}`);

        const { examinedHotspots } = get();

        if (
          hotspot.requiresFirst &&
          !examinedHotspots.includes(hotspot.requiresFirst)
        ) {
          return {
            ok: false,
            reason: "locked",
            requires: hotspot.requiresFirst,
            message:
              hotspot.lockedMessage ?? "It will not give. Not yet.",
          };
        }

        const repeat = examinedHotspots.includes(id);
        if (!repeat) {
          set({ examinedHotspots: [...examinedHotspots, id] });
        }

        if (repeat || !hotspot.yieldsEvidence) {
          return { ok: true, hotspot, repeat };
        }

        const evidence = EVIDENCE[hotspot.yieldsEvidence];
        get().addEvidence(evidence.id);

        return {
          ok: true,
          hotspot,
          repeat,
          evidence,
          unlockedNPC: evidence.unlocksNPC,
        };
      },

      tickTimer: (seconds = 1) => {
        const { timeRemaining, ending } = get();
        // The clock stops the moment the run is decided.
        if (ending !== null) return;

        const next = Math.max(0, timeRemaining - seconds);
        if (next > 0) {
          set({ timeRemaining: next });
          return;
        }

        set({ timeRemaining: 0, ending: "lose_time", phase: "ending" });
      },

      accuse: (npcId) => {
        if (UNACCUSABLE.includes(npcId)) {
          return { ok: false, reason: "unaccusable" };
        }

        const { inventory } = get();

        if (npcId !== WINNING_KILLER) {
          set({ accusedNPC: npcId, ending: "lose_wrong", phase: "ending" });
          return { ok: true, ending: "lose_wrong" };
        }

        // Naming the right suspect is not enough; it has to be provable.
        const proven = REQUIRED_FOR_CONVICTION.every((id) =>
          inventory.includes(id),
        );
        if (!proven) {
          set({ accusedNPC: npcId, ending: "lose_wrong", phase: "ending" });
          return {
            ok: true,
            ending: "lose_wrong",
            reason: "insufficient_evidence",
          };
        }

        set({ accusedNPC: npcId, ending: "win_murder", phase: "ending" });
        return { ok: true, ending: "win_murder" };
      },

      setEnding: (type) => set({ ending: type, phase: "ending" }),

      resetGame: () => set({ ...initialState(), hasHydrated: true }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // `hasHydrated` is a client-only flag, never round-tripped through storage.
      partialize: ({ hasHydrated: _ignored, ...rest }) => rest,
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

/* ── Selectors ─────────────────────────────────────────────── */

export const selectPhase = (s: GameStore) => s.phase;
export const selectTimeRemaining = (s: GameStore) => s.timeRemaining;
export const selectInventory = (s: GameStore) => s.inventory;
export const selectEnding = (s: GameStore) => s.ending;
export const selectHasHydrated = (s: GameStore) => s.hasHydrated;

/** `MM:SS` for the HUD. */
export function formatClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
