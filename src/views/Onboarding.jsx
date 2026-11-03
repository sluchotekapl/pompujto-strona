import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles, Check } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useUI, Bar, Page, comma } from '../components/ui.jsx';
import { burst } from './Today.jsx';
const PJ = () => window.PJ;

const DAYS = [[1, 'Pn'], [2, 'Wt'], [3, 'Śr'], [4, 'Cz'], [5, 'Pt'], [6, 'So'], [0, 'Nd']];
const GOALS = [
  ['redukcja', 'Schudnąć', 'Mniej tkanki tłuszczowej, mięśnie zostają'],
  ['masa', 'Zbudować mięśnie', 'Więcej masy mięśniowej, lekka nadwyżka kalorii'],
  ['sila', 'Być silniejszym', 'Większe ciężary w podstawowych ćwiczeniach'],
  ['zdrowie', 'Zdrowie i kondycja', 'Lepsza forma, energia i samopoczucie']
];
const ACT = [['sedentary', 'Siedząca', 'biuro, auto, mało chodzenia'], ['light', 'Lekko aktywna', 'sporo chodzenia w ciągu dnia'], ['active', 'Aktywna', 'praca na nogach cały dzień'], ['physical', 'Ciężka fizyczna', 'budowa, magazyn, dźwiganie']];
const LVL = [['beginner', 'Początkujący', 'mniej niż rok regularnie albo powrót po długiej przerwie'], ['intermediate', 'Średnio zaawansowany', '1–3 lata regularnych treningów'], ['advanced', 'Zaawansowany', 'ponad 3 lata, znasz technikę bojów']];
const DIETS = [['omni', 'Jem wszystko'], ['pesc', 'Bez mięsa, ryby tak'], ['vege', 'Wegetariańska'], ['vegan', 'Wegańska']];

export function needsInterview(d) { return !d.surveyDone && !(d.program && d.program.coach); }

function Choice({ items, value, onPick, cols }) {
  return <div className="choices" style={cols ? { gridTemplateColumns: `repeat(auto-fit, minmax(${cols}px, 1fr))` } : null}>
    {items.map(([k, n, s]) => <motion.button type="button" whileTap={{ scale: .97 }} key={k} className="choice" aria-pressed={value === k} onClick={() => onPick(k)}><b>{n}</b>{s && <span className="xs muted">{s}</span>}</motion.button>)}
  </div>;
}

