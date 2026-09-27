import { socket } from './socket';

// The access code unlocks playing with friends and Gemini bot chat. It's
// remembered per browser so friends only type it once; the server re-checks
// it on every connection.
const ACCESS_KEY = 'abyss.access';

export function savedAccessCode(): string {
  try {
    return localStorage.getItem(ACCESS_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveAccessCode(code: string): void {
  try {
    localStorage.setItem(ACCESS_KEY, code);
  } catch {
    // Storage blocked: they'll just have to enter it again next visit.
  }
}

/** Unlocks this connection. `done` gets an error message, or nothing on success. */
export function unlock(code: string, done: (error?: string) => void): void {
  socket.emit('access:unlock', code, (r) => {
    if (r.ok && code.trim()) saveAccessCode(code.trim());
    done(r.ok ? undefined : r.error);
  });
}
