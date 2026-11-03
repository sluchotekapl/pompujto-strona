// Logika trenera: przyjmowanie zmian od trenera po stronie podopiecznego + statystyki do monitorowania.
const PJ = () => window.PJ;

// Podopieczny: nanieś na swoje dane to, co ustawił trener (plan, ankieta). Zwraca listę zmian do pokazania.
export function applyCoach(d, coach) {
  const out = [];
  coach = coach || {};
  d._coach = coach;
  d.coachSeen = d.coachSeen || {};
  if (coach.program && (coach.programV || 0) > (d.coachSeen.programV || 0)) {
    d.program = coach.program;
    d.coachSeen.programV = coach.programV;
    out.push('Trener ustawił Ci nowy plan: ' + coach.program.name);
  }
  if (coach.profile && (coach.profileV || 0) > (d.coachSeen.profileV || 0)) {
    const pr = coach.profile;
    ['level', 'trainDays', 'sessionMin', 'equipment', 'equipPreset', 'age', 'height', 'sex'].forEach(k => { if (pr[k] !== undefined) d[k] = pr[k]; });
    if (pr.survey) d.survey = Object.assign({}, d.survey, pr.survey);
    d.surveyDone = true;
    d.coachSeen.profileV = coach.profileV;
    if (!coach.program || (coach.programV || 0) <= (d.coachSeen.programV || 0)) {
      if (!d.program || !d.program.coach) d.program = PJ().buildProgram(d, d.history, d.program);
    }
    out.push('Trener zaktualizował Twoją ankietę');
  }
  if (coach.diet && (coach.dietV || 0) > (d.coachSeen.dietV || 0)) {
    d.coachDiet = coach.diet;
    d.coachSeen.dietV = coach.dietV;
    out.push('Trener przygotował Ci dietę: ' + coach.diet.name);
  }
  return out;
}

const DAY = 864e5;
export function clientStats(d) {
  const now = Date.now(), wk = PJ().weekKey(new Date()), st = PJ().weekStatus(d, wk), h = d.history || [];
  const last = h[h.length - 1], w = d.weights || [];
  const daysSince = last ? Math.floor((now - new Date(last.date)) / DAY) : null;
  // regularność: treningi z ostatnich 4 pełnych tygodni / plan
  const need = Math.max(1, (d.trainDays || []).length);
  let done4 = 0; for (let i = 1; i <= 4; i++) { const x = new Date(now - i * 7 * DAY); done4 += h.filter(s => PJ().weekKey(s.date) === PJ().weekKey(x)).length; }
  const started = new Date(d.createdAt || now), weeksOld = Math.min(4, Math.max(0, Math.floor((now - started) / (7 * DAY))));
  const adherence = weeksOld ? Math.min(100, Math.round(done4 / (need * weeksOld) * 100)) : null;
  const pains = h.filter(s => s.painNote && now - new Date(s.date) < 14 * DAY).map(s => ({ date: s.date, note: s.painNote }));
  const lv = PJ().level(PJ().totalXP(d));
  const dw = w.length > 1 ? +(w[w.length - 1].kg - w[0].kg).toFixed(1) : 0;
  const prs = h.slice(-10).reduce((t, s) => t + (s.prs || []).length, 0);
  return { st, last, daysSince, adherence, pains, lv, dw, total: h.length, prs };
}

