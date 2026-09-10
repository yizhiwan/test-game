"use client";

/**
 * The lab terminal: the only two ways this run ends on the player's terms.
 *
 * Escaping needs the airlock code. Convicting needs the right name *and* the
 * evidence to carry it; the store owns that rule so the terminal cannot be
 * talked into a conviction the case file would not support.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import { EXIT_CODE, NPC_LIST } from "@/lib/caseData";
import { play, stopAmbient } from "@/lib/audio";
import { useGameStore } from "@/stores/gameStore";
import type { NPCId } from "@/lib/types";

type Tab = "code" | "accuse";

export default function TerminalPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("code");
  const [code, setCode] = useState("");
  const [denied, setDenied] = useState(false);
  const [suspect, setSuspect] = useState<NPCId | "">("");
  const [notice, setNotice] = useState<string | null>(null);

  const finish = (path: string) => {
    stopAmbient();
    router.push(path);
  };

  const verify = () => {
    const game = useGameStore.getState();
    if (code.trim().toUpperCase() !== EXIT_CODE) {
      play("alarm");
      setDenied(true);
      setTimeout(() => setDenied(false), 500);
      return;
    }
    play("blip");
    game.setEnding("win_escape");
    finish("/ending/win_escape");
  };

  const submitAccusation = () => {
    if (!suspect) return;
    const result = useGameStore.getState().accuse(suspect);

    if (!result.ok) {
      play("alarm");
      setNotice("That one has no body to book. Pick again.");
      return;
    }

    if (result.reason === "insufficient_evidence") {
      setNotice("Insufficient evidence. Killer walks free.");
    }
    play("alarm");
    finish(`/ending/${result.ending}`);
  };

  const tabClass = (active: boolean) =>
    [
      "min-h-[44px] flex-1 border px-3 text-xs font-bold uppercase tracking-[0.2em] transition focus:outline-none focus:ring-2 focus:ring-neon-green",
      active
        ? "border-neon-green bg-neon-green/10 text-neon-green"
        : "border-white/15 text-white/40 hover:border-neon-green/50 hover:text-neon-green/70",
    ].join(" ");

  return (
    <main className="crt-overlay enter-fade flex min-h-dvh flex-col bg-black pt-14 font-mono text-neon-green">
      <TopBar label="Secure Terminal" />

      <div className="relative z-10 mx-auto w-full max-w-2xl flex-1 p-4">
        <h1 className="mb-6 text-sm sm:text-base">
          &gt; NEUROTECH SECURE TERMINAL v4.04
          <span className="ml-1 inline-block h-[1em] w-[0.5em] translate-y-[0.1em] bg-neon-green align-middle animate-flicker" />
        </h1>

        <div className="mb-5 flex gap-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "code"}
            onClick={() => setTab("code")}
            className={tabClass(tab === "code")}
          >
            Access Code
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "accuse"}
            onClick={() => setTab("accuse")}
            className={tabClass(tab === "accuse")}
          >
            File Accusation
          </button>
        </div>

        {tab === "code" ? (
          <section aria-label="Enter access code" className="space-y-3">
            <label htmlFor="access-code" className="block text-xs text-neon-green/60">
              &gt; ENTER ACCESS CODE
            </label>
            <input
              id="access-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && verify()}
              placeholder="________"
              autoComplete="off"
              className={[
                "min-h-[44px] w-full rounded border bg-black/60 px-3 uppercase tracking-[0.3em] text-neon-green outline-none focus:ring-2 focus:ring-neon-green",
                denied ? "border-blood-red shake" : "border-neon-green/40",
              ].join(" ")}
            />
            {denied ? (
              <p role="alert" className="text-xs font-bold tracking-[0.3em] text-blood-red">
                ACCESS DENIED
              </p>
            ) : null}
            <button
              type="button"
              onClick={verify}
              aria-label="Verify access code"
              className="min-h-[44px] w-full rounded border border-neon-green bg-neon-green/10 text-xs font-bold uppercase tracking-[0.3em] transition hover:bg-neon-green hover:text-black focus:outline-none focus:ring-2 focus:ring-neon-green"
            >
              Verify
            </button>
          </section>
        ) : (
          <section aria-label="File an accusation" className="space-y-3">
            <label htmlFor="suspect" className="block text-xs text-neon-green/60">
              &gt; NAME THE KILLER
            </label>
            <select
              id="suspect"
              value={suspect}
              onChange={(event) => {
                setNotice(null);
                setSuspect(event.target.value as NPCId | "");
              }}
              className="min-h-[44px] w-full rounded border border-neon-green/40 bg-black/60 px-3 text-neon-green outline-none focus:ring-2 focus:ring-neon-green"
            >
              <option value="">-- select --</option>
              {NPC_LIST.map((npc) => (
                <option key={npc.id} value={npc.id}>
                  {npc.name} — {npc.role}
                </option>
              ))}
            </select>
            {notice ? (
              <p role="alert" className="text-xs tracking-widest text-blood-red">
                {notice}
              </p>
            ) : null}
            <button
              type="button"
              disabled={!suspect}
              onClick={submitAccusation}
              aria-label="Submit accusation"
              className="min-h-[44px] w-full rounded border border-blood-red bg-blood-red/10 text-xs font-bold uppercase tracking-[0.3em] text-blood-red transition hover:bg-blood-red hover:text-black focus:outline-none focus:ring-2 focus:ring-blood-red disabled:cursor-not-allowed disabled:opacity-30"
            >
              Submit
            </button>
          </section>
        )}

        <button
          type="button"
          onClick={() => router.push("/room/lab404")}
          aria-label="Return to Lab 404"
          className="mt-8 min-h-[44px] w-full rounded border border-white/15 text-xs uppercase tracking-[0.3em] text-white/50 transition hover:border-neon-green hover:text-neon-green focus:outline-none focus:ring-2 focus:ring-neon-green"
        >
          &larr; Back to Lab
        </button>
      </div>
    </main>
  );
}
