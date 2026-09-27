export type TaskKind = 'cables' | 'calibrate' | 'valve' | 'samples' | 'filter';

export interface TaskStation {
  id: string;
  kind: TaskKind;
  label: string;
  room: string;
  x: number;
  y: number;
}

/** Shortest believable time to finish each mini-game; faster completions are rejected. */
export const TASK_MIN_MS: Record<TaskKind, number> = {
  cables: 1500,
  calibrate: 2000,
  valve: 2800,
  samples: 1500,
  filter: 1500,
};

export const TASK_RANGE = 90;
export const TASKS_PER_DIVER = 5;

export const STATIONS: TaskStation[] = [
  { id: 'mess-cables', kind: 'cables', label: 'Rewire galley power', room: 'Mess Hall', x: 1520, y: 480 },
  { id: 'lab-samples', kind: 'samples', label: 'Sort specimens', room: 'Specimen Lab', x: 350, y: 260 },
  { id: 'lab-filter', kind: 'filter', label: 'Clear tank filter', room: 'Specimen Lab', x: 620, y: 440 },
  { id: 'sonar-calibrate', kind: 'calibrate', label: 'Calibrate sonar', room: 'Sonar', x: 2250, y: 260 },
  { id: 'sonar-cables', kind: 'cables', label: 'Patch sonar array', room: 'Sonar', x: 2000, y: 440 },
  { id: 'life-filter', kind: 'filter', label: 'Clear O₂ scrubber', room: 'Life Support', x: 250, y: 850 },
  { id: 'life-valve', kind: 'valve', label: 'Bleed CO₂ valve', room: 'Life Support', x: 470, y: 1050 },
  { id: 'moonpool-cables', kind: 'cables', label: 'Reconnect winch', room: 'Moon Pool', x: 1100, y: 1130 },
  { id: 'generator-valve', kind: 'valve', label: 'Vent thermal pressure', room: 'Thermal Generator', x: 2350, y: 850 },
  { id: 'generator-calibrate', kind: 'calibrate', label: 'Tune turbine', room: 'Thermal Generator', x: 2380, y: 1080 },
  { id: 'medbay-samples', kind: 'samples', label: 'Sort blood samples', room: 'Medbay', x: 450, y: 1450 },
  { id: 'pressure-valve', kind: 'valve', label: 'Equalize hull pressure', room: 'Pressure Control', x: 1450, y: 1620 },
  { id: 'comms-calibrate', kind: 'calibrate', label: 'Align antenna', room: 'Comms', x: 2150, y: 1600 },
];

export const STATION_BY_ID = new Map(STATIONS.map((s) => [s.id, s]));
