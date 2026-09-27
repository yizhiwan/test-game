import {
  ALARM_COOLDOWN_MS,
  ALARM_RANGE,
  ALARMS_PER_PLAYER,
  COLORS,
  DISCUSS_MS,
  FIRST_KILL_COOLDOWN_MS,
  KILL_COOLDOWN_MS,
  KILL_RANGE,
  MAX_PLAYERS,
  REPORT_RANGE,
  RANGE_SLACK,
  RESULT_MS,
  TICK_RATE,
  VOTE_MS,
  mimicCount,
} from '../shared/constants.js';
import { ALARM, SPAWN } from '../shared/map.js';
import { distance, roomAt, step, type MoveInput } from '../shared/physics.js';
import {
  FIRST_SABOTAGE_COOLDOWN_MS,
  PANEL_HOLD_MS,
  PANEL_RANGE,
  SABOTAGE_COOLDOWN_MS,
  SABOTAGES,
  VENT_BY_ID,
  VENT_RANGE,
  VISION,
  VISION_MARGIN,
  type SabotageKind,
} from '../shared/sabotage.js';
import { STATION_BY_ID, STATIONS, TASK_MIN_MS, TASK_RANGE } from '../shared/tasks.js';
import type {
  ChatMessage,
  GameOver,
  MeetingState,
  Phase,
  Role,
  RoomState,
  Snapshot,
  VoteResult,
} from '../shared/protocol.js';
import { BotBrain } from './bots/brain.js';
import { pickPersona } from './bots/personas.js';

export interface ServerPlayer {
  id: string;
  name: string;
  color: number;
  x: number;
  y: number;
  input: MoveInput;
  role: Role;
  alive: boolean;
  /** Death has been revealed to everyone (at the next meeting). */
  deathKnown: boolean;
  killReadyAt: number;
  alarmsLeft: number;
  lastChatAt: number;
  tasks: string[];
  tasksDone: Set<string>;
  taskStarted: { id: string; at: number } | null;
  vent: string | null;
  bot: boolean;
}

export interface ActiveSabotage {
  kind: SabotageKind;
  endsAt: number | null;
  panels: Map<string, { progressMs: number; done: boolean; holders: Set<string> }>;
}

export interface Body {
  id: string; // the victim's player id
  x: number;
  y: number;
  color: number;
}

export interface Meeting {
  id: number;
  stage: MeetingState['stage'];
  endsAt: number;
  kind: MeetingState['kind'];
  callerId: string;
  callerName: string;
  victimName: string | null;
  /** Room the body was found in. */
  location: string | null;
  /** Where the body lay (server-side only; bots reason about who was near it). */
  bodyPos: { x: number; y: number } | null;
  votes: Map<string, string>;
  result: VoteResult | null;
}

export class Room {
  hostId = '';
  phase: Phase = 'lobby';
  round = 0;
  readonly players = new Map<string, ServerPlayer>();
  // Read by the bot brains; only the room mutates them.
  bodies: Body[] = [];
  meeting: Meeting | null = null;
  sabotage: ActiveSabotage | null = null;
  sabotageReadyAt = 0;
  alarmReadyAt = 0;
  private meetingCount = 0;
  private gameOver: GameOver | null = null;
  private chatCount = 0;
  readonly brains = new Map<string, BotBrain>();
  lastProgressBroadcast = 0;
  progressDirty = false;
  /** Set when something a bot did (or the clock did) needs a state broadcast now. */
  stateDirty = false;
  /** Delivers chat lines; wired to Socket.IO by the server. */
  onChat: (msg: ChatMessage, recipients: string[]) => void = () => {};
  /** Whether a player has entered the access code; wired up by the server. */
  isTrusted: (id: string) => boolean = () => false;

  constructor(
    readonly code: string,
    readonly minPlayers: number,
    readonly tasksPerDiver: number,
  ) {}

  get isFull(): boolean {
    return this.players.size >= MAX_PLAYERS;
  }

  get meetingId(): number {
    return this.meeting?.id ?? 0;
  }

  get humanCount(): number {
    return [...this.players.values()].filter((p) => !p.bot).length;
  }

  /** Gemini bot chat only runs while someone with the access code is aboard. */
  get aiChat(): boolean {
    return [...this.players.values()].some((p) => !p.bot && this.isTrusted(p.id));
  }

  addBot(): boolean {
    if (this.phase !== 'lobby' || this.isFull) return false;
    const taken = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    const persona = pickPersona(taken);
    const id = `bot:${Math.random().toString(36).slice(2, 10)}`;
    this.add(id, persona.name, true);
    this.brains.set(id, new BotBrain(this, id, persona));
    return true;
  }

