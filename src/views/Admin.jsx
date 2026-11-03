import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserCheck, Dumbbell, TrendingUp, Wallet, Clock, Search, Download, RefreshCw, Shield, Activity, Sparkles } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useUI, Page, Seg, fmtDate, ymd } from '../components/ui.jsx';
import { api, MODE, PRICES, access, isTrainer } from '../lib/backend.js';
const PJ = () => window.PJ;
const DAY = 864e5;
const fmt = n => new Intl.NumberFormat('pl-PL').format(Math.round(n));
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
const lastSeen = u => {
  const h = (u.data && u.data.history) || [];
  const t = [u.updated_at, h.length && h[h.length - 1].date, u.created_at].filter(Boolean).map(d => new Date(d).getTime());
  return t.length ? Math.max(...t) : 0;
};
const STATE = { owner: ['Admin', ''], comp: ['Darmowy', 'sky'], active: ['Płaci', 'mint'], covered: ['U trenera', 'mint'], trial: ['Próbny', 'gold'], expired: ['Po próbnym', 'red'] };

function useUsers() {
  const ctx = useApp();
  useEffect(() => { if (!ctx.users) ctx.reloadClients(); }, []);
  return ctx;
}

// słupki tygodniowe (12 tygodni)
function WeekBars({ series, label, tone = 'var(--pink)' }) {
  const W = 560, H = 150, pad = 26, max = Math.max(4, Math.ceil(Math.max(...series.map(s => s.v)) / 4) * 4), bw = (W - pad) / series.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label={label}>
      {[0, .5, 1].map(f => <g key={f}><line x1={pad} x2={W} y1={H - f * (H - 14)} y2={H - f * (H - 14)} style={{ stroke: 'var(--line)' }} /><text x="0" y={H - f * (H - 14) + 4}>{Math.round(max * f)}</text></g>)}
      {series.map((s, i) => <g key={i}>
        <motion.rect x={pad + i * bw + 4} width={bw - 8} rx="3" style={{ fill: i === series.length - 1 ? tone : `color-mix(in srgb, ${tone} 40%, var(--raised))` }}
          initial={{ y: H, height: 0 }} animate={{ y: H - s.v / max * (H - 14), height: s.v / max * (H - 14) }} transition={{ delay: i * .03, duration: .5 }}><title>{s.l}: {s.v}</title></motion.rect>
        {i % 2 === series.length % 2 && <text x={pad + i * bw + bw / 2} y={H + 16} textAnchor="middle">{s.l}</text>}
      </g>)}
    </svg>
  );
}

