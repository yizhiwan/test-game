import { useEffect, useRef } from 'react';
import type { RoomState } from '../shared/protocol';
import { sfx, startAmbience, stopAmbience } from './audio';

/** Watches room state transitions and plays the matching sound. */
export function useSoundCues(room: RoomState | null, selfId: string): void {
  const prev = useRef<RoomState | null>(null);

  useEffect(() => {
    const was = prev.current;
    prev.current = room;
    if (!room) {
      stopAmbience();
      return;
    }
    if (room.phase === 'playing') startAmbience();
    else stopAmbience();
    if (!was) return;

    if (room.phase === 'playing' && was.phase === 'lobby') sfx.roleReveal(room.you?.role === 'mimic');
    if (room.phase === 'meeting' && was.phase === 'playing') sfx.meeting();
    if (room.meeting?.stage === 'result' && was.meeting?.stage !== 'result' && room.meeting.result?.ejectedId) sfx.eject();
    if (room.phase === 'ended' && was.phase !== 'ended' && room.gameOver) {
      if (room.gameOver.roles[selfId] === room.gameOver.winner) sfx.win();
      else sfx.lose();
    }

    const you = room.you;
    const before = was.you;
    if (you && before && room.phase === 'playing' && was.phase === 'playing') {
      if (before.alive && !you.alive) sfx.kill(); // we were killed
      if (you.role === 'mimic' && you.killCooldownMs > before.killCooldownMs + 1000) sfx.kill(); // we killed
      if (you.tasks.filter((t) => t.done).length > before.tasks.filter((t) => t.done).length) sfx.taskDone();
      if (you.vent !== before.vent) sfx.vent();
    }
    if (room.sabotage?.kind === 'lights' && was.sabotage?.kind !== 'lights') sfx.lightsOut();
    if (!room.sabotage && was.sabotage && room.phase === 'playing') sfx.fixed();
  }, [room, selfId]);

  // Critical sabotage klaxon, once a second while the timer runs.
  const critical = room?.phase === 'playing' && room.sabotage?.remainingMs != null;
  useEffect(() => {
    if (!critical) return;
    sfx.klaxon();
    const id = setInterval(sfx.klaxon, 1000);
    return () => clearInterval(id);
  }, [critical]);
}
