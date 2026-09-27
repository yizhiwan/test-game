import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import {
  CHAT_MAX_LENGTH,
  CHAT_MIN_INTERVAL_MS,
  MIN_PLAYERS_TO_START,
  NAME_MAX_LENGTH,
  TICK_RATE,
} from '../shared/constants.js';
import { sanitizeInput } from '../shared/physics.js';
import type { SabotageKind } from '../shared/sabotage.js';
import { TASKS_PER_DIVER } from '../shared/tasks.js';
import type { Ack, ClientToServer, JoinResult, ServerToClient } from '../shared/protocol.js';
import { checkInvite, invitesRequired } from './invites.js';
import { Room } from './room.js';

// Local secrets (GOOGLE_GENERATIVE_AI_API_KEY) from .env, if present.
try {
  process.loadEnvFile();
} catch {
  // No .env file: fine, bots fall back to canned lines.
}

const PORT = Number(process.env.PORT) || 3001;
// Lower for solo testing, e.g. ABYSS_MIN_PLAYERS=2 npm run dev
const TASKS_PER = Math.max(1, Math.min(13, Number(process.env.ABYSS_TASKS) || TASKS_PER_DIVER));
const MIN_PLAYERS = Math.max(2, Number(process.env.ABYSS_MIN_PLAYERS) || MIN_PLAYERS_TO_START);
// Six divers in all: one Mimic, and enough crew for meetings to matter.
const SOLO_BOTS = 5;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O: too easy to misread
// Cloud Run bills for as long as a socket is open, and Socket.IO reconnects on
// its own, so a forgotten tab would keep the instance up for good. Sockets that
// send nothing for this long are dropped; the client doesn't auto-reconnect
// after a server-side disconnect. Lower it to test, e.g. ABYSS_IDLE_MS=15000.
const IDLE_MS = Math.max(10_000, Number(process.env.ABYSS_IDLE_MS) || 10 * 60_000);
// Playing with friends and Gemini bot chat need an invite code (see
// invites.ts); Play vs bots with canned lines stays public, so strangers never
// spend the key's quota. This local limit sits in front of eonelabs.my's own.
const UNLOCK_TRIES = 10; // wrong codes per client IP per window
const UNLOCK_WINDOW_MS = 10 * 60_000;

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServer, ServerToClient>(httpServer);

const rooms = new Map<string, Room>();
const roomOfSocket = new Map<string, string>();
const lastActive = new Map<string, number>();
const trusted = new Set<string>();
const checking = new Set<string>(); // sockets with a code check in flight
const unlockTries = new Map<string, { count: number; resetAt: number }>();

const isTrusted = (id: string): boolean => !invitesRequired || trusted.has(id);

// Cloud Run appends the real client IP to X-Forwarded-For, so take the last
// entry; earlier ones are whatever the client sent.
function clientIp(socket: Socket): string {
  const fwd = socket.handshake.headers['x-forwarded-for'];
  const last = (Array.isArray(fwd) ? fwd.join(',') : fwd ?? '').split(',').pop()?.trim();
  return last || socket.handshake.address;
}

// Only wrong codes count, so friends on one home connection don't lock each other out.
function unlockBlocked(ip: string): boolean {
  const entry = unlockTries.get(ip);
  if (entry && Date.now() >= entry.resetAt) unlockTries.delete(ip);
  return (unlockTries.get(ip)?.count ?? 0) >= UNLOCK_TRIES;
}

function recordWrongCode(ip: string): void {
  const entry = unlockTries.get(ip);
  if (entry) entry.count++;
  else unlockTries.set(ip, { count: 1, resetAt: Date.now() + UNLOCK_WINDOW_MS });
}

function newCode(): string {
  for (;;) {
    const code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
    if (!rooms.has(code)) return code;
  }
}

function cleanName(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .trim()
    .slice(0, NAME_MAX_LENGTH);
}

// Every player gets their own view: roles, deaths and ghosts are filtered.
function broadcastState(room: Room): void {
  room.stateDirty = false;
  for (const p of room.players.values()) if (!p.bot) io.to(p.id).emit('room:state', room.stateFor(p.id));
}


