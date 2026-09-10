"use client";

/**
 * Rehydrates the three persisted stores after mount.
 *
 * All three use `skipHydration`, so the first client render matches the
 * server-rendered HTML exactly. This hook then reads localStorage back and
 * reports when every store is ready, letting screens hold their layout until
 * persisted values are available rather than flashing defaults.
 */

import { useEffect, useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useNPCStore } from "@/stores/npcStore";
import { useUIStore } from "@/stores/uiStore";

export function useStoreHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void Promise.all([
      useGameStore.persist.rehydrate(),
      useNPCStore.persist.rehydrate(),
      useUIStore.persist.rehydrate(),
    ]).finally(() => setHydrated(true));
  }, []);

  return hydrated;
}
