/**
 * Invite codes unlock playing with friends and Gemini bot chat. They're issued
 * per friend at eonelabs.my/admin/ai-codes (game "Abyss Station") and checked
 * there, server to server, so each can be labelled, expired or revoked on its
 * own. The player's IP is forwarded so eonelabs.my's guessing limit applies
 * per player, not to this whole server.
 *
 * Without ABYSS_VERIFY_TOKEN (local dev) no code is needed: everything is open.
 */

const VERIFY_URL = process.env.ABYSS_VERIFY_URL || 'https://eonelabs.my/api/internal/abyss/verify-code';
const TOKEN = (process.env.ABYSS_VERIFY_TOKEN ?? '').trim();
const TIMEOUT_MS = 5000;
const MAX_CODE_LENGTH = 32; // longer than any real code, dashes included

export const invitesRequired = Boolean(TOKEN);

const MESSAGES: Record<string, string> = {
  invalid: "That invite code didn't work.",
  revoked: 'That invite code has been revoked.',
  expired: 'That invite code has expired.',
  too_many_attempts: 'Too many tries. Wait a while and try again.',
};

/** `wrong` marks a code that matched nothing, which counts as a guess. */
export type InviteCheck = { ok: true } | { ok: false; error: string; wrong: boolean };

export async function checkInvite(rawCode: string, ip: string): Promise<InviteCheck> {
  const code = rawCode.trim().slice(0, MAX_CODE_LENGTH);
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ code, ip }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`verify endpoint returned ${res.status}`);
    const r = (await res.json()) as { valid?: boolean; reason?: string };
    if (r.valid === true) return { ok: true };
    const reason = r.reason ?? 'invalid';
    return { ok: false, error: MESSAGES[reason] ?? MESSAGES.invalid, wrong: reason === 'invalid' };
  } catch (err) {
    // Fail closed: the game stays in public mode, it never opens up.
    console.warn('[invites] code check failed:', (err as Error).message);
    return { ok: false, error: "Couldn't check the code right now. Try again in a minute.", wrong: false };
  }
}