io.on('connection', (socket: Socket<ClientToServer, ServerToClient>) => {
  lastActive.set(socket.id, Date.now());
  socket.onAny(() => lastActive.set(socket.id, Date.now()));
  socket.on('disconnect', () => {
    lastActive.delete(socket.id);
    trusted.delete(socket.id);
  });

  socket.on('access:unlock', (raw, ack) => {
    if (typeof ack !== 'function') return;
    if (isTrusted(socket.id)) return ack({ ok: true });
    // The client sends its saved code (maybe none) on every connect; an empty
    // one isn't a guess, so it doesn't count against the limit.
    if (!String(raw ?? '').trim()) return ack({ ok: false, error: 'Enter an invite code.' });
    if (checking.has(socket.id)) return ack({ ok: false, error: 'Still checking your code…' });
    const ip = clientIp(socket);
    if (unlockBlocked(ip)) return ack({ ok: false, error: 'Too many tries. Wait a while and try again.' });
    checking.add(socket.id);
    void checkInvite(String(raw), ip)
      .then((r) => {
        if (r.ok) {
          if (socket.connected) trusted.add(socket.id);
          return ack({ ok: true });
        }
        if (r.wrong) recordWrongCode(ip);
        ack({ ok: false, error: r.error });
      })
      .finally(() => checking.delete(socket.id));
  });

  const invited = (ack: (r: Ack<JoinResult>) => void): boolean => {
    if (isTrusted(socket.id)) return true;
    ack({ ok: false, error: 'Playing with friends is invite only. Enter an invite code first.' });
    return false;
  };

  const currentRoom = (): Room | undefined => {
    const code = roomOfSocket.get(socket.id);
    return code ? rooms.get(code) : undefined;
  };

  const leave = (): void => {
    const room = currentRoom();
    if (!room) return;
    roomOfSocket.delete(socket.id);
    socket.leave(room.code);
    room.remove(socket.id);
    // Bots alone don't keep a station open.
    if (room.humanCount === 0) rooms.delete(room.code);
    else broadcastState(room);
  };

  const enter = (room: Room, name: string, ack: (r: Ack<JoinResult>) => void): void => {
    room.add(socket.id, name);
    roomOfSocket.set(socket.id, room.code);
    socket.join(room.code);
    ack({ ok: true, code: room.code, playerId: socket.id });
    broadcastState(room);
  };

  const createRoom = (): Room => {
    leave();
    const room = new Room(newCode(), MIN_PLAYERS, TASKS_PER);
    room.onChat = (msg, recipients) => {
      for (const id of recipients) io.to(id).emit('chat', msg);
    };
    room.isTrusted = isTrusted;
    rooms.set(room.code, room);
    return room;
  };

  socket.on('room:create', (payload, ack) => {
    if (typeof ack !== 'function' || !invited(ack)) return;
    const name = cleanName(payload?.name);
    if (!name) return ack({ ok: false, error: 'Enter a name first.' });
    enter(createRoom(), name, ack);
  });

  // One click from the title screen: a private room, a crew of bots, and go.
  socket.on('room:solo', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const room = createRoom();
    enter(room, cleanName(payload?.name) || 'Diver', ack);
    for (let i = 0; i < SOLO_BOTS; i++) room.addBot();
    room.start();
    broadcastState(room);
  });

  socket.on('room:join', (payload, ack) => {
    if (typeof ack !== 'function' || !invited(ack)) return;
    const name = cleanName(payload?.name);
    const code = String(payload?.code ?? '').trim().toUpperCase();
    if (!name) return ack({ ok: false, error: 'Enter a name first.' });
    const room = rooms.get(code);
    if (!room) return ack({ ok: false, error: `No station with code ${code || '----'}.` });
    if (room.phase !== 'lobby') return ack({ ok: false, error: 'That round is already underway.' });
    if (room.isFull) return ack({ ok: false, error: 'That station is full.' });
    leave();
    enter(room, name, ack);
  });

  socket.on('room:leave', leave);
  socket.on('disconnect', leave);

  socket.on('lobby:color', (color) => {
    const room = currentRoom();
    if (room?.setColor(socket.id, color)) broadcastState(room);
  });

  socket.on('game:start', (ack) => {
    if (typeof ack !== 'function') return;
    const room = currentRoom();
    if (!room || room.hostId !== socket.id) return ack({ ok: false, error: 'Only the host can start.' });
    if (room.phase !== 'lobby') return ack({ ok: false, error: 'Already started.' });
    if (room.players.size < room.minPlayers) {
      return ack({ ok: false, error: `Need at least ${room.minPlayers} divers.` });
    }
    room.start();
    ack({ ok: true });
    broadcastState(room);
  });

  socket.on('game:end', () => {
    const room = currentRoom();
    if (!room || room.hostId !== socket.id || room.phase === 'lobby') return;
    room.end();
    broadcastState(room);
  });

  socket.on('input', (payload) => {
    currentRoom()?.setInput(socket.id, sanitizeInput(payload?.dx, payload?.dy));
  });

  const act = (fn: (room: Room) => boolean) => () => {
    const room = currentRoom();
    if (room && fn(room)) broadcastState(room);
  };
  socket.on('kill', (targetId) => act((r) => r.kill(socket.id, String(targetId)))());
  socket.on('report', act((r) => r.report(socket.id)));
  socket.on('alarm', act((r) => r.alarm(socket.id)));
  socket.on('task:start', (taskId) => act((r) => r.startTask(socket.id, String(taskId)))());
  socket.on('task:complete', (taskId) => act((r) => r.completeTask(socket.id, String(taskId)))());
  socket.on('sabotage', (kind) => act((r) => r.startSabotage(socket.id, String(kind) as SabotageKind))());
  socket.on('fix:hold', (panelId, holding) => act((r) => r.fixHold(socket.id, String(panelId), holding === true))());
  socket.on('vent:enter', act((r) => r.enterVent(socket.id)));
  socket.on('vent:move', (ventId) => act((r) => r.moveVent(socket.id, String(ventId)))());
  socket.on('vent:exit', act((r) => r.exitVent(socket.id)));
  socket.on('vote', (target) => act((r) => r.vote(socket.id, String(target)))());

  socket.on('chat', (raw) => {
    const room = currentRoom();
    const text = String(raw ?? '').trim().slice(0, CHAT_MAX_LENGTH);
    if (room && text) room.postChat(socket.id, text, CHAT_MIN_INTERVAL_MS);
  });

  socket.on('bot:add', () => {
    const room = currentRoom();
    if (room?.hostId === socket.id && room.addBot()) broadcastState(room);
  });
  socket.on('bot:remove', () => {
    const room = currentRoom();
    if (room?.hostId === socket.id && room.removeBot()) broadcastState(room);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.update(now)) room.stateDirty = true;
    if (room.phase !== 'playing') continue;
    // Panel progress changes every tick; share it at ~5 Hz, not 30.
    // A dirty flag makes sure the last change (e.g. "fixed") is never dropped.
    if (room.tick()) room.progressDirty = true;
    if (room.progressDirty && now - room.lastProgressBroadcast >= 200) {
      room.lastProgressBroadcast = now;
      room.progressDirty = false;
      broadcastState(room);
    }
    for (const p of room.players.values()) if (!p.bot) io.to(p.id).emit('snapshot', room.snapshotFor(p.id));
  }
  // Anything bots did this tick (or that update() flagged) goes out now.
  for (const room of rooms.values()) if (room.stateDirty) broadcastState(room);
}, 1000 / TICK_RATE);

setInterval(() => {
  const cutoff = Date.now() - IDLE_MS;
  for (const [id, at] of lastActive) if (at < cutoff) io.sockets.sockets.get(id)?.disconnect(true);
}, Math.min(30_000, IDLE_MS));

// In production the server also hosts the built client.
const clientDir = fileURLToPath(new URL('../client', import.meta.url));
if (existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: clientDir }));
}

httpServer.listen(PORT, () =>
  console.log(`Abyss Station server on :${PORT} (${invitesRequired ? 'invite codes required for multiplayer and AI chat' : 'no ABYSS_VERIFY_TOKEN: everything unlocked'})`),
);
