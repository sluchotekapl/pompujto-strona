// Konta i dane. Jeden interfejs, dwa tryby:
//  - 'cloud' – Supabase (prawdziwe konta, logowanie z każdego urządzenia, panel admina dla wszystkich)
//  - 'local' – konta tylko w tej przeglądarce (podgląd, testy, brak konfiguracji)
const PJ = () => window.PJ;
const cfg = window.PJ_CONFIG || {};
export const MODE = cfg.supabaseUrl && cfg.supabaseAnonKey ? 'cloud' : 'local';

/* ---------------- dane startowe profilu ---------------- */
export function blankData(over) {
  return Object.assign({
    sex: 'm', age: 30, weight: 80, height: 178, level: 'beginner', trainDays: [1, 3, 5], sessionMin: 60,
    equipPreset: 'gym', equipment: PJ().EQUIP_PRESETS.gym.slice(),
    survey: { returning: false, goal: 'zdrowie', activity: 'sedentary', injuries: [], conditions: [], allergies: [], diet: 'omni', meals: 4, dislikes: '', doctorLimit: false, pain: false },
    surveyDone: false, program: null, history: [], dietLog: {}, weights: [], draft: null,
    rewards: { goal: 'burger', redeemed: [], custom: [], bonus: [], spins: [], xp: 0 }, coach: [], createdAt: new Date().toISOString()
  }, over || {});
}
export function normalize(d, id, name) {
  const b = blankData();
  d = Object.assign({}, b, d || {});
  d.survey = Object.assign({}, b.survey, d.survey || {});
  d.rewards = Object.assign({}, b.rewards, d.rewards || {});
  d.id = id; d.name = name || d.name || 'Ty';
  return d;
}

/* ---------------- tryb lokalny ---------------- */
const LKEY = 'pompujto:local:v2';
let mem = null;
function lread() { try { const v = localStorage.getItem(LKEY); if (v) return JSON.parse(v); } catch (e) { } return mem; }
function lwrite(db) { mem = db; try { localStorage.setItem(LKEY, JSON.stringify(db)); } catch (e) { } }
async function hash(s) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pompujto:' + s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { return 'plain:' + s; }
}
const uid = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function ldb() {
  let db = lread();
  if (db) return db;
  db = { users: {}, messages: [], settings: { invite_code: '' }, session: null, seq: 1 };
  // przeniesienie danych z poprzedniej wersji strony
  let old = null; try { old = JSON.parse(localStorage.getItem('pompujto:v1') || 'null'); } catch (e) { }
  const pass = await hash('pompujto');
  if (old && old.profiles) {
    Object.values(old.profiles).forEach((p, i) => {
      const id = p.id || uid(), login = i === 0 ? 'trener' : (p.name || 'osoba' + i).toLowerCase().split(' ')[0] + i;
      db.users[id] = { id, email: login, name: p.name, role: i === 0 ? 'admin' : 'user', pass, data: normalize(p, id, p.name), created_at: p.createdAt || new Date().toISOString() };
    });
  } else {
    const k = normalize(blankData({
      sex: 'm', age: 30, weight: 85, height: 180, level: 'beginner',
      survey: Object.assign(blankData().survey, { returning: true, goal: 'redukcja' }),
      weights: [{ date: new Date().toISOString(), kg: 85, xp: 0 }], rewards: Object.assign(blankData().rewards, { goal: 'pizza' })
    }), 'trener', 'Trener Demo');
    k.program = PJ().buildProgram(k, []);
    db.users.trener = { id: 'trener', email: 'trener', name: 'Trener Demo', role: 'admin', pass, data: k, created_at: new Date().toISOString() };
  }
  db.session = Object.keys(db.users)[0];
  lwrite(db);
  return db;
}

