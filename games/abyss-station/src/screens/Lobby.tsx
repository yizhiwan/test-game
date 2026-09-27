import { useState } from 'react';
import { COLORS, MAX_PLAYERS, mimicCount } from '../../shared/constants';
import type { RoomState } from '../../shared/protocol';
import { socket } from '../socket';

interface Props {
  room: RoomState;
  selfId: string;
  onLeave: () => void;
}

export function Lobby({ room, selfId, onLeave }: Props) {
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === selfId;
  const me = room.players.find((p) => p.id === selfId);
  const takenBy = new Map(room.players.map((p) => [p.color, p.id]));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable; the code is on screen anyway.
    }
  };

  const start = () => {
    setError('');
    socket.emit('game:start', (r) => {
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <main className="screen lobby">
      <section className="panel wide">
        <div className="lobby-head">
          <div>
            <p className="eyebrow">Station code</p>
            <button className="room-code" onClick={copy} title="Copy code">
              {room.code}
            </button>
            <p className="hint">{copied ? 'Copied!' : 'Share this code with your crew.'}</p>
          </div>
          <p className="count">
            {room.players.length}/{MAX_PLAYERS} divers
          </p>
        </div>

        <ul className="roster">
          {room.players.map((p) => (
            <li key={p.id} className={p.id === selfId ? 'me' : ''}>
              <span className="swatch" style={{ background: COLORS[p.color]?.hex }} />
              <span className="name">{p.name}</span>
              {p.bot && <span className="tag bot">bot</span>}
              {p.id === room.hostId && <span className="tag">host</span>}
              {p.id === selfId && <span className="tag you">you</span>}
            </li>
          ))}
        </ul>

        {isHost && (
          <div className="bot-controls">
            <span className="hint">AI divers fill empty seats and argue in meetings.</span>
            <button className="btn small" onClick={() => socket.emit('bot:remove')} disabled={!room.players.some((p) => p.bot)}>
              − Bot
            </button>
            <button className="btn small" onClick={() => socket.emit('bot:add')} disabled={room.players.length >= MAX_PLAYERS}>
              + Bot
            </button>
          </div>
        )}

        <p className="eyebrow">Suit color</p>
        <div className="colors">
          {COLORS.map((c, i) => {
            const owner = takenBy.get(i);
            const mine = owner === selfId;
            return (
              <button
                key={c.name}
                className={`color ${mine ? 'selected' : ''}`}
                style={{ background: c.hex }}
                disabled={owner !== undefined && !mine}
                onClick={() => socket.emit('lobby:color', i)}
                title={c.name}
                aria-label={`${c.name}${owner && !mine ? ' (taken)' : ''}`}
              />
            );
          })}
        </div>
        {me && <p className="hint">You are wearing {COLORS[me.color]?.name}.</p>}

        <div className="actions">
          <button className="btn ghost" onClick={onLeave}>
            Leave
          </button>
          {isHost ? (
            <button className="btn primary" onClick={start} disabled={room.players.length < room.minPlayers}>
              Start dive
            </button>
          ) : (
            <p className="status">Waiting for the host to start…</p>
          )}
        </div>
        <p className="hint">
          {room.players.length < room.minPlayers
            ? `Need at least ${room.minPlayers} divers to start.`
            : `${mimicCount(room.players.length)} Mimic${mimicCount(room.players.length) > 1 ? 's' : ''} will be hiding among you.`}
        </p>
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}
