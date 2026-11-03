import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, MODE } from '../lib/backend.js';
import { Brand } from '../components/Logo.jsx';
import { Seg } from '../components/ui.jsx';

export default function Auth({ onDone }) {
  const [tab, setTab] = useState('in');
  const [f, setF] = useState({ name: '', email: '', password: '', invite: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setErr('');
    if (tab === 'up' && f.name.trim().length < 2) return setErr('Podaj imię.');
    if (!f.email.trim()) return setErr(MODE === 'cloud' ? 'Podaj e‑mail.' : 'Podaj login lub e‑mail.');
    if (f.password.length < 6) return setErr('Hasło musi mieć co najmniej 6 znaków.');
    setBusy(true);
    try {
      const r = tab === 'in' ? await api.signIn(f.email, f.password) : await api.signUp(f);
      if (r && r.pendingEmail) setSent(true); else await onDone();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
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
            <form className="stack" onSubmit={submit} noValidate>
              <AnimatePresence initial={false}>
                {tab === 'up' && <motion.label key="n" className="f" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>Imię i nazwisko<input id="a-name" type="text" value={f.name} onChange={set('name')} autoComplete="name" /></motion.label>}
              </AnimatePresence>
              <label className="f">{MODE === 'cloud' ? 'E‑mail' : 'Login lub e‑mail'}<input id="a-email" type={MODE === 'cloud' ? 'email' : 'text'} value={f.email} onChange={set('email')} autoComplete="username" /></label>
              <label className="f">Hasło<input id="a-pass" type="password" value={f.password} onChange={set('password')} autoComplete={tab === 'in' ? 'current-password' : 'new-password'} /></label>
              {tab === 'up' && <label className="f">Kod zaproszenia (jeśli dostałeś)<input id="a-inv" type="text" value={f.invite} onChange={set('invite')} /></label>}
              {err && <div className="banner bad"><div>{err}</div></div>}
              <button className="btn pri big" disabled={busy}>{busy ? 'Chwila…' : tab === 'in' ? 'Zaloguj się' : 'Załóż konto'}</button>
            </form>
          </>)}
        </div>
        {MODE === 'local' && <p className="xs muted" style={{ textAlign: 'center' }}>Tryb podglądu: konta zapisują się tylko w tej przeglądarce. Konto startowe: login <b>trener</b>, hasło <b>pompujto</b>.</p>}
      </motion.div>
    </div>
  );
}
