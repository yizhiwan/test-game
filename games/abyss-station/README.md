# Abyss Station

A multiplayer social-deduction game set on a research base 3,800 m down a
trench, in the spirit of Among Us. Divers keep the station running; something
that came up from the trench is wearing one of their faces.

## Status

| Milestone | State |
|---|---|
| 2. Lobby with room codes, suit colors, synced movement on the station map | **Done** |
| 3. Roles, kills, bodies, reporting, meetings and voting | **Done** |
| 4. Task mini-games and the task-bar win condition | **Done** |
| 5. Sabotage (hull breach, O₂ leak, lights), vents, real vision limits, sound | **Done** |
| 6. Gemini-powered AI bot divers that fill empty seats and lie in meetings | **Done** |

## How to play

- **Divers** keep the station running: each gets 5 repair tasks at glowing
  consoles around the map. Walk up and press **Use** (`E`) to play the
  mini-game. Every finished task fills the shared **Station repairs** bar.
  Ghosts can still do their tasks.
- **Mini-games:** reconnect cables, calibrate a sonar needle, hold a valve
  wheel, sort samples in order, and pick silt out of a filter. Try them
  offline at `/?practice`.
- **Mimics** (1, or 2 with 7+ players) get a fake task list to blend in, but
  can't do tasks. They kill divers with `Q` (25 s cooldown). The killer lands on the body.
- **Sabotage** (Mimics, `X`, 30 s cooldown):
  - **Lights out**: divers' lamps shrink to a few metres until someone holds
    the panel in the Thermal Generator.
  - **O₂ leak**: 40 s to hold the panels in Life Support *and* Sonar.
  - **Hull breach**: 45 s for two divers to hold the panels in Pressure
    Control and the Moon Pool *at the same time*.
  If a timed sabotage runs out, the Mimics win. The alarm can't be pressed
  during one, but reporting a body (or any meeting) clears it.
- **Vents** (Mimics, `V`): hop between the three vents on each network
  (west, east, central). You're invisible inside and can't kill.
- **Vision**: you only see what your helmet lamp reaches, and Mimics see
  further. This is enforced by the server, which never sends you players or
  bodies outside your light.
- Find a body and press **Report** (`R`), or hit the red **alarm** on the Mess
  Hall table (`E`, once per diver per round) to call a meeting.
- Meetings: 15 s of discussion, then 45 s to vote someone out or skip. Ties and
  skips flush nobody. The vote ends early when every living diver has voted.
- The dead become ghosts: they drift through walls, can't vote, and can only
  chat with other ghosts.
- **Divers win** when the repair bar is full, or every Mimic is flushed. **Mimics win** once they equal or
  outnumber the divers.

## AI bots

**Play vs bots** on the title screen starts a solo round right away: you and
five bots, one of them a Mimic. In a normal lobby the host can also add or
remove bots (**+ Bot** / **− Bot**) to fill empty seats. Bots are marked with a
*bot* tag.

- **Diver bots** find their way between rooms, do their tasks at a human
  pace, report bodies they see, fix sabotage (splitting up across panels, and
  holding the hull-breach panels together), and run for the alarm if they
  witness a kill.
- **Mimic bots** hunt divers who are alone, avoid witnesses, flee through
  vents, sabotage, and loiter at fake tasks to build an alibi.
- **In meetings** every bot argues from what it actually saw: who it passed,
  who was near the body shortly before it was found, and what it witnessed.
  Mimic bots lie, deflect accusations, and try to frame whoever was nearby.
  They vote on their own evidence plus who the chat is pointing at.
- **Fair play:** bots see the station through exactly the same lamp-limited
  view a human gets, and act only through the same server-checked actions.

Meeting dialogue comes from **Gemini** (`gemini-3.5-flash-lite`, the same AI
SDK setup as Cyberpunk Lab 404) when a key is set, and each bot has its own
voice. Without a key, or if a call fails or takes over 6 s, bots use canned
lines built from the same facts, so they still make accusations and alibis:

```bash
cp .env.example .env   # then paste a free key from https://aistudio.google.com/apikey
```

## Run it

```bash
npm install
npm run dev        # server on :3001, client on http://localhost:5173
```

A round needs 4 players, and bots count, so the quickest solo game is the
**Play vs bots** button. To test with only humans instead, lower the
minimum and open two browser windows, hosting in one and joining with the
4-letter code in the other:

```bash
ABYSS_MIN_PLAYERS=2 npm run dev
```

`ABYSS_TASKS=2` shortens rounds by giving each diver fewer tasks.

Production:

```bash
npm run build && npm start   # serves everything on $PORT (default 3001)
```

## How it works

```
shared/    map layout, physics and the typed socket protocol, used by both sides
server/    Express + Socket.IO; one Room per code, authoritative 30 Hz tick
  bots/    bot brains (navigation, tasks, hunting, voting) and Gemini meeting talk
src/       Vite + React screens (home, lobby, game) and a Canvas 2D renderer
```

- **Server is authoritative.** Clients only send a movement direction
  (`input`); the server steps everyone with `shared/physics.ts` and
  broadcasts snapshots. Clients never send positions, so nobody can
  teleport through walls.
- **Your own diver** is predicted locally with the same physics, so it
  responds instantly, and eases onto the server's position when you stop.
- **Other divers** are drawn 100 ms in the past, interpolated between
  snapshots, which turns the 30 Hz tick into smooth 60 fps motion.
- **Sound is synthesised** with Web Audio (no audio files): alarms, kills,
  task chimes, the sabotage klaxon and a low hull drone. `M` or the speaker
  button mutes it.
- **Secrets stay on the server.** Each player gets their own filtered view:
  roles are only sent to their owner (and Mimics see their partners), a death
  is only revealed at the next meeting, living players never receive ghost
  positions or ghost chat, and nobody receives anything outside their lamp.
- **Tasks are verified server-side**: the station must be one of yours, you
  must have opened it while standing at it, and the mini-game must have taken
  a believable minimum time. Mimics' tasks are never accepted.
- **Collision:** the walkable area is a union of room and corridor
  rectangles; blocked moves retry each axis alone so you slide along walls.

## Deploy (Cloud Run)

The `Dockerfile` builds one container that serves the client and the
socket server. Rooms live in memory, so keep it on a single instance for
now and turn on session affinity:

```bash
gcloud run deploy abyss-station --source . --max-instances 1 --session-affinity \
  --set-env-vars GOOGLE_GENERATIVE_AI_API_KEY=your-key   # optional, for bot chat
```