function weeks(n = 12) {
  const out = [], now = new Date(); now.setHours(0, 0, 0, 0);
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  for (let i = n - 1; i >= 0; i--) { const a = new Date(mon); a.setDate(mon.getDate() - 7 * i); const b = new Date(a); b.setDate(a.getDate() + 7); out.push({ a: a.getTime(), b: b.getTime(), l: a.toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric' }) }); }
  return out;
}

function stats(all) {
  const now = Date.now(), W = weeks();
  const people = all.filter(u => u.role !== 'admin');
  const sessions = all.flatMap(u => ((u.data && u.data.history) || []).map(s => ({ u, s, t: new Date(s.date).getTime() })));
  const active7 = new Set(sessions.filter(x => x.t > now - 7 * DAY).map(x => x.u.id)).size;
  const active30 = new Set(sessions.filter(x => x.t > now - 30 * DAY).map(x => x.u.id)).size;
  const st = people.map(u => access(u).state);
  const count = k => st.filter(x => x === k).length;
  const trainers = people.filter(isTrainer), solo = people.filter(u => !isTrainer(u) && !u.coach_id), clients = people.filter(u => !isTrainer(u) && u.coach_id);
  const paying = people.filter(u => access(u).state === 'active');
  const mrr = paying.reduce((t, u) => t + (isTrainer(u) ? PRICES.trainer + Math.max(0, all.filter(c => c.coach_id === u.id).length - PRICES.trainerSeats) * PRICES.extraSeat : PRICES.user), 0);
  const potential = solo.length * PRICES.user + trainers.reduce((t, u) => t + PRICES.trainer + Math.max(0, all.filter(c => c.coach_id === u.id).length - PRICES.trainerSeats) * PRICES.extraSeat, 0);
  const signups = W.map(w => ({ l: w.l, v: all.filter(u => { const t = new Date(u.created_at).getTime(); return t >= w.a && t < w.b; }).length }));
  const trainingsW = W.map(w => ({ l: w.l, v: sessions.filter(x => x.t >= w.a && x.t < w.b).length }));
  const activeW = W.map(w => ({ l: w.l, v: new Set(sessions.filter(x => x.t >= w.a && x.t < w.b).map(x => x.u.id)).size }));
  const onboarded = people.filter(u => u.data && u.data.surveyDone).length;
  const trained = people.filter(u => ((u.data && u.data.history) || []).length > 0).length;
  const regular = people.filter(u => ((u.data && u.data.history) || []).length >= 6).length;
  const exCount = {}; sessions.forEach(x => (x.s.entries || []).forEach(e => { exCount[e.exId] = (exCount[e.exId] || 0) + 1; }));
  const topEx = Object.entries(exCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const goals = {}; people.forEach(u => { const g = (u.data && u.data.survey && u.data.survey.goal) || 'brak'; goals[g] = (goals[g] || 0) + 1; });
  const aiUsers = people.filter(u => (u.data && u.data.coach || []).length > 0).length;
  return { people, total: people.length, new7: people.filter(u => new Date(u.created_at).getTime() > now - 7 * DAY).length, active7, active30, sessions: sessions.length, sess7: sessions.filter(x => x.t > now - 7 * DAY).length,
    trainers: trainers.length, solo: solo.length, clients: clients.length, trial: count('trial'), expired: count('expired'), paying: paying.length, comp: count('comp'), covered: count('covered'), mrr, potential,
    signups, trainingsW, activeW, onboarded, trained, regular, topEx, goals, aiUsers };
}

export function AdminAnalytics() {
  const ctx = useUsers();
  if (!ctx.users) return <Page><div className="empty"><span className="typing"><span /><span /><span /></span></div></Page>;
  const all = ctx.users.filter(u => u.id !== ctx.me.id).concat(ctx.users.filter(u => u.id === ctx.me.id));
  const s = stats(all);
  const KPI = [[Users, 'Użytkownicy', fmt(s.total), `+${s.new7} w 7 dni`], [UserCheck, 'Aktywni (7 dni)', fmt(s.active7), `${pct(s.active7, s.total)} wszystkich · 30 dni: ${s.active30}`], [Dumbbell, 'Treningi (7 dni)', fmt(s.sess7), `łącznie ${fmt(s.sessions)}`],
    [Wallet, 'Przychód / mies.', fmt(s.mrr) + ' zł', `potencjał: ${fmt(s.potential)} zł`], [Clock, 'Okres próbny', fmt(s.trial), `po próbnym: ${s.expired}`], [Shield, 'Trenerzy', fmt(s.trainers), `podopieczni: ${s.clients} · solo: ${s.solo}`]];
  const funnel = [['Rejestracja', s.total], ['Wypełniony wywiad', s.onboarded], ['Pierwszy trening', s.trained], ['6+ treningów', s.regular], ['Płacący', s.paying]];
  return (
    <Page>
      <div className="spread"><div><p className="eyebrow">Administracja</p><h1>Analityka</h1></div>
        <div className="row"><span className="xs muted">Dane na {new Date().toLocaleString('pl-PL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span><button className="btn sm" onClick={ctx.reloadClients}><RefreshCw size={14} />Odśwież</button></div></div>
      {MODE === 'local' && <div className="banner info"><div><b>Tryb lokalny</b>Liczby z kont w tej przeglądarce. Na stronie z bazą zobaczysz wszystkich.</div></div>}
      <div className="kpis">{KPI.map(([I, n, v, sub]) => <div key={n} className="kpi"><span className="k-l"><I size={14} />{n}</span><span className="k-v num">{v}</span><span className="k-s">{sub}</span></div>)}</div>
      <div className="cols">
        <div className="card stack"><div className="spread"><h3>Nowe konta</h3><span className="xs muted">tygodniowo, 12 tyg.</span></div><WeekBars series={s.signups} label="Nowe konta tygodniowo" /></div>
        <div className="card stack"><div className="spread"><h3>Aktywni użytkownicy</h3><span className="xs muted">min. 1 trening w tygodniu</span></div><WeekBars series={s.activeW} label="Aktywni tygodniowo" tone="var(--mint)" /></div>
      </div>
      <div className="cols">
        <div className="card stack"><div className="spread"><h3>Zapisane treningi</h3><span className="xs muted">tygodniowo</span></div><WeekBars series={s.trainingsW} label="Treningi tygodniowo" tone="var(--sky)" /></div>
        <div className="card stack"><h3>Lejek</h3>
          {funnel.map(([n, v], i) => <div key={n} className="funnel"><div className="spread small"><span>{n}</span><span className="num">{v} <span className="muted">{i ? pct(v, s.total) : ''}</span></span></div><div className="fbar"><motion.i initial={{ width: 0 }} animate={{ width: (s.total ? v / s.total * 100 : 0) + '%' }} transition={{ delay: i * .08 }} /></div></div>)}
        </div>
      </div>
      <div className="cols">
        <div className="card stack"><h3>Abonamenty</h3>
          <table className="table"><tbody>
            {[['Płacący', s.paying], ['Okres próbny', s.trial], ['Po okresie próbnym', s.expired], ['U trenera (za darmo)', s.covered], ['Darmowy dostęp', s.comp]].map(([n, v]) => <tr key={n}><td>{n}</td><td className="num" style={{ textAlign: 'right' }}>{v}</td></tr>)}
          </tbody></table>
          <p className="xs muted">Płatności nie są jeszcze podłączone – „płacący” to konta oznaczone ręcznie lub przez przyszłe płatności.</p></div>
        <div className="card stack"><h3>Cele i ćwiczenia</h3>
          <div className="chips">{Object.entries(s.goals).sort((a, b) => b[1] - a[1]).map(([g, n]) => <span key={g} className="tag">{g}: {n}</span>)}</div>
          <table className="table"><tbody>{s.topEx.length ? s.topEx.map(([id, n]) => <tr key={id}><td>{PJ().BY[id] ? PJ().BY[id].n : id}</td><td className="num" style={{ textAlign: 'right' }}>{n}×</td></tr>) : <tr><td className="muted">Brak treningów</td></tr>}</tbody></table>
          <p className="xs muted"><Sparkles size={12} style={{ verticalAlign: '-2px' }} /> Z Trenera AI korzysta {s.aiUsers} z {s.total} osób.</p></div>
      </div>
    </Page>
  );
}

export function AdminUsers() {
  const ctx = useUsers();
  const { toast } = useUI();
  const [q, setQ] = useState(''), [f, setF] = useState('all'), [sort, setSort] = useState('new');
  if (!ctx.users) return <Page><div className="empty"><span className="typing"><span /><span /><span /></span></div></Page>;
  const byId = Object.fromEntries(ctx.users.map(u => [u.id, u]));
  let list = ctx.users.filter(u => (!q || (u.name + ' ' + u.email).toLowerCase().includes(q.toLowerCase())));
  if (f === 'trainers') list = list.filter(isTrainer); else if (f === 'users') list = list.filter(u => !isTrainer(u)); else if (f === 'trial') list = list.filter(u => access(u).state === 'trial'); else if (f === 'inactive') list = list.filter(u => lastSeen(u) < Date.now() - 14 * DAY);
  list = list.slice().sort((a, b) => sort === 'new' ? new Date(b.created_at) - new Date(a.created_at) : sort === 'active' ? lastSeen(b) - lastSeen(a) : ((b.data.history || []).length - (a.data.history || []).length));
  const csv = () => {
    const rows = [['imie', 'email', 'rola', 'abonament', 'trener', 'treningi', 'zalozone', 'ostatnio']].concat(ctx.users.map(u => [u.name, u.email, u.role, access(u).state, (byId[u.coach_id] || {}).name || '', (u.data.history || []).length, ymd(u.created_at), lastSeen(u) ? ymd(lastSeen(u)) : '']));
    const blob = new Blob(['﻿' + rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pompujto-uzytkownicy.csv'; document.body.appendChild(a); a.click(); a.remove();
  };
  const role = (u, r) => api.setRole(u.id, r).then(() => { toast('Zmieniono rolę: ' + u.name); ctx.reloadClients(); }, e => toast(e.message));
  const comp = (u, v) => api.setBilling(u.id, { comp: v }).then(() => { toast(v ? 'Darmowy dostęp: ' + u.name : 'Wyłączono darmowy dostęp'); ctx.reloadClients(); }, e => toast(e.message));
  return (
    <Page>
      <div className="spread"><div><p className="eyebrow">Administracja</p><h1>Użytkownicy</h1></div>
        <div className="row"><button className="btn sm" onClick={csv}><Download size={14} />Eksport CSV</button><button className="btn sm" onClick={ctx.reloadClients}><RefreshCw size={14} />Odśwież</button></div></div>
      <div className="card stack">
        <div className="row" style={{ alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}><Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} /><input id="aq" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Szukaj po imieniu lub e‑mailu" style={{ paddingLeft: 36 }} aria-label="Szukaj" /></div>
          <select id="asort" value={sort} onChange={e => setSort(e.target.value)} style={{ maxWidth: 190 }} aria-label="Sortowanie"><option value="new">Najnowsze konta</option><option value="active">Ostatnio aktywni</option><option value="trainings">Najwięcej treningów</option></select>
        </div>
        <Seg id="afilter" value={f} onChange={setF} options={[['all', `Wszyscy (${ctx.users.length})`], ['users', 'Użytkownicy'], ['trainers', 'Trenerzy'], ['trial', 'Próbny'], ['inactive', 'Nieaktywni 14 dni']]} />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="tablewrap"><table className="table admin-table">
          <thead><tr><th>Osoba</th><th>Rola</th><th>Abonament</th><th>Trener</th><th style={{ textAlign: 'right' }}>Treningi</th><th>Założone</th><th>Ostatnio</th><th>Darmowy</th></tr></thead>
          <tbody>{list.map(u => { const a = access(u), [sl, st] = STATE[a.state], ls = lastSeen(u); return (
            <tr key={u.id}>
              <td><b>{u.name}</b>{u.id === ctx.me.id && <span className="tag" style={{ marginLeft: 6 }}>Ty</span>}<br /><span className="xs muted">{u.email}</span></td>
              <td><select id={'r-' + u.id} value={u.role} disabled={u.id === ctx.me.id} onChange={e => role(u, e.target.value)} aria-label={'Rola ' + u.name}><option value="user">Użytkownik</option><option value="trainer">Trener</option><option value="admin">Admin</option></select></td>
              <td><span className={'tag ' + st}>{sl}</span>{a.state === 'trial' && <span className="xs muted"> {a.daysLeft} d</span>}</td>
              <td className="small">{(byId[u.coach_id] || {}).name || <span className="muted">—</span>}</td>
              <td className="num" style={{ textAlign: 'right' }}>{(u.data.history || []).length}</td>
              <td className="small">{fmtDate(u.created_at)}</td>
              <td className="small">{ls ? fmtDate(ls) : '—'}</td>
              <td><input id={'c-' + u.id} type="checkbox" checked={!!(u.billing || {}).comp} disabled={u.role === 'admin'} onChange={e => comp(u, e.target.checked)} aria-label={'Darmowy dostęp ' + u.name} /></td>
            </tr>); })}</tbody>
        </table></div>
        {!list.length && <div className="empty"><Users size={28} /><span>Brak osób dla tego filtra.</span></div>}
      </div>
    </Page>
  );
}
