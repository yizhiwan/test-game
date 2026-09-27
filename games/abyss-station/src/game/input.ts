import type { MoveInput } from '../../shared/physics';

const KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

const JOYSTICK_RADIUS = 60;

export interface Joystick {
  originX: number;
  originY: number;
  x: number;
  y: number;
}

/** Keyboard plus a floating drag joystick for touch (it also works with a mouse). */
export class InputController {
  private held = new Set<string>();
  private pointerId: number | null = null;
  joystick: Joystick | null = null;

  constructor(private readonly el: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerUp);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
    this.el.removeEventListener('pointerdown', this.onPointerDown);
    this.el.removeEventListener('pointermove', this.onPointerMove);
    this.el.removeEventListener('pointerup', this.onPointerUp);
    this.el.removeEventListener('pointercancel', this.onPointerUp);
  }

  read(): MoveInput {
    if (this.joystick) {
      const dx = (this.joystick.x - this.joystick.originX) / JOYSTICK_RADIUS;
      const dy = (this.joystick.y - this.joystick.originY) / JOYSTICK_RADIUS;
      const len = Math.hypot(dx, dy);
      if (len < 0.15) return { dx: 0, dy: 0 };
      return len > 1 ? { dx: dx / len, dy: dy / len } : { dx, dy };
    }
    let dx = 0;
    let dy = 0;
    for (const code of this.held) {
      dx += KEYS[code][0];
      dy += KEYS[code][1];
    }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    const len = Math.hypot(dx, dy);
    return len ? { dx: dx / len, dy: dy / len } : { dx: 0, dy: 0 };
  }

  static readonly JOYSTICK_RADIUS = JOYSTICK_RADIUS;

  private onKeyDown = (e: KeyboardEvent) => {
    if (!(e.code in KEYS)) return;
    if (e.target instanceof HTMLInputElement) return;
    e.preventDefault();
    this.held.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };

  private clear = () => {
    this.held.clear();
    this.joystick = null;
    this.pointerId = null;
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.el.setPointerCapture(e.pointerId);
    this.joystick = { originX: e.offsetX, originY: e.offsetY, x: e.offsetX, y: e.offsetY };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId || !this.joystick) return;
    // Clamp the knob to the ring so the stick stays under the thumb.
    const ox = e.offsetX - this.joystick.originX;
    const oy = e.offsetY - this.joystick.originY;
    const len = Math.hypot(ox, oy);
    const k = len > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / len : 1;
    this.joystick.x = this.joystick.originX + ox * k;
    this.joystick.y = this.joystick.originY + oy * k;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.joystick = null;
  };
}
