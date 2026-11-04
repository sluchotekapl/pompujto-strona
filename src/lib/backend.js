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

/* ---------------- abonament i dostęp ---------------- */
// Ceny i zasady: konto „dla siebie” 20 zł/mies. (7 dni za darmo), konto trenera 79 zł/mies. z 15 podopiecznymi w cenie,
// podopieczni trenera korzystają za darmo. Dopóki nie podłączymy płatności (PJ_CONFIG.paywall !== true), nic nie jest blokowane.
export const PRICES = { user: 20, trainer: 79, trainerSeats: 15, extraSeat: 5, trialDays: 7 };
export const isTrainer = me => !!me && (me.role === 'admin' || me.role === 'trainer');
export function access(me) {
  const now = Date.now(), b = (me && me.billing) || {};
  const created = new Date((me && me.created_at) || now).getTime();
  const trialEnd = created + PRICES.trialDays * 864e5;
  const until = b.until ? new Date(b.until).getTime() : 0;
  const enforce = !!(window.PJ_CONFIG && window.PJ_CONFIG.paywall);
  let state;
  if (me && me.role === 'admin') state = 'owner';
  else if (b.comp) state = 'comp';
  else if (b.status === 'active' && (!until || until > now)) state = 'active';
  else if (!isTrainer(me) && me && me.coach_id) state = 'covered';
  else if (now < trialEnd) state = 'trial';
  else state = 'expired';
  const daysLeft = Math.max(0, Math.ceil(((state === 'active' && until ? until : trialEnd) - now) / 864e5));
  return { state, daysLeft, ok: !enforce || state !== 'expired', enforce, plan: isTrainer(me) ? 'trainer' : 'user' };
}
// Reguła dostępności treningu z kalendarza (lustro funkcji workout_visible w bazie – w chmurze decyduje serwer)
export const todayIn = (tz = 'Europe/Warsaw') => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const workoutVisible = w => w.status === 'published' && w.scheduled_date <= todayIn(w.tz) && (!w.available_at || new Date(w.available_at) <= new Date());
const need4 = e => { if (e && /workouts|workout_logs|invites|redeem_invite|does not exist|schema cache/i.test(e.message)) throw new Error('Brakuje aktualizacji bazy: uruchom w Supabase plik aktualizacja-4-kalendarz-zaproszenia.sql.'); if (e) throw new Error(e.message); };
const code6 = () => Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, 'X');

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
    db.users.trener = { id: 'trener', email: 'trener', name: 'Trener Demo', role: 'admin', kind: 'trainer', trainer_code: 'DEMO01', billing: {}, pass, data: k, created_at: new Date().toISOString() };
  }
  db.session = Object.keys(db.users)[0];
  lwrite(db);
  return db;
}

