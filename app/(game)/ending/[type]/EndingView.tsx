"use client";

/**
 * Ending screens, one component with four faces.
 *
 * Each ending gets its own palette, headline and debrief. The summary reads
 * from the stores rather than from the route, so a bookmarked ending URL still
 * shows the run that actually happened.
 */

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  EXIT_CODE,
  NPC_LIST,
  NPC_ROSTER,
  WINNING_KILLER,
} from "@/lib/caseData";
import { stopAmbient } from "@/lib/audio";
import {
  GAME_DURATION_SECONDS,
  formatClock,
  useGameStore,
} from "@/stores/gameStore";
import { useNPCStore } from "@/stores/npcStore";
import type { EndingType } from "@/lib/types";

const ENDINGS: Record<
  EndingType,
  { title: string; accent: string; border: string; blurb: string; cta: string }
> = {
  win_murder: {
    title: "Case Closed",
    accent: "text-neon-green",
    border: "border-neon-green",
    blurb:
      "The file holds. Corporate counsel folded before the ethics board even convened.",
    cta: "Play Again",
  },
  win_escape: {
    title: "Exfil Complete",
    accent: "text-neon-cyan",
    border: "border-neon-cyan",
    blurb:
      "The airlock cycled and the tower let you go. Killer exposed via corporate channels, eventually, quietly.",
    cta: "Play Again",
  },
  lose_wrong: {
    title: "Wrong Target",
    accent: "text-blood-red",
    border: "border-blood-red",
    blurb: "You named the wrong one. The right one signed your exit permit.",
    cta: "Retry",
  },
  lose_time: {
    title: "Cleanup Arrived",
    accent: "text-white/70",
    border: "border-white/30",
    blurb:
      "The air went first, then the lights. NeuroTech files it as an equipment failure.",
    cta: "Retry",
  },
};

function isEndingType(value: string): value is EndingType {
  return value in ENDINGS;
}

export default function EndingView() {
  const params = useParams<{ type: string }>();
  const router = useRouter();

  const raw = params?.type ?? "";
  const type: EndingType = isEndingType(raw) ? raw : "lose_time";
  const config = ENDINGS[type];

  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const accusedNPC = useGameStore((s) => s.accusedNPC);
  const inventory = useGameStore((s) => s.inventory);
  const npcs = useNPCStore((s) => s.npcs);

  useEffect(() => {
    stopAmbient();
  }, []);

  const timeUsed = useMemo(
    () => formatClock(Math.max(0, GAME_DURATION_SECONDS - timeRemaining)),
    [timeRemaining],
  );

  const playAgain = () => {
    useNPCStore.getState().resetAll();
    useGameStore.getState().resetGame();
    router.push("/");
  };

  const isWin = type === "win_murder" || type === "win_escape";

  return (
    <main
      className="enter-fade crt-overlay relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-bg-deep px-4 py-12"
    >
      {/* Static wash for the timeout ending. */}
      {type === "lose_time" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07] animate-flicker"
          style={{
            backgroundImage:
              "repeating-conic-gradient(#fff 0% 25%, #000 0% 50%)",
            backgroundSize: "4px 4px",
          }}
        />
      ) : null}

      <div className="relative z-10 w-full max-w-lg">
        <h1
          className={[
            "enter-rise",
            "text-center text-4xl font-black uppercase tracking-[0.15em] sm:text-5xl",
            config.accent,
            type === "lose_wrong" ? "animate-glitch" : "",
          ].join(" ")}
        >
          {config.title}
        </h1>

        <p className="mt-4 text-center text-sm leading-relaxed text-white/60">
          {config.blurb}
        </p>

        <section
          aria-label="Case debrief"
          className={`mt-8 rounded-lg border ${config.border} bg-white/[0.03] p-5 backdrop-blur`}
        >
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-white/40">Killer</dt>
              <dd className="text-right text-white">
                {NPC_ROSTER[WINNING_KILLER].name}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/40">Motive</dt>
              <dd className="text-right text-white">
                Falsified Specimen 404 logs
              </dd>
            </div>
            {accusedNPC ? (
              <div className="flex justify-between gap-4">
                <dt className="text-white/40">You accused</dt>
                {/* Green only when the accusation actually stuck. Naming the
                    right suspect without the evidence is still a loss, and
                    colouring it as a win would read as though it landed. */}
                <dd
                  className={`text-right ${type === "win_murder" ? "text-neon-green" : "text-blood-red"}`}
                >
                  {NPC_ROSTER[accusedNPC].name}
                  {type === "lose_wrong" && accusedNPC === WINNING_KILLER ? (
                    <span className="block text-[10px] uppercase tracking-widest text-white/40">
                      Right name, not enough proof
                    </span>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {type === "win_escape" ? (
              <div className="flex justify-between gap-4">
                <dt className="text-white/40">Access code</dt>
                <dd className="text-right text-neon-cyan">{EXIT_CODE}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-white/40">Time used</dt>
              <dd className="text-right text-white">{timeUsed}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/40">Evidence held</dt>
              <dd className="text-right text-white">{inventory.length} of 4</dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/30">
              Final trust
            </p>
            <ul className="space-y-1 text-xs">
              {NPC_LIST.map((npc) => (
                <li key={npc.id} className="flex justify-between gap-4">
                  <span className="text-white/50">{npc.name}</span>
                  <span className="tabular-nums text-white/80">
                    {npcs[npc.id].trust}
                    {npcs[npc.id].alibiBroken ? (
                      <span className="ml-2 text-blood-red">alibi broken</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <button
          type="button"
          onClick={playAgain}
          aria-label={`${config.cta} from the title screen`}
          className={[
            "mt-8 min-h-[52px] w-full rounded border-2 text-xs font-bold uppercase tracking-[0.3em] transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-deep",
            isWin
              ? "border-neon-green text-neon-green hover:bg-neon-green hover:text-bg-deep focus:ring-neon-green"
              : "border-blood-red text-blood-red hover:bg-blood-red hover:text-bg-deep focus:ring-blood-red",
          ].join(" ")}
        >
          {config.cta}
        </button>
      </div>
    </main>
  );
}
