import { ALARM_RANGE, CHAT_MIN_INTERVAL_MS, KILL_RANGE, REPORT_RANGE } from '../../shared/constants.js';
import { ALARM, ROOMS } from '../../shared/map.js';
import { route } from '../../shared/nav.js';
import { distance, roomAt, type Vec } from '../../shared/physics.js';
import type { ChatMessage } from '../../shared/protocol.js';
import { PANEL_RANGE, SABOTAGES, VENT_BY_ID, VENTS, type SabotageKind } from '../../shared/sabotage.js';
import { STATION_BY_ID, STATIONS, TASK_MIN_MS, TASK_RANGE } from '../../shared/tasks.js';
import type { Meeting, Room, ServerPlayer } from '../room.js';
import type { Persona } from './personas.js';
import { botLine, type TalkContext } from './talk.js';

type GoalKind = 'task' | 'fake' | 'panel' | 'body' | 'alarm' | 'hunt' | 'flee' | 'vent' | 'wander';

interface Goal {
  kind: GoalKind;
  target: Vec;
  /** Task station, panel or player id, depending on kind. */
  ref?: string;
  /** Stand here until this time once arrived (tasks, fake tasks, wandering). */
  lingerMs?: number;
}

interface Sighting {
  room: string;
  at: number;
  x: number;
  y: number;
}

/** How close to the body, and how recently, counts as "seen near it". */
const LEAD_RADIUS = 550;
const LEAD_WINDOW_MS = 45_000;

const THINK_MS = 250;
const PERCEIVE_MS = 400;
const WAYPOINT_REACHED = 14;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

/**
 * One server-side bot. It only acts through the same Room methods a human's
 * socket events call (so every server check applies to bots too), and it only
 * perceives through snapshotFor(), i.e. the same lamp-limited view a human
 * gets. It does read its own private state (role, tasks, cooldowns), which a
 * human also sees on their own screen.
 */
export class BotBrain {
  private round = -1;
  private goal: Goal | null = null;
  private path: Vec[] = [];
  private arrivedAt = 0;
  private nextThink = 0;
  private nextPerceive = 0;
  private lastPos: Vec = { x: 0, y: 0 };
  private stuckSince = 0;
  private jitterUntil = 0;
  private jitter = { dx: 0, dy: 0 };
  private taskDoneAt = 0;
  private ventUntil = 0;
  private ventHops = 0;

  // Memory, reset each round.
  private visible = new Set<string>();
  private visibleBodies: { id: string; x: number; y: number }[] = [];
  private sightings = new Map<string, Sighting>();
  private trail: string[] = [];
  private witnessed: { killerId: string; victimId: string; room: string } | null = null;
  private myKill: { victimId: string; room: string } | null = null;
  private alibiRoom = '';

  // Meeting state.
  private meetingId = 0;
  private chat: ChatMessage[] = [];
  private linesLeft = 0;
  private speakAt = 0;
  private speaking = false;
  private voteAt = 0;

  constructor(
    private readonly room: Room,
    readonly id: string,
    readonly persona: Persona,
  ) {}

  private get me(): ServerPlayer | undefined {
    return this.room.players.get(this.id);
  }

  private nameOf(id: string): string {
    return this.room.players.get(id)?.name ?? 'someone';
  }

  private dirty(): void {
    this.room.stateDirty = true;
  }

  // ------------------------------------------------------------------ play

  think(now: number): void {
    const me = this.me;
    if (!me) return;
    if (this.round !== this.room.round) this.resetRound();
    if (now >= this.nextPerceive) this.perceive(now);

    if (now >= this.nextThink) {
      this.nextThink = now + THINK_MS;
      if (!me.alive) this.thinkGhost(now);
      else if (me.role === 'mimic') this.thinkMimic(now);
      else this.thinkDiver(now);
    }
    this.steer(now);
  }

  private resetRound(): void {
    this.round = this.room.round;
    this.goal = null;
    this.path = [];
    this.sightings.clear();
    this.trail = [];
    this.witnessed = null;
    this.myKill = null;
    this.alibiRoom = '';
    this.taskDoneAt = 0;
    this.nextThink = Date.now() + rand(300, 1500); // don't all move in lockstep
  }