const local = {
  async session() {
    const db = await ldb(); const u = db.session && db.users[db.session];
    if (!u) return null;
    const head = Object.values(db.users).find(x => x.role === 'admin');
    if (u.role === 'admin' && !u.trainer_code) { u.trainer_code = code6(); lwrite(db); }
    const coach_id = u.coach_id !== undefined ? u.coach_id : (u.role === 'user' && head ? head.id : null);
    return { id: u.id, email: u.email, name: u.name, role: u.role, kind: u.kind || (u.role === 'user' ? 'user' : 'trainer'), trainer_code: u.trainer_code || null, billing: u.billing || {}, coach_id, created_at: u.created_at, consents: u.consents || {} };
  },
  async signIn(email, password) {
    const db = await ldb(), h = await hash(password), e = email.trim().toLowerCase();
    const u = Object.values(db.users).find(x => x.email.toLowerCase() === e);
    if (!u || u.pass !== h) throw new Error('Zły login lub hasło.');
    db.session = u.id; lwrite(db); return this.session();
  },
  async signUp({ name, email, password, invite, kind, consents }) {
    const db = await ldb(), e = email.trim().toLowerCase();
    if (Object.values(db.users).some(x => x.email.toLowerCase() === e)) throw new Error('Takie konto już istnieje. Zaloguj się.');
    const hasAdmin = Object.values(db.users).some(u => u.role === 'admin');
    const inv = (invite || '').trim().toUpperCase();
    const tokInv = inv && (db.invites || []).find(x => x.token === inv.toLowerCase());
    if (tokInv && (tokInv.used_at || new Date(tokInv.expires_at) < new Date())) throw new Error('Zaproszenie wygasło albo zostało już użyte');
    const tr = tokInv ? db.users[tokInv.trainer_id] : inv && Object.values(db.users).find(u => (u.trainer_code || '') === inv && u.role !== 'user');
    if (hasAdmin && !tr && db.settings.invite_code && inv !== db.settings.invite_code.toUpperCase()) throw new Error('Nieprawidłowy kod zaproszenia lub kod trenera.');
    const id = uid(), k = kind === 'trainer' ? 'trainer' : 'user';
    const role = !hasAdmin ? 'admin' : k === 'trainer' ? 'trainer' : 'user';
    db.users[id] = { id, coach_id: tr ? tr.id : null, coach: {}, email: email.trim(), name: name.trim(), role, kind: role === 'user' ? 'user' : 'trainer', trainer_code: role === 'user' ? null : code6(), billing: {}, consents: consents || {}, pass: await hash(password), data: normalize(blankData(), id, name.trim()), created_at: new Date().toISOString() };
    db.users[id].data.program = PJ().buildProgram(db.users[id].data, []);
    if (tokInv) { tokInv.used_by = id; tokInv.used_at = new Date().toISOString(); }
    db.session = id; lwrite(db); return this.session();
  },
  async signOut() { const db = await ldb(); db.session = null; lwrite(db); },
  async load() { const db = await ldb(), u = db.users[db.session]; const d = normalize(u.data, u.id, u.name); d._coach = u.coach || {}; return d; },
  async save(data) { const db = await ldb(), u = db.users[db.session]; if (!u) return; const d = Object.assign({}, data); delete d._coach; u.data = d; u.name = data.name || u.name; lwrite(db); },
  async myCoach() { const db = await ldb(), u = db.users[db.session]; return (u && u.coach) || {}; },
  async coachSet(uid, patch) { const db = await ldb(), me = db.users[db.session], u = db.users[uid]; if (!(me.role === 'admin' || (me.role === 'trainer' && u.coach_id === me.id))) throw new Error('To nie jest Twój podopieczny'); u.coach = Object.assign({}, u.coach || {}, patch); lwrite(db); },
  async assign(uid, cid) { const db = await ldb(), me = db.users[db.session]; if (me.role !== 'admin' && !(cid === null && db.users[uid].coach_id === me.id)) throw new Error('Brak uprawnień'); db.users[uid].coach_id = cid; lwrite(db); },
  async listUsers() {
    const db = await ldb(), me = db.users[db.session]; const head = Object.values(db.users).find(u => u.role === 'admin');
    return Object.values(db.users).map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, kind: u.kind || (u.role === 'user' ? 'user' : 'trainer'), billing: u.billing || {}, created_at: u.created_at, coach: u.coach || {}, coach_id: u.coach_id !== undefined ? u.coach_id : (u.role === 'user' && head ? head.id : null), data: normalize(u.data, u.id, u.name) }))
      .filter(u => me.role === 'admin' || u.id === me.id || u.coach_id === me.id);
  },
  async setRole(id, role) { const db = await ldb(); if (db.users[db.session].role !== 'admin') throw new Error('Tylko administrator'); if (id === db.session && role !== 'admin') throw new Error('Nie możesz odebrać roli sobie.'); const u = db.users[id]; u.role = role; if (role !== 'user') { u.kind = 'trainer'; u.trainer_code = u.trainer_code || code6(); } lwrite(db); },
  async setBilling(id, b) { const db = await ldb(); if (db.users[db.session].role !== 'admin') throw new Error('Tylko administrator'); const u = db.users[id]; u.billing = Object.assign({}, u.billing || {}, b); lwrite(db); },
  async joinCoach(code) { const db = await ldb(), c = (code || '').trim().toUpperCase(); const t = Object.values(db.users).find(u => u.trainer_code === c && u.role !== 'user'); if (!t) throw new Error('Nie ma trenera z takim kodem'); if (t.id === db.session) throw new Error('To Twój własny kod'); db.users[db.session].coach_id = t.id; lwrite(db); return t.name; },
  async leaveCoach() { const db = await ldb(); db.users[db.session].coach_id = null; lwrite(db); },
  async contacts() { const db = await ldb(), me = db.users[db.session]; const head = Object.values(db.users).find(u => u.role === 'admin'); const cid = me.coach_id !== undefined ? me.coach_id : (me.role === 'user' && head ? head.id : null); return Object.values(db.users).filter(u => u.id !== me.id && (u.role === 'admin' || u.id === cid)).map(u => ({ id: u.id, name: u.name, role: u.role })); },
  async deleteMe() { const db = await ldb(); if (db.users[db.session].role === 'admin' && Object.values(db.users).filter(u => u.role === 'admin').length < 2) throw new Error('Jesteś jedynym administratorem – najpierw nadaj tę rolę komuś innemu.'); delete db.users[db.session]; db.messages = db.messages.filter(m => m.from_id !== db.session && m.to_id !== db.session); db.session = null; lwrite(db); },
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
  async token() { return null; },
  // --- kalendarz (tryb lokalny: demonstracja, ta sama reguła widoczności co w bazie) ---
  async listWorkouts(clientId) { const db = await ldb(); return (db.workouts || []).filter(w => w.client_id === clientId).sort((a, b) => a.scheduled_date < b.scheduled_date ? 1 : -1); },
  async myWorkouts() { const db = await ldb(); return (db.workouts || []).filter(w => w.client_id === db.session && workoutVisible(w)).sort((a, b) => a.scheduled_date < b.scheduled_date ? 1 : -1); },
  async saveWorkout(w) { const db = await ldb(); db.workouts = db.workouts || []; w = Object.fromEntries(Object.entries(w).filter(([, v]) => v !== undefined)); const i = db.workouts.findIndex(x => x.id === w.id); const now = new Date().toISOString();
    if (i >= 0) { const old = db.workouts[i]; db.workouts[i] = { ...old, ...w, version: JSON.stringify(old.content) !== JSON.stringify(w.content || old.content) ? old.version + 1 : old.version, updated_at: now }; }
    else db.workouts.push({ id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), tz: 'Europe/Warsaw', status: 'draft', version: 1, trainer_id: db.session, created_at: now, updated_at: now, ...w });
    lwrite(db); },
  async deleteWorkout(id) { const db = await ldb(); db.workouts = (db.workouts || []).filter(w => w.id !== id); lwrite(db); },
  async logWorkout(l) { const db = await ldb(); db.logs = db.logs || []; const i = db.logs.findIndex(x => x.client_id === db.session && x.client_key === l.client_key); const row = { ...l, client_id: db.session }; if (i >= 0) db.logs[i] = { ...db.logs[i], ...row }; else db.logs.push({ ...row, created_at: new Date().toISOString() }); lwrite(db); },
  async listLogs(clientId) { const db = await ldb(); return (db.logs || []).filter(x => x.client_id === clientId); },
  async createInvite(label) { const db = await ldb(); db.invites = db.invites || []; const token = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, ''); db.invites.push({ token, trainer_id: db.session, label: label || '', expires_at: new Date(Date.now() + 7 * 864e5).toISOString(), used_by: null, used_at: null, created_at: new Date().toISOString() }); lwrite(db); return token; },
  async listInvites() { const db = await ldb(); return (db.invites || []).filter(x => x.trainer_id === db.session).slice().reverse(); },
  async deleteInvite(t) { const db = await ldb(); db.invites = (db.invites || []).filter(x => !(x.token === t && !x.used_at)); lwrite(db); },
  async redeemInvite(t) { const db = await ldb(); const r = (db.invites || []).find(x => x.token === String(t).trim().toLowerCase()); if (!r) throw new Error('Nie ma takiego zaproszenia'); if (r.used_at) throw new Error('To zaproszenie zostało już użyte'); if (new Date(r.expires_at) < new Date()) throw new Error('Zaproszenie wygasło – poproś trenera o nowe'); if (r.trainer_id === db.session) throw new Error('To Twoje własne zaproszenie'); db.users[db.session].coach_id = r.trainer_id; r.used_by = db.session; r.used_at = new Date().toISOString(); lwrite(db); return db.users[r.trainer_id].name; }
};

