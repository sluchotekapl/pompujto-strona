import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Play, Check, Plus, Repeat, Timer, Flame, Sparkles, Gift, Moon, Trophy, Share2, MessageCircle } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useMyWorkouts } from './Calendar.jsx';
import { api, todayIn } from '../lib/backend.js';
import { useUI, Anim, Bar, Ring, Page, Stagger, Item, ymd, fmtDate, comma } from '../components/ui.jsx';
import { ExerciseSheet, SwapSheet } from '../components/exercise.jsx';
import { RewardCard } from './Rewards.jsx';
import { aiAfterWorkout } from '../lib/ai.js';
const PJ = () => window.PJ;

const DAYS = [[1, 'Pn'], [2, 'Wt'], [3, 'Śr'], [4, 'Cz'], [5, 'Pt'], [6, 'So'], [0, 'Nd']];
const DAYLONG = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
export const amount = t => t.unit === 'min' ? '' : t.unit === 's' ? `${t.repMin}–${t.repMax} s` : `${t.repMin}–${t.repMax}`;
export const restTxt = s => s >= 60 ? (s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : `${s / 60} min`) : `${s} s`;

export function burst() {
  const c = ['#ff4d6d', '#ffc23d', '#2ee6a6', '#ff8fa3'];
  confetti({ particleCount: 110, spread: 75, origin: { y: .65 }, colors: c, disableForReducedMotion: true });
  setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: .7 }, colors: c, disableForReducedMotion: true }), 200);
  setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: .7 }, colors: c, disableForReducedMotion: true }), 350);
}

function nextTrainingDate(p, from) { for (let i = 1; i <= 7; i++) { const d = new Date(from); d.setDate(d.getDate() + i); if (p.trainDays.includes(d.getDay())) return d; } return null; }