  private perceive(now: number): void {
    this.nextPerceive = now + PERCEIVE_MS;
    const snap = this.room.snapshotFor(this.id);
    this.visible = new Set(snap.players.filter((p) => p.id !== this.id && !p.ghost).map((p) => p.id));
    this.visibleBodies = snap.bodies;
    for (const p of snap.players) {
      if (p.id === this.id || p.ghost) continue;
      const r = roomAt(p.x, p.y);
      this.sightings.set(p.id, { room: r?.name ?? 'a corridor', at: now, x: p.x, y: p.y });
    }
    const me = this.me!;
    const here = roomAt(me.x, me.y)?.name;
    if (here && this.trail.at(-1) !== here) {
      this.trail.push(here);
      if (this.trail.length > 4) this.trail.shift();
    }
  }

  onKill(killer: ServerPlayer, victim: ServerPlayer): void {
    const me = this.me;
    if (!me) return;
    const where = roomAt(victim.x, victim.y)?.name ?? 'a corridor';
    if (killer.id === this.id) {
      this.myKill = { victimId: victim.id, room: where };
      return;
    }
    // Saw it happen: only a living diver whose lamp reaches the killer.
    if (me.alive && me.role === 'diver' && this.room.snapshotFor(this.id).players.some((p) => p.id === killer.id)) {
      this.witnessed = { killerId: killer.id, victimId: victim.id, room: where };
    }
  }

  private setGoal(goal: Goal | null): void {
    const same =
      goal && this.goal && goal.kind === this.goal.kind && goal.ref === this.goal.ref && distance(goal.target, this.goal.target) < 60;
    if (same) return;
    this.goal = goal;
    this.arrivedAt = 0;
    const me = this.me!;
    this.path = !goal ? [] : me.alive ? route(me, goal.target) : [goal.target]; // ghosts drift straight
  }

  private arrived(range: number): boolean {
    return !!this.goal && distance(this.me!, this.goal.target) <= range;
  }

  private thinkDiver(now: number): void {
    const room = this.room;
    const me = this.me!;
    const sab = room.sabotage;

    // 1. A body in view: go report it.
    const body = this.visibleBodies[0];
    if (body) {
      this.setGoal({ kind: 'body', target: body, ref: body.id });
      if (distance(me, body) <= REPORT_RANGE - 20 && room.report(this.id)) this.dirty();
      return;
    }

    // 2. Saw a kill: run for the alarm.
    if (this.witnessed && me.alarmsLeft > 0 && !room.criticalSabotage) {
      this.setGoal({ kind: 'alarm', target: ALARM });
      if (distance(me, ALARM) <= ALARM_RANGE - 20 && now >= room.alarmReadyAt && room.alarm(this.id)) this.dirty();
      return;
    }

    // 3. Sabotage: pick the open panel fewest others are heading to.
    if (sab) {
      const def = SABOTAGES[sab.kind];
      const open = def.panels.filter((pd) => !sab.panels.get(pd.id)?.done);
      if (open.length) {
        const claimed = (pid: string) =>
          [...room.brains.values()].filter((b) => b !== this && b.goal?.kind === 'panel' && b.goal.ref === pid).length;
        const choice = [...open].sort((a, b) => claimed(a.id) - claimed(b.id) || distance(me, a) - distance(me, b))[0];
        const target = this.goal?.kind === 'panel' && open.some((p) => p.id === this.goal!.ref) ? this.goal : null;
        const pd = target ? open.find((p) => p.id === target.ref)! : choice;
        this.setGoal({ kind: 'panel', target: pd, ref: pd.id });
        if (distance(me, pd) <= PANEL_RANGE - 25 && !sab.panels.get(pd.id)?.holders.has(this.id)) {
          if (room.fixHold(this.id, pd.id, true)) this.dirty();
        }
        return;
      }
    }

    this.doTasksOrWander(now);
  }

  private thinkGhost(now: number): void {
    if (this.me!.role === 'diver') this.doTasksOrWander(now);
    else this.setGoal(null); // dead mimics just float
  }

