import { Component, createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion, animate, useInView } from 'framer-motion';
import { X } from 'lucide-react';

export const esc = s => s;
export const ymd = d => { d = new Date(d); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const fmtDate = d => new Date(d).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
export const pl = (n, a, b, c) => n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? b : c;
export const comma = v => String(v).replace('.', ',');

/* ---------- modale i toasty ---------- */
const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

export function UIProvider({ children }) {
  const [modals, setModals] = useState([]);
  const [toasts, setToasts] = useState([]);
  const modal = useCallback((render, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    const close = () => setModals(m => m.filter(x => x.id !== id));
    setModals(m => [...m, { id, render, close, wide: opts.wide }]);
    return close;
  }, []);
  const toast = useCallback(msg => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800);
  }, []);
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') setModals(m => m.slice(0, -1)); };
    const h = () => setModals([]); addEventListener('keydown', k); addEventListener('hashchange', h); return () => { removeEventListener('keydown', k); removeEventListener('hashchange', h); };
  }, []);
  return (
    <UICtx.Provider value={{ modal, toast, modals }}>
      {children}
      <div className="toasts" aria-live="polite">
        <AnimatePresence>{toasts.map(t => <motion.div key={t.id} className="toast" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}>{t.msg}</motion.div>)}</AnimatePresence>
      </div>
    </UICtx.Provider>
  );
}
// Warstwa okien – renderowana wewnątrz kontekstu aplikacji, żeby okna miały dostęp do danych.
export function ModalLayer() {
  const { modals } = useUI();
  return (
    <AnimatePresence>
      {modals.map(m => (
        <motion.div key={m.id} className="ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => { if (e.target === e.currentTarget) m.close(); }}>
          <motion.div className="sheet" role="dialog" aria-modal="true" style={m.wide ? { maxWidth: 860 } : null}
            initial={{ y: 60, opacity: 0, scale: .98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }}>
            <div className="grab" />
            <button className="iconbtn x" onClick={m.close} aria-label="Zamknij"><X size={18} /></button>
            <ModalBody render={m.render} close={m.close} />
          </motion.div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
function ModalBody({ render, close }) { return render(close); }

/* ---------- drobne komponenty ---------- */
export function Anim({ id, className = '' }) {
  return <div className={'anim ' + className} aria-hidden="true"><img src={`img/${id}_0.webp`} alt="" loading="lazy" /><img className="b" src={`img/${id}_1.webp`} alt="" loading="lazy" /></div>;
}
export function Bar({ value, max = 1, tone = '' }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return <div className={'prog ' + tone}><motion.i initial={{ width: 0 }} animate={{ width: pct + '%' }} transition={{ duration: .8, ease: [.2, .8, .2, 1] }} /></div>;
}
export function Count({ to, dec = 0, suffix = '' }) {
  const ref = useRef(null), inView = useInView(ref, { once: true }), [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: .9, ease: [.2, .8, .2, 1], onUpdate: x => setV(x) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref} className="num">{v.toFixed(dec).replace('.', ',')}{suffix}</span>;
}
export function Ring({ value, max, size = 92, stroke = 9, color = 'var(--pink)', children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, value / (max || 1)));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'var(--line)' }} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: color }} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - f) }} transition={{ duration: 1, ease: [.2, .8, .2, 1] }} />
      </svg>
      <div className="c">{children}</div>
    </div>
  );
}
export function Seg({ value, onChange, options, id }) {
  return (
    <div className="seg" role="tablist">
      {options.map(([k, n]) => (
        <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)} role="tab" aria-selected={value === k}>
          {value === k && <motion.i layoutId={'seg-' + id} className="pill" transition={{ type: 'spring', damping: 30, stiffness: 400 }} />}
          <span>{n}</span>
        </button>
      ))}
    </div>
  );
}
export const Stagger = ({ children, className = 'stack', delay = 0 }) => (
  <motion.div className={className} initial="h" animate="s" variants={{ h: {}, s: { transition: { staggerChildren: .05, delayChildren: delay } } }}>{children}</motion.div>
);
export const Item = ({ children, className, as = 'div', ...rest }) => {
  const C = motion[as];
  return <C className={className} variants={{ h: { opacity: 0, y: 14 }, s: { opacity: 1, y: 0, transition: { type: 'spring', damping: 26, stiffness: 260 } } }} {...rest}>{children}</C>;
};
export function Page({ children }) {
  return <motion.div className="wrap" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .28, ease: [.2, .8, .2, 1] }}>{children}</motion.div>;
}

export class Boundary extends Component {
  constructor(p) { super(p); this.state = { e: null }; }
  static getDerivedStateFromError(e) { return { e }; }
  render() {
    if (!this.state.e) return this.props.children;
    return <div className="wrap"><div className="card stack"><h2>Ups, coś poszło nie tak</h2><p className="small muted">{String(this.state.e.message || this.state.e)}</p><div className="row"><button className="btn pri" onClick={() => this.setState({ e: null })}>Spróbuj ponownie</button><a className="btn" href="#dzis" onClick={() => this.setState({ e: null })}>Wróć do Dziś</a></div></div></div>;
  }
}
