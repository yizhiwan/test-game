import { useEffect } from 'react';
import { COLORS } from '../../shared/constants';
import type { RoomState } from '../../shared/protocol';

interface Props {
  room: RoomState;
  onDone: () => void;
}

export function RoleIntro({ room, onDone }: Props) {
  useEffect(() => {
    const id = setTimeout(onDone, 3800);
    return () => clearTimeout(id);
  }, [onDone]);

  const you = room.you;
  if (!you) return null;
  const mimic = you.role === 'mimic';
  const partners = room.players.filter((p) => you.mimicIds.includes(p.id));

  return (
    <div className={`intro ${mimic ? 'mimic' : ''}`} onClick={onDone}>
      <p className="eyebrow">You are</p>
      <h1>{mimic ? 'A MIMIC' : 'A DIVER'}</h1>
      <p className="tagline">
        {mimic
          ? 'Blend in. Pick them off one by one. Do not get flushed.'
          : 'Keep the station alive. Someone wearing a familiar face is not what they seem.'}
      </p>
      {mimic && partners.length > 1 && (
        <p className="partners">
          {partners.map((p) => (
            <span key={p.id}>
              <span className="swatch" style={{ background: COLORS[p.color]?.hex }} /> {p.name}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
