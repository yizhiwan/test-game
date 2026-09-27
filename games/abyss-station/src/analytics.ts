// Google Analytics events (the gtag loader is in index.html). A no-op when GA
// is blocked or hasn't loaded, so the game never depends on it. Never send
// names, invite codes or chat: only what kind of thing happened.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export type GameEvent =
  | 'play_vs_bots'
  | 'host_room'
  | 'join_room'
  | 'invite_unlocked'
  | 'invite_rejected';

export function track(event: GameEvent): void {
  try {
    window.gtag?.('event', event, { game: 'abyss_station' });
  } catch {
    // Analytics must never break the game.
  }
}
