import { Youtube, AlertTriangle } from 'lucide-react';
import { Anim } from './ui.jsx';
const PJ = () => window.PJ;

export function ExerciseSheet({ id, p, onPick, close }) {
  const ex = PJ().BY[id], why = PJ().whyBlocked(ex, PJ().restrictions(p)), eqOk = PJ().equipOk(ex, p);
  const yt = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  return (
    <>
      <Anim id={ex.id} />
      <div className="stack" style={{ gap: 6 }}>
        <p className="eyebrow">{PJ().PATTERN[ex.p]} · {PJ().EQUIP[ex.eq]} · {ex.lvl === 'beginner' ? 'początkujący' : 'średniozaaw.'}</p>
        <h2>{ex.n}</h2><p className="small muted">{ex.en}</p>
      </div>
      {why.length > 0 && <div className="banner bad"><AlertTriangle size={20} /><div><b>Niezalecane dla Ciebie</b>{why.join('; ')}</div></div>}
      {!eqOk && <div className="banner"><div><b>Brak sprzętu</b>W ankiecie nie zaznaczyłeś: {PJ().EQUIP[ex.eq]}.</div></div>}
      <div className="row"><span className="tag pink">Główne: {ex.m.join(', ')}</span>{ex.m2.length > 0 && <span className="tag">Pomocnicze: {ex.m2.join(', ')}</span>}</div>
      <div className="stack" style={{ gap: 8 }}><h3>Jak wykonać</h3><ol className="steps">{ex.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
      <div className="stack" style={{ gap: 8 }}><h3>Na co uważać</h3><ul className="steps">{ex.tips.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
      <div className="row">
        <a className="btn" target="_blank" rel="noopener" href={yt(ex.n + ' technika')}><Youtube size={18} />Film PL</a>
        <a className="btn" target="_blank" rel="noopener" href={yt(ex.en + ' exercise proper form')}><Youtube size={18} />Film EN</a>
      </div>
      {onPick && <button className="btn pri big" disabled={why.length > 0 || !eqOk} onClick={() => { close(); onPick(id); }}>Wybierz to ćwiczenie</button>}
    </>
  );
}

export function SwapSheet({ p, dayIndex, slotIndex, onPick, modal, close }) {
  const day = p.program.days[dayIndex], sl = day.slots[slotIndex], rs = PJ().restrictions(p);
  const others = new Set(day.slots.map(s => s.exId)); others.delete(sl.exId);
  const ok = PJ().ranked(sl.p, p, rs, others).filter(e => e.id !== sl.exId);
  const no = PJ().EX.filter(e => e.p === sl.p && e.id !== sl.exId && !ok.includes(e) && !others.has(e.id));
  const open = id => modal(c2 => <ExerciseSheet id={id} p={p} close={c2} onPick={x => { close(); onPick(x); }} />);
  const Card = ({ e, dis }) => (
    <button className={'lc ' + (dis ? 'no' : '')} onClick={() => open(e.id)}>
      <Anim id={e.id} /><span className="b2"><b>{e.n}</b><span className="xs muted">{PJ().EQUIP[e.eq]}</span>{dis && <span className="tag red">{PJ().equipOk(e, p) ? 'niezalecane' : 'brak sprzętu'}</span>}</span>
    </button>
  );
  return (
    <>
      <p className="eyebrow">{PJ().PATTERN[sl.p]}</p>
      <h2>Zamień: {PJ().BY[sl.exId].n}</h2>
      <p className="small muted">Ćwiczenia z tej samej grupy ruchu, dopasowane do Twojej ankiety. Zmiana zostaje w planie.</p>
      <div className="lib">{ok.map(e => <Card key={e.id} e={e} />)}</div>
      {no.length > 0 && <details><summary className="small muted">Niedostępne dla Ciebie ({no.length})</summary><div className="lib" style={{ marginTop: 10 }}>{no.map(e => <Card key={e.id} e={e} dis />)}</div></details>}
    </>
  );
}