export function alertsFor(u) {
  const d = u.data, s = clientStats(d), a = [];
  if (!d.surveyDone) a.push({ k: 'survey', t: 'Ankieta niewypełniona', tone: 'gold' });
  if (s.daysSince === null && !u.offline) a.push({ k: 'none', t: 'Jeszcze żadnego treningu', tone: 'gold' });
  else if (s.daysSince !== null && s.daysSince >= 7) a.push({ k: 'idle', t: `${s.daysSince} dni bez treningu`, tone: 'red' });
  if (s.pains.length) a.push({ k: 'pain', t: 'Zgłosił ból: ' + s.pains[s.pains.length - 1].note, tone: 'red' });
  const c = u.coach || {};
  if (!u.offline && c.programV && (d.coachSeen || {}).programV !== c.programV) a.push({ k: 'sync', t: 'Plan czeka na otwarcie aplikacji', tone: 'sky' });
  if (PJ().restrictions(d).doctor) a.push({ k: 'doc', t: 'Wymaga zgody lekarza', tone: 'red' });
  // waga stoi przy redukcji (≥3 pomiary w 3 tygodnie, zmiana < 0,3 kg)
  const ws = (d.weights || []).filter(w => Date.now() - new Date(w.date).getTime() < 21 * DAY);
  if ((d.survey || {}).goal === 'redukcja' && ws.length >= 3 && Math.abs(ws[ws.length - 1].kg - ws[0].kg) < 0.3) a.push({ k: 'plateau', t: 'Waga stoi od 3 tygodni', tone: 'gold' });
  if (!u.offline && (d.history || []).length >= 2 && !(d.weights || []).some(w => Date.now() - new Date(w.date).getTime() < 14 * DAY)) a.push({ k: 'noweigh', t: 'Brak ważenia od 2 tygodni', tone: 'sky' });
  const ci = (d.checkins || [])[(d.checkins || []).length - 1];
  if (ci && Date.now() - new Date(ci.date).getTime() < 8 * DAY && (ci.mood <= 2 || ci.sleep <= 2 || ci.energy <= 2)) a.push({ k: 'lowci', t: 'Słaby tydzień w check-inie' + (ci.note ? ': ' + ci.note : ''), tone: 'gold' });
  const lastS = (d.history || [])[(d.history || []).length - 1];
  if (lastS && lastS.prs && lastS.prs.length && Date.now() - new Date(lastS.date).getTime() < 3 * DAY) a.push({ k: 'pr', t: '🏆 Nowy rekord – pogratuluj!', tone: 'mint' });
  return a;
}

// najlepszy szacowany ciężar maksymalny w ćwiczeniu: pierwszy vs ostatni trening
export function liftProgress(d) {
  const map = {};
  (d.history || []).forEach(s => s.entries.forEach(e => {
    const top = Math.max(0, ...e.sets.filter(x => x.done && x.w > 0).map(x => PJ().e1rm(x.w, x.r)));
    if (!top) return;
    const m = map[e.exId] = map[e.exId] || { exId: e.exId, first: top, best: top, last: top, n: 0, firstDate: s.date, lastDate: s.date };
    m.best = Math.max(m.best, top); m.last = top; m.n++; m.lastDate = s.date;
  }));
  return Object.values(map).sort((a, b) => b.n - a.n).slice(0, 8);
}

export const blankProgram = name => ({ id: 'pr' + Date.now().toString(36), tid: 'coach', coach: true, name: name || 'Nowy plan', basis: '', days: [{ key: 'A', name: 'Dzień A', type: 'base', slots: [] }], createdAt: new Date().toISOString() });

// plan → postać edytowalna: każdemu ćwiczeniu dopisz serie/powtórzenia (z tego, co wyliczyłby silnik)
export function toEditable(prog, d) {
  const p = structuredClone(prog);
  p.days.forEach((day, di) => {
    let ses = null;
    try { ses = PJ().buildSession(d, prog, [], { dayIndex: di }); } catch (e) { }
    day.slots.forEach((sl, si) => {
      if (!sl.rx) {
        const it = ses && ses.items.find(x => x.slot === si);
        const t = it ? it.target : { sets: 3, repMin: 8, repMax: 12, rpe: 7, rest: 90 };
        sl.rx = { sets: t.sets, repMin: t.repMin, repMax: t.repMax, rpe: t.rpe, rest: t.rest };
      }
      sl.note = sl.note || '';
    });
  });
  p.coach = true; if (p.tid !== 'coach' && !PJ().TEMPLATES[p.tid]) p.tid = 'coach';
  return p;
}

export function planText(prog) {
  return prog.name + '\n\n' + prog.days.map(d => `${d.name}\n` + d.slots.map((s, i) => { const ex = PJ().BY[s.exId], r = s.rx || {}; return `${i + 1}. ${ex ? ex.n : s.exId} – ${r.sets || 3} × ${r.repMin || 8}–${r.repMax || 12}${ex && ex.u === 's' ? ' s' : ''}, przerwa ${r.rest || 90} s${s.note ? ' (' + s.note + ')' : ''}`; }).join('\n')).join('\n\n');
}
