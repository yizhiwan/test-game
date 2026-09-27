export type SabotageKind = 'lights' | 'o2' | 'breach';

export interface Panel {
  id: string;
  room: string;
  x: number;
  y: number;
}

export interface SabotageDef {
  kind: SabotageKind;
  label: string;
  /** Critical sabotages kill the station unless fixed in time. */
  timeLimitMs: number | null;
  /** Both panels must be held at the same moment (hull breach). */
  simultaneous: boolean;
  panels: Panel[];
}

export const SABOTAGES: Record<SabotageKind, SabotageDef> = {
  lights: {
    kind: 'lights',
    label: 'Lights out',
    timeLimitMs: null,
    simultaneous: false,
    panels: [{ id: 'lights-gen', room: 'Thermal Generator', x: 2250, y: 1000 }],
  },
  o2: {
    kind: 'o2',
    label: 'O₂ leak',
    timeLimitMs: 40_000,
    simultaneous: false,
    panels: [
      { id: 'o2-life', room: 'Life Support', x: 340, y: 1000 },
      { id: 'o2-sonar', room: 'Sonar', x: 2280, y: 430 },
    ],
  },
  breach: {
    kind: 'breach',
    label: 'Hull breach',
    timeLimitMs: 45_000,
    simultaneous: true,
    panels: [
      { id: 'breach-pressure', room: 'Pressure Control', x: 1150, y: 1620 },
      { id: 'breach-moonpool', room: 'Moon Pool', x: 1520, y: 1120 },
    ],
  },
};

export const PANEL_RANGE = 90;
/** How long someone must hold a non-simultaneous panel to fix it. */
export const PANEL_HOLD_MS = 1800;
export const FIRST_SABOTAGE_COOLDOWN_MS = 15_000;
export const SABOTAGE_COOLDOWN_MS = 30_000;

export interface Vent {
  id: string;
  room: string;
  x: number;
  y: number;
  links: string[];
}

const group = (vents: Omit<Vent, 'links'>[]): Vent[] =>
  vents.map((v) => ({ ...v, links: vents.filter((o) => o.id !== v.id).map((o) => o.id) }));

// Three separate networks: west, east and the central spine.
export const VENTS: Vent[] = [
  ...group([
    { id: 'vent-lab', room: 'Specimen Lab', x: 560, y: 220 },
    { id: 'vent-life', room: 'Life Support', x: 200, y: 1060 },
    { id: 'vent-medbay', room: 'Medbay', x: 700, y: 1600 },
  ]),
  ...group([
    { id: 'vent-sonar', room: 'Sonar', x: 1960, y: 220 },
    { id: 'vent-generator', room: 'Thermal Generator', x: 2060, y: 1100 },
    { id: 'vent-comms', room: 'Comms', x: 1870, y: 1600 },
  ]),
  ...group([
    { id: 'vent-mess', room: 'Mess Hall', x: 1080, y: 500 },
    { id: 'vent-moonpool', room: 'Moon Pool', x: 1520, y: 880 },
    { id: 'vent-pressure', room: 'Pressure Control', x: 1500, y: 1450 },
  ]),
];

export const VENT_BY_ID = new Map(VENTS.map((v) => [v.id, v]));
export const VENT_RANGE = 80;

/** Vision radius in world units. Walls don't block sight; distance does. */
export const VISION = { diver: 430, diverLightsOut: 150, mimic: 560 };
/** Players are sent a little past the lamp's edge so they fade in, not pop. */
export const VISION_MARGIN = 50;
