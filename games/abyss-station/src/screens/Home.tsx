import { useState, type FormEvent } from 'react';
import { NAME_MAX_LENGTH } from '../../shared/constants';
import { socket } from '../socket';

const NAME_KEY = 'abyss.name';

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Storage blocked: the name just won't be remembered.
  }
}

interface Props {
  connected: boolean;
  notice: string;
  onClearNotice: () => void;
}

export function Home({ connected, notice, onClearNotice }: Props) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handle = (r: { ok: true } | { ok: false; error: string }) => {
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  const create = () => {
    onClearNotice();
    setError('');
    saveName(name);
    setBusy(true);
    socket.emit('room:create', { name }, handle);
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    onClearNotice();
    setError('');
    saveName(name);
    setBusy(true);
    socket.emit('room:join', { name, code }, handle);
  };

  const disabled = !connected || busy || !name.trim();

  return (
    <main className="screen home">
      <div className="bubbles" aria-hidden />
      <header className="title">
        <p className="eyebrow">Depth 3,800 m · Trench research base</p>
        <h1>ABYSS STATION</h1>
        <p className="tagline">Something came up from the trench. It looks just like one of you.</p>
      </header>

      <section className="panel">
        <label className="field">
          <span>Diver name</span>
          <input
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marlow"
            autoFocus
          />
        </label>

        <button className="btn primary" onClick={create} disabled={disabled}>
          Host a new dive
        </button>

        <div className="divider">
          <span>or join a crew</span>
        </div>

        <form className="join" onSubmit={join}>
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
            placeholder="CODE"
            aria-label="Station code"
          />
          <button className="btn" type="submit" disabled={disabled || code.length !== 4}>
            Join
          </button>
        </form>

        {!connected && <p className="status">Connecting to the surface relay…</p>}
        {(error || notice) && <p className="error">{error || notice}</p>}
      </section>
    </main>
  );
}
