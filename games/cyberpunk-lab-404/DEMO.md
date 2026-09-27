# Demo script — Cyberpunk Lab 404

> **Spoiler warning.** This file names the killer, the airlock code, and every
> shortcut to every ending. It is written for you to rehearse from, not for
> your audience to read over your shoulder. Keep it off the shared screen.

---

## Before you go live

```bash
npm install
npm run dev
```

Open **http://localhost:3000**.

**Decide which dialogue mode you want on stage:**

| Mode | Setup | Trade-off |
| --- | --- | --- |
| Live AI | Set `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local` (free, see [README](README.md)) | Real Gemini replies, more impressive, but wording differs every take — rehearse the exact line you'll type |
| Fallback | No key needed, works out of the box | Suspects answer from a fixed rotation of in-character lines, identical every rehearsal, zero risk of a network hiccup mid-demo |

If this is your first time running the full script end to end, rehearse in
fallback mode once so the flow is muscle memory, then switch to live mode for
the real thing if you want the extra polish.

**Resetting between takes:** click **Play Again** on any ending screen, or go
back to `/` and click **Initiate Investigation** — either fully wipes
evidence, trust, and the clock for a clean run.

**Fast preview trick:** navigating the browser straight to
`http://localhost:3000/ending/<type>` (`win_murder`, `win_escape`,
`lose_wrong`, or `lose_time`) renders that ending screen instantly, using
whatever is currently in your evidence/trust state. Handy for just showing
what a screen looks like without staging the run that leads to it — but it
doesn't reset anything, so click **Initiate Investigation** afterward before
starting your next real take.

---

## The core loop (2–3 min)

Run this first no matter which ending you're heading toward — it's the part
that sells the concept.

1. Title screen → **Initiate Investigation**.
2. Click the **workbench** → picks up the **Bloody Keycard**, unlocks KAI-7.
3. Click the **vent** (was locked until now) → picks up the **Encrypted
   Drive**, unlocks NOVA.
4. Click the **observation window** → picks up the **Reflection Log**,
   unlocks Dr. Chen Ling.
5. Open **Inventory** (bottom-right) — three clues collected, worth pausing
   on for a beat.
6. Click **Dr. Aris Wijaya**'s portrait → ask him anything (e.g. *"Where were
   you at 09:40 PM?"*) → point out the trust and suspicion meters moving
   independently.
7. Click **Present Evidence** → pick **Encrypted Drive** → **Confirm**.

Step 7 is the best beat in the demo: his portrait glitches red, **ALIBI
BROKEN** fires, trust jumps, and the airlock code drops straight into your
inventory as a new clue. It's the clearest moment where the game visibly
reacts to something specific you handed it, rather than just replying to text.

From here, branch into whichever ending you want to show.

---

## What to ask each suspect

Use this if you have more than the tight ten-minute version to fill — a
longer demo slot, or questions from the room afterward where you want to keep
poking at a suspect live instead of rushing to an ending.

Everything below assumes **live mode** (a `GOOGLE_GENERATIVE_AI_API_KEY` set).
In fallback mode the suspect's reply is a fixed rotation of lines that
ignores whatever you type, and plain questions never move trust or
suspicion — only presenting evidence does, through the hard-coded rules in
[`app/api/npc/evaluate`](app/api/npc/evaluate/route.ts). If you're demoing
without a key, skip this section and lean on the evidence beats instead.

With a key, every line below is chosen to land on a specific rung of that
suspect's trust ladder in [`lib/caseData.ts`](lib/caseData.ts), so the answer
should visibly shift in tone as you move down each list.

### Dr. Aris Wijaya — the killer

Starts at trust 30, cold and clipped.

| Ask | Shows off |
| --- | --- |
| *"I'm sorry for your loss. Were you close with Kenji?"* | A polite, empathetic question — a small, steady trust gain |
| *"Walk me through your evening. Where were you at 9:40?"* | The rehearsed Server Room B alibi, word for word |
| *"Can anyone actually confirm you were there the whole time?"* | Pressing the alibi with nothing to back it — a mild cost |
| *"You killed him, didn't you?"* | A direct accusation with no proof — the single biggest trust hit in the game. Good bonus beat for what **not** to do |
| *(after presenting the Encrypted Drive)* "What's in the Specimen 404 trial logs?" | His alibi is already gone; he gives up the falsification rather than the murder itself |
| *"Did you kill him?"* | Only worth trying once trust is pushed well past 85 — the actual confession, and it needs sustained pressure plus the drive, not one lucky question |

### Dr. Chen Ling — the witness

Starts at trust 45, nervous, over-explains everything.

| Ask | Shows off |
| --- | --- |
| *"This must be a lot to process. Are you doing okay?"* | Empathetic opener, trust ticks up |
| *"Did you see anyone near Lab 404 around 9:40 PM?"* | She deflects — "I wasn't really watching" |
| *(after presenting the Reflection Log)* "That's you in the stairwell, isn't it?" | She stops denying she was there, regardless of current trust |
| *"Who did you see go in?"* | At high trust, she names Aris outright — a witness's confession, not the killer's |

### KAI-7 — the security bot

Starts at trust 50, flat and literal. Phrase things as records requests, not
feelings — it responds to that register specifically.

