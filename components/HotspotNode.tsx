"use client";

/**
 * A pulsing marker on the lab illustration. Hover reveals the label.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { play } from "@/lib/audio";
import { selectReduceMotion, useUIStore } from "@/stores/uiStore";
import type { Hotspot } from "@/lib/types";

export interface HotspotNodeProps {
  hotspot: Hotspot;
  examined: boolean;
  onSelect: (id: Hotspot["id"]) => void;
}

export default function HotspotNode({
  hotspot,
  examined,
  onSelect,
}: HotspotNodeProps) {
  const [hovered, setHovered] = useState(false);
  const reduceMotion = useUIStore(selectReduceMotion);

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${hotspot.position.x}%`, top: `${hotspot.position.y}%` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.button
        type="button"
        aria-label={`Examine ${hotspot.label}`}
        onClick={() => {
          play("blip");
          onSelect(hotspot.id);
        }}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        whileHover={reduceMotion ? undefined : { scale: 1.18 }}
        whileTap={reduceMotion ? undefined : { scale: 0.92 }}
        className={[
          "flex h-11 w-11 items-center justify-center rounded-full border-2 text-lg backdrop-blur",
          "focus:outline-none focus:ring-2 focus:ring-neon-cyan focus:ring-offset-2 focus:ring-offset-bg-deep",
          examined
            ? "border-neon-green/70 bg-neon-green/10 text-neon-green"
            : "border-neon-cyan bg-neon-cyan/10 text-neon-cyan shadow-neon",
          examined || reduceMotion ? "" : "animate-pulse-neon",
        ].join(" ")}
      >
        <span aria-hidden="true">{hotspot.icon}</span>
      </motion.button>

      {hovered ? (
        <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded border border-neon-cyan/40 bg-bg-deep/95 px-2 py-1 text-[10px] uppercase tracking-widest text-neon-cyan">
          {hotspot.label}
        </div>
      ) : null}
    </div>
  );
}