/* ---------------- Supabase ---------------- */
let sbp = null;
function sb() { if (!sbp) sbp = import('@supabase/supabase-js').then(m => m.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } })); return sbp; }
const need3 = e => { if (e && /function|schema cache/i.test(e.message)) throw new Error('Brakuje aktualizacji bazy: uruchom w Supabase plik aktualizacja-3-dwie-wersje.sql.'); err(e); };
const err = e => { if (e) throw new Error(e.message === 'Invalid login credentials' ? 'Zły e‑mail lub hasło.' : e.message); };
const cloud = {
  async session() {
    const c = await sb(); const { data } = await c.auth.getSession(); const u = data.session && data.session.user;
    if (!u) return null;
    let { data: p, error } = await c.from('profiles').select('id,email,name,role,kind,trainer_code,billing,coach_id,created_at,consents').eq('id', u.id).single();
    if (error && /column|kind|billing|trainer_code|consents/i.test(error.message)) { ({ data: p, error } = await c.from('profiles').select('id,email,name,role,created_at').eq('id', u.id).single()); if (p) p.legacy = true; }
    err(error);
    return p;
  },
  async signIn(email, password) { const c = await sb(); const { error } = await c.auth.signInWithPassword({ email: email.trim(), password }); err(error); return this.session(); },
  async signUp({ name, email, password, invite, kind, consents }) {
    const c = await sb();
    const { data, error } = await c.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim(), invite: (invite || '').trim(), kind: kind === 'trainer' ? 'trainer' : 'user', consents: consents || {} }, emailRedirectTo: location.origin + location.pathname } });
    if (error && /Database error/i.test(error.message)) throw new Error('Nieprawidłowy kod zaproszenia lub kod trenera.');
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
  async contacts() { const c = await sb(); const { data, error } = await c.rpc('my_contacts'); if (error) return this.admins(); return data; },
  async setBilling(uid, b) { const c = await sb(); const { error } = await c.rpc('set_billing', { uid, b }); need3(error); },
  async joinCoach(code) { const c = await sb(); const { data, error } = await c.rpc('join_coach', { code }); need3(error); return data; },
  async leaveCoach() { const c = await sb(); const { data: s } = await c.auth.getSession(); const { error } = await c.rpc('coach_assign', { uid: s.session.user.id, cid: null }); need3(error); },
  async deleteMe() { const c = await sb(); const { error } = await c.rpc('delete_me'); need3(error); await c.auth.signOut(); },
  async getInvite() { const c = await sb(); const { data } = await c.from('app_settings').select('value').eq('key', 'invite_code').maybeSingle(); return (data && data.value) || ''; },
  async setInvite(v) { const c = await sb(); const { error } = await c.from('app_settings').upsert({ key: 'invite_code', value: v }); err(error); },
  async token() { const c = await sb(); const { data } = await c.auth.getSession(); return data.session ? data.session.access_token : null; },
  // --- kalendarz: widoczność dla podopiecznego egzekwuje RLS (workout_visible), nie przeglądarka ---
  async listWorkouts(clientId) { const c = await sb(); const { data, error } = await c.from('workouts').select('*').eq('client_id', clientId).order('scheduled_date', { ascending: false }).limit(200); need4(error); return data; },
  async myWorkouts() { const c = await sb(); const { data: s } = await c.auth.getSession(); const { data, error } = await c.from('workouts').select('id,title,content,scheduled_date,status,version,tz,available_at').eq('client_id', s.session.user.id).order('scheduled_date', { ascending: false }).limit(30); need4(error); return data; },
  async saveWorkout(w) { const c = await sb(); const { data: s } = await c.auth.getSession(); const row = { client_id: w.client_id, scheduled_date: w.scheduled_date, available_at: w.available_at || null, status: w.status, title: w.title, content: w.content };
    const q = w.id ? c.from('workouts').update(row).eq('id', w.id) : c.from('workouts').insert({ ...row, trainer_id: s.session.user.id }); const { error } = await q; need4(error); },
  async deleteWorkout(id) { const c = await sb(); const { error } = await c.from('workouts').delete().eq('id', id); need4(error); },
  async logWorkout(l) { const c = await sb(); const { data: s } = await c.auth.getSession(); const { error } = await c.from('workout_logs').upsert({ ...l, client_id: s.session.user.id }, { onConflict: 'client_id,client_key' }); need4(error); },
  async listLogs(clientId) { const c = await sb(); const { data, error } = await c.from('workout_logs').select('workout_id,client_key,finished_at,result').eq('client_id', clientId).limit(200); need4(error); return data; },
  async createInvite(label) { const c = await sb(); const { data: s } = await c.auth.getSession(); const { data, error } = await c.from('invites').insert({ trainer_id: s.session.user.id, label: label || null }).select('token').single(); need4(error); return data.token; },
  async listInvites() { const c = await sb(); const { data, error } = await c.from('invites').select('*').order('created_at', { ascending: false }).limit(50); need4(error); return data; },
  async deleteInvite(t) { const c = await sb(); const { error } = await c.from('invites').delete().eq('token', t); need4(error); },
  async redeemInvite(t) { const c = await sb(); const { data, error } = await c.rpc('redeem_invite', { tok: t }); need4(error); return data; }
};

export const api = MODE === 'cloud' ? cloud : local;
