export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Room extends Rect {
  id: string;
  name: string;
}

export const WORLD = { w: 2600, h: 1800 };

export const ROOMS: Room[] = [
  { id: 'mess', name: 'Mess Hall', x: 1000, y: 150, w: 600, h: 400 },
  { id: 'lab', name: 'Specimen Lab', x: 250, y: 150, w: 450, h: 350 },
  { id: 'sonar', name: 'Sonar', x: 1900, y: 150, w: 450, h: 350 },
  { id: 'life', name: 'Life Support', x: 150, y: 750, w: 400, h: 350 },
  { id: 'moonpool', name: 'Moon Pool', x: 1000, y: 800, w: 600, h: 400 },
  { id: 'generator', name: 'Thermal Generator', x: 2000, y: 750, w: 450, h: 400 },
  { id: 'medbay', name: 'Medbay', x: 350, y: 1350, w: 450, h: 300 },
  { id: 'pressure', name: 'Pressure Control', x: 1050, y: 1400, w: 500, h: 280 },
  { id: 'comms', name: 'Comms', x: 1800, y: 1350, w: 450, h: 300 },
];

const CORRIDOR_WIDTH = 110;

// A straight corridor between two points that sit well inside the rooms it
// joins, so its ends overlap both rooms and the walkable area stays connected.
function corridor(ax: number, ay: number, bx: number, by: number): Rect {
  const half = CORRIDOR_WIDTH / 2;
  if (ay === by) return { x: Math.min(ax, bx), y: ay - half, w: Math.abs(bx - ax), h: CORRIDOR_WIDTH };
  return { x: ax - half, y: Math.min(ay, by), w: CORRIDOR_WIDTH, h: Math.abs(by - ay) };
}

export const CORRIDORS: Rect[] = [
  corridor(600, 335, 1100, 335), // Lab - Mess Hall
  corridor(1500, 335, 2000, 335), // Mess Hall - Sonar
  corridor(1300, 450, 1300, 900), // Mess Hall - Moon Pool
  corridor(455, 400, 455, 850), // Lab - Life Support
  corridor(2155, 400, 2155, 850), // Sonar - Generator
  corridor(450, 975, 1100, 975), // Life Support - Moon Pool
  corridor(1500, 975, 2100, 975), // Moon Pool - Generator
  corridor(1300, 1100, 1300, 1500), // Moon Pool - Pressure Control
  corridor(455, 1000, 455, 1450), // Life Support - Medbay
  corridor(700, 1515, 1150, 1515), // Medbay - Pressure Control
  corridor(1450, 1515, 1900, 1515), // Pressure Control - Comms
  corridor(2105, 1050, 2105, 1450), // Generator - Comms
];

export const WALKABLE: Rect[] = [...ROOMS, ...CORRIDORS];

export const SPAWN = { x: 1300, y: 350 };

// The emergency alarm sits on the Mess Hall table; everyone spawns around it.
export const ALARM = { x: 1300, y: 350 };
