import { PLAYER_RADIUS, PLAYER_SPEED } from './constants.js';
import { ROOMS, WALKABLE, WORLD, type Room } from './map.js';

export interface Vec {
  x: number;
  y: number;
}

export interface MoveInput {
  dx: number;
  dy: number;
}

/** True when a player-sized circle centred here fits inside some walkable rect. */
export function isWalkable(x: number, y: number): boolean {
  const r = PLAYER_RADIUS;
  return WALKABLE.some((w) => x >= w.x + r && x <= w.x + w.w - r && y >= w.y + r && y <= w.y + w.h - r);
}

/** Rejects non-finite values and caps the vector at length 1. */
export function sanitizeInput(dx: unknown, dy: unknown): MoveInput {
  if (typeof dx !== 'number' || typeof dy !== 'number' || !Number.isFinite(dx) || !Number.isFinite(dy)) {
    return { dx: 0, dy: 0 };
  }
  const len = Math.hypot(dx, dy);
  return len > 1 ? { dx: dx / len, dy: dy / len } : { dx, dy };
}

/**
 * Advances a position by one input over dt seconds. Shared by the server
 * (authoritative) and the client (local prediction), so both agree. When the
 * full move hits a wall, each axis is tried alone so players slide along it.
 */
export function step(pos: Vec, input: MoveInput, dt: number, ghost = false): Vec {
  if (input.dx === 0 && input.dy === 0) return pos;
  const nx = pos.x + input.dx * PLAYER_SPEED * dt;
  const ny = pos.y + input.dy * PLAYER_SPEED * dt;
  // Ghosts drift through walls but stay inside the world.
  if (ghost) {
    return { x: Math.min(WORLD.w, Math.max(0, nx)), y: Math.min(WORLD.h, Math.max(0, ny)) };
  }
  if (isWalkable(nx, ny)) return { x: nx, y: ny };
  if (input.dx !== 0 && isWalkable(nx, pos.y)) return { x: nx, y: pos.y };
  if (input.dy !== 0 && isWalkable(pos.x, ny)) return { x: pos.x, y: ny };
  return pos;
}

export function roomAt(x: number, y: number): Room | undefined {
  return ROOMS.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
