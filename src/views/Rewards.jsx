import { useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, Dices, Trophy, Plus } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useUI, Bar, Page, Stagger, Item, Count, ymd, fmtDate, comma } from '../components/ui.jsx';
import { Wheel } from '../components/Wheel.jsx';
import { burst } from './Today.jsx';
const PJ = () => window.PJ;

export const TreatIc = ({ t, size }) => <span className={'treat-ic ' + (t.tier === 'big' ? 'big' : '')} style={size ? { width: size, height: size, fontSize: size / 5.5 } : null}>{t.ic}</span>;
const goalTreat = p => PJ().treatList(p).find(t => t.id === p.rewards.goal) || PJ().TREATS[1];
const avail = p => PJ().rewardTokens(p).filter(t => !t.used && !t.expired);
const spinsLeft = p => p.history.filter(s => !(p.rewards.spins || []).includes(s.id) && Date.now() - new Date(s.date) < 7 * 864e5);

export function RedeemSheet({ tokenId, close }) {
  const { data: p, update } = useApp();
  const { modal, toast } = useUI();
  const av = avail(p), tok = av.find(t => t.id === tokenId) || av[0];
  const opts = PJ().treatList(p).filter(t => tok.tier === 'big' || t.tier !== 'big');
  const [pick, setPick] = useState(opts.some(t => t.id === p.rewards.goal) ? p.rewards.goal : opts[0].id), [day, setDay] = useState(0);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
  const cond = (p.survey.conditions || []).filter(c => ['diabetes', 'hypertension', 'heart', 'gout', 'reflux'].includes(c));
  const go = () => {
    const ds = ymd(days[day]);
    if ((p.rewards.redeemed || []).some(r => r.plannedFor === ds)) return toast('Na ten dzień masz już nagrodę – wybierz inny');
    update(x => { x.rewards.redeemed.push({ token: tok.id, treatId: pick, plannedFor: ds, date: new Date().toISOString() }); });
    close(); burst();
    const t = PJ().treatList(p).find(x => x.id === pick);
    modal(c => <div className="stack celebrate"><motion.div initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 9 }}><TreatIc t={t} size={88} /></motion.div><p className="eyebrow">Nagroda odebrana</p><h2>{t.n}</h2><p>{day === 0 ? 'Dziś' : fmtDate(days[day])}. Smacznego, zasłużyłeś.</p>{t.tip && <p className="small muted">{t.tip}</p>}<button className="btn pri" onClick={c}>Dzięki</button></div>);
  };
  return (
    <div className="stack">
      <p className="eyebrow">{tok.tier === 'big' ? 'Duża nagroda · 4 tygodnie z rzędu' : tok.bonus ? 'Nagroda z koła' : 'Nagroda za sumienny tydzień'}</p>
      <h2>Co wybierasz?</h2>
      <div className="treats">{opts.map(t => <button key={t.id} className="treat" aria-pressed={t.id === pick} onClick={() => setPick(t.id)}><TreatIc t={t} /><span><b>{t.n}</b><span className="xs muted">{t.sub}{t.kcal ? ` · ok. ${t.kcal} kcal` : ''}</span></span></button>)}</div>
      <p className="small">Kiedy?</p>
      <div className="chips">{days.map((d, i) => <button key={i} className="chip" aria-pressed={i === day} onClick={() => setDay(i)}>{i === 0 ? 'Dziś' : i === 1 ? 'Jutro' : d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric' })}</button>)}</div>
      {cond.length > 0 && <div className="banner info"><div>Masz w ankiecie: {cond.map(c => PJ().CONDITIONS[c].label).join(', ')}. Wybierz mniejszą porcję i napój bez cukru.</div></div>}
      <p className="xs muted">Posiłek-nagroda wejdzie do jadłospisu zamiast obiadu. Raz w tygodniu nie zaszkodzi postępom, a pomaga wytrwać.</p>
      <button className="btn pri big" onClick={go}><Gift size={18} />Odbieram nagrodę</button>
    </div>
  );
}

export function RewardCard() {
  const { data: p } = useApp();
  const { modal } = useUI();
  const st = PJ().weekStatus(p, PJ().weekKey(new Date())), g = goalTreat(p), av = avail(p), today = PJ().treatFor(p, ymd(new Date())), spins = spinsLeft(p).length;
  if (today) return <div className="card stack reward-on"><div className="row"><TreatIc t={today} /><div><p className="eyebrow">Dziś nagroda</p><h3>{today.n}</h3></div></div><p className="small">{today.tip || 'Smacznego, zasłużyłeś.'}</p><p className="xs muted">Zjedz bez wyrzutów sumienia. Jutro wracasz do planu.</p></div>;
  return (
    <div className="card stack">
      <div className="spread"><h3>Nagroda tygodnia</h3><a href="#nagrody" className="small">Wszystkie</a></div>
      {av.length > 0 && <motion.div className="banner" initial={{ scale: .96 }} animate={{ scale: [1, 1.02, 1] }} transition={{ repeat: Infinity, duration: 2.4 }}><Gift size={22} /><div><b>Zasłużyłeś na nagrodę!</b>{av.length > 1 ? `Masz ${av.length} do odebrania.` : 'Wybierz, co i kiedy jesz.'}</div><button className="btn gold sm" onClick={() => modal(c => <RedeemSheet close={c} />)}>Odbierz</button></motion.div>}
      {spins > 0 && <div className="banner pink"><Dices size={22} /><div><b>Obroty kołem: {spins}</b>Za ukończone treningi.</div><a className="btn pri sm" href="#nagrody">Kręć</a></div>}
      <div className="row"><TreatIc t={g} /><div style={{ minWidth: 0, flex: 1 }}><p className="xs muted">Cel na ten tydzień</p><b>{g.n}</b></div></div>
      <div className="stack" style={{ gap: 4 }}><div className="spread small"><span>Treningi</span><span className="num">{Math.min(st.tr, st.need)}/{st.need}</span></div><Bar value={st.tr} max={st.need} tone={st.tr >= st.need ? 'gold' : ''} /></div>
      <div className="stack" style={{ gap: 4 }}><div className="spread small"><span>Dni z dietą odhaczoną</span><span className="num">{Math.min(st.diet, st.dietNeed)}/{st.dietNeed}</span></div><Bar value={st.diet} max={st.dietNeed} tone={st.diet >= st.dietNeed ? 'gold' : 'mint'} /></div>
      <p className="xs muted">{st.ok ? 'Tydzień zaliczony. Nagroda czeka.' : 'Brakuje: ' + [st.need - st.tr > 0 ? `${st.need - st.tr} tren.` : '', st.dietNeed - st.diet > 0 ? `${st.dietNeed - st.diet} dni diety` : ''].filter(Boolean).join(' i ') + '.'}</p>
    </div>
  );
}

export function LineChart({ pts }) {
  if (pts.length < 2) return <p className="small muted">Dodaj co najmniej dwa pomiary, żeby zobaczyć wykres.</p>;
  const W = 560, H = 160, pad = 36, ks = pts.map(p => p.kg), lo = Math.floor(Math.min(...ks) - 1), hi = Math.ceil(Math.max(...ks) + 1);
  const x = i => pad + i * (W - pad - 12) / (pts.length - 1), y = v => 10 + (hi - v) / (hi - lo) * (H - 20);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join('');
  return <svg className="chart" viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label="Masa ciała">
    {[lo, (lo + hi) / 2, hi].map((v, i) => <g key={i}><line x1={pad} x2={W - 8} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--line)' }} /><text x="0" y={y(v) + 4}>{v}</text></g>)}
    <path d={`${d} L${x(pts.length - 1)},${H - 10} L${x(0)},${H - 10}Z`} style={{ fill: 'var(--pink)' }} fillOpacity=".14" />
    <motion.path d={d} fill="none" style={{ stroke: 'var(--pink)' }} strokeWidth="2.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
    {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.kg)} r={i === pts.length - 1 ? 5 : 3} style={{ fill: 'var(--pink)' }} />)}
    <text x={pad} y={H + 16}>{fmtDate(pts[0].date)}</text><text x={W - 8} y={H + 16} textAnchor="end">{fmtDate(pts[pts.length - 1].date)}</text>
  </svg>;
}
export function Bars({ vals, labels }) {
  const W = 560, H = 160, pad = 30, max = Math.max(1, ...vals), nice = Math.ceil(max / 1000) * 1000 || 1000, bw = (W - pad) / vals.length;
  return <svg className="chart" viewBox={`0 0 ${W} ${H + 24}`} role="img" aria-label="Objętość tygodniowa">
    {[0, .5, 1].map((f, i) => <g key={i}><line x1={pad} x2={W} y1={H - f * (H - 20)} y2={H - f * (H - 20)} style={{ stroke: 'var(--line)' }} /><text x="0" y={H - f * (H - 20) + 4}>{Math.round(nice * f / 1000)}t</text></g>)}
    {vals.map((v, i) => <g key={i}><motion.rect x={pad + i * bw + 5} width={bw - 10} rx="5" style={{ fill: i === vals.length - 1 ? 'var(--pink)' : 'color-mix(in srgb, var(--pink) 35%, var(--raised))' }}
      initial={{ y: H, height: 0 }} animate={{ y: H - v / nice * (H - 20), height: v / nice * (H - 20) }} transition={{ delay: i * .05, duration: .6 }} /><text x={pad + i * bw + bw / 2} y={H + 16} textAnchor="middle">{labels[i]}</text></g>)}
  </svg>;
}

