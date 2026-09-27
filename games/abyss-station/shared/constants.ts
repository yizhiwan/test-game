export const TICK_RATE = 30;
export const PLAYER_SPEED = 260; // world units per second
export const PLAYER_RADIUS = 18;
export const MAX_PLAYERS = 10;
// The server can lower this for local testing with ABYSS_MIN_PLAYERS.
export const MIN_PLAYERS_TO_START = 4;
export const NAME_MAX_LENGTH = 12;

export const COLORS = [
  { name: 'Coral', hex: '#ff6b6b' },
  { name: 'Kelp', hex: '#3ddc84' },
  { name: 'Tide', hex: '#4dabf7' },
  { name: 'Sand', hex: '#ffd43b' },
  { name: 'Urchin', hex: '#b04fd0' },
  { name: 'Anemone', hex: '#f783ac' },
  { name: 'Pearl', hex: '#e9ecef' },
  { name: 'Slate', hex: '#6c7a89' },
  { name: 'Lagoon', hex: '#20c997' },
  { name: 'Amber', hex: '#ff922b' },
  { name: 'Squid', hex: '#845ef7' },
  { name: 'Rust', hex: '#b5651d' },
] as const;

export const KILL_RANGE = 110;
export const REPORT_RANGE = 150;
export const ALARM_RANGE = 120;
// Other divers are drawn ~100 ms in the past, so the server allows a little
// extra reach on top of what the client showed as "in range".
export const RANGE_SLACK = 40;

export const FIRST_KILL_COOLDOWN_MS = 12_000;
export const KILL_COOLDOWN_MS = 25_000;
export const ALARMS_PER_PLAYER = 1;
export const ALARM_COOLDOWN_MS = 15_000;

export const DISCUSS_MS = 15_000;
export const VOTE_MS = 45_000;
export const RESULT_MS = 6_000;

export const CHAT_MAX_LENGTH = 140;
export const CHAT_MIN_INTERVAL_MS = 700;

export function mimicCount(players: number): number {
  return players >= 7 ? 2 : 1;
}
