import { Page } from '../components/ui.jsx';

// Dane sprzedawcy uzupełnia się w public/config.js (PJ_CONFIG.company). Dopóki ich nie ma, w treści widać [do uzupełnienia].
const co = () => Object.assign({ name: '[nazwa firmy / imię i nazwisko – do uzupełnienia]', address: '[adres – do uzupełnienia]', nip: '[NIP – do uzupełnienia]', email: '[e‑mail kontaktowy – do uzupełnienia]' }, (window.PJ_CONFIG || {}).company || {});
const UPDATED = '3 listopada 2026';

export function Terms() {
  const c = co();
  return (
    <div className="stack legal">
      <p className="xs muted">Wersja z {UPDATED}</p>
      <h3>1. Kto prowadzi serwis</h3>
      <p>Serwis pompujto.pl (strona i aplikacja) prowadzi {c.name}, {c.address}, NIP {c.nip}, kontakt: {c.email} („Usługodawca”).</p>
      <h3>2. Czym jest Pompujto</h3>
      <p>Narzędzie do planowania treningów, diety i śledzenia postępów. Plany układa algorytm, Trener AI albo trener prowadzący. <b>Pompujto nie jest usługą medyczną</b> i nie zastępuje lekarza, fizjoterapeuty ani dietetyka. Przy chorobach, ciąży, bólu w klatce, zawrotach głowy lub kontuzji skonsultuj się ze specjalistą przed treningiem i przerwij ćwiczenie, gdy coś boli.</p>
      <h3>3. Konta</h3>
      <ul className="list">
        <li><b>Konto „Dla siebie”</b> – plan, dieta, nagrody, postępy i Trener AI dla jednej osoby.</li>
        <li><b>Konto trenera</b> – dodatkowo panel podopiecznych, kreator planów, monitorowanie postępów i wiadomości.</li>
        <li><b>Podopieczny trenera</b> – osoba, która dołączyła kodem trenera; korzysta w ramach abonamentu trenera.</li>
      </ul>
      <p>Konto zakłada osoba pełnoletnia. Dbasz o poufność hasła. Jedna osoba – jedno konto.</p>
      <h3>4. Ceny i płatności</h3>
      <ul className="list">
        <li>Konto „Dla siebie”: 20 zł brutto miesięcznie, pierwsze 7 dni bez opłat.</li>
        <li>Konto trenera: 79 zł brutto miesięcznie, w cenie 15 aktywnych podopiecznych; każdy kolejny 5 zł miesięcznie.</li>
        <li>Podopieczni trenera nie płacą.</li>
      </ul>
      <p>Abonament odnawia się co miesiąc do czasu anulowania. Anulować można w każdej chwili – dostęp trwa do końca opłaconego okresu. Płatności obsługuje zewnętrzny operator płatności; Usługodawca nie przechowuje danych kart.</p>
      <h3>5. Odstąpienie od umowy</h3>
      <p>Konsument może odstąpić od umowy w ciągu 14 dni od jej zawarcia, pisząc na {c.email}. Jeśli zażądasz rozpoczęcia usługi przed upływem tego terminu, zwracamy kwotę proporcjonalną do niewykorzystanego okresu.</p>
      <h3>6. Reklamacje</h3>
      <p>Reklamacje przyjmujemy pod adresem {c.email}. Odpowiadamy w ciągu 14 dni.</p>
      <h3>7. Zasady korzystania</h3>
      <p>Nie wolno wprowadzać treści bezprawnych, podszywać się pod inne osoby ani próbować obejść zabezpieczeń. Trener odpowiada za plany i wiadomości, które wysyła podopiecznym.</p>
      <h3>8. Usunięcie konta</h3>
      <p>Konto i wszystkie dane usuniesz sam w zakładce Konto → Usuń konto. Możesz też wcześniej pobrać kopię swoich danych.</p>
      <h3>9. Zmiany regulaminu</h3>
      <p>O zmianach informujemy z 14‑dniowym wyprzedzeniem w aplikacji. Sprawy nieuregulowane rozstrzyga prawo polskie.</p>
    </div>
  );
}

export function Privacy() {
  const c = co();
  return (
    <div className="stack legal">
      <p className="xs muted">Wersja z {UPDATED}</p>
      <h3>Administrator danych</h3>
      <p>{c.name}, {c.address}, kontakt: {c.email}.</p>
      <h3>Jakie dane i po co</h3>
      <ul className="list">
        <li><b>Konto</b>: e‑mail, imię, hasło (zaszyfrowane) – żeby działało logowanie (art. 6 ust. 1 lit. b RODO).</li>
        <li><b>Dane o zdrowiu</b>: kontuzje, choroby, alergie, waga, wymiary – tylko po to, żeby plan i dieta były bezpieczne. Przetwarzamy je wyłącznie na podstawie Twojej wyraźnej zgody (art. 9 ust. 2 lit. a RODO), którą możesz w każdej chwili wycofać, usuwając konto lub te dane z ankiety.</li>
        <li><b>Treningi, dieta, nagrody, wiadomości</b> – żeby zapisywać postępy i układać kolejne treningi.</li>
        <li><b>Płatności</b> – status abonamentu (bez danych karty).</li>
      </ul>
      <h3>Kto widzi Twoje dane</h3>
      <p>Ty. Jeśli dołączysz do trenera – także Twój trener (plan, ankieta, treningi, waga). Administrator serwisu – w zakresie potrzebnym do obsługi konta. Nikt inny.</p>
      <h3>Podmioty przetwarzające</h3>
      <ul className="list">
        <li>Supabase – baza danych i logowanie (serwery w UE, jeśli tak wybrano w projekcie).</li>
        <li>Netlify – hosting strony.</li>
        <li>Google (Gemini) – Trener AI: wysyłamy tylko treść pytania oraz skrót ankiety i planu, bez e‑maila i nazwiska.</li>
        <li>Operator płatności – po uruchomieniu płatności.</li>
      </ul>
      <h3>Jak długo</h3>
      <p>Do usunięcia konta. Dane rozliczeniowe – tyle, ile wymagają przepisy podatkowe.</p>
      <h3>Twoje prawa</h3>
      <p>Dostęp, sprostowanie, usunięcie, przeniesienie (przycisk „Pobierz moje dane”), ograniczenie, sprzeciw, cofnięcie zgody i skarga do Prezesa UODO.</p>
      <h3>Pliki w przeglądarce</h3>
      <p>Używamy tylko pamięci przeglądarki potrzebnej do logowania, motywu i pracy offline. Bez reklam i śledzących ciasteczek.</p>
    </div>
  );
}

export function LegalPage({ which }) {
  return <Page><div><p className="eyebrow">Dokumenty</p><h1>{which === 'privacy' ? 'Polityka prywatności' : 'Regulamin'}</h1></div><div className="card" style={{ maxWidth: 760 }}>{which === 'privacy' ? <Privacy /> : <Terms />}</div></Page>;
}
export const TermsPage = () => <LegalPage which="terms" />;
export const PrivacyPage = () => <LegalPage which="privacy" />;
