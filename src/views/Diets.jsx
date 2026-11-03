import { useState } from 'react';
import { motion } from 'framer-motion';
import { Apple, Plus, Sparkles, FileDown, Users, CopyPlus, Trash2, Check, ArrowUp, ArrowDown, Wand2, Send } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useUI, Page, Stagger, Item, Seg } from '../components/ui.jsx';
import { blankData, normalize, api } from '../lib/backend.js';
import { blankDiet, blankMeal, dayTotals, generateDiet, aiDiet, printDiet } from '../lib/diets.js';
const PJ = () => window.PJ;
const GOALS = [['redukcja', 'Redukcja'], ['zdrowie', 'Zdrowie / forma'], ['masa', 'Masa mięśniowa'], ['sila', 'Siła']];
const LVLS = [['beginner', 'Początkujący'], ['intermediate', 'Średni'], ['advanced', 'Zaawansowany']];

/* ---------- krótki opis osoby, gdy plan/dieta nie jest dla konkretnego podopiecznego ---------- */
export function BriefForm({ onSubmit, cta = 'Dalej', withTraining = false, withDiet = false }) {
  const [f, setF] = useState({ sex: 'm', age: 30, weight: 80, height: 178, goal: 'redukcja', level: 'beginner', days: 3, meals: 4, diet: 'omni', allergies: [], activity: 'light', equip: 'gym' });
  const set = (k, v) => setF({ ...f, [k]: v });
  const go = () => {
    const days = [[1, 3, 5], [1, 3, 5], [1, 3, 5], [1, 3, 5], [1, 2, 4, 5], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6]][f.days] || [1, 3, 5];
    const p = normalize(blankData({ sex: f.sex, age: +f.age || 30, weight: +f.weight || 80, height: +f.height || 178, level: f.level, trainDays: days, equipPreset: f.equip, equipment: PJ().EQUIP_PRESETS[f.equip].slice(), surveyDone: true }), 'brief', 'Podopieczny');
    p.survey = Object.assign(p.survey, { goal: f.goal, meals: +f.meals, diet: f.diet, allergies: f.allergies, activity: f.activity });
    onSubmit(p);
  };
  return (
    <div className="stack">
      <div className="fields">
        <label className="f">Płeć<select id="b-sex" value={f.sex} onChange={e => set('sex', e.target.value)}><option value="m">Mężczyzna</option><option value="f">Kobieta</option></select></label>
        <label className="f">Wiek<input id="b-age" type="number" value={f.age} onChange={e => set('age', e.target.value)} /></label>
        <label className="f">Waga (kg)<input id="b-w" type="number" value={f.weight} onChange={e => set('weight', e.target.value)} /></label>
        <label className="f">Wzrost (cm)<input id="b-h" type="number" value={f.height} onChange={e => set('height', e.target.value)} /></label>
        <label className="f">Cel<select id="b-goal" value={f.goal} onChange={e => set('goal', e.target.value)}>{GOALS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        {withTraining && <label className="f">Poziom<select id="b-lvl" value={f.level} onChange={e => set('level', e.target.value)}>{LVLS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>}
        {withTraining && <label className="f">Treningi w tygodniu<select id="b-days" value={f.days} onChange={e => set('days', +e.target.value)}>{[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}</select></label>}
        {withTraining && <label className="f">Sprzęt<select id="b-eq" value={f.equip} onChange={e => set('equip', e.target.value)}><option value="gym">Siłownia</option><option value="home">Dom (hantle)</option><option value="none">Bez sprzętu</option></select></label>}
        {withDiet && <label className="f">Posiłki dziennie<select id="b-meals" value={f.meals} onChange={e => set('meals', e.target.value)}>{[3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label>}
        {withDiet && <label className="f">Rodzaj diety<select id="b-diet" value={f.diet} onChange={e => set('diet', e.target.value)}><option value="omni">Wszystkożerna</option><option value="vege">Wegetariańska</option><option value="vegan">Wegańska</option></select></label>}
        {withDiet && <label className="f">Aktywność poza treningiem<select id="b-act" value={f.activity} onChange={e => set('activity', e.target.value)}><option value="sedentary">Siedząca</option><option value="light">Lekka</option><option value="active">Aktywna</option></select></label>}
      </div>
      {withDiet && <div className="chips">{Object.entries(window.PJ_ALLERGENS || {}).map(([k, n]) => <button type="button" key={k} className="chip" aria-pressed={f.allergies.includes(k)} onClick={() => set('allergies', f.allergies.includes(k) ? f.allergies.filter(x => x !== k) : f.allergies.concat(k))}>bez: {n}</button>)}</div>}
      <button className="btn pri big" onClick={go}>{cta}</button>
    </div>
  );
}

/* ---------- AI / generator dla danego profilu ---------- */
function MakeDietSheet({ p, who, close, onDone }) {
  const [wish, setWish] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const nt = PJ().nutrition(p);
  const ai = async () => { setBusy(true); setErr(''); try { const d = await aiDiet(p, wish); close(); onDone(d); } catch (e) { setErr(e.code === 'offline' ? 'Trener AI jest teraz wyłączony – użyj generatora.' : e.message); } setBusy(false); };
  return (
    <div className="stack">
      <span className="ai-badge" style={{ justifySelf: 'start' }}><Sparkles size={12} />Dieta {who ? 'dla ' + who : ''}</span>
      <h2>Ułóż dietę</h2>
      <div className="tiles">{[['Kalorie', nt.kcal, 'kcal'], ['Białko', nt.prot, 'g'], ['Tłuszcze', nt.fat, 'g'], ['Węgle', nt.carb, 'g']].map(([n, v, u]) => <div key={n} className="tile"><span className="eyebrow">{n}</span><span className="v">{v}<small>{u}</small></span></div>)}</div>
      <p className="xs muted">{nt.label}. Uwzględniam alergie, rodzaj diety i schorzenia z ankiety. Wszystko poprawisz w kreatorze.</p>
      <label className="f">Życzenia dla AI (opcjonalnie)<textarea id="dt-wish" value={wish} onChange={e => setWish(e.target.value)} placeholder="np. tanio, szybkie śniadania, bez ryb, dużo białka na kolację" /></label>
      <button className="btn pri big" onClick={ai} disabled={busy}>{busy ? <><span className="typing"><span /><span /><span /></span>AI układa dietę… (do 30 s)</> : <><Sparkles size={18} />Ułóż z Trenerem AI</>}</button>
      <button className="btn" onClick={() => { close(); onDone(generateDiet(p)); }} disabled={busy}><Wand2 size={16} />Szybki generator z bazy posiłków</button>
      {err && <div className="banner bad"><div>{err}</div></div>}
    </div>
  );
}

export function NewDietSheet({ close, client }) {
  const ctx = useApp();
  const { modal } = useUI();
  const target = client ? { kind: 'client', id: client.id, name: client.name } : { kind: 'library' };
  const open = d => ctx.openDietEditor(d, target);
  if (client) return <MakeDietSheet p={client.data} who={client.name} close={close} onDone={open} />;
  return (
    <div className="stack">
      <h2>Nowa dieta</h2>
      <button className="treat" onClick={() => { close(); open(blankDiet()); }}><span className="treat-ic"><Apple size={18} /></span><span><b>Pusta dieta</b><span className="xs muted">Rozpisujesz posiłki sam</span></span></button>
      <div className="card stack"><b className="small">Z AI albo generatora – podaj dane osoby</b>
        <BriefForm withDiet cta="Dalej – ułóż dietę" onSubmit={p => { close(); modal(c => <MakeDietSheet p={p} close={c} onDone={open} />); }} /></div>
    </div>
  );
}

/* ---------- przypisanie diety ---------- */
export async function assignDiet(ctx, client, diet, toast) {
  const d = structuredClone(diet);
  Object.assign(d, { id: 'dt' + Date.now().toString(36), coachName: ctx.data.name, assignedAt: new Date().toISOString() });
  try {
    await ctx.saveClient(client, { diet: d });
    if (!client.offline) api.send([client.id], { type: 'text', title: 'Nowa dieta od trenera', body: `${ctx.data.name} przygotował Ci dietę „${d.name}”. Znajdziesz ją w zakładce Dieta (możesz pobrać PDF).` }).catch(() => { });
    toast(`Dieta „${d.name}” wysłana: ${client.name}`);
    return true;
  } catch (e) { toast(e.message); return false; }
}

function AssignDietSheet({ diet, close }) {
  const ctx = useApp();
  const { toast } = useUI();
  const [picked, setPicked] = useState([]), [busy, setBusy] = useState(false);
  const list = ctx.clients.filter(c => c.offline || c.coach_id === ctx.me.id);
  const go = async () => { setBusy(true); for (const c of list.filter(x => picked.includes(x.id))) await assignDiet(ctx, c, diet, toast); setBusy(false); ctx.reloadClients(); close(); };
  return (
    <div className="stack"><h2>Wyślij „{diet.name}”</h2>
      {!list.length && <p className="muted">Nie masz jeszcze podopiecznych.</p>}
      <div className="stack" style={{ gap: 6 }}>{list.map(c => <label key={c.id} className="check"><input type="checkbox" checked={picked.includes(c.id)} onChange={() => setPicked(picked.includes(c.id) ? picked.filter(x => x !== c.id) : picked.concat(c.id))} />{c.name}{c.offline && <span className="tag">bez konta</span>}</label>)}</div>
      <button className="btn pri big" disabled={!picked.length || busy} onClick={go}><Send size={16} />Wyślij w aplikacji ({picked.length})</button>
      <p className="xs muted">Podopieczny zobaczy dietę w zakładce Dieta i sam pobierze PDF. Osobom bez konta wyślij PDF ręcznie (przycisk PDF).</p>
    </div>
  );
}

/* ---------- biblioteka diet trenera ---------- */
export function DietsLibrary() {
  const ctx = useApp();
  const { modal, toast } = useUI();
  const lib = ctx.data.coachDiets || [];
  return (
    <Page>
      <div className="spread"><div><p className="eyebrow">Panel trenera</p><h1>Diety</h1></div><button className="btn pri" onClick={() => modal(c => <NewDietSheet close={c} />)}><Plus size={16} />Nowa dieta</button></div>
      <p className="muted">Rozpisz dietę sam, wygeneruj ją z AI i popraw, a potem wyślij podopiecznym w aplikacji albo jako PDF.</p>
      {!lib.length && <div className="card empty"><Apple size={34} /><b>Nie masz jeszcze diet</b><span className="small">Zacznij od AI – ułoży 3 dni do rotacji pod kalorie i alergie, Ty tylko poprawisz.</span><button className="btn pri" onClick={() => modal(c => <NewDietSheet close={c} />)}><Plus size={16} />Nowa dieta</button></div>}
      <Stagger className="clients">{lib.map(d => (
        <Item key={d.id} className="card stack">
          <div className="spread"><h3>{d.name}</h3>{d.ai && <span className="ai-badge"><Sparkles size={11} />AI</span>}</div>
          <p className="small muted">{d.kcal} kcal · B {d.P} g · T {d.F} g · W {d.C} g · {d.days.length} {d.days.length === 1 ? 'dzień' : 'dni'}</p>
          <div className="row">
            <button className="btn sm pri" onClick={() => ctx.openDietEditor(d, { kind: 'library', id: d.id })}><Apple size={14} />Edytuj</button>
            <button className="btn sm" onClick={() => modal(c => <AssignDietSheet diet={d} close={c} />)}><Users size={14} />Wyślij</button>
            <button className="btn sm" onClick={() => printDiet(d, '', ctx.data.name)}><FileDown size={14} />PDF</button>
            <button className="btn sm" onClick={() => { ctx.update(x => { x.coachDiets = (x.coachDiets || []).concat({ ...structuredClone(d), id: 'dt' + Date.now().toString(36), name: d.name + ' (kopia)' }); }); toast('Zduplikowano'); }}><CopyPlus size={14} /></button>
            <button className="btn sm danger" onClick={() => modal(c => <div className="stack"><h2>Usunąć „{d.name}”?</h2><p className="small">Podopieczni, którzy ją dostali, zachowają swoją kopię.</p><div className="row"><button className="btn danger" onClick={() => { ctx.update(x => { x.coachDiets = (x.coachDiets || []).filter(k => k.id !== d.id); }); c(); }}>Usuń</button><button className="btn" onClick={c}>Anuluj</button></div></div>)}><Trash2 size={14} /></button>
          </div>
        </Item>))}</Stagger>
    </Page>
  );
}

/* ---------- kreator diety ---------- */
export function DietEditor() {
  const ctx = useApp();
  const { toast } = useUI();
  const ed = ctx.dietEditor;
  const [d, setD] = useState(() => ed ? structuredClone(ed.diet) : null);
  const [di, setDi] = useState(0), [alsoLib, setAlsoLib] = useState(false);
  if (!ed || !d) return <Page><div className="card empty"><Apple size={32} /><b>Nic nie edytujesz</b><a className="btn pri" href="#diety">Przejdź do diet</a></div></Page>;
  const client = ed.target.kind === 'client' ? ctx.clients.find(c => c.id === ed.target.id) : null;
  const mut = fn => setD(o => { const x = structuredClone(o); fn(x); return x; });
  const day = d.days[Math.min(di, d.days.length - 1)], tot = dayTotals(day);
  const num = v => v === '' ? '' : Math.max(0, Math.round(+String(v).replace(',', '.') || 0));
  const save = async () => {
    if (!d.name.trim()) return toast('Nazwij dietę');
    if (!d.days.some(x => x.meals.length)) return toast('Dodaj co najmniej jeden posiłek');
    const clean = structuredClone(d); clean.updatedAt = new Date().toISOString();
    if (ed.target.kind === 'library' || alsoLib) ctx.update(x => {
      x.coachDiets = x.coachDiets || [];
      const i = ed.target.kind === 'library' && ed.target.id ? x.coachDiets.findIndex(k => k.id === ed.target.id) : -1;
      const item = { ...clean, id: i >= 0 ? ed.target.id : 'dt' + Date.now().toString(36) };
      if (i >= 0) x.coachDiets[i] = item; else x.coachDiets.push(item);
    });
    if (client) { const ok = await assignDiet(ctx, client, clean, toast); if (!ok) return; ctx.reloadClients(); ctx.setDietEditor(null); location.hash = '#p-' + client.id; }
    else { toast('Zapisano w bibliotece'); ctx.setDietEditor(null); location.hash = '#diety'; }
  };
  const diff = tot.kcal - (+d.kcal || 0);
  return (
    <Page>
      <div className="spread"><div><p className="eyebrow">Kreator diety {client ? '· dla ' + client.name : '· biblioteka'}</p><h1>{d.name || 'Bez nazwy'}</h1></div>
        <div className="row"><button className="btn" onClick={() => printDiet(d, client ? client.name : '', ctx.data.name)}><FileDown size={16} />PDF</button><button className="btn" onClick={() => { ctx.setDietEditor(null); history.back(); }}>Anuluj</button><button className="btn pri" onClick={save}><Check size={16} />{client ? `Zapisz i wyślij ${client.name.split(' ')[0]}` : 'Zapisz w bibliotece'}</button></div></div>
      <div className="card stack">
        <label className="f">Nazwa diety<input type="text" id="dt-name" value={d.name} onChange={e => mut(x => { x.name = e.target.value; })} /></label>
        <div className="fields">{[['kcal', 'Kalorie (kcal)'], ['P', 'Białko (g)'], ['F', 'Tłuszcze (g)'], ['C', 'Węglowodany (g)']].map(([k, n]) => <label key={k} className="f">{n}<input id={'dt-' + k} type="number" inputMode="numeric" value={d[k]} onChange={e => mut(x => { x[k] = num(e.target.value); })} /></label>)}
          <label className="f">Woda (l)<input id="dt-water" type="number" step="0.1" value={d.water} onChange={e => mut(x => { x.water = e.target.value; })} /></label></div>
        <label className="f">Zasady dla podopiecznego<textarea id="dt-notes" value={d.notes} onChange={e => mut(x => { x.notes = e.target.value; })} placeholder="np. Pij wodę przed każdym posiłkiem. Raz w tygodniu posiłek-nagroda." style={{ fontFamily: 'var(--body)', minHeight: 70 }} /></label>
        {client && <label className="check"><input type="checkbox" checked={alsoLib} onChange={e => setAlsoLib(e.target.checked)} />Zapisz też kopię w mojej bibliotece</label>}
      </div>
      <div className="row">
        <Seg id="dt-days" value={String(Math.min(di, d.days.length - 1))} onChange={v => setDi(+v)} options={d.days.map((x, i) => [String(i), x.name])} />
        <button className="btn sm" onClick={() => { const k = 'ABCDEFG'[d.days.length] || String(d.days.length + 1); mut(x => { x.days.push({ key: k, name: 'Dzień ' + k, meals: structuredClone(day.meals).map(m => ({ ...m, id: 'm' + Math.random().toString(36).slice(2, 8) })) }); }); setDi(d.days.length); }} disabled={d.days.length >= 7}><CopyPlus size={14} />Kopiuj dzień</button>
        {d.days.length > 1 && <button className="btn sm danger" onClick={() => { mut(x => { x.days.splice(di, 1); }); setDi(0); }}><Trash2 size={14} />Usuń dzień</button>}
      </div>
      <div className="card stack">
        <div className="spread"><label className="f" style={{ flex: 1, maxWidth: 260 }}>Nazwa dnia<input type="text" id="dt-dayname" value={day.name} onChange={e => mut(x => { x.days[di].name = e.target.value; })} /></label>
          <div className="small" style={{ textAlign: 'right' }}><b className="num">{tot.kcal} kcal</b> · B {tot.P} · T {tot.F} · W {tot.C}<br /><span className={'tag ' + (Math.abs(diff) <= (+d.kcal || 1) * .05 ? 'mint' : 'gold')}>{diff > 0 ? '+' : ''}{diff} kcal względem celu</span></div></div>
        {day.meals.map((m, mi) => (
          <motion.div key={m.id} layout className="dmeal">
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <label className="f" style={{ width: 90 }}>Godz.<input type="text" id={'mt-' + m.id} value={m.time} onChange={e => mut(x => { x.days[di].meals[mi].time = e.target.value; })} placeholder="8:00" /></label>
              <label className="f" style={{ flex: 1, minWidth: 140 }}>Posiłek<input type="text" id={'mn-' + m.id} value={m.name} onChange={e => mut(x => { x.days[di].meals[mi].name = e.target.value; })} /></label>
              <div className="row" style={{ gap: 4 }}>
                <button className="iconbtn" aria-label="W górę" onClick={() => mut(x => { const a = x.days[di].meals; if (mi > 0) [a[mi - 1], a[mi]] = [a[mi], a[mi - 1]]; })}><ArrowUp size={16} /></button>
                <button className="iconbtn" aria-label="W dół" onClick={() => mut(x => { const a = x.days[di].meals; if (mi < a.length - 1) [a[mi + 1], a[mi]] = [a[mi], a[mi + 1]]; })}><ArrowDown size={16} /></button>
                <button className="iconbtn" aria-label="Usuń posiłek" onClick={() => mut(x => { x.days[di].meals.splice(mi, 1); })}><Trash2 size={16} /></button>
              </div>
            </div>
            <label className="f">Składniki i przygotowanie<textarea id={'mi-' + m.id} value={m.items} onChange={e => mut(x => { x.days[di].meals[mi].items = e.target.value; })} placeholder={'Owsianka z owocami\n• płatki owsiane – 60 g\n• mleko 2% – 250 ml'} style={{ fontFamily: 'var(--body)', minHeight: 96 }} /></label>
            <div className="fields">{[['kcal', 'kcal'], ['P', 'Białko g'], ['F', 'Tłuszcze g'], ['C', 'Węgle g']].map(([k, n]) => <label key={k} className="f">{n}<input id={'m' + k + '-' + m.id} type="number" inputMode="numeric" value={m[k]} onChange={e => mut(x => { x.days[di].meals[mi][k] = num(e.target.value); })} /></label>)}</div>
          </motion.div>))}
        <button className="btn" onClick={() => mut(x => { x.days[di].meals.push(blankMeal('Posiłek ' + (day.meals.length + 1))); })}><Plus size={16} />Dodaj posiłek</button>
      </div>
    </Page>
  );
}

/* ---------- dieta od trenera – widok podopiecznego (i podgląd w karcie podopiecznego) ---------- */
export function CoachDietCard({ diet, who, coachName, compact }) {
  const [di, setDi] = useState(0);
  if (!diet) return null;
  const day = diet.days[Math.min(di, diet.days.length - 1)], tot = dayTotals(day);
  return (
    <div className="card stack coachdiet">
      <div className="spread"><div><p className="eyebrow">Dieta od trenera{diet.coachName || coachName ? ' · ' + (diet.coachName || coachName) : ''}</p><h2>{diet.name}</h2></div>
        <button className="btn" onClick={() => printDiet(diet, who, diet.coachName || coachName)}><FileDown size={16} />Pobierz PDF</button></div>
      <div className="chips"><span className="tag pink">{diet.kcal} kcal</span><span className="tag">B {diet.P} g</span><span className="tag">T {diet.F} g</span><span className="tag">W {diet.C} g</span><span className="tag sky">woda {String(diet.water || 2.5).replace('.', ',')} l</span></div>
      {diet.notes && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{diet.notes}</p>}
      {diet.days.length > 1 && <Seg id={'cd-' + (compact ? 'c' : 'm')} value={String(Math.min(di, diet.days.length - 1))} onChange={v => setDi(+v)} options={diet.days.map((x, i) => [String(i), x.name])} />}
      <p className="xs muted">{day.name}: {tot.kcal} kcal · B {tot.P} g</p>
      <div className="stack" style={{ gap: 8 }}>{day.meals.map(m => <div key={m.id} className="dmeal ro"><div className="spread"><b>{m.time ? m.time + ' · ' : ''}{m.name}</b><span className="xs muted">{m.kcal} kcal · B {m.P} g</span></div>{!compact && <p className="small" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{m.items}</p>}</div>)}</div>
    </div>
  );
}
