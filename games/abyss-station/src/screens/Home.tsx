import { useState, type FormEvent } from 'react';
import { NAME_MAX_LENGTH } from '../../shared/constants';
import { socket } from '../socket';
import { unlock } from '../access';

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
  dropped: boolean; // closed by the server for idling; no auto-reconnect
  trusted: boolean; // has the access code: may play with friends
  onUnlocked: () => void;
  notice: string;
  onClearNotice: () => void;
}

export function Home({ connected, dropped, trusted, onUnlocked, notice, onClearNotice }: Props) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState('');
  const [access, setAccess] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submitAccess = (e: FormEvent) => {
    e.preventDefault();
    onClearNotice();
    setError('');
    setBusy(true);
    unlock(access, (err) => {
      setBusy(false);
      if (err) setError(err);
      else {
        setAccess('');
        onUnlocked();
      }
    });
  };

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

  const solo = () => {
    onClearNotice();
    setError('');
    if (name.trim()) saveName(name);
    setBusy(true);
    socket.emit('room:solo', { name }, handle);
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

        <button className="btn primary big" onClick={solo} disabled={!connected || busy}>
          Play vs bots
        </button>
        <p className="hint center">Jump straight in with five AI divers. One of them is not what they seem.</p>

        <div className="divider">
          <span>or play with friends</span>
        </div>

        {trusted ? (
          <>
            <button className="btn" onClick={create} disabled={disabled}>
              Host a new dive
            </button>

            <div className="divider">
              <span>or join with a code</span>
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
          </>
        ) : (
          <>
            <p className="hint center">
              <strong>Want the full experience?</strong> Multiplayer with friends, plus AI divers that argue, accuse
              and lie in meetings. It's invite only:{' '}
              <a href="https://eonelabs.my/#contact" target="_blank" rel="noopener">
                contact Ikhwan
              </a>{' '}
              for a code.
            </p>
            <form className="join" onSubmit={submitAccess}>
              <input
                value={access}
                onChange={(e) => setAccess(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
                aria-label="Invite code"
                autoComplete="off"
                spellCheck={false}
              />
              <button className="btn" type="submit" disabled={!connected || busy || !access.trim()}>
                Unlock
              </button>
            </form>
          </>
        )}

        {!connected &&
          (dropped ? (
            <button
              className="btn"
              onClick={() => {
                onClearNotice();
                socket.connect();
              }}
            >
              Reconnect
            </button>
          ) : (
            <p className="status">Connecting to the surface relay…</p>
          ))}
        {(error || notice) && <p className="error">{error || notice}</p>}
      </section>
    </main>
  );
}
