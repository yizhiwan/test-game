import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CHAT_MAX_LENGTH, COLORS } from '../../shared/constants';
import type { ChatMessage, RoomState } from '../../shared/protocol';
import { socket } from '../socket';

interface Props {
  room: RoomState;
  selfId: string;
  chat: ChatMessage[];
}

const STAGE_LABEL = { discuss: 'Discuss', vote: 'Vote', result: 'Result' } as const;

export function Meeting({ room, selfId, chat }: Props) {
  const m = room.meeting!;
  const you = room.you;
  const alive = you?.alive ?? false;
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const seconds = useCountdown(m.remainingMs, `${m.id}:${m.stage}`);
  const logRef = useRef<HTMLDivElement>(null);

  const hasVoted = m.voted.includes(selfId);
  const canVote = alive && m.stage === 'vote' && !hasVoted;
  const byId = new Map(room.players.map((p) => [p.id, p]));
  const votesFor = (target: string) =>
    Object.entries(m.result?.votes ?? {})
      .filter(([, t]) => t === target)
      .map(([voter]) => byId.get(voter))
      .filter((p) => !!p);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [chat.length]);

  useEffect(() => setSelected(null), [m.id, m.stage]);

  const confirmVote = (target: string) => {
    socket.emit('vote', target);
    setSelected(null);
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    socket.emit('chat', draft);
    setDraft('');
  };

  const headline =
    m.kind === 'body'
      ? `${m.callerName} found ${m.victimName ?? 'a body'} floating in ${m.location ?? 'the dark'}.`
      : `${m.callerName} sounded the emergency alarm.`;

  let outcome = '';
  if (m.result) {
    const ejected = m.result.ejectedId ? byId.get(m.result.ejectedId) : undefined;
    if (ejected) {
      outcome = `${ejected.name} was flushed out the moon pool. ${ejected.name} ${
        m.result.ejectedWasMimic ? 'was a Mimic.' : 'was not a Mimic.'
      }`;
    } else {
      outcome = m.result.tie ? 'The vote was tied. Nobody was flushed.' : 'The crew skipped. Nobody was flushed.';
    }
  }

  return (
    <main className="screen meeting">
      <section className="panel meeting-panel">
        <header className="meeting-head">
          <div>
            <p className="eyebrow">{m.kind === 'body' ? 'Body reported' : 'Emergency assembly'}</p>
            <h2>{headline}</h2>
          </div>
          <div className="stage">
            <span>{STAGE_LABEL[m.stage]}</span>
            <strong>{seconds}s</strong>
          </div>
        </header>

        {m.stage === 'result' ? (
          <p className="outcome">{outcome}</p>
        ) : (
          <p className="hint">
            {!alive
              ? 'Ghosts cannot vote. Only other ghosts can hear you.'
              : m.stage === 'discuss'
                ? 'Talk it over. Voting opens when the timer runs out.'
                : hasVoted
                  ? 'Vote locked in. Waiting for the others…'
                  : 'Pick a suspect, then confirm. Or skip.'}
          </p>
        )}

        <ul className="suspects">
          {room.players.map((p) => {
            const isSelected = selected === p.id;
            const votable = canVote && !p.dead;
            return (
              <li key={p.id} className={`${p.dead ? 'dead' : ''} ${isSelected ? 'selected' : ''}`}>
                <button disabled={!votable} onClick={() => setSelected(isSelected ? null : p.id)}>
                  <span className="swatch big" style={{ background: COLORS[p.color]?.hex }} />
                  <span className="name">
                    {p.name}
                    {p.id === selfId && <em> (you)</em>}
                    {p.bot && <em> · bot</em>}
                    {you?.mimicIds.includes(p.id) && p.id !== selfId && <em className="partner"> mimic</em>}
                  </span>
                  {m.stage !== 'result' && m.voted.includes(p.id) && <span className="tag">voted</span>}
                  {p.id === m.callerId && <span className="tag caller">caller</span>}
                </button>
                {isSelected && (
                  <button className="btn small primary confirm" onClick={() => confirmVote(p.id)}>
                    Vote
                  </button>
                )}
                {m.stage === 'result' && (
                  <span className="voters">
                    {votesFor(p.id).map((v) => (
                      <span key={v.id} className="swatch" title={v.name} style={{ background: COLORS[v.color]?.hex }} />
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="skip-row">
          {m.stage === 'result' ? (
            <span className="voters">
              Skipped:
              {votesFor('skip').map((v) => (
                <span key={v.id} className="swatch" title={v.name} style={{ background: COLORS[v.color]?.hex }} />
              ))}
            </span>
          ) : (
            <button className="btn small ghost" disabled={!canVote} onClick={() => confirmVote('skip')}>
              Skip vote
            </button>
          )}
        </div>
      </section>

      <section className="panel chat-panel">
        <div className="chat-log" ref={logRef}>
          {chat.length === 0 && <p className="hint">No one has spoken yet.</p>}
          {chat.map((c) => (
            <p key={c.id} className={`chat-line ${c.ghost ? 'ghost' : ''}`}>
              <span className="swatch" style={{ background: COLORS[c.color]?.hex }} />
              <strong>{c.name}</strong>
              {c.ghost && <em> (ghost)</em>}: {c.text}
            </p>
          ))}
        </div>
        <form className="chat-form" onSubmit={send}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={CHAT_MAX_LENGTH}
            placeholder={alive ? 'Say something…' : 'Whisper to the other ghosts…'}
          />
          <button className="btn" type="submit" disabled={!draft.trim()}>
            Send
          </button>
        </form>
      </section>
    </main>
  );
}

/** Counts down from a server "ms remaining", restarting whenever `key` changes. */
function useCountdown(remainingMs: number, key: string): number {
  const [endAt, setEndAt] = useState(() => performance.now() + remainingMs);
  const [, force] = useState(0);
  useEffect(() => setEndAt(performance.now() + remainingMs), [key]);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, Math.ceil((endAt - performance.now()) / 1000));
}