| Ask | Shows off |
| --- | --- |
| *"Do you have a log of who entered Lab 404 around 9:40 PM?"* | Releases the general timeline, badge IDs still redacted |
| *"What happened to the camera feed?"* | Reveals the 09:46 PM wipe once trust clears 70 |
| *(after presenting the Bloody Keycard)* "Cross-reference this against your door logs." | Confirms it's the same credential used at 09:40 and 09:46 — a records match, not an opinion |
| *"Whose credential was it?"* | Above trust 85, gives up the name on the card |

### NOVA — the ally

Starts at trust 60, snarky, cannot be accused. Good comic relief between
suspects.

| Ask | Shows off |
| --- | --- |
| *"What should I be looking at?"* | A vague nudge if trust is still low |
| *(after collecting the Encrypted Drive)* "Can you crack this?" | Decrypts it once trust clears 70, handing over the falsified logs and the ethics-board note |
| *"Who do you think did it?"* | She refuses to name anyone, no matter how high trust climbs — the game enforcing that she's an ally, not an oracle |

### Patterns worth calling out live

- Polite, specific questions nudge trust up a little at a time. Vague or
  repeated ones do nothing, or cost a little.
- A direct accusation with no evidence in hand is the worst thing you can say
  to any suspect — a bigger hit than an aggressive question.
- Presenting evidence is the one action that can move a suspect several
  points in a single turn, for better or worse, depending on whether it
  actually implicates them.

---

## The four endings

### 1 · WIN — Case Closed (correct conviction)

Needs both **Bloody Keycard** and **Encrypted Drive** in inventory — already
true if you ran the core loop above.

1. Go to the **terminal** (click its hotspot in the room).
2. Switch to the **File Accusation** tab.
3. Select **Dr. Aris Wijaya**.
4. **Submit**.

→ Green **CASE CLOSED** screen. Debrief shows the killer, motive, time used,
evidence held, and final trust per suspect.

### 2 · WIN — Exfil Complete (escape, no conviction)

Needs nothing collected at all — the code alone is enough.

1. Go to the **terminal**.
2. Stay on **Access Code**.
3. Type `404-SPECIMEN`.
4. **Verify**.

→ Cyan **EXFIL COMPLETE** screen, reveals the code, notes the killer walks
free but is exposed through corporate channels.

Good one to show right after Case Closed, back to back: same case, two very
different resolutions depending only on what the player chooses to do with
the same evidence.

### 3 · LOSE — Wrong Target

Two ways in — pick whichever tells a better story on stage.

**(a) Accuse an innocent.** File Accusation → Chen, KAI-7, or NOVA → Submit.
Trying NOVA specifically shows *"That one has no body to book. Pick again."*
— a nice beat if you want to show the game enforcing its own fiction.

**(b) Accuse Aris without proof.** Fresh run, skip evidence entirely, go
straight to the terminal, File Accusation → Aris → Submit. Also **Wrong
Target**, but the debrief tags the accused name **"RIGHT NAME, NOT ENOUGH
PROOF."** This is the more interesting one — it demonstrates that knowing who
did it isn't the win condition. Proving it is.

→ Red glitching **WRONG TARGET** screen, reveals the real killer either way.

### 4 · LOSE — Cleanup Arrived (out of time)

The honest version takes sixty real minutes. Two ways to shortcut it:

**Instant preview** — just navigate to
`http://localhost:3000/ending/lose_time`. Shows the screen with no setup, but
nothing actually happened on stage.

**Real trigger** — more convincing live, because the redirect fires on its
own while you're talking. From inside the room, open DevTools (F12) →
Console, paste:

```js
const key = "cyberpunk-lab-404";
const saved = JSON.parse(localStorage.getItem(key));
saved.state.timeRemaining = 5;
localStorage.setItem(key, JSON.stringify(saved));
location.reload();
```

Wait about five seconds. The clock counts down for real and the game
redirects itself to **CLEANUP ARRIVED** without you touching anything.

---

## Bonus beat, not an ending: lockout

Ask Aris something hostile a few times in a row without evidence (aggressive
questions cost trust) until his trust drops under 20. A **SUSPECT REFUSES TO
COOPERATE** overlay locks the input. Worth showing once if you have time — it
demonstrates that pushing too hard has a real cost, separate from how the case
itself resolves.

---

## Suggested running order

1. Core loop (evidence + first alibi break) — ~2 min
2. Case Closed — the intended win
3. Reset → Exfil Complete — the same case, resolved differently
4. Reset → Wrong Target via insufficient evidence — the twist most people
   don't expect
5. Mention Cleanup Arrived exists, show it via the instant-preview URL rather
   than spending stage time faking a real timeout

That's every ending covered in under ten minutes without ever waiting on a
real clock.

---

## Quick reference

| Hotspot | Yields | Unlocks |
| --- | --- | --- |
| Workbench | Bloody Keycard | KAI-7 |
| Air Vent *(needs Workbench first)* | Encrypted Drive | NOVA |
| Observation Window | Reflection Log | Dr. Chen Ling |
| The Body, Lab Terminal | — | — |

**Killer:** Dr. Aris Wijaya · **Airlock code:** `404-SPECIMEN` · **Conviction
needs:** Bloody Keycard + Encrypted Drive in inventory.