const local = {
  async session() { const db = await ldb(); const u = db.session && db.users[db.session]; return u ? { id: u.id, email: u.email, name: u.name, role: u.role } : null; },
  async signIn(email, password) {
    const db = await ldb(), h = await hash(password), e = email.trim().toLowerCase();
    const u = Object.values(db.users).find(x => x.email.toLowerCase() === e);
    if (!u || u.pass !== h) throw new Error('Zły login lub hasło.');
    db.session = u.id; lwrite(db); return this.session();
  },
  async signUp({ name, email, password, invite }) {
    const db = await ldb(), e = email.trim().toLowerCase();
    if (Object.values(db.users).some(x => x.email.toLowerCase() === e)) throw new Error('Takie konto już istnieje. Zaloguj się.');
    const hasAdmin = Object.values(db.users).some(u => u.role === 'admin');
    if (hasAdmin && db.settings.invite_code && invite !== db.settings.invite_code) throw new Error('Nieprawidłowy kod zaproszenia.');
    const id = uid();
    const head = Object.values(db.users).find(u => u.role === 'admin');
    db.users[id] = { id, coach_id: head ? head.id : null, coach: {}, email: email.trim(), name: name.trim(), role: hasAdmin ? 'user' : 'admin', pass: await hash(password), data: normalize(blankData(), id, name.trim()), created_at: new Date().toISOString() };
    db.users[id].data.program = PJ().buildProgram(db.users[id].data, []);
    db.session = id; lwrite(db); return this.session();
  },
  async signOut() { const db = await ldb(); db.session = null; lwrite(db); },
  async load() { const db = await ldb(), u = db.users[db.session]; const d = normalize(u.data, u.id, u.name); d._coach = u.coach || {}; return d; },
  async save(data) { const db = await ldb(), u = db.users[db.session]; if (!u) return; const d = Object.assign({}, data); delete d._coach; u.data = d; u.name = data.name || u.name; lwrite(db); },
  async myCoach() { const db = await ldb(), u = db.users[db.session]; return (u && u.coach) || {}; },
  async coachSet(uid, patch) { const db = await ldb(); if (db.users[db.session].role !== 'admin') throw new Error('Tylko trener'); const u = db.users[uid]; u.coach = Object.assign({}, u.coach || {}, patch); lwrite(db); },
  async assign(uid, cid) { const db = await ldb(); db.users[uid].coach_id = cid; lwrite(db); },
  async listUsers() { const db = await ldb(); const head = Object.values(db.users).find(u => u.role === 'admin'); return Object.values(db.users).map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at, coach: u.coach || {}, coach_id: u.coach_id !== undefined ? u.coach_id : (u.role === 'user' && head ? head.id : null), data: normalize(u.data, u.id, u.name) })); },
  async setRole(id, role) { const db = await ldb(); if (id === db.session && role === 'user') throw new Error('Nie możesz odebrać roli sobie.'); db.users[id].role = role; lwrite(db); },
  async send(toIds, msg) {
    const db = await ldb();
    toIds.forEach(to => db.messages.push({ id: db.seq++, from_id: db.session, to_id: to, type: msg.type || 'text', title: msg.title || '', body: msg.body || '', payload: msg.payload || null, read: false, done: false, created_at: new Date().toISOString() }));
    lwrite(db);
  },
  async inbox() { const db = await ldb(); return db.messages.filter(m => m.to_id === db.session).slice().reverse(); },
  async sent() { const db = await ldb(); return db.messages.filter(m => m.from_id === db.session).slice().reverse(); },
  async mark(id, patch) { const db = await ldb(); const m = db.messages.find(x => x.id === id && x.to_id === db.session); if (m) { if ('read' in patch) m.read = patch.read; if ('done' in patch) m.done = patch.done; lwrite(db); } },
  async admins() { const db = await ldb(); return Object.values(db.users).filter(u => u.role === 'admin').map(u => ({ id: u.id, name: u.name })); },
  async getInvite() { const db = await ldb(); return db.settings.invite_code || ''; },
  async setInvite(v) { const db = await ldb(); db.settings.invite_code = v; lwrite(db); },
  async token() { return null; }
};

