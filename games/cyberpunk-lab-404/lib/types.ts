/**
 * Core domain types for CYBERPUNK LAB 404.
 *
 * Static content lives in `lib/caseData.ts`; mutable run state lives in the
 * three stores under `stores/`.
 */

/* ── Identifiers ───────────────────────────────────────────── */

/** Every physical clue the player can bag. */
export type EvidenceId =
  | "bloody_keycard"
  | "encrypted_drive"
  | "reflection_log"
  | "access_code";

/** Every examinable point inside Lab 404. */
export type HotspotId = "corpse" | "desk" | "terminal" | "vent" | "window";

/** Every character the player can interrogate. */
export type NPCId = "aris" | "chen" | "kai" | "nova";

/** Rooms the player can occupy. Only one ships in v1. */
export type RoomId = "lab404";

/* ── Entities ──────────────────────────────────────────────── */

/** A clue in the player's inventory. */
export interface Evidence {
  id: EvidenceId;
  name: string;
  icon: string;
  desc: string;
  /** Collecting this clue makes the named NPC reachable. */
  unlocksNPC?: NPCId;
}

/** An interactive point in the room. */
export interface Hotspot {
  id: HotspotId;
  label: string;
  icon: string;
  description: string;
  yieldsEvidence?: EvidenceId;
  /** Stays locked until the named hotspot has been examined. */
  requiresFirst?: HotspotId;
  /** Shown instead of `description` while still locked. */
  lockedMessage?: string;
  /** Percentage position on the lab illustration. */
  position: { x: number; y: number };
  /** Examining this navigates away instead of opening the examine modal. */
  navigatesTo?: string;
}

/** A character driven by an LLM system prompt. */
export interface NPC {
  id: NPCId;
  name: string;
  role: string;
  avatar: string;
  systemPrompt: string;
  startingTrust: number;
  location: string;
  /** Evidence that contradicts this character's alibi. */
  contradictedBy: EvidenceId[];
}

/* ── Dialogue ──────────────────────────────────────────────── */

export type ChatRole = "player" | "npc";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  /** True while tokens are still arriving for this message. */
  isStreaming?: boolean;
}

/** How a character is holding up under questioning. */
export type NPCEmotionalState = "calm" | "defensive" | "hostile" | "broken";

/** Per-character interrogation state. */
export interface NPCRuntimeState {
  trust: number;
  suspicion: number;
  history: ChatMessage[];
  revealedClues: string[];
  alibiBroken: boolean;
  lockedOut: boolean;
  emotionalState: NPCEmotionalState;
}

/** Shape returned by the evaluator model. */
export interface Evaluation {
  trustDelta: number;
  suspicionDelta: number;
  revealedClue: string | null;
  npcEmotionalState: NPCEmotionalState;
  alibiBroken: boolean;
}

/* ── Flow ──────────────────────────────────────────────────── */

export type GamePhase = "title" | "room" | "dialogue" | "terminal" | "ending";

export type EndingType =
  | "win_murder"
  | "win_escape"
  | "lose_wrong"
  | "lose_time";

/* ── UI ────────────────────────────────────────────────────── */

/** A transient notification shown in the corner. */
export interface Toast {
  id: string;
  message: string;
  tone: "info" | "success" | "danger";
}
