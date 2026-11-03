import { motion } from 'framer-motion';
import { Check, Dumbbell, Users, Smartphone } from 'lucide-react';
import { PRICES, access, isTrainer } from '../lib/backend.js';
import { useApp } from '../App.jsx';
import { Page } from '../components/ui.jsx';

const PLANS = [
  { k: 'user', I: Dumbbell, name: 'Dla siebie', price: PRICES.user, sub: `${PRICES.trialDays} dni za darmo, potem miesięcznie`,
    feats: ['Trening na dziś z progresją z historii', 'Plan pod Twój cel i ankietę zdrowia', 'Dieta z kaloriami i listą zakupów', 'Trener AI 24/7', 'Nagrody: pizza, burger, koło fortuny', 'Postępy: waga, wymiary, rekordy, siła'] },
  { k: 'trainer', I: Users, name: 'Trener', price: PRICES.trainer, sub: `${PRICES.trainerSeats} podopiecznych w cenie, każdy kolejny ${PRICES.extraSeat} zł`, hot: true,
    feats: ['Wszystko z planu „Dla siebie”', 'Panel podopiecznych i alerty', 'Kreator planów + biblioteka szablonów', 'Wysyłka planów, nagród i wiadomości', 'Postępy każdego podopiecznego', 'Podopieczni korzystają za darmo – dołączają Twoim kodem'] }
];

export function StatusLine({ me }) {
  const a = access(me);
  const t = { owner: ['Administrator – pełny dostęp', 'mint'], comp: ['Dostęp darmowy (od administratora)', 'mint'], active: [`Abonament aktywny · jeszcze ${a.daysLeft} dni`, 'mint'], covered: ['W abonamencie Twojego trenera', 'mint'], trial: [`Okres próbny · zostało ${a.daysLeft} dni`, 'gold'], expired: ['Okres próbny minął', 'red'] }[a.state];
  return <span className={'tag ' + t[1]}>{t[0]}</span>;
}

export default function Pricing() {
  const { me, clients } = useApp();
  const mine = isTrainer(me) ? 'trainer' : 'user';
  const seats = isTrainer(me) ? clients.filter(c => !c.offline && c.coach_id === me.id).length : 0;
  return (
    <Page>
      <div className="stack" style={{ gap: 6 }}><p className="eyebrow">Abonament</p><h1>Prosto i bez haczyków</h1>
        <div className="row"><StatusLine me={me} />{isTrainer(me) && <span className="tag">Podopieczni: {seats}/{PRICES.trainerSeats}</span>}</div></div>
      <div className="cols">
        {PLANS.map((p, i) => (
          <motion.div key={p.k} className={'card stack price' + (p.hot ? ' hot' : '')} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .08 }}>
            <div className="spread"><span className="treat-ic"><p.I size={20} /></span>{p.k === mine ? <span className="tag pink">Twój plan</span> : p.hot ? <span className="tag gold">Dla trenerów</span> : null}</div>
            <h2>{p.name}</h2>
            <div className="pr"><b>{p.price}</b> zł<span className="muted"> / mies.</span></div>
            <p className="small muted">{p.sub}</p>
            <ul className="feats">{p.feats.map(f => <li key={f}><Check size={16} />{f}</li>)}</ul>
            <button className="btn big" disabled title="Płatności uruchomimy wkrótce">Płatności wkrótce</button>
          </motion.div>))}
      </div>
      <div className="banner info"><Smartphone size={20} /><div><b>Działa jak aplikacja na telefonie</b>Otwórz pompujto.pl w telefonie i wybierz „Dodaj do ekranu głównego” – ikonka, pełny ekran, działa też bez internetu.</div></div>
      <p className="xs muted">Ceny brutto. Anulujesz w każdej chwili. Szczegóły w <a href="#regulamin">regulaminie</a>.</p>
    </Page>
  );
}
