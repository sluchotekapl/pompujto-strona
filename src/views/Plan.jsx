import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, Repeat, ChevronDown, Library } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useUI, Anim, Bar, Page, Stagger, Item, comma } from '../components/ui.jsx';
import { ExerciseSheet, SwapSheet } from '../components/exercise.jsx';
import { WeekStrip, amount } from './Today.jsx';
import { aiProgram } from '../lib/ai.js';
const PJ = () => window.PJ;
const DAYS = [[1, 'Pn'], [2, 'Wt'], [3, 'Śr'], [4, 'Cz'], [5, 'Pt'], [6, 'So'], [0, 'Nd']];
const LVL = { beginner: 'początkujący', intermediate: 'średnio zaawansowany', advanced: 'zaawansowany' };
const GOALS = { redukcja: 'redukcja', zdrowie: 'zdrowie i kondycja', masa: 'budowa mięśni', sila: 'siła' };

export function AiPlanSheet({ p, onApply, close }) {
  const [wish, setWish] = useState(''), [busy, setBusy] = useState(false), [res, setRes] = useState(null), [err, setErr] = useState('');
  const go = async () => {
    setBusy(true); setErr(''); setRes(null);
    try { setRes(await aiProgram(p, wish)); }
    catch (e) { setErr(e.code === 'offline' ? 'offline' : e.message); }
    setBusy(false);
  };
  const local = () => { const pr = PJ().buildProgram(p, p.history, p.program); onApply(pr); close(); };
  return (
    <div className="stack">
      <span className="ai-badge" style={{ justifySelf: 'start' }}><Sparkles size={12} />Trener AI</span>
      <h2>Ułóż plan z AI</h2>
      <p className="small muted">AI zna Twoją ankietę, kontuzje i historię. Wybiera tylko z ćwiczeń dozwolonych dla Ciebie – każde jest sprawdzane przed zapisem.</p>
      <label className="f">Życzenia (opcjonalnie)<textarea id="wish" value={wish} onChange={e => setWish(e.target.value)} placeholder="np. chcę mocniej klatkę i ręce, nie lubię wykroków, mam 45 minut" /></label>
      <button className="btn pri big" onClick={go} disabled={busy}>{busy ? <><span className="typing"><span /><span /><span /></span>AI układa plan…</> : <><Sparkles size={18} />Ułóż plan</>}</button>
      {err === 'offline' && <div className="banner info"><div><b>Trener AI jest wyłączony</b>Na Netlify włączysz go kluczem GEMINI_API_KEY (instrukcja w README). Teraz mogę ułożyć plan algorytmem.</div><button className="btn sm" onClick={local}>Ułóż algorytmem</button></div>}
      {err && err !== 'offline' && <div className="banner bad"><div>{err}</div></div>}
      <AnimatePresence>{res && <motion.div className="card stack" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h3>{res.name}</h3><p className="small">{res.basis}</p>
        {res.days.map(d => <div key={d.key} className="stack" style={{ gap: 4 }}><p className="eyebrow">Dzień {d.key} · {d.name}</p><p className="small muted">{d.slots.map(s => PJ().BY[s.exId].n).join(' · ')}</p></div>)}
        {res.tips && res.tips.length > 0 && <ul className="list small">{res.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
        <div className="row"><button className="btn pri" onClick={() => { onApply(res); close(); }}>Biorę ten plan</button><button className="btn" onClick={go}><RefreshCw size={16} />Inna wersja</button></div>
      </motion.div>}</AnimatePresence>
    </div>
  );
}

export default function Plan() {
  const { data: p, update } = useApp();
  const { modal, toast } = useUI();
  const [open, setOpen] = useState(0);
  const apply = pr => { update(x => { x.program = pr; }); toast('Nowy plan: ' + pr.name); };
  const ai = () => modal(c => <AiPlanSheet p={p} onApply={apply} close={c} />);
  if (!p.program) return <Page><div className="hero"><h1>Nie masz planu</h1><div className="row"><button className="btn pri big" onClick={ai}><Sparkles size={18} />Ułóż z AI</button><button className="btn big" onClick={() => apply(PJ().buildProgram(p, p.history))}>Ułóż algorytmem</button></div></div></Page>;
  const pr = p.program, ph = PJ().phase(p, pr, p.history), rs = PJ().restrictions(p);
  const regen = () => modal(c => <div className="stack"><h2>Ułożyć plan od nowa?</h2><p>Historia i ciężary zostają.{pr.coach ? ' Uwaga: zastąpisz plan rozpisany przez trenera.' : ''}</p><div className="row">
    <button className="btn pri" onClick={() => { c(); ai(); }}><Sparkles size={16} />Z Trenerem AI</button>
    <button className="btn" onClick={() => { apply(PJ().buildProgram(p, p.history, p.program)); c(); }}>Algorytmem (zachowaj ćwiczenia)</button>
    <button className="btn" onClick={() => { apply(PJ().buildProgram(p, [], null)); c(); }}>Algorytmem, od zera</button></div></div>);
  return (
    <Page>
      <div className="spread"><div><p className="eyebrow">Twój program {pr.coach && <span className="tag sky" style={{ marginLeft: 6 }}>od trenera{pr.coachName ? ': ' + pr.coachName : ''}</span>} {pr.ai && <span className="ai-badge" style={{ marginLeft: 6 }}><Sparkles size={11} />AI</span>}</p><h1>{pr.name}</h1></div>
        <div className="row"><a className="btn" href="#cwiczenia"><Library size={16} />200 ćwiczeń</a><button className="btn pri" onClick={regen}><RefreshCw size={16} />Ułóż od nowa</button></div></div>
      <div className="cols">
        <Stagger>
          <Item className="card stack"><h3>Dlaczego taki plan</h3><p>{pr.basis || (PJ().TEMPLATES[pr.tid] || {}).basis || 'Plan rozpisany przez trenera.'}</p>
            {pr.tips && pr.tips.length > 0 && <ul className="list small">{pr.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
            <p className="xs muted">Dobrane do: {LVL[p.level]}{p.survey.returning ? ', powrót po przerwie' : ''} · {p.trainDays.length} dni ({DAYS.filter(d => p.trainDays.includes(d[0])).map(d => d[1]).join(', ')}) · {p.sessionMin} min · cel: {GOALS[p.survey.goal]}</p>
            {rs.notes.map((n, i) => <div key={i} className="banner info"><div>{n}</div></div>)}</Item>
          {pr.days.map((d, di) => {
            const ses = PJ().buildSession(p, pr, p.history, { dayIndex: di }), isOpen = open === di;
            return <Item key={di} className="card">
              <button onClick={() => setOpen(isOpen ? -1 : di)} className="spread" style={{ width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--ink)', textAlign: 'left' }}>
                <span><span className="eyebrow">Dzień {d.key}</span><h3>{d.name} <span className="muted small">· ~{ses.minutes} min</span></h3></span>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }}><ChevronDown /></motion.span></button>
              <AnimatePresence initial={false}>{isOpen && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ paddingTop: 10 }}>{ses.items.map(it => <div key={it.exId} className="ex"><Anim id={it.exId} /><div className="t">
                  <button className="nm" onClick={() => modal(c => <ExerciseSheet id={it.exId} p={p} close={c} />)}>{PJ().BY[it.exId].n}</button>
                  <div className="rx"><span><b>{it.target.sets} × {amount(it.target)}</b></span>{it.w ? <span><b>{comma(it.w)} kg</b></span> : null}<span>RPE {it.target.rpe}</span><span>{PJ().PATTERN[it.p]}</span></div>
                  <div><button className="btn ghost sm" onClick={() => modal(c => <SwapSheet p={p} dayIndex={di} slotIndex={it.slot} modal={modal} close={c} onPick={id => update(x => { x.program.days[di].slots[it.slot].exId = id; })} />)}><Repeat size={14} />Zamień</button></div></div></div>)}</div>
              </motion.div>}</AnimatePresence>
            </Item>;
          })}
        </Stagger>
        <Stagger delay={.1}>
          <Item className="card stack"><h3>Faza: {ph.name}</h3><p className="small">{ph.desc}</p>{ph.len > 0 && <><Bar value={ph.done} max={ph.len} /><p className="xs muted num">{ph.done}/{ph.len} treningów</p></>}
            {p.level === 'beginner' && p.history.length >= 36 && <div className="banner"><div><b>Gotowy na więcej?</b>Masz 36+ treningów. Zmień poziom w ankiecie na średnio zaawansowany.</div></div>}</Item>
          <Item className="card stack"><h3>Ten tydzień</h3><WeekStrip p={p} /></Item>
          <Item className="card stack"><h3>Jak działa progresja</h3><ol className="steps small">
            <li>Trzymasz ciężar, aż zrobisz górny zakres powtórzeń we wszystkich seriach.</li>
            <li>Wtedy kolejny trening dostaje +2,5–5 kg (sztanga), +2 kg (hantle) albo krok maszyny.</li>
            <li>Dwa treningi z rzędu poniżej zakresu = cofamy 10%.</li>
            <li>Słaba forma rano albo dwie oceny „na maksa” = lżejszy trening.</li></ol></Item>
          <Item as="details" className="card"><summary style={{ cursor: 'pointer', fontWeight: 800 }}>Na czym oparte są plany</summary><div className="stack small" style={{ marginTop: 10 }}>
            <p><b>Początkujący:</b> Starting Strength, StrongLifts 5×5, GZCLP – całe ciało 2–3× w tygodniu, progresja liniowa. Po przerwie: 12–15 powtórzeń i 3–6 treningów wdrożenia.</p>
            <p><b>Średnio zaawansowani:</b> Upper/Lower i PHUL, Full Body z falowaniem obciążenia (DUP).</p>
            <p><b>Zaawansowani:</b> Push/Pull/Legs, 5/3/1 Wendlera – cykle z tygodniem lżejszym.</p>
            <p><b>Wytyczne:</b> ACSM, WHO (150–300 min ruchu i 2+ dni siłowe tygodniowo), skala RPE/RIR.</p>
            <p className="muted">Aplikacja nie zastępuje lekarza ani trenera.</p></div></Item>
        </Stagger>
      </div>
    </Page>
  );
}
