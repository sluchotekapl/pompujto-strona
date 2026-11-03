import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shuffle, Droplet } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useUI, Bar, Page, Seg, Stagger, Item, Count, ymd, fmtDate, comma } from '../components/ui.jsx';
import { TreatIc } from './Rewards.jsx';
const PJ = () => window.PJ;

export default function Diet() {
  const { data: p, update } = useApp();
  const [tab, setTab] = useState('day'), [dd, setDd] = useState(0);
  const nt = PJ().nutrition(p), fr = PJ().foodRules(p);
  const date = new Date(); date.setDate(date.getDate() + dd); const ds = ymd(date);
  const L = (p.dietLog || {})[ds] || { eaten: [], water: 0, swaps: {}, xp: 0 };
  const meals = PJ().mealDay(p, ds, L.swaps);
  const sum = meals.reduce((t, m) => ({ k: t.k + (m.kcal || 0), P: t.P + (m.P || 0) }), { k: 0, P: 0 });
  const edit = fn => update(x => {
    const l = x.dietLog[ds] = x.dietLog[ds] || { eaten: [], water: 0, swaps: {}, xp: 0 }; fn(l);
    const ms = PJ().mealDay(x, ds, l.swaps), ok = l.eaten.length >= ms.length && l.water >= nt.water * 1000;
    l.xp = ok ? 30 : l.eaten.length >= ms.length - 1 ? 15 : 0;
  });
  const tiles = [['Kalorie', nt.kcal, '', nt.label], ['Białko', nt.prot, ' g', `${comma((nt.prot / (p.survey.goal === 'masa' ? p.weight : nt.refW)).toFixed(1))} g/kg`], ['Tłuszcze', nt.fat, ' g'], ['Węglowodany', nt.carb, ' g'], ['Woda', nt.water, ' l'], ['Błonnik', nt.fiber, ' g']];
  return (
    <Page>
      <div className="spread"><div><p className="eyebrow">Plan żywieniowy</p><h1>Dieta</h1></div><Seg id="diet" value={tab} onChange={setTab} options={[['day', 'Jadłospis'], ['rules', 'Jedz / unikaj'], ['shop', 'Zakupy']]} /></div>
      <Stagger className="tiles">{tiles.map(([n, v, u, s]) => <Item key={n} className="tile"><span className="eyebrow">{n}</span><span className="v"><Count to={v} dec={v % 1 ? 1 : 0} /><small>{u}</small></span>{s && <span className="xs muted">{s}</span>}</Item>)}</Stagger>
      {p.targetWeight ? <div className="card tight stack"><div className="spread small"><span>Cel: <b>{comma(p.targetWeight)} kg</b> · teraz {comma(p.weight)} kg</span><span className="muted">{Math.abs(p.weight - p.targetWeight) < 0.5 ? 'cel osiągnięty!' : `zostało ${comma(Math.abs(p.weight - p.targetWeight).toFixed(1))} kg`}</span></div>{(() => { const w = p.weights || [], start = w.length ? w[0].kg : p.weight, tot = Math.abs(start - p.targetWeight) || 1; return <Bar value={Math.max(0, tot - Math.abs(p.weight - p.targetWeight))} max={tot} tone="mint" />; })()}</div> : null}
      <p className="xs muted">Przemiana podstawowa {nt.bmr} kcal (Mifflin‑St Jeor), całkowita ok. {nt.tdee} kcal.{nt.pace ? ` Tempo: ok. ${comma(nt.pace)} kg tygodniowo.` : ''} To nie porada dietetyka – przy chorobach skonsultuj jadłospis.</p>

      {tab === 'day' && <>
        <div className="chips">{Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return <button key={i} className="chip" aria-pressed={dd === i} onClick={() => setDd(i)}>{i === 0 ? 'Dziś' : d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric' })}</button>; })}</div>
        <div className="cols">
          <div className="card stack"><div className="spread"><h2>{dd === 0 ? 'Dzisiaj' : fmtDate(date)}</h2><span className="num small muted">{sum.k} kcal · {sum.P} g białka</span></div>
            <Stagger className="">{meals.map(m => m.empty ? <Item key={m.idx} className="meal"><span /><div><b>{m.name}</b><p className="small muted">Brak posiłków pasujących do wykluczeń. Złagodź listę w ankiecie.</p></div></Item>
              : <Item key={m.idx + m.id} className="meal">
                <input className="cb" type="checkbox" checked={L.eaten.includes(m.idx)} aria-label={'Zjedzone: ' + m.n} onChange={e => edit(l => { l.eaten = e.target.checked ? [...new Set(l.eaten.concat(m.idx))] : l.eaten.filter(x => x !== m.idx); })} />
                {m.treat ? <div className="stack reward-on" style={{ gap: 4, padding: 12, borderRadius: 14 }}><div className="spread"><span className="eyebrow">{m.name}</span><span className="num xs muted">ok. {m.kcal} kcal</span></div><b>{m.n}</b><p className="small">{m.r}</p><p className="xs muted">To ok. {Math.max(0, m.kcal - m.planned)} kcal ponad zwykły obiad. Nic nie nadrabiaj – jutro wracasz do planu.</p></div>
                  : <div className="stack" style={{ gap: 4 }}><div className="spread"><span className="eyebrow">{m.name}</span><span className="num xs muted">{m.kcal} kcal · B {m.P} · T {m.F} · W {m.C}</span></div><b>{m.n}</b>
                    <ul>{m.ing.map(([n, q, u], i) => <li key={i}>{n} – {comma(q)} {u}</li>)}</ul><p className="small">{m.r}</p>
                    <div className="row">{m.f !== 1 && <span className="tag">porcja ×{comma(m.f)}</span>}{m.poolSize > 1 && <button className="btn ghost sm" onClick={() => edit(l => { l.swaps[m.idx] = (l.swaps[m.idx] || 0) + 1; l.eaten = l.eaten.filter(x => x !== m.idx); })}><Shuffle size={14} />Inny posiłek</button>}</div></div>}
              </Item>)}</Stagger>
          </div>
          <Stagger>
            <Item className="card stack"><h3><Droplet size={16} style={{ verticalAlign: -2 }} /> Woda</h3><p className="xs muted">Szklanka = 250 ml. Cel: {comma(nt.water)} l.</p>
              <div className="water">{Array.from({ length: Math.ceil(nt.water * 4) }, (_, i) => <motion.button whileTap={{ scale: .8 }} key={i} className={L.water >= (i + 1) * 250 ? 'on' : ''} aria-label={'Szklanka ' + (i + 1)} onClick={() => edit(l => { const n = (i + 1) * 250; l.water = l.water === n ? n - 250 : n; })} />)}</div></Item>
            <Item className="card stack"><h3>Dzień diety</h3><p className="small">Wszystkie posiłki + woda = <b>30 XP</b>. Prawie wszystkie posiłki = 15 XP. Zaliczony dzień liczy się do nagrody tygodnia.</p><Bar value={L.xp || 0} max={30} tone="gold" /><p className="xs muted">Teraz: {L.xp || 0} XP</p></Item>
            {(fr.allergy.length > 0 || fr.diet) && <Item className="card stack"><h3>Twoje wykluczenia</h3>{fr.diet && <p className="small">{fr.diet}</p>}{fr.allergy.map(a => <p key={a.a} className="small"><b>{window.PJ_ALLERGENS[a.a]}:</b> {a.t}</p>)}</Item>}
          </Stagger>
        </div>
      </>}

      {tab === 'rules' && <div className="cols">
        <div className="card stack"><h2>Jedz</h2><ul className="list yes">{fr.eat.map((x, i) => <li key={i}>{x}</li>)}</ul><h2>Unikaj</h2><ul className="list no">{fr.avoid.map((x, i) => <li key={i}>{x}</li>)}</ul>
          <p className="xs muted">Podstawa: Talerz Zdrowego Żywienia (NCEŻ / NIZP PZH‑PIB) i zalecenia WHO, uzupełnione o cel z ankiety.</p></div>
        <Stagger>
          {fr.extra.map(e => <Item key={e.title} className="card stack"><h3>{e.title}</h3><p className="eyebrow">Jedz</p><ul className="list yes small">{e.eat.map((x, i) => <li key={i}>{x}</li>)}</ul><p className="eyebrow">Unikaj</p><ul className="list no small">{e.avoid.map((x, i) => <li key={i}>{x}</li>)}</ul></Item>)}
          {fr.allergy.map(a => <Item key={a.a} className="card"><b>{window.PJ_ALLERGENS[a.a]}</b><p className="small">{a.t}</p></Item>)}
          {!fr.extra.length && !fr.allergy.length && <Item className="card"><p className="small muted">Bez schorzeń i alergii w ankiecie. Jeśli jakieś masz, dodaj je – lista zmieni się sama.</p></Item>}
          <Item className="card stack"><h3>Wokół treningu</h3><ul className="list small"><li>1–3 h przed: węglowodany i białko.</li><li>Do 2 h po: 25–40 g białka.</li><li>Kreatyna 3–5 g dziennie – najlepiej przebadany suplement siłowy (opcjonalnie).</li><li>Sen 7–9 h.</li></ul></Item>
        </Stagger>
      </div>}

      {tab === 'shop' && (() => {
        const agg = {};
        for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() + i); const k = ymd(d); PJ().mealDay(p, k, ((p.dietLog || {})[k] || {}).swaps).forEach(m => (m.ing || []).forEach(([n, q, u]) => { const key = n + '|' + u; agg[key] = (agg[key] || 0) + q; })); }
        const rows = Object.entries(agg).sort((a, b) => a[0].localeCompare(b[0], 'pl'));
        return <div className="card stack"><h2>Zakupy na 7 dni</h2><p className="small muted">Suma z jadłospisu od dziś. Odhaczaj w sklepie.</p>
          <div className="checks">{rows.map(([k, q], i) => { const [n, u] = k.split('|'); return <label key={k} className="check"><input id={'shop-' + i} type="checkbox" />{n} – <span className="num">{comma(Math.round(q * 10) / 10)} {u}</span></label>; })}</div></div>;
      })()}
    </Page>
  );
}
