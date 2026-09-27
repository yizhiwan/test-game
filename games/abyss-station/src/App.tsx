import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage, RoomState } from '../shared/protocol';
import { socket } from './socket';
import { MuteButton } from './MuteButton';
import { setMuted, isMuted } from './audio';
import { useSoundCues } from './useSoundCues';
import { Game } from './screens/Game';
import { GameOver } from './screens/GameOver';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Meeting } from './screens/Meeting';
import { Practice } from './screens/Practice';
import type { TaskKind } from '../shared/tasks';
import { RoleIntro } from './screens/RoleIntro';

const practice = new URLSearchParams(location.search).get('practice');

export function App() {
  if (practice !== null) return <Practice initial={(practice || null) as TaskKind | null} />;
  return <Station />;
}

function Station() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [notice, setNotice] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [introSeen, setIntroSeen] = useState(0);

  useEffect(() => {
    const onState = (s: RoomState) => setRoom(s);
    const onChat = (m: ChatMessage) => setChat((prev) => [...prev.slice(-99), m]);
    const onConnect = () => setConnected(true);
    // The server drops us from the room on disconnect, so start over.
    const onDisconnect = () => {
      setConnected(false);
      setRoom((prev) => {
        if (prev) setNotice('Lost connection to the station.');
        return null;
      });
    };
    socket.on('room:state', onState);
    socket.on('chat', onChat);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    // The socket may have connected before these listeners were attached.
    setConnected(socket.connected);
    return () => {
      socket.off('room:state', onState);
      socket.off('chat', onChat);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const leave = () => {
    socket.emit('room:leave');
    setRoom(null);
  };
  const finishIntro = useCallback(() => setIntroSeen(room?.round ?? 0), [room?.round]);

  const selfId = socket.id ?? '';
  useSoundCues(room, selfId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !(e.target instanceof HTMLInputElement)) setMuted(!isMuted());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <Screen
        room={room}
        selfId={selfId}
        chat={chat}
        connected={connected}
        notice={notice}
        introSeen={introSeen}
        onClearNotice={() => setNotice('')}
        onLeave={leave}
        onIntroDone={finishIntro}
      />
      <MuteButton />
    </>
  );
}

interface ScreenProps {
  room: RoomState | null;
  selfId: string;
  chat: ChatMessage[];
  connected: boolean;
  notice: string;
  introSeen: number;
  onClearNotice: () => void;
  onLeave: () => void;
  onIntroDone: () => void;
}

function Screen({ room, selfId, chat, connected, notice, introSeen, onClearNotice, onLeave: leave, onIntroDone: finishIntro }: ScreenProps) {
  if (!room) return <Home connected={connected} notice={notice} onClearNotice={onClearNotice} />;
  switch (room.phase) {
    case 'lobby':
      return <Lobby room={room} selfId={selfId} onLeave={leave} />;
    case 'meeting':
      return <Meeting room={room} selfId={selfId} chat={chat.filter((c) => c.meetingId === room.meeting?.id)} />;
    case 'ended':
      return <GameOver room={room} selfId={selfId} onLeave={leave} />;
    case 'playing':
      return (
        <>
          <Game room={room} selfId={selfId} onLeave={leave} />
          {introSeen !== room.round && <RoleIntro room={room} onDone={finishIntro} />}
        </>
      );
  }
}
