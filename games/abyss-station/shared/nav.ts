import { CORRIDORS, ROOMS, type Rect } from './map.js';
import type { Vec } from './physics.js';

interface Edge {
  corridor: Rect;
  a: Vec; // end inside room ra
  b: Vec; // end inside room rb
  ra: string;
  rb: string;
}

function roomIdAt(p: Vec): string | undefined {
  return ROOMS.find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)?.id;
}

function inRect(p: Vec, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

// Every corridor runs straight between two points deep inside its rooms
// (see corridor() in map.ts), so those ends are the doorways of the graph.
const EDGES: Edge[] = CORRIDORS.map((c) => {
  const horizontal = c.w > c.h;
  const a = horizontal ? { x: c.x, y: c.y + c.h / 2 } : { x: c.x + c.w / 2, y: c.y };
  const b = horizontal ? { x: c.x + c.w, y: c.y + c.h / 2 } : { x: c.x + c.w / 2, y: c.y + c.h };
  return { corridor: c, a, b, ra: roomIdAt(a)!, rb: roomIdAt(b)! };
});

/**
 * Waypoints from `from` to `to` through the room graph (breadth-first, so
 * fewest rooms, which on this map is also close to shortest). Rooms are
 * convex rectangles, so walking straight between consecutive waypoints never
 * hits a wall.
 */
export function route(from: Vec, to: Vec): Vec[] {
  const lead: Vec[] = [];
  let start = roomIdAt(from);
  if (!start) {
    // Standing in a corridor: step to whichever end is nearer first.
    const e = EDGES.find((edge) => inRect(from, edge.corridor));
    if (!e) return [to];
    const nearA = Math.hypot(from.x - e.a.x, from.y - e.a.y) <= Math.hypot(from.x - e.b.x, from.y - e.b.y);
    lead.push(nearA ? e.a : e.b);
    start = nearA ? e.ra : e.rb;
  }
  const goal = roomIdAt(to);
  if (!goal || goal === start) return [...lead, to];

  const prev = new Map<string, { room: string; enter: Vec; exit: Vec } | null>([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const room = queue.shift()!;
    if (room === goal) break;
    for (const e of EDGES) {
      for (const [here, there, p1, p2] of [
        [e.ra, e.rb, e.a, e.b],
        [e.rb, e.ra, e.b, e.a],
      ] as const) {
        if (here === room && !prev.has(there)) {
          prev.set(there, { room, enter: p1, exit: p2 });
          queue.push(there);
        }
      }
    }
  }
  const path: Vec[] = [to];
  for (let cur = goal, step = prev.get(cur); step; cur = step.room, step = prev.get(cur)) {
    path.unshift(step.enter, step.exit);
  }
  return [...lead, ...path];
}

export { roomIdAt };
