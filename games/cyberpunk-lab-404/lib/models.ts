/**
 * Model provider, in one place so swapping it is a one-file change.
 *
 * The two API routes never import a provider package directly — they only
 * import `dialogueModel`, `evaluatorModel` and `hasApiKey` from here. To try
 * a different provider (Anthropic, Groq, a local Ollama server), install its
 * `@ai-sdk/*` package and change the three exports below; nothing in
 * app/api/npc/* needs to know.
 *
 * Currently wired to Google's Gemini models, which have a real free tier: a
 * key from https://aistudio.google.com/apikey costs nothing and needs no
 * card, unlike Anthropic's pay-per-token API.
 *
 * DIALOGUE runs the characters and wants voice and restraint.
 * EVALUATOR scores each exchange and runs on every turn, so it is the
 * smaller, cheaper model — Flash-Lite over Flash.
 */

import { google } from "@ai-sdk/google";

/** Env var this provider reads for its key. */
const API_KEY_ENV = "GOOGLE_GENERATIVE_AI_API_KEY";

/** Drives NPC dialogue. */
export const dialogueModel = google("gemini-3.6-flash");

/** Scores trust and suspicion deltas after each exchange. */
export const evaluatorModel = google("gemini-3.5-flash-lite");

/** How many prior turns to replay as context. */
export const HISTORY_WINDOW = 10;

/**
 * True once a usable key is configured.
 * Both routes fall back to scripted behaviour when this is false, so the game
 * stays fully playable with no key at all.
 */
export function hasApiKey(): boolean {
  return Boolean(process.env[API_KEY_ENV]);
}
