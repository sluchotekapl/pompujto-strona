import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Ruler, Trophy, Flame, CalendarCheck, Dumbbell, Plus } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useUI, Page, Stagger, Item, Count, comma, fmtDate, ymd } from '../components/ui.jsx';
import { LineChart } from './Rewards.jsx';
const PJ = () => window.PJ;

export const MEASURES = [['waist', 'Talia'], ['chest', 'Klatka'], ['hips', 'Biodra'], ['arm', 'Ramię'], ['thigh', 'Udo']];

// e1RM z najlepszej serii każdego treningu, osobno dla ćwiczeń
function strength(d) {
  const map = {};
  (d.history || []).forEach(s => (s.entries || []).forEach(e => {
    const top = Math.max(0, ...(e.sets || []).filter(x => x.done && +x.w > 0).map(x => PJ().e1rm(+x.w, +x.r)));
    if (!top) return;
    (map[e.exId] = map[e.exId] || []).push({ date: s.date, kg: Math.round(top * 10) / 10, w: Math.max(...e.sets.filter(x => x.done).map(x => +x.w || 0)) });
  }));
  return Object.entries(map).map(([exId, pts]) => ({ exId, pts, best: Math.max(...pts.map(p => p.kg)), n: pts.length })).sort((a, b) => b.n - a.n);
}

function Heatmap({ d }) {
  const days = useMemo(() => {
    const set = {}; (d.history || []).forEach(s => { set[ymd(s.date)] = (set[ymd(s.date)] || 0) + 1; });
    const out = [], end = new Date(); end.setHours(0, 0, 0, 0);
    const start = new Date(end); start.setDate(end.getDate() - 7 * 16 + 1); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    for (let t = new Date(start); t <= end; t.setDate(t.getDate() + 1)) out.push({ k: ymd(t), n: set[ymd(t)] || 0, plan: (d.trainDays || []).includes(t.getDay()) });
    return out;
  }, [d.history && d.history.length]);
  return (
    <div className="heat" role="img" aria-label="Kalendarz treningów z ostatnich 16 tygodni">
      {days.map((x, i) => <motion.i key={x.k} title={x.k + (x.n ? ' – trening' : '')} className={x.n ? 'on' : x.plan ? 'plan' : ''} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * .003 }} />)}
    </div>
  );
}

