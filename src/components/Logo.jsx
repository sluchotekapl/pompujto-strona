import { motion, useAnimation, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useState } from 'react';

// Strzykawka wbija się w pośladek: igła wjeżdża, tłok dociska, pośladek „pompuje się”.
export function LogoMark({ size = 44, play = 0 }) {
  const syr = useAnimation(), rod = useAnimation(), liq = useAnimation(), butt = useAnimation();
  const reduce = useReducedMotion();
  const gid = 'pjb' + useId().replace(/[^a-zA-Z0-9]/g, '');
  useEffect(() => {
    let off = false;
    (async () => {
      if (reduce) { syr.set({ x: 0 }); rod.set({ x: 9 }); liq.set({ scaleX: 0.2 }); return; }
      syr.set({ x: -9 }); rod.set({ x: 0 }); liq.set({ scaleX: 1 }); butt.set({ scale: 1 });
      await syr.start({ x: 0, transition: { duration: 0.35, ease: [0.5, 0, 0.75, 0] } });
      if (off) return;
      butt.start({ scale: [1, 0.96, 1], transition: { duration: 0.25 } });
      await Promise.all([rod.start({ x: 9, transition: { duration: 0.6, ease: 'easeInOut' } }), liq.start({ scaleX: 0.2, transition: { duration: 0.6, ease: 'easeInOut' } })]);
      if (off) return;
      await butt.start({ scale: [1, 1.1, 1.04], transition: { duration: 0.45, ease: 'easeOut' } });
    })();
    return () => { off = true; };
  }, [play]);
  return (
    <svg width={size} height={size * 48 / 72} viewBox="0 0 72 48" aria-hidden="true">
      <defs>
        <radialGradient id={gid} cx="35%" cy="30%" r="80%"><stop offset="0" style={{ stopColor: 'var(--brand2)' }} /><stop offset="1" style={{ stopColor: 'var(--brand)' }} /></radialGradient>
      </defs>
      <g transform="translate(39 22) rotate(30)">
        <motion.g animate={syr} initial={{ x: -9 }}>
          <rect x="-8.5" y="-0.6" width="8.5" height="1.2" rx=".6" style={{ fill: 'var(--muted)' }} />
          <rect x="-24" y="-4" width="16" height="8" rx="1.6" style={{ fill: 'var(--ink)' }} opacity=".92" />
          <motion.rect x="-22.5" y="-2.6" width="13" height="5.2" rx="1" style={{ originX: 1, fill: 'var(--mint)' }} animate={liq} initial={{ scaleX: 1 }} />
          <path d="M-20 -4v2M-16.5 -4v2M-13 -4v2" style={{ stroke: 'var(--bg)' }} strokeWidth=".8" />
          <rect x="-25.2" y="-5.6" width="1.6" height="11.2" rx=".8" style={{ fill: 'var(--ink)' }} />
          <motion.g animate={rod} initial={{ x: 0 }}>
            <rect x="-33" y="-1" width="9.5" height="2" style={{ fill: 'var(--ink)' }} />
            <rect x="-34" y="-4.4" width="1.8" height="8.8" rx=".9" style={{ fill: 'var(--ink)' }} />
          </motion.g>
        </motion.g>
      </g>
      <motion.g animate={butt} initial={{ scale: 1 }} style={{ originX: 0.5, originY: 0.5 }}>
        <ellipse cx="44" cy="31" rx="12" ry="13" fill={`url(#${gid})`} />
        <ellipse cx="58" cy="31" rx="12" ry="13" fill={`url(#${gid})`} />
        <path d="M51 21.5c-1.5 5-1.6 13.5.2 20.5" style={{ stroke: 'color-mix(in srgb, var(--brand) 55%, #000)' }} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <ellipse cx="40" cy="25" rx="3.6" ry="2.2" fill="#fff" opacity=".35" transform="rotate(-30 40 25)" />
        <ellipse cx="62" cy="25" rx="3.2" ry="2" fill="#fff" opacity=".25" transform="rotate(25 62 25)" />
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
