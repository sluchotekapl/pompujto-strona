import { motion, useAnimation, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useState } from 'react';

// Pompka pompuje hantel: dwa ruchy tłoka, hantel „rośnie” z każdym, na koniec błysk.
export function LogoMark({ size = 44, play = 0 }) {
  const handle = useAnimation(), bell = useAnimation(), spark = useAnimation(), air = useAnimation();
  const reduce = useReducedMotion();
  const gid = 'pjg' + useId().replace(/[^a-zA-Z0-9]/g, '');
  useEffect(() => {
    let off = false;
    (async () => {
      if (reduce) return;
      const stroke = async scale => {
        air.start({ pathLength: [0, 1], opacity: [1, 0], transition: { duration: .35 } });
        await Promise.all([handle.start({ y: 8, transition: { duration: .22, ease: 'easeIn' } }), bell.start({ scale, transition: { type: 'spring', stiffness: 420, damping: 9 } })]);
        if (off) return;
        await handle.start({ y: 0, transition: { duration: .2, ease: 'easeOut' } });
      };
      await stroke(1.1); if (off) return;
      await stroke(1.22); if (off) return;
      spark.start({ opacity: [0, 1, 0], scale: [.4, 1.15, 1], transition: { duration: .6 } });
      await bell.start({ scale: 1, transition: { type: 'spring', stiffness: 260, damping: 12 } });
    })();
    return () => { off = true; };
  }, [play]);
  const ink = { fill: 'var(--ink)' };
  return (
    <svg width={size} height={size * 48 / 72} viewBox="0 0 72 48" aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--brand2)' }} /><stop offset="1" style={{ stopColor: 'var(--brand)' }} /></linearGradient>
      </defs>
      {/* wąż */}
      <path d="M15.5 39 C 24 47, 30 42, 33.5 33" fill="none" style={{ stroke: 'var(--mint)' }} strokeWidth="2" strokeLinecap="round" />
      <motion.path d="M17 40 C 24 46, 29 42, 32 35" fill="none" style={{ stroke: '#fff' }} strokeWidth="1" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0 }} animate={air} />
      {/* pompka */}
      <motion.g animate={handle} initial={{ y: 0 }}>
        <rect x="11" y="7" width="2" height="14" rx="1" style={{ fill: 'var(--muted)' }} />
        <rect x="3.5" y="3.5" width="17" height="4.5" rx="2.25" fill={`url(#${gid})`} />
      </motion.g>
      <rect x="7.5" y="19" width="9" height="24" rx="2.5" style={ink} />
      <rect x="9.5" y="24" width="5" height="1.6" rx=".8" style={{ fill: 'var(--bg)' }} opacity=".7" />
      <rect x="9.5" y="28" width="5" height="1.6" rx=".8" style={{ fill: 'var(--bg)' }} opacity=".7" />
      <rect x="2.5" y="42" width="19" height="3.5" rx="1.75" style={ink} />
      {/* hantel */}
      <motion.g animate={bell} initial={{ scale: 1 }} style={{ originX: 0.5, originY: 0.5 }}>
        <rect x="33" y="24.5" width="37" height="3" rx="1.5" style={ink} />
        <rect x="33.5" y="18.5" width="5" height="15" rx="2" fill={`url(#${gid})`} />
        <rect x="38.5" y="14.5" width="6" height="23" rx="2.5" fill={`url(#${gid})`} />
        <rect x="59.5" y="14.5" width="6" height="23" rx="2.5" fill={`url(#${gid})`} />
        <rect x="65.5" y="18.5" width="5" height="15" rx="2" fill={`url(#${gid})`} />
        <rect x="40" y="16.5" width="1.6" height="9" rx=".8" fill="#fff" opacity=".45" />
        <rect x="61" y="16.5" width="1.6" height="9" rx=".8" fill="#fff" opacity=".45" />
      </motion.g>
      {/* błysk */}
      <motion.g animate={spark} initial={{ opacity: 0 }} style={{ originX: 0.5, originY: 0.5 }}>
        <path d="M52 6v5M52 2.5v.01M45 8.5l2.5 3M59 8.5l-2.5 3" style={{ stroke: 'var(--gold)' }} strokeWidth="2" strokeLinecap="round" fill="none" />
      </motion.g>
    </svg>
  );
}

export function Brand({ size = 44 }) {
  const [n, setN] = useState(0);
  return (
    <a className="brand" href="#dzis" onMouseEnter={() => setN(n + 1)} onClick={() => setN(n + 1)}>
      <LogoMark play={n} size={size} />
      <span className="wm">pompujto<i>.pl</i></span>
    </a>
  );
}
