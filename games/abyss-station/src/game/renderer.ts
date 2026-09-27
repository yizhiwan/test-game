import { PLAYER_RADIUS } from '../../shared/constants';
import { ALARM, ROOMS, WALKABLE, WORLD } from '../../shared/map';
import { VENTS } from '../../shared/sabotage';
import { InputController, type Joystick } from './input';

export interface DrawPlayer {
  id: string;
  x: number;
  y: number;
  name: string;
  color: string;
  facing: 1 | -1;
  moving: boolean;
  isSelf: boolean;
  ghost: boolean;
  /** Name tag in red: shown to mimics for their partners. */
  mimic: boolean;
}

export interface DrawStation {
  x: number;
  y: number;
  /** One of your unfinished tasks: glows. */
  active: boolean;
}

export interface DrawPanel {
  x: number;
  y: number;
  done: boolean;
  held: boolean;
}

export interface DrawBody {
  x: number;
  y: number;
  color: string;
}

export interface Frame {
  width: number; // CSS pixels
  height: number;
  scale: number; // world units -> CSS pixels
  camX: number;
  camY: number;
  time: number; // seconds
  players: DrawPlayer[];
  bodies: DrawBody[];
  stations: DrawStation[];
  panels: DrawPanel[];
  /** Local lamp radius in world units (matches what the server sends). */
  vision: number;
  /** Lights sabotaged: the whole station goes red and dim. */
  lightsOut: boolean;
  critical: boolean;
  /** Local diver is a ghost: no lamp falloff, the dark doesn't matter anymore. */
  ghostView: boolean;
  joystick: Joystick | null;
}

const WALL = 16;

// Marine snow: fixed pseudo-random specks that drift slowly downward.
const SNOW = Array.from({ length: 260 }, (_, i) => {
  const r = (n: number) => {
    const s = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  return { x: r(1) * WORLD.w, y: r(2) * WORLD.h, size: 0.6 + r(3) * 1.6, speed: 4 + r(4) * 10, phase: r(5) * 6.28 };
});

export function drawFrame(ctx: CanvasRenderingContext2D, f: Frame): void {
  const { width, height, scale } = f;

  ctx.fillStyle = '#010a14';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-f.camX, -f.camY);

  drawSnow(ctx, f.time, false);
  drawStation(ctx, f.time);

  drawAlarm(ctx, f.time);
  for (const v of VENTS) drawVent(ctx, v.x, v.y);
  for (const st of f.stations) drawStationConsole(ctx, st, f.time);
  for (const pn of f.panels) drawPanel(ctx, pn, f.time);
  for (const b of f.bodies) drawBody(ctx, b);

  const sorted = [...f.players].sort((a, b) => a.y - b.y);
  for (const p of sorted) {
    ctx.globalAlpha = p.ghost ? 0.45 : 1;
    drawDiver(ctx, p, f.time);
  }
  ctx.globalAlpha = 1;
  for (const p of sorted) drawNameTag(ctx, p);

  ctx.restore();

  if (!f.ghostView) drawDarkness(ctx, f);
  if (f.critical) {
    // Red emergency wash that pulses with the klaxon.
    ctx.fillStyle = `rgba(255, 30, 40, ${0.1 + Math.max(0, Math.sin(f.time * Math.PI * 2)) * 0.12})`;
    ctx.fillRect(0, 0, f.width, f.height);
  }
  if (f.joystick) drawJoystick(ctx, f.joystick);
}