  removeBot(): boolean {
    if (this.phase !== 'lobby') return false;
    const last = [...this.players.values()].reverse().find((p) => p.bot);
    if (!last) return false;
    this.remove(last.id);
    return true;
  }

  add(id: string, name: string, bot = false): void {
    const taken = new Set([...this.players.values()].map((p) => p.color));
    const color = COLORS.findIndex((_, i) => !taken.has(i));
    this.players.set(id, {
      id,
      name,
      color,
      x: SPAWN.x,
      y: SPAWN.y,
      input: { dx: 0, dy: 0 },
      role: 'diver',
      alive: true,
      deathKnown: false,
      killReadyAt: 0,
      alarmsLeft: ALARMS_PER_PLAYER,
      lastChatAt: 0,
      tasks: [],
      tasksDone: new Set(),
      taskStarted: null,
      vent: null,
      bot,
    });
    if (!this.hostId && !bot) this.hostId = id;
  }

  remove(id: string): void {
    this.players.delete(id);
    this.brains.delete(id);
    this.bodies = this.bodies.filter((b) => b.id !== id);
    this.meeting?.votes.delete(id);
    // Bots can't host.
    if (this.hostId === id) this.hostId = [...this.players.values()].find((p) => !p.bot)?.id ?? '';
    if (this.phase === 'playing' || this.phase === 'meeting') {
      if (this.checkWin()) return;
      if (this.meeting?.stage === 'vote' && this.allVoted()) this.resolveVotes();
    }
  }

  get(id: string): ServerPlayer | undefined {
    return this.players.get(id);
  }

  setColor(id: string, color: number): boolean {
    const player = this.players.get(id);
    if (!player || this.phase !== 'lobby') return false;
    if (!Number.isInteger(color) || color < 0 || color >= COLORS.length) return false;
    if ([...this.players.values()].some((p) => p.id !== id && p.color === color)) return false;
    player.color = color;
    return true;
  }

  setInput(id: string, input: MoveInput): void {
    const player = this.players.get(id);
    if (player && this.phase === 'playing' && !player.vent) player.input = input;
  }

  // ---- Round lifecycle ----------------------------------------------------

  start(): void {
    const now = Date.now();
    const all = [...this.players.values()];
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    const mimics = new Set(shuffled.slice(0, mimicCount(all.length)).map((p) => p.id));
    for (const p of all) {
      p.role = mimics.has(p.id) ? 'mimic' : 'diver';
      p.alive = true;
      p.deathKnown = false;
      p.killReadyAt = now + FIRST_KILL_COOLDOWN_MS;
      p.alarmsLeft = ALARMS_PER_PLAYER;
      p.tasks = [...STATIONS]
        .sort(() => Math.random() - 0.5)
        .slice(0, this.tasksPerDiver)
        .map((s) => s.id);
      p.tasksDone = new Set();
      p.taskStarted = null;
      p.vent = null;
    }
    this.round++;
    this.sabotage = null;
    this.sabotageReadyAt = now + FIRST_SABOTAGE_COOLDOWN_MS;
    this.bodies = [];
    this.meeting = null;
    this.gameOver = null;
    this.alarmReadyAt = now + ALARM_COOLDOWN_MS;
    this.phase = 'playing';
    this.respawn();
  }

  /** Back to the lobby, from any phase. */
  end(): void {
    this.phase = 'lobby';
    this.meeting = null;
    this.gameOver = null;
    this.bodies = [];
    this.sabotage = null;
    for (const p of this.players.values()) {
      p.vent = null;
      p.alive = true;
      p.deathKnown = false;
      p.role = 'diver';
    }
  }

  private respawn(): void {
    // Spread the living in a ring around the alarm table so nobody overlaps.
    const living = [...this.players.values()].filter((p) => p.alive);
    living.forEach((p, i) => {
      const angle = (i / living.length) * Math.PI * 2;
      p.x = SPAWN.x + Math.cos(angle) * 90;
      p.y = SPAWN.y + Math.sin(angle) * 90;
    });
    for (const p of this.players.values()) p.input = { dx: 0, dy: 0 };
  }

  // ---- Actions (each returns true when state changed) ---------------------

