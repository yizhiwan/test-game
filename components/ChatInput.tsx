"use client";

/**
 * Auto-growing question box. Enter sends, Shift+Enter adds a newline.
 */

import { useEffect, useRef, useState } from "react";
import { play } from "@/lib/audio";

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  /** Text dropped in from the present-evidence flow. */
  seedValue?: string;
  placeholder?: string;
}

const MAX_HEIGHT_PX = 140;

export default function ChatInput({
  onSend,
  disabled = false,
  seedValue,
  placeholder = "Ask anything...",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow to fit the content, then scroll instead of pushing the chat away.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  useEffect(() => {
    if (seedValue === undefined) return;
    setValue(seedValue);
    ref.current?.focus();
  }, [seedValue]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    play("blip");
    onSend(trimmed);
    setValue("");
  };

  return (
    <div className="flex items-end gap-2 border-t border-neon-cyan/20 bg-bg-panel/80 p-2">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label="Your question"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        className="min-h-[44px] flex-1 resize-none rounded border border-neon-cyan/30 bg-black/50 px-3 py-2 text-sm text-white outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/40 disabled:opacity-40"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || value.trim() === ""}
        aria-label="Send question"
        className="min-h-[44px] min-w-[44px] rounded border border-neon-cyan/60 px-4 text-xs font-bold uppercase tracking-widest text-neon-cyan transition hover:bg-neon-cyan hover:text-bg-deep focus:outline-none focus:ring-2 focus:ring-neon-cyan disabled:cursor-not-allowed disabled:opacity-30"
      >
        Send
      </button>
    </div>
  );
}
