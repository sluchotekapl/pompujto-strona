// Trener AI. Kolejność dostawców:
// 1) funkcja Netlify (/.netlify/functions/ai) z kluczem Gemini (lub Claude) – produkcja
// 2) wbudowane „zapytaj Claude” w podglądzie artefaktu
// 3) brak AI → algorytm lokalny (zawsze działa)
import { api } from './backend.js';
const PJ = () => window.PJ;

let sampleP = null;
function getSample() {
  if (!sampleP) sampleP = (window.claude && window.claude.use ? window.claude.use('sample') : Promise.resolve(null)).catch(() => null);
  return sampleP;
}
let fnState = 'unknown'; // unknown | ok | off

export async function aiAvailable() {
  if (fnState === 'ok') return 'cloud';
  if (await getSample()) return 'sample';
  if (fnState === 'off') return null;
  if (location.hostname.endsWith('claudeusercontent.com') || location.hostname.endsWith('claude.ai')) { fnState = 'off'; return null; }
  return 'maybe';
}

export async function ask(system, messages, opts = {}) {
  if (typeof messages === 'string') messages = [{ role: 'user', content: messages }];
  if (fnState !== 'off') {
    try {
      const tok = await api.token();
      const r = await fetch('/.netlify/functions/ai', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, tok ? { authorization: 'Bearer ' + tok } : {}), body: JSON.stringify({ system, messages, max_tokens: opts.maxTokens || 1500 }) });
      if (r.ok) { fnState = 'ok'; const d = await r.json(); opts.onText && opts.onText(d.text); return d.text; }
      if ([404, 405, 501, 503].includes(r.status)) fnState = 'off';
      else { const d = await r.json().catch(() => ({})); throw new Error(d.message || 'AI chwilowo nie odpowiada (' + r.status + ').'); }
    } catch (e) { if (fnState !== 'off' && !(e instanceof TypeError)) throw e; fnState = 'off'; }
  }
  const s = await getSample();
  if (s) {
    const input = [{ role: 'user', content: 'INSTRUKCJE SYSTEMOWE:\n' + system + '\n\n---\n' + messages[0].content }].concat(messages.slice(1));
    const r = await s(input, { onText: opts.onText ? ({ text }) => opts.onText(text) : undefined, cache: false, modelTier: opts.tier || 'default' });
    return r.text;
  }
  const e = new Error('offline'); e.code = 'offline'; throw e;
}

/* ---------- kontekst użytkownika dla AI ---------- */
const LVL = { beginner: 'początkujący', intermediate: 'średnio zaawansowany', advanced: 'zaawansowany' };
const DN = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
export function profileBrief(p) {
  const s = p.survey, rs = PJ().restrictions(p), nt = PJ().nutrition(p);
  const inj = s.injuries.map(k => PJ().INJURIES[k].label), cond = s.conditions.map(k => PJ().CONDITIONS[k].label);
  const last = p.history.slice(-5).map(h => `${h.date.slice(0, 10)} ${h.dayName}: ocena ${h.feeling}/5${h.painNote ? ', ból: ' + h.painNote : ''}; ` + h.entries.map(e => `${PJ().BY[e.exId] ? PJ().BY[e.exId].n : e.exId} ${e.sets.filter(x => x.done).map(x => (x.w ? x.w + 'kg×' : '') + x.r).join(',')}`).join('; ')).join('\n');
  const w = p.weights || [];
  return `Osoba: ${p.name}, ${p.sex === 'f' ? 'kobieta' : 'mężczyzna'}, ${p.age} lat, ${p.weight} kg, ${p.height} cm, BMI ${PJ().bmi(p).toFixed(1)}.
Poziom: ${LVL[p.level]}${s.returning ? ', wraca po długiej przerwie' : ''}. Cel: ${s.goal}. Praca: ${s.activity}.
Dni treningowe: ${p.trainDays.map(d => DN[d]).join(', ')}, ${p.sessionMin} min. Sprzęt: ${p.equipment.join(', ')}.
Kontuzje: ${inj.join(', ') || 'brak'}. Schorzenia: ${cond.join(', ') || 'brak'}${s.doctorLimit ? '. LEKARZ OGRANICZYŁ WYSIŁEK' : ''}.
Limity: maks. RPE ${rs.rpeCap}, min. powtórzeń ${rs.minReps}. ${rs.notes.join(' ')}
Dieta: ${s.diet}, alergie: ${s.allergies.join(', ') || 'brak'}. Cel kcal ${nt.kcal}, białko ${nt.prot} g.
Treningów łącznie: ${p.history.length}. Waga: ${w.length ? w.map(x => x.kg).join(' → ') : p.weight} kg.
Ostatnie treningi:\n${last || 'brak'}`;
}

const SYS_COACH = `Jesteś Trenerem AI w aplikacji pompujto.pl. Mówisz po polsku, konkretnie, ciepło i z lekkim humorem siłowni, jak dobry trener personalny. Odpowiadasz krótko (do ~150 słów), w punktach, gdy to pomaga.
Zasady: opierasz się na uznanych metodach (ACSM, progresja liniowa, RPE/RIR, Talerz Zdrowego Żywienia). Nie diagnozujesz – przy bólu ostrym, w klatce piersiowej, zawrotach głowy kierujesz do lekarza lub fizjoterapeuty. Nie doradzasz sterydów, SARM-ów ani leków – mimo żartobliwego logo strony odmawiasz i proponujesz legalne metody. Respektujesz kontuzje i schorzenia z profilu.`;

