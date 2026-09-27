import { useState } from 'react';
import type { TaskKind } from '../../shared/tasks';
import { TaskModal } from '../tasks/TaskModal';

const KINDS: { kind: TaskKind; label: string }[] = [
  { kind: 'cables', label: 'Reconnect cables' },
  { kind: 'calibrate', label: 'Calibrate sonar' },
  { kind: 'valve', label: 'Bleed a valve' },
  { kind: 'samples', label: 'Sort samples' },
  { kind: 'filter', label: 'Clear a filter' },
];

/** Offline sandbox for the mini-games: open with ?practice or ?practice=valve. */
export function Practice({ initial }: { initial: TaskKind | null }) {
  const [open, setOpen] = useState<TaskKind | null>(initial);
  const current = KINDS.find((k) => k.kind === open);
  return (
    <main className="screen">
      <header className="title">
        <p className="eyebrow">Training tank</p>
        <h1>PRACTICE</h1>
      </header>
      <section className="panel">
        {KINDS.map((k) => (
          <button key={k.kind} className="btn" onClick={() => setOpen(k.kind)}>
            {k.label}
          </button>
        ))}
        <a className="hint" href="/">
          ← Back to the station
        </a>
      </section>
      {current && <TaskModal kind={current.kind} label={current.label} onComplete={() => {}} onClose={() => setOpen(null)} />}
    </main>
  );
}