  kill(killerId: string, targetId: string): boolean {
    const killer = this.players.get(killerId);
    const target = this.players.get(targetId);
    if (this.phase !== 'playing' || !killer || !target) return false;
    if (killer.role !== 'mimic' || !killer.alive || killer.vent) return false;
    if (target.role === 'mimic' || !target.alive) return false;
    if (Date.now() < killer.killReadyAt) return false;
    if (distance(killer, target) > KILL_RANGE + RANGE_SLACK) return false;

    target.alive = false;
    target.input = { dx: 0, dy: 0 };
    this.bodies.push({ id: target.id, x: target.x, y: target.y, color: target.color });
    // Like the original: the killer lands on the spot.
    killer.x = target.x;
    killer.y = target.y;
    killer.killReadyAt = Date.now() + KILL_COOLDOWN_MS;
    for (const brain of this.brains.values()) brain.onKill(killer, target);
    this.checkWin();
    return true;
  }

  report(id: string): boolean {
    const p = this.players.get(id);
    if (this.phase !== 'playing' || !p?.alive) return false;
    const body = this.bodies.find((b) => distance(p, b) <= REPORT_RANGE + RANGE_SLACK);
    if (!body) return false;
    this.startMeeting('body', p, this.players.get(body.id)?.name ?? null, roomAt(body.x, body.y)?.name ?? 'a corridor', body);
    return true;
  }

  alarm(id: string): boolean {
    const p = this.players.get(id);
    if (this.phase !== 'playing' || !p?.alive || this.criticalSabotage) return false;
    if (p.alarmsLeft <= 0 || Date.now() < this.alarmReadyAt) return false;
    if (distance(p, ALARM) > ALARM_RANGE + RANGE_SLACK) return false;
    p.alarmsLeft--;
    this.startMeeting('alarm', p, null, null, null);
    return true;
  }

  // ---- Sabotage & vents ---------------------------------------------------

  get criticalSabotage(): boolean {
    return !!this.sabotage && this.sabotage.endsAt !== null;
  }

  startSabotage(id: string, kind: SabotageKind): boolean {
    const p = this.players.get(id);
    if (!Object.hasOwn(SABOTAGES, kind)) return false;
    const def = SABOTAGES[kind];
    if (this.phase !== 'playing' || !p?.alive || p.role !== 'mimic') return false;
    if (this.sabotage || Date.now() < this.sabotageReadyAt) return false;
    this.sabotage = {
      kind,
      endsAt: def.timeLimitMs === null ? null : Date.now() + def.timeLimitMs,
      panels: new Map(def.panels.map((pn) => [pn.id, { progressMs: 0, done: false, holders: new Set() }])),
    };
    return true;
  }

  fixHold(id: string, panelId: string, holding: boolean): boolean {
    const p = this.players.get(id);
    const sab = this.sabotage;
    const panel = sab?.panels.get(panelId);
    if (!p || !sab || !panel) return false;
    if (!holding) return panel.holders.delete(id);
    const def = SABOTAGES[sab.kind].panels.find((pn) => pn.id === panelId)!;
    if (this.phase !== 'playing' || !p.alive || p.vent || panel.done) return false;
    if (distance(p, def) > PANEL_RANGE + RANGE_SLACK) return false;
    // You can only work one panel at a time.
    for (const other of sab.panels.values()) other.holders.delete(id);
    panel.holders.add(id);
    return true;
  }

  enterVent(id: string): boolean {
    const p = this.players.get(id);
    if (this.phase !== 'playing' || !p?.alive || p.role !== 'mimic' || p.vent) return false;
    let nearest: { id: string; x: number; y: number } | undefined;
    for (const v of VENT_BY_ID.values()) {
      if (distance(p, v) <= VENT_RANGE + RANGE_SLACK && (!nearest || distance(p, v) < distance(p, nearest))) nearest = v;
    }
    if (!nearest) return false;
    this.dropHolds(id);
    p.vent = nearest.id;
    p.x = nearest.x;
    p.y = nearest.y;
    p.input = { dx: 0, dy: 0 };
    return true;
  }

  moveVent(id: string, target: string): boolean {
    const p = this.players.get(id);
    const from = p?.vent ? VENT_BY_ID.get(p.vent) : undefined;
    const to = VENT_BY_ID.get(target);
    if (this.phase !== 'playing' || !p || !from || !to || !from.links.includes(to.id)) return false;
    p.vent = to.id;
    p.x = to.x;
    p.y = to.y;
    return true;
  }

  exitVent(id: string): boolean {
    const p = this.players.get(id);
    if (!p?.vent) return false;
    p.vent = null;
    return true;
  }

