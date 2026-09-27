/**
 * Streaming dialogue endpoint.
 *
 * Takes the character's static persona from the case file and layers this
 * turn's dynamic context on top: what the player is carrying, what they just
 * slapped on the table, and where trust and suspicion currently sit. The
 * persona goes first so the stable prefix stays cache-friendly.
 *
 * On any failure it degrades to a canned in-voice line rather than an error,
 * because the run is on a clock and a dead character reads as a bug.
 */

import { streamText, type ModelMessage } from "ai";
import { EVIDENCE, NPC_ROSTER, isNPCId } from "@/lib/caseData";
import { getFallbackDialogue } from "@/lib/fallbackDialogues";
import { dialogueModel, hasApiKey, HISTORY_WINDOW } from "@/lib/models";
import type { ChatMessage, EvidenceId, NPCId } from "@/lib/types";

export const runtime = "edge";

interface ChatRequest {
  npcId: NPCId;
  playerMessage: string;
  presentedEvidence?: EvidenceId | null;
  inventory?: EvidenceId[];
  trust?: number;
  suspicion?: number;
  history?: ChatMessage[];
}

/** Streams a plain-text body, matching what a successful streamText returns. */
function textStream(body: string): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Dialogue-Source": "fallback",
      },
    },
  );
}

/** Everything about this turn that the static persona cannot know. */
function buildContext(req: ChatRequest): string {
  const { inventory = [], presentedEvidence, trust = 50, suspicion = 0 } = req;

  const carrying = inventory.length
    ? inventory.map((id) => EVIDENCE[id]?.name).filter(Boolean).join(", ")
    : "nothing yet";

  const lines = [
    "CURRENT SITUATION (this changes every turn; obey it over any earlier turn):",
    `- Your trust in the detective is ${trust} out of 100. Apply the TRUST RULES band that covers ${trust}.`,
    `- Your suspicion that the detective is dangerous to you is ${suspicion} out of 100.`,
    `- The detective is carrying: ${carrying}.`,
  ];

  if (presentedEvidence && EVIDENCE[presentedEvidence]) {
    const item = EVIDENCE[presentedEvidence];
    lines.push(
      `- PLAYER HAS JUST PRESENTED EVIDENCE: ${item.name} — ${item.desc} If this contradicts your alibi, react accordingly.`,
    );
  }

  return lines.join("\n");
}

export async function POST(request: Request): Promise<Response> {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return new Response("Malformed request body.", { status: 400 });
  }

  const { npcId, playerMessage, history = [] } = body;

  if (!npcId || !isNPCId(npcId)) {
    return new Response("Unknown npcId.", { status: 400 });
  }
  if (typeof playerMessage !== "string" || playerMessage.trim() === "") {
    return new Response("playerMessage is required.", { status: 400 });
  }

  const npc = NPC_ROSTER[npcId];
  const turn = history.filter((m) => m.role === "player").length;

  // No key means no point attempting the call; go straight to the canned line.
  if (!hasApiKey()) {
    return textStream(getFallbackDialogue(npcId, turn));
  }

  const recent: ModelMessage[] = history
    .slice(-HISTORY_WINDOW)
    .map((message) => ({
      role: message.role === "player" ? "user" : "assistant",
      content: message.content,
    }));

  try {
    const result = streamText({
      model: dialogueModel,
      // Persona first and unchanged, dynamic state second.
      system: `${npc.systemPrompt}\n\n${buildContext(body)}`,
      messages: [...recent, { role: "user", content: playerMessage }],
      maxOutputTokens: 300,
    });

    // streamText() never throws for a failed provider call — the request only
    // rejects once the stream is actually consumed. Doing that ourselves,
    // instead of handing result.textStream straight to toTextStreamResponse(),
    // means a failure here still lands in the fallback line below rather than
    // shipping a 200 with an empty body.
    const encoder = new TextEncoder();
    let sentAny = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const delta of result.textStream) {
            sentAny = true;
            controller.enqueue(encoder.encode(delta));
          }
        } catch (error) {
          console.error(`[npc/chat] stream error for ${npcId}`, error);
          if (!sentAny) {
            controller.enqueue(encoder.encode(getFallbackDialogue(npcId, turn)));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Dialogue-Source": "model",
      },
    });
  } catch (error) {
    console.error(`[npc/chat] request failed for ${npcId}`, error);
    return textStream(getFallbackDialogue(npcId, turn));
  }
}
