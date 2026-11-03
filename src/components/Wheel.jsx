import { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

// Koło nagród. Segmenty: [etykieta, waga, efekt]. Wynik losowany z wagami, koło kręci się do wylosowanego pola.
export const SEGMENTS = [
  { label: '+20 XP', w: 22, xp: 20 },
  { label: '+50 XP', w: 18, xp: 50 },
  { label: 'NAGRODA', w: 6, treat: true },
  { label: '+30 XP', w: 20, xp: 30 },
  { label: '+100 XP', w: 10, xp: 100 },
  { label: '+40 XP', w: 16, xp: 40 },
  { label: 'JACKPOT', w: 3, xp: 250 },
  { label: '+25 XP', w: 20, xp: 25 }
];
const COLORS = ['var(--pink)', 'var(--raised)', 'var(--gold)', 'var(--raised)', 'var(--pink)', 'var(--raised)', 'var(--mint)', 'var(--raised)'];
const INK = ['var(--on-pink)', 'var(--ink)', '#1a1205', 'var(--ink)', 'var(--on-pink)', 'var(--ink)', '#062a1d', 'var(--ink)'];

function pick() {
  const tot = SEGMENTS.reduce((t, s) => t + s.w, 0);
  let r = Math.random() * tot;
  for (let i = 0; i < SEGMENTS.length; i++) { r -= SEGMENTS[i].w; if (r <= 0) return i; }
  return 0;
}

export function Wheel({ disabled, onResult }) {
  const ctl = useAnimation(), [rot, setRot] = useState(0), [busy, setBusy] = useState(false);
  const n = SEGMENTS.length, seg = 360 / n, R = 100;
  const spin = async () => {
    if (busy || disabled) return;
    setBusy(true);
    const i = pick();
    const base = Math.ceil(rot / 360) * 360 + 360 * 6;
    const target = base - (i + 0.5) * seg + (Math.random() - 0.5) * seg * 0.6;
    await ctl.start({ rotate: target, transition: { duration: 4.2, ease: [0.12, 0.85, 0.18, 1] } });
    setRot(target); setBusy(false);
    onResult(SEGMENTS[i], i);
  };
  const arc = i => {
    const a0 = (i * seg - 90) * Math.PI / 180, a1 = ((i + 1) * seg - 90) * Math.PI / 180;
    return `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`;
  };
  return (
    <div className="stack" style={{ justifyItems: 'center' }}>
      <div className="wheel-wrap">
        <div className="wheel-ptr" />
        <motion.svg viewBox="-104 -104 208 208" animate={ctl} initial={{ rotate: 0 }}>
          <circle r="103" style={{ fill: 'var(--line2)' }} />
          {SEGMENTS.map((s, i) => (
            <g key={i}>
              <path d={arc(i)} style={{ fill: COLORS[i], stroke: 'var(--bg)' }} strokeWidth="1.5" />
              <text transform={`rotate(${(i + 0.5) * seg}) translate(0 -66) rotate(90)`} textAnchor="middle" dominantBaseline="middle"
                style={{ fill: INK[i], fontFamily: 'var(--display)', fontWeight: 800, fontSize: 11 }}>{s.label}</text>
            </g>
          ))}
          <circle r="18" style={{ fill: 'var(--bg)', stroke: 'var(--line2)' }} strokeWidth="3" />
        </motion.svg>
      </div>
      <button className="btn pri big" onClick={spin} disabled={busy || disabled}>{busy ? 'Kręci się…' : 'Zakręć kołem'}</button>
    </div>
  );
}
