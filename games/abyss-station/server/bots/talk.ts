import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { CHAT_MAX_LENGTH } from '../../shared/constants.js';
import type { Persona } from './personas.js';

/**
 * Meeting dialogue for bots. With GOOGLE_GENERATIVE_AI_API_KEY set, each line
 * comes from Gemini (Flash-Lite: meetings need fast, cheap replies). Without
 * a key, or if a call fails or runs slow, a canned line built from the same
 * facts is used, so bots always speak.
 */

const MODEL = google('gemini-3.5-flash-lite');
const TIMEOUT_MS = 6000;

export function hasApiKey(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

export interface TalkContext {
  persona: Persona;
  role: 'diver' | 'mimic';
  partners: string[];
  /** Plain-language facts this bot knows (and, for a mimic, the lie it should tell). */
  facts: string[];
  /** Meeting headline, e.g. "Reyes found Tanaka's body in Sonar." */
  situation: string;
  /** Recent chat, oldest first, as "Name: text". */
  chat: string[];
  livingNames: string[];
  /** A canned line to use when the model is unavailable. */
  fallback: string;
}

const RULES = `You are playing Abyss Station, a social deduction game like Among Us, set on a deep-sea research base.
Divers (the crew) repair the station. One or two Mimics, creatures wearing crewmates' faces, secretly kill divers.
A meeting is happening: everyone chats, then votes someone out the moon pool (or skips).`;

/** `useModel` is false for public rooms, so strangers never spend the key's quota. */
export async function botLine(ctx: TalkContext, useModel: boolean): Promise<string> {
  if (!useModel || !hasApiKey()) return ctx.fallback;
  const goal =
    ctx.role === 'mimic'
      ? `You are SECRETLY a Mimic${ctx.partners.length ? ` (your partner: ${ctx.partners.join(', ')})` : ''}. Never admit it. Blend in, give a believable alibi, and steer suspicion onto a diver without overdoing it. Never accuse your partner.`
      : 'You are a Diver. Help the crew find the Mimic. Share what you actually know; do not invent sightings.';
  const system = [
    RULES,
    `You are ${ctx.persona.name}. Voice: ${ctx.persona.voice}.`,
    goal,
    'Reply with ONE short chat message (max 20 words), casual game-chat style. No quotes, no name prefix, no emojis, no hashtags.',
  ].join('\n\n');
  const prompt = [
    `Situation: ${ctx.situation}`,
    `Still alive: ${ctx.livingNames.join(', ')}.`,
    `What you know:\n${ctx.facts.map((f) => `- ${f}`).join('\n') || '- Nothing useful.'}`,
    ctx.chat.length ? `Chat so far:\n${ctx.chat.join('\n')}` : 'Nobody has spoken yet.',
    'Your message:',
  ].join('\n\n');
  try {
    const { text } = await generateText({
      model: MODEL,
      system,
      prompt,
      maxOutputTokens: 80,
      temperature: 0.9,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const line = clean(text, ctx.persona.name);
    return line || ctx.fallback;
  } catch (err) {
    console.warn(`[bots] ${ctx.persona.name} fell back to a canned line:`, (err as Error).message);
    return ctx.fallback;
  }
}

function clean(text: string, name: string): string {
  let line = text.trim().split('\n')[0] ?? '';
  line = line.replace(new RegExp(`^${name}\\s*:\\s*`, 'i'), '').replace(/^["'“]+|["'”]+$/g, '').trim();
  return line.slice(0, CHAT_MAX_LENGTH);
}