  private dropHolds(id: string): void {
    for (const panel of this.sabotage?.panels.values() ?? []) panel.holders.delete(id);
  }

  private visionOf(p: ServerPlayer): number {
    if (p.role === 'mimic') return VISION.mimic;
    return this.sabotage?.kind === 'lights' ? VISION.diverLightsOut : VISION.diver;
  }

  vote(id: string, target: string): boolean {
    const m = this.meeting;
    const voter = this.players.get(id);
    if (!m || m.stage !== 'vote' || !voter?.alive || m.votes.has(id)) return false;
    if (target !== 'skip' && !this.players.get(target)?.alive) return false;
    m.votes.set(id, target);
    if (this.allVoted()) this.resolveVotes();
    return true;
  }

  /** Who may read a chat line from this player right now, or null if they may not chat. */
  /** Posts a meeting chat line from a player or bot. Returns false if they may not speak now. */
  postChat(id: string, text: string, minIntervalMs: number): boolean {
    const p = this.players.get(id);
    const audience = this.chatAudience(id, minIntervalMs);
    if (!p || !audience) return false;
    const msg: ChatMessage = {
      id: ++this.chatCount,
      meetingId: this.meetingId,
      fromId: p.id,
      name: p.name,
      color: p.color,
      text,
      ghost: audience.ghost,
    };
    this.onChat(msg, audience.recipients.filter((r) => !this.players.get(r)?.bot));
    for (const [bid, brain] of this.brains) if (audience.recipients.includes(bid)) brain.onChat(msg);
    return true;
  }

  private chatAudience(id: string, minIntervalMs: number): { ghost: boolean; recipients: string[] } | null {
    const p = this.players.get(id);
    if (!p || this.phase !== 'meeting') return null;
    const now = Date.now();
    if (now - p.lastChatAt < minIntervalMs) return null;
    p.lastChatAt = now;
    const ghost = !p.alive;
    // The living talk to everyone; ghosts only to other ghosts.
    const recipients = [...this.players.values()].filter((q) => !ghost || !q.alive).map((q) => q.id);
    return { ghost, recipients };
  }

  startTask(id: string, taskId: string): boolean {
    const p = this.players.get(id);
    const station = STATION_BY_ID.get(taskId);
    if (this.phase !== 'playing' || !p || !station || p.role !== 'diver') return false;
    if (!p.tasks.includes(taskId) || p.tasksDone.has(taskId)) return false;
    if (distance(p, station) > TASK_RANGE + RANGE_SLACK) return false;
    p.taskStarted = { id: taskId, at: Date.now() };
    return false; // nothing public changed
  }

  completeTask(id: string, taskId: string): boolean {
    const p = this.players.get(id);
    const station = STATION_BY_ID.get(taskId);
    if (this.phase !== 'playing' || !p || !station || p.role !== 'diver') return false;
    // Must have opened this console, stayed at it, and taken a human amount of time.
    if (p.taskStarted?.id !== taskId) return false;
    if (Date.now() - p.taskStarted.at < TASK_MIN_MS[station.kind]) return false;
    if (distance(p, station) > TASK_RANGE + RANGE_SLACK) return false;
    p.taskStarted = null;
    p.tasksDone.add(taskId);
    this.checkWin();
    return true;
  }

  private taskBar(): { done: number; total: number } {
    let done = 0;
    let total = 0;
    for (const p of this.players.values()) {
      if (p.role !== 'diver') continue;
      total += p.tasks.length;
      done += p.tasksDone.size;
    }
    return { done, total };
  }

  // ---- Meetings -----------------------------------------------------------

  private startMeeting(
    kind: Meeting['kind'],
    caller: ServerPlayer,
    victimName: string | null,
    location: string | null,
    bodyPos: { x: number; y: number } | null,
  ): void {
    this.phase = 'meeting';
    this.bodies = [];
    // Calling a meeting stabilises the station: any sabotage is cleared.
    if (this.sabotage) {
      this.sabotage = null;
      this.sabotageReadyAt = Date.now() + SABOTAGE_COOLDOWN_MS;
    }
    for (const p of this.players.values()) {
      p.input = { dx: 0, dy: 0 };
      p.vent = null;
      if (!p.alive) p.deathKnown = true;
    }
    this.meeting = {
      id: ++this.meetingCount,
      stage: 'discuss',
      endsAt: Date.now() + DISCUSS_MS,
      kind,
      callerId: caller.id,
      callerName: caller.name,
      victimName,
      location,
      bodyPos: bodyPos && { x: bodyPos.x, y: bodyPos.y },
      votes: new Map(),
      result: null,
    };
    for (const brain of this.brains.values()) brain.onMeetingStart(this.meeting);
  }

