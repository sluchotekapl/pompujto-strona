import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { Bell, Dumbbell, CalendarCheck, Sparkles, Apple, Trophy, Library, ClipboardList, LogOut, Mail, SunMoon, LayoutDashboard, Users, NotebookPen, User } from 'lucide-react';
import { api, MODE, normalize } from './lib/backend.js';
import { applyCoach } from './lib/coach.js';
import { Brand } from './components/Logo.jsx';
import { UIProvider, useUI, ModalLayer, Boundary } from './components/ui.jsx';
import Auth from './views/Auth.jsx';
import Today from './views/Today.jsx';
import Plan from './views/Plan.jsx';
import Library_ from './views/Library.jsx';
import Diet from './views/Diet.jsx';
import Rewards from './views/Rewards.jsx';
import Coach from './views/Coach.jsx';
import Profile from './views/Profile.jsx';
import Inbox from './views/Inbox.jsx';
import { CoachDashboard, Clients, ClientDetail, Plans, Editor } from './views/Trainer.jsx';
import Onboarding, { needsInterview } from './views/Onboarding.jsx';
const Interview = () => <Onboarding repeat />;

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const ROUTES = {
  dzis: ['Dziś', CalendarCheck, Today], plan: ['Plan', Dumbbell, Plan], trener: ['Trener AI', Sparkles, Coach],
  dieta: ['Dieta', Apple, Diet], nagrody: ['Nagrody', Trophy, Rewards], cwiczenia: ['Ćwiczenia', Library, Library_],
  ankieta: ['Ankieta', ClipboardList, Profile], wiadomosci: ['Wiadomości', Mail, Inbox],
  wywiad: ['Wywiad', ClipboardList, Interview], pulpit: ['Pulpit', LayoutDashboard, CoachDashboard], podopieczni: ['Podopieczni', Users, Clients], plany: ['Plany', NotebookPen, Plans], edytor: ['Kreator planu', NotebookPen, Editor]
};
const COACH_ROUTES = ['pulpit', 'podopieczni', 'plany', 'edytor'];
const ME_DOCK = ['dzis', 'plan', 'trener', 'dieta', 'nagrody'];
const ME_SIDE = ['dzis', 'plan', 'trener', 'cwiczenia', 'dieta', 'nagrody', 'ankieta', 'wiadomosci'];
const COACH_DOCK = ['pulpit', 'podopieczni', 'plany', 'wiadomosci'];
const COACH_SIDE = ['pulpit', 'podopieczni', 'plany', 'wiadomosci', 'cwiczenia'];