function drawSnow(ctx: CanvasRenderingContext2D, time: number, inside: boolean): void {
  ctx.fillStyle = inside ? 'rgba(170, 220, 255, 0.10)' : 'rgba(170, 220, 255, 0.35)';
  for (const s of SNOW) {
    const y = (s.y + time * s.speed) % WORLD.h;
    const x = s.x + Math.sin(time * 0.5 + s.phase) * 8;
    ctx.beginPath();
    ctx.arc(x, y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStation(ctx: CanvasRenderingContext2D, time: number): void {
  // Hull: every walkable rect, grown by the wall thickness. Drawing all hulls
  // first and all floors second leaves walls only on the outline of the union.
  ctx.fillStyle = '#2a4a5c';
  for (const r of WALKABLE) ctx.fillRect(r.x - WALL, r.y - WALL, r.w + WALL * 2, r.h + WALL * 2);
  ctx.fillStyle = '#16303e';
  for (const r of WALKABLE) ctx.fillRect(r.x - WALL / 2, r.y - WALL / 2, r.w + WALL, r.h + WALL);

  for (const r of WALKABLE) {
    ctx.fillStyle = '#0b1f2b';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  // Deck plating grid.
  ctx.strokeStyle = 'rgba(120, 190, 220, 0.06)';
  ctx.lineWidth = 1;
  for (const r of WALKABLE) {
    ctx.beginPath();
    for (let x = Math.ceil(r.x / 50) * 50; x < r.x + r.w; x += 50) {
      ctx.moveTo(x, r.y);
      ctx.lineTo(x, r.y + r.h);
    }
    for (let y = Math.ceil(r.y / 50) * 50; y < r.y + r.h; y += 50) {
      ctx.moveTo(r.x, y);
      ctx.lineTo(r.x + r.w, y);
    }
    ctx.stroke();
  }

  for (const room of ROOMS) {
    // Portholes along the top wall, glowing faintly.
    for (let x = room.x + 70; x < room.x + room.w - 40; x += 140) {
      const glow = 0.35 + Math.sin(time * 1.3 + x) * 0.1;
      ctx.fillStyle = '#2a4a5c';
      ctx.beginPath();
      ctx.arc(x, room.y - WALL / 2, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(80, 200, 255, ${glow})`;
      ctx.beginPath();
      ctx.arc(x, room.y - WALL / 2, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(140, 210, 240, 0.28)';
    ctx.font = '600 22px "Exo 2", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(room.name.toUpperCase(), room.x + 18, room.y + 16);
  }

  // Moon pool: open water in the middle of the deck (decorative for now).
  const pool = ROOMS.find((r) => r.id === 'moonpool');
  if (pool) {
    const cx = pool.x + pool.w / 2;
    const cy = pool.y + pool.h / 2 + 20;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 110);
    g.addColorStop(0, '#0a4d6e');
    g.addColorStop(1, '#062838');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#2a4a5c';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 150, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = `rgba(120, 220, 255, ${0.15 + Math.sin(time * 2) * 0.05})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 90 + Math.sin(time) * 10, 50 + Math.sin(time) * 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawAlarm(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.fillStyle = '#23404f';
  ctx.strokeStyle = '#3d6275';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(ALARM.x, ALARM.y, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const pulse = 0.6 + Math.sin(time * 3) * 0.2;
  ctx.fillStyle = `rgba(255, 70, 70, ${pulse})`;
  ctx.beginPath();
  ctx.arc(ALARM.x, ALARM.y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a2d38';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawVent(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#0f222c';
  ctx.strokeStyle = '#3d6275';
  ctx.lineWidth = 3;
  roundRect(ctx, -22, -15, 44, 30, 4);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#2a4a5c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = -12; i <= 12; i += 8) {
    ctx.moveTo(i, -10);
    ctx.lineTo(i, 10);
  }
  ctx.stroke();
  ctx.restore();
}

function drawPanel(ctx: CanvasRenderingContext2D, p: DrawPanel, time: number): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  const blink = p.done ? 1 : 0.5 + Math.max(0, Math.sin(time * 8)) * 0.5;
  const color = p.done ? '#3ee6c8' : '#ff4d5a';
  ctx.shadowColor = color;
  ctx.shadowBlur = p.done ? 10 : 26 * blink;
  ctx.fillStyle = '#2a1016';
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  roundRect(ctx, -22, -22, 44, 44, 8);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.globalAlpha = blink;
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.done ? '✓' : p.held ? '…' : '!', 0, 1);
  ctx.restore();
}

function drawStationConsole(ctx: CanvasRenderingContext2D, st: DrawStation, time: number): void {
  ctx.save();
  ctx.translate(st.x, st.y);
  if (st.active) {
    const glow = 0.45 + Math.sin(time * 4) * 0.25;
    ctx.shadowColor = `rgba(255, 212, 59, ${glow})`;
    ctx.shadowBlur = 22;
  }
  ctx.fillStyle = '#1f3b4a';
  ctx.strokeStyle = st.active ? '#ffd43b' : '#3d6275';
  ctx.lineWidth = 3;
  roundRect(ctx, -20, -16, 40, 30, 5);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = st.active ? '#ffd43b' : '#4dabf7';
  ctx.globalAlpha = st.active ? 0.9 : 0.35;
  ctx.fillRect(-13, -9, 26, 12);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawBody(ctx: CanvasRenderingContext2D, b: DrawBody): void {
  const r = PLAYER_RADIUS;
  ctx.save();
  ctx.translate(b.x, b.y);
  // A dark cloud of ink/blood in the water around the body.
  ctx.fillStyle = 'rgba(90, 0, 20, 0.55)';
  ctx.beginPath();
  ctx.ellipse(4, 6, r * 1.9, r * 1.1, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = b.color;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 2.5;
  roundRect(ctx, -r * 0.9, -r, r * 1.8, r * 2, r * 0.8);
  ctx.fill();
  ctx.stroke();
  // Cracked visor.
  ctx.fillStyle = '#4b6b78';
  ctx.beginPath();
  ctx.ellipse(-r * 0.2, -r * 0.35, r * 0.5, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d8f1fb';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.5);
  ctx.lineTo(-r * 0.2, -r * 0.3);
  ctx.lineTo(0, -r * 0.55);
  ctx.stroke();
  ctx.restore();
}

function drawDiver(ctx: CanvasRenderingContext2D, p: DrawPlayer, time: number): void {
  const bob = p.moving ? Math.abs(Math.sin(time * 12)) * 3 : Math.sin(time * 2) * 1;
  const r = PLAYER_RADIUS;

  ctx.save();
  ctx.translate(p.x, p.y);

  if (!p.ghost) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, r + 4, r * 0.9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(0, -bob);
  ctx.scale(p.facing, 1);

  // Oxygen tank on the back.
  ctx.fillStyle = '#8a9ba8';
  roundRect(ctx, -r - 6, -r * 0.6, 10, r * 1.4, 4);
  ctx.fill();

  // Suit body.
  ctx.fillStyle = p.color;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = 2.5;
  roundRect(ctx, -r, -r * 1.2, r * 2, r * 2.3, r * 0.9);
  ctx.fill();
  ctx.stroke();

  // Boots.
  const stride = p.moving ? Math.sin(time * 12) * 3 : 0;
  ctx.fillStyle = p.color;
  roundRect(ctx, -r * 0.8, r * 0.8 + stride, r * 0.65, 8, 3);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, r * 0.15, r * 0.8 - stride, r * 0.65, 8, 3);
  ctx.fill();
  ctx.stroke();

  // Helmet visor with a lamp glint.
  ctx.fillStyle = '#9fe3ff';
  ctx.strokeStyle = '#27414f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(r * 0.3, -r * 0.45, r * 0.62, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.beginPath();
  ctx.ellipse(r * 0.5, -r * 0.6, r * 0.2, r * 0.1, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawNameTag(ctx: CanvasRenderingContext2D, p: DrawPlayer): void {
  ctx.font = '600 15px "Exo 2", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 8, 16, 0.85)';
  ctx.fillStyle = p.mimic ? '#ff6b6b' : p.isSelf ? '#ffffff' : '#cfe8f5';
  const y = p.y - PLAYER_RADIUS * 1.6;
  ctx.strokeText(p.name, p.x, y);
  ctx.fillText(p.name, p.x, y);
}

function drawDarkness(ctx: CanvasRenderingContext2D, f: Frame): void {
  // Helmet-lamp falloff around the local diver.
  const cx = f.width / 2;
  const cy = f.height / 2;
  // The lamp fades to black right where the server stops sending players,
  // so nobody pops in or out of view.
  const inner = f.vision * 0.55 * f.scale;
  const outer = f.vision * f.scale;
  const tint = f.lightsOut ? '10, 0, 2' : '0, 6, 14';
  const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  g.addColorStop(0, `rgba(${tint}, 0)`);
  g.addColorStop(0.7, `rgba(${tint}, 0.75)`);
  g.addColorStop(1, `rgba(${tint}, 0.97)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, f.width, f.height);
}

function drawJoystick(ctx: CanvasRenderingContext2D, j: Joystick): void {
  ctx.strokeStyle = 'rgba(160, 225, 255, 0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(j.originX, j.originY, InputController.JOYSTICK_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(160, 225, 255, 0.5)';
  ctx.beginPath();
  ctx.arc(j.x, j.y, 24, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
