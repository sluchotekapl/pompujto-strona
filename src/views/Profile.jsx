import { useState } from 'react';
import { Save } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useUI, Page, Stagger, Item, comma } from '../components/ui.jsx';
const PJ = () => window.PJ;
const DAYS = [[1, 'Pn'], [2, 'Wt'], [3, 'Śr'], [4, 'Cz'], [5, 'Pt'], [6, 'So'], [0, 'Nd']];
const LVL = { beginner: 'Początkujący', intermediate: 'Średnio zaawansowany', advanced: 'Zaawansowany' };
const GOALS = { redukcja: 'Redukcja tkanki tłuszczowej', zdrowie: 'Zdrowie i kondycja', masa: 'Budowa mięśni', sila: 'Siła' };

export default function Profile() {
  const { data: p, update } = useApp();
  const { modal, toast } = useUI();
  const save = f => {
    update(x => {
      if (+f.weight !== x.weight) x.weights.push({ date: new Date().toISOString(), kg: +f.weight, xp: 0 });
      Object.assign(x, { name: f.name.trim() || x.name, sex: f.sex, age: +f.age || 30, weight: +f.weight || x.weight, height: +f.height || x.height, level: f.level, trainDays: f.trainDays, sessionMin: +f.sessionMin, equipPreset: f.equipPreset, equipment: f.equipment.length ? f.equipment : ['body only'], survey: f.survey, surveyDone: true, targetWeight: f.targetWeight ? +String(f.targetWeight).replace(',', '.') : x.targetWeight });
      if (!x.program || !x.program.coach) x.program = PJ().buildProgram(x, x.history, x.program);
    });
    toast(p.program && p.program.coach ? 'Zapisano – plan od trenera zostaje' : 'Zapisano – plan przeliczony');
    const tmp = Object.assign({}, p, f);
    if (PJ().restrictions(tmp).doctor) modal(c => <div className="stack"><h2>Najpierw lekarz</h2><p>Twoje odpowiedzi oznaczają, że przed treningami warto uzyskać zgodę lekarza. Plan ma ograniczoną intensywność, ale nie zastąpi konsultacji.</p><button className="btn pri" onClick={c}>Rozumiem</button></div>);
    location.hash = '#dzis';
  };
  return (
    <Page>
      <div><p className="eyebrow">Ankieta · {p.name}</p><h1>Twoja ankieta</h1></div>
      <p className="muted">Odpowiedzi wybierają program, wykluczają ćwiczenia, które mogą szkodzić, i dobierają jedzenie. Po zapisaniu plan przelicza się sam.</p>
      <div><a className="btn pri" href="#wywiad">Przejdź wywiad krok po kroku</a></div>
      <SurveyForm p={p} onSave={save} />
    </Page>
  );
}

