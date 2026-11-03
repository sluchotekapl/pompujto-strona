import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useUI, Anim, Page } from '../components/ui.jsx';
import { ExerciseSheet } from '../components/exercise.jsx';
const PJ = () => window.PJ;
const GROUPS = { all: ['Wszystkie', null], nogi: ['Nogi', ['squat', 'lunge', 'hinge', 'legiso', 'calves']], klatka: ['Klatka', ['hpush', 'chestiso']], plecy: ['Plecy', ['vpull', 'hpull', 'traps']], barki: ['Barki', ['vpush', 'shoulderiso']], rece: ['Ręce', ['biceps', 'triceps']], core: ['Brzuch', ['core']], cardio: ['Cardio', ['cardio', 'full', 'plyo']], mob: ['Mobilność', ['mobility', 'stretch']] };

export default function Library() {
  const { data: p } = useApp();
  const { modal } = useUI();
  const [g, setG] = useState('all'), [q, setQ] = useState(() => { try { const v = sessionStorage.getItem('pj:exq') || ''; sessionStorage.removeItem('pj:exq'); return v; } catch (e) { return ''; } }), [mine, setMine] = useState(false);
  useEffect(() => { const f = () => { try { const v = sessionStorage.getItem('pj:exq'); if (v) { setQ(v); sessionStorage.removeItem('pj:exq'); } } catch (e) { } }; addEventListener('pj-exq', f); return () => removeEventListener('pj-exq', f); }, []);
  const rs = useMemo(() => PJ().restrictions(p), [p]);
  const ok = e => PJ().allowed(e, p, rs);
  const list = PJ().EX.filter(e => (!GROUPS[g][1] || GROUPS[g][1].includes(e.p)) && (!q || (e.n + ' ' + e.en + ' ' + e.m.join(' ')).toLowerCase().includes(q.toLowerCase())) && (!mine || ok(e)));
  return (
    <Page>
      <div className="spread"><div><p className="eyebrow">Baza ćwiczeń</p><h1>200 ćwiczeń</h1></div><span className="small muted">{list.length} widocznych · {PJ().EX.filter(ok).length} dozwolonych dla Ciebie</span></div>
      <div className="card stack">
        <div style={{ position: 'relative' }}><Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} /><input id="q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Szukaj: przysiad, plecy, hantle…" style={{ paddingLeft: 40 }} aria-label="Szukaj ćwiczenia" /></div>
        <div className="chips">{Object.entries(GROUPS).map(([k, [n]]) => <button key={k} className="chip" aria-pressed={g === k} onClick={() => setG(k)}>{n}</button>)}</div>
        <label className="check"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} />Tylko dozwolone dla mnie (sprzęt i zdrowie)</label>
      </div>
      <motion.div className="lib" layout>
        <AnimatePresence>{list.map(e => <motion.button layout key={e.id} className={'lc ' + (ok(e) ? '' : 'no')} initial={{ opacity: 0, scale: .95 }} animate={{ opacity: ok(e) ? 1 : .5, scale: 1 }} exit={{ opacity: 0, scale: .95 }} whileHover={{ y: -3 }} onClick={() => modal(c => <ExerciseSheet id={e.id} p={p} close={c} />)}>
          <Anim id={e.id} /><span className="b2"><b>{e.n}</b><span className="xs muted">{e.m.join(', ')} · {PJ().EQUIP[e.eq]}</span>{!ok(e) && <span className="tag red">{PJ().equipOk(e, p) ? 'niezalecane' : 'brak sprzętu'}</span>}</span></motion.button>)}</AnimatePresence>
      </motion.div>
      {!list.length && <div className="empty">Nic nie pasuje do wyszukiwania.</div>}
      <p className="xs muted">Zdjęcia i opisy: otwarta baza free-exercise-db (domena publiczna), tłumaczenie i dobór: pompujto.pl.</p>
    </Page>
  );
}
