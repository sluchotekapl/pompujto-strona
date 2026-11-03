// Diety rozpisywane przez trenera: model danych, generator z bazy posiłków, AI i wydruk do PDF.
import { ask, profileBrief } from './ai.js';
const PJ = () => window.PJ;
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export const blankMeal = (name = 'Posiłek', time = '') => ({ id: uid('m'), name, time, items: '', kcal: 0, P: 0, F: 0, C: 0 });
export const blankDiet = name => ({ id: uid('dt'), name: name || 'Nowa dieta', kcal: 2000, P: 140, F: 70, C: 200, water: 2.5, notes: '', days: [{ key: 'A', name: 'Dzień A', meals: [blankMeal('Śniadanie', '8:00'), blankMeal('Obiad', '13:30'), blankMeal('Przekąska', '16:30'), blankMeal('Kolacja', '19:30')] }], createdAt: new Date().toISOString() });
export const dayTotals = day => day.meals.reduce((t, m) => ({ kcal: t.kcal + (+m.kcal || 0), P: t.P + (+m.P || 0), F: t.F + (+m.F || 0), C: t.C + (+m.C || 0) }), { kcal: 0, P: 0, F: 0, C: 0 });

const TIMES = { b: '8:00', l: '13:30', d: '19:30', s: '16:30' };
// Generator: 3 dni z bazy posiłków aplikacji, dopasowane do kalorii, alergii i diety osoby
export function generateDiet(p, name) {
  const nt = PJ().nutrition(p);
  const days = ['A', 'B', 'C'].map((k, i) => {
    const d = new Date(); d.setDate(d.getDate() + i * 3);
    const ds = d.toISOString().slice(0, 10);
    const meals = PJ().mealDay(Object.assign({}, p, { rewards: { redeemed: [] } }), ds, {}).filter(m => !m.empty).map(m => ({
      id: uid('m'), name: m.name, time: TIMES[m.slot] || '', items: m.n + '\n' + (m.ing || []).map(([n, q, u]) => `• ${n} – ${String(q).replace('.', ',')} ${u}`).join('\n'),
      kcal: m.kcal || 0, P: m.P || 0, F: m.F || 0, C: m.C || 0
    }));
    return { key: k, name: 'Dzień ' + k, meals };
  });
  return { id: uid('dt'), name: name || `Dieta ${nt.kcal} kcal – ${nt.label}`, kcal: nt.kcal, P: nt.prot, F: nt.fat, C: nt.carb, water: nt.water, notes: 'Dni A, B, C rotuj w tygodniu (A-B-C-A-B-C-A). Posiłki z tego samego dnia możesz zamieniać kolejnością.', days, createdAt: new Date().toISOString() };
}

// AI: dieta pod profil (podopiecznego albo opis od trenera)
export async function aiDiet(p, wish) {
  const nt = PJ().nutrition(p), fr = PJ().foodRules(p), s = p.survey || {};
  const alg = (s.allergies || []).map(k => (window.PJ_ALLERGENS || {})[k] || k).join(', ') || 'brak';
  const sys = `Jesteś dietetykiem sportowym w aplikacji pompujto.pl. Piszesz po polsku, prostymi, dostępnymi w Polsce produktami (Biedronka/Lidl), z gramaturą. Nie diagnozujesz. Odpowiadasz WYŁĄCZNIE poprawnym JSON-em bez komentarzy i bez bloku kodu.`;
  const prompt = `PROFIL:\n${profileBrief(p)}\n\nCEL KALORYCZNY: ${nt.kcal} kcal (${nt.label}), białko ${nt.prot} g, tłuszcze ${nt.fat} g, węglowodany ${nt.carb} g, woda ${nt.water} l.
Liczba posiłków: ${s.meals || 4}. Dieta: ${s.diet || 'wszystkożerna'}. Alergie/nietolerancje (NIE używaj): ${alg}. Nie lubi: ${s.dislikes || '—'}.
Zalecenia zdrowotne: ${fr.extra && fr.extra.length ? fr.extra.join(' ') : 'standardowe'}. Unikaj: ${fr.avoid.slice(0, 8).join(', ')}.
ŻYCZENIA TRENERA: ${wish || 'brak – ułóż optymalnie'}

Ułóż 3 różne dni (A, B, C) do rotacji. Każdy dzień ma sumą trafić w cel ±5%. Każdy posiłek: nazwa dania i lista składników z gramaturą (każdy składnik w nowej linii zaczynającej się od "• "), plus krótki sposób przygotowania w 1 zdaniu.
Format:
{"name":"<krótka nazwa diety>","notes":"<3–4 krótkie zasady dla podopiecznego>","days":[{"key":"A","name":"Dzień A","meals":[{"name":"Śniadanie","time":"8:00","items":"<danie>\\n• składnik – 60 g\\n• ...\\n<przygotowanie>","kcal":0,"P":0,"F":0,"C":0}]}]}`;
  const txt = await ask(sys, prompt, { maxTokens: 4000, tier: 'default' });
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI nie zwróciło diety. Spróbuj jeszcze raz.');
  let j; try { j = JSON.parse(m[0]); } catch (e) { throw new Error('AI zwróciło niepełną dietę (za długa odpowiedź). Spróbuj jeszcze raz albo krótsze życzenia.'); }
  const days = (j.days || []).slice(0, 7).map((d, i) => ({
    key: String(d.key || 'ABCDEFG'[i]).slice(0, 3), name: String(d.name || 'Dzień ' + 'ABCDEFG'[i]).slice(0, 40),
    meals: (d.meals || []).slice(0, 7).map(x => ({ id: uid('m'), name: String(x.name || 'Posiłek').slice(0, 40), time: String(x.time || '').slice(0, 10), items: String(x.items || '').slice(0, 1200), kcal: Math.round(+x.kcal || 0), P: Math.round(+x.P || 0), F: Math.round(+x.F || 0), C: Math.round(+x.C || 0) }))
  })).filter(d => d.meals.length);
  if (!days.length) throw new Error('AI nie ułożyło żadnego dnia. Spróbuj jeszcze raz.');
  return { id: uid('dt'), name: String(j.name || `Dieta ${nt.kcal} kcal`).slice(0, 60), kcal: nt.kcal, P: nt.prot, F: nt.fat, C: nt.carb, water: nt.water, notes: String(j.notes || '').slice(0, 800), days, ai: true, createdAt: new Date().toISOString() };
}

