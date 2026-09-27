/**
 * Canned lines used when the model call fails.
 *
 * The game is timed, so a dead API must not read as a dead character. Each
 * suspect keeps a small rotation of in-voice deflections that move nothing:
 * no trust change, no clue, no alibi crack. The player loses progress on that
 * turn, not immersion.
 */

import type { NPCId } from "./types";

const FALLBACKS: Record<NPCId, string[]> = {
  aris: [
    "I have answered that. Ask something you have not already asked me twice.",
    "The badge logs will say what I have said. Go and read them.",
    "Kenji was a colleague. Whatever you are implying, implicate it somewhere else.",
    "I am tired, and the air in here is thinning. Be specific or be elsewhere.",
    "That would be consistent with a great many things. None of them me.",
  ],
  chen: [
    "I don't, I mean, I really wasn't watching the corridor. I'm sorry.",
    "Can we do this later? If someone sees me talking to you it gets complicated.",
    "I only know what the schedules say. Kenji worked late. Everyone worked late.",
    "Please don't write my name down. Please. I need this contract.",
    "It might have been nothing. It was probably nothing. I should go.",
  ],
  kai: [
    "Query malformed. Rephrase as a records request.",
    "Insufficient data. Confidence forty-one percent. Records access remains available.",
    "Clarify. This unit does not speculate on motive.",
    "Standing by. Log retrieval requires a specific timestamp or record type.",
    "Request logged. No matching record at the requested clearance level.",
  ],
  nova: [
    "Static. Projector's chewing itself again. Ask me the shorter version.",
    "You're burning air, detective. The vent still sits wrong, in case you forgot.",
    "Signal's junk. Try again before the filing cabinet downstairs notices me.",
    "Half of that came through. The half I got wasn't a question worth my volts.",
    "I flickered. Say it again, slower, and maybe point at something useful.",
  ],
};

/** A deflection in the character's voice, rotated by turn count. */
export function getFallbackDialogue(npcId: NPCId, turn = 0): string {
  const lines = FALLBACKS[npcId];
  return lines[Math.abs(turn) % lines.length];
}

export { FALLBACKS as FALLBACK_DIALOGUES };