export function ProgressBody({ d, onAddMeasure }) {
  const { toast } = useUI();
  const lifts = useMemo(() => strength(d), [d.history && d.history.length]);
  const [ex, setEx] = useState(null);
  const [m, setM] = useState({});
  const cur = lifts.find(l => l.exId === ex) || lifts[0];
  const hist = d.history || [];
  const prs = hist.flatMap(s => (s.prs || []).map(id => ({ id, date: s.date }))).reverse();
  const month = hist.filter(s => new Date(s.date) > new Date(Date.now() - 30 * 864e5)).length;
  const streak = PJ().weekStreak(d, hist);
  const meas = d.measures || [];
  const first = meas[0], last = meas[meas.length - 1];
  const save = () => {
    const row = { date: new Date().toISOString() }; let any = false;
    MEASURES.forEach(([k]) => { const v = parseFloat(String(m[k] || '').replace(',', '.')); if (v > 10 && v < 250) { row[k] = v; any = true; } });
    if (!any) return toast('Wpisz co najmniej jeden wymiar w cm');
    onAddMeasure(row); setM({}); toast('Zapisano wymiary');
  };
  return (
    <>
      <Stagger className="tiles">
        {[['Treningi', hist.length, '', 'łącznie'], ['30 dni', month, '', 'treningów'], ['Seria', streak, ' tyg.', 'z rzędu'], ['Rekordy', prs.length, '', 'pobite'], ['Waga', d.weight, ' kg', d.weights && d.weights.length > 1 ? `${(d.weight - d.weights[0].kg) > 0 ? '+' : ''}${comma(Math.round((d.weight - d.weights[0].kg) * 10) / 10)} kg od startu` : 'aktualna']].map(([n, v, u, s]) =>
          <Item key={n} className="tile"><span className="eyebrow">{n}</span><span className="v"><Count to={+v || 0} dec={v % 1 ? 1 : 0} /><small>{u}</small></span><span className="xs muted">{s}</span></Item>)}
      </Stagger>
      <div className="card stack"><div className="spread"><h3><CalendarCheck size={18} style={{ verticalAlign: '-3px' }} /> Regularność – 16 tygodni</h3><span className="xs muted row" style={{ gap: 10 }}><span><i className="heat-key on" />trening</span><span><i className="heat-key plan" />dzień z planu</span></span></div><Heatmap d={d} /></div>
      <div className="cols">
        <div className="stack">
          <div className="card stack"><h3><Dumbbell size={18} style={{ verticalAlign: '-3px' }} /> Siła w ćwiczeniach</h3>
            {cur ? <>
              <select id="pr-ex" value={cur.exId} onChange={e => setEx(e.target.value)} aria-label="Ćwiczenie">{lifts.map(l => <option key={l.exId} value={l.exId}>{PJ().BY[l.exId] ? PJ().BY[l.exId].n : l.exId} ({l.n})</option>)}</select>
              <LineChart pts={cur.pts} label="Szacowany ciężar maksymalny" />
              <p className="xs muted">Najlepszy wynik: <b className="num">{comma(cur.best)} kg</b> (szacowany ciężar na 1 powtórzenie, wzór Epleya).</p>
            </> : <p className="small muted">Wykres pojawi się po pierwszych treningach z ciężarem.</p>}</div>
          <div className="card stack"><h3><Trophy size={18} style={{ verticalAlign: '-3px' }} /> Rekordy</h3>
            {prs.length ? <div className="stack" style={{ gap: 6 }}>{prs.slice(0, 8).map((r, i) => <div key={i} className="spread small"><span>{PJ().BY[r.id] ? PJ().BY[r.id].n : r.id}</span><span className="tag gold">{fmtDate(r.date)}</span></div>)}</div> : <p className="small muted">Pierwszy rekord padnie, gdy przebijesz swój najlepszy wynik w ćwiczeniu.</p>}</div>
        </div>
        <div className="stack">
          <div className="card stack"><h3><Flame size={18} style={{ verticalAlign: '-3px' }} /> Masa ciała</h3><LineChart pts={d.weights || []} /></div>
          <div className="card stack"><h3><Ruler size={18} style={{ verticalAlign: '-3px' }} /> Wymiary (cm)</h3>
            {meas.length > 0 && <div className="tablewrap"><table className="table"><thead><tr><th></th>{MEASURES.map(([k, n]) => <th key={k}>{n}</th>)}</tr></thead><tbody>
              {meas.slice(-4).reverse().map(r => <tr key={r.date}><td className="xs">{fmtDate(r.date)}</td>{MEASURES.map(([k]) => <td key={k} className="num">{r[k] ? comma(r[k]) : '—'}</td>)}</tr>)}
              {meas.length > 1 && <tr><td className="xs"><b>Zmiana</b></td>{MEASURES.map(([k]) => { const a = (meas.find(r => r[k]) || {})[k], b = [...meas].reverse().find(r => r[k]); const dv = a && b ? Math.round((b[k] - a) * 10) / 10 : null; return <td key={k}>{dv == null ? '—' : <span className={'tag ' + (dv < 0 ? 'mint' : dv > 0 ? 'gold' : '')}>{dv > 0 ? '+' : ''}{comma(dv)}</span>}</td>; })}</tr>}
            </tbody></table></div>}
            {onAddMeasure ? <>
              <div className="fields">{MEASURES.map(([k, n]) => <label key={k} className="f">{n}<input id={'ms-' + k} type="number" inputMode="decimal" step="0.5" value={m[k] || ''} placeholder={last && last[k] ? String(last[k]) : 'cm'} onChange={e => setM({ ...m, [k]: e.target.value })} /></label>)}</div>
              <button className="btn" onClick={save}><Plus size={16} />Zapisz wymiary</button>
              <p className="xs muted">Mierz rano, na czczo, w tych samych miejscach – raz na 2 tygodnie wystarczy.</p></>
              : !meas.length && <p className="small muted">Brak pomiarów.</p>}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Progress() {
  const { data, update } = useApp();
  return (
    <Page>
      <div><p className="eyebrow">Twoja droga</p><h1>Postępy</h1></div>
      <ProgressBody d={data} onAddMeasure={row => update(x => { x.measures = (x.measures || []).concat(row); })} />
    </Page>
  );
}