// Wydruk / PDF: osobne okno z gotowym układem A4 i okno drukowania (tam „Zapisz jako PDF”)
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function dietHTML(diet, who, coachName) {
  const day = d => { const t = dayTotals(d); return `<section><h2>${esc(d.name)} <small>${t.kcal} kcal · B ${t.P} g · T ${t.F} g · W ${t.C} g</small></h2>
    ${d.meals.map(m => `<div class="meal"><div class="mh"><b>${esc(m.time ? m.time + ' · ' : '')}${esc(m.name)}</b><span>${+m.kcal || 0} kcal · B ${+m.P || 0} g</span></div><div class="it">${esc(m.items).replace(/\n/g, '<br>')}</div></div>`).join('')}</section>`; };
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${esc(diet.name)} – Pompujto.pl</title><style>
  @page { size: A4; margin: 14mm } * { box-sizing: border-box } body { font-family: Arial, Helvetica, sans-serif; color: #1c1622; margin: 0; font-size: 11pt }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #ff4d6d; padding-bottom: 10px; margin-bottom: 14px }
  .brand { font-size: 20pt; font-weight: 900 } .brand i { color: #ff4d6d; font-style: normal } h1 { font-size: 17pt; margin: 4px 0 2px } .muted { color: #6d6474; font-size: 9.5pt }
  .targets { display: flex; gap: 8px; margin: 10px 0 14px; flex-wrap: wrap } .targets div { background: #fff1f4; border-radius: 8px; padding: 6px 10px; font-size: 10pt } .targets b { display: block; font-size: 13pt }
  section { break-inside: avoid-page; margin-bottom: 14px } h2 { font-size: 13pt; margin: 0 0 6px; padding: 6px 0; border-bottom: 1px solid #eee } h2 small { font-weight: 400; color: #6d6474; font-size: 9.5pt; margin-left: 6px }
  .meal { border: 1px solid #ece4e2; border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; break-inside: avoid } .mh { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 3px } .mh span { color: #6d6474; font-size: 9.5pt; white-space: nowrap } .it { font-size: 10pt; line-height: 1.45 }
  .notes { background: #f7f3f1; border-radius: 8px; padding: 10px 12px; font-size: 10pt; line-height: 1.5; margin-bottom: 14px; white-space: pre-wrap } footer { margin-top: 18px; font-size: 8.5pt; color: #a39aa8; text-align: center }
  </style></head><body>
  <header><div><div class="brand">pompujto<i>.pl</i></div><h1>${esc(diet.name)}</h1><div class="muted">${who ? 'Dla: ' + esc(who) + ' · ' : ''}${coachName ? 'Trener: ' + esc(coachName) + ' · ' : ''}${new Date().toLocaleDateString('pl-PL')}</div></div></header>
  <div class="targets"><div>Kalorie<b>${+diet.kcal || 0} kcal</b></div><div>Białko<b>${+diet.P || 0} g</b></div><div>Tłuszcze<b>${+diet.F || 0} g</b></div><div>Węglowodany<b>${+diet.C || 0} g</b></div><div>Woda<b>${String(diet.water || 2.5).replace('.', ',')} l</b></div></div>
  ${diet.notes ? `<div class="notes"><b>Zasady</b><br>${esc(diet.notes)}</div>` : ''}
  ${diet.days.map(day).join('')}
  <footer>Wygenerowano w Pompujto.pl. Dieta nie zastępuje porady lekarza ani dietetyka klinicznego.</footer>
  </body></html>`;
}
export function printDiet(diet, who, coachName) {
  const w = window.open('', '_blank');
  if (!w) { downloadDiet(diet, who, coachName); return false; }
  w.document.open(); w.document.write(dietHTML(diet, who, coachName)); w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) { } }, 400);
  return true;
}
// zapas, gdy przeglądarka blokuje nowe okno: plik HTML gotowy do wydruku
export function downloadDiet(diet, who, coachName) {
  const b = new Blob([dietHTML(diet, who, coachName).replace('</body>', '<script>setTimeout(()=>print(),400)</script></body>')], { type: 'text/html' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (diet.name || 'dieta').replace(/[^\wąćęłńóśźżĄĆĘŁŃÓŚŹŻ -]/g, '') + '.html'; document.body.appendChild(a); a.click(); a.remove();
}
