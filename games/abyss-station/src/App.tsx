import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage, RoomState } from '../shared/protocol';
import { socket } from './socket';
import { currentAccessCode, unlock } from './access';
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
  const [dropped, setDropped] = useState(false);
  const [trusted, setTrusted] = useState(false);
  const [notice, setNotice] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [introSeen, setIntroSeen] = useState(0);

  useEffect(() => {
    const onState = (s: RoomState) => setRoom(s);
    const onChat = (m: ChatMessage) => setChat((prev) => [...prev.slice(-99), m]);
    // Access is per connection, so a reconnect re-sends this page's code (if any).
    const restoreAccess = () => unlock(currentAccessCode(), (error) => setTrusted(!error));
    const onConnect = () => {
      setConnected(true);
      setDropped(false);
      restoreAccess();
    };
    // The server drops us from the room on disconnect, so start over.
    const onDisconnect = (reason: string) => {
      setConnected(false);
      setTrusted(false);
      // Only the server's idle sweep disconnects on purpose, and Socket.IO
      // won't retry that one: the player has to press Reconnect.
      const idle = reason === 'io server disconnect';
      setDropped(idle);
      setRoom((prev) => {
        if (idle) setNotice('You were idle, so the station link was closed.');
        else if (prev) setNotice('Lost connection to the station.');
        return null;
      });
    };
    socket.on('room:state', onState);
    socket.on('chat', onChat);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    // The socket may have connected before these listeners were attached.
    setConnected(socket.connected);
    if (socket.connected) restoreAccess();
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
        dropped={dropped}
        trusted={trusted}
        onUnlocked={() => setTrusted(true)}
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
  dropped: boolean;
  trusted: boolean;
  onUnlocked: () => void;
  notice: string;
  introSeen: number;
  onClearNotice: () => void;
  onLeave: () => void;
  onIntroDone: () => void;
}

function Screen({ room, selfId, chat, connected, dropped, trusted, onUnlocked, notice, introSeen, onClearNotice, onLeave: leave, onIntroDone: finishIntro }: ScreenProps) {
  if (!room) {
    return (
      <Home
        connected={connected}
        dropped={dropped}
        trusted={trusted}
        onUnlocked={onUnlocked}
        notice={notice}
        onClearNotice={onClearNotice}
      />
    );
  }
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
