# pompujto.pl

Aplikacja treningowa w React (Vite + Framer Motion). Działa w przeglądarce i jako aplikacja na telefonie (PWA).

**Dwie wersje w jednej aplikacji:**
- **Dla siebie** (20 zł/mies., 7 dni za darmo):
  - trening na dziś z progresją z historii;
  - plan pod cel i ankietę zdrowia;
  - dieta, nagrody, postępy (waga, wymiary, rekordy, siła, kalendarz);
  - Trener AI.
- **Trener** (79 zł/mies., 15 podopiecznych w cenie):
  - wszystko powyżej;
  - panel podopiecznych, kreator planów, wysyłka planów, nagród i wiadomości;
  - podgląd postępów każdej osoby.
- **Podopieczni trenera** dołączają kodem lub linkiem `?kod=XXXXXX` i nie płacą.

## Wdrożenie (GitHub → Netlify → Supabase)

1. **Repozytorium:** `sluchotekapl/pompujto-strona`. Każdy push na `main` wdraża się sam na Netlify.
2. **Netlify → Project configuration → Environment variables:**
   - `GEMINI_API_KEY`: klucz z https://aistudio.google.com/apikey (darmowy limit);
   - `SUPABASE_URL` i `SUPABASE_ANON_KEY`: z Supabase → Project Settings → API. Wtedy z AI korzystają tylko zalogowani.
   - Opcjonalnie:
     - `GEMINI_MODEL`;
     - `ANTHROPIC_API_KEY` z `AI_PROVIDER=claude`, jeśli kiedyś Claude zamiast Gemini.
3. **Supabase → SQL Editor:** uruchom po kolei, każdy plik raz:
   - `supabase/schema.sql`: konta, dane, wiadomości;
   - `supabase/aktualizacja-2-trener.sql`: plany od trenera i podopieczni;
   - `supabase/aktualizacja-3-dwie-wersje.sql`: konta trenerskie, kody trenerów, abonamenty, prywatność, usuwanie konta.
4. Pierwsze zarejestrowane konto zostaje administratorem. Administrator w karcie podopiecznego (zakładka Notatki):
   - zmienia rolę (Użytkownik / Trener / Administrator);
   - może włączyć darmowy dostęp.

## Ustawienia w `public/config.js`
```js
window.PJ_CONFIG = {
  supabaseUrl: '...', supabaseAnonKey: '...',
  paywall: false,          // true = po okresie próbnym blokada do czasu opłacenia (włączyć dopiero z płatnościami)
  company: { name: '...', address: '...', nip: '...', email: '...' }   // dane do regulaminu i polityki prywatności
};
```

## Aplikacja na telefon
Strona jest PWA:
- ma manifest, ikony i service worker;
- działa offline, a zapis czeka na internet.

Jak zainstalować:
- Android: Chrome → „Zainstaluj aplikację”.
- iPhone: Safari → Udostępnij → „Do ekranu początkowego”.

Wersje do sklepów (Google Play / App Store) to kolejny etap: opakowanie Capacitor.

## Praca lokalna
```
npm install
npm run dev      # podgląd na http://localhost:5173
npm run build    # gotowa strona w dist/
```
Bez `config.js` aplikacja działa w trybie lokalnym. Konta są wtedy w przeglądarce, a konto startowe to `trener` / `pompujto`.

## Gdzie co jest
- `src/lib/engine.js`: logika treningu, diety i nagród.
- `src/lib/backend.js`: konta (lokalnie albo Supabase), role, abonament (`access()`), ceny (`PRICES`).
- `src/lib/pwa.js` i `public/sw.js`: instalacja aplikacji i praca offline.
- `src/lib/ai.js` i `netlify/functions/ai.mjs`: Trener AI (Gemini, klucz tylko na serwerze).
- `src/views/`: ekrany.
  - Dziś, Plan, Trener AI, Postępy, Ćwiczenia, Dieta, Nagrody.
  - Ankieta, Wiadomości, Konto, Abonament, Regulamin/Prywatność.
  - Panel trenera.
- `supabase/`: schemat bazy i aktualizacje.

Zdjęcia i opisy ćwiczeń pochodzą z free-exercise-db (domena publiczna). Aplikacja nie zastępuje lekarza, dietetyka ani trenera.