  private doTasksOrWander(now: number): void {
    const me = this.me!;
    const g = this.goal;
    if (g?.kind === 'task') {
      if (!this.arrived(TASK_RANGE - 30)) return;
      const started = me.taskStarted?.id === g.ref;
      if (!started) {
        this.room.startTask(this.id, g.ref!);
        const kind = STATION_BY_ID.get(g.ref!)!.kind;
        // Take about as long as a person would.
        this.taskDoneAt = now + TASK_MIN_MS[kind] + rand(800, 3500);
      } else if (now >= this.taskDoneAt) {
        if (this.room.completeTask(this.id, g.ref!)) this.dirty();
        this.setGoal({ kind: 'wander', target: me, lingerMs: rand(400, 2000) });
      }
      return;
    }
    if (g?.kind === 'wander' && !this.lingerDone(now)) return;

    const todo = me.tasks.filter((t) => !me.tasksDone.has(t)).map((t) => STATION_BY_ID.get(t)!);
    if (todo.length) {
      const next = todo.sort((a, b) => distance(me, a) - distance(me, b))[0];
      this.setGoal({ kind: 'task', target: next, ref: next.id });
    } else {
      const r = pick(ROOMS);
      this.setGoal({ kind: 'wander', target: { x: r.x + r.w / 2, y: r.y + r.h / 2 }, lingerMs: rand(2000, 6000) });
    }
  }

  private lingerDone(now: number): boolean {
    const g = this.goal;
    if (!g) return true;
    if (!this.arrived(40)) return false;
    if (!this.arrivedAt) this.arrivedAt = now;
    return now - this.arrivedAt >= (g.lingerMs ?? 0);
  }

  private thinkMimic(now: number): void {
    const room = this.room;
    const me = this.me!;

    // Hiding in a vent: hop once or twice, then climb out somewhere else.
    if (me.vent) {
      if (now < this.ventUntil) return;
      if (this.ventHops > 0) {
        this.ventHops--;
        if (room.moveVent(this.id, pick(VENT_BY_ID.get(me.vent)!.links))) this.dirty();
        this.ventUntil = now + rand(800, 2000);
      } else if (room.exitVent(this.id)) {
        this.dirty();
        this.goal = null;
      }
      return;
    }

    // Occasionally sabotage when it's ready.
    if (!room.sabotage && now >= room.sabotageReadyAt && Math.random() < 0.02) {
      const kind = pick<SabotageKind>(['lights', 'lights', 'o2', 'breach']);
      if (room.startSabotage(this.id, kind)) this.dirty();
    }

    // After a kill: get away, through a vent if one is close.
    if (this.goal?.kind === 'flee' || this.goal?.kind === 'vent') {
      if (this.goal.kind === 'vent' && this.arrived(40)) {
        if (room.enterVent(this.id)) {
          this.dirty();
          this.ventUntil = now + rand(1000, 2500);
          this.ventHops = Math.floor(rand(1, 3));
        }
        this.goal = null;
      } else if (this.goal.kind === 'flee' && this.arrived(40)) {
        this.goal = null;
      }
      return;
    }

    // Hunt: a diver in view with nobody else around them.
    const killReady = now >= me.killReadyAt;
    if (killReady) {
      const partners = new Set([...room.players.values()].filter((p) => p.role === 'mimic').map((p) => p.id));
      const targets = [...this.visible]
        .map((id) => room.players.get(id)!)
        .filter((p) => p && p.alive && !partners.has(p.id))
        .filter((t) => ![...this.visible].some((o) => o !== t.id && !partners.has(o) && distance(room.players.get(o)!, t) < 450));
      const target = targets.sort((a, b) => distance(me, a) - distance(me, b))[0];
      if (target) {
        if (distance(me, target) <= KILL_RANGE - 10) {
          if (room.kill(this.id, target.id)) {
            this.dirty();
            this.flee();
          }
        } else {
          this.goal = { kind: 'hunt', target: { x: target.x, y: target.y }, ref: target.id };
          this.path = route(me, target);
        }
        return;
      }
    }

    // A body in view that isn't ours: sometimes report it to look helpful.
    const body = this.visibleBodies.find((b) => b.id !== this.myKill?.victimId);
    if (body && Math.random() < 0.05 && distance(me, body) <= REPORT_RANGE - 20) {
      if (room.report(this.id)) this.dirty();
      return;
    }

    // Otherwise loiter at fake tasks to blend in.
    if (this.goal?.kind === 'hunt' || !this.goal || this.lingerDone(now)) {
      const st = STATIONS.find((s) => s.id === pick(me.tasks)) ?? pick(STATIONS);
      this.setGoal({ kind: 'fake', target: st, ref: st.id, lingerMs: rand(3000, 7000) });
      this.alibiRoom = st.room;
    }
  }

