import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, NotebookPen, Send, Gift, Sparkles, Dumbbell, Copy, ChevronLeft, ArrowUp, ArrowDown, Trash2, Plus, CopyPlus, AlertTriangle, Activity, Trophy, Search, BookOpen, Check, Shield, Scale } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useUI, Anim, Bar, Page, Stagger, Item, Count, Seg, fmtDate, comma, ymd } from '../components/ui.jsx';
import { ExerciseSheet } from '../components/exercise.jsx';
import { api, MODE, blankData, normalize } from '../lib/backend.js';
import { clientStats, alertsFor, liftProgress, blankProgram, toEditable, planText } from '../lib/coach.js';
import { AiPlanSheet } from './Plan.jsx';
import { SurveyForm } from './Profile.jsx';
import { LineChart } from './Rewards.jsx';
const PJ = () => window.PJ;
const GOALS = { redukcja: 'redukcja', zdrowie: 'zdrowie', masa: 'masa', sila: 'siła' };
const LVL = { beginner: 'początkujący', intermediate: 'średni', advanced: 'zaawansowany' };
const DAYS = [[1, 'Pn'], [2, 'Wt'], [3, 'Śr'], [4, 'Cz'], [5, 'Pt'], [6, 'So'], [0, 'Nd']];
const initials = n => (n || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
const copyText = (t, toast) => navigator.clipboard.writeText(t).then(() => toast('Skopiowano'), () => toast('Zaznacz tekst i skopiuj ręcznie'));

function useCoach() {
  const ctx = useApp();
  useEffect(() => { if (!ctx.users) ctx.reloadClients(); }, []);
  return ctx;
}
const isMine = (c, me) => c.offline || c.coach_id === me.id || c.coach_id == null;

/* ---------- przypisanie planu podopiecznemu ---------- */
async function assignPlan(ctx, client, program, toast) {
  const pr = structuredClone(program);
  Object.assign(pr, { id: 'pr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), coach: true, coachName: ctx.data.name, assignedAt: new Date().toISOString() });
  if (!pr.tid || !PJ().TEMPLATES[pr.tid]) pr.tid = 'coach';
  try {
    await ctx.saveClient(client, { program: pr });
    if (!client.offline) api.send([client.id], { type: 'text', title: 'Nowy plan od trenera', body: `${ctx.data.name} ustawił Ci plan „${pr.name}”. Znajdziesz go w zakładce Plan.` }).catch(() => { });
    toast(`Plan „${pr.name}” ustawiony: ${client.name}`);
    return true;
  } catch (e) {
    if (/aktualizacji bazy/.test(e.message)) {
      await api.send([client.id], { type: 'plan', title: 'Nowy plan od trenera', body: 'Kliknij, żeby ustawić plan.', payload: { program: pr } });
      toast('Wysłano jako wiadomość. Uruchom aktualizację bazy, żeby plany ustawiały się same.');
      return true;
    }
    toast(e.message); return false;
  }
}

/* ---------- wiadomość / nagroda ---------- */
export function SendSheet({ users, close, onSent, preset }) {
  const { toast } = useUI();
  const [type, setType] = useState(preset || 'text'), [title, setTitle] = useState(''), [body, setBody] = useState(''), [tier, setTier] = useState('small'), [xp, setXp] = useState(0), [busy, setBusy] = useState(false);
  const online = users.filter(u => !u.offline);
  const go = async () => {
    if (type === 'text' && !body.trim()) return toast('Napisz treść');
    if (!online.length) return toast('Osoby bez konta nie dostają wiadomości');
    setBusy(true);
    try {
      const msg = type === 'reward'
        ? { type, title: title || (tier === 'big' ? 'Duża nagroda od trenera!' : 'Posiłek-nagroda od trenera!'), body: body || 'Za świetną robotę. Odbierz i wybierz, co jesz.', payload: { tier, xp: +xp || 0 } }
        : { type: 'text', title: title || 'Wiadomość od trenera', body };
      await api.send(online.map(u => u.id), msg);
      toast(`Wysłano do: ${online.length}`); onSent && onSent(); close();
    } catch (e) { toast(e.message); }
    setBusy(false);
  };
  return (
    <div className="stack">
      <p className="eyebrow">Do: {online.map(u => u.name).join(', ') || '—'}</p>
      <h2>{type === 'reward' ? 'Wyślij nagrodę' : 'Wyślij wiadomość'}</h2>
      <div className="chips">{[['text', 'Wiadomość'], ['reward', 'Nagroda']].map(([k, n]) => <button key={k} className="chip" aria-pressed={type === k} onClick={() => setType(k)}>{n}</button>)}</div>
      <label className="f">Tytuł<input id="m-title" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={type === 'reward' ? 'Posiłek-nagroda od trenera!' : 'np. Plan na ten tydzień'} /></label>
      <label className="f">Treść<textarea id="m-body" value={body} onChange={e => setBody(e.target.value)} placeholder={type === 'reward' ? 'Za świetną robotę!' : 'Twoja wiadomość…'} /></label>
      {type === 'reward' && <div className="grid2">
        <label className="f">Rodzaj<select id="m-tier" value={tier} onChange={e => setTier(e.target.value)}><option value="small">Posiłek-nagroda (pizza, burger…)</option><option value="big">Duża nagroda</option></select></label>
        <label className="f">Bonus XP<input id="m-xp" type="number" min="0" step="10" value={xp} onChange={e => setXp(e.target.value)} /></label></div>}
      <button className="btn pri big" disabled={busy} onClick={go}><Send size={18} />Wyślij</button>
    </div>
  );
}

/* ---------- zaproszenie / dodanie podopiecznego ---------- */
function InviteBox() {
  const { toast } = useUI();
  const [invite, setInvite] = useState('');
  useEffect(() => { api.getInvite().then(setInvite).catch(() => { }); }, []);
  const link = location.origin + location.pathname.replace(/index\.html$/, '');
  const txt = `Hej! Zapraszam Cię do pompujto.pl – będę Twoim trenerem. Dostaniesz plan treningowy na każdy dzień, dietę i nagrody za sumienny tydzień.\nWejdź: ${link}\nZałóż konto${invite ? ` i wpisz kod zaproszenia: ${invite}` : ''}.`;
  return (
    <div className="stack">
      <p className="small muted">Wyślij to na Messengerze, WhatsAppie albo SMS‑em. Po rejestracji osoba sama pojawi się na Twojej liście. Kod blokuje rejestrację obcym (puste = otwarta).</p>
      <div className="row"><input id="inv" type="text" value={invite} onChange={e => setInvite(e.target.value)} placeholder="Kod, np. POMPA2026" style={{ flex: 1, minWidth: 150 }} aria-label="Kod zaproszenia" />
        <button className="btn" onClick={() => api.setInvite(invite.trim()).then(() => toast('Zapisano kod'), e => toast(e.message))}>Zapisz kod</button></div>
      <textarea id="invtxt" readOnly value={txt} onFocus={e => e.target.select()} />
      <button className="btn pri" onClick={() => copyText(txt, toast)}><Copy size={16} />Kopiuj zaproszenie</button>
    </div>
  );
}

function AddClientSheet({ close }) {
  const ctx = useApp();
  const { toast } = useUI();
  const [tab, setTab] = useState('invite');
  const [f, setF] = useState({ name: '', sex: 'm', age: 30, weight: 80, height: 178, level: 'beginner', goal: 'zdrowie', trainDays: [1, 3, 5] });
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const create = () => {
    if (f.name.trim().length < 2) return toast('Podaj imię');
    const id = 'off' + Date.now().toString(36);
    const d = normalize(blankData({ sex: f.sex, age: +f.age, weight: +f.weight, height: +f.height, level: f.level, trainDays: f.trainDays, weights: [{ date: new Date().toISOString(), kg: +f.weight, xp: 0 }] }), id, f.name.trim());
    d.survey.goal = f.goal; d.surveyDone = true;
    d.program = PJ().buildProgram(d, []);
    ctx.update(x => { x.clients = (x.clients || []).concat({ id, name: f.name.trim(), created_at: new Date().toISOString(), data: d }); });
    toast('Dodano: ' + f.name.trim()); close(); location.hash = '#p-' + id;
  };
  return (
    <div className="stack">
      <h2>Dodaj podopiecznego</h2>
      <Seg id="addc" value={tab} onChange={setTab} options={[['invite', 'Zaproś do aplikacji'], ['offline', 'Bez konta']]} />
      {tab === 'invite' ? <InviteBox /> : <div className="stack">
        <p className="small muted">Dla kogoś, kto nie korzysta z aplikacji: rozpisujesz plan, notatki i pomiary, a plan wysyłasz mu tekstem.</p>
        <div className="grid2">
          <label className="f">Imię i nazwisko<input id="o-name" type="text" value={f.name} onChange={e => set('name', e.target.value)} /></label>
          <label className="f">Płeć<select id="o-sex" value={f.sex} onChange={e => set('sex', e.target.value)}><option value="m">Mężczyzna</option><option value="f">Kobieta</option></select></label>
          <label className="f">Wiek<input id="o-age" type="number" value={f.age} onChange={e => set('age', e.target.value)} /></label>
          <label className="f">Waga (kg)<input id="o-w" type="number" value={f.weight} onChange={e => set('weight', e.target.value)} /></label>
          <label className="f">Wzrost (cm)<input id="o-h" type="number" value={f.height} onChange={e => set('height', e.target.value)} /></label>
          <label className="f">Poziom<select id="o-lvl" value={f.level} onChange={e => set('level', e.target.value)}>{Object.entries(LVL).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
          <label className="f">Cel<select id="o-goal" value={f.goal} onChange={e => set('goal', e.target.value)}>{Object.entries(GOALS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        </div>
        <div className="chips">{DAYS.map(([v, n]) => <button type="button" key={v} className="chip" aria-pressed={f.trainDays.includes(v)} onClick={() => set('trainDays', f.trainDays.includes(v) ? f.trainDays.filter(x => x !== v) : f.trainDays.concat(v))}>{n}</button>)}</div>
        <button className="btn pri big" onClick={create}><UserPlus size={18} />Dodaj</button>
      </div>}
    </div>
  );
}

/* ---------- karta na liście ---------- */
function ClientCard({ c }) {
  const s = clientStats(c.data), al = alertsFor(c);
  return (
    <motion.a href={'#p-' + c.id} className="card client" whileHover={{ y: -3 }} style={{ textDecoration: 'none', color: 'var(--ink)' }}>
      <div className="row" style={{ flexWrap: 'nowrap' }}><span className="av lg">{initials(c.name)}</span>
        <div style={{ minWidth: 0, flex: 1 }}><b>{c.name}</b><div className="xs muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.offline ? 'bez konta' : c.email} · poz. {s.lv.n}</div></div>
        {c.role === 'admin' && <span className="tag pink">trener</span>}</div>
      <div className="stack" style={{ gap: 4 }}><div className="spread xs"><span>Ten tydzień</span><span className="num">{s.st.tr}/{s.st.need} tren. · {s.st.diet}/5 diety</span></div><Bar value={s.st.tr} max={s.st.need} tone={s.st.ok ? 'gold' : ''} /></div>
      <div className="spread xs muted"><span>{s.last ? 'Ostatni trening: ' + fmtDate(s.last.date) : 'Brak treningów'}</span><span className="num">{comma(c.data.weight)} kg{s.dw ? ` (${s.dw > 0 ? '+' : ''}${comma(s.dw)})` : ''}</span></div>
      {al.length > 0 && <div className="chips">{al.slice(0, 2).map(a => <span key={a.k} className={'tag ' + a.tone} style={{ whiteSpace: 'normal' }}>{a.t.length > 46 ? a.t.slice(0, 44) + '…' : a.t}</span>)}</div>}
    </motion.a>
  );
}

/* ================= PULPIT ================= */
export function CoachDashboard() {
  const ctx = useCoach();
  const { modal } = useUI();
  const { users, clients, me } = ctx;
  if (!users) return <Page><div className="empty"><span className="typing"><span /><span /><span /></span></div></Page>;
  const mine = clients.filter(c => isMine(c, me));
  const all = mine.map(c => ({ c, s: clientStats(c.data), a: alertsFor(c) }));
  const active = all.filter(x => x.s.st.tr > 0).length, wk = all.reduce((t, x) => t + x.s.st.tr, 0), attention = all.filter(x => x.a.length);
  const feed = mine.flatMap(c => (c.data.history || []).slice(-6).map(s => ({ c, s }))).sort((a, b) => new Date(b.s.date) - new Date(a.s.date)).slice(0, 10);
  return (
    <Page>
      <div className="spread"><div><p className="eyebrow"><Shield size={12} /> Panel trenera</p><h1>Pulpit</h1></div>
        <div className="row"><button className="btn" onClick={() => modal(c => <AddClientSheet close={c} />)}><UserPlus size={16} />Dodaj podopiecznego</button><button className="btn pri" onClick={() => ctx.openEditor(blankProgram(), { kind: 'library' })}><NotebookPen size={16} />Nowy plan</button></div></div>
      {MODE === 'local' && <div className="banner info"><div><b>Tryb lokalny</b>Widzisz konta z tej przeglądarki. Na stronie z bazą Supabase zobaczysz wszystkich zarejestrowanych.</div></div>}
      <Stagger className="tiles">
        {[[Users, 'Podopieczni', mine.length], [Activity, 'Aktywni w tym tyg.', active], [Dumbbell, 'Treningi w tym tyg.', wk], [AlertTriangle, 'Wymaga uwagi', attention.length]].map(([I, n, v]) => <Item key={n} className="tile"><span className="eyebrow"><I size={12} /> {n}</span><span className="v"><Count to={v} /></span></Item>)}
      </Stagger>
      {!mine.length && <div className="card empty"><Users size={34} /><b>Nie masz jeszcze podopiecznych</b><span className="small">Zaproś kogoś do aplikacji albo dodaj osobę bez konta.</span><button className="btn pri" onClick={() => modal(c => <AddClientSheet close={c} />)}><UserPlus size={16} />Dodaj podopiecznego</button></div>}
      {mine.length > 0 && <div className="cols">
        <Stagger>
          <Item className="card stack"><h3>Wymaga uwagi</h3>
            {attention.length ? attention.map(({ c, a }) => <a key={c.id} href={'#p-' + c.id} className="mini" style={{ textDecoration: 'none' }}><span className="av">{initials(c.name)}</span><span style={{ minWidth: 0 }}><b>{c.name}</b><br />{a.map(x => <span key={x.k} className={'tag ' + x.tone} style={{ marginRight: 4, whiteSpace: 'normal' }}>{x.t}</span>)}</span></a>)
              : <p className="small muted">Wszyscy na bieżąco.</p>}</Item>
          <Item className="card stack"><h3>Ostatnia aktywność</h3>
            {feed.length ? <div className="hist">{feed.map(({ c, s }) => <div key={c.id + s.id}><span><b>{c.name}</b> · {s.dayName}</span><span className="xs muted">{fmtDate(s.date)}</span><span className="xs muted">ocena {s.feeling}/5 · {s.entries.reduce((t, e) => t + e.sets.filter(x => x.done).length, 0)} serii{s.painNote ? ' · ból: ' + s.painNote : ''}</span><span>{s.prs && s.prs.length ? <span className="tag gold">{s.prs.length} PR</span> : null}</span></div>)}</div> : <p className="small muted">Jeszcze nikt nie zapisał treningu.</p>}</Item>
        </Stagger>
        <Stagger delay={.1}>
          <Item className="card stack"><h3>Regularność (ostatnie 4 tygodnie)</h3>
            {all.sort((a, b) => (b.s.adherence || 0) - (a.s.adherence || 0)).map(({ c, s }) => <a key={c.id} href={'#p-' + c.id} className="stack" style={{ gap: 4, textDecoration: 'none', color: 'var(--ink)' }}><div className="spread small"><span>{c.name}</span><span className="num">{s.adherence == null ? 'nowy' : s.adherence + '%'}</span></div><Bar value={s.adherence || 0} max={100} tone={(s.adherence || 0) >= 80 ? 'mint' : (s.adherence || 0) >= 50 ? '' : 'gold'} /></a>)}</Item>
          <Item className="card stack"><h3>Zaproś ludzi</h3><InviteBox /></Item>
        </Stagger>
      </div>}
    </Page>
  );
}

/* ================= PODOPIECZNI ================= */
export function Clients() {
  const ctx = useCoach();
  const { modal } = useUI();
  const [q, setQ] = useState(''), [scope, setScope] = useState('mine'), [sel, setSel] = useState(false), [picked, setPicked] = useState([]);
  if (!ctx.users) return <Page><div className="empty"><span className="typing"><span /><span /><span /></span></div></Page>;
  const list = ctx.clients.filter(c => (scope === 'all' || isMine(c, ctx.me)) && (!q || (c.name + ' ' + c.email).toLowerCase().includes(q.toLowerCase())));
  const chosen = list.filter(c => picked.includes(c.id));
  return (
    <Page>
      <div className="spread"><div><p className="eyebrow">Panel trenera</p><h1>Podopieczni</h1></div>
        <div className="row"><button className="btn" onClick={() => { setSel(!sel); setPicked([]); }}>{sel ? 'Anuluj zaznaczanie' : 'Zaznacz kilka'}</button><button className="btn pri" onClick={() => modal(c => <AddClientSheet close={c} />)}><UserPlus size={16} />Dodaj</button></div></div>
      <div className="card stack">
        <div style={{ position: 'relative' }}><Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} /><input id="cq" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Szukaj po imieniu lub e‑mailu" style={{ paddingLeft: 40 }} aria-label="Szukaj podopiecznego" /></div>
        <div className="spread"><Seg id="scope" value={scope} onChange={setScope} options={[['mine', 'Moi'], ['all', 'Wszyscy w bazie']]} />
          {sel && <div className="row"><button className="btn sm pri" disabled={!chosen.length} onClick={() => modal(c => <SendSheet users={chosen} close={c} />)}><Send size={14} />Wiadomość ({chosen.length})</button><button className="btn sm gold" disabled={!chosen.length} onClick={() => modal(c => <SendSheet users={chosen} preset="reward" close={c} />)}><Gift size={14} />Nagroda</button></div>}</div>
      </div>
      {!list.length && <div className="card empty"><Users size={32} /><span>Brak osób. Dodaj pierwszego podopiecznego.</span></div>}
      <Stagger className="clients">{list.map(c => <Item key={c.id} style={{ position: 'relative' }}>
        {sel && <input type="checkbox" className="pick" aria-label={'Zaznacz ' + c.name} checked={picked.includes(c.id)} onChange={() => setPicked(picked.includes(c.id) ? picked.filter(x => x !== c.id) : picked.concat(c.id))} />}
        <ClientCard c={c} /></Item>)}</Stagger>
    </Page>
  );
}

/* ================= KARTA PODOPIECZNEGO ================= */
function SessionsBars({ d }) {
  const weeks = Array.from({ length: 8 }, (_, i) => { const x = new Date(); x.setDate(x.getDate() - (7 - i) * 7); return PJ().weekKey(x); });
  const vals = weeks.map(k => (d.history || []).filter(s => PJ().weekKey(s.date) === k).length), need = Math.max(1, (d.trainDays || []).length);
  const W = 560, H = 150, pad = 26, max = Math.max(need, ...vals), bw = (W - pad) / 8, y = v => H - v / max * (H - 16);
  return <svg className="chart" viewBox={`0 0 ${W} ${H + 24}`} role="img" aria-label="Treningi tygodniowo na tle planu">
    {Array.from({ length: max + 1 }, (_, v) => <g key={v}><line x1={pad} x2={W} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--line)' }} /><text x="0" y={y(v) + 4}>{v}</text></g>)}
    <line x1={pad} x2={W} y1={y(need)} y2={y(need)} style={{ stroke: 'var(--gold)' }} strokeDasharray="5 4" strokeWidth="1.5" />
    {vals.map((v, i) => <g key={i}><motion.rect x={pad + i * bw + 6} width={bw - 12} rx="5" style={{ fill: v >= need ? 'var(--mint)' : 'var(--pink)' }} initial={{ y: H, height: 0 }} animate={{ y: y(v), height: H - y(v) }} transition={{ delay: i * .04 }} /><text x={pad + i * bw + bw / 2} y={H + 16} textAnchor="middle">{weeks[i].slice(8, 10)}.{weeks[i].slice(5, 7)}</text></g>)}
  </svg>;
}

export function ClientDetail() {
  const ctx = useCoach();
  const { modal, toast } = useUI();
  const id = (location.hash || '').slice(3);
  const [tab, setTab] = useState('przeglad'), [open, setOpen] = useState(null), [kg, setKg] = useState('');
  const c = ctx.clients.find(x => x.id === id);
  const [notes, setNotes] = useState(() => ((ctx.data.coachNotes || {})[id]) || '');
  const [pub, setPub] = useState('');
  useEffect(() => { if (c) setPub((c.coach || {}).note || ''); }, [c && c.id]);
  if (!ctx.users) return <Page><div className="empty"><span className="typing"><span /><span /><span /></span></div></Page>;
  if (!c) return <Page><div className="card empty"><b>Nie znaleziono podopiecznego</b><a className="btn" href="#podopieczni">Wróć do listy</a></div></Page>;
  const d = c.data, s = clientStats(d), al = alertsFor(c), lifts = liftProgress(d), rs = PJ().restrictions(d), coach = c.coach || {};
  const synced = c.offline || !coach.programV || (d.coachSeen || {}).programV === coach.programV;
  const assign = pr => assignPlan(ctx, c, pr, toast).then(ok => ok && ctx.reloadClients());
  const library = ctx.data.coachPlans || [];
  const fromLibrary = () => modal(close => <div className="stack"><h2>Plan z biblioteki</h2>{library.length ? library.map(pl => <button key={pl.id} className="treat" onClick={() => { close(); assign(pl); }}><span className="treat-ic"><NotebookPen size={18} /></span><span><b>{pl.name}</b><span className="xs muted">{pl.days.length} dni · {pl.days.reduce((t, x) => t + x.slots.length, 0)} ćwiczeń</span></span></button>) : <p className="muted">Biblioteka jest pusta. Utwórz plan w zakładce Plany.</p>}</div>);
  const tabs = [['przeglad', 'Przegląd'], ['plan', 'Plan'], ['historia', 'Historia'], ['ankieta', 'Ankieta'], ['notatki', 'Notatki']];
  return (
    <Page>
      <a href="#podopieczni" className="btn ghost sm" style={{ justifySelf: 'start' }}><ChevronLeft size={16} />Podopieczni</a>
      <div className="spread">
        <div className="row" style={{ flexWrap: 'nowrap' }}><span className="av lg">{initials(c.name)}</span><div><h1 style={{ fontSize: 'clamp(1.4rem,4vw,2rem)' }}>{c.name}</h1><p className="small muted">{c.offline ? 'bez konta' : c.email} · {LVL[d.level]} · cel: {GOALS[d.survey.goal]} · od {fmtDate(c.created_at || d.createdAt)}</p></div></div>
        <div className="row">
          {!c.offline && <button className="btn" onClick={() => modal(cl => <SendSheet users={[c]} close={cl} />)}><Send size={16} />Wiadomość</button>}
          {!c.offline && <button className="btn gold" onClick={() => modal(cl => <SendSheet users={[c]} preset="reward" close={cl} />)}><Gift size={16} />Nagroda</button>}
          <button className="btn pri" onClick={() => ctx.openEditor(toEditable(d.program || blankProgram(), d), { kind: 'client', id: c.id, name: c.name })}><NotebookPen size={16} />Rozpisz plan</button>
        </div>
      </div>
      {al.length > 0 && <div className="chips">{al.map(a => <span key={a.k} className={'tag ' + a.tone} style={{ whiteSpace: 'normal' }}>{a.t}</span>)}</div>}
      <Seg id="ctab" value={tab} onChange={setTab} options={tabs} />

      {tab === 'przeglad' && <>
        <Stagger className="tiles">
          {[['Treningi', s.total, ''], ['Ten tydzień', `${s.st.tr}/${s.st.need}`, 'treningi'], ['Regularność', s.adherence == null ? '—' : s.adherence + '%', '4 tygodnie'], ['Waga', comma(d.weight), s.dw ? `${s.dw > 0 ? '+' : ''}${comma(s.dw)} kg od startu` : 'kg'], ['Dieta', `${s.st.diet}/5`, 'dni w tym tyg.'], ['Poziom', s.lv.n, s.lv.name]].map(([n, v, sub]) => <Item key={n} className="tile"><span className="eyebrow">{n}</span><span className="v">{v}</span>{sub && <span className="xs muted">{sub}</span>}</Item>)}
        </Stagger>
        <div className="cols">
          <div className="stack">
            <div className="card stack"><h3>Treningi tygodniowo</h3><SessionsBars d={d} /><p className="xs muted">Złota linia = plan ({s.st.need} w tygodniu). Zielone słupki – plan wykonany.</p></div>
            <div className="card stack"><h3>Postęp w ćwiczeniach</h3>
              {lifts.length ? <div className="tablewrap"><table className="table"><thead><tr><th>Ćwiczenie</th><th>Start</th><th>Teraz</th><th>Zmiana</th></tr></thead><tbody>{lifts.map(l => { const ch = Math.round((l.last / l.first - 1) * 100); return <tr key={l.exId}><td>{PJ().BY[l.exId].n}<br /><span className="xs muted">{l.n} {l.n === 1 ? 'trening' : 'treningi'}</span></td><td className="num">{comma(Math.round(l.first))} kg</td><td className="num">{comma(Math.round(l.last))} kg</td><td><span className={'tag ' + (ch > 0 ? 'mint' : ch < 0 ? 'red' : '')}>{ch > 0 ? '+' : ''}{ch}%</span></td></tr>; })}</tbody></table></div>
                : <p className="small muted">Pojawi się po pierwszych treningach z ciężarem.</p>}
              <p className="xs muted">Szacowany ciężar maksymalny (wzór Epleya) z najlepszej serii.</p></div>
          </div>
          <div className="stack">
            <div className="card stack"><h3>Masa ciała</h3><LineChart pts={d.weights || []} />
              {c.offline && <div className="row"><input id="okg" type="number" step="0.1" value={kg} onChange={e => setKg(e.target.value)} placeholder="np. 84,5" style={{ maxWidth: 130 }} aria-label="Waga" /><button className="btn" onClick={() => { const v = parseFloat(String(kg).replace(',', '.')); if (!(v > 30 && v < 300)) return toast('Wpisz wagę w kg'); ctx.saveClient(c, { weight: { date: new Date().toISOString(), kg: v, xp: 0 } }); setKg(''); toast('Zapisano'); }}><Scale size={16} />Dodaj pomiar</button></div>}</div>
            <div className="card stack"><h3>Zdrowie</h3>
              <p className="small">Kontuzje: {d.survey.injuries.map(k => PJ().INJURIES[k].label).join(', ') || 'brak'}</p>
              <p className="small">Schorzenia: {d.survey.conditions.map(k => PJ().CONDITIONS[k].label).join(', ') || 'brak'}</p>
              <p className="small">Alergie: {d.survey.allergies.map(k => window.PJ_ALLERGENS[k]).join(', ') || 'brak'} · dieta: {d.survey.diet}</p>
              {rs.notes.map((n, i) => <div key={i} className="banner info"><div className="small">{n}</div></div>)}
              {s.pains.map((p, i) => <div key={i} className="banner bad"><div className="small"><b>{fmtDate(p.date)}</b>{p.note}</div></div>)}</div>
          </div>
        </div>
      </>}

      {tab === 'plan' && <div className="cols">
        <div className="card stack">
          <div className="spread"><h3>{d.program ? d.program.name : 'Brak planu'}</h3>{d.program && d.program.coach ? <span className="tag sky">od trenera</span> : d.program && d.program.ai ? <span className="tag pink">AI</span> : <span className="tag">algorytm</span>}</div>
          {!synced && <div className="banner info"><div>Nowy plan czeka na podopiecznego. Ustawi mu się, gdy otworzy aplikację.</div></div>}
          {(coach.program && !synced ? coach.program : d.program || { days: [] }).days.map((day, di) => <div key={di} className="stack" style={{ gap: 6 }}><p className="eyebrow">Dzień {day.key} · {day.name}</p>
            {day.slots.map((sl, si) => { const ex = PJ().BY[sl.exId], bad = ex && PJ().whyBlocked(ex, rs).length; return ex ? <div key={si} className="mini" style={{ cursor: 'default' }}><Anim id={ex.id} /><span><b>{ex.n}</b>{sl.rx ? <span className="small muted"> · {sl.rx.sets}×{sl.rx.repMin}–{sl.rx.repMax}{ex.u === 's' ? ' s' : ''} · {sl.rx.rest} s</span> : null}{bad ? <span className="tag red" style={{ marginLeft: 6 }}>niezalecane</span> : null}{sl.note ? <><br /><span className="xs muted">{sl.note}</span></> : null}</span></div> : null; })}</div>)}
        </div>
        <div className="stack">
          <div className="card stack"><h3>Zmień plan</h3>
            <button className="btn pri" style={{ justifyContent: 'flex-start' }} onClick={() => ctx.openEditor(toEditable(d.program || blankProgram(), d), { kind: 'client', id: c.id, name: c.name })}><NotebookPen size={16} />Rozpisz w kreatorze</button>
            <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={fromLibrary}><BookOpen size={16} />Z mojej biblioteki</button>
            <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => modal(cl => <AiPlanSheet p={d} close={cl} onApply={pr => assign(pr)} />)}><Sparkles size={16} />Ułóż z Trenerem AI</button>
            <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => assign(PJ().buildProgram(d, d.history, d.program))}><Dumbbell size={16} />Ułóż algorytmem</button>
            <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => d.program && copyText(planText(toEditable(d.program, d)), toast)}><Copy size={16} />Kopiuj plan jako tekst</button>
          </div>
          <div className="card stack"><h3>Ograniczenia z ankiety</h3><p className="small muted">Kreator oznaczy ćwiczenia niezalecane dla tej osoby. Możesz je mimo to dać – świadomie.</p>
            {Object.keys(rs.blocked).length ? <ul className="list small">{Object.entries(rs.blocked).map(([k, v]) => <li key={k}>{k}: {[...new Set(v)].join(', ')}</li>)}</ul> : <p className="small">Brak ograniczeń.</p>}</div>
        </div>
      </div>}

      {tab === 'historia' && <div className="card">
        {!(d.history || []).length && <div className="empty">Brak zapisanych treningów.</div>}
        <div className="hist">{(d.history || []).slice().reverse().map(h => <div key={h.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(open === h.id ? null : h.id)}>
          <b>{h.dayName}</b><span className="xs muted">{fmtDate(h.date)} · {h.durationMin} min</span>
          <span className="xs muted">ocena {h.feeling}/5 · {Math.round(PJ().volume(h))} kg{h.painNote ? ' · ból: ' + h.painNote : ''}</span><span>{h.prs && h.prs.length ? <span className="tag gold">{h.prs.length} PR</span> : null}</span>
          <AnimatePresence>{open === h.id && <motion.div style={{ gridColumn: '1 / -1', overflow: 'hidden' }} initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
            <div className="stack" style={{ gap: 4, paddingTop: 8 }}>{h.entries.map((e, i) => <div key={i} className="spread small"><span>{PJ().BY[e.exId] ? PJ().BY[e.exId].n : e.exId}</span><span className="num muted">{e.sets.filter(x => x.done).map(x => (x.w ? comma(x.w) + '×' : '') + x.r).join('  ')}</span></div>)}</div>
          </motion.div>}</AnimatePresence>
        </div>)}</div>
      </div>}

      {tab === 'ankieta' && <div className="stack">
        {!c.offline && <div className="banner info"><div>Zmiany trafią do podopiecznego przy następnym otwarciu aplikacji. Jego plan od trenera zostaje bez zmian.</div></div>}
        <SurveyForm p={d} idp="cs" submitLabel="Zapisz ankietę podopiecznego" onSave={async f => {
          try {
            await ctx.saveClient(c, { profile: { name: f.name, sex: f.sex, age: +f.age, height: +f.height, weight: +f.weight, level: f.level, trainDays: f.trainDays, sessionMin: +f.sessionMin, equipPreset: f.equipPreset, equipment: f.equipment, survey: f.survey } });
            toast('Zapisano ankietę: ' + c.name); setTab('przeglad');
          } catch (e) { toast(e.message); }
        }} />
      </div>}

      {tab === 'notatki' && <div className="cols">
        <div className="card stack"><h3>Prywatne notatki</h3><p className="xs muted">Widzisz je tylko Ty.</p>
          <textarea id="cnotes" value={notes} onChange={e => setNotes(e.target.value)} style={{ minHeight: 180, fontFamily: 'var(--body)' }} placeholder="np. lewy bark – unikać wyciskania nad głowę, cel: 10 kg w 3 miesiące" />
          <button className="btn pri" onClick={() => { ctx.update(x => { x.coachNotes = Object.assign({}, x.coachNotes, { [c.id]: notes }); }); toast('Zapisano notatki'); }}><Check size={16} />Zapisz</button></div>
        {!c.offline && <div className="card stack"><h3>Uwaga dla podopiecznego</h3><p className="xs muted">Widzi ją na ekranie Dziś, nad treningiem.</p>
          <textarea id="cpub" value={pub} onChange={e => setPub(e.target.value)} style={{ fontFamily: 'var(--body)' }} placeholder="np. W tym tygodniu skup się na technice przysiadu, ciężar bez zmian." />
          <div className="row"><button className="btn pri" onClick={() => ctx.saveClient(c, { note: pub.trim() }).then(() => toast('Uwaga wysłana'), e => toast(e.message))}><Send size={16} />Ustaw</button>{pub && <button className="btn" onClick={() => { setPub(''); ctx.saveClient(c, { note: '' }).then(() => toast('Usunięto'), e => toast(e.message)); }}>Usuń uwagę</button>}</div></div>}
        <div className="card stack"><h3>Zarządzanie</h3>
          {!c.offline && c.coach_id !== ctx.me.id && <button className="btn" onClick={() => api.assign(c.id, ctx.me.id).then(() => { toast('Przypisano do Ciebie'); ctx.reloadClients(); }, e => toast(e.message))}><UserPlus size={16} />Przypisz do mnie</button>}
          {!c.offline && <button className="btn" onClick={() => api.setRole(c.id, c.role === 'admin' ? 'user' : 'admin').then(() => { toast('Zmieniono rolę'); ctx.reloadClients(); }, e => toast(e.message))}><Shield size={16} />{c.role === 'admin' ? 'Odbierz rolę trenera' : 'Nadaj rolę trenera'}</button>}
          {c.offline && <button className="btn danger" onClick={() => modal(cl => <div className="stack"><h2>Usunąć {c.name}?</h2><p>Znikną plan, pomiary i notatki tej osoby.</p><div className="row"><button className="btn danger" onClick={() => { ctx.update(x => { x.clients = (x.clients || []).filter(k => k.id !== c.id); }); cl(); location.hash = '#podopieczni'; }}>Usuń</button><button className="btn" onClick={cl}>Anuluj</button></div></div>)}><Trash2 size={16} />Usuń podopiecznego</button>}
        </div>
      </div>}
    </Page>
  );
}

/* ================= PLANY (biblioteka) ================= */
function AssignSheet({ program, close }) {
  const ctx = useCoach();
  const { toast } = useUI();
  const [picked, setPicked] = useState([]), [busy, setBusy] = useState(false);
  const list = ctx.clients.filter(c => isMine(c, ctx.me));
  const go = async () => { setBusy(true); for (const c of list.filter(x => picked.includes(x.id))) await assignPlan(ctx, c, program, toast); setBusy(false); ctx.reloadClients(); close(); };
  return (
    <div className="stack">
      <p className="eyebrow">Przypisz plan</p><h2>{program.name}</h2>
      {!list.length && <p className="muted">Nie masz jeszcze podopiecznych.</p>}
      <div className="stack" style={{ gap: 6 }}>{list.map(c => { const bad = program.days.flatMap(d => d.slots).filter(sl => PJ().BY[sl.exId] && PJ().whyBlocked(PJ().BY[sl.exId], PJ().restrictions(c.data)).length).length; return (
        <label key={c.id} className="check card tight"><input type="checkbox" checked={picked.includes(c.id)} onChange={() => setPicked(picked.includes(c.id) ? picked.filter(x => x !== c.id) : picked.concat(c.id))} /><span><b>{c.name}</b> {c.offline && <span className="tag">bez konta</span>}{bad > 0 && <span className="tag red" style={{ marginLeft: 6 }}>{bad} niezalecane ćw.</span>}</span></label>); })}</div>
      <button className="btn pri big" disabled={!picked.length || busy} onClick={go}><Check size={18} />{busy ? 'Wysyłam…' : `Przypisz (${picked.length})`}</button>
    </div>
  );
}

function NewPlanSheet({ close }) {
  const ctx = useApp();
  const { modal } = useUI();
  const tpl = (tid, level, days) => { const d = normalize(blankData({ level, trainDays: days }), 'tpl', 'Szablon'); return toEditable(PJ().buildProgram(d, []), d); };
  const opts = [
    ['Pusty plan', 'Rozpisujesz wszystko od zera', () => blankProgram()],
    ['Full Body 3× – początkujący', 'Szablon A/B jak StrongLifts / GZCLP', () => tpl('fb3', 'beginner', [1, 3, 5])],
    ['Góra/Dół 4× – średni', 'Szablon PHUL', () => tpl('ul4', 'intermediate', [1, 2, 4, 5])],
    ['Push/Pull/Legs 6× – zaawansowany', 'Szablon PPL', () => tpl('ppl', 'advanced', [1, 2, 3, 4, 5, 6])]
  ];
  return (
    <div className="stack">
      <h2>Nowy plan</h2>
      {opts.map(([n, s, f]) => <button key={n} className="treat" onClick={() => { close(); ctx.openEditor(f(), { kind: 'library' }); }}><span className="treat-ic"><NotebookPen size={18} /></span><span><b>{n}</b><span className="xs muted">{s}</span></span></button>)}
      <button className="treat" onClick={() => { close(); modal(c => <AiPlanSheet p={ctx.data} close={c} onApply={pr => ctx.openEditor(toEditable(pr, ctx.data), { kind: 'library' })} />); }}><span className="treat-ic"><Sparkles size={18} /></span><span><b>Z Trenerem AI</b><span className="xs muted">Opisz, czego chcesz, a potem popraw w kreatorze</span></span></button>
    </div>
  );
}

export function Plans() {
  const ctx = useCoach();
  const { modal, toast } = useUI();
  const lib = ctx.data.coachPlans || [];
  return (
    <Page>
      <div className="spread"><div><p className="eyebrow">Panel trenera</p><h1>Plany treningowe</h1></div><button className="btn pri" onClick={() => modal(c => <NewPlanSheet close={c} />)}><Plus size={16} />Nowy plan</button></div>
      <p className="muted">Twoja biblioteka planów. Rozpisz plan raz i przypisuj go wielu podopiecznym – każdy dostanie własną kopię z automatyczną progresją ciężarów.</p>
      {!lib.length && <div className="card empty"><NotebookPen size={34} /><b>Biblioteka jest pusta</b><span className="small">Zacznij od szablonu albo od pustej kartki.</span><button className="btn pri" onClick={() => modal(c => <NewPlanSheet close={c} />)}><Plus size={16} />Nowy plan</button></div>}
      <Stagger className="clients">{lib.map(pl => (
        <Item key={pl.id} className="card stack">
          <div className="spread"><h3>{pl.name}</h3><span className="tag">{pl.days.length} dni</span></div>
          {pl.basis && <p className="small muted">{pl.basis}</p>}
          <div className="stack" style={{ gap: 2 }}>{pl.days.map(d => <p key={d.key} className="xs muted"><b style={{ color: 'var(--ink)' }}>{d.name}:</b> {d.slots.map(s => PJ().BY[s.exId] ? PJ().BY[s.exId].n : '').join(' · ') || '—'}</p>)}</div>
          <div className="row">
            <button className="btn sm pri" onClick={() => ctx.openEditor(pl, { kind: 'library', id: pl.id })}><NotebookPen size={14} />Edytuj</button>
            <button className="btn sm" onClick={() => modal(c => <AssignSheet program={pl} close={c} />)}><Users size={14} />Przypisz</button>
            <button className="btn sm" onClick={() => { ctx.update(x => { x.coachPlans = (x.coachPlans || []).concat({ ...structuredClone(pl), id: 'pl' + Date.now().toString(36), name: pl.name + ' (kopia)' }); }); toast('Zduplikowano'); }}><CopyPlus size={14} />Duplikuj</button>
            <button className="btn sm" onClick={() => copyText(planText(pl), toast)}><Copy size={14} />Tekst</button>
            <button className="btn sm danger" onClick={() => modal(c => <div className="stack"><h2>Usunąć „{pl.name}”?</h2><p>Podopieczni, którzy już mają ten plan, zachowają swoją kopię.</p><div className="row"><button className="btn danger" onClick={() => { ctx.update(x => { x.coachPlans = (x.coachPlans || []).filter(k => k.id !== pl.id); }); c(); }}>Usuń</button><button className="btn" onClick={c}>Anuluj</button></div></div>)}><Trash2 size={14} /></button>
          </div>
        </Item>))}</Stagger>
    </Page>
  );
}

/* ================= KREATOR PLANU ================= */
const GROUPS = { all: ['Wszystkie', null], nogi: ['Nogi', ['squat', 'lunge', 'hinge', 'legiso', 'calves']], klatka: ['Klatka', ['hpush', 'chestiso']], plecy: ['Plecy', ['vpull', 'hpull', 'traps']], barki: ['Barki', ['vpush', 'shoulderiso']], rece: ['Ręce', ['biceps', 'triceps']], core: ['Brzuch', ['core']], cardio: ['Cardio', ['cardio', 'full', 'plyo']], mob: ['Mobilność', ['mobility', 'stretch']] };
const MAIN = ['squat', 'hinge', 'hpush', 'vpush', 'vpull', 'hpull', 'lunge', 'full'];
export function defaultSlot(ex, first) {
  const r = ex.p === 'core' ? 'core' : MAIN.includes(ex.p) ? (first ? 'main' : 'sec') : 'acc';
  let rx = r === 'main' ? { sets: 3, repMin: 6, repMax: 10, rest: 150, rpe: 8 } : r === 'sec' ? { sets: 3, repMin: 8, repMax: 12, rest: 90, rpe: 8 } : r === 'core' ? { sets: 3, repMin: 12, repMax: 15, rest: 45, rpe: 7 } : { sets: 3, repMin: 10, repMax: 15, rest: 60, rpe: 8 };
  if (ex.u === 's') rx = { sets: 3, repMin: 30, repMax: 45, rest: 45, rpe: 7 };
  if (ex.u === 'min') rx = { sets: 1, repMin: 10, repMax: 20, rest: 30, rpe: 6 };
  return { p: ex.p, r, v: 0, exId: ex.id, rx, note: '' };
}

function PickerSheet({ onPick, close, client }) {
  const { modal } = useUI();
  const [g, setG] = useState('all'), [q, setQ] = useState('');
  const rs = client ? PJ().restrictions(client) : null;
  const list = PJ().EX.filter(e => (!GROUPS[g][1] || GROUPS[g][1].includes(e.p)) && (!q || (e.n + ' ' + e.en + ' ' + e.m.join(' ')).toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="stack">
      <h2>Dodaj ćwiczenie</h2>
      <input id="pq" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Szukaj: przysiad, plecy, hantle…" aria-label="Szukaj ćwiczenia" />
      <div className="chips">{Object.entries(GROUPS).map(([k, [n]]) => <button key={k} className="chip" aria-pressed={g === k} onClick={() => setG(k)}>{n}</button>)}</div>
      <div className="lib">{list.map(e => { const bad = rs && PJ().whyBlocked(e, rs).length; return (
        <button key={e.id} className="lc" onClick={() => { onPick(e); close(); }}><Anim id={e.id} /><span className="b2"><b>{e.n}</b><span className="xs muted">{e.m.join(', ')} · {PJ().EQUIP[e.eq]}</span>{bad ? <span className="tag red">niezalecane dla {client.name.split(' ')[0]}</span> : null}</span></button>); })}</div>
    </div>
  );
}

export function Editor() {
  const ctx = useCoach();
  const { modal, toast } = useUI();
  const ed = ctx.editor;
  const [pr, setPr] = useState(() => ed ? structuredClone(ed.program) : null);
  const [di, setDi] = useState(0), [alsoLib, setAlsoLib] = useState(false);
  if (!ed || !pr) return <Page><div className="card empty"><NotebookPen size={32} /><b>Nic nie edytujesz</b><a className="btn pri" href="#plany">Przejdź do planów</a></div></Page>;
  const client = ed.target.kind === 'client' ? ctx.clients.find(c => c.id === ed.target.id) : null;
  const rs = client ? PJ().restrictions(client.data) : null;
  const day = pr.days[Math.min(di, pr.days.length - 1)];
  const mut = fn => setPr(o => { const x = structuredClone(o); fn(x); return x; });
  const setRx = (si, k, v) => mut(x => { x.days[di].slots[si].rx[k] = v === '' ? '' : +v; });
  const move = (si, dir) => mut(x => { const s = x.days[di].slots, j = si + dir; if (j < 0 || j >= s.length) return; [s[si], s[j]] = [s[j], s[si]]; });
  const addDay = () => { const k = 'ABCDEFG'[pr.days.length] || String(pr.days.length + 1); mut(x => { x.days.push({ key: k, name: 'Dzień ' + k, type: 'base', slots: [] }); }); setDi(pr.days.length); };
  const valid = pr.days.length && pr.days.every(d => d.slots.length);
  const finish = async () => {
    if (!pr.name.trim()) return toast('Nazwij plan');
    if (!valid) return toast('Każdy dzień musi mieć co najmniej jedno ćwiczenie');
    const clean = structuredClone(pr); clean.coach = true; clean.days.forEach(d => d.slots.forEach(s => { Object.keys(s.rx).forEach(k => { s.rx[k] = +s.rx[k] || 0; }); if (s.rx.repMax < s.rx.repMin) s.rx.repMax = s.rx.repMin; }));
    if (ed.target.kind === 'library' || alsoLib) {
      ctx.update(x => {
        x.coachPlans = x.coachPlans || [];
        const i = ed.target.kind === 'library' && ed.target.id ? x.coachPlans.findIndex(p => p.id === ed.target.id) : -1;
        const item = { ...clean, id: i >= 0 ? ed.target.id : 'pl' + Date.now().toString(36), updatedAt: new Date().toISOString() };
        if (i >= 0) x.coachPlans[i] = item; else x.coachPlans.push(item);
      });
    }
    if (client) { const ok = await assignPlan(ctx, client, clean, toast); if (!ok) return; ctx.reloadClients(); ctx.setEditor(null); location.hash = '#p-' + client.id; }
    else { toast('Zapisano w bibliotece'); ctx.setEditor(null); location.hash = '#plany'; }
  };
  const rests = [30, 45, 60, 75, 90, 120, 150, 180, 240];
  return (
    <Page>
      <div className="spread"><div><p className="eyebrow">Kreator planu {client ? '· dla ' + client.name : '· biblioteka'}</p><h1>{pr.name || 'Bez nazwy'}</h1></div>
        <div className="row"><button className="btn" onClick={() => { ctx.setEditor(null); history.back(); }}>Anuluj</button><button className="btn pri" onClick={finish}><Check size={16} />{client ? `Zapisz i ustaw u ${client.name.split(' ')[0]}` : 'Zapisz w bibliotece'}</button></div></div>
      <div className="card stack">
        <div className="grid2"><label className="f">Nazwa planu<input id="ed-name" type="text" value={pr.name} onChange={e => mut(x => { x.name = e.target.value; })} /></label></div>
        <label className="f">Opis dla podopiecznego (widzi go w zakładce Plan)<textarea id="ed-basis" value={pr.basis || ''} onChange={e => mut(x => { x.basis = e.target.value; })} placeholder="np. 3 treningi całego ciała w tygodniu. Pierwsze 2 tygodnie lekko – technika przed ciężarem." style={{ fontFamily: 'var(--body)', minHeight: 70 }} /></label>
        {client && <label className="check"><input type="checkbox" checked={alsoLib} onChange={e => setAlsoLib(e.target.checked)} />Zapisz też kopię w mojej bibliotece</label>}
      </div>
      <div className="row">
        {pr.days.map((d, i) => <motion.button key={i} whileTap={{ scale: .95 }} className="chip" aria-pressed={i === di} onClick={() => setDi(i)}>{d.name} <span className="faint">· {d.slots.length}</span></motion.button>)}
        <button className="chip" onClick={addDay}><Plus size={14} style={{ verticalAlign: -2 }} /> Dzień</button>
      </div>
      <div className="card stack">
        <div className="spread"><label className="f" style={{ flex: 1, minWidth: 200 }}>Nazwa dnia<input id="ed-day" type="text" value={day.name} onChange={e => mut(x => { x.days[di].name = e.target.value; })} /></label>
          <div className="row" style={{ alignSelf: 'end' }}>
            <button className="btn sm" onClick={() => { mut(x => { const c = structuredClone(x.days[di]); c.key = 'ABCDEFG'[x.days.length] || String(x.days.length + 1); c.name = c.name + ' (kopia)'; x.days.push(c); }); setDi(pr.days.length); }}><CopyPlus size={14} />Duplikuj dzień</button>
            {pr.days.length > 1 && <button className="btn sm danger" onClick={() => { mut(x => { x.days.splice(di, 1); }); setDi(Math.max(0, di - 1)); }}><Trash2 size={14} />Usuń dzień</button>}
          </div></div>
        {!day.slots.length && <div className="empty"><Dumbbell size={28} /><span>Dodaj pierwsze ćwiczenie tego dnia.</span></div>}
        <AnimatePresence initial={false}>{day.slots.map((sl, si) => {
          const ex = PJ().BY[sl.exId]; if (!ex) return null;
          const why = rs ? PJ().whyBlocked(ex, rs) : [];
          const lab = ex.u === 's' ? 'Sekundy' : ex.u === 'min' ? 'Minuty' : 'Powtórzenia';
          return <motion.div key={sl.exId + si} layout className="slot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button className="slot-img" onClick={() => modal(c => <ExerciseSheet id={ex.id} p={client ? client.data : ctx.data} close={c} />)} aria-label={'Szczegóły: ' + ex.n}><Anim id={ex.id} /></button>
            <div className="stack" style={{ gap: 8, minWidth: 0 }}>
              <div className="spread" style={{ gap: 6 }}><b>{si + 1}. {ex.n}</b>
                <div className="row" style={{ gap: 2 }}>
                  <button className="iconbtn sm" onClick={() => move(si, -1)} aria-label="W górę" disabled={si === 0}><ArrowUp size={15} /></button>
                  <button className="iconbtn sm" onClick={() => move(si, 1)} aria-label="W dół" disabled={si === day.slots.length - 1}><ArrowDown size={15} /></button>
                  <button className="iconbtn sm" onClick={() => mut(x => { x.days[di].slots.splice(si, 1); })} aria-label="Usuń ćwiczenie"><Trash2 size={15} /></button>
                </div></div>
              {why.length > 0 && <span className="tag red" style={{ whiteSpace: 'normal', justifySelf: 'start' }}><AlertTriangle size={12} />Niezalecane: {why.join('; ')}</span>}
              <div className="fields">
                <label className="f">Serie<input id={`ed-${di}-${si}-s`} type="number" min="1" max="10" value={sl.rx.sets} onChange={e => setRx(si, 'sets', e.target.value)} /></label>
                <label className="f">{lab} od<input id={`ed-${di}-${si}-a`} type="number" min="1" value={sl.rx.repMin} onChange={e => setRx(si, 'repMin', e.target.value)} /></label>
                <label className="f">do<input id={`ed-${di}-${si}-b`} type="number" min="1" value={sl.rx.repMax} onChange={e => setRx(si, 'repMax', e.target.value)} /></label>
                <label className="f">Przerwa<select id={`ed-${di}-${si}-r`} value={sl.rx.rest} onChange={e => setRx(si, 'rest', e.target.value)}>{rests.map(r => <option key={r} value={r}>{r >= 60 ? (r % 60 ? `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}` : r / 60 + ' min') : r + ' s'}</option>)}</select></label>
                <label className="f">RPE<select id={`ed-${di}-${si}-p`} value={sl.rx.rpe} onChange={e => setRx(si, 'rpe', e.target.value)}>{[5, 6, 7, 7.5, 8, 8.5, 9, 10].map(r => <option key={r} value={r}>{comma(r)}</option>)}</select></label>
              </div>
              <input id={`ed-${di}-${si}-n`} type="text" value={sl.note} onChange={e => mut(x => { x.days[di].slots[si].note = e.target.value; })} placeholder="Wskazówka dla podopiecznego, np. tempo 3-1-1, kolana na zewnątrz" aria-label="Wskazówka" />
            </div>
          </motion.div>;
        })}</AnimatePresence>
        <button className="btn" onClick={() => modal(c => <PickerSheet client={client ? client.data : null} close={c} onPick={ex => mut(x => { x.days[di].slots.push(defaultSlot(ex, x.days[di].slots.length === 0)); })} />)}><Plus size={16} />Dodaj ćwiczenie</button>
      </div>
      <p className="xs muted">RPE = jak ciężko: 10 to seria do upadku, 8 to 2 powtórzenia w zapasie. Ciężary wpisuje podopieczny – aplikacja sama podnosi je, gdy zrobi górny zakres powtórzeń.</p>
      <div className="row"><button className="btn pri big" onClick={finish}><Check size={18} />{client ? `Zapisz i ustaw u ${client.name.split(' ')[0]}` : 'Zapisz w bibliotece'}</button></div>
    </Page>
  );
}