export function WeekStrip({ p }) {
  const now = new Date(), mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  let idx = p.program ? PJ().buildSession(p, p.program, p.history).dayIndex : 0;
  const doneToday = p.history.some(s => ymd(s.date) === ymd(now));
  return (
    <div className="week">
      {DAYS.map(([wd, lab], i) => {
        const d = new Date(mon); d.setDate(mon.getDate() + i);
        const done = p.history.find(s => ymd(s.date) === ymd(d)), isT = p.trainDays.includes(wd), future = ymd(d) >= ymd(now);
        let k = '·';
        if (done) k = done.dayKey; else if (isT && future && p.program && !(ymd(d) === ymd(now) && doneToday)) { k = p.program.days[idx % p.program.days.length].key; idx++; }
        if (PJ().treatFor(p, ymd(d))) k = k === '·' ? '★' : k + '★';
        return <motion.div key={i} className={`wd ${done ? 'done' : isT ? 'tr' : ''} ${ymd(d) === ymd(now) ? 'today' : ''}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .04 }}><span className="d">{lab}</span><span className="k">{k}</span></motion.div>;
      })}
    </div>
  );
}

export default function Today() {
  const { data: p, update, me } = useApp();
  const cal = useMyWorkouts(!!(me && me.coach_id));
  const { modal } = useUI();
  const [rd, setRd] = useState({ sleep: 1, energy: 1, pain: 0 });
  const [force, setForce] = useState(false);
  const now = new Date();
  if (p.draft) return <Workout />;
  if (!p.program) return <Page><div className="hero"><h1>Brak planu</h1><a className="btn pri big" href="#plan">Ułóż plan</a></div></Page>;

  const ses = PJ().buildSession(p, p.program, p.history, { readiness: rd });
  const rs = PJ().restrictions(p);
  const isDay = p.trainDays.includes(now.getDay());
  const doneToday = p.history.some(s => ymd(s.date) === ymd(now));
  const lv = PJ().level(PJ().totalXP(p));
  const nt = PJ().nutrition(p), L = (p.dietLog || {})[ymd(now)] || {}, meals = PJ().mealDay(p, ymd(now), L.swaps);
  const start = () => {
    update(d => {
      d.draft = { startedAt: new Date().toISOString(), dayIndex: ses.dayIndex, dayKey: ses.dayKey, dayName: ses.dayName, readiness: { ...rd }, phase: ses.phase.key, cardio: ses.cardio, cardioDone: false,
        entries: ses.items.map(it => ({ exId: it.exId, slot: it.slot, target: it.target, note: it.note, coachNote: it.coachNote, first: it.first, sets: Array.from({ length: it.target.sets }, () => ({ w: it.w != null ? it.w : '', r: '', done: false })) })) };
    });
    try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => { }); } catch (e) { }
    scrollTo(0, 0);
  };
  const todayW = cal.list.find(w => w.scheduled_date === todayIn(w.tz) && !p.history.some(h => h.workoutId === w.id));
  const startCal = w => {
    const prog = { id: 'cal-' + w.id, tid: w.content.tid || 'coach', name: w.content.planName || w.title, coach: true, days: [w.content.day] };
    const cs = PJ().buildSession(p, prog, p.history, { readiness: rd, dayIndex: 0 });
    update(d => {
      d.draft = { startedAt: new Date().toISOString(), workoutId: w.id, workoutVersion: w.version, clientKey: 'w-' + w.id, prescription: w.content, dayIndex: 0, dayKey: cs.dayKey, dayName: w.title, readiness: { ...rd }, phase: cs.phase.key, cardio: null, cardioDone: false,
        entries: cs.items.map(it => ({ exId: it.exId, slot: it.slot, target: it.target, note: it.note, coachNote: it.coachNote, first: it.first, sets: Array.from({ length: it.target.sets }, () => ({ w: it.w != null ? it.w : '', r: '', done: false })) })) };
    });
    try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => { }); } catch (e) { }
    scrollTo(0, 0);
  };
  const openEx = id => modal(c => <ExerciseSheet id={id} p={p} close={c} />);
  const swap = slot => modal(c => <SwapSheet p={p} dayIndex={ses.dayIndex} slotIndex={slot} modal={modal} close={c} onPick={id => update(d => { d.program.days[ses.dayIndex].slots[slot].exId = id; })} />);

  let hero;
  if (doneToday && !force) {
    const last = p.history[p.history.length - 1], nx = nextTrainingDate(p, now);
    hero = <div className="hero"><div className="blob" /><p className="eyebrow">Zrobione</p><h1>Trening odhaczony</h1>
      <div className="meta"><span>{last.dayName}</span><span><b>+{last.xp}</b> XP</span><span>Następny: <b>{nx ? fmtDate(nx) : '—'}</b></span></div>
      <p className="muted">Teraz białko, woda i sen. Mięśnie rosną między treningami.</p></div>;
  } else if (!isDay && !force) {
    const nx = nextTrainingDate(p, now);
    hero = <div className="hero"><div className="blob" /><p className="eyebrow"><Moon size={12} /> Dzień regeneracji</p><h1>Dziś odpoczywasz</h1>
      <p className="muted">Zrób 20–30 min spaceru i 10 minut mobilności. Następny trening: <b style={{ color: 'var(--ink)' }}>{nx ? fmtDate(nx) : '—'}</b> – {ses.dayName}.</p>
      <div><button className="btn" onClick={() => setForce(true)}>Trenuj mimo to</button></div></div>;
  } else {
    const Ch = ({ k, label, opts }) => <div className="row"><span className="small muted" style={{ minWidth: 104 }}>{label}</span>{opts.map((o, i) => <button key={i} className="chip" aria-pressed={rd[k] === i} onClick={() => setRd({ ...rd, [k]: i })}>{o}</button>)}</div>;
    hero = <div className="hero"><div className="blob" />
      <p className="eyebrow"><Flame size={12} /> Dziś trenujesz</p>
      <h1>{ses.dayName}</h1>
      <div className="meta"><span><b className="num">~{ses.minutes}</b> min</span><span><b>{ses.items.length}</b> ćwiczeń + cardio</span><span>Faza: <b>{ses.phase.name}</b>{ses.phase.len ? ` ${ses.phase.done}/${ses.phase.len}` : ''}</span>{ses.deload && <span className="tag sky">tydzień lżejszy</span>}</div>
      <div className="stack" style={{ gap: 8 }}><p className="eyebrow">Jak się dziś czujesz?</p>
        <Ch k="sleep" label="Sen" opts={['słabo', 'ok', 'dobrze']} /><Ch k="energy" label="Energia" opts={['mało', 'ok', 'dużo']} /><Ch k="pain" label="Zakwasy / ból" opts={['brak', 'lekkie', 'mocne']} /></div>
      <div><motion.button className="btn pri big" whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }} onClick={start}><Play size={18} />Zaczynam trening</motion.button></div></div>;
  }

  const notes = ses.notes.concat(rs.notes);
  return (
    <Page>
      <div className="spread">
        <div><p className="eyebrow">{DAYLONG[now.getDay()]}, {now.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}</p><h1>Cześć, {p.name.split(' ')[0]}</h1></div>
        <div className="row"><span className="tag gold"><Trophy size={12} />{lv.name}</span><span className="tag pink">{PJ().totalXP(p)} XP</span></div>
      </div>
      {!p.surveyDone && <div className="banner pink"><div><b>Uzupełnij ankietę (2 minuty)</b>Dopasuje ćwiczenia, intensywność i jedzenie do Twojego zdrowia.</div><a className="btn sm" href="#ankieta">Wypełnij</a></div>}
      {p._coach && p._coach.note && <div className="banner info"><div><b>Od trenera</b>{p._coach.note}</div></div>}
      <CoachComments p={p} />
      {todayW && <div className="card stack calcard"><div className="spread"><div><p className="eyebrow">Trening od trenera na dziś</p><h2>{todayW.title}</h2></div><button className="btn pri big" onClick={() => startCal(todayW)}><Play size={18} />Zaczynamy</button></div>
        <p className="small muted">{(todayW.content.day.slots || []).map(s => PJ().BY[s.exId] ? PJ().BY[s.exId].n : '').filter(Boolean).join(' · ')}</p></div>}
      {cal.state === 'error' && me && me.coach_id && <div className="banner bad"><div><b>Nie udało się pobrać treningów od trenera</b>Sprawdź internet i odśwież stronę. Plan rotacyjny poniżej działa normalnie.</div></div>}
      <WeeklyCheckin />
      {hero}
      <div className="cols">
        <div className="card stack">
          <div className="spread"><h2>{doneToday && !force ? 'Następny trening' : 'Twój trening'}</h2><span className="xs muted">{p.program.name}{p.program.ai ? ' · AI' : ''}</span></div>
          {notes.map((n, i) => <div key={i} className="banner info"><div>{n}</div></div>)}
          <p className="eyebrow">1 · Rozgrzewka · 8 min</p>
          <p className="small muted">5 min lekkiego cardio, potem:</p>
          <div>{ses.warmup.map(w => <button key={w.exId} className="mini" onClick={() => openEx(w.exId)}><Anim id={w.exId} /><span>{PJ().BY[w.exId].n} · <span className="muted">{w.amount}</span></span></button>)}</div>
          <p className="eyebrow">2 · Część główna</p>
          {ses.items.some(i => i.first) && <p className="small muted">„Nowe” = dobierz ciężar tak, by po serii zostały 3–4 powtórzenia w zapasie. Zapisz go, a następnym razem podpowiem kolejny.</p>}
          <Stagger className="">{ses.items.map(it => {
            const ex = PJ().BY[it.exId], t = it.target;
            return <Item key={it.exId} className="ex"><Anim id={ex.id} /><div className="t">
              <div className="spread" style={{ gap: 6 }}><button className="nm" onClick={() => openEx(ex.id)}>{ex.n}</button>{it.up ? <span className="tag mint">↑ progresja</span> : it.down ? <span className="tag red">−10%</span> : it.first ? <span className="tag">nowe</span> : null}</div>
              <div className="rx"><span><b>{t.sets} × {amount(t)}</b> {t.unit === 'r' ? 'powt.' : ''}</span>{it.w ? <span><b>{comma(it.w)} kg</b></span> : null}<span>RPE <b>{t.rpe}</b></span><span><Timer size={12} /> <b>{restTxt(t.rest)}</b></span></div>
              {it.coachNote && <p className="note" style={{ color: 'var(--ink)' }}><b>Trener:</b> {it.coachNote}</p>}
              {it.note && !it.first && <p className="note">{it.note}</p>}
              <div><button className="btn ghost sm" onClick={() => swap(it.slot)}><Repeat size={14} />Zamień</button></div></div></Item>;
          })}</Stagger>
          {ses.cardio && <><p className="eyebrow">3 · Cardio · {ses.cardio.min} min</p>
            <button className="mini" onClick={() => ses.cardio.exId && openEx(ses.cardio.exId)}>{ses.cardio.exId && <Anim id={ses.cardio.exId} />}<span><b>{ses.cardio.exId ? PJ().BY[ses.cardio.exId].n : ses.cardio.alt}</b><br /><span className="small muted">{ses.cardio.zone}</span></span></button></>}
          <p className="eyebrow">{ses.cardio ? 4 : 3} · Rozciąganie · 5 min</p>
          <div>{ses.cooldown.map(w => <button key={w.exId} className="mini" onClick={() => openEx(w.exId)}><Anim id={w.exId} /><span>{PJ().BY[w.exId].n} · <span className="muted">{w.amount}</span></span></button>)}</div>
        </div>
        <Stagger>
          <Item><RewardCard /></Item>
          <Item className="card stack"><div className="spread"><h3>Dieta na dziś</h3><a href="#dieta" className="small">Jadłospis</a></div>
            <div className="row" style={{ gap: 18 }}>
              <Ring value={(L.eaten || []).length} max={meals.length} color="var(--mint)"><b className="num" style={{ fontSize: '1.2rem' }}>{(L.eaten || []).length}/{meals.length}</b><span className="xs muted">posiłki</span></Ring>
              <div className="stack" style={{ gap: 4 }}><span className="small">Cel: <b className="num">{nt.kcal}</b> kcal</span><span className="small">Białko: <b className="num">{nt.prot}</b> g</span><span className="small">Woda: <b className="num">{comma(((L.water || 0) / 1000).toFixed(1))}</b> / {comma(nt.water)} l</span></div>
            </div></Item>
          <Item className="card stack"><h3>Ten tydzień</h3><WeekStrip p={p} /><p className="xs muted">Różowe – zaplanowane, zielone – zrobione, ★ – dzień nagrody.</p></Item>
        </Stagger>
      </div>
    </Page>
  );
}

/* ================= trening w toku ================= */
// komentarze trenera do ostatnich treningów
function CoachComments({ p }) {
  const cm = (p._coach && p._coach.comments) || {};
  const list = (p.history || []).filter(h => cm[h.id]).slice(-2).reverse();
  if (!list.length) return null;
  return list.map(h => <div key={h.id} className="banner info"><MessageCircle size={20} /><div><b>Trener o treningu „{h.dayName}” ({fmtDate(h.date)})</b>{cm[h.id].emoji ? cm[h.id].emoji + ' ' : ''}{cm[h.id].t}</div></div>);
}

// cotygodniowy check-in: samopoczucie, sen, energia, stres – widzi go trener
export const CHECK = [['mood', 'Samopoczucie', ['😣', '😕', '😐', '🙂', '😄']], ['sleep', 'Sen', ['😵', '🥱', '😐', '😌', '😴']], ['energy', 'Energia', ['🪫', '😮‍💨', '😐', '⚡', '🚀']], ['hunger', 'Głód na diecie', ['😋', '🙂', '😐', '😟', '😫']]];
function WeeklyCheckin() {
  const { data: p, update } = useApp();
  const { toast } = useUI();
  const wk = PJ().weekKey(new Date());
  const [f, setF] = useState({ mood: 0, sleep: 0, energy: 0, hunger: 0, note: '' }), [open, setOpen] = useState(false);
  const done = (p.checkins || []).some(c => c.week === wk), dow = new Date().getDay();
  if (done || !(dow === 0 || dow === 6 || dow === 1) || !p.history.length) return null;
  const ok = CHECK.every(([k]) => f[k]);
  const save = () => { update(x => { x.checkins = (x.checkins || []).concat({ week: wk, date: new Date().toISOString(), ...f, note: f.note.trim() }).slice(-52); x.rewards.xp = (x.rewards.xp || 0) + 25; }); burst(); toast('Check-in zapisany · +25 XP'); };
  return (
    <div className="card stack checkin">
      <div className="spread"><div><p className="eyebrow">Podsumowanie tygodnia</p><h3>Jak minął tydzień?</h3></div>{!open && <button className="btn pri sm" onClick={() => setOpen(true)}>Check-in · +25 XP</button>}</div>
      {open && <>
        {CHECK.map(([k, n, em]) => <div key={k} className="stack" style={{ gap: 4 }}><span className="small" style={{ fontWeight: 700 }}>{n}</span><div className="emo">{em.map((e, i) => <motion.button whileTap={{ scale: .85 }} key={i} aria-pressed={f[k] === i + 1} aria-label={n + ' ' + (i + 1)} onClick={() => setF({ ...f, [k]: i + 1 })}>{e}</motion.button>)}</div></div>)}
        <label className="f">Coś, co trener powinien wiedzieć? (opcjonalnie)<input id="ci-note" type="text" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="np. wyjazd w przyszłym tygodniu, mniej snu" /></label>
        <button className="btn pri" disabled={!ok} onClick={save}><Check size={16} />Zapisz check-in</button></>}
    </div>
  );
}

function Workout() {
  const { data: p, update } = useApp();
  const { modal, toast } = useUI();
  const d = p.draft;
  const [rest, setRest] = useState(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 500); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!rest) return;
    const left = Math.round((rest.end - Date.now()) / 1000);
    if (left <= 0) { beep(); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { } const t = setTimeout(() => setRest(null), 1200); return () => clearTimeout(t); }
  });
  const total = d.entries.reduce((t, e) => t + e.sets.length, 0), done = d.entries.reduce((t, e) => t + e.sets.filter(s => s.done).length, 0);
  const mins = Math.round((Date.now() - new Date(d.startedAt)) / 60000);
  const setVal = (ei, si, k, v) => update(x => { const e = x.draft.entries[ei]; e.sets[si][k] = v; if (k === 'w' && si === 0) e.sets.forEach((s, j) => { if (j > 0 && !s.done) s.w = v; }); });
  const last = id => { for (let i = p.history.length - 1; i >= 0; i--) { const e = p.history[i].entries.find(x => x.exId === id); if (e) return { date: p.history[i].date, sets: e.sets.filter(x => x.done) }; } return null; };
  const toggle = (ei, si) => {
    const e = d.entries[ei], s = e.sets[si], willDone = !s.done;
    if (willDone && +s.w > 0) {
      const top = PJ().e1rm(+s.w, +(s.r || e.target.repMax)), best = PJ().bestBefore(e.exId, p.history);
      const already = e.sets.some((x, j) => j !== si && x.done && +x.w > 0 && PJ().e1rm(+x.w, +x.r) >= top);
      if (best > 0 && top > best + .01 && !already) { burst(); toast('🏆 Nowy rekord: ' + PJ().BY[e.exId].n + ' – ' + comma(+s.w) + ' kg × ' + (s.r || e.target.repMax)); }
    }
    update(x => { const ss = x.draft.entries[ei].sets[si]; if (!ss.done && ss.r === '') ss.r = String(e.target.repMax); ss.done = !ss.done; });
    if (willDone) setRest({ end: Date.now() + e.target.rest * 1000, len: e.target.rest });
  };
  const swap = ei => modal(c => <SwapSheet p={p} dayIndex={d.dayIndex} slotIndex={d.entries[ei].slot} modal={modal} close={c} onPick={id => update(x => {
    if (!x.draft.workoutId) x.program.days[d.dayIndex].slots[d.entries[ei].slot].exId = id; const e = x.draft.entries[ei]; e.exId = id; e.note = 'Zamienione – dobierz ciężar.'; e.sets.forEach(s => { if (!s.done) s.w = ''; });
  })} />);
  const finish = () => modal(close => <Finish close={close} />);
  const abort = () => modal(close => <div className="stack"><h2>Porzucić trening?</h2><p>Wpisane serie nie zostaną zapisane.</p><div className="row"><button className="btn danger" onClick={() => { update(x => { x.draft = null; }); close(); }}>Tak, porzuć</button><button className="btn" onClick={close}>Wróć</button></div></div>);
  const left = rest ? Math.max(0, Math.round((rest.end - Date.now()) / 1000)) : 0;

  return (
    <Page>
      <div className="wbar">
        <div><p className="eyebrow">Trening w toku · {mins} min</p><h2>{d.dayName}</h2></div>
        <div className="stack" style={{ minWidth: 170, flex: 1, maxWidth: 340, gap: 5 }}><div className="spread small"><span>Serie</span><span className="num">{done}/{total}</span></div><Bar value={done} max={total} /></div>
      </div>
      <div className="banner info"><div>Wpisz ciężar i powtórzenia, odhacz serię – ruszy minutnik przerwy. Zapisane liczby ustawią ciężary na następny raz.</div></div>
      <Stagger>
        {d.entries.map((e, ei) => {
          const ex = PJ().BY[e.exId], t = e.target, lab = t.unit === 's' ? 'sek.' : 'powt.', w = +e.sets[0].w, all = e.sets.every(s => s.done);
          return <Item key={ei} className={'card stack ' + (all ? 'hl' : '')}>
            <div className="ex" style={{ border: 0, padding: 0 }}><Anim id={ex.id} /><div className="t">
              <div className="spread"><button className="nm" onClick={() => modal(c => <ExerciseSheet id={ex.id} p={p} close={c} />)}>{ex.n}</button>{all && <span className="tag mint"><Check size={12} />gotowe</span>}</div>
              <div className="rx"><span><b>{t.sets} × {amount(t)}</b> {t.unit === 'r' ? 'powt.' : ''}</span><span>RPE <b>{t.rpe}</b></span><span>Przerwa <b>{restTxt(t.rest)}</b></span></div>
              {e.coachNote && <p className="note" style={{ color: 'var(--ink)' }}><b>Trener:</b> {e.coachNote}</p>}
              {e.note && <p className="note">{e.note}</p>}
              {(() => { const l = last(e.exId); return l && l.sets.length ? <p className="xs muted lastperf">Ostatnio ({new Date(l.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}): <b className="num">{l.sets.map(x => (x.w ? comma(x.w) + '×' : '') + x.r).join('  ')}</b></p> : null; })()}
              {ex.eq === 'barbell' && w > 20 && <Plates w={w} />}
            </div></div>
            <div className="sets"><div className="sethead"><span>#</span><span>kg</span><span>{lab}</span><span>✓</span></div>
              {e.sets.map((s, si) => <div className="set" key={si}><span className="i">{si + 1}</span>
                <input id={`w-${ei}-${si}`} type="number" inputMode="decimal" step="0.5" min="0" value={s.w} placeholder="kg" aria-label={`Ciężar, seria ${si + 1}`} onChange={ev => setVal(ei, si, 'w', ev.target.value)} />
                <input id={`r-${ei}-${si}`} type="number" inputMode="numeric" min="0" value={s.r} placeholder={String(t.repMax)} aria-label={`${lab}, seria ${si + 1}`} onChange={ev => setVal(ei, si, 'r', ev.target.value)} />
                <motion.button whileTap={{ scale: .85 }} className={'tick ' + (s.done ? 'on' : '')} aria-pressed={s.done} aria-label="Seria zrobiona" onClick={() => toggle(ei, si)}><Check size={20} strokeWidth={3} /></motion.button></div>)}
            </div>
            <div className="row"><button className="btn ghost sm" onClick={() => update(x => { const ee = x.draft.entries[ei], l = ee.sets[ee.sets.length - 1]; ee.sets.push({ w: l ? l.w : '', r: '', done: false }); })}><Plus size={14} />seria</button><button className="btn ghost sm" onClick={() => swap(ei)}><Repeat size={14} />Zamień</button></div>
          </Item>;
        })}
      </Stagger>
      {d.cardio && <label className="card check"><input type="checkbox" checked={d.cardioDone} onChange={ev => update(x => { x.draft.cardioDone = ev.target.checked; })} /><span><b>Cardio: {d.cardio.exId ? PJ().BY[d.cardio.exId].n : d.cardio.alt} – {d.cardio.min} min</b><br /><span className="small muted">{d.cardio.zone}</span></span></label>}
      <div className="row"><button className="btn pri big" onClick={finish}><Check size={18} />Zakończ i zapisz</button><button className="btn danger" onClick={abort}>Porzuć</button></div>
      <div className="workout-end" />
      <AnimatePresence>{rest && <motion.div className="restbar" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
        <div className="in"><Ring value={left} max={rest.len} size={38} stroke={5} color="var(--gold)" /><div><div className="xs" style={{ opacity: .7 }}>Przerwa</div><div className="t">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</div></div><button className="btn sm" onClick={() => setRest(null)}>Pomiń</button></div>
      </motion.div>}</AnimatePresence>
    </Page>
  );
}

function Plates({ w }) {
  const side = (w - 20) / 2; if (!(side > 0)) return null;
  const C = { 25: '#e53935', 20: '#1e5bd8', 15: '#f2b705', 10: '#1f9d55', 5: '#e8e8e8', 2.5: '#222', 1.25: '#999' };
  let r = side; const out = [];
  [25, 20, 15, 10, 5, 2.5, 1.25].forEach(pl => { while (r >= pl - 1e-9) { out.push(pl); r -= pl; } });
  return <span className="plates">Na stronę gryfu 20 kg: {out.map((x, i) => <i key={i} style={{ background: C[x] }} />)} {out.map(comma).join(' + ')} kg</span>;
}
function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.2, a.currentTime); o.start(); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .5); o.stop(a.currentTime + .5); } catch (e) { } }

function Finish({ close }) {
  const { data: p, update } = useApp();
  const { modal, toast } = useUI();
  const [feel, setFeel] = useState(3), [pain, setPain] = useState('');
  const F = ['Lekko', 'Spokojnie', 'W sam raz', 'Ciężko', 'Na maksa'];
  const save = () => {
    const d = p.draft, beforeB = PJ().badges(p, p).filter(b => b.got).map(b => b.id), lvB = PJ().level(PJ().totalXP(p)).n;
    const entries = d.entries.map(e => ({ exId: e.exId, target: e.target, hard: feel >= 5, sets: e.sets.map(s => ({ w: s.w === '' ? 0 : +s.w, r: s.r === '' ? 0 : +s.r, done: s.done })) })).filter(e => e.sets.some(s => s.done));
    const prs = [];
    entries.forEach(e => { const best = PJ().bestBefore(e.exId, p.history); const top = Math.max(0, ...e.sets.filter(s => s.done && s.w > 0).map(s => PJ().e1rm(s.w, s.r))); if (best > 0 && top > best + .01) prs.push(e.exId); });
    const s = { id: 's' + Date.now().toString(36), date: new Date().toISOString(), startedAt: d.startedAt, programId: d.workoutId ? 'calendar' : p.program.id, tid: d.workoutId ? 'coach' : p.program.tid, workoutId: d.workoutId || undefined, dayKey: d.dayKey, dayName: d.dayName, phase: d.phase, feeling: feel, painNote: pain.trim() || null, readiness: d.readiness, cardioDone: d.cardioDone, entries, prs, durationMin: Math.round((Date.now() - new Date(d.startedAt)) / 60000) };
    s.xp = PJ().sessionXP(s, prs.length) + (d.cardioDone ? 20 : 0);
    const after = structuredClone(p); after.history.push(s); after.draft = null;
    update(x => { x.history.push(s); x.draft = null; });
    if (d.workoutId) queueLog({ workout_id: d.workoutId, client_key: d.clientKey, workout_version: d.workoutVersion, prescription: d.prescription || {}, result: { entries, feeling: feel, pain: s.painNote, durationMin: s.durationMin }, started_at: d.startedAt, finished_at: s.date }, toast);
    close(); scrollTo(0, 0); burst();
    const nb = PJ().badges(after, after).filter(b => b.got && !beforeB.includes(b.id)), lv = PJ().level(PJ().totalXP(after));
    modal(c => <Celebrate s={s} p={after} prs={prs} nb={nb} lvUp={lv.n > lvB ? lv : null} close={c} />);
  };
  return (
    <div className="stack">
      <h2>Jak poszło?</h2>
      <p className="small muted">Dwa treningi „na maksa” w krótkim czasie = następny będzie lżejszy.</p>
      <div className="scale">{F.map((f, i) => <button key={i} aria-pressed={feel === i + 1} onClick={() => setFeel(i + 1)}><b>{i + 1}</b>{f}</button>)}</div>
      <label className="f">Coś bolało? (opcjonalnie)<input id="pain" type="text" value={pain} onChange={e => setPain(e.target.value)} placeholder="np. lewe kolano przy wykrokach" /></label>
      <button className="btn pri big" onClick={save}>Zapisz trening</button>
    </div>
  );
}

function Celebrate({ s, p, prs, nb, lvUp, close }) {
  const [tip, setTip] = useState(null);
  useEffect(() => { aiAfterWorkout(p, s).then(setTip).catch(() => setTip('')); }, []);
  const sets = s.entries.reduce((t, e) => t + e.sets.filter(x => x.done).length, 0);
  return (
    <div className="stack celebrate">
      <p className="eyebrow">Trening zapisany</p>
      <motion.div className="bigxp grad" initial={{ scale: .4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 10, stiffness: 160 }}>+{s.xp} XP</motion.div>
      <p>Serie: {sets} · {Math.round(PJ().volume(s))} kg · {s.durationMin} min</p>
      {lvUp && <div className="banner"><div><b>Nowy poziom: {lvUp.name}</b>Poziom {lvUp.n}.</div></div>}
      {prs.length > 0 && <div className="banner ok"><div><b>Rekordy: {prs.length}</b>{prs.map(i => PJ().BY[i].n).join(', ')}</div></div>}
      {nb.map(b => <motion.div key={b.id} className="bd got" style={{ justifyItems: 'center' }} initial={{ rotate: -8, scale: .6 }} animate={{ rotate: 0, scale: 1 }}><span className="ic">{b.ic}</span><b>{b.n}</b><span>{b.d}</span></motion.div>)}
      {tip !== '' && <div className="card tight stack" style={{ textAlign: 'left', width: '100%' }}><span className="ai-badge"><Sparkles size={12} />Trener AI</span>{tip ? <p className="small">{tip}</p> : <p className="typing"><span /><span /><span /></p>}</div>}
      <div className="banner pink" style={{ width: '100%', textAlign: 'left' }}><Gift size={22} /><div><b>Masz obrót kołem nagród!</b>Wylosuj bonusowe XP albo nawet posiłek-nagrodę.</div><a className="btn pri sm" href="#nagrody" onClick={close}>Kręć</a></div>
      <div className="row" style={{ justifyContent: 'center' }}><button className="btn" onClick={() => shareCard(s, p, prs)}><Share2 size={16} />Udostępnij wynik</button><button className="btn" onClick={close}>Zamknij</button></div>
    </div>
  );
}

// karta 1080×1350 do Stories / WhatsApp – rysowana na canvasie
async function shareCard(s, p, prs) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 1080, 1350); grd.addColorStop(0, '#1a0f1f'); grd.addColorStop(1, '#0f0d14'); g.fillStyle = grd; g.fillRect(0, 0, 1080, 1350);
  g.fillStyle = 'rgba(255,77,109,.18)'; g.beginPath(); g.arc(920, 160, 320, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.font = '900 64px Unbounded, Arial Black, sans-serif'; g.fillText('pompujto', 80, 150); g.fillStyle = '#ff4d6d'; g.fillText('.pl', 80 + g.measureText('pompujto').width, 150);
  g.fillStyle = '#a59db2'; g.font = '700 38px Manrope, Arial, sans-serif'; g.fillText(new Date(s.date).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }), 80, 230);
  g.fillStyle = '#fff'; g.font = '900 92px Unbounded, Arial Black, sans-serif'; g.fillText((s.dayName || 'Trening').slice(0, 16), 80, 380);
  const sets = s.entries.reduce((t, e) => t + e.sets.filter(x => x.done).length, 0), vol = Math.round(PJ().volume(s));
  [['OBJĘTOŚĆ', vol.toLocaleString('pl-PL') + ' kg'], ['SERIE', String(sets)], ['CZAS', s.durationMin + ' min'], ['XP', '+' + s.xp]].forEach(([k, v], i) => {
    const x = 80 + (i % 2) * 470, y = 520 + Math.floor(i / 2) * 230;
    g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.roundRect(x, y, 440, 200, 32); g.fill();
    g.fillStyle = '#a59db2'; g.font = '800 30px Manrope, Arial, sans-serif'; g.fillText(k, x + 36, y + 64);
    g.fillStyle = i === 3 ? '#ffc23d' : '#fff'; g.font = '900 72px Unbounded, Arial Black, sans-serif'; g.fillText(v, x + 36, y + 160);
  });
  if (prs.length) { g.fillStyle = '#2ee6a6'; g.font = '800 42px Manrope, Arial, sans-serif'; g.fillText('🏆 Rekordy: ' + prs.map(i => PJ().BY[i].n).join(', ').slice(0, 40), 80, 1060); }
  g.fillStyle = '#6f6780'; g.font = '700 34px Manrope, Arial, sans-serif'; g.fillText('Seria: ' + PJ().weekStreak(p, p.history) + ' tyg. z rzędu · ' + p.history.length + ' treningów', 80, 1250);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], 'pompujto-trening.png', { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Mój trening – Pompujto.pl' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pompujto-trening.png'; document.body.appendChild(a); a.click(); a.remove();
}

// Zapis wykonania treningu z kalendarza: idempotentny (klucz client_key), z kolejką ponowień przy braku sieci.
const LQ = 'pompujto:logq';
export function queueLog(l, toast) {
  let q = []; try { q = JSON.parse(localStorage.getItem(LQ) || '[]'); } catch (e) { }
  q = q.filter(x => x.client_key !== l.client_key).concat(l); try { localStorage.setItem(LQ, JSON.stringify(q)); } catch (e) { }
  flushLogs(toast);
}
export async function flushLogs(toast) {
  let q = []; try { q = JSON.parse(localStorage.getItem(LQ) || '[]'); } catch (e) { }
  for (const l of q) {
    try { await api.logWorkout(l); q = q.filter(x => x.client_key !== l.client_key); try { localStorage.setItem(LQ, JSON.stringify(q)); } catch (e) { } if (toast) toast('Wykonanie zapisane u trenera ✓'); }
    catch (e) { if (toast) toast(navigator.onLine ? 'Nie zapisano u trenera: ' + e.message + ' – spróbuję ponownie.' : 'Brak internetu – wykonanie wyślę, gdy wróci zasięg.'); break; }
  }
}
if (typeof window !== 'undefined') { addEventListener('online', () => flushLogs()); setTimeout(() => flushLogs(), 4000); }
