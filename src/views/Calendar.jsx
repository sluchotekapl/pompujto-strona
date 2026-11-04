import { useEffect, useState } from 'react';
import { CalendarPlus, Eye, EyeOff, Trash2, CalendarClock, Check, Lock, AlertTriangle } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useUI, fmtDate } from '../components/ui.jsx';
import { api, todayIn, workoutVisible } from '../lib/backend.js';
const PJ = () => window.PJ;

// Treść treningu zapisywana w kalendarzu: kopia dnia planu (ćwiczenia + zalecenia). Edycja planu nie zmienia zaplanowanych treningów.
export const dayContent = (prog, di) => { const d = prog.days[di]; return { tid: prog.tid || 'coach', planName: prog.name, day: structuredClone(d) }; };
const label = w => {
  const today = todayIn(w.tz);
  if (w.status === 'cancelled') return ['Odwołany', 'red'];
  if (w.status === 'draft') return ['Szkic – niewidoczny', ''];
  if (w.scheduled_date > today || (w.available_at && new Date(w.available_at) > new Date())) return ['Ukryty do dnia treningu', 'sky'];
  return ['Dostępny dla podopiecznego', 'mint'];
};

function PlanWorkoutSheet({ c, w, close, onSaved }) {
  const { toast } = useUI();
  const ctx = useApp();
  const prog = c.data.program, lib = ctx.data.coachPlans || [];
  const sources = [...(prog ? prog.days.map((d, i) => ({ k: 'c' + i, n: `${d.name} – plan podopiecznego`, get: () => dayContent(prog, i) })) : []),
    ...lib.flatMap(pl => pl.days.map((d, i) => ({ k: pl.id + i, n: `${d.name} – ${pl.name}`, get: () => dayContent(pl, i) })))];
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(Date.now() + 864e5);
  const [f, setF] = useState(() => w ? { src: '', date: w.scheduled_date, title: w.title, status: w.status, hour: w.available_at ? new Date(w.available_at).toTimeString().slice(0, 5) : '' } : { src: sources[0] ? sources[0].k : '', date: tomorrow, title: '', status: 'published', hour: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const src = sources.find(s => s.k === f.src);
    if (!w && !src) return toast('Najpierw ułóż plan podopiecznemu albo dodaj plan do biblioteki');
    if (!f.date) return toast('Wybierz dzień');
    const content = src ? src.get() : w.content;
    let available_at = null;
    if (f.hour) { const t = new Date(`${f.date}T${f.hour}:00`); if (!isNaN(t)) available_at = t.toISOString(); }
    setBusy(true);
    try { await api.saveWorkout({ id: w && w.id, client_id: c.id, scheduled_date: f.date, available_at, status: f.status, title: (f.title || content.day.name).slice(0, 120), content }); toast(w ? 'Zapisano zmiany' : 'Trening zaplanowany'); close(); onSaved(); }
    catch (e) { toast(e.message); }
    setBusy(false);
  };
  return (
    <div className="stack">
      <h2>{w ? 'Edytuj trening' : 'Zaplanuj trening'} · {c.name.split(' ')[0]}</h2>
      {!w && <label className="f">Trening<select id="pw-src" value={f.src} onChange={e => setF({ ...f, src: e.target.value })}>{sources.map(s => <option key={s.k} value={s.k}>{s.n}</option>)}</select></label>}
      {w && <label className="f">Zamień treść na (opcjonalnie)<select id="pw-src" value={f.src} onChange={e => setF({ ...f, src: e.target.value })}><option value="">— bez zmian —</option>{sources.map(s => <option key={s.k} value={s.k}>{s.n}</option>)}</select></label>}
      <div className="fields">
        <label className="f">Dzień treningu<input id="pw-date" type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></label>
        <label className="f">Widoczny od godziny (opcjonalnie)<input id="pw-hour" type="time" value={f.hour} onChange={e => setF({ ...f, hour: e.target.value })} /></label>
        <label className="f">Nazwa (opcjonalnie)<input id="pw-title" type="text" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="np. Nogi – tydzień 3" /></label>
      </div>
      <div className="choices">
        <button type="button" className="choice" aria-pressed={f.status === 'published'} onClick={() => setF({ ...f, status: 'published' })}><b>Opublikuj</b><span className="xs muted">Odsłoni się sam dopiero w dniu treningu</span></button>
        <button type="button" className="choice" aria-pressed={f.status === 'draft'} onClick={() => setF({ ...f, status: 'draft' })}><b>Szkic</b><span className="xs muted">Nikt poza Tobą go nie widzi</span></button>
      </div>
      <div className="banner info"><Lock size={18} /><div className="small">Podopieczny nie pobierze treści przyszłego treningu – blokadę egzekwuje baza danych, nie tylko aplikacja. Dzień liczymy w strefie Europe/Warsaw.</div></div>
      <button className="btn pri big" disabled={busy} onClick={save}><Check size={18} />{busy ? 'Zapisuję…' : 'Zapisz'}</button>
    </div>
  );
}

export function ClientCalendar({ c }) {
  const { modal, toast } = useUI();
  const [list, setList] = useState(null), [logs, setLogs] = useState([]), [err, setErr] = useState('');
  const load = () => { setErr(''); Promise.all([api.listWorkouts(c.id), api.listLogs(c.id).catch(() => [])]).then(([w, l]) => { setList(w); setLogs(l); }, e => { setErr(e.message); setList([]); }); };
  useEffect(load, [c.id]);
  if (c.offline) return <div className="card empty"><b>Kalendarz działa dla osób z kontem</b><span className="small">Osobie bez konta wyślij plan albo PDF.</span></div>;
  const done = id => logs.some(l => l.workout_id === id && l.finished_at);
  const today = todayIn('Europe/Warsaw');
  const set = async (w, patch, msg) => { try { await api.saveWorkout({ ...w, ...patch }); toast(msg); load(); } catch (e) { toast(e.message); } };
  const del = w => modal(cl => <div className="stack"><h2>Usunąć „{w.title}”?</h2><p className="small">Zapisane wykonanie (jeśli było) zostaje w historii.</p><div className="row"><button className="btn danger" onClick={async () => { cl(); try { await api.deleteWorkout(w.id); toast('Usunięto'); load(); } catch (e) { toast(e.message); } }}>Usuń</button><button className="btn" onClick={cl}>Anuluj</button></div></div>);
  const upcoming = (list || []).filter(w => w.scheduled_date >= today).sort((a, b) => a.scheduled_date < b.scheduled_date ? -1 : 1);
  const past = (list || []).filter(w => w.scheduled_date < today);
  const Row = ({ w }) => { const [t, tone] = label(w); return (
    <div className="calrow">
      <div className="caldate"><b>{new Date(w.scheduled_date + 'T12:00').toLocaleDateString('pl-PL', { day: 'numeric' })}</b><span>{new Date(w.scheduled_date + 'T12:00').toLocaleDateString('pl-PL', { month: 'short', weekday: 'short' })}</span></div>
      <div style={{ minWidth: 0, flex: 1 }}><b>{w.title}</b><div className="xs muted">{(w.content.day && w.content.day.slots || []).map(s => PJ().BY[s.exId] ? PJ().BY[s.exId].n : '').filter(Boolean).slice(0, 4).join(' · ')}{w.available_at ? ' · od ' + new Date(w.available_at).toTimeString().slice(0, 5) : ''}</div>
        <div className="chips" style={{ marginTop: 4 }}><span className={'tag ' + tone}>{tone === 'sky' ? <Lock size={11} /> : null}{t}</span>{done(w.id) && <span className="tag mint"><Check size={11} />wykonany</span>}{!done(w.id) && w.scheduled_date < today && w.status === 'published' && <span className="tag gold"><AlertTriangle size={11} />niewykonany</span>}</div></div>
      <div className="row" style={{ gap: 4 }}>
        {w.status !== 'published' ? <button className="iconbtn" title="Opublikuj" aria-label="Opublikuj" onClick={() => set(w, { status: 'published' }, 'Opublikowano – odsłoni się w dniu treningu')}><Eye size={16} /></button>
          : <button className="iconbtn" title="Wycofaj publikację" aria-label="Wycofaj publikację" onClick={() => set(w, { status: 'draft' }, 'Wycofano – podopieczny już go nie zobaczy')}><EyeOff size={16} /></button>}
        <button className="iconbtn" title="Edytuj / zmień termin" aria-label="Edytuj" onClick={() => modal(cl => <PlanWorkoutSheet c={c} w={w} close={cl} onSaved={load} />)}><CalendarClock size={16} /></button>
        <button className="iconbtn" title="Usuń" aria-label="Usuń" onClick={() => del(w)}><Trash2 size={16} /></button>
      </div>
    </div>); };
  return (
    <div className="cols">
      <div className="card stack">
        <div className="spread"><h3>Nadchodzące</h3><button className="btn pri sm" onClick={() => modal(cl => <PlanWorkoutSheet c={c} close={cl} onSaved={load} />)}><CalendarPlus size={14} />Zaplanuj</button></div>
        {err && <div className="banner bad"><div className="small">{err}</div></div>}
        {list === null ? <div className="empty"><span className="typing"><span /><span /><span /></span></div>
          : upcoming.length ? upcoming.map(w => <Row key={w.id} w={w} />) : <p className="small muted">Brak zaplanowanych treningów. Podopieczny trenuje według planu rotacyjnego.</p>}
      </div>
      <div className="card stack"><h3>Historia kalendarza</h3>
        {list && past.length ? past.slice(0, 20).map(w => <Row key={w.id} w={w} />) : <p className="small muted">Pojawi się tu po pierwszych zaplanowanych treningach.</p>}
      </div>
    </div>
  );
}

// Podopieczny: treningi z kalendarza, które serwer już udostępnił
export function useMyWorkouts(enabled) {
  const [list, setList] = useState([]), [state, setState] = useState('idle');
  useEffect(() => { if (!enabled) return; setState('loading'); api.myWorkouts().then(w => { setList((w || []).filter(workoutVisible)); setState('ok'); }, () => setState('error')); }, [enabled]);
  return { list, state };
}
