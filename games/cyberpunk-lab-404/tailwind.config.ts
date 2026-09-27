import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./stores/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "neon-cyan": "#00f0ff",
        "neon-magenta": "#ff00aa",
        "neon-green": "#39ff14",
        "blood-red": "#ff2a2a",
        "bg-deep": "#0a0a0f",
        "bg-panel": "#12121a",
      },
      fontFamily: {
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      animation: {
        // Keyframes live in app/globals.css so the raw CSS stays hand-editable.
        glitch: "glitch 0.45s steps(2, end) infinite",
        scanline: "scanline 7s linear infinite",
        "pulse-neon": "pulse-neon 2.2s ease-in-out infinite",
        flicker: "flicker 3.5s linear infinite",
      },
      boxShadow: {
        neon: "0 0 5px rgba(0, 240, 255, 0.7), 0 0 20px rgba(0, 240, 255, 0.35)",
        "neon-magenta":
          "0 0 5px rgba(255, 0, 170, 0.7), 0 0 20px rgba(255, 0, 170, 0.35)",
        "neon-blood":
          "0 0 5px rgba(255, 42, 42, 0.7), 0 0 20px rgba(255, 42, 42, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
