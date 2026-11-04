// Netlify Function: /.netlify/functions/ai – pośrednik do AI. Klucz nigdy nie trafia do przeglądarki.
// Dostawca wybierany automatycznie po zmiennych środowiskowych (Netlify → Project configuration → Environment variables):
//   GEMINI_API_KEY    – Google Gemini (darmowy limit w Google AI Studio)  ← wystarczy ten
//   ANTHROPIC_API_KEY – Claude API (płatne)
// Opcjonalnie: GEMINI_MODEL, AI_MODEL (model Claude), AI_PROVIDER = 'gemini' | 'claude' (gdy ustawione oba klucze).
// Gdy ustawione są SUPABASE_URL + SUPABASE_ANON_KEY, z AI korzystają tylko zalogowani.

// Limit kosztów (najlepsza możliwa wersja bez bazy): maks. 30 zapytań na 10 minut na użytkownika w jednej instancji funkcji.
const hits = new Map();
function limited(id) { const now = Date.now(), arr = (hits.get(id) || []).filter(t => now - t < 600000); arr.push(now); hits.set(id, arr); if (hits.size > 5000) hits.clear(); return arr.length > 30; }
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Tekst z odpowiedzi Interactions API (output_text albo ostatni krok z treścią tekstową)
function interactionText(d) {
  if (typeof d.output_text === 'string' && d.output_text) return d.output_text;
  const steps = d.steps || d.outputs || [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const st = steps[i] || {};
    if (st.type === 'user_input') continue;
    const parts = Array.isArray(st.content) ? st.content : st.text ? [st] : [];
    const t = parts.map(p => (p && typeof p.text === 'string') ? p.text : '').join('');
    if (t) return t;
  }
  return '';
}

async function gemini(key, system, messages, maxTokens) {
  const models = [...new Set([process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'].filter(Boolean))];
  const RETRY = [400, 404, 429, 500, 502, 503, 504];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const errors = [];
  // 1) Interactions API – nowe API Google, obsługuje nowe klucze (AQ.…) i stare (AIza…)
  const history = messages.slice(0, -1).map(m => (m.role === 'assistant' ? 'Trener: ' : 'Użytkownik: ') + String(m.content || '')).join('\n\n');
  const last = String(messages[messages.length - 1].content || '');
  const input = history ? `Dotychczasowa rozmowa:\n${history}\n\nNowa wiadomość użytkownika:\n${last}` : last;
  for (const model of models) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ model, system_instruction: system, input, store: false, generation_config: { max_output_tokens: maxTokens } })
    });
    if (r.ok) { const t = interactionText(await r.json()); if (t) return t; errors.push(`${model}: pusta odpowiedź`); continue; }
    errors.push(`interactions ${model}: ${r.status} ${(await r.text()).slice(0, 160)}`);
    if (r.status === 503 && model === models[0]) await wait(800);
    if (!RETRY.includes(r.status)) break;
  }
  // 2) generateContent – starsze API (zapas)
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] })),
    generationConfig: { maxOutputTokens: maxTokens }
  };
  for (const model of models) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    if (r.ok) {
      const d = await r.json();
      const text = (((d.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text || '').join('') || '';
      if (text) return text;
      errors.push(`${model}: pusta odpowiedź`); continue;
    }
    errors.push(`generateContent ${model}: ${r.status} ${(await r.text()).slice(0, 160)}`);
    if (!RETRY.includes(r.status)) break;
  }
  const all = errors.join(' | ');
  if (/API key not valid|API_KEY_INVALID/i.test(all)) throw new Error('Google odrzuca klucz GEMINI_API_KEY – skopiuj go jeszcze raz przyciskiem „Copy key” w AI Studio.');
  if (/: 503|high demand|overloaded|UNAVAILABLE/i.test(all)) throw new Error('Trener AI jest chwilowo przeciążony (dużo zapytań do Google). Spróbuj za minutę.');
  if (/: 429|RESOURCE_EXHAUSTED|quota/i.test(all)) throw new Error('Wyczerpany darmowy limit zapytań Gemini na teraz. Spróbuj później.');
  console.error('AI errors:', all);
  throw new Error(all.slice(0, 600));
}

async function claude(key, system, messages, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-haiku-5-5', max_tokens: maxTokens, system,
      messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') })) })
  });
  if (!r.ok) throw new Error(`Claude: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const gk = process.env.GEMINI_API_KEY, ck = process.env.ANTHROPIC_API_KEY;
  if (!gk && !ck) return json(503, { error: 'no_key', message: 'Brak klucza AI (GEMINI_API_KEY albo ANTHROPIC_API_KEY) w ustawieniach Netlify.' });

  const sbUrl = process.env.SUPABASE_URL, sbKey = process.env.SUPABASE_ANON_KEY;
  if (sbUrl && sbKey) {
    const auth = req.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ')) return json(401, { error: 'auth', message: 'Zaloguj się, żeby korzystać z Trenera AI.' });
    const u = await fetch(sbUrl.replace(/\/$/, '') + '/auth/v1/user', { headers: { apikey: sbKey, authorization: auth } });
    if (!u.ok) return json(401, { error: 'auth', message: 'Sesja wygasła – zaloguj się ponownie.' });
    const who = (await u.json().catch(() => ({}))).id || 'anon';
    if (limited(who)) return json(429, { error: 'limit', message: 'Za dużo pytań do Trenera AI w krótkim czasie. Odczekaj kilka minut.' });
  }

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'json' }); }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  if (!messages.length) return json(400, { error: 'messages' });
  const system = String(body.system || '');
  if (JSON.stringify(messages).length + system.length > 60000) return json(413, { error: 'too_big' });
  const maxTokens = Math.min(4000, +body.max_tokens || 1500);

  const useClaude = ck && (!gk || process.env.AI_PROVIDER === 'claude');
  try {
    const text = useClaude ? await claude(ck, system, messages, maxTokens) : await gemini(gk, system, messages, maxTokens);
    return json(200, { text });
  } catch (e) {
    const m = String(e.message || e);
    return json(502, { error: 'upstream', message: /^(Trener AI|Wyczerpany|Google odrzuca)/.test(m) ? m : 'Trener AI chwilowo nie odpowiada. Spróbuj za chwilę.' });
  }
};
