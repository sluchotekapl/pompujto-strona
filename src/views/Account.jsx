import { useEffect, useState } from 'react';
import { Copy, Download, Trash2, UserPlus, LogOut, Smartphone, CreditCard, FileText, Shield, UserMinus } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useUI, Page } from '../components/ui.jsx';
import { api, MODE, PRICES, access, isTrainer } from '../lib/backend.js';
import { StatusLine } from './Pricing.jsx';
import { canInstall, install, isStandalone } from '../lib/pwa.js';

export const inviteLink = code => location.origin + location.pathname.replace(/index\.html$/, '') + '?kod=' + encodeURIComponent(code);
const copy = (t, toast) => navigator.clipboard.writeText(t).then(() => toast('Skopiowano'), () => toast('Zaznacz tekst i skopiuj ręcznie'));

function InstallCard() {
  const { toast } = useUI();
  const [can, setCan] = useState(canInstall());
  useEffect(() => { const f = () => setCan(canInstall()); addEventListener('pj-install', f); return () => removeEventListener('pj-install', f); }, []);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div className="card stack"><h3><Smartphone size={18} style={{ verticalAlign: '-3px' }} /> Aplikacja na telefon</h3>
      {isStandalone() ? <p className="small">Działasz w zainstalowanej aplikacji. 💪</p>
        : can ? <><p className="small muted">Ikonka na ekranie, pełny ekran, działa też bez zasięgu na siłowni.</p><button className="btn pri" onClick={() => install().then(ok => ok && toast('Zainstalowano'))}><Smartphone size={16} />Zainstaluj aplikację</button></>
          : ios ? <p className="small">iPhone: otwórz stronę w <b>Safari</b> → przycisk <b>Udostępnij</b> → <b>Do ekranu początkowego</b>.</p>
            : <p className="small">Android: w Chrome menu <b>⋮</b> → <b>Zainstaluj aplikację</b> (albo „Dodaj do ekranu głównego”).</p>}
    </div>
  );
}

function DeleteSheet({ close, toast, logout }) {
  const [t, setT] = useState(''), [busy, setBusy] = useState(false);
  return <div className="stack"><h2>Usunąć konto?</h2>
    <p className="small">To usunie konto, plan, historię treningów, dietę, nagrody i wiadomości. <b>Nie da się tego cofnąć.</b> Najpierw możesz pobrać kopię danych.</p>
    <label className="f">Wpisz USUŃ, żeby potwierdzić<input id="del-confirm" value={t} onChange={e => setT(e.target.value)} autoComplete="off" /></label>
    <div className="row"><button className="btn danger" disabled={t.trim().toUpperCase() !== 'USUŃ' || busy} onClick={async () => { setBusy(true); try { await api.deleteMe(); close(); toast('Konto usunięte'); logout(true); } catch (e) { toast(e.message); setBusy(false); } }}><Trash2 size={16} />Usuń na zawsze</button><button className="btn" onClick={close}>Anuluj</button></div></div>;
}


