# pompujto.pl

Aplikacja treningowa w React (Vite + Framer Motion).
- **Plan na dziś:** progresja ciężarów i ankieta zdrowotna.
- **200 ćwiczeń** z animacją.
- **Trener AI:** układa plany, odpowiada na pytania i komentuje treningi.
- **Dieta:** jadłospis, lista zakupów i zasady „jedz / unikaj”.
- **Nagrody:** posiłki-nagrody, koło nagród i odznaki.
- **Konta i panel trenera:** wiadomości, plany i nagrody wysyłane do ludzi.

## Trzy poziomy wdrożenia

### 1. Najszybciej: sama strona (5 minut)
Wejdź na https://app.netlify.com/drop i przeciągnij folder `dist`.
Strona działa od razu, ale:
- konta zapisują się tylko w przeglądarce, na której je założono,
- Trener AI jest wyłączony, a plany układa algorytm.

### 2. Prawdziwe konta: logowanie z każdego urządzenia (15 minut)
1. Załóż darmowy projekt na https://supabase.com.
2. W **SQL Editor** wklej całą zawartość pliku `supabase/schema.sql` i kliknij **Run**.
3. W **Authentication → Sign In / Providers → Email** możesz wyłączyć „Confirm email”, jeśli nie chcesz, żeby ludzie musieli klikać link w mailu.
4. W **Project Settings → API** skopiuj:
   - **Project URL**,
   - klucz **anon public**.
5. Wklej je do pliku `dist/config.js` (albo `public/config.js` przed budowaniem).
6. Wrzuć stronę ponownie.
7. **Zarejestruj się jako pierwszy.** Pierwsze konto automatycznie zostaje trenerem (adminem) i dostaje dostęp do Panelu trenera.
8. W Panelu trenera ustaw kod zaproszenia i wysyłaj ludziom gotowy tekst zaproszenia.

### 3. Trener AI (funkcja serwerowa)
Drag & drop na Netlify nie obsługuje funkcji, więc potrzebne jest wdrożenie z GitHuba.
1. Wrzuć cały ten folder do repozytorium na GitHubie.
2. W Netlify wybierz **Add new site → Import from Git**. Ustawienia budowania (`npm run build`, folder `dist`) Netlify weźmie z pliku `netlify.toml`.
3. W **Site configuration → Environment variables** dodaj:
   - `ANTHROPIC_API_KEY`: klucz z https://console.anthropic.com,
   - `SUPABASE_URL` i `SUPABASE_ANON_KEY`: te same wartości co w `config.js`. Dzięki nim z AI korzystają tylko zalogowani.
   - `AI_MODEL` (opcjonalnie): domyślnie `claude-haiku-5-5`, czyli tani i szybki model.
4. Zrób redeploy. Od tej chwili działają: „Ułóż plan z AI”, czat z trenerem i komentarz po każdym treningu.

### Domena pompujto.pl
Kup domenę u rejestratora. Potem w Netlify wejdź w **Domain management → Add domain** i ustaw u rejestratora DNS według instrukcji Netlify.

## Praca lokalna
```
npm install
npm run dev      # podgląd na http://localhost:5173
npm run build    # gotowa strona w dist/
```

## Gdzie co jest
- `src/lib/engine.js`: logika treningu, diety i nagród (szablony programów, przeciwwskazania, progresja, XP).
- `src/lib/data-exercises.js`: 200 ćwiczeń. Zdjęcia są w `public/img/<id>_0.webp` (początek ruchu) i `_1.webp` (koniec ruchu).
- `src/lib/data-food.js`: posiłki, alergeny i zasady żywienia.
- `src/lib/backend.js`: konta, czyli tryb lokalny albo Supabase.
- `src/lib/ai.js`: Trener AI. Najpierw próbuje funkcji Netlify, potem podglądu Claude. Gdy żadne nie działa, plan układa algorytm.
- `netlify/functions/ai.mjs`: pośrednik do Claude API (klucz nigdy nie trafia do przeglądarki).
- `supabase/schema.sql`: tabele i zabezpieczenia. Każdy widzi tylko swoje dane, a trener widzi wszystkich.
- `src/views/`: ekrany Dziś, Plan, Trener AI, Ćwiczenia, Dieta, Nagrody, Ankieta, Wiadomości i Panel trenera.

Zdjęcia i opisy ćwiczeń pochodzą z free-exercise-db (domena publiczna).
Aplikacja nie zastępuje lekarza, dietetyka ani trenera.