export default function Onboarding({ repeat }) {
  const { data: p, update } = useApp();
  const { modal, toast } = useUI();
  const [step, setStep] = useState(0), [dir, setDir] = useState(1);
  const [f, setF] = useState(() => ({
    sex: p.sex || 'm', age: p.surveyDone ? p.age : '', height: p.surveyDone ? p.height : '', weight: p.surveyDone ? p.weight : '', targetWeight: p.targetWeight || '',
    level: p.level, trainDays: p.trainDays.slice(), sessionMin: p.sessionMin, equipPreset: p.equipPreset, equipment: p.equipment.slice(),
    survey: structuredClone(p.survey)
  }));
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const sv = (k, v) => setF(o => ({ ...o, survey: { ...o.survey, [k]: v } }));
  const tog = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : arr.concat(v);
  const num = v => parseFloat(String(v).replace(',', '.'));

  const steps = [
    { t: 'O Tobie', ok: () => num(f.age) >= 14 && num(f.age) <= 90 && num(f.height) >= 130 && num(f.height) <= 220 && num(f.weight) >= 35 && num(f.weight) <= 250, why: 'Wpisz wiek (14–90), wzrost (130–220 cm) i wagę (35–250 kg).' },
    { t: 'Twój cel', ok: () => !!f.survey.goal && (!f.targetWeight || (num(f.targetWeight) >= 35 && num(f.targetWeight) <= 250)), why: 'Wybierz cel. Waga docelowa jest opcjonalna.' },
    { t: 'Codzienność', ok: () => !!f.survey.activity && !!f.level },
    { t: 'Trening', ok: () => f.trainDays.length > 0 && f.equipment.length > 0, why: 'Zaznacz co najmniej jeden dzień i sprzęt.' },
    { t: 'Zdrowie', ok: () => true },
    { t: 'Jedzenie', ok: () => true },
    { t: 'Podsumowanie', ok: () => true }
  ];
  const go = d => {
    if (d > 0 && !steps[step].ok()) return toast(steps[step].why || 'Uzupełnij odpowiedzi');
    setDir(d); setStep(s => Math.max(0, Math.min(steps.length - 1, s + d))); scrollTo(0, 0);
  };

  const preview = useMemo(() => {
    if (step !== steps.length - 1) return null;
    const tmp = Object.assign(structuredClone(p), { sex: f.sex, age: num(f.age), height: num(f.height), weight: num(f.weight), level: f.level, trainDays: f.trainDays, sessionMin: +f.sessionMin, equipment: f.equipment, survey: f.survey });
    const nt = PJ().nutrition(tmp), prog = p.program && p.program.coach ? p.program : PJ().buildProgram(tmp, p.history || []), rs = PJ().restrictions(tmp);
    const diff = f.targetWeight ? num(f.weight) - num(f.targetWeight) : 0;
    const weeks = f.survey.goal === 'redukcja' && diff > 0 && nt.pace ? Math.ceil(diff / nt.pace) : f.survey.goal === 'masa' && diff < 0 ? Math.ceil(-diff / 0.25) : null;
    return { tmp, nt, prog, rs, diff, weeks };
  }, [step]);

  const finish = () => {
    const { tmp, prog, rs } = preview;
    update(x => {
      if (num(f.weight) !== x.weight || !(x.weights || []).length) x.weights = (x.weights || []).concat({ date: new Date().toISOString(), kg: num(f.weight), xp: 0 });
      Object.assign(x, { sex: f.sex, age: num(f.age), height: num(f.height), weight: num(f.weight), targetWeight: f.targetWeight ? num(f.targetWeight) : null, level: f.level, trainDays: f.trainDays, sessionMin: +f.sessionMin, equipPreset: f.equipPreset, equipment: f.equipment, survey: f.survey, surveyDone: true, interviewAt: new Date().toISOString() });
      if (!x.program || !x.program.coach) x.program = PJ().buildProgram(x, x.history || [], x.program);
    });
    burst();
    location.hash = '#dzis'; scrollTo(0, 0);
    toast(p.program && p.program.coach ? 'Gotowe – dieta policzona, plan od trenera zostaje' : 'Gotowe – plan i dieta ułożone pod Ciebie');
    if (rs.doctor) modal(c => <div className="stack"><h2>Najpierw lekarz</h2><p>Twoje odpowiedzi oznaczają, że przed treningami warto uzyskać zgodę lekarza. Plan ma ograniczoną intensywność, ale nie zastąpi konsultacji.</p><button className="btn pri" onClick={c}>Rozumiem</button></div>);
  };

  const Ck = ({ on, onChange, children }) => <label className="check"><input type="checkbox" checked={on} onChange={onChange} />{children}</label>;
  const bmi = num(f.weight) && num(f.height) ? num(f.weight) / (num(f.height) / 100) ** 2 : 0;

  const body = [
    <div className="stack" key="s0">
      <h2>Kilka danych o Tobie</h2>
      <p className="muted">Na ich podstawie liczę zapotrzebowanie kaloryczne i dobieram intensywność treningu.</p>
      <Choice items={[['m', 'Mężczyzna'], ['f', 'Kobieta']]} value={f.sex} onPick={v => set('sex', v)} />
      <div className="grid2">
        <label className="f">Wiek<input id="w-age" type="number" inputMode="numeric" value={f.age} onChange={e => set('age', e.target.value)} placeholder="np. 29" /></label>
        <label className="f">Wzrost (cm)<input id="w-h" type="number" inputMode="numeric" value={f.height} onChange={e => set('height', e.target.value)} placeholder="np. 172" /></label>
        <label className="f">Waga (kg)<input id="w-w" type="number" inputMode="decimal" step="0.1" value={f.weight} onChange={e => set('weight', e.target.value)} placeholder="np. 68,5" /></label>
      </div>
      {bmi > 0 && <p className="small muted">BMI: <b className="num" style={{ color: 'var(--ink)' }}>{comma(bmi.toFixed(1))}</b></p>}
    </div>,
    <div className="stack" key="s1">
      <h2>Co chcesz osiągnąć?</h2>
      <Choice items={GOALS} value={f.survey.goal} onPick={v => sv('goal', v)} cols={220} />
      <label className="f" style={{ maxWidth: 260 }}>Waga docelowa w kg (opcjonalnie)<input id="w-tw" type="number" inputMode="decimal" step="0.1" value={f.targetWeight} onChange={e => set('targetWeight', e.target.value)} placeholder="np. 62" /></label>
      <p className="xs muted">Cel wpływa na kalorie (deficyt, utrzymanie albo nadwyżka) i na rodzaj treningu.</p>
    </div>,
    <div className="stack" key="s2">
      <h2>Twoja codzienność</h2>
      <p className="small">Jak wygląda Twój dzień poza treningiem?</p>
      <Choice items={ACT} value={f.survey.activity} onPick={v => sv('activity', v)} cols={200} />
      <p className="small">Doświadczenie na siłowni</p>
      <Choice items={LVL} value={f.level} onPick={v => set('level', v)} cols={220} />
      <Ck on={f.survey.returning} onChange={e => sv('returning', e.target.checked)}>Wracam po dłuższej przerwie (6+ miesięcy)</Ck>
    </div>,
    <div className="stack" key="s3">
      <h2>Kiedy i gdzie trenujesz?</h2>
      <p className="small">Dni treningowe</p>
      <div className="chips">{DAYS.map(([v, n]) => <button type="button" key={v} className="chip" aria-pressed={f.trainDays.includes(v)} onClick={() => set('trainDays', tog(f.trainDays, v))}>{n}</button>)}</div>
      <p className="xs muted">Na start polecamy 2–3 dni z dniem przerwy pomiędzy.</p>
      <p className="small">Ile masz czasu na trening?</p>
      <div className="chips">{[30, 45, 60, 75, 90].map(m => <button type="button" key={m} className="chip" aria-pressed={+f.sessionMin === m} onClick={() => set('sessionMin', m)}>{m} min</button>)}</div>
      <p className="small">Gdzie trenujesz?</p>
      <Choice items={[['gym', 'Siłownia', 'pełny sprzęt'], ['home', 'W domu', 'hantle, gumy'], ['bodyweight', 'Bez sprzętu', 'masa ciała']]} value={f.equipPreset} onPick={v => setF(o => ({ ...o, equipPreset: v, equipment: PJ().EQUIP_PRESETS[v].slice() }))} cols={160} />
      <details><summary className="small muted" style={{ cursor: 'pointer' }}>Dokładny sprzęt</summary>
        <div className="checks" style={{ marginTop: 10 }}>{Object.entries(PJ().EQUIP).map(([k, n]) => <Ck key={k} on={f.equipment.includes(k)} onChange={() => setF(o => ({ ...o, equipPreset: 'custom', equipment: tog(o.equipment, k) }))}>{n}</Ck>)}</div></details>
    </div>,
    <div className="stack" key="s4">
      <h2>Zdrowie</h2>
      <p className="muted">Zaznacz, co Cię dotyczy. Ćwiczenia, które mogłyby zaszkodzić, zostaną wykluczone z planu.</p>
      <p className="small">Kontuzje lub ból (obecne albo nawracające)</p>
      <div className="checks">{Object.entries(PJ().INJURIES).map(([k, v]) => <Ck key={k} on={f.survey.injuries.includes(k)} onChange={() => sv('injuries', tog(f.survey.injuries, k))}>{v.label}</Ck>)}</div>
      <p className="small">Schorzenia</p>
      <div className="checks">{Object.entries(PJ().CONDITIONS).map(([k, v]) => <Ck key={k} on={f.survey.conditions.includes(k)} onChange={() => sv('conditions', tog(f.survey.conditions, k))}>{v.label}</Ck>)}</div>
      <Ck on={f.survey.doctorLimit} onChange={e => sv('doctorLimit', e.target.checked)}>Lekarz zalecił ograniczenie wysiłku / miewam ból w klatce, zawroty głowy lub omdlenia przy wysiłku</Ck>
      <Ck on={f.survey.pain} onChange={e => sv('pain', e.target.checked)}>Czasem coś mnie boli przy ćwiczeniach</Ck>
    </div>,
    <div className="stack" key="s5">
      <h2>Jedzenie</h2>
      <p className="small">Sposób odżywiania</p>
      <Choice items={DIETS} value={f.survey.diet} onPick={v => sv('diet', v)} cols={150} />
      <p className="small">Alergie i nietolerancje</p>
      <div className="checks">{Object.entries(window.PJ_ALLERGENS).map(([k, n]) => <Ck key={k} on={f.survey.allergies.includes(k)} onChange={() => sv('allergies', tog(f.survey.allergies, k))}>{n}</Ck>)}</div>
      <p className="small">Ile posiłków dziennie Ci pasuje?</p>
      <div className="chips">{[3, 4, 5].map(m => <button type="button" key={m} className="chip" aria-pressed={+f.survey.meals === m} onClick={() => sv('meals', m)}>{m}</button>)}</div>
      <label className="f">Czego nie lubisz? (po przecinku)<input id="w-dis" type="text" value={f.survey.dislikes} onChange={e => sv('dislikes', e.target.value)} placeholder="np. tuńczyk, brokuł, twaróg" /></label>
    </div>,
    preview && <div className="stack" key="s6">
      <h2>Twój plan</h2>
      <div className="tiles">
        <div className="tile"><span className="eyebrow">Kalorie dziennie</span><span className="v num">{preview.nt.kcal}</span><span className="xs muted">{preview.nt.label}</span></div>
        <div className="tile"><span className="eyebrow">Białko</span><span className="v num">{preview.nt.prot}<small> g</small></span></div>
        <div className="tile"><span className="eyebrow">Tłuszcze / węgle</span><span className="v num" style={{ fontSize: '1.2rem' }}>{preview.nt.fat} / {preview.nt.carb}<small> g</small></span></div>
        <div className="tile"><span className="eyebrow">Woda</span><span className="v num">{comma(preview.nt.water)}<small> l</small></span></div>
      </div>
      {preview.weeks ? <div className="banner ok"><div><b>Cel: {comma(num(f.targetWeight))} kg</b>To {comma(Math.abs(preview.diff).toFixed(1))} kg. W bezpiecznym tempie około {preview.weeks} {preview.weeks === 1 ? 'tydzień' : preview.weeks < 5 ? 'tygodnie' : 'tygodni'}.</div></div> : null}
      <div className="card tight stack">
        <b>{preview.prog.name}{p.program && p.program.coach ? ' (od trenera)' : ''}</b>
        <p className="small muted">{f.trainDays.length} {f.trainDays.length === 1 ? 'trening' : 'treningi'} w tygodniu ({DAYS.filter(d => f.trainDays.includes(d[0])).map(d => d[1]).join(', ')}), po ok. {f.sessionMin} min.</p>
        {preview.prog.days.map(d => <p key={d.key} className="xs muted"><b style={{ color: 'var(--ink)' }}>{d.name}:</b> {d.slots.map(s => PJ().BY[s.exId] ? PJ().BY[s.exId].n : '').join(' · ')}</p>)}
      </div>
      {preview.rs.notes.map((n, i) => <div key={i} className="banner info"><div className="small">{n}</div></div>)}
      <p className="xs muted">Przemiana podstawowa {preview.nt.bmr} kcal (wzór Mifflina‑St Jeora), całkowita ok. {preview.nt.tdee} kcal. To nie porada lekarska ani dietetyczna.</p>
    </div>
  ];

  return (
    <Page>
      <div className="stack" style={{ gap: 6 }}>
        <span className="ai-badge" style={{ justifySelf: 'start' }}><Sparkles size={12} />{repeat ? 'Wywiad od nowa' : 'Zanim ułożymy plan'}</span>
        <h1>{repeat ? 'Zaktualizuj swoje dane' : `Cześć${p.name ? ', ' + p.name.split(' ')[0] : ''}! Poznajmy się`}</h1>
        {!repeat && <p className="muted">7 krótkich kroków, ok. 2 minuty. Dopiero na ich podstawie ułożę trening i dietę – nic na ślepo.</p>}
      </div>
      <div className="card stack" style={{ maxWidth: 760 }}>
        <div className="spread small"><span className="eyebrow">Krok {step + 1} z {steps.length} · {steps[step].t}</span><span className="num muted">{Math.round((step + 1) / steps.length * 100)}%</span></div>
        <Bar value={step + 1} max={steps.length} />
        <div style={{ overflow: 'hidden' }}>
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div key={step} custom={dir} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }} transition={{ duration: .22 }}>{body[step]}</motion.div>
          </AnimatePresence>
        </div>
        <div className="spread">
          <button className="btn" onClick={() => go(-1)} disabled={step === 0}><ChevronLeft size={16} />Wstecz</button>
          {step < steps.length - 1
            ? <button className="btn pri" onClick={() => go(1)}>Dalej<ChevronRight size={16} /></button>
            : <button className="btn pri big" onClick={finish}><Check size={18} />Ułóż mój plan i dietę</button>}
        </div>
      </div>
    </Page>
  );
}