export async function coachReply(p, history, onText) {
  const ses = p.program ? PJ().buildSession(p, p.program, p.history) : null;
  const today = ses ? `Najbliższy trening: ${ses.dayName}: ` + ses.items.map(i => `${PJ().BY[i.exId].n} ${i.target.sets}×${i.target.repMin}-${i.target.repMax}${i.w ? ' ' + i.w + 'kg' : ''}`).join('; ') : 'brak planu';
  const sys = SYS_COACH + '\n\nPROFIL:\n' + profileBrief(p) + '\n' + today;
  return ask(sys, history.slice(-12), { onText });
}

/* ---------- plan od AI ---------- */
export async function aiProgram(p, wish) {
  const rs = PJ().restrictions(p);
  const byPat = {};
  PJ().EX.forEach(e => { if (PJ().allowed(e, p, rs) && !['mobility', 'stretch', 'cardio'].includes(e.p)) (byPat[e.p] = byPat[e.p] || []).push(e.id + ' (' + e.n + (e.lvl !== 'beginner' ? ', średniozaaw.' : '') + ')'); });
  const lib = Object.entries(byPat).map(([k, v]) => `${k} – ${PJ().PATTERN[k]}: ${v.join('; ')}`).join('\n');
  const tpls = Object.entries(PJ().TEMPLATES).map(([k, t]) => `${k}: ${t.name} – ${t.days.length} dni`).join('\n');
  const sys = SYS_COACH + `\nTeraz układasz plan treningowy. Odpowiadasz WYŁĄCZNIE poprawnym JSON-em, bez komentarzy i bez bloku kodu.`;
  const prompt = `PROFIL:\n${profileBrief(p)}\n\nŻYCZENIE OSOBY: ${wish || 'brak – dobierz optymalnie'}\n\nDOSTĘPNE SZABLONY (tid):\n${tpls}\n\nDOZWOLONE ĆWICZENIA (wzorzec – id (nazwa)). Używaj TYLKO tych id:\n${lib}\n
Ułóż plan: liczba dni w "days" = liczba dni treningowych osoby (maks. 6). Każdy dzień 5–8 ćwiczeń: zacznij od 1–2 głównych wielostawowych (r:"main"), potem "sec", "acc", na końcu 1 "core". Rozkładaj partie równomiernie w tygodniu, nie powtarzaj ćwiczenia w jednym dniu. Typ dnia: "base" dla początkujących, "heavy" lub "vol" dla reszty.
Format:
{"tid":"<najbliższy szablon>","name":"<krótka nazwa planu>","why":"<2–3 zdania: dlaczego taki plan dla tej osoby>","days":[{"key":"A","name":"<nazwa dnia>","type":"base|heavy|vol","slots":[{"exId":"<id>","r":"main|sec|acc|core"}]}],"tips":["<3 krótkie wskazówki na start>"]}`;
  const txt = await ask(sys, prompt, { maxTokens: 3000, tier: 'default' });
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI nie zwróciło planu. Spróbuj jeszcze raz.');
  const j = JSON.parse(m[0]);
  const days = (j.days || []).slice(0, 6).map((d, i) => {
    const seen = new Set();
    const slots = (d.slots || []).map(s => {
      const ex = PJ().BY[s.exId];
      if (!ex || seen.has(ex.id) || !PJ().allowed(ex, p, rs)) return null;
      seen.add(ex.id);
      return { p: ex.p, r: ['main', 'sec', 'acc', 'core'].includes(s.r) ? s.r : 'acc', v: 0, exId: ex.id };
    }).filter(Boolean).slice(0, 9);
    return { key: String(d.key || 'ABCDEF'[i]).slice(0, 4), name: String(d.name || 'Dzień ' + (i + 1)).slice(0, 40), type: ['base', 'heavy', 'vol'].includes(d.type) ? d.type : 'base', slots };
  }).filter(d => d.slots.length >= 3);
  if (!days.length) throw new Error('AI ułożyło plan z niedozwolonych ćwiczeń. Spróbuj jeszcze raz.');
  return { id: 'pr' + Date.now().toString(36), tid: PJ().TEMPLATES[j.tid] ? j.tid : 'fb3', name: String(j.name || 'Plan od Trenera AI').slice(0, 60), basis: String(j.why || ''), tips: (j.tips || []).slice(0, 4).map(String), ai: true, days, createdAt: new Date().toISOString() };
}

/* ---------- komentarz po treningu ---------- */
export async function aiAfterWorkout(p, s) {
  const sys = SYS_COACH + '\nPiszesz 2–3 zdania komentarza po treningu: pochwała za konkret, jedna rzecz na następny raz. Bez nagłówków.';
  const txt = `PROFIL:\n${profileBrief(p)}\n\nDZISIEJSZY TRENING: ${s.dayName}, ocena ${s.feeling}/5, ${s.durationMin} min, rekordy: ${s.prs.length}.`;
  return ask(sys, txt, { maxTokens: 300, tier: 'quick' });
}
