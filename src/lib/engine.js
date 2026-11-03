/* pompujto.pl – silnik: plany treningowe, przeciwwskazania, progresja, dieta, nagrody.
   Czyste funkcje bez DOM. Dane: window.PJ_EX, PJ_FOOD, PJ_RULES. */
(function () {
  const EX = window.PJ_EX, BY = {};
  EX.forEach(e => BY[e.id] = e);

  const PATTERN = {
    squat: 'Przysiad', lunge: 'Jednonóż / wykroki', hinge: 'Zawias biodrowy', legiso: 'Nogi – izolacja', calves: 'Łydki',
    hpush: 'Wypychanie poziome', chestiso: 'Klatka – izolacja', vpush: 'Wypychanie nad głowę', shoulderiso: 'Barki – izolacja',
    vpull: 'Przyciąganie pionowe', hpull: 'Wiosłowanie', traps: 'Kaptury', biceps: 'Biceps', triceps: 'Triceps', core: 'Brzuch i core',
    cardio: 'Cardio', full: 'Całe ciało', plyo: 'Dynamika', mobility: 'Rozgrzewka', stretch: 'Rozciąganie'
  };
  const EQUIP = {
    barbell: 'Sztanga', dumbbell: 'Hantle', 'body only': 'Masa ciała', cable: 'Wyciąg', machine: 'Maszyny', kettlebells: 'Kettlebell',
    bands: 'Gumy', bar: 'Drążek', 'medicine ball': 'Piłka lekarska', 'exercise ball': 'Piłka gimnastyczna', 'foam roll': 'Roller', other: 'TRX, liny, skakanka'
  };
  const EQUIP_PRESETS = {
    gym: Object.keys(EQUIP),
    home: ['body only', 'dumbbell', 'bands', 'exercise ball', 'foam roll'],
    bodyweight: ['body only']
  };

  /* ---------- Ankieta: przeciwwskazania ---------- */
  const INJURIES = {
    knee: { label: 'Kolano', block: ['impact', 'kneeStress'] },
    lower_back: { label: 'Dolny odcinek pleców', block: ['axial', 'spinalFlex'] },
    shoulder: { label: 'Bark', block: ['overhead', 'shoulderStress'] },
    wrist: { label: 'Nadgarstek', block: ['wristLoad'] },
    elbow: { label: 'Łokieć', block: ['elbowStress'] },
    neck: { label: 'Szyja / kark', block: ['neckLoad'] },
    hip: { label: 'Biodro', block: ['hipDeep', 'impact'] },
    ankle: { label: 'Kostka / stopa', block: ['impact'] }
  };
  const CONDITIONS = {
    hypertension: { label: 'Nadciśnienie', block: ['headDown'], rpeCap: 7, minReps: 8 },
    heart: { label: 'Choroba serca', block: ['highIntensity', 'impact', 'headDown'], rpeCap: 6, minReps: 10, doctor: true },
    diabetes: { label: 'Cukrzyca / insulinooporność', block: [] },
    asthma: { label: 'Astma', block: ['highIntensity'] },
    osteoporosis: { label: 'Osteoporoza', block: ['spinalFlex'], doctor: true },
    cholesterol: { label: 'Podwyższony cholesterol', block: [] },
    gout: { label: 'Dna moczanowa', block: [] },
    reflux: { label: 'Refluks', block: ['headDown'] },
    pregnancy: { label: 'Ciąża', block: ['impact', 'spinalFlex', 'axial', 'headDown', 'highIntensity'], rpeCap: 6, doctor: true }
  };
  const TAG_REASON = {
    impact: 'skoki i uderzenia obciążają stawy', kneeStress: 'duże obciążenie kolan', axial: 'ciężar na kręgosłupie',
    spinalFlex: 'zgięcia kręgosłupa pod obciążeniem', overhead: 'ruch nad głową', shoulderStress: 'duży zakres w barku',
    wristLoad: 'podpór na dłoniach', elbowStress: 'obciążenie łokcia', neckLoad: 'nacisk na kark', hipDeep: 'głębokie zgięcie biodra',
    headDown: 'głowa poniżej bioder', highIntensity: 'wysoka intensywność'
  };

  function bmi(p) { const h = p.height / 100; return p.weight / (h * h); }

  function restrictions(p) {
    const s = p.survey || {}, blocked = {}, notes = [];
    let rpeCap = 10, minReps = 1, doctor = false;
    (s.injuries || []).forEach(k => { const r = INJURIES[k]; if (r) r.block.forEach(t => (blocked[t] = blocked[t] || []).push(r.label)); });
    (s.conditions || []).forEach(k => {
      const r = CONDITIONS[k]; if (!r) return;
      r.block.forEach(t => (blocked[t] = blocked[t] || []).push(r.label));
      if (r.rpeCap) rpeCap = Math.min(rpeCap, r.rpeCap);
      if (r.minReps) minReps = Math.max(minReps, r.minReps);
      if (r.doctor) doctor = true;
    });
    const b = bmi(p);
    if (b >= 30 || (b >= 28 && s.returning)) {
      (blocked.impact = blocked.impact || []).push(b >= 30 ? 'BMI ≥ 30' : 'powrót po przerwie przy BMI ' + b.toFixed(1));
      notes.push('Na start pomijamy skoki – przy obecnej masie ciała i powrocie po przerwie to zbędne obciążenie kolan i ścięgien. Cardio robimy na rowerze, orbitreku i bieżni (marsz).');
    }
    if (s.doctorLimit) { doctor = true; rpeCap = Math.min(rpeCap, 6); }
    if (doctor) notes.push('Część Twoich odpowiedzi wymaga zgody lekarza na trening. Intensywność jest ograniczona do spokojnego poziomu.');
    if (rpeCap < 10) notes.push(`Intensywność ograniczona do RPE ${rpeCap} (zostają ${10 - rpeCap} powtórzenia w zapasie) i min. ${minReps} powtórzeń w serii – bez wstrzymywania oddechu.`);
    if (s.pain) { notes.push('Ból podczas ćwiczenia = przerwij serię i zamień ćwiczenie. Ostry lub narastający ból skonsultuj z fizjoterapeutą.'); }
    return { blocked, rpeCap, minReps, doctor, notes };
  }

  function whyBlocked(ex, rs) {
    const out = [];
    ex.tags.forEach(t => { if (rs.blocked[t]) out.push(`${TAG_REASON[t]} (${[...new Set(rs.blocked[t])].join(', ')})`); });
    return out;
  }
  function equipOk(ex, p) { const eq = p.equipment && p.equipment.length ? p.equipment : EQUIP_PRESETS.gym; return eq.includes(ex.eq); }
  function allowed(ex, p, rs) { return equipOk(ex, p) && whyBlocked(ex, rs || restrictions(p)).length === 0; }

  /* ---------- Preferencje ćwiczeń (kolejność = priorytet) ---------- */
  const PREF_BASIC = {
    squat: 'Goblet_Squat Leg_Press Dumbbell_Squat_To_A_Bench Box_Squat Chair_Squat Bodyweight_Squat Dumbbell_Squat Hack_Squat Smith_Machine_Squat',
    hinge: 'Barbell_Hip_Thrust Stiff-Legged_Dumbbell_Deadlift Trap_Bar_Deadlift Romanian_Deadlift Hyperextensions_Back_Extensions Butt_Lift_Bridge Pull_Through Single_Leg_Glute_Bridge',
    hpush: 'Dumbbell_Bench_Press Machine_Bench_Press Leverage_Chest_Press Incline_Dumbbell_Press Incline_Push-Up Cable_Chest_Press Dumbbell_Floor_Press Pushups',
    hpull: 'Seated_Cable_Rows One-Arm_Dumbbell_Row Dumbbell_Incline_Row Leverage_Iso_Row Inverted_Row Suspended_Row One-Arm_Kettlebell_Row Bent_Over_Two-Dumbbell_Row',
    vpull: 'Wide-Grip_Lat_Pulldown Close-Grip_Front_Lat_Pulldown V-Bar_Pulldown Underhand_Cable_Pulldowns Band_Assisted_Pull-Up One_Arm_Lat_Pulldown Scapular_Pull-Up',
    vpush: 'Seated_Dumbbell_Press Machine_Shoulder_Military_Press Landmine_Linear_Jammer Dumbbell_Shoulder_Press Standing_Palms-In_Dumbbell_Press',
    lunge: 'Split_Squats Dumbbell_Step_Ups Dumbbell_Rear_Lunge Split_Squat_with_Dumbbells Bodyweight_Walking_Lunge',
    core: 'Dead_Bug Plank Pallof_Press Side_Bridge Bent-Knee_Hip_Raise Reverse_Crunch Cable_Crunch Superman',
    legiso: 'Seated_Leg_Curl Leg_Extensions Lying_Leg_Curls Ball_Leg_Curl Glute_Kickback Thigh_Abductor',
    shoulderiso: 'Face_Pull Band_Pull_Apart Side_Lateral_Raise Reverse_Machine_Flyes Cable_Seated_Lateral_Raise External_Rotation_with_Band',
    biceps: 'Dumbbell_Alternate_Bicep_Curl Hammer_Curls Standing_Biceps_Cable_Curl Machine_Bicep_Curl',
    triceps: 'Triceps_Pushdown_-_Rope_Attachment Triceps_Pushdown Tricep_Dumbbell_Kickback Standing_Dumbbell_Triceps_Extension',
    calves: 'Standing_Calf_Raises Seated_Calf_Raise Standing_Dumbbell_Calf_Raise Calf_Press_On_The_Leg_Press_Machine',
    chestiso: 'Butterfly Cable_Crossover Dumbbell_Flyes Low_Cable_Crossover',
    cardio: 'Walking_Treadmill Elliptical_Trainer Bicycling_Stationary Recumbent_Bike Rowing_Stationary Stairmaster Jogging_Treadmill',
    traps: 'Dumbbell_Shrug Barbell_Shrug'
  };
  const PREF_ADV = Object.assign({}, PREF_BASIC, {
    squat: 'Barbell_Squat Front_Squat_Clean_Grip Hack_Squat Leg_Press Box_Squat Goblet_Squat',
    hinge: 'Barbell_Deadlift Romanian_Deadlift Trap_Bar_Deadlift Barbell_Hip_Thrust Good_Morning Sumo_Deadlift',
    hpush: 'Barbell_Bench_Press_-_Medium_Grip Incline_Dumbbell_Press Dumbbell_Bench_Press Barbell_Incline_Bench_Press_-_Medium_Grip Parallel_Bar_Dip Hammer_Grip_Incline_DB_Bench_Press',
    hpull: 'Bent_Over_Barbell_Row T-Bar_Row_with_Handle One-Arm_Dumbbell_Row Seated_Cable_Rows Dumbbell_Incline_Row',
    vpull: 'Pullups Chin-Up Wide-Grip_Lat_Pulldown Close-Grip_Front_Lat_Pulldown One_Arm_Lat_Pulldown',
    vpush: 'Standing_Military_Press Barbell_Shoulder_Press Seated_Dumbbell_Press Arnold_Dumbbell_Press',
    lunge: 'Elevated_Back_Lunge Smith_Single-Leg_Split_Squat Barbell_Walking_Lunge Dumbbell_Lunges Barbell_Step_Ups',
    core: 'Barbell_Ab_Rollout Knee_Hip_Raise_On_Parallel_Bars Cable_Crunch Pallof_Press Standing_Cable_Wood_Chop Plank',
    biceps: 'Barbell_Curl Incline_Dumbbell_Curl Hammer_Curls Preacher_Curl Cable_Hammer_Curls_-_Rope_Attachment',
    triceps: 'Close-Grip_Barbell_Bench_Press Lying_Dumbbell_Tricep_Extension Triceps_Overhead_Extension_with_Rope Triceps_Pushdown_-_Rope_Attachment Dips_-_Triceps_Version'
  });

  /* ---------- Szablony programów (na bazie uznanych metod) ---------- */
  // slot: [wzorzec, rola, wariant]   rola: main | sec | acc | core
  const S = (p, r, v) => ({ p, r, v: v || 0 });
  const TEMPLATES = {
    fb2: {
      name: 'Full Body A/B – 2 dni', basis: 'Trening całego ciała 2× w tygodniu – minimum skuteczne wg wytycznych ACSM i WHO dla treningu siłowego.',
      days: [
        { key: 'A', name: 'Full Body A', type: 'base', slots: [S('squat', 'main'), S('hpush', 'main'), S('hpull', 'sec'), S('hinge', 'sec', 1), S('shoulderiso', 'acc'), S('core', 'core')] },
        { key: 'B', name: 'Full Body B', type: 'base', slots: [S('hinge', 'main'), S('vpull', 'main'), S('vpush', 'sec'), S('lunge', 'sec'), S('legiso', 'acc'), S('core', 'core', 1)] }]
    },
    fb3: {
      name: 'Full Body A/B – 3 dni', basis: 'Naprzemienne treningi A/B 3× w tygodniu jak w Starting Strength, StrongLifts i GZCLP – każda partia trenowana 1,5× w tygodniu, prosta progresja ciężaru. Zakresy powtórzeń dopasowane do powrotu po przerwie.',
      days: [
        { key: 'A', name: 'Full Body A', type: 'base', slots: [S('squat', 'main'), S('hpush', 'main'), S('hpull', 'sec'), S('hinge', 'sec', 1), S('shoulderiso', 'acc'), S('triceps', 'acc'), S('core', 'core')] },
        { key: 'B', name: 'Full Body B', type: 'base', slots: [S('hinge', 'main'), S('vpull', 'main'), S('vpush', 'sec'), S('lunge', 'sec'), S('legiso', 'acc'), S('biceps', 'acc'), S('core', 'core', 1)] }]
    },
    fbabc: {
      name: 'Full Body A/B/C – 3 dni', basis: 'Trzy różne treningi całego ciała z falowaniem obciążenia (ciężki / średni / objętościowy) – model DUP stosowany przez średniozaawansowanych.',
      days: [
        { key: 'A', name: 'A – siła', type: 'heavy', slots: [S('squat', 'main'), S('hpush', 'main'), S('hpull', 'sec'), S('legiso', 'acc'), S('triceps', 'acc'), S('core', 'core')] },
        { key: 'B', name: 'B – średni', type: 'base', slots: [S('hinge', 'main'), S('vpull', 'main'), S('vpush', 'sec'), S('lunge', 'sec'), S('biceps', 'acc'), S('core', 'core', 1)] },
        { key: 'C', name: 'C – objętość', type: 'vol', slots: [S('squat', 'sec', 1), S('hpush', 'sec', 1), S('hpull', 'main', 1), S('shoulderiso', 'acc'), S('calves', 'acc'), S('chestiso', 'acc'), S('core', 'core', 2)] }]
    },
    ul4: {
      name: 'Góra/Dół – 4 dni', basis: 'Układ Upper/Lower w wersji PHUL: dwa dni siłowe i dwa hipertroficzne. Każda partia 2× w tygodniu – optymalna częstotliwość według badań nad przyrostem mięśni.',
      days: [
        { key: 'U1', name: 'Góra – siła', type: 'heavy', slots: [S('hpush', 'main'), S('hpull', 'main'), S('vpush', 'sec'), S('vpull', 'sec'), S('biceps', 'acc'), S('triceps', 'acc')] },
        { key: 'L1', name: 'Dół – siła', type: 'heavy', slots: [S('squat', 'main'), S('hinge', 'sec', 1), S('lunge', 'sec'), S('legiso', 'acc'), S('calves', 'acc'), S('core', 'core')] },
        { key: 'U2', name: 'Góra – objętość', type: 'vol', slots: [S('hpush', 'main', 1), S('vpull', 'main', 1), S('hpull', 'sec', 1), S('shoulderiso', 'acc'), S('chestiso', 'acc'), S('biceps', 'acc', 1), S('triceps', 'acc', 1)] },
        { key: 'L2', name: 'Dół – objętość', type: 'vol', slots: [S('hinge', 'main'), S('squat', 'sec', 1), S('lunge', 'sec', 1), S('legiso', 'acc', 1), S('legiso', 'acc'), S('calves', 'acc', 1), S('core', 'core', 1)] }]
    },
    ppl: {
      name: 'Push / Pull / Legs', basis: 'Split PPL (wypychanie / przyciąganie / nogi), w wersji 6‑dniowej każda partia 2× w tygodniu. Pierwszy cykl ciężki, drugi objętościowy – jak w popularnym PPL dla zaawansowanych i 5/3/1 Wendlera.',
      days: [
        { key: 'P1', name: 'Push – ciężki', type: 'heavy', slots: [S('hpush', 'main'), S('vpush', 'sec'), S('hpush', 'sec', 1), S('shoulderiso', 'acc', 2), S('triceps', 'acc'), S('triceps', 'acc', 1)] },
        { key: 'Pu1', name: 'Pull – ciężki', type: 'heavy', slots: [S('hinge', 'main'), S('vpull', 'main'), S('hpull', 'sec'), S('shoulderiso', 'acc'), S('biceps', 'acc'), S('biceps', 'acc', 1)] },
        { key: 'L1', name: 'Nogi – ciężki', type: 'heavy', slots: [S('squat', 'main'), S('hinge', 'sec', 1), S('lunge', 'sec'), S('legiso', 'acc'), S('calves', 'acc'), S('core', 'core')] },
        { key: 'P2', name: 'Push – objętość', type: 'vol', slots: [S('vpush', 'main'), S('hpush', 'sec', 2), S('chestiso', 'acc'), S('shoulderiso', 'acc', 2), S('triceps', 'acc', 2), S('core', 'core', 1)] },
        { key: 'Pu2', name: 'Pull – objętość', type: 'vol', slots: [S('hpull', 'main', 1), S('vpull', 'sec', 1), S('hpull', 'sec', 2), S('shoulderiso', 'acc'), S('traps', 'acc'), S('biceps', 'acc', 2)] },
        { key: 'L2', name: 'Nogi – objętość', type: 'vol', slots: [S('hinge', 'main', 1), S('squat', 'sec', 1), S('lunge', 'sec', 1), S('legiso', 'acc', 1), S('legiso', 'acc', 2), S('calves', 'acc', 1)] }]
    }
  };

  function pickTemplate(p) {
    const d = (p.trainDays || []).length || 3, lvl = p.level;
    if (lvl === 'beginner') return d <= 2 ? 'fb2' : d >= 4 ? 'ul4' : 'fb3';
    if (lvl === 'intermediate') return d <= 2 ? 'fb2' : d === 3 ? 'fbabc' : d === 4 ? 'ul4' : 'ppl';
    return d <= 2 ? 'fb2' : d === 3 ? 'fbabc' : d === 4 ? 'ul4' : 'ppl';
  }

  function ranked(pattern, p, rs, exclude) {
    const pref = (p.level === 'beginner' ? PREF_BASIC : PREF_ADV)[pattern];
    const order = pref ? pref.split(' ') : [];
    const pool = EX.filter(e => e.p === pattern && allowed(e, p, rs) && !exclude.has(e.id) && (p.level !== 'beginner' || e.lvl === 'beginner' || order.includes(e.id)));
    const score = e => { const i = order.indexOf(e.id); return i < 0 ? 100 + (e.lvl === 'beginner' ? 0 : 10) : i; };
    return pool.sort((a, b) => score(a) - score(b));
  }

  function buildProgram(p, history, prev) {
    const rs = restrictions(p), tid = pickTemplate(p), t = TEMPLATES[tid];
    const usedCount = {};
    (history || []).forEach(s => s.entries.forEach(e => usedCount[e.exId] = (usedCount[e.exId] || 0) + 1));
    const days = t.days.map(d => {
      const ex = new Set();
      const slots = d.slots.map((sl, si) => {
        let cands = ranked(sl.p, p, rs, ex);
        // trzymamy się ćwiczeń z historii (ciągłość progresji), o ile wciąż są dozwolone
        const keep = prev && prev.tid === tid && prev.days[t.days.indexOf(d)] && prev.days[t.days.indexOf(d)].slots[si];
        let pick = keep && keep.exId && BY[keep.exId] && allowed(BY[keep.exId], p, rs) && !ex.has(keep.exId) ? BY[keep.exId] : null;
        if (!pick && cands.length) {
          const hist = cands.filter(c => usedCount[c.id]);
          pick = sl.v === 0 && hist.length ? hist.sort((a, b) => usedCount[b.id] - usedCount[a.id])[0] : cands[Math.min(sl.v, cands.length - 1)];
        }
        if (pick) ex.add(pick.id);
        return { p: sl.p, r: sl.r, v: sl.v, exId: pick ? pick.id : null };
      }).filter(s => s.exId);
      return { key: d.key, name: d.name, type: d.type, slots };
    });
    return { id: 'pr' + Date.now().toString(36), tid, name: t.name, basis: t.basis, days, createdAt: new Date().toISOString() };
  }

  /* ---------- Faza, deload, preskrypcja ---------- */
  function sessionsInProgram(prog, history) { return history.filter(s => s.programId === prog.id || s.tid === prog.tid).length; }

  function phase(p, prog, history) {
    const n = sessionsInProgram(prog, history);
    if (p.level === 'beginner') {
      const intro = p.survey && p.survey.returning ? 6 : 3;
      if (n < intro) return { key: 'intro', name: 'Wdrożenie', desc: 'Uczysz się techniki i przyzwyczajasz ścięgna. Lekko, 4–5 powtórzeń w zapasie.', done: n, len: intro };
      if (n < 30) return { key: 'base', name: 'Baza', desc: 'Regularna progresja ciężaru co trening lub co tydzień.', done: n - intro, len: 30 - intro };
      return { key: 'grow', name: 'Rozwój', desc: 'Więcej serii, niższe zakresy w głównych bojach. Pora rozważyć plan średniozaawansowany.', done: n - 30, len: 0 };
    }
    return { key: 'cycle', name: 'Cykl ' + (Math.floor(n / ((prog.days.length) * 5)) + 1), desc: 'Cykl 6‑tygodniowy: 5 tygodni pracy i tydzień lżejszy.', done: n % (prog.days.length * 6), len: prog.days.length * 6 };
  }

  function needDeload(p, prog, history) {
    const recent = history.slice(-3);
    if (recent.length === 3 && recent.filter(s => s.feeling >= 5).length >= 2) return 'Dwa z trzech ostatnich treningów oceniłeś jako bardzo ciężkie – dziś lżej, żeby organizm nadrobił regenerację.';
    if (p.level !== 'beginner') {
      const n = sessionsInProgram(prog, history), wk = Math.floor(n / prog.days.length);
      if (wk > 0 && wk % 6 === 5) return 'Szósty tydzień cyklu – tydzień lżejszy (deload). Mniej serii, ten sam ruch.';
    }
    return null;
  }

  const RX = {
    intro: { main: [2, 12, 15, 6, 90], sec: [2, 12, 15, 6, 75], acc: [2, 12, 15, 6, 60], core: [2, 10, 12, 6, 45] },
    base: { main: [3, 8, 12, 7, 120], sec: [3, 10, 12, 7, 90], acc: [2, 12, 15, 8, 60], core: [3, 10, 15, 7, 45] },
    grow: { main: [4, 6, 10, 8, 150], sec: [3, 8, 12, 8, 90], acc: [3, 10, 15, 8, 60], core: [3, 12, 15, 8, 45] },
    heavy: { main: [4, 4, 6, 8, 180], sec: [3, 6, 10, 8, 120], acc: [3, 8, 12, 8, 75], core: [3, 10, 12, 8, 45] },
    hvAdv: { main: [5, 3, 5, 8.5, 210], sec: [4, 6, 8, 8, 150], acc: [3, 8, 12, 8, 75], core: [3, 10, 12, 8, 45] },
    vol: { main: [3, 8, 12, 8, 120], sec: [3, 10, 12, 8, 90], acc: [3, 12, 15, 8.5, 60], core: [3, 12, 15, 8, 45] },
    volAdv: { main: [4, 6, 10, 8, 150], sec: [4, 8, 12, 8.5, 90], acc: [4, 10, 15, 9, 60], core: [3, 12, 15, 8, 45] }
  };

  function prescription(p, day, slot, ph, rs, mods) {
    let key;
    if (p.level === 'beginner') key = ph.key;
    else if (day.type === 'heavy') key = p.level === 'advanced' ? 'hvAdv' : 'heavy';
    else if (day.type === 'vol') key = p.level === 'advanced' ? 'volAdv' : 'vol';
    else key = p.level === 'advanced' ? 'volAdv' : 'base';
    let [sets, lo, hi, rpe, rest] = RX[key][slot.r] || RX[key].acc;
    const ex = BY[slot.exId], rx = slot.rx;
    if (rx) { sets = +rx.sets || sets; lo = +rx.repMin || lo; hi = Math.max(lo, +rx.repMax || hi); rpe = +rx.rpe || rpe; rest = +rx.rest || rest; }
    if (mods.deload) { sets = Math.max(1, Math.round(sets * 0.6)); rpe = Math.min(rpe, 6); }
    if (mods.tired && slot.r !== 'core') { sets = Math.max(1, sets - 1); rpe = Math.max(5, rpe - 1); }
    if (rpe > rs.rpeCap) rpe = rs.rpeCap;
    if (lo < rs.minReps) { hi = Math.max(hi, rs.minReps + 4); lo = rs.minReps; }
    let unit = ex.u, target;
    if (unit === 's' && !rx) { lo = slot.r === 'core' ? (ph.key === 'intro' ? 20 : 30) : 30; hi = lo + 15; if (ex.p === 'full') { lo = 30; hi = 45; } }
    return { sets, repMin: lo, repMax: hi, rpe, rest, unit };
  }

  /* ---------- Progresja ciężaru (podwójna progresja) ---------- */
  function increment(ex) {
    const lower = ['squat', 'hinge', 'lunge', 'legiso', 'calves'].includes(ex.p);
    if (ex.eq === 'barbell') return lower ? 5 : 2.5;
    if (ex.eq === 'dumbbell') return 2;
    if (ex.eq === 'kettlebells') return 4;
    if (ex.eq === 'machine' || ex.eq === 'cable') return lower ? 5 : 2.5;
    return 0;
  }
  function round(w, ex) { const st = ex.eq === 'dumbbell' ? 1 : ex.eq === 'kettlebells' ? 2 : 2.5; return Math.max(0, Math.round(w / st) * st); }
  function logsFor(exId, history) {
    const out = [];
    for (let i = history.length - 1; i >= 0; i--) { const e = history[i].entries.find(x => x.exId === exId && x.sets.some(s => s.done)); if (e) out.push({ e, date: history[i].date }); }
    return out;
  }
  function workWeight(e) { const d = e.sets.filter(s => s.done); return d.length ? Math.max(...d.map(s => +s.w || 0)) : 0; }

  function suggest(ex, rx, history) {
    const logs = logsFor(ex.id, history);
    if (ex.u === 'min') return { w: null, note: '' };
    if (!logs.length) {
      if (ex.eq === 'body only' || ex.eq === 'bar') return { w: 0, note: 'Pierwszy raz – zrób tyle, ile dasz radę z dobrą techniką.' };
      return { w: null, first: true, note: 'Pierwszy raz: dobierz ciężar tak, by po serii zostały 3–4 powtórzenia w zapasie. Zapisz go – następnym razem podpowiem kolejny.' };
    }
    const last = logs[0].e, t = last.target || rx, done = last.sets.filter(s => s.done), w = workWeight(last);
    const hit = done.length >= t.sets && done.every(s => +s.r >= t.repMax);
    const miss = done.length < t.sets || done.some(s => +s.r < t.repMin);
    const inc = increment(ex);
    if (!w || !inc) {
      if (hit) return { w, repBonus: 2, note: `Ostatnio komplet górnego zakresu – dziś celuj w ${t.repMax + 2} ${ex.u === 's' ? 's' : 'powt.'} albo wybierz trudniejszy wariant.` };
      return { w, note: `Ostatnio: ${done.map(s => s.r).join(' / ')}. Dołóż choć jedno powtórzenie.` };
    }
    if (hit && last.hard !== true) return { w: round(w + inc, ex), up: true, note: `↑ Progresja: +${inc} kg. Ostatnio ${w} kg × ${done.map(s => s.r).join('/')} – komplet.` };
    if (miss) {
      const prevMiss = logs[1] && (logs[1].e.sets.filter(s => s.done).length < (logs[1].e.target || rx).sets || logs[1].e.sets.some(s => s.done && +s.r < (logs[1].e.target || rx).repMin));
      if (prevMiss && workWeight(logs[1].e) === w) return { w: round(w * 0.9, ex), down: true, note: `Dwa razy z rzędu poniżej zakresu na ${w} kg – cofamy o 10% i budujemy od nowa.` };
      return { w, note: `Ten sam ciężar (${w} kg). Ostatnio ${done.map(s => s.r).join('/')} – celuj w min. ${t.repMin} w każdej serii.` };
    }
    return { w, note: `Ten sam ciężar (${w} kg), dołóż powtórzenie w każdej serii. Ostatnio ${done.map(s => s.r).join('/')}.` };
  }

  /* ---------- Rozgrzewka, schłodzenie, cardio ---------- */
  const LOWER = ['squat', 'hinge', 'lunge', 'legiso', 'calves'];
  function warmup(day, p, rs) {
    const lower = day.slots.some(s => LOWER.includes(s.p)), upper = day.slots.some(s => !LOWER.includes(s.p) && s.p !== 'core');
    let ids = ['Arm_Circles', 'Cat_Stretch'];
    if (upper) ids.push('Shoulder_Circles', 'Dynamic_Chest_Stretch');
    if (lower) ids.push('Standing_Hip_Circles', 'Worlds_Greatest_Stretch', 'Ankle_Circles');
    ids.push('Torso_Rotation');
    return ids.filter(i => BY[i] && allowed(BY[i], p, rs)).slice(0, 6).map(i => ({ exId: i, amount: BY[i].u === 's' ? '30 s' : '8–10 powt.' }));
  }
  function cooldown(day, p, rs) {
    const lower = day.slots.some(s => LOWER.includes(s.p));
    const ids = lower ? ['Quad_Stretch', 'Hamstring_Stretch', 'Kneeling_Hip_Flexor', 'Lying_Glute', 'Calf_Stretch_Hands_Against_Wall', 'Childs_Pose']
      : ['Chest_And_Front_Of_Shoulder_Stretch', 'Overhead_Lat', 'Triceps_Stretch', 'Upper_Back_Stretch', 'Childs_Pose'];
    return ids.filter(i => BY[i] && allowed(BY[i], p, rs)).slice(0, 4).map(i => ({ exId: i, amount: '30–45 s' }));
  }
  function cardio(p, rs, ph, minutes) {
    const order = PREF_BASIC.cardio.split(' ');
    const c = order.map(i => BY[i]).filter(e => e && allowed(e, p, rs));
    const goal = p.survey && p.survey.goal;
    let min = ph.key === 'intro' ? 10 : goal === 'redukcja' ? 20 : 12;
    if (minutes != null) min = Math.max(0, Math.min(min, minutes));
    if (!min) return null;
    return { exId: c.length ? c[0].id : null, alt: 'Szybki marsz na zewnątrz', min, zone: 'Strefa 2: tempo, przy którym możesz rozmawiać pełnymi zdaniami (ok. 60–70% tętna maks., u Ciebie ~' + hrZone(p) + ' ud./min).' };
  }
  function hrZone(p) { const max = 208 - 0.7 * p.age; return Math.round(max * 0.6) + '–' + Math.round(max * 0.7); }

  /* ---------- Trening dnia ---------- */
  function nextDayIndex(prog, history) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].programId === prog.id || history[i].tid === prog.tid) { const k = prog.days.findIndex(d => d.key === history[i].dayKey); if (k >= 0) return (k + 1) % prog.days.length; }
    }
    return 0;
  }

  function buildSession(p, prog, history, opts) {
    opts = opts || {};
    const rs = restrictions(p), ph = phase(p, prog, history);
    const di = opts.dayIndex != null ? opts.dayIndex : nextDayIndex(prog, history), day = prog.days[di];
    const deloadWhy = needDeload(p, prog, history);
    const rd = opts.readiness || {};
    const tired = rd.sleep === 0 || rd.energy === 0 || rd.pain === 2;
    const mods = { deload: !!deloadWhy, tired };
    const items = day.slots.map((sl, si) => {
      const ex = BY[sl.exId], rx = prescription(p, day, sl, ph, rs, mods), sg = suggest(ex, rx, history);
      if (sg.repBonus) { rx.repMin += sg.repBonus; rx.repMax += sg.repBonus; }
      if (mods.deload && sg.w) sg.w = round(sg.w * 0.9, ex);
      return { slot: si, exId: ex.id, p: sl.p, r: sl.r, target: rx, w: sg.w, note: sg.note, up: sg.up, down: sg.down, first: sg.first, coachNote: sl.note || '' };
    });
    // dopasowanie do czasu sesji
    const est = it => it.reduce((t, x) => t + x.target.sets * ((x.target.unit === 's' ? x.target.repMax : x.target.repMax * 3.5) + x.target.rest), 0) / 60;
    const limit = (p.sessionMin || 60) - 8 - 5; // rozgrzewka + schłodzenie
    let kept = items.slice(), dropped = [];
    while (!prog.coach && est(kept) > limit - 8 && kept.filter(x => x.r === 'acc').length) { const i = kept.map(x => x.r).lastIndexOf('acc'); dropped.push(kept[i]); kept.splice(i, 1); }
    const left = Math.round(limit - est(kept));
    const cd = cardio(p, rs, ph, left);
    const notes = [];
    if (deloadWhy) notes.push(deloadWhy);
    if (tired) notes.push('Słaby sen, mało energii lub mocne zakwasy – dziś o serię mniej i lżej. Lepszy krótszy trening niż żaden.');
    if (dropped.length) notes.push(`Żeby zmieścić się w ${p.sessionMin} min, pominąłem: ${dropped.map(d => BY[d.exId].n).join(', ')}.`);
    const last = history[history.length - 1];
    if (last && (Date.now() - new Date(last.date)) < 20 * 3600e3) notes.push('Ostatni trening był mniej niż dobę temu. Jeśli czujesz zmęczenie, zrób dziś tylko rozgrzewkę i cardio.');
    if (last && last.painNote) notes.push('Ostatnio zgłosiłeś ból: „' + last.painNote + '”. Jeśli wraca, zamień bolesne ćwiczenie na inne.');
    const minutes = Math.round(8 + est(kept) + (cd ? cd.min : 0) + 5);
    return { dayIndex: di, dayKey: day.key, dayName: day.name, phase: ph, items: kept, warmup: warmup(day, p, rs), cooldown: cooldown(day, p, rs), cardio: cd, notes, minutes, deload: !!deloadWhy };
  }

  /* ---------- Rekordy ---------- */
  function e1rm(w, r) { return w * (1 + r / 30); }
  function bestBefore(exId, history) { let b = 0; history.forEach(s => s.entries.forEach(e => { if (e.exId === exId) e.sets.forEach(x => { if (x.done && +x.w > 0) b = Math.max(b, e1rm(+x.w, +x.r)); }); })); return b; }
  function volume(s) { return s.entries.reduce((t, e) => t + e.sets.reduce((a, x) => a + (x.done ? (+x.w || 0) * (+x.r || 0) : 0), 0), 0); }

  /* ---------- Dieta ---------- */
  const ACT = { sedentary: 1.2, light: 1.35, active: 1.5, physical: 1.7 };
  function nutrition(p) {
    const s = p.survey || {}, male = p.sex !== 'f';
    const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (male ? 5 : -161);
    const mult = (ACT[s.activity] || 1.2) + 0.035 * ((p.trainDays || []).length);
    const tdee = bmr * mult;
    const goal = s.goal || 'zdrowie';
    let kcal = tdee, label = 'utrzymanie';
    if (goal === 'redukcja') { kcal = Math.max(tdee * 0.8, tdee - 700, bmr * (male ? 1.0 : 0.95)); label = 'deficyt ~' + Math.round(tdee - kcal) + ' kcal'; }
    if (goal === 'masa') { kcal = tdee * 1.1; label = 'nadwyżka ~' + Math.round(kcal - tdee) + ' kcal'; }
    if (goal === 'sila') { kcal = tdee * 1.05; label = 'lekka nadwyżka'; }
    if ((s.conditions || []).includes('pregnancy')) { kcal = tdee; label = 'bez deficytu – ciąża'; }
    const h = p.height / 100, refW = Math.min(p.weight, 25 * h * h);
    const prot = Math.round((goal === 'redukcja' ? 2.0 : 1.8) * (goal === 'masa' ? p.weight : refW));
    const fat = Math.round(Math.max(0.8 * refW, kcal * 0.25 / 9));
    const carb = Math.max(80, Math.round((kcal - prot * 4 - fat * 9) / 4));
    kcal = Math.round((prot * 4 + fat * 9 + carb * 4) / 10) * 10;
    return {
      bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, label, prot, fat, carb, fiber: Math.round(kcal / 1000 * 14),
      water: Math.round((p.weight * 0.033 + 0.4) * 10) / 10, refW: Math.round(refW),
      pace: goal === 'redukcja' ? Math.round((tdee - kcal) * 7 / 7700 * 100) / 100 : null
    };
  }
  const kcalOf = m => m.P * 4 + m.F * 9 + m.C * 4;
  function foodOk(m, p) {
    const s = p.survey || {}, al = s.allergies || [], diet = s.diet || 'omni', cond = s.conditions || [];
    if (m.a.some(a => al.includes(a))) return false;
    if (diet === 'vegan' && m.k.length) return false;
    if (diet === 'vege' && (m.k.includes('meat') || m.k.includes('fish'))) return false;
    if (diet === 'pesc' && m.k.includes('meat')) return false;
    if (cond.includes('hypertension') && m.f.includes('salty')) return false;
    if (cond.includes('diabetes') && m.f.includes('highGI')) return false;
    if (cond.includes('gout') && m.f.includes('purine')) return false;
    const dis = (s.dislikes || '').toLowerCase().split(/[,;\n]/).map(x => x.trim()).filter(x => x.length > 2);
    if (dis.some(d => m.n.toLowerCase().includes(d) || m.i.some(i => i[0].toLowerCase().includes(d)))) return false;
    return true;
  }
  const SPLIT = { 3: [['b', .3], ['l', .4], ['d', .3]], 4: [['b', .25], ['l', .35], ['s', .15], ['d', .25]], 5: [['b', .25], ['s', .1], ['l', .35], ['s', .1], ['d', .2]] };
  const SLOTNAME = { b: 'Śniadanie', l: 'Obiad', d: 'Kolacja', s: 'Przekąska' };
  function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function scaleMeal(m, target) {
    const f = Math.max(0.6, Math.min(1.8, Math.round(target / kcalOf(m) * 10) / 10));
    const ing = m.i.map(([n, q, u]) => [n, u === 'szt' ? Math.max(0.5, Math.round(q * f * 2) / 2) : u === 'łyżeczka' || u === 'łyżka' ? q : Math.round(q * f / 5) * 5 || q, u]);
    return { id: m.id, n: m.n, r: m.r, f, ing, kcal: Math.round(kcalOf(m) * f), P: Math.round(m.P * f), F: Math.round(m.F * f), C: Math.round(m.C * f) };
  }
  function mealDay(p, dateStr, swaps) {
    const nt = nutrition(p), n = (p.survey && +p.survey.meals) || 4, split = SPLIT[n] || SPLIT[4];
    const ok = window.PJ_FOOD.filter(m => foodOk(m, p)), used = new Set();
    const tr = treatFor(p, dateStr), tIdx = tr && tr.kcal ? split.findIndex(x => x[0] === 'l') : -1;
    return split.map(([slot, share], idx) => {
      if (idx === tIdx) return { slot, name: SLOTNAME[slot] + ' – nagroda', idx, treat: true, id: 'treat-' + tr.id, n: tr.n + (tr.sub ? ' (' + tr.sub + ')' : ''), r: tr.tip || 'Smacznego – zasłużyłeś.', f: 1, ing: [], kcal: tr.kcal, P: tr.P || 0, F: 0, C: 0, planned: Math.round(nt.kcal * share) };
      const pool = ok.filter(m => m.s.split(',').includes(slot) && !used.has(m.id));
      if (!pool.length) return { slot, name: SLOTNAME[slot], idx, empty: true };
      const off = (swaps && swaps[idx]) || 0;
      const pick = pool[(hash(p.id + dateStr + idx) + off) % pool.length];
      used.add(pick.id);
      return Object.assign({ slot, name: SLOTNAME[slot], idx, poolSize: pool.length }, scaleMeal(pick, nt.kcal * share));
    });
  }
  function foodRules(p) {
    const s = p.survey || {}, R = window.PJ_RULES;
    const eat = R.general.eat.slice(), avoid = R.general.avoid.slice(), extra = [];
    const g = R.goal[s.goal]; if (g) { eat.unshift(...g.eat); avoid.unshift(...g.avoid); }
    (s.conditions || []).forEach(c => { const r = R.cond[c]; if (r) extra.push({ title: r.label, eat: r.eat, avoid: r.avoid }); });
    const al = (s.allergies || []).map(a => ({ a, t: R.allergy[a] })).filter(x => x.t);
    return { eat, avoid, extra, allergy: al, diet: R.diet[s.diet] };
  }

  /* ---------- Nagrody ---------- */
  const LEVELS = [[0, 'Rozgrzewka'], [300, 'Świeżak'], [800, 'Regularny'], [1600, 'Wytrwały'], [2800, 'Żelazny'], [4500, 'Stalowy'], [7000, 'Tytanowy'], [10000, 'Kuźnia'], [14000, 'Legenda pompujto']];
  function level(xp) {
    let i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
    const cur = LEVELS[i][0], nxt = LEVELS[i + 1] ? LEVELS[i + 1][0] : cur;
    return { n: i + 1, name: LEVELS[i][1], cur, next: nxt, pct: nxt > cur ? (xp - cur) / (nxt - cur) : 1, nextName: LEVELS[i + 1] && LEVELS[i + 1][1] };
  }
  function weekKey(d) { d = new Date(d); const day = (d.getDay() + 6) % 7; d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - day); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function weekStreak(p, history) {
    const need = Math.max(1, Math.min(2, (p.trainDays || []).length));
    const byW = {}; history.forEach(s => { const k = weekKey(s.date); byW[k] = (byW[k] || 0) + 1; });
    let n = 0, d = new Date(); const cur = weekKey(d);
    if ((byW[cur] || 0) >= need) n++;
    d.setDate(d.getDate() - 7);
    while ((byW[weekKey(d)] || 0) >= need) { n++; d.setDate(d.getDate() - 7); }
    return n;
  }
  function totalXP(st) {
    return st.history.reduce((t, s) => t + (s.xp || 0), 0) + Object.values(st.dietLog || {}).reduce((t, d) => t + (d.xp || 0), 0) + (st.weights || []).reduce((t, w) => t + (w.xp || 0), 0) + ((st.rewards && st.rewards.xp) || 0);
  }
  function sessionXP(s, prs) { const sets = s.entries.reduce((t, e) => t + e.sets.filter(x => x.done).length, 0); return 100 + sets * 5 + prs * 40 + (s.feeling ? 10 : 0); }
  const BADGES = [
    { id: 'first', n: 'Pierwszy krok', d: 'Ukończ pierwszy trening', ic: '1', test: st => st.history.length >= 1 },
    { id: 's5', n: 'Rozruch', d: '5 treningów', ic: '5', test: st => st.history.length >= 5 },
    { id: 's10', n: 'Dycha', d: '10 treningów', ic: '10', test: st => st.history.length >= 10 },
    { id: 's25', n: 'Ćwierć setki', d: '25 treningów', ic: '25', test: st => st.history.length >= 25 },
    { id: 's50', n: 'Półsetka', d: '50 treningów', ic: '50', test: st => st.history.length >= 50 },
    { id: 's100', n: 'Setka', d: '100 treningów', ic: '100', test: st => st.history.length >= 100 },
    { id: 'week', n: 'Pełny tydzień', d: 'Wszystkie zaplanowane treningi w jednym tygodniu', ic: '7', test: (st, p) => { const c = {}; st.history.forEach(s => { const k = weekKey(s.date); c[k] = (c[k] || 0) + 1; }); return Object.values(c).some(v => v >= (p.trainDays || []).length); } },
    { id: 'streak4', n: 'Miesiąc w ruchu', d: '4 tygodnie z rzędu bez przerwy', ic: '4T', test: (st, p) => weekStreak(p, st.history) >= 4 },
    { id: 'streak12', n: 'Kwartał', d: '12 tygodni z rzędu', ic: '12T', test: (st, p) => weekStreak(p, st.history) >= 12 },
    { id: 'pr', n: 'Nowy rekord', d: 'Pobij własny rekord w dowolnym ćwiczeniu', ic: 'PR', test: st => st.history.some(s => (s.prs || []).length) },
    { id: 'pr10', n: 'Kolekcjoner rekordów', d: '10 rekordów', ic: '10PR', test: st => st.history.reduce((t, s) => t + (s.prs || []).length, 0) >= 10 },
    { id: 'ton', n: 'Pierwsza tona', d: '1000 kg w jednym treningu', ic: '1t', test: st => st.history.some(s => volume(s) >= 1000) },
    { id: 'ton10', n: 'Dźwig', d: '10 ton w jednym treningu', ic: '10t', test: st => st.history.some(s => volume(s) >= 10000) },
    { id: 'early', n: 'Ranny ptaszek', d: 'Trening przed 8:00', ic: 'AM', test: st => st.history.some(s => new Date(s.date).getHours() < 8) },
    { id: 'night', n: 'Nocna zmiana', d: 'Trening po 21:00', ic: 'PM', test: st => st.history.some(s => new Date(s.date).getHours() >= 21) },
    { id: 'diet1', n: 'Talerz pod kontrolą', d: 'Pierwszy dzień diety odhaczony', ic: 'D', test: st => Object.values(st.dietLog || {}).some(d => d.xp) },
    { id: 'diet7', n: 'Tydzień na plusie', d: '7 dni diety odhaczonych', ic: '7D', test: st => Object.values(st.dietLog || {}).filter(d => d.xp).length >= 7 },
    { id: 'water', n: 'Nawodniony', d: 'Wypij dzienny cel wody', ic: 'H2O', test: (st, p) => { const t = nutrition(p).water * 1000; return Object.values(st.dietLog || {}).some(d => (d.water || 0) >= t); } },
    { id: 'weigh', n: 'Pod kontrolą', d: '4 pomiary wagi', ic: 'kg', test: st => (st.weights || []).length >= 4 },
    { id: 'minus5', n: 'Minus pięć', d: '−5 kg od pierwszego pomiaru', ic: '−5', test: st => { const w = st.weights || []; return w.length > 1 && w[0].kg - Math.min(...w.map(x => x.kg)) >= 5; } }
  ];
  function badges(st, p) { return BADGES.map(b => Object.assign({ got: !!b.test(st, p) }, b)); }

  /* ---------- Nagrody tygodnia (posiłek-nagroda) ---------- */
  // mały: za sumienny tydzień (ważny do końca następnego tygodnia); duży: za 4 sumienne tygodnie z rzędu (bez terminu)
  const TREATS = [
    { id: 'pizza', P: 45, n: 'Pizza', sub: 'pół dużej albo cała mała', kcal: 1100, tier: 'small', ic: 'PIZZA', tip: 'Cienkie ciasto, dodatki mięsne lub warzywne zamiast podwójnego sera, do picia napój zero albo woda.' },
    { id: 'burger', P: 45, n: 'Burger z frytkami', sub: 'w ulubionej burgerowni', kcal: 1100, tier: 'small', ic: 'BURG', tip: 'Jeden burger, frytki średnie albo do podziału, bez słodkiego napoju. Smakuje tak samo.' },
    { id: 'mcd', P: 35, n: 'Zestaw w McDonald’s', sub: 'kanapka, frytki, napój', kcal: 1000, tier: 'small', ic: 'McD', tip: 'Napój zero zamiast coli oszczędza ok. 200 kcal. Do zestawu możesz dobrać sałatkę zamiast frytek, jeśli wolisz.' },
    { id: 'kebab', P: 45, n: 'Kebab', sub: 'w bułce lub tortilli', kcal: 900, tier: 'small', ic: 'KEB', tip: 'Sos czosnkowy zamiast ostrego majonezowego, dużo surówki.' },
    { id: 'sushi', P: 35, n: 'Sushi', sub: 'zestaw na jedną osobę', kcal: 800, tier: 'small', ic: 'SUSHI', tip: 'Więcej nigiri i maki, mniej rolek w tempurze.' },
    { id: 'deser', P: 8, n: 'Deser lub lody', sub: 'ulubiony, bez liczenia', kcal: 500, tier: 'small', ic: 'LODY', tip: 'Zjedz po obiedzie, a nie zamiast niego.' },
    { id: 'wieczor', P: 50, n: 'Wieczór bez liczenia', sub: 'kolacja na mieście, pizza ze znajomymi', kcal: 1500, tier: 'big', ic: 'FREE', tip: 'Jeden wieczór luzu po miesiącu pracy. Jutro normalnie wracasz do planu.' },
    { id: 'sprzet', n: 'Nowy sprzęt lub ciuchy', sub: 'buty, koszulka, rękawiczki', kcal: 0, tier: 'big', ic: 'GEAR', tip: 'Nagroda, która motywuje do kolejnych treningów.' },
    { id: 'masaz', n: 'Masaż', sub: 'sportowy lub relaksacyjny', kcal: 0, tier: 'big', ic: 'SPA', tip: 'Świetny na regenerację po miesiącu treningów.' }
  ];
  const DIET_NEED = 5;
  function weekStart(wk) { return new Date(wk + 'T00:00:00'); }
  function weekStatus(p, wk) {
    const need = Math.max(1, (p.trainDays || []).length);
    const tr = p.history.filter(s => weekKey(s.date) === wk).length;
    const diet = Object.entries(p.dietLog || {}).filter(([d, v]) => weekKey(d + 'T12:00:00') === wk && v.xp > 0).length;
    return { wk, tr, need, diet, dietNeed: DIET_NEED, ok: tr >= need && diet >= DIET_NEED };
  }
  function rewardTokens(p) {
    const now = new Date(), cur = weekKey(now), out = [];
    const firstDates = [p.createdAt, ...p.history.map(s => s.date), ...Object.keys(p.dietLog || {}).map(d => d + 'T12:00:00')].filter(Boolean).map(d => new Date(d));
    let d = weekStart(weekKey(new Date(Math.min(...firstDates, now))));
    let run = 0;
    while (weekKey(d) <= cur) {
      const wk = weekKey(d), st = weekStatus(p, wk);
      if (st.ok) {
        run++;
        const exp = new Date(d); exp.setDate(exp.getDate() + 14);
        out.push({ id: 'w:' + wk, tier: 'small', wk, expires: exp.toISOString() });
        if (run % 4 === 0) out.push({ id: 'b:' + wk, tier: 'big', wk, expires: null });
      } else if (wk !== cur) run = 0;
      d.setDate(d.getDate() + 7);
    }
    ((p.rewards && p.rewards.bonus) || []).forEach(t => out.push({ id: t.id, tier: t.tier || 'small', wk: weekKey(t.date), expires: t.tier === 'big' ? null : new Date(new Date(t.date).getTime() + 14 * 864e5).toISOString(), bonus: t.from || 'Koło nagród' }));
    const red = ((p.rewards && p.rewards.redeemed) || []).map(r => r.token);
    return out.map(t => Object.assign(t, { used: red.includes(t.id), expired: !!(t.expires && new Date(t.expires) < now) }));
  }
  function treatList(p) { return TREATS.concat(((p.rewards && p.rewards.custom) || []).map(c => Object.assign({ custom: true, ic: 'MOJE', kcal: c.kcal || 0, tip: '' }, c))); }
  function treatFor(p, dateStr) { const r = ((p.rewards && p.rewards.redeemed) || []).find(x => x.plannedFor === dateStr); if (!r) return null; const t = treatList(p).find(x => x.id === r.treatId); return t ? Object.assign({ r }, t) : null; }

  window.PJ = { TREATS, DIET_NEED, weekStatus, rewardTokens, treatList, treatFor, EX, BY, PATTERN, EQUIP, EQUIP_PRESETS, INJURIES, CONDITIONS, TEMPLATES, bmi, restrictions, whyBlocked, allowed, equipOk, ranked, buildProgram, buildSession, phase, suggest, e1rm, bestBefore, volume, nutrition, mealDay, foodRules, foodOk, kcalOf, level, weekKey, weekStreak, totalXP, sessionXP, badges, hrZone, SLOTNAME };
})();
