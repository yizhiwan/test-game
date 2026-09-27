export type Phase = 'lobby' | 'playing' | 'meeting' | 'ended';
import type { SabotageKind } from './sabotage.js';

export type Role = 'diver' | 'mimic';

export interface PublicPlayer {
  id: string;
  name: string;
  color: number;
  bot: boolean;
  /** Dead as far as this viewer is allowed to know. */
  dead: boolean;
}

export interface VoteResult {
  /** voterId -> targetId or 'skip' */
  votes: Record<string, string>;
  ejectedId: string | null;
  ejectedWasMimic: boolean;
  tie: boolean;
}

export interface MeetingState {
  id: number;
  stage: 'discuss' | 'vote' | 'result';
  remainingMs: number;
  kind: 'body' | 'alarm';
  callerId: string;
  callerName: string;
  victimName: string | null;
  location: string | null;
  /** Who has voted, never for whom, until the result stage. */
  voted: string[];
  result: VoteResult | null;
}

export interface GameOver {
  winner: Role;
  reason: string;
  roles: Record<string, Role>;
}

/** Private to one player: never broadcast. */
export interface SelfState {
  role: Role;
  alive: boolean;
  /** Filled only for mimics: their partners. */
  mimicIds: string[];
  killCooldownMs: number;
  alarmsLeft: number;
  alarmCooldownMs: number;
  /** Assigned station ids. For mimics these are fake and can't be done. */
  tasks: { id: string; done: boolean }[];
  /** Lamp radius in world units; nothing outside it is sent to you. */
  visionRadius: number;
  sabotageCooldownMs: number;
  /** Vent id while hiding in one (mimics only). */
  vent: string | null;
}

export interface SabotageState {
  kind: SabotageKind;
  /** Null for lights; otherwise time until the station is lost. */
  remainingMs: number | null;
  panels: { id: string; done: boolean; holders: number; progress: number }[];
}

export interface TaskBar {
  done: number;
  total: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  phase: Phase;
  round: number;
  minPlayers: number;
  players: PublicPlayer[];
  meeting: MeetingState | null;
  gameOver: GameOver | null;
  taskBar: TaskBar | null;
  sabotage: SabotageState | null;
  you: SelfState | null;
}

export interface PlayerSnap {
  id: string;
  x: number;
  y: number;
  ghost: boolean;
}

export interface BodySnap {
  id: string;
  x: number;
  y: number;
  color: number;
}

export interface Snapshot {
  t: number;
  players: PlayerSnap[];
  bodies: BodySnap[];
}

export interface ChatMessage {
  id: number;
  meetingId: number;
  fromId: string;
  name: string;
  color: number;
  text: string;
  ghost: boolean;
}

export type Ack<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface JoinResult {
  code: string;
  playerId: string;
}

export interface ClientToServer {
  'room:create': (p: { name: string }, ack: (r: Ack<JoinResult>) => void) => void;
  'room:solo': (p: { name: string }, ack: (r: Ack<JoinResult>) => void) => void;
  'room:join': (p: { code: string; name: string }, ack: (r: Ack<JoinResult>) => void) => void;
  'room:leave': () => void;
  'lobby:color': (color: number) => void;
  'bot:add': () => void;
  'bot:remove': () => void;
  'game:start': (ack: (r: Ack) => void) => void;
  'game:end': () => void;
  input: (i: { dx: number; dy: number }) => void;
  kill: (targetId: string) => void;
  report: () => void;
  alarm: () => void;
  vote: (target: string) => void;
  chat: (text: string) => void;
  'task:start': (id: string) => void;
  'task:complete': (id: string) => void;
  sabotage: (kind: SabotageKind) => void;
  'fix:hold': (panelId: string, holding: boolean) => void;
  'vent:enter': () => void;
  'vent:move': (ventId: string) => void;
  'vent:exit': () => void;
}

export interface ServerToClient {
  'room:state': (s: RoomState) => void;
  snapshot: (s: Snapshot) => void;
  chat: (m: ChatMessage) => void;
}
