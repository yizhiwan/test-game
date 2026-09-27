import { useEffect, useRef, useState } from 'react';
import { ALARM_RANGE, COLORS, KILL_RANGE, REPORT_RANGE } from '../../shared/constants';
import { ALARM } from '../../shared/map';
import { distance, roomAt, step, type MoveInput, type Vec } from '../../shared/physics';
import type { RoomState, Snapshot } from '../../shared/protocol';
import { PANEL_RANGE, SABOTAGES, VENT_BY_ID, VENT_RANGE, VENTS, VISION, type SabotageKind } from '../../shared/sabotage';
import { STATION_BY_ID, STATIONS, TASK_RANGE, type TaskStation } from '../../shared/tasks';
import { TaskModal } from '../tasks/TaskModal';
import { InputController } from '../game/input';
import { SnapshotBuffer } from '../game/net';
import { drawFrame, type DrawPlayer } from '../game/renderer';
import { socket } from '../socket';

interface Props {
  room: RoomState;
  selfId: string;
  onLeave: () => void;
}

interface Actions {
  panelId: string | null;
  canVent: boolean;
  sabotageCooldown: number;
  taskId: string | null;
  killTarget: string | null;
  killCooldown: number; // whole seconds left, 0 = ready
  canReport: boolean;
  canAlarm: boolean;
  alarmCooldown: number;
}

const NO_ACTIONS: Actions = {
  panelId: null,
  canVent: false,
  sabotageCooldown: 0,
  taskId: null,   killTarget: null,
  killCooldown: 0,
  canReport: false,
  canAlarm: false,
  alarmCooldown: 0,
};

const SNAP_DISTANCE = 120; // prediction is wrong by this much: jump to the server
const MAX_SUBSTEP = 1 / 60;