function useRoute() {
  const get = () => { let h = (location.hash || '#dzis').slice(1); if (h === 'panel') h = 'pulpit'; return h.startsWith('p-') || ROUTES[h] ? h : 'dzis'; };
  const [r, setR] = useState(get);
  useEffect(() => { const f = () => { setR(get()); scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}

function Shell() {
  const [me, setMe] = useState(undefined);
  const [data, setData] = useState(null);
  const [inbox, setInbox] = useState([]);
  const [users, setUsers] = useState(null);
  const [editor, setEditor] = useState(null);
  const [lastMode, setLastMode] = useState('me');
  const timer = useRef(null), pending = useRef(null), dataRef = useRef(null);
  dataRef.current = data;
  const route = useRoute();
  const { modal, toast } = useUI();

  const flush = useCallback(() => { if (pending.current) { const d = pending.current; pending.current = null; api.save(d).catch(e => toast('Nie zapisano: ' + e.message)); } }, []);
  const update = useCallback(fn => {
    setData(prev => { const d = structuredClone(prev); fn(d); pending.current = d; clearTimeout(timer.current); timer.current = setTimeout(flush, 500); return d; });
  }, [flush]);
  useEffect(() => { const f = () => flush(); addEventListener('beforeunload', f); addEventListener('pagehide', f); return () => { removeEventListener('beforeunload', f); removeEventListener('pagehide', f); }; }, [flush]);

  const syncCoach = useCallback(async () => {
    const c = await api.myCoach().catch(() => null), d = dataRef.current;
    if (!c || !d) return;
    const seen = d.coachSeen || {};
    if ((c.programV || 0) > (seen.programV || 0) || (c.profileV || 0) > (seen.profileV || 0) || JSON.stringify(c.note || '') !== JSON.stringify((d._coach || {}).note || '')) {
      let msgs = [];
      update(x => { msgs = applyCoach(x, c); });
      setTimeout(() => msgs.forEach(toast), 50);
    }
  }, [update]);
  const refreshInbox = useCallback(() => { api.inbox().then(setInbox).catch(() => { }); syncCoach(); }, [syncCoach]);
  const boot = useCallback(async () => {
    try {
      const s = await api.session(); setMe(s);
      if (s) {
        const d = await api.load(); const msgs = applyCoach(d, d._coach);
        setData(d); if (msgs.length) { api.save(d).catch(() => { }); setTimeout(() => msgs.forEach(toast), 600); }
        api.inbox().then(setInbox).catch(() => { });
      }
    } catch (e) { setMe(null); toast(e.message); }
  }, []);
  useEffect(() => { boot(); }, []);
  useEffect(() => { if (!me) return; const t = setInterval(refreshInbox, 60000); return () => clearInterval(t); }, [me, refreshInbox]);

  /* ---------- podopieczni (dla trenera) ---------- */
  const reloadClients = useCallback(() => api.listUsers().then(setUsers).catch(e => toast(e.message)), []);
  const clients = (() => {
    if (!data) return [];
    const online = (users || []).filter(u => u.id !== me.id).map(u => ({ ...u, offline: false }));
    const offline = (data.clients || []).map(c => ({ id: c.id, name: c.name, email: 'bez konta', role: 'user', created_at: c.created_at, coach_id: me.id, coach: {}, offline: true, data: normalize(c.data, c.id, c.name) }));
    return online.concat(offline);
  })();
  // zapis zmian trenera u podopiecznego: offline → moje dane, online → kolumna coach w bazie
  const saveClient = useCallback(async (client, patch) => {
    if (client.offline) {
      update(x => {
        const c = (x.clients || []).find(k => k.id === client.id); if (!c) return;
        if (patch.program) c.data.program = patch.program;
        if (patch.profile) { const pr = patch.profile; ['level', 'trainDays', 'sessionMin', 'equipment', 'equipPreset', 'age', 'height', 'sex', 'weight'].forEach(k => { if (pr[k] !== undefined) c.data[k] = pr[k]; }); if (pr.survey) c.data.survey = Object.assign({}, c.data.survey, pr.survey); c.data.surveyDone = true; if (pr.name) c.name = pr.name; }
        if (patch.weight) { c.data.weights = (c.data.weights || []).concat(patch.weight); c.data.weight = patch.weight.kg; }
      });
      return;
    }
    const c = client.coach || {}, out = {};
    if (patch.program) { out.program = patch.program; out.programV = (c.programV || 0) + 1; }
    if (patch.profile) { out.profile = patch.profile; out.profileV = (c.profileV || 0) + 1; }
    if ('note' in patch) { out.note = patch.note; out.noteAt = new Date().toISOString(); }
    await api.coachSet(client.id, out);
    setUsers(us => (us || []).map(u => u.id === client.id ? { ...u, coach: { ...u.coach, ...out } } : u));
  }, [update]);

  if (me === undefined) return <div className="auth"><Brand size={72} /></div>;
  if (!me || !data) return <Auth onDone={boot} />;

  const isAdmin = me.role === 'admin';
  const coachRoute = COACH_ROUTES.includes(route) || route.startsWith('p-');
  const mode = isAdmin && (coachRoute || (route === 'wiadomosci' && lastMode === 'coach')) ? 'coach' : 'me';
  if (isAdmin && route !== 'wiadomosci' && mode !== lastMode) setTimeout(() => setLastMode(mode), 0);
  document.documentElement.classList.toggle('coach-mode', mode === 'coach');
  const unread = inbox.filter(m => !m.read).length;
  const logout = async () => { flush(); document.documentElement.classList.remove('coach-mode'); await api.signOut(); setData(null); setMe(null); setUsers(null); location.hash = '#dzis'; };
  const theme = () => {
    const r = document.documentElement, cur = r.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    r.dataset.theme = cur === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('pompujto:theme', r.dataset.theme); } catch (e) { }
  };
  const openEditor = (program, target) => { setEditor({ program: structuredClone(program), target }); location.hash = '#edytor'; };
  const ctx = { me, data, update, isAdmin, inbox, unread, refreshInbox, flush, logout, users, clients, reloadClients, saveClient, editor, setEditor, openEditor };
  let View = route.startsWith('p-') ? (isAdmin ? ClientDetail : Today) : (!isAdmin && COACH_ROUTES.includes(route)) ? Today : ROUTES[route][2];
  if (mode === 'me' && needsInterview(data) && ['dzis', 'plan', 'dieta', 'nagrody', 'trener'].includes(route)) View = Onboarding;
  const initials = (data.name || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
  const lvl = window.PJ.level(window.PJ.totalXP(data));
  const side = mode === 'coach' ? COACH_SIDE : ME_SIDE, dock = mode === 'coach' ? COACH_DOCK : ME_DOCK;
  const active = k => route === k || (k === 'podopieczni' && route.startsWith('p-')) || (k === 'plany' && route === 'edytor');

  const menu = () => modal(close => (
    <div className="stack">
      <div className="row"><span className="av lg">{initials}</span><div><h3>{data.name}</h3><p className="small muted">{me.email} · {isAdmin ? 'trener' : 'podopieczny'} · poziom {lvl.n}</p></div></div>
      <div className="stack" style={{ gap: 6 }}>
        {(mode === 'coach' ? ['dzis', 'ankieta'] : ['ankieta', 'cwiczenia', 'wiadomosci', ...(isAdmin ? ['pulpit'] : [])]).map(k => { const [n, I] = ROUTES[k]; return <a key={k} className="btn" style={{ justifyContent: 'flex-start' }} href={'#' + k} onClick={close}><I size={18} />{k === 'pulpit' ? 'Panel trenera' : k === 'dzis' ? 'Mój trening' : n}{k === 'wiadomosci' && unread ? <span className="tag pink">{unread}</span> : null}</a>; })}
        <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={theme}><SunMoon size={18} />Zmień motyw</button>
        <button className="btn danger" style={{ justifyContent: 'flex-start' }} onClick={() => { close(); logout(); }}><LogOut size={18} />Wyloguj</button>
      </div>
      {MODE === 'local' && <p className="xs muted">Tryb lokalny: konta są zapisane tylko w tej przeglądarce.</p>}
    </div>
  ));
  const ModeSwitch = () => isAdmin ? (
    <div className="seg modeswitch" role="tablist" aria-label="Tryb">
      {[['me', 'Ja', '#dzis', User], ['coach', 'Trener', '#pulpit', Users]].map(([k, n, h, I]) => (
        <a key={k} href={h} className={mode === k ? 'on' : ''} role="tab" aria-selected={mode === k}>
          {mode === k && <motion.i layoutId="mode-pill" className="pill" transition={{ type: 'spring', damping: 30, stiffness: 400 }} />}
          <span><I size={14} />{n}</span>
        </a>))}
    </div>) : null;

  return (
    <Ctx.Provider value={ctx}>
      <div className={'shell ' + (mode === 'coach' ? 'coach-mode' : '')}>
        <aside className="side">
          <div style={{ padding: '4px 10px 14px' }}><Brand /></div>
          {isAdmin && <div style={{ padding: '0 6px 14px' }}><ModeSwitch /></div>}
          {mode === 'coach' && <p className="eyebrow" style={{ padding: '0 14px 6px' }}>Panel trenera</p>}
          {side.map(k => { const [n, I] = ROUTES[k]; return (
            <a key={k} href={'#' + k} className={active(k) ? 'on' : ''}>
              {active(k) && <motion.span layoutId="side-pill" className="pill" transition={{ type: 'spring', damping: 30, stiffness: 380 }} />}
              <I size={19} /><span>{n}</span>{k === 'wiadomosci' && unread ? <span className="tag pink" style={{ marginLeft: 'auto' }}>{unread}</span> : null}
            </a>); })}
          <div className="foot">
            <button className="me" onClick={menu}><span className="av">{initials}</span><span className="small" style={{ fontWeight: 800 }}>{data.name.split(' ')[0]} · poz. {lvl.n}</span></button>
          </div>
        </aside>
        <div style={{ minWidth: 0 }}>
          <header className="topbar">
            <Brand size={40} />
            <span className="sp" />
            <div className="top-mode"><ModeSwitch /></div>
            <a className="iconbtn" href="#wiadomosci" aria-label="Wiadomości"><Bell size={18} />{unread ? <span className="dot">{unread}</span> : null}</a>
            <button className="me" onClick={menu} aria-label="Menu konta"><span className="av">{initials}</span><span className="small hide-sm" style={{ fontWeight: 800 }}>Poz. {lvl.n}</span></button>
          </header>
          <main className="content">
            <Boundary key={route}><AnimatePresence mode="wait"><View key={route} /></AnimatePresence></Boundary>
          </main>
        </div>
      </div>
      <div className="dock"><nav aria-label="Nawigacja" style={{ gridTemplateColumns: `repeat(${dock.length}, 1fr)` }}>
        {dock.map(k => { const [n, I] = ROUTES[k]; return (
          <a key={k} href={'#' + k} className={active(k) ? 'on' : ''}>
            {active(k) && <motion.span layoutId="dock-pill" className="pill" transition={{ type: 'spring', damping: 30, stiffness: 380 }} />}
            <I size={21} /><span>{n === 'Trener AI' ? 'Trener' : n}</span>
          </a>); })}
      </nav></div>
      <ModalLayer />
    </Ctx.Provider>
  );
}

export default function App() {
  useEffect(() => { try { const t = localStorage.getItem('pompujto:theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { } }, []);
  return <MotionConfig reducedMotion="user"><UIProvider><Shell /></UIProvider></MotionConfig>;
}