  private allVoted(): boolean {
    const m = this.meeting;
    if (!m) return false;
    return [...this.players.values()].every((p) => !p.alive || m.votes.has(p.id));
  }

  private resolveVotes(): void {
    const m = this.meeting;
    if (!m) return;
    const tally = new Map<string, number>();
    for (const target of m.votes.values()) tally.set(target, (tally.get(target) ?? 0) + 1);
    let top = '';
    let topCount = 0;
    let tie = false;
    for (const [target, count] of tally) {
      if (count > topCount) {
        top = target;
        topCount = count;
        tie = false;
      } else if (count === topCount) {
        tie = true;
      }
    }
    const ejected = !tie && top && top !== 'skip' ? this.players.get(top) : undefined;
    if (ejected) {
      ejected.alive = false;
      ejected.deathKnown = true;
    }
    m.result = {
      votes: Object.fromEntries(m.votes),
      ejectedId: ejected?.id ?? null,
      ejectedWasMimic: ejected?.role === 'mimic',
      tie,
    };
    m.stage = 'result';
    m.endsAt = Date.now() + RESULT_MS;
  }

  private finishMeeting(): void {
    this.meeting = null;
    if (this.checkWin()) return;
    const now = Date.now();
    this.phase = 'playing';
    for (const p of this.players.values()) p.killReadyAt = now + KILL_COOLDOWN_MS;
    this.alarmReadyAt = now + ALARM_COOLDOWN_MS;
    this.sabotageReadyAt = Math.max(this.sabotageReadyAt, now + FIRST_SABOTAGE_COOLDOWN_MS);
    this.respawn();
  }

  private endGame(winner: Role, reason: string): void {
    this.phase = 'ended';
    this.meeting = null;
    this.bodies = [];
    this.sabotage = null;
    this.gameOver = {
      winner,
      reason,
      roles: Object.fromEntries([...this.players.values()].map((p) => [p.id, p.role])),
    };
  }

  private checkWin(): boolean {
    const living = [...this.players.values()].filter((p) => p.alive);
    const mimics = living.filter((p) => p.role === 'mimic').length;
    const divers = living.length - mimics;
    let winner: Role | null = null;
    let reason = '';
    const bar = this.taskBar();
    if (mimics === 0) {
      winner = 'diver';
      reason = 'Every Mimic was flushed out of the station.';
    } else if (bar.total > 0 && bar.done >= bar.total) {
      winner = 'diver';
      reason = 'Every station system is back online. The rescue sub is on its way.';
    } else if (mimics >= divers) {
      winner = 'mimic';
      reason = 'The Mimics now outnumber the crew.';
    }
    if (!winner) return false;
    this.endGame(winner, reason);
    return true;
  }

  // ---- Simulation ---------------------------------------------------------

  /** Advances timers. Returns true when the room's public state changed. */
  update(now: number): boolean {
    if (this.phase === 'meeting') for (const brain of this.brains.values()) brain.meetingThink(now);
    const sab = this.sabotage;
    if (this.phase === 'playing' && sab?.endsAt && now >= sab.endsAt) {
      this.endGame(
        'mimic',
        sab.kind === 'o2' ? 'The oxygen ran out. Nobody on the crew woke up.' : 'The hull gave way. The trench took the station.',
      );
      return true;
    }
    const m = this.meeting;
    if (this.phase !== 'meeting' || !m || now < m.endsAt) return false;
    if (m.stage === 'discuss') {
      m.stage = 'vote';
      m.endsAt = now + VOTE_MS;
    } else if (m.stage === 'vote') {
      this.resolveVotes();
    } else {
      this.finishMeeting();
    }
    return true;
  }

  /** Moves everyone and works sabotage panels. Returns true when public state changed. */
  tick(): boolean {
    const dt = 1 / TICK_RATE;
    const now = Date.now();
    for (const brain of this.brains.values()) {
      if (this.phase !== 'playing') break; // a bot's action may have ended the round
      brain.think(now);
    }
    for (const p of this.players.values()) {
      if (p.vent) continue;
      const next = step(p, p.input, dt, !p.alive);
      p.x = next.x;
      p.y = next.y;
    }
    return this.tickSabotage(dt * 1000);
  }

