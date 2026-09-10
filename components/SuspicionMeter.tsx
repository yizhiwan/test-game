"use client";

import Meter from "./Meter";

/** Cyan while the suspect is relaxed, magenta once they see you coming. */
export default function SuspicionMeter({ value }: { value: number }) {
  const tone = value >= 60 ? "text-neon-magenta" : "text-neon-cyan";

  return (
    <Meter
      label="Suspicion"
      value={value}
      valueClassName={tone}
      gradient="linear-gradient(90deg, #00f0ff 0%, #7a5cff 55%, #ff00aa 100%)"
    />
  );
}
