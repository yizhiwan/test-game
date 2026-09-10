"use client";

/**
 * Shared animated bar behind TrustMeter and SuspicionMeter.
 * The fill springs to its new width so a swing reads as a swing.
 */

import { motion } from "framer-motion";
import { selectReduceMotion, useUIStore } from "@/stores/uiStore";

export interface MeterProps {
  label: string;
  value: number;
  /** CSS gradient applied to the fill. */
  gradient: string;
  /** Optional colour for the numeric readout. */
  valueClassName?: string;
}

export default function Meter({
  label,
  value,
  gradient,
  valueClassName = "text-white",
}: MeterProps) {
  const reduceMotion = useUIStore(selectReduceMotion);
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="w-full">
      <div className="mb-1 flex items-baseline justify-between text-[10px] uppercase tracking-[0.2em] text-white/50">
        <span>{label}</span>
        <span className={`font-bold ${valueClassName}`}>{clamped}</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/60"
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: gradient }}
          initial={false}
          animate={{ width: `${clamped}%` }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 140, damping: 18 }
          }
        />
      </div>
    </div>
  );
}