/* ---------------- Supabase ---------------- */
let sbp = null;
function sb() { if (!sbp) sbp = import('@supabase/supabase-js').then(m => m.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } })); return sbp; }
const err = e => { if (e) throw new Error(e.message === 'Invalid login credentials' ? 'Zły e‑mail lub hasło.' : e.message); };
const cloud = {
  async session() {
    const c = await sb(); const { data } = await c.auth.getSession(); const u = data.session && data.session.user;
    if (!u) return null;
    const { data: p, error } = await c.from('profiles').select('id,email,name,role').eq('id', u.id).single(); err(error);
    return p;
  },
  async signIn(email, password) { const c = await sb(); const { error } = await c.auth.signInWithPassword({ email: email.trim(), password }); err(error); return this.session(); },
  async signUp({ name, email, password, invite }) {
    const c = await sb();
    const { data, error } = await c.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim(), invite: invite || '' }, emailRedirectTo: location.origin } });
    if (error && /Database error/i.test(error.message)) throw new Error('Nieprawidłowy kod zaproszenia.');
    err(error);
    if (!data.session) return { pendingEmail: true };
    return this.session();
  },
  async signOut() { const c = await sb(); await c.auth.signOut(); },
  async load() {
    const c = await sb(); const { data: s } = await c.auth.getSession(); const id = s.session.user.id;
    let { data: p, error } = await c.from('profiles').select('id,name,data,coach').eq('id', id).single();
    if (error && /coach/.test(error.message)) ({ data: p, error } = await c.from('profiles').select('id,name,data').eq('id', id).single());
    err(error);
    let d = normalize(p.data, id, p.name); d._coach = p.coach || {};
    if (!p.data || !p.data.program) { d.program = PJ().buildProgram(d, d.history || []); await this.save(d); }
    return d;
  },
  async save(data) { const c = await sb(); const { data: s } = await c.auth.getSession(); if (!s.session) return; data = Object.assign({}, data); delete data._coach; const { error } = await c.from('profiles').update({ data, name: data.name, updated_at: new Date().toISOString() }).eq('id', s.session.user.id); err(error); },
  async listUsers() { const c = await sb(); const { data, error } = await c.from('profiles').select('*').order('created_at'); err(error); return data.map(u => Object.assign(u, { data: normalize(u.data, u.id, u.name) })); },
  async setRole(id, role) { const c = await sb(); const { error } = await c.rpc('set_role', { uid: id, new_role: role }); err(error); },
  async myCoach() { const c = await sb(); const { data: s } = await c.auth.getSession(); if (!s.session) return {}; const { data, error } = await c.from('profiles').select('coach').eq('id', s.session.user.id).single(); return (!error && data && data.coach) || {}; },
  async coachSet(uid, patch) { const c = await sb(); const { error } = await c.rpc('coach_set', { uid, patch }); if (error && /function|schema cache/i.test(error.message)) throw new Error('Brakuje aktualizacji bazy: uruchom w Supabase plik aktualizacja-2-trener.sql.'); err(error); },
  async assign(uid, cid) { const c = await sb(); const { error } = await c.rpc('coach_assign', { uid, cid }); err(error); },
  async send(toIds, msg) { const c = await sb(); const { data: s } = await c.auth.getSession(); const rows = toIds.map(to => ({ from_id: s.session.user.id, to_id: to, type: msg.type || 'text', title: msg.title || '', body: msg.body || '', payload: msg.payload || null })); const { error } = await c.from('messages').insert(rows); err(error); },
  async inbox() { const c = await sb(); const { data: s } = await c.auth.getSession(); const { data, error } = await c.from('messages').select('*').eq('to_id', s.session.user.id).order('created_at', { ascending: false }).limit(100); err(error); return data; },
  async sent() { const c = await sb(); const { data: s } = await c.auth.getSession(); const { data, error } = await c.from('messages').select('*').eq('from_id', s.session.user.id).order('created_at', { ascending: false }).limit(100); err(error); return data; },
  async mark(id, patch) { const c = await sb(); const { error } = await c.from('messages').update(patch).eq('id', id); err(error); },
  async admins() { const c = await sb(); const { data, error } = await c.from('profiles').select('id,name').eq('role', 'admin'); err(error); return data; },
  async getInvite() { const c = await sb(); const { data } = await c.from('app_settings').select('value').eq('key', 'invite_code').maybeSingle(); return (data && data.value) || ''; },
  async setInvite(v) { const c = await sb(); const { error } = await c.from('app_settings').upsert({ key: 'invite_code', value: v }); err(error); },
  async token() { const c = await sb(); const { data } = await c.auth.getSession(); return data.session ? data.session.access_token : null; }
};

export const api = MODE === 'cloud' ? cloud : local;
