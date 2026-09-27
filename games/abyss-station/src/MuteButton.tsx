import { useEffect, useState } from 'react';
import { isMuted, onMuteChange, setMuted } from './audio';

export function MuteButton() {
  const [muted, set] = useState(isMuted);
  useEffect(() => onMuteChange(set), []);
  return (
    <button
      className="mute"
      onClick={() => setMuted(!muted)}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      title={muted ? 'Unmute (M)' : 'Mute (M)'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