export default function Account() {
  const { me, data, logout, flush, setMe } = useApp();
  const { toast, modal } = useUI();
  const [code, setCode] = useState('');
  const [coachName, setCoachName] = useState(null);
  const a = access(me), tr = isTrainer(me);
  useEffect(() => { if (!tr && me.coach_id) api.contacts().then(cs => { const c = cs.find(x => x.id === me.coach_id); setCoachName(c ? c.name : 'Twój trener'); }).catch(() => { }); }, [me.coach_id]);

  const join = async () => {
    try { const n = /^[0-9a-f]{32}$/i.test(code.trim()) ? await api.redeemInvite(code.trim()) : await api.joinCoach(code); toast('Dołączono do: ' + n); setCode(''); setMe(await api.session()); } catch (e) { toast(e.message); }
  };
  const leave = () => modal(close => <div className="stack"><h2>Odejść od trenera?</h2><p className="small">Trener przestanie widzieć Twoje treningi i nie będzie mógł zmieniać Ci planu. Twoje dane zostają.</p>
    <div className="row"><button className="btn danger" onClick={async () => { close(); try { await api.leaveCoach(); setMe(await api.session()); setCoachName(null); toast('Odłączono od trenera'); } catch (e) { toast(e.message); } }}><UserMinus size={16} />Tak, odłącz</button><button className="btn" onClick={close}>Anuluj</button></div></div>);
  const exportData = () => {
    flush();
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), account: { email: me.email, name: me.name, role: me.role, created_at: me.created_at }, data }, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(blob), el = document.createElement('a');
    el.href = u; el.download = 'pompujto-moje-dane.json'; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
  };
  const del = () => modal(close => <DeleteSheet close={close} toast={toast} logout={logout} />);
  return (
    <Page>
      <div><p className="eyebrow">Ustawienia</p><h1>Konto</h1></div>
      {me.legacy && <div className="banner bad"><div><b>Baza wymaga aktualizacji</b>Administrator musi uruchomić w Supabase plik aktualizacja-3-dwie-wersje.sql – do tego czasu kody trenerów i usuwanie konta nie działają.</div></div>}
      <div className="cols">
        <div className="stack">
          <div className="card stack">
            <div className="spread"><div><h3>{me.name}</h3><p className="small muted">{me.email}</p></div><span className="tag pink">{me.role === 'admin' ? 'administrator' : tr ? 'trener' : me.coach_id ? 'podopieczny trenera' : 'konto dla siebie'}</span></div>
            <div className="row"><StatusLine me={me} /></div>
            <a className="btn" href="#cennik"><CreditCard size={16} />Abonament i ceny</a>
          </div>
          {tr ? <div className="card stack"><h3>Twój kod trenera</h3>
            <p className="small muted">Podopieczni wpisują go przy rejestracji (albo w Koncie). Trafiają od razu na Twoją listę i korzystają za darmo. W cenie {PRICES.trainerSeats} osób.</p>
            <div className="codebox num">{me.trainer_code || '— brak (uruchom aktualizację bazy)'}</div>
            {me.trainer_code && <div className="row"><button className="btn pri" onClick={() => copy(inviteLink(me.trainer_code), toast)}><Copy size={16} />Kopiuj link z kodem</button><button className="btn" onClick={() => copy(me.trainer_code, toast)}>Kopiuj kod</button></div>}
          </div> : <div className="card stack"><h3>Mój trener</h3>
            {me.coach_id ? <><p className="small">Prowadzi Cię: <b>{coachName || '…'}</b>. Widzi Twoje treningi i może zmieniać plan.</p><button className="btn" onClick={leave}><UserMinus size={16} />Odłącz się od trenera</button></>
              : <><p className="small muted">Masz trenera na Pompujto? Wpisz jego kod – dostaniesz plany od niego, a abonament pokrywa trener.</p>
                <div className="row"><input id="join-code" value={code} onChange={e => setCode(e.target.value.trim())} placeholder="kod trenera albo kod zaproszenia" maxLength={40} style={{ flex: 1, minWidth: 120 }} aria-label="Kod trenera" /><button className="btn pri" disabled={code.trim().length < 4} onClick={join}><UserPlus size={16} />Dołącz</button></div></>}
          </div>}
          <InstallCard />
        </div>
        <div className="stack">
          <div className="card stack"><h3><Shield size={18} style={{ verticalAlign: '-3px' }} /> Prywatność</h3>
            <p className="small muted">Twoje dane widzisz Ty{!tr && me.coach_id ? ', Twój trener' : ''} i administrator serwisu. Nikomu ich nie sprzedajemy.</p>
            <button className="btn" onClick={exportData}><Download size={16} />Pobierz moje dane (JSON)</button>
            <div className="row"><a className="btn sm" href="#regulamin"><FileText size={14} />Regulamin</a><a className="btn sm" href="#prywatnosc"><FileText size={14} />Polityka prywatności</a></div>
          </div>
          <div className="card stack"><h3>Wyloguj / usuń</h3>
            <button className="btn" onClick={() => logout()}><LogOut size={16} />Wyloguj się</button>
            <button className="btn danger" onClick={del}><Trash2 size={16} />Usuń konto i dane</button>
            {MODE === 'local' && <p className="xs muted">Tryb podglądu – konta istnieją tylko w tej przeglądarce.</p>}
          </div>
        </div>
      </div>
    </Page>
  );
}