  private tickSabotage(dtMs: number): boolean {
    const sab = this.sabotage;
    if (!sab) return false;
    const def = SABOTAGES[sab.kind];
    let changed = false;
    for (const pd of def.panels) {
      const panel = sab.panels.get(pd.id)!;
      // Walking away (or dying) lets go of the panel.
      for (const hid of panel.holders) {
        const h = this.players.get(hid);
        if (!h?.alive || h.vent || distance(h, pd) > PANEL_RANGE + RANGE_SLACK) {
          panel.holders.delete(hid);
          changed = true;
        }
      }
      if (!def.simultaneous && !panel.done && panel.holders.size > 0) {
        panel.progressMs += dtMs;
        changed = true;
        if (panel.progressMs >= PANEL_HOLD_MS) panel.done = true;
      }
    }
    if (def.simultaneous && [...sab.panels.values()].every((pn) => pn.holders.size > 0)) {
      for (const pn of sab.panels.values()) pn.done = true;
    }
    if ([...sab.panels.values()].every((pn) => pn.done)) {
      this.sabotage = null;
      this.sabotageReadyAt = Date.now() + SABOTAGE_COOLDOWN_MS;
      return true;
    }
    return changed;
  }

  // ---- Views (filtered per viewer) ----------------------------------------

  stateFor(viewerId: string): RoomState {
    const now = Date.now();
    const viewer = this.players.get(viewerId);
    const inRound = this.phase !== 'lobby';
    const seesAllDeaths = !!viewer && (!viewer.alive || viewer.role === 'mimic' || this.phase === 'ended');
    const m = this.meeting;
    return {
      code: this.code,
      hostId: this.hostId,
      phase: this.phase,
      round: this.round,
      minPlayers: this.minPlayers,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        bot: p.bot,
        dead: inRound && !p.alive && (p.deathKnown || seesAllDeaths || p.id === viewerId),
      })),
      meeting: m && {
        id: m.id,
        stage: m.stage,
        remainingMs: Math.max(0, m.endsAt - now),
        kind: m.kind,
        callerId: m.callerId,
        callerName: m.callerName,
        victimName: m.victimName,
        location: m.location,
        voted: [...m.votes.keys()],
        result: m.result,
      },
      gameOver: this.gameOver,
      taskBar: inRound ? this.taskBar() : null,
      sabotage: this.sabotage && {
        kind: this.sabotage.kind,
        remainingMs: this.sabotage.endsAt === null ? null : Math.max(0, this.sabotage.endsAt - now),
        panels: [...this.sabotage.panels].map(([id, pn]) => ({
          id,
          done: pn.done,
          holders: pn.holders.size,
          progress: SABOTAGES[this.sabotage!.kind].simultaneous ? 0 : Math.min(1, pn.progressMs / PANEL_HOLD_MS),
        })),
      },
      you:
        viewer && inRound
          ? {
              role: viewer.role,
              alive: viewer.alive,
              mimicIds:
                viewer.role === 'mimic'
                  ? [...this.players.values()].filter((p) => p.role === 'mimic').map((p) => p.id)
                  : [],
              killCooldownMs: Math.max(0, viewer.killReadyAt - now),
              alarmsLeft: viewer.alarmsLeft,
              alarmCooldownMs: Math.max(0, this.alarmReadyAt - now),
              tasks: viewer.tasks.map((t) => ({ id: t, done: viewer.tasksDone.has(t) })),
              visionRadius: this.visionOf(viewer),
              sabotageCooldownMs: viewer.role === 'mimic' ? Math.max(0, this.sabotageReadyAt - now) : 0,
              vent: viewer.vent,
            }
          : null,
    };
  }

  snapshotFor(viewerId: string): Snapshot {
    const viewer = this.players.get(viewerId);
    const seesGhosts = !!viewer && !viewer.alive;
    // Ghosts see the whole station; the living only what their lamp reaches.
    const reach = !viewer || seesGhosts ? Infinity : this.visionOf(viewer) + VISION_MARGIN;
    const visible = (q: { x: number; y: number }) => !viewer || distance(viewer, q) <= reach;
    const r = (n: number) => Math.round(n * 10) / 10;
    return {
      t: Date.now(),
      players: [...this.players.values()]
        .filter((p) => p.id === viewerId || ((p.alive || seesGhosts) && !p.vent && visible(p)))
        .map((p) => ({ id: p.id, x: r(p.x), y: r(p.y), ghost: !p.alive })),
      bodies: this.bodies.filter(visible).map((b) => ({ ...b, x: r(b.x), y: r(b.y) })),
    };
  }
}
