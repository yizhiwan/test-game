/**
 * Ephemeral interface state: which overlay is open, which suspect is on screen,
 * plus the player's accessibility and audio preferences.
 *
 * Overlay flags reset on load so a refresh never restores a half-open modal;
 * only the preferences and the mute toggle survive, which is what `partialize`
 * below is doing.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { HotspotId, NPCId, Toast } from "@/lib/types";

export const UI_PERSIST_KEY = "cyberpunk-lab-404-ui";

let toastSeq = 0;

export interface UIState {
  activeNPC: NPCId | null;
  isInventoryOpen: boolean;
  isExamineOpen: boolean;
  activeHotspot: HotspotId | null;
  isPresentingEvidence: boolean;
  toasts: Toast[];
  /** Player preferences, persisted. */
  isMuted: boolean;
  reduceMotion: boolean;
  hasHydrated: boolean;
}

export interface UIActions {
  openDialogue: (npcId: NPCId) => void;
  closeDialogue: () => void;
  toggleInventory: () => void;
  setInventoryOpen: (open: boolean) => void;
  openExamine: (hotspot: HotspotId) => void;
  closeExamine: () => void;
  setPresentingEvidence: (presenting: boolean) => void;
  pushToast: (message: string, tone?: Toast["tone"]) => string;
  dismissToast: (id: string) => void;
  toggleMute: () => void;
  toggleReduceMotion: () => void;
  setHydrated: () => void;
}

export type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      activeNPC: null,
      isInventoryOpen: false,
      isExamineOpen: false,
      activeHotspot: null,
      isPresentingEvidence: false,
      toasts: [],
      isMuted: false,
      reduceMotion: false,
      hasHydrated: false,

      setHydrated: () => set({ hasHydrated: true }),

      openDialogue: (npcId) => set({ activeNPC: npcId }),
      closeDialogue: () =>
        set({ activeNPC: null, isPresentingEvidence: false }),

      toggleInventory: () =>
        set((state) => ({ isInventoryOpen: !state.isInventoryOpen })),
      setInventoryOpen: (isInventoryOpen) => set({ isInventoryOpen }),

      openExamine: (activeHotspot) =>
        set({ activeHotspot, isExamineOpen: true }),
      closeExamine: () => set({ isExamineOpen: false, activeHotspot: null }),

      setPresentingEvidence: (isPresentingEvidence) =>
        set({ isPresentingEvidence }),

      pushToast: (message, tone = "info") => {
        toastSeq += 1;
        const id = `toast-${toastSeq}`;
        set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
        return id;
      },

      dismissToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        })),

      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      toggleReduceMotion: () =>
        set((state) => ({ reduceMotion: !state.reduceMotion })),
    }),
    {
      name: UI_PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Only preferences persist. Overlays always start closed.
      partialize: (state) => ({
        isMuted: state.isMuted,
        reduceMotion: state.reduceMotion,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

/* ── Selectors ─────────────────────────────────────────────── */

export const selectActiveNPC = (s: UIStore) => s.activeNPC;
export const selectInventoryOpen = (s: UIStore) => s.isInventoryOpen;
export const selectExamineOpen = (s: UIStore) => s.isExamineOpen;
export const selectActiveHotspot = (s: UIStore) => s.activeHotspot;
export const selectToasts = (s: UIStore) => s.toasts;
export const selectMuted = (s: UIStore) => s.isMuted;
export const selectReduceMotion = (s: UIStore) => s.reduceMotion;