export default function Rewards() {
  const { data: p, update } = useApp();
  const { modal, toast } = useUI();
  const [kg, setKg] = useState(''), [ct, setCt] = useState('');
  const xp = PJ().totalXP(p), lv = PJ().level(xp), bd = PJ().badges(p, p), toks = PJ().rewardTokens(p), av = toks.filter(t => !t.used && !t.expired);
  const used = (p.rewards.redeemed || []).slice().reverse(), tl = PJ().treatList(p), spins = spinsLeft(p);
  const okStreak = (() => { let n = 0; const d = new Date(); if (!PJ().weekStatus(p, PJ().weekKey(d)).ok) d.setDate(d.getDate() - 7); while (n < 520 && PJ().weekStatus(p, PJ().weekKey(d)).ok) { n++; d.setDate(d.getDate() - 7); } return n; })();
  const wk = PJ().weekKey(new Date());
  const weeks = Array.from({ length: 8 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (7 - i) * 7); return PJ().weekKey(d); });
  const vol = weeks.map(k => p.history.filter(s => PJ().weekKey(s.date) === k).reduce((t, s) => t + PJ().volume(s), 0));

  const onSpin = (seg) => {
    const sid = spins[0].id;
    if (seg.treat) {
      update(x => { x.rewards.spins.push(sid); x.rewards.bonus.push({ id: 'x:' + sid, tier: 'small', date: new Date().toISOString(), from: 'Koło nagród' }); });
      burst(); modal(c => <div className="stack celebrate"><p className="eyebrow">Koło nagród</p><h1 className="grad">Posiłek-nagroda!</h1><p>Wygrałeś dodatkową nagrodę: pizza, burger, McDonald's – co wolisz.</p><button className="btn gold big" onClick={() => { c(); modal(c2 => <RedeemSheet tokenId={'x:' + sid} close={c2} />); }}>Wybierz teraz</button><button className="btn" onClick={c}>Później</button></div>);
    } else {
      update(x => { x.rewards.spins.push(sid); x.rewards.xp = (x.rewards.xp || 0) + seg.xp; });
      if (seg.xp >= 100) burst();
      toast(seg.xp >= 250 ? `JACKPOT! +${seg.xp} XP` : `Wygrana: +${seg.xp} XP`);
    }
  };

  return (
    <Page>
      <div className="spread"><div><p className="eyebrow">Nagrody i postępy</p><h1>Nagrody</h1></div><span className="tag gold"><Trophy size={12} />Sumienne tygodnie z rzędu: {okStreak}</span></div>
      <div className="cols">
        <Stagger>
          <Item className="card stack">
            <div className="spread"><h2>Do odebrania: {av.length}</h2></div>
            {av.length ? <div className="treats">{av.map(t => <div key={t.id} className="treat on"><TreatIc t={{ ic: t.tier === 'big' ? 'BIG' : t.bonus ? 'KOŁO' : 'TYDZ', tier: t.tier }} /><span><b>{t.tier === 'big' ? 'Duża nagroda' : 'Posiłek-nagroda'}</b><span className="xs muted">{t.bonus ? 'z koła nagród' : 'za tydzień od ' + fmtDate(t.wk + 'T12:00:00')}{t.expires ? ` · ważna do ${fmtDate(new Date(new Date(t.expires) - 864e5))}` : ''}</span></span><button className="btn gold sm" onClick={() => modal(c => <RedeemSheet tokenId={t.id} close={c} />)}>Odbierz</button></div>)}</div>
              : <p className="muted">Na razie nic. Zalicz tydzień, a tu pojawi się {goalTreat(p).n.toLowerCase()}.</p>}
            <div className="stack small" style={{ gap: 6 }}><b>Zasady</b><ul className="list">
              <li><b>Sumienny tydzień</b> = wszystkie zaplanowane treningi ({p.trainDays.length}) i co najmniej {PJ().DIET_NEED} dni diety odhaczonych. Nagroda: posiłek, na który masz ochotę. Ważna do końca następnego tygodnia.</li>
              <li><b>4 sumienne tygodnie z rzędu</b> = duża nagroda: wieczór bez liczenia, nowy sprzęt albo masaż.</li>
              <li><b>Koło nagród</b>: obrót za każdy ukończony trening. Bonusowe XP, a czasem dodatkowy posiłek-nagroda.</li></ul></div>
          </Item>
          <Item className="card stack">
            <h3>Mój cel na nagrodę</h3><p className="small muted">Na co pracujesz w tym tygodniu? Widać to na ekranie Dziś.</p>
            <div className="treats">{tl.filter(t => t.tier !== 'big').map(t => <motion.button whileTap={{ scale: .97 }} key={t.id} className="treat" aria-pressed={t.id === p.rewards.goal} onClick={() => { update(x => { x.rewards.goal = t.id; }); toast('Cel: ' + t.n); }}><TreatIc t={t} /><span><b>{t.n}</b><span className="xs muted">{t.sub}</span></span></motion.button>)}</div>
            <div className="row"><input id="ctreat" type="text" value={ct} onChange={e => setCt(e.target.value)} placeholder="Własna nagroda, np. zapiekanka, kino" style={{ flex: 1, minWidth: 180 }} aria-label="Własna nagroda" />
              <button className="btn" onClick={() => { if (!ct.trim()) return; const id = 'c' + Date.now().toString(36); update(x => { x.rewards.custom.push({ id, n: ct.trim(), sub: 'moja nagroda', tier: 'small', kcal: 0 }); x.rewards.goal = id; }); setCt(''); toast('Dodano'); }}><Plus size={16} />Dodaj</button></div>
            {used.length > 0 && <><p className="eyebrow">Odebrane</p><div className="hist">{used.slice(0, 8).map((r, i) => { const t = tl.find(x => x.id === r.treatId); return <div key={i}><b>{t ? t.n : r.treatId}</b><span className="small muted">{fmtDate(r.plannedFor + 'T12:00:00')}</span></div>; })}</div></>}
          </Item>
          <Item className="card stack"><h3>Odznaki · {bd.filter(b => b.got).length}/{bd.length}</h3>
            <div className="badges">{bd.map((b, i) => <motion.div key={b.id} className={'bd ' + (b.got ? 'got' : '')} initial={{ opacity: 0, scale: .9 }} animate={{ opacity: b.got ? 1 : .62, scale: 1 }} transition={{ delay: i * .02 }}><span className="ic">{b.ic}</span><b>{b.n}</b><span>{b.d}</span></motion.div>)}</div></Item>
        </Stagger>
        <Stagger delay={.1}>
          <Item className="card stack"><div className="spread"><h3>Koło nagród</h3><span className="tag pink">Obroty: {spins.length}</span></div>
            <Wheel disabled={!spins.length} onResult={onSpin} />
            {!spins.length && <p className="small muted" style={{ textAlign: 'center' }}>Ukończ trening, żeby dostać obrót.</p>}</Item>
          <Item className="card"><div className="lvl">
            <motion.div className="treat-ic big" style={{ width: 84, height: 84, fontSize: '1.6rem' }} initial={{ rotate: -90, scale: .5 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', damping: 12 }}>{lv.n}</motion.div>
            <div className="stack" style={{ gap: 6 }}><p className="eyebrow">Poziom {lv.n}</p><h2>{lv.name}</h2><Bar value={lv.pct} max={1} tone="gold" /><p className="xs muted"><Count to={xp} /> XP{lv.nextName ? ` · do „${lv.nextName}”: ${lv.next - xp} XP` : ''}</p></div></div></Item>
          <Item className="card stack"><h3>Masa ciała</h3><LineChart pts={p.weights || []} />
            <div className="row"><input id="kg" type="number" step="0.1" value={kg} onChange={e => setKg(e.target.value)} placeholder="np. 101,4" style={{ maxWidth: 140 }} aria-label="Waga w kg" />
              <button className="btn pri" onClick={() => { const v = parseFloat(String(kg).replace(',', '.')); if (!(v > 30 && v < 300)) return toast('Wpisz wagę w kg'); const has = (p.weights || []).some(w => PJ().weekKey(w.date) === wk && w.xp); update(x => { x.weights.push({ date: new Date().toISOString(), kg: v, xp: has ? 0 : 25 }); x.weight = v; }); setKg(''); toast('Zapisano ' + comma(v) + ' kg' + (has ? '' : ' · +25 XP')); }}>Zapisz pomiar</button></div>
            <p className="xs muted">Waż się raz w tygodniu, rano, na czczo. Pomiar = +25 XP raz w tygodniu.</p></Item>
          <Item className="card stack"><h3>Objętość tygodniowa</h3><Bars vals={vol} labels={weeks.map(k => k.slice(8, 10) + '.' + k.slice(5, 7))} /></Item>
          <Item className="card stack"><h3>Historia treningów</h3><div className="hist">{p.history.slice().reverse().slice(0, 12).map(s => <div key={s.id}><b>{s.dayName}</b><span className="num small">+{s.xp} XP</span><span className="xs muted">{fmtDate(s.date)} · {s.entries.reduce((t, e) => t + e.sets.filter(x => x.done).length, 0)} serii · {Math.round(PJ().volume(s))} kg</span><span>{s.prs && s.prs.length ? <span className="tag gold">{s.prs.length} PR</span> : null}</span></div>)}{!p.history.length && <div className="empty">Tu pojawią się zapisane treningi.</div>}</div></Item>
        </Stagger>
      </div>
    </Page>
  );
}
