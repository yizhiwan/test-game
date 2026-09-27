"use client";

/**
 * One line of an interrogation transcript.
 * Player lines sit right in magenta, suspects left in cyan.
 */

import { motion } from "framer-motion";
import { selectReduceMotion, useUIStore } from "@/stores/uiStore";
import type { ChatRole } from "@/lib/types";

export interface ChatBubbleProps {
  role: ChatRole;
  content: string;
  isStreaming?: boolean;
}

/** Three dots that cycle while the reply is still arriving. */
function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="Replying">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-neon-cyan"
          style={{
            animation: "pulse-neon 1.1s ease-in-out infinite",
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </span>
  );
}

export default function ChatBubble({
  role,
  content,
  isStreaming = false,
}: ChatBubbleProps) {
  const reduceMotion = useUIStore(selectReduceMotion);
  const isPlayer = role === "player";

  return (
    <motion.div
      className={`flex w-full ${isPlayer ? "justify-end" : "justify-start"}`}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.22 }}
    >
      <div
        className={[
          "max-w-[85%] rounded-lg border px-3 py-2 text-sm leading-relaxed",
          isPlayer
            ? "border-neon-magenta/60 bg-neon-magenta/10 text-white"
            : "border-neon-cyan/60 bg-neon-cyan/5 text-white/90",
        ].join(" ")}
      >
        <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/40">
          {isPlayer ? "You" : "Suspect"}
        </span>
        {content ? (
          <span className="whitespace-pre-wrap">{content}</span>
        ) : isStreaming ? (
          <TypingDots />
        ) : null}
        {content && isStreaming ? (
          <span className="ml-1 inline-block h-[1em] w-[0.45em] translate-y-[0.1em] bg-neon-cyan align-middle animate-flicker" />
        ) : null}
      </div>
    </motion.div>
  );
}
