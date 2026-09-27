import { COLORS } from '../../shared/constants';
import type { RoomState } from '../../shared/protocol';
import { socket } from '../socket';

interface Props {
  room: RoomState;
  selfId: string;
  onLeave: () => void;
}

export function GameOver({ room, selfId, onLeave }: Props) {
  const over = room.gameOver!;
  const myRole = over.roles[selfId];
  const won = myRole === over.winner;
  const isHost = room.hostId === selfId;

  return (
    <main className={`screen gameover ${over.winner}`}>
      <header className="title">
        <p className="eyebrow">{won ? 'Victory' : 'Defeat'}</p>
        <h1>{over.winner === 'diver' ? 'THE CREW SURVIVES' : 'THE MIMICS WIN'}</h1>
        <p className="tagline">{over.reason}</p>
      </header>

      <section className="panel wide">
        <ul className="roster">
          {room.players.map((p) => (
            <li key={p.id} className={p.id === selfId ? 'me' : ''}>
              <span className="swatch" style={{ background: COLORS[p.color]?.hex }} />
              <span className="name">{p.name}</span>
              {p.bot && <span className="tag bot">bot</span>}
              <span className={`tag ${over.roles[p.id] === 'mimic' ? 'mimic' : ''}`}>
                {over.roles[p.id] === 'mimic' ? 'Mimic' : 'Diver'}
              </span>
              {p.dead && <span className="tag">dead</span>}
            </li>
          ))}
        </ul>
        <div className="actions">
          <button className="btn ghost" onClick={onLeave}>
            Leave
          </button>
          {isHost ? (
            <button className="btn primary" onClick={() => socket.emit('game:end')}>
              Back to lobby
            </button>
          ) : (
            <p className="status">Waiting for the host…</p>
          )}
        </div>
      </section>
    </main>
  );
}