  private flee(): void {
    const me = this.me!;
    const vent = VENTS.filter((v) => distance(me, v) < 350).sort((a, b) => distance(me, a) - distance(me, b))[0];
    if (vent) {
      this.goal = { kind: 'vent', target: vent, ref: vent.id };
      this.path = route(me, vent);
    } else {
      const far = [...STATIONS].sort((a, b) => distance(me, b) - distance(me, a))[Math.floor(rand(0, 4))];
      this.goal = { kind: 'flee', target: far, ref: far.id };
      this.path = route(me, far);
      this.alibiRoom = far.room;
    }
  }

  /** Turns the current path into a movement input on the player. */
  private steer(now: number): void {
    const me = this.me!;
    if (me.vent) return;
    let input = { dx: 0, dy: 0 };
    while (this.path.length && distance(me, this.path[0]) <= WAYPOINT_REACHED) this.path.shift();
    const wp = this.path[0];
    if (wp) {
      const dx = wp.x - me.x;
      const dy = wp.y - me.y;
      const d = Math.hypot(dx, dy);
      input = { dx: dx / d, dy: dy / d };
      // Stuck on a corner (e.g. after being teleported): wiggle, then re-plan.
      if (distance(me, this.lastPos) > 1.5) this.stuckSince = now;
      else if (now - this.stuckSince > 1200 && this.goal) {
        this.jitter = { dx: rand(-1, 1), dy: rand(-1, 1) };
        this.jitterUntil = now + 300;
        this.stuckSince = now;
        this.path = me.alive ? route(me, this.goal.target) : [this.goal.target];
      }
      if (now < this.jitterUntil) input = this.jitter;
    } else {
      this.stuckSince = now;
    }
    this.lastPos = { x: me.x, y: me.y };
    me.input = input;
  }

  // --------------------------------------------------------------- meetings

  onMeetingStart(m: Meeting): void {
    this.meetingId = m.id;
    this.chat = [];
    this.goal = null;
    this.path = [];
    const me = this.me;
    if (!me?.alive) {
      this.linesLeft = 0;
      return;
    }
    const hasNews = !!this.witnessed || m.callerId === this.id;
    this.linesLeft = hasNews ? 3 : 2;
    this.speakAt = Date.now() + (m.callerId === this.id ? rand(800, 2000) : rand(2500, 8000));
    this.voteAt = 0;
  }

  onChat(msg: ChatMessage): void {
    if (msg.meetingId !== this.meetingId) return;
    this.chat.push(msg);
    // Named by someone else: answer soon.
    if (msg.fromId !== this.id && mentions(msg.text, this.persona.name) && this.linesLeft > 0) {
      this.speakAt = Math.min(this.speakAt, Date.now() + rand(1500, 4000));
    }
  }

  meetingThink(now: number): void {
    const m = this.room.meeting;
    const me = this.me;
    if (!m || !me || m.id !== this.meetingId || !me.alive) return;

    if (m.stage !== 'result' && !this.speaking && this.linesLeft > 0 && now >= this.speakAt) {
      this.speaking = true;
      this.linesLeft--;
      const ctx = this.talkContext(m);
      void botLine(ctx, this.room.aiChat)
        .then((line) => {
          const cur = this.room.meeting;
          if (cur?.id === m.id && cur.stage !== 'result') this.room.postChat(this.id, line, CHAT_MIN_INTERVAL_MS);
        })
        .finally(() => {
          this.speaking = false;
          this.speakAt = Date.now() + rand(7000, 14000);
        });
    }

    if (m.stage === 'vote' && !m.votes.has(this.id)) {
      if (!this.voteAt) this.voteAt = now + rand(2000, 12000);
      if (now >= this.voteAt && this.room.vote(this.id, this.decideVote(m))) this.dirty();
    }
  }

