import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dumbbell, Users, X } from 'lucide-react';
import { api, MODE, PRICES } from '../lib/backend.js';
import { Brand } from '../components/Logo.jsx';
import { Seg } from '../components/ui.jsx';
import { Terms, Privacy } from './Legal.jsx';

const urlCode = () => { try { const q = new URLSearchParams(location.search); return q.get('zaproszenie') ? q.get('zaproszenie').toLowerCase() : (q.get('kod') || '').toUpperCase(); } catch (e) { return ''; } };

export default function Auth({ onDone }) {
  const code0 = urlCode();
  const [tab, setTab] = useState(code0 ? 'up' : 'in');
  const [f, setF] = useState({ name: '', email: '', password: '', invite: code0, kind: 'user' });
  const [ok, setOk] = useState({ terms: false, health: false });
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setErr('');
    if (tab === 'up' && f.name.trim().length < 2) return setErr('Podaj imię.');
    if (!f.email.trim()) return setErr(MODE === 'cloud' ? 'Podaj e‑mail.' : 'Podaj login lub e‑mail.');
    if (f.password.length < 6) return setErr('Hasło musi mieć co najmniej 6 znaków.');
    if (tab === 'up' && !(ok.terms && ok.health)) return setErr('Zaznacz obie zgody – bez nich nie ułożymy bezpiecznego planu.');
    setBusy(true);
    try {
      const consents = { terms: new Date().toISOString(), health: new Date().toISOString(), version: '2026-11-03' };
      const r = tab === 'in' ? await api.signIn(f.email, f.password) : await api.signUp({ ...f, kind: f.invite.trim() ? 'user' : f.kind, consents });
      if (code0) history.replaceState(null, '', location.pathname + location.hash);
      if (r && r.pendingEmail) setSent(true); else await onDone();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const Kind = ({ k, I, t, s }) => <button type="button" className="choice" aria-pressed={f.kind === k} onClick={() => setF({ ...f, kind: k })}><span className="row" style={{ gap: 8 }}><I size={18} /><b>{t}</b></span><span className="xs muted">{s}</span></button>;
  return (
    <div className="auth">
      <motion.div className="box" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 24 }}>
        <div style={{ justifySelf: 'center' }}><Brand size={64} /></div>
        <div className="stack" style={{ textAlign: 'center', gap: 6 }}>
          <h1>Trenuj z głową,<br /><span className="grad">pompuj z planem</span></h1>
          <p className="muted">Plan na dziś, Trener AI, dieta i nagrody za sumienny tydzień.</p>
        </div>
        <div className="card stack">
          {sent ? (
            <div className="stack">
              <h2>Sprawdź skrzynkę</h2>
              <p>Wysłaliśmy link aktywacyjny na <b>{f.email}</b>. Kliknij go, a potem zaloguj się tutaj.</p>
              <button className="btn" onClick={() => { setSent(false); setTab('in'); }}>Wróć do logowania</button>
            </div>
          ) : (<>
            <Seg id="auth" value={tab} onChange={t => { setTab(t); setErr(''); }} options={[['in', 'Logowanie'], ['up', 'Załóż konto']]} />
            {tab === 'up' && code0 && <div className="banner ok"><div><b>Zaproszenie od trenera</b>Zaproszenie jest już wpisane – po rejestracji trafisz do swojego trenera i korzystasz za darmo.</div></div>}
            <form className="stack" onSubmit={submit} noValidate>
              <AnimatePresence initial={false}>
                {tab === 'up' && !code0 && <motion.div key="k" className="choices" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <Kind k="user" I={Dumbbell} t="Trenuję dla siebie" s={`${PRICES.trialDays} dni za darmo, potem ${PRICES.user} zł/mies.`} />
                  <Kind k="trainer" I={Users} t="Jestem trenerem" s={`${PRICES.trainer} zł/mies., ${PRICES.trainerSeats} podopiecznych w cenie`} />
                </motion.div>}
                {tab === 'up' && <motion.label key="n" className="f" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>Imię i nazwisko<input id="a-name" type="text" value={f.name} onChange={set('name')} autoComplete="name" /></motion.label>}
              </AnimatePresence>
              <label className="f">{MODE === 'cloud' ? 'E‑mail' : 'Login lub e‑mail'}<input id="a-email" type={MODE === 'cloud' ? 'email' : 'text'} value={f.email} onChange={set('email')} autoComplete="username" /></label>
              <label className="f">Hasło<input id="a-pass" type="password" value={f.password} onChange={set('password')} autoComplete={tab === 'in' ? 'current-password' : 'new-password'} /></label>
              {tab === 'up' && !code0 && f.kind === 'user' && <label className="f">Kod trenera (jeśli masz trenera)<input id="a-inv" type="text" value={f.invite} onChange={e => setF({ ...f, invite: e.target.value.toUpperCase() })} placeholder="opcjonalnie" /></label>}
              {tab === 'up' && <div className="stack" style={{ gap: 8 }}>
                <label className="check"><input id="a-terms" type="checkbox" checked={ok.terms} onChange={e => setOk({ ...ok, terms: e.target.checked })} /><span>Akceptuję <button type="button" className="linkbtn" onClick={() => setDoc('terms')}>regulamin</button> i <button type="button" className="linkbtn" onClick={() => setDoc('privacy')}>politykę prywatności</button>.</span></label>
                <label className="check"><input id="a-health" type="checkbox" checked={ok.health} onChange={e => setOk({ ...ok, health: e.target.checked })} /><span>Zgadzam się na przetwarzanie moich danych o zdrowiu (kontuzje, choroby, waga) w celu dopasowania planu i diety. Mogę ją wycofać, usuwając konto.</span></label>
              </div>}
              {err && <div className="banner bad"><div>{err}</div></div>}
              <button className="btn pri big" disabled={busy}>{busy ? 'Chwila…' : tab === 'in' ? 'Zaloguj się' : 'Załóż konto'}</button>
            </form>
          </>)}
        </div>
        <p className="xs muted" style={{ textAlign: 'center' }}><button type="button" className="linkbtn" onClick={() => setDoc('terms')}>Regulamin</button> · <button type="button" className="linkbtn" onClick={() => setDoc('privacy')}>Prywatność</button></p>
        {MODE === 'local' && <p className="xs muted" style={{ textAlign: 'center' }}>Tryb podglądu: konta zapisują się tylko w tej przeglądarce. Konto startowe: login <b>trener</b>, hasło <b>pompujto</b>.</p>}
      </motion.div>
      <AnimatePresence>{doc && <motion.div className="ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDoc(null)}>
        <motion.div className="sheet" role="dialog" aria-modal="true" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={e => e.stopPropagation()}>
          <div className="spread"><h2>{doc === 'privacy' ? 'Polityka prywatności' : 'Regulamin'}</h2><button className="iconbtn" onClick={() => setDoc(null)} aria-label="Zamknij"><X size={18} /></button></div>
          {doc === 'privacy' ? <Privacy /> : <Terms />}
        </motion.div></motion.div>}</AnimatePresence>
    </div>
  );
}
