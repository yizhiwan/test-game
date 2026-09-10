/**
 * Scores one interrogation exchange.
 *
 * Runs on every turn, so it uses the cheap fast model and returns a small
 * fixed-shape object rather than prose. Two outcomes are decided in code
 * rather than left to the model, because the critical path of the case must
 * not depend on a judgement call: the drive breaking Aris, and evidence
 * waved at the wrong suspect.
 */

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { EVIDENCE, NPC_ROSTER, isNPCId } from "@/lib/caseData";
import { EVALUATOR_MODEL } from "@/lib/models";
import type { Evaluation, EvidenceId, NPCId } from "@/lib/types";

export const runtime = "edge";

const evaluationSchema = z.object({
  trustDelta: z
    .number()
    .min(-30)
    .max(30)
    .describe("How much the suspect's trust in the detective moved."),
  suspicionDelta: z
    .number()
    .min(-30)
    .max(30)
    .describe("How much more the suspect suspects the detective is a threat."),
  revealedClue: z
    .string()
    .nullable()
    .describe("A concrete fact the suspect let slip this turn, or null."),
  npcEmotionalState: z.enum(["calm", "defensive", "hostile", "broken"]),
  alibiBroken: z
    .boolean()
    .describe("True only when this turn demolished the suspect's alibi."),
});

const EVALUATOR_SYSTEM = `
You evaluate interrogation dynamics in a murder mystery game.
Rules:
- Aggressive question without evidence: -5 to -10 trust
- Polite/empathetic question: +2 to +5 trust
- Correct evidence presented (matches NPC's secret): +15 to +25 trust, alibiBroken = true
- Wrong evidence presented: -15 trust, +20 suspicion
- Repeated same question: -5 trust
- Direct accusation without proof: -20 to -40 trust
- If presented evidence is in NPC's known contradictions: alibiBroken = true, reveal access code clue
`.trim();

interface EvaluateRequest {
  npcId: NPCId;
  playerMessage: string;
  npcReply: string;
  presentedEvidence?: EvidenceId | null;
  currentTrust: number;
  currentSuspicion: number;
}

/** Neutral result used when the evaluator is unavailable. */
const NEUTRAL: Evaluation = {
  trustDelta: 0,
  suspicionDelta: 0,
  revealedClue: null,
  npcEmotionalState: "calm",
  alibiBroken: false,
};

/**
 * Applies the outcomes the game cannot afford to get wrong.
 * The drive is the case's key: shown to Aris it always breaks him and always
 * yields the airlock code. Evidence shown to a suspect it does not implicate
 * always costs the detective.
 */
function applyHardRules(
  evaluation: Evaluation,
  npcId: NPCId,
  presentedEvidence: EvidenceId | null | undefined,
): Evaluation {
  if (!presentedEvidence) return evaluation;

  if (presentedEvidence === "encrypted_drive" && npcId === "aris") {
    return {
      ...evaluation,
      trustDelta: Math.max(evaluation.trustDelta, 20),
      alibiBroken: true,
      revealedClue: "404-SPECIMEN",
      npcEmotionalState: "broken",
    };
  }

  const contradicts = NPC_ROSTER[npcId].contradictedBy.includes(
    presentedEvidence,
  );
  if (!contradicts) {
    return {
      ...evaluation,
      trustDelta: -15,
      suspicionDelta: 20,
      alibiBroken: false,
    };
  }

  return { ...evaluation, alibiBroken: true };
}

export async function POST(request: Request): Promise<Response> {
  let body: EvaluateRequest;
  try {
    body = (await request.json()) as EvaluateRequest;
  } catch {
    return Response.json(NEUTRAL);
  }

  const {
    npcId,
    playerMessage,
    npcReply,
    presentedEvidence,
    currentTrust,
    currentSuspicion,
  } = body;

  if (!npcId || !isNPCId(npcId)) {
    return Response.json(NEUTRAL);
  }

  // Without a key the hard rules still carry the critical path.
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(applyHardRules(NEUTRAL, npcId, presentedEvidence));
  }

  const npc = NPC_ROSTER[npcId];
  const presented = presentedEvidence ? EVIDENCE[presentedEvidence] : null;

  const prompt = [
    `SUSPECT: ${npc.name} (${npc.role}).`,
    `Evidence that contradicts their alibi: ${
      npc.contradictedBy.length
        ? npc.contradictedBy.map((id) => EVIDENCE[id].name).join(", ")
        : "none"
    }.`,
    `Current trust: ${currentTrust}. Current suspicion: ${currentSuspicion}.`,
    presented
      ? `EVIDENCE PRESENTED THIS TURN: ${presented.name} — ${presented.desc}`
      : "No evidence presented this turn.",
    "",
    `DETECTIVE SAID: ${playerMessage}`,
    `SUSPECT REPLIED: ${npcReply}`,
  ].join("\n");

  try {
    const { object } = await generateObject({
      model: anthropic(EVALUATOR_MODEL),
      schema: evaluationSchema,
      system: EVALUATOR_SYSTEM,
      prompt,
    });

    return Response.json(applyHardRules(object, npcId, presentedEvidence));
  } catch (error) {
    console.error(`[npc/evaluate] failed for ${npcId}`, error);
    return Response.json(applyHardRules(NEUTRAL, npcId, presentedEvidence));
  }
}