  /**
   * Who was seen near the body shortly before it was found: the living players
   * this bot saw within LEAD_RADIUS of the body in the last LEAD_WINDOW_MS,
   * nearest first. Partners are left out for mimics (they frame divers).
   */
  private leads(m: Meeting): { id: string; secsAgo: number; room: string }[] {
    if (!m.bodyPos) return [];
    const me = this.me!;
    const partners = new Set(
      me.role === 'mimic' ? [...this.room.players.values()].filter((p) => p.role === 'mimic').map((p) => p.id) : [],
    );
    const now = Date.now();
    return [...this.sightings]
      .filter(([id, s]) => {
        const p = this.room.players.get(id);
        return p?.alive && id !== this.id && !partners.has(id) && now - s.at < LEAD_WINDOW_MS && distance(s, m.bodyPos!) < LEAD_RADIUS;
      })
      .sort((a, b) => distance(a[1], m.bodyPos!) - distance(b[1], m.bodyPos!))
      .map(([id, s]) => ({ id, secsAgo: Math.round((now - s.at) / 1000), room: s.room }));
  }

  private livingOthers(): ServerPlayer[] {
    return [...this.room.players.values()].filter((p) => p.alive && p.id !== this.id);
  }

  /** Who the chat is pointing at: living player id -> number of messages naming them. */
  private accusations(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const msg of this.chat) {
      for (const p of this.livingOthers()) {
        if (msg.fromId !== p.id && mentions(msg.text, p.name)) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
      }
    }
    // Being named by others counts against you too, even if you're the one voting.
    for (const msg of this.chat) {
      if (msg.fromId !== this.id && mentions(msg.text, this.persona.name)) counts.set(this.id, (counts.get(this.id) ?? 0) + 1);
    }
    return counts;
  }

  private decideVote(m: Meeting): string {
    const me = this.me!;
    const acc = this.accusations();
    const alive = (id: string) => !!this.room.players.get(id)?.alive;
    const crowd = [...acc].filter(([id]) => id !== this.id && alive(id)).sort((a, b) => b[1] - a[1])[0];

    if (me.role === 'mimic') {
      const partners = new Set([...this.room.players.values()].filter((p) => p.role === 'mimic').map((p) => p.id));
      // Accused? Vote for whoever keeps naming us.
      const accuser = this.chat
        .filter((c) => c.fromId !== this.id && !partners.has(c.fromId) && alive(c.fromId) && mentions(c.text, this.persona.name))
        .at(-1)?.fromId;
      if (accuser) return accuser;
      if (crowd && !partners.has(crowd[0]) && crowd[1] >= 2) return crowd[0];
      const frame = this.leads(m)[0];
      if (frame && Math.random() < 0.5) return frame.id;
      return 'skip';
    }

    if (this.witnessed && alive(this.witnessed.killerId)) return this.witnessed.killerId;
    const leads = this.leads(m);
    // Your own lead agrees with the room: very likely.
    if (crowd && crowd[1] >= 2 && leads.some((l) => l.id === crowd[0])) return crowd[0];
    if (crowd && crowd[1] >= 2 && Math.random() < 0.6) return crowd[0];
    // Only one person was anywhere near the body: go with it.
    if (leads.length === 1 && Math.random() < 0.75) return leads[0].id;
    if (leads.length > 1 && Math.random() < 0.35) return leads[0].id;
    return 'skip';
  }

  private talkContext(m: Meeting): TalkContext {
    const me = this.me!;
    const now = Date.now();
    const isMimic = me.role === 'mimic';
    const partners = [...this.room.players.values()].filter((p) => p.role === 'mimic' && p.id !== this.id).map((p) => p.name);
    const facts: string[] = [];
    const ago = (t: number) => `${Math.round((now - t) / 1000)}s ago`;
    const situation =
      m.kind === 'body'
        ? `${m.callerName} found ${m.victimName ?? 'a body'} dead in ${m.location ?? 'the station'}.`
        : `${m.callerName} pressed the emergency alarm.`;

    if (isMimic) {
      if (this.myKill) {
        facts.push(`You secretly killed ${this.nameOf(this.myKill.victimId)} in ${this.myKill.room}. Hide this.`);
      }
      const alibi = this.alibiRoom || pick(ROOMS).name;
      facts.push(`Your cover story: you were working on a task in ${alibi}.`);
    } else {
      if (this.witnessed) {
        facts.push(
          `You SAW ${this.nameOf(this.witnessed.killerId)} kill ${this.nameOf(this.witnessed.victimId)} in ${this.witnessed.room}.`,
        );
      }
      const done = me.tasks.filter((t) => me.tasksDone.has(t)).map((t) => STATION_BY_ID.get(t)?.room);
      if (done.length) facts.push(`You finished tasks in: ${[...new Set(done)].join(', ')}.`);
    }
    if (this.trail.length) facts.push(`Rooms you passed through recently: ${this.trail.join(' → ')}.`);
    for (const l of this.leads(m).slice(0, 2)) {
      facts.push(
        `${isMimic ? 'You could point at' : 'You saw'} ${this.nameOf(l.id)} near where the body was found (${l.room}, ${l.secsAgo}s before the meeting).`,
      );
    }
    const seen = [...this.sightings]
      .filter(([id]) => this.room.players.get(id)?.alive && id !== this.id)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, 4)
      .map(([id, s]) => `${this.nameOf(id)} in ${s.room} (${ago(s.at)})`);
    if (seen.length) facts.push(`Recently you saw: ${seen.join('; ')}.`);
    if (m.callerId === this.id) facts.push('You called this meeting, so people expect you to speak first.');

    return {
      persona: this.persona,
      role: me.role,
      partners,
      facts,
      situation,
      chat: this.chat.slice(-14).map((c) => `${c.name}${c.ghost ? ' (ghost)' : ''}: ${c.text}`),
      livingNames: [...this.room.players.values()].filter((p) => p.alive).map((p) => p.name),
      fallback: this.fallbackLine(m),
    };
  }

  /** Canned but fact-based lines for when there's no model. */
  private fallbackLine(m: Meeting): string {
    const me = this.me!;
    const spoken = this.chat.filter((c) => c.fromId === this.id).length;
    const accusedBy = this.chat.filter((c) => c.fromId !== this.id && mentions(c.text, this.persona.name)).at(-1);

    if (me.role === 'mimic') {
      const alibi = this.alibiRoom || pick(ROOMS).name;
      if (accusedBy) return pick([`Me? I was in ${alibi} the whole time, ${accusedBy.name}.`, `That's rich coming from you, ${accusedBy.name}.`]);
      const frame = this.leads(m)[0];
      if (spoken === 1 && frame) return `Wasn't ${this.nameOf(frame.id)} hanging around ${frame.room} right before?`;
      if (spoken === 0) return pick([`I was doing tasks in ${alibi}. Didn't see anything.`, `Nothing from me, I was stuck in ${alibi}.`]);
      return pick(['Anyone actually see something, or are we guessing?', 'I say skip, we have nothing solid.']);
    }
    if (this.witnessed && this.room.players.get(this.witnessed.killerId)?.alive) {
      const k = this.nameOf(this.witnessed.killerId);
      return spoken === 0 ? `I saw ${k} do it in ${this.witnessed.room}. Vote ${k}.` : `I'm sure. It was ${k}.`;
    }
    if (accusedBy) return `Not me, ${accusedBy.name}. I was working in ${this.trail.at(-1) ?? 'my rooms'}.`;
    const leads = this.leads(m);
    if (spoken === 0) {
      if (leads.length === 1) return `I saw ${this.nameOf(leads[0].id)} near the body, ${leads[0].secsAgo}s before. Only one there.`;
      if (leads.length > 1) return `${leads.map((l) => this.nameOf(l.id)).slice(0, 2).join(' and ')} were both near there earlier.`;
      return `I was in ${this.trail.at(-1) ?? 'the Mess Hall'}. Didn't see anything.`;
    }
    if (leads.length === 1) return `Still say ${this.nameOf(leads[0].id)}. Nobody else was near it.`;
    return pick(['Where was everyone?', 'Skip unless someone has proof.', 'Something feels off about this.']);
  }
}

function mentions(text: string, name: string): boolean {
  return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
}