// Formularz ankiety – używany przez podopiecznego i przez trenera (edycja ankiety podopiecznego).
export function SurveyForm({ p, onSave, submitLabel = 'Zapisz i przelicz plan', idp = 'f' }) {
  const { toast } = useUI();
  const [f, setF] = useState(() => structuredClone({ name: p.name, sex: p.sex, age: p.age, weight: p.weight, height: p.height, targetWeight: p.targetWeight || '', level: p.level, trainDays: p.trainDays, sessionMin: p.sessionMin, equipPreset: p.equipPreset, equipment: p.equipment, survey: p.survey }));
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const sv = (k, v) => setF(o => ({ ...o, survey: { ...o.survey, [k]: v } }));
  const tog = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : arr.concat(v);
  const bmi = f.weight && f.height ? (f.weight / (f.height / 100) ** 2) : 0;
  const submit = e => {
    e.preventDefault();
    if (!f.trainDays.length) return toast('Zaznacz co najmniej jeden dzień');
    onSave(f);
  };
  const Ck = ({ on, onChange, children }) => <label className="check"><input type="checkbox" checked={on} onChange={onChange} />{children}</label>;
  return (
      <form onSubmit={submit} noValidate>
        <Stagger>
          <Item className="card"><fieldset><legend>1. Podstawy</legend>
            <div className="grid2">
              <label className="f">Imię i nazwisko<input id={idp + "-name"} type="text" value={f.name} onChange={e => set('name', e.target.value)} /></label>
              <label className="f">Płeć<select id={idp + "-sex"} value={f.sex} onChange={e => set('sex', e.target.value)}><option value="m">Mężczyzna</option><option value="f">Kobieta</option></select></label>
              <label className="f">Wiek<input id={idp + "-age"} type="number" value={f.age} onChange={e => set('age', e.target.value)} /></label>
              <label className="f">Waga (kg)<input id={idp + "-weight"} type="number" step="0.1" value={f.weight} onChange={e => set('weight', e.target.value)} /></label>
              <label className="f">Waga docelowa (kg)<input id={idp + "-tw"} type="number" step="0.1" value={f.targetWeight} onChange={e => set('targetWeight', e.target.value)} placeholder="opcjonalnie" /></label>
              <label className="f">Wzrost (cm)<input id={idp + "-height"} type="number" value={f.height} onChange={e => set('height', e.target.value)} /></label>
              <label className="f">BMI<input id={idp + "-bmi"} type="text" value={bmi ? comma(bmi.toFixed(1)) : ''} disabled /></label>
            </div>
            <div className="grid2">
              <label className="f">Cel<select id={idp + "-goal"} value={f.survey.goal} onChange={e => sv('goal', e.target.value)}>{Object.entries(GOALS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
              <label className="f">Poziom<select id={idp + "-level"} value={f.level} onChange={e => set('level', e.target.value)}>{Object.entries(LVL).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
              <label className="f">Codzienna aktywność<select id={idp + "-act"} value={f.survey.activity} onChange={e => sv('activity', e.target.value)}><option value="sedentary">Siedząca</option><option value="light">Lekko aktywna</option><option value="active">Aktywna</option><option value="physical">Ciężka fizyczna</option></select></label>
            </div>
            <p className="xs muted">Początkujący = mniej niż rok regularnie albo powrót po długiej przerwie; średni = 1–3 lata; zaawansowany = 3+ lata.</p>
            <Ck on={f.survey.returning} onChange={e => sv('returning', e.target.checked)}>Wracam po dłuższej przerwie (6+ miesięcy)</Ck>
          </fieldset></Item>
          <Item className="card"><fieldset><legend>2. Trening</legend>
            <div className="chips">{DAYS.map(([v, n]) => <button type="button" key={v} className="chip" aria-pressed={f.trainDays.includes(v)} onClick={() => set('trainDays', tog(f.trainDays, v))}>{n}</button>)}</div>
            <div className="grid2">
              <label className="f">Czas na trening<select id={idp + "-min"} value={f.sessionMin} onChange={e => set('sessionMin', +e.target.value)}>{[30, 45, 60, 75, 90].map(m => <option key={m} value={m}>{m} min</option>)}</select></label>
              <label className="f">Gdzie trenujesz<select id={idp + "-eqp"} value={f.equipPreset} onChange={e => { const v = e.target.value; setF(o => ({ ...o, equipPreset: v, equipment: PJ().EQUIP_PRESETS[v] ? PJ().EQUIP_PRESETS[v].slice() : o.equipment })); }}><option value="gym">Siłownia</option><option value="home">Dom (hantle, gumy)</option><option value="bodyweight">Bez sprzętu</option><option value="custom">Własny wybór</option></select></label>
            </div>
            <div className="checks">{Object.entries(PJ().EQUIP).map(([k, n]) => <Ck key={k} on={f.equipment.includes(k)} onChange={() => setF(o => ({ ...o, equipPreset: 'custom', equipment: tog(o.equipment, k) }))}>{n}</Ck>)}</div>
          </fieldset></Item>
          <Item className="card"><fieldset><legend>3. Zdrowie</legend>
            <p className="small">Kontuzje lub ból (obecne albo nawracające)</p>
            <div className="checks">{Object.entries(PJ().INJURIES).map(([k, v]) => <Ck key={k} on={f.survey.injuries.includes(k)} onChange={() => sv('injuries', tog(f.survey.injuries, k))}>{v.label}</Ck>)}</div>
            <p className="small">Schorzenia</p>
            <div className="checks">{Object.entries(PJ().CONDITIONS).map(([k, v]) => <Ck key={k} on={f.survey.conditions.includes(k)} onChange={() => sv('conditions', tog(f.survey.conditions, k))}>{v.label}</Ck>)}</div>
            <Ck on={f.survey.doctorLimit} onChange={e => sv('doctorLimit', e.target.checked)}>Lekarz zalecił ograniczenie wysiłku / miewam ból w klatce, zawroty głowy lub omdlenia przy wysiłku</Ck>
            <Ck on={f.survey.pain} onChange={e => sv('pain', e.target.checked)}>Czasem coś mnie boli przy ćwiczeniach</Ck>
            <p className="xs muted">Np. ból kolana usuwa skoki i ciężkie wykroki, dolny odcinek pleców – martwe ciągi ze sztangą i brzuszki, nadciśnienie ogranicza intensywność.</p>
          </fieldset></Item>
          <Item className="card"><fieldset><legend>4. Odżywianie</legend>
            <div className="chips">{[['omni', 'Jem wszystko'], ['pesc', 'Bez mięsa, ryby tak'], ['vege', 'Wegetariańska'], ['vegan', 'Wegańska']].map(([k, n]) => <button type="button" key={k} className="chip" aria-pressed={f.survey.diet === k} onClick={() => sv('diet', k)}>{n}</button>)}</div>
            <p className="small">Alergie i nietolerancje</p>
            <div className="checks">{Object.entries(window.PJ_ALLERGENS).map(([k, n]) => <Ck key={k} on={f.survey.allergies.includes(k)} onChange={() => sv('allergies', tog(f.survey.allergies, k))}>{n}</Ck>)}</div>
            <div className="grid2">
              <label className="f">Posiłków dziennie<select id={idp + "-meals"} value={f.survey.meals} onChange={e => sv('meals', +e.target.value)}>{[3, 4, 5].map(m => <option key={m}>{m}</option>)}</select></label>
              <label className="f">Czego nie lubisz (po przecinku)<input id={idp + "-dis"} type="text" value={f.survey.dislikes} onChange={e => sv('dislikes', e.target.value)} placeholder="np. tuńczyk, brokuł" /></label>
            </div>
          </fieldset></Item>
          <Item><button className="btn pri big" type="submit"><Save size={18} />{submitLabel}</button></Item>
        </Stagger>
      </form>
  );
}
