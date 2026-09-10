/**
 * Model choices, in one place so they are easy to swap.
 *
 * DIALOGUE runs the characters and wants voice and restraint.
 * EVALUATOR scores each exchange and runs on every turn, so it is the cheap,
 * fast model.
 */

/** Drives NPC dialogue. */
export const DIALOGUE_MODEL = "claude-sonnet-5";

/** Scores trust and suspicion deltas after each exchange. */
export const EVALUATOR_MODEL = "claude-haiku-4-5";

/** How many prior turns to replay as context. */
export const HISTORY_WINDOW = 10;
