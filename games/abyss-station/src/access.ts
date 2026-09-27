import { socket } from './socket';

// An invite code unlocks playing with friends and Gemini bot chat. It's held
// only in this page's memory, never saved, so every visit (and every shared
// computer) starts locked; the same code works again until it's revoked. Within
// the open page it's re-sent on reconnect, since access is per connection and
// the server re-checks it (with eonelabs.my) every time.
let pageCode = '';

// Codes used to be kept in localStorage; clear any left behind.
try {
  localStorage.removeItem('abyss.access');
} catch {
  // Storage blocked: nothing was saved there anyway.
}

/** The code unlocked in this page, or '' if none. */
export function currentAccessCode(): string {
  return pageCode;
}

/** Unlocks this connection. `done` gets an error message, or nothing on success. */
export function unlock(code: string, done: (error?: string) => void): void {
  socket.emit('access:unlock', code, (r) => {
    if (r.ok && code.trim()) pageCode = code.trim();
    done(r.ok ? undefined : r.error);
  });
}
