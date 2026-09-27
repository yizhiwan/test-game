import { useCallback, useRef, useState } from 'react';
import { TASK_MIN_MS, type TaskKind } from '../../shared/tasks';
import { Calibrate, Cables, Filter, Samples, Valve, type GameProps } from './minigames';

const GAMES: Record<TaskKind, (p: GameProps) => React.JSX.Element> = {
  cables: Cables,
  calibrate: Calibrate,
  valve: Valve,
  samples: Samples,
  filter: Filter,
};

interface Props {
  kind: TaskKind;
  label: string;
  onComplete: () => void;
  onClose: () => void;
}

export function TaskModal({ kind, label, onComplete, onClose }: Props) {
  const [done, setDone] = useState(false);
  const Game = GAMES[kind];

  const openedAt = useRef(performance.now());

  const finish = useCallback(() => {
    setDone(true);
    // The server rejects impossibly fast completions; a quick player just
    // waits out the remainder here instead of being silently refused.
    const wait = Math.max(0, TASK_MIN_MS[kind] + 150 - (performance.now() - openedAt.current));
    setTimeout(() => {
      onComplete();
      setTimeout(onClose, 600);
    }, wait);
  }, [kind, onComplete, onClose]);

  return (
    <div className="task-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <section className={`panel task-panel ${done ? 'complete' : ''}`}>
        <header className="task-head">
          <h3>{label}</h3>
          <button className="btn small ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {done ? <p className="task-done">✓ Task complete</p> : <Game onDone={finish} />}
      </section>
    </div>
  );
}
