/**
 * Isometric-ish Lab 404, drawn as neon geometry.
 * Deliberately schematic: readable blocks the hotspots can sit on top of.
 */

export default function LabScene() {
  return (
    <svg
      viewBox="0 0 400 260"
      className="h-full w-full"
      role="img"
      aria-label="Schematic of Lab 404 showing the console, workbench, vent and observation window"
    >
      <defs>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#12121a" />
          <stop offset="100%" stopColor="#0a0a0f" />
        </linearGradient>
      </defs>

      <rect width="400" height="260" fill="url(#floor)" />

      {/* Floor grid */}
      <g stroke="#00f0ff" strokeOpacity="0.12" strokeWidth="0.5">
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={40 + i * 18} x2="400" y2={40 + i * 18} />
        ))}
        {Array.from({ length: 17 }, (_, i) => (
          <line key={`v${i}`} x1={i * 25} y1="40" x2={i * 25} y2="260" />
        ))}
      </g>

      {/* Back wall */}
      <rect x="0" y="0" width="400" height="42" fill="#0d0d14" />
      <line x1="0" y1="42" x2="400" y2="42" stroke="#00f0ff" strokeOpacity="0.35" />

      {/* Observation window */}
      <g>
        <rect x="300" y="52" width="82" height="42" fill="#00f0ff" fillOpacity="0.06" stroke="#00f0ff" strokeOpacity="0.5" />
        <line x1="341" y1="52" x2="341" y2="94" stroke="#00f0ff" strokeOpacity="0.25" />
      </g>

      {/* Terminal console */}
      <g>
        <rect x="176" y="60" width="70" height="34" fill="#12121a" stroke="#39ff14" strokeOpacity="0.6" />
        <rect x="182" y="66" width="58" height="18" fill="#39ff14" fillOpacity="0.08" />
        <rect x="186" y="94" width="50" height="8" fill="#12121a" stroke="#39ff14" strokeOpacity="0.3" />
      </g>

      {/* Air vent */}
      <g>
        <rect x="42" y="52" width="46" height="30" fill="#12121a" stroke="#ff00aa" strokeOpacity="0.5" />
        {Array.from({ length: 4 }, (_, i) => (
          <line key={i} x1="46" y1={58 + i * 7} x2="84" y2={58 + i * 7} stroke="#ff00aa" strokeOpacity="0.35" />
        ))}
      </g>

      {/* Workbench */}
      <g>
        <rect x="238" y="128" width="96" height="40" fill="#12121a" stroke="#00f0ff" strokeOpacity="0.5" />
        <rect x="246" y="118" width="26" height="12" fill="#00f0ff" fillOpacity="0.12" />
        <rect x="280" y="120" width="16" height="10" fill="#ff00aa" fillOpacity="0.18" />
      </g>

      {/* Cryo-bench and the body */}
      <g>
        <rect x="106" y="148" width="112" height="44" rx="4" fill="#12121a" stroke="#ff2a2a" strokeOpacity="0.45" />
        <ellipse cx="162" cy="170" rx="44" ry="13" fill="#ff2a2a" fillOpacity="0.12" />
        <path d="M124 172 L152 162 L186 168 L200 178" stroke="#ff2a2a" strokeOpacity="0.7" strokeWidth="2" fill="none" />
      </g>

      {/* Sealed airlock */}
      <g>
        <rect x="12" y="150" width="26" height="80" fill="#0d0d14" stroke="#ff2a2a" strokeOpacity="0.4" />
        <text x="25" y="196" fill="#ff2a2a" fillOpacity="0.7" fontSize="7" textAnchor="middle" transform="rotate(-90 25 196)">
          SEALED
        </text>
      </g>
    </svg>
  );
}
