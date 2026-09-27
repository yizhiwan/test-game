"use client";

import Meter from "./Meter";

/** Green when the suspect is opening up, red when they are shutting down. */
export default function TrustMeter({ value }: { value: number }) {
  const tone =
    value >= 60
      ? "text-neon-green"
      : value >= 30
        ? "text-yellow-300"
        : "text-blood-red";

  return (
    <Meter
      label="Trust"
      value={value}
      valueClassName={tone}
      gradient="linear-gradient(90deg, #ff2a2a 0%, #ffd166 50%, #39ff14 100%)"
    />
  );
}
