import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Trash2, Wand2 } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useUI, Page } from '../components/ui.jsx';
import { coachReply } from '../lib/ai.js';
import { AiPlanSheet } from './Plan.jsx';
const PJ = () => window.PJ;

const QUICK = ['Co dziś zjeść przed treningiem?', 'Boli mnie kolano przy przysiadzie – co zmienić?', 'Jak szybciej schudnąć bez utraty mięśni?', 'Ułóż mi 10‑minutową rozgrzewkę', 'Ile białka w praktyce, co jeść?', 'Czy mogę zjeść pizzę w weekend?'];

export default function Coach() {
  const { data: p, update } = useApp();
  const { modal, toast } = useUI();
  const [txt, setTxt] = useState(''), [busy, setBusy] = useState(false), [live, setLive] = useState(''), [off, setOff] = useState(false);
  const end = useRef(null);
  const msgs = p.coach || [];
  useEffect(() => { end.current && end.current.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs.length, live]);
  const send = async q => {
    q = (q || txt).trim(); if (!q || busy) return;
    setTxt(''); setBusy(true); setLive('');
    const hist = msgs.concat({ role: 'user', content: q });
    update(x => { x.coach = hist; });
    try {
      const a = await coachReply(p, hist, t => setLive(t));
      update(x => { x.coach = hist.concat({ role: 'assistant', content: a }).slice(-40); });
    } catch (e) {
      if (e.code === 'offline') { setOff(true); update(x => { x.coach = hist.concat({ role: 'assistant', content: 'Trener AI jest teraz wyłączony. Po podłączeniu klucza Claude API (instrukcja w README) odpowiem na każde pytanie o trening i dietę.' }); }); }
      else toast(e.message);
    }
    setLive(''); setBusy(false);
  };
  return (
    <Page>
      <div className="spread"><div><span className="ai-badge"><Sparkles size={12} />Trener AI</span><h1 style={{ marginTop: 8 }}>Zapytaj trenera</h1></div>
        <div className="row"><button className="btn pri" onClick={() => modal(c => <AiPlanSheet p={p} onApply={pr => { update(x => { x.program = pr; }); toast('Nowy plan: ' + pr.name); }} close={c} />)}><Wand2 size={16} />Ułóż plan z AI</button>
          {msgs.length > 0 && <button className="btn" onClick={() => update(x => { x.coach = []; })}><Trash2 size={16} />Wyczyść</button>}</div></div>
      <div className="cols">
        <div className="card stack" style={{ minHeight: 420 }}>
          <div className="chat">
            {!msgs.length && <div className="empty"><Sparkles size={34} color="var(--pink)" /><b>Znam Twoją ankietę, plan i ostatnie treningi.</b><span className="small">Pytaj o technikę, ból, dietę, motywację albo poproś o zmianę planu.</span></div>}
            <AnimatePresence initial={false}>
              {msgs.map((m, i) => <motion.div key={i} className={'msg ' + (m.role === 'user' ? 'me' : 'ai')} initial={{ opacity: 0, y: 10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>{m.content}</motion.div>)}
              {busy && <motion.div key="live" className="msg ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{live || <span className="typing"><span /><span /><span /></span>}</motion.div>}
            </AnimatePresence>
            <div ref={end} />
          </div>
          <form className="composer" onSubmit={e => { e.preventDefault(); send(); }}>
            <textarea id="coach-in" value={txt} onChange={e => setTxt(e.target.value)} placeholder="Napisz pytanie…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} aria-label="Pytanie do trenera" />
            <button className="btn pri" disabled={busy || !txt.trim()} aria-label="Wyślij"><Send size={18} /></button>
          </form>
        </div>
        <div className="stack">
          <div className="card stack"><h3>Szybkie pytania</h3><div className="stack" style={{ gap: 6 }}>{QUICK.map(q => <motion.button whileHover={{ x: 4 }} key={q} className="btn" style={{ justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => send(q)} disabled={busy}>{q}</motion.button>)}</div></div>
          <div className="card stack"><h3>Co potrafi Trener AI</h3><ul className="list small">
            <li>Układa plan pod Twoje życzenia, sprawdzając każde ćwiczenie pod kątem kontuzji.</li>
            <li>Komentuje każdy zapisany trening.</li>
            <li>Odpowiada na pytania o technikę, dietę i regenerację.</li></ul>
            {off && <p className="xs muted">Teraz wyłączony – włączysz go kluczem Claude API na Netlify.</p>}
            <p className="xs muted">Nie zastępuje lekarza. Przy ostrym bólu, bólu w klatce lub zawrotach głowy – przerwij i skonsultuj się ze specjalistą.</p></div>
        </div>
      </div>
    </Page>
  );
}
