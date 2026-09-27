import type { BodySnap, PlayerSnap, Snapshot } from '../../shared/protocol';

const INTERP_DELAY_MS = 100;
const BUFFER_SIZE = 30;

interface Received {
  at: number; // local receive time
  players: Map<string, PlayerSnap>;
  bodies: BodySnap[];
}

export interface Interpolated {
  x: number;
  y: number;
  ghost: boolean;
}

/**
 * Buffers server snapshots and returns other players' positions a little in
 * the past, interpolated between the two snapshots around that moment. This
 * smooths the 30 Hz server tick and network jitter into 60 fps motion.
 */
export class SnapshotBuffer {
  private buf: Received[] = [];

  push(s: Snapshot): void {
    this.buf.push({ at: performance.now(), players: new Map(s.players.map((p) => [p.id, p])), bodies: s.bodies });
    if (this.buf.length > BUFFER_SIZE) this.buf.shift();
  }

  latest(id: string): PlayerSnap | undefined {
    return this.buf.at(-1)?.players.get(id);
  }

  bodies(): BodySnap[] {
    return this.buf.at(-1)?.bodies ?? [];
  }

  interpolated(now: number): Map<string, Interpolated> {
    const out = new Map<string, Interpolated>();
    if (this.buf.length === 0) return out;
    const target = now - INTERP_DELAY_MS;
    let i = this.buf.length - 1;
    while (i > 0 && this.buf[i - 1].at > target) i--;
    const b = this.buf[i];
    const a = i > 0 ? this.buf[i - 1] : b;
    const span = b.at - a.at;
    const t = span > 0 ? Math.min(1, Math.max(0, (target - a.at) / span)) : 1;
    for (const [id, pb] of b.players) {
      // A kill teleports the killer onto the body: don't glide across the map.
      const pa = a.players.get(id);
      const jump = !pa || Math.hypot(pb.x - pa.x, pb.y - pa.y) > 150;
      const from = jump ? pb : pa;
      out.set(id, { x: from.x + (pb.x - from.x) * t, y: from.y + (pb.y - from.y) * t, ghost: pb.ghost });
    }
    return out;
  }
}