export function Game({ room, selfId, onLeave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roomRef = useRef(room);
  roomRef.current = room;
  const [location, setLocation] = useState('');
  const [actions, setActions] = useState<Actions>(NO_ACTIONS);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const [openTask, setOpenTask] = useState<TaskStation | null>(null);
  const [holding, setHolding] = useState<string | null>(null);
  const [sabotageMenu, setSabotageMenu] = useState(false);
  const frozen = useRef(false);
  // No swimming while a mini-game is open, a panel is held, or inside a vent.
  frozen.current = !!openTask || !!holding || !!room.you?.vent;
  const holdingRef = useRef(holding);
  holdingRef.current = holding;
  const [tasksOpen, setTasksOpen] = useState(true);
  const isHost = room.hostId === selfId;
  const you = room.you;

  // Server cooldowns arrive as "ms remaining"; pin them to the local clock.
  const timers = useRef({ killReadyAt: 0, alarmReadyAt: 0, sabotageReadyAt: 0 });
  useEffect(() => {
    if (!you) return;
    const now = performance.now();
    timers.current = {
      killReadyAt: now + you.killCooldownMs,
      alarmReadyAt: now + you.alarmCooldownMs,
      sabotageReadyAt: now + you.sabotageCooldownMs,
    };
  }, [you?.killCooldownMs, you?.alarmCooldownMs, you?.sabotageCooldownMs]);

  // Let go of a panel once it's fixed or the sabotage is over.
  useEffect(() => {
    if (!holding) return;
    const panel = room.sabotage?.panels.find((p) => p.id === holding);
    if (!panel || panel.done) setHolding(null);
  }, [room.sabotage, holding]);

  const doKill = () => {
    const target = actionsRef.current.killTarget;
    if (target && actionsRef.current.killCooldown === 0) socket.emit('kill', target);
  };
  const doReport = () => {
    if (actionsRef.current.canReport) socket.emit('report');
  };
  const doAlarm = () => {
    if (actionsRef.current.canAlarm && actionsRef.current.alarmCooldown === 0) socket.emit('alarm');
  };
  const doTask = () => {
    const station = actionsRef.current.taskId ? STATION_BY_ID.get(actionsRef.current.taskId) : undefined;
    if (!station || frozen.current) return;
    socket.emit('task:start', station.id);
    setOpenTask(station);
  };
  const startHold = () => {
    const panelId = actionsRef.current.panelId;
    if (!panelId || holdingRef.current) return;
    socket.emit('fix:hold', panelId, true);
    setHolding(panelId);
  };
  const stopHold = () => {
    if (!holdingRef.current) return;
    socket.emit('fix:hold', holdingRef.current, false);
    setHolding(null);
  };
  const doVent = () => {
    if (roomRef.current.you?.vent) socket.emit('vent:exit');
    else if (actionsRef.current.canVent) socket.emit('vent:enter');
  };
  const doSabotage = (kind: SabotageKind) => {
    socket.emit('sabotage', kind);
    setSabotageMenu(false);
  };
  // One "use" key: a sabotage panel (held), a task console, or the alarm.
  const doUse = () => {
    if (actionsRef.current.panelId) startHold();
    else if (actionsRef.current.taskId) doTask();
    else doAlarm();
  };
  const handlers = useRef({ doKill, doReport, doUse, doVent, stopHold });
  handlers.current = { doKill, doReport, doUse, doVent, stopHold };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement) return;
      if (e.code === 'KeyV') return handlers.current.doVent();
      if (frozen.current) return;
      if (e.code === 'KeyQ') handlers.current.doKill();
      if (e.code === 'KeyR') handlers.current.doReport();
      if (e.code === 'KeyE') handlers.current.doUse();
      if (e.code === 'KeyX' && roomRef.current.you?.role === 'mimic') setSabotageMenu((o) => !o);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyE') handlers.current.stopHold();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const input = new InputController(canvas);
    const snapshots = new SnapshotBuffer();
    const facing = new Map<string, 1 | -1>();
    const lastPos = new Map<string, Vec>();
    let self: Vec | null = null;
    let sent: MoveInput = { dx: 0, dy: 0 };
    let last = performance.now();
    let raf = 0;
    let shownLocation = '';
    let shownActions = JSON.stringify(NO_ACTIONS);

    const onSnapshot = (s: Snapshot) => snapshots.push(s);
    socket.on('snapshot', onSnapshot);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const state = roomRef.current;
      const me = state.you;
      const ghost = !!me && !me.alive;
      const mimicIds = new Set(me?.mimicIds ?? []);

      const move = frozen.current ? { dx: 0, dy: 0 } : input.read();
      if (move.dx !== sent.dx || move.dy !== sent.dy) {
        socket.emit('input', move);
        sent = move;
      }

      // Local prediction for our own diver, using the server's own physics.
      const server = snapshots.latest(selfId);
      if (server && !self) self = { x: server.x, y: server.y };
      const vent = me?.vent ? VENT_BY_ID.get(me.vent) : undefined;
      if (vent) self = { x: vent.x, y: vent.y };
      else if (self) {
        for (let t = dt; t > 0; t -= MAX_SUBSTEP) self = step(self, move, Math.min(t, MAX_SUBSTEP), ghost);
        if (server) {
          const off = Math.hypot(server.x - self.x, server.y - self.y);
          if (off > SNAP_DISTANCE) self = { x: server.x, y: server.y };
          // While standing still, settle onto the authoritative position. While
          // moving, the server trails us by one round trip, so leave it be.
          else if (move.dx === 0 && move.dy === 0 && off > 0.5) {
            self = { x: self.x + (server.x - self.x) * 0.15, y: self.y + (server.y - self.y) * 0.15 };
          }
        }
      }

      const others = snapshots.interpolated(now);
      const players: DrawPlayer[] = [];
      for (const p of state.players) {
        if (p.id === selfId && vent) continue; // hidden in the vent
        const other = others.get(p.id);
        const pos = p.id === selfId ? self : other;
        if (!pos) continue;
        const prev = lastPos.get(p.id);
        const vx = prev ? pos.x - prev.x : 0;
        const vy = prev ? pos.y - prev.y : 0;
        if (Math.abs(vx) > 0.05) facing.set(p.id, vx > 0 ? 1 : -1);
        lastPos.set(p.id, { x: pos.x, y: pos.y });
        players.push({
          id: p.id,
          x: pos.x,
          y: pos.y,
          name: p.name,
          color: COLORS[p.color]?.hex ?? '#fff',
          facing: facing.get(p.id) ?? 1,
          moving: Math.hypot(vx, vy) > 0.05,
          isSelf: p.id === selfId,
          ghost: p.id === selfId ? ghost : !!other?.ghost,
          mimic: mimicIds.has(p.id),
        });
      }
      const bodies = snapshots.bodies();

      // Which action buttons light up. The server re-checks every one.
      const next: Actions = { ...NO_ACTIONS };
      // Divers keep doing tasks as ghosts.
      if (self && me?.role === 'diver') {
        let best = TASK_RANGE;
        for (const t of me.tasks) {
          if (t.done) continue;
          const st = STATION_BY_ID.get(t.id);
          const d = st ? distance(self, st) : Infinity;
          if (d <= best) {
            best = d;
            next.taskId = t.id;
          }
        }
      }
      const sab = state.sabotage;
      if (self && me?.alive && !vent && sab) {
        let best = PANEL_RANGE;
        for (const pd of SABOTAGES[sab.kind].panels) {
          const d = distance(self, pd);
          if (d <= best && !sab.panels.find((p) => p.id === pd.id)?.done) {
            best = d;
            next.panelId = pd.id;
          }
        }
      }
      if (self && me?.alive && me.role === 'mimic') {
        next.canVent = !vent && VENTS.some((v) => distance(self!, v) <= VENT_RANGE);
        next.sabotageCooldown = Math.max(0, Math.ceil((timers.current.sabotageReadyAt - now) / 1000));
      }
      if (self && me?.alive && !vent) {
        if (me.role === 'mimic') {
          let best = KILL_RANGE;
          for (const p of players) {
            if (p.isSelf || p.ghost || mimicIds.has(p.id)) continue;
            const d = distance(self, p);
            if (d <= best) {
              best = d;
              next.killTarget = p.id;
            }
          }
          next.killCooldown = Math.max(0, Math.ceil((timers.current.killReadyAt - now) / 1000));
        }
        next.canReport = bodies.some((b) => distance(self!, b) <= REPORT_RANGE);
        next.canAlarm = me.alarmsLeft > 0 && !sab?.remainingMs && distance(self, ALARM) <= ALARM_RANGE;
        next.alarmCooldown = Math.max(0, Math.ceil((timers.current.alarmReadyAt - now) / 1000));
      }
      const key = JSON.stringify(next);
      if (key !== shownActions) {
        shownActions = key;
        setActions(next);
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = canvas.width / Math.max(width, 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFrame(ctx, {
        width,
        height,
        scale: Math.min(1.2, Math.max(0.55, Math.min(width, height) / 750)),
        camX: self?.x ?? 1300,
        camY: self?.y ?? 350,
        time: now / 1000,
        players,
        bodies: bodies.map((b) => ({ x: b.x, y: b.y, color: COLORS[b.color]?.hex ?? '#fff' })),
        ghostView: ghost,
        stations: STATIONS.map((st) => ({
          x: st.x,
          y: st.y,
          active: me?.role === 'diver' && me.tasks.some((t) => t.id === st.id && !t.done),
        })),
        panels: sab
          ? SABOTAGES[sab.kind].panels.map((pd) => {
              const ps = sab.panels.find((p) => p.id === pd.id);
              return { x: pd.x, y: pd.y, done: !!ps?.done, held: (ps?.holders ?? 0) > 0 };
            })
          : [],
        vision: me?.visionRadius ?? VISION.diver,
        lightsOut: sab?.kind === 'lights',
        critical: sab?.remainingMs != null,
        joystick: input.joystick,
      });

      const where = self ? (roomAt(self.x, self.y)?.name ?? 'Corridor') : '';
      if (where !== shownLocation) {
        shownLocation = where;
        setLocation(where);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      socket.off('snapshot', onSnapshot);
      window.removeEventListener('resize', resize);
      input.dispose();
      socket.emit('input', { dx: 0, dy: 0 });
    };
  }, [selfId]);

  const isMimic = you?.role === 'mimic';
  const alive = you?.alive ?? true;
  const inVent = you?.vent ? VENT_BY_ID.get(you.vent) : undefined;
  const sab = room.sabotage;
  const sabDef = sab ? SABOTAGES[sab.kind] : undefined;
  const heldPanel = sab?.panels.find((p) => p.id === (holding ?? actions.panelId));

  return (
    <main className="game">
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="hud top-left">
        <span className="chip">
          Station <strong>{room.code}</strong>
        </span>
        {location && <span className="chip location">{location}</span>}
        {you && (
          <span className={`chip role ${isMimic ? 'mimic' : ''}`}>
            {!alive ? 'Ghost' : isMimic ? 'Mimic' : 'Diver'}
          </span>
        )}
      </div>
      <div className="hud top-right">
        {isHost && (
          <button className="btn small" onClick={() => socket.emit('game:end')}>
            End round
          </button>
        )}
        <button className="btn small ghost" onClick={onLeave}>
          Leave
        </button>
      </div>

      {!alive && (
        <p className="hud ghost-banner">You drowned. Drift through the walls and finish your tasks for the crew.</p>
      )}

      {sab && sabDef && (
        <SabotageBanner
          key={`${sab.kind}`}
          label={sabDef.label}
          remainingMs={sab.remainingMs}
          rooms={sabDef.panels.filter((pd) => !sab.panels.find((p) => p.id === pd.id)?.done).map((pd) => pd.room)}
          simultaneous={sabDef.simultaneous}
        />
      )}

      {inVent && (
        <div className="vent-overlay">
          <p className="eyebrow">Inside the {inVent.room} vent</p>
          <div className="vent-links">
            {inVent.links.map((id) => (
              <button key={id} className="btn" onClick={() => socket.emit('vent:move', id)}>
                → {VENT_BY_ID.get(id)?.room}
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={() => socket.emit('vent:exit')}>
            Climb out (V)
          </button>
        </div>
      )}

      {sabotageMenu && isMimic && alive && (
        <div className="sabotage-menu panel">
          <p className="eyebrow">Sabotage</p>
          {(Object.keys(SABOTAGES) as SabotageKind[]).map((k) => (
            <button
              key={k}
              className="btn"
              disabled={!!sab || actions.sabotageCooldown > 0}
              onClick={() => doSabotage(k)}
            >
              {SABOTAGES[k].label}
              {SABOTAGES[k].timeLimitMs ? ` · ${SABOTAGES[k].timeLimitMs! / 1000}s` : ''}
            </button>
          ))}
          <p className="hint">
            {sab ? 'Already sabotaged.' : actions.sabotageCooldown > 0 ? `Ready in ${actions.sabotageCooldown}s` : 'Choose wisely.'}
          </p>
        </div>
      )}

      {room.taskBar && (
        <div className="hud taskbar" aria-label="Station repairs">
          <span>Station repairs</span>
          <div className="bar">
            <div style={{ width: `${(room.taskBar.done / Math.max(1, room.taskBar.total)) * 100}%` }} />
          </div>
        </div>
      )}

      {you && (
        <div className={`hud task-list ${tasksOpen ? '' : 'collapsed'}`}>
          <button className="task-list-head" onClick={() => setTasksOpen((o) => !o)}>
            {isMimic ? 'Fake tasks' : 'Tasks'} {tasksOpen ? '▾' : '▸'}
          </button>
          {tasksOpen && (
            <>
              {isMimic && <p className="hint">Loiter near these to blend in. You can't actually do them.</p>}
              <ul>
                {you.tasks.map((t) => {
                  const st = STATION_BY_ID.get(t.id);
                  return (
                    <li key={t.id} className={t.done ? 'done' : ''}>
                      <strong>{st?.room}</strong>: {st?.label}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {openTask && (
        <TaskModal
          kind={openTask.kind}
          label={openTask.label}
          onComplete={() => socket.emit('task:complete', openTask.id)}
          onClose={() => setOpenTask(null)}
        />
      )}

      {!alive && actions.taskId && (
        <div className="hud actions-pad">
          <ActionButton label="Use" hotkey="E" className="use" enabled onClick={doTask} />
        </div>
      )}

      {alive && !inVent && (
        <div className="hud actions-pad">
          {(actions.panelId || holding) && (
            <button
              className={`action fix ${holding ? 'holding' : ''}`}
              style={{ ['--progress' as string]: `${(heldPanel?.progress ?? 0) * 360}deg` }}
              onPointerDown={(e) => {
                e.stopPropagation();
                startHold();
              }}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              onContextMenu={(e) => e.preventDefault()}
            >
              <span className="action-label">{holding ? 'Fixing…' : 'Hold to fix'}</span>
              <span className="hotkey">hold E</span>
            </button>
          )}
          {!actions.panelId && actions.taskId && (
            <ActionButton label="Use" hotkey="E" className="use" enabled onClick={doTask} />
          )}
          {!actions.panelId && !actions.taskId && actions.canAlarm && (
            <ActionButton
              label="Alarm"
              hotkey="E"
              className="alarm"
              enabled={actions.alarmCooldown === 0}
              cooldown={actions.alarmCooldown}
              onClick={doAlarm}
            />
          )}
          <ActionButton label="Report" hotkey="R" className="report" enabled={actions.canReport} onClick={doReport} />
          {isMimic && (
            <ActionButton label="Vent" hotkey="V" className="vent" enabled={actions.canVent} onClick={doVent} />
          )}
          {isMimic && (
            <ActionButton
              label="Sabotage"
              hotkey="X"
              className="sabotage"
              enabled={!sab && actions.sabotageCooldown === 0}
              cooldown={actions.sabotageCooldown}
              onClick={() => setSabotageMenu((o) => !o)}
            />
          )}
          {isMimic && (
            <ActionButton
              label="Kill"
              hotkey="Q"
              className="kill"
              enabled={!!actions.killTarget && actions.killCooldown === 0}
              cooldown={actions.killCooldown}
              onClick={doKill}
            />
          )}
        </div>
      )}

      <p className="hud bottom-hint">
        <span className="hint-keys">WASD / arrow keys to move</span>
        <span className="hint-touch">Drag anywhere to swim</span>
      </p>
    </main>
  );
}

function ActionButton(props: {
  label: string;
  hotkey: string;
  className: string;
  enabled: boolean;
  cooldown?: number;
  onClick: () => void;
}) {
  return (
    <button
      className={`action ${props.className}`}
      disabled={!props.enabled}
      onClick={props.onClick}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {props.cooldown ? <span className="cooldown">{props.cooldown}</span> : null}
      <span className="action-label">{props.label}</span>
      <span className="hotkey">{props.hotkey}</span>
    </button>
  );
}

function SabotageBanner(props: { label: string; remainingMs: number | null; rooms: string[]; simultaneous: boolean }) {
  const [endAt] = useState(() => (props.remainingMs === null ? null : performance.now() + props.remainingMs));
  const [, tick] = useState(0);
  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [endAt]);
  const secs = endAt === null ? null : Math.max(0, Math.ceil((endAt - performance.now()) / 1000));
  const where = [...new Set(props.rooms)].join(' & ');
  return (
    <div className={`hud sabotage-banner ${secs !== null ? 'critical' : ''}`} role="alert">
      <strong>{props.label}</strong>
      {secs !== null && <span className="countdown">{secs}s</span>}
      <span>
        {props.simultaneous ? 'Two divers must hold the panels at the same time' : 'Fix it'} in {where}
      </span>
    </div>
  );
}
