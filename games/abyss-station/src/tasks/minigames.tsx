import { useEffect, useMemo, useRef, useState } from 'react';

export interface GameProps {
  onDone: () => void;
}

const shuffle = <T,>(a: T[]): T[] => [...a].sort(() => Math.random() - 0.5);

// ---- Cables: tap a plug on the left, then its matching socket on the right.

const CABLE_COLORS = ['#ff6b6b', '#ffd43b', '#4dabf7', '#b04fd0'];

export function Cables({ onDone }: GameProps) {
  const right = useMemo(() => shuffle([0, 1, 2, 3]), []);
  const left = useMemo(() => shuffle([0, 1, 2, 3]), []);
  const [picked, setPicked] = useState<number | null>(null);
  const [linked, setLinked] = useState<number[]>([]);
  const [miss, setMiss] = useState(false);

  useEffect(() => {
    if (linked.length === 4) onDone();
  }, [linked.length, onDone]);

  const pickRight = (color: number) => {
    if (picked === null || linked.includes(color)) return;
    if (picked === color) setLinked((l) => [...l, color]);
    else {
      setMiss(true);
      setTimeout(() => setMiss(false), 300);
    }
    setPicked(null);
  };

  const y = (i: number) => 30 + i * 60;
  return (
    <div className={`mg cables ${miss ? 'shake' : ''}`}>
      <svg viewBox="0 0 300 240" className="mg-svg">
        {linked.map((c) => (
          <line key={c} x1={40} y1={y(left.indexOf(c))} x2={260} y2={y(right.indexOf(c))} stroke={CABLE_COLORS[c]} strokeWidth={10} strokeLinecap="round" />
        ))}
        {left.map((c, i) => (
          <g key={`l${c}`} onClick={() => !linked.includes(c) && setPicked(c)} className="plug">
            <rect x={4} y={y(i) - 16} width={40} height={32} rx={6} fill={CABLE_COLORS[c]} stroke={picked === c ? '#fff' : '#0008'} strokeWidth={picked === c ? 4 : 2} />
          </g>
        ))}
        {right.map((c, i) => (
          <g key={`r${c}`} onClick={() => pickRight(c)} className="plug">
            <rect x={256} y={y(i) - 16} width={40} height={32} rx={6} fill="#10232e" stroke={CABLE_COLORS[c]} strokeWidth={4} />
            <circle cx={276} cy={y(i)} r={6} fill={CABLE_COLORS[c]} />
          </g>
        ))}
      </svg>
      <p className="mg-hint">Tap a cable, then the socket of the same colour.</p>
    </div>
  );
}

// ---- Calibrate: stop the sweeping needle inside the green band, three times.

export function Calibrate({ onDone }: GameProps) {
  const [hits, setHits] = useState(0);
  const [zone, setZone] = useState(() => 20 + Math.random() * 60);
  const [miss, setMiss] = useState(false);
  const needle = useRef(0);
  const [, force] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const speed = 0.0016 + hits * 0.0006;
      needle.current = 50 + Math.sin((now - start) * speed) * 50;
      force((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hits]);

  useEffect(() => {
    if (hits === 3) onDone();
  }, [hits, onDone]);

  const lock = () => {
    if (hits >= 3) return;
    if (Math.abs(needle.current - zone) <= 9) {
      setHits((h) => h + 1);
      setZone(15 + Math.random() * 70);
    } else {
      setMiss(true);
      setTimeout(() => setMiss(false), 300);
    }
  };

  return (
    <div className={`mg calibrate ${miss ? 'shake' : ''}`}>
      <div className="dial">
        <div className="zone" style={{ left: `${zone - 9}%`, width: '18%' }} />
        <div className="needle" style={{ left: `${needle.current}%` }} />
      </div>
      <div className="pips">
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < hits ? 'on' : ''} />
        ))}
      </div>
      <button className="btn primary" onClick={lock}>
        Lock signal
      </button>
    </div>
  );
}

// ---- Valve: hold to crank the pressure down; letting go bleeds progress.

export function Valve({ onDone }: GameProps) {
  const [level, setLevel] = useState(0);
  const holding = useRef(false);
  const done = useRef(false);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setLevel((l) => {
        const next = Math.min(100, Math.max(0, l + (holding.current ? 34 : -50) * dt));
        if (next >= 100 && !done.current) {
          done.current = true;
          setTimeout(onDone, 0);
        }
        return next;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  const set = (v: boolean) => () => {
    holding.current = v;
  };

  return (
    <div className="mg valve">
      <div className="gauge">
        <div className="fill" style={{ height: `${level}%` }} />
        <span>{Math.round(level)}%</span>
      </div>
      <button
        className="btn primary valve-wheel"
        style={{ transform: `rotate(${level * 7.2}deg)` }}
        onPointerDown={set(true)}
        onPointerUp={set(false)}
        onPointerLeave={set(false)}
        onPointerCancel={set(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        ⎈
      </button>
      <p className="mg-hint">Hold the wheel until the gauge is full.</p>
    </div>
  );
}

// ---- Samples: tap the vials in order, 1 to 6. A wrong tap starts over.

export function Samples({ onDone }: GameProps) {
  const order = useMemo(() => shuffle([1, 2, 3, 4, 5, 6]), []);
  const [next, setNext] = useState(1);
  const [miss, setMiss] = useState(false);

  useEffect(() => {
    if (next === 7) onDone();
  }, [next, onDone]);

  const tap = (n: number) => {
    if (n === next) setNext(n + 1);
    else if (n >= next) {
      setNext(1);
      setMiss(true);
      setTimeout(() => setMiss(false), 300);
    }
  };

  return (
    <div className={`mg samples ${miss ? 'shake' : ''}`}>
      <div className="vials">
        {order.map((n) => (
          <button key={n} className={`vial ${n < next ? 'done' : ''}`} onClick={() => tap(n)}>
            {n}
          </button>
        ))}
      </div>
      <p className="mg-hint">Tap the samples in order, 1 → 6.</p>
    </div>
  );
}

// ---- Filter: pick the drifting debris out of the intake.

export function Filter({ onDone }: GameProps) {
  const debris = useMemo(
    () => Array.from({ length: 7 }, (_, i) => ({ id: i, x: 8 + Math.random() * 78, y: 8 + Math.random() * 74, r: Math.random() * 360 })),
    [],
  );
  const [cleared, setCleared] = useState<number[]>([]);
  const [t, setT] = useState(0);

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      setT(now / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (cleared.length === debris.length) onDone();
  }, [cleared.length, debris.length, onDone]);

  return (
    <div className="mg filter">
      <div className="mesh">
        {debris
          .filter((d) => !cleared.includes(d.id))
          .map((d) => (
            <button
              key={d.id}
              className="debris"
              style={{
                left: `${d.x + Math.sin(t + d.id) * 3}%`,
                top: `${d.y + Math.cos(t * 0.8 + d.id) * 3}%`,
                transform: `rotate(${d.r + t * 20}deg)`,
              }}
              onClick={() => setCleared((c) => [...c, d.id])}
              aria-label="debris"
            />
          ))}
      </div>
      <p className="mg-hint">Tap every clump of silt to clear the filter.</p>
    </div>
  );
}
