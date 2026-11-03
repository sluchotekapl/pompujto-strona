import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Dumbbell, Gift, Send } from 'lucide-react';
import { useApp } from '../App.jsx';
import { useUI, Page, Stagger, Item } from '../components/ui.jsx';
import { api } from '../lib/backend.js';
import { burst } from './Today.jsx';
const PJ = () => window.PJ;
const when = d => new Date(d).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Inbox() {
  const { data: p, update, inbox, refreshInbox, isAdmin, me } = useApp();
  const { toast } = useUI();
  const [admins, setAdmins] = useState([]), [txt, setTxt] = useState('');
  useEffect(() => { refreshInbox(); api.admins().then(a => setAdmins(a.filter(x => x.id !== me.id))).catch(() => { }); }, []);
  useEffect(() => { inbox.filter(m => !m.read).forEach(m => api.mark(m.id, { read: true }).catch(() => { })); }, [inbox.length]);
  const accept = async m => {
    if (m.type === 'plan' && m.payload && m.payload.program) { update(x => { x.program = m.payload.program; }); toast('Plan od trenera ustawiony'); }
    if (m.type === 'reward') { update(x => { x.rewards.bonus.push({ id: 'm:' + m.id, tier: (m.payload && m.payload.tier) || 'small', date: new Date().toISOString(), from: 'Od trenera' }); if (m.payload && m.payload.xp) x.rewards.xp = (x.rewards.xp || 0) + m.payload.xp; }); burst(); toast('Nagroda dodana – odbierzesz ją w zakładce Nagrody'); }
    await api.mark(m.id, { done: true, read: true }); refreshInbox();
  };
  const sendToCoach = async () => {
    if (!txt.trim() || !admins.length) return;
    try { await api.send(admins.map(a => a.id), { type: 'text', title: 'Wiadomość od ' + p.name, body: txt.trim() }); setTxt(''); toast('Wysłano do trenera'); } catch (e) { toast(e.message); }
  };
  const Ic = { text: Mail, plan: Dumbbell, reward: Gift };
  return (
    <Page>
      <div><p className="eyebrow">Skrzynka</p><h1>Wiadomości</h1></div>
      <div className="cols">
        <div className="card">
          {!inbox.length && <div className="empty"><Mail size={32} /><span>Brak wiadomości. Tu trafią plany, nagrody i wiadomości od trenera.</span></div>}
          <Stagger className="">{inbox.map(m => { const I = Ic[m.type] || Mail; return (
            <Item key={m.id} className="inboxitem">
              <span className="treat-ic" style={{ width: 40, height: 40, background: m.type === 'reward' ? 'radial-gradient(circle at 30% 25%,#ffe28f,var(--gold))' : undefined, color: m.type === 'reward' ? '#1a1205' : undefined }}><I size={18} /></span>
              <div className="stack" style={{ gap: 4 }}>
                <div className="spread"><b>{m.title || 'Wiadomość'}</b><span className="xs muted">{when(m.created_at)}</span></div>
                {m.body && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{m.body}</p>}
                {m.type === 'plan' && m.payload && m.payload.program && <p className="xs muted">{m.payload.program.name}: {m.payload.program.days.map(d => d.name).join(' · ')}</p>}
                {m.type !== 'text' && (m.done ? <span className="tag mint" style={{ justifySelf: 'start' }}>Przyjęte</span> : <div><motion.button whileTap={{ scale: .95 }} className={'btn sm ' + (m.type === 'reward' ? 'gold' : 'pri')} onClick={() => accept(m)}>{m.type === 'plan' ? 'Ustaw ten plan' : 'Odbierz nagrodę'}</motion.button></div>)}
              </div>
            </Item>); })}</Stagger>
        </div>
        {!isAdmin && <div className="card stack"><h3>Napisz do trenera</h3>
          {admins.length ? <><textarea id="to-coach" value={txt} onChange={e => setTxt(e.target.value)} placeholder="np. Boli mnie bark przy wyciskaniu, co zmienić?" /><button className="btn pri" onClick={sendToCoach}><Send size={16} />Wyślij</button></> : <p className="small muted">Brak trenera w systemie.</p>}</div>}
      </div>
    </Page>
  );
}
