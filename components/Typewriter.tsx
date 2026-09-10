"use client";

/**
 * Terminal-style typewriter, as a hook and a component.
 *
 * Honours the player's reduce-motion preference by printing the full text
 * immediately, so nobody has to sit through an animation to read a clue.
 */

import { useEffect, useRef, useState } from "react";
import { selectReduceMotion, useUIStore } from "@/stores/uiStore";

export interface TypewriterOptions {
  /** Milliseconds per character. */
  speed?: number;
  /** Delay before the first character, in milliseconds. */
  startDelay?: number;
  /** Skip the animation and print everything at once. */
  instant?: boolean;
  onDone?: () => void;
}

export interface TypewriterState {
  text: string;
  isDone: boolean;
  /** Print the rest immediately. */
  skip: () => void;
}

export function useTypewriter(
  full: string,
  { speed = 18, startDelay = 0, instant = false, onDone }: TypewriterOptions = {},
): TypewriterState {
  const reduceMotion = useUIStore(selectReduceMotion);
  const skipAnimation = instant || reduceMotion;

  const [count, setCount] = useState(skipAnimation ? full.length : 0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    doneRef.current = false;

    if (skipAnimation) {
      setCount(full.length);
      doneRef.current = true;
      onDoneRef.current?.();
      return;
    }

    setCount(0);
    let index = 0;
    let interval: ReturnType<typeof setInterval> | undefined;

    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        index += 1;
        setCount(index);
        if (index >= full.length) {
          clearInterval(interval);
          doneRef.current = true;
          onDoneRef.current?.();
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
    };
  }, [full, speed, startDelay, skipAnimation]);

  return {
    text: full.slice(0, count),
    isDone: count >= full.length,
    skip: () => setCount(full.length),
  };
}

export interface TypewriterProps extends TypewriterOptions {
  text: string;
  className?: string;
  /** Show a blinking block cursor while typing. */
  cursor?: boolean;
  /** Clicking the text prints the rest. */
  clickToSkip?: boolean;
}

export default function Typewriter({
  text,
  className = "",
  cursor = true,
  clickToSkip = true,
  ...options
}: TypewriterProps) {
  const { text: shown, isDone, skip } = useTypewriter(text, options);

  return (
    <span
      className={`whitespace-pre-wrap ${clickToSkip && !isDone ? "cursor-pointer" : ""} ${className}`}
      onClick={clickToSkip && !isDone ? skip : undefined}
    >
      {/* Screen readers get the finished text; sighted users get the animation. */}
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {shown}
        {cursor && !isDone ? (
          <span className="ml-0.5 inline-block h-[1em] w-[0.5em] translate-y-[0.1em] bg-neon-green align-middle animate-flicker" />
        ) : null}
      </span>
    </span>
  );
}
