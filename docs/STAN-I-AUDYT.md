# Pompujto.pl – stan produktu, audyt i decyzje

Ostatnia aktualizacja: 4.11.2026. Dokument prowadzony na bieżąco, żeby dało się wznowić pracę.

## 1. Rzeczywista struktura

- **Front:** React 18 + Vite 5, punkt wejścia `index.html` → `src/main.jsx`.
  - Plik `index(1).html` z opisu to tylko nazwa pobranego załącznika, w repozytorium nie występuje.
  - Routing przez `#hash`, więc odświeżanie podstron nie wymaga przekierowań SPA i nie koliduje z `/.netlify/functions/*` ani zasobami.
- **Dane:** `src/lib/backend.js` łączy dwa tryby w jednym interfejsie:
  - `cloud`: Supabase;
  - `local`: demo w przeglądarce.
  - Tryb wybiera się wyłącznie na podstawie konfiguracji. Na produkcji `index.html` zawsze wstrzykuje konfigurację Supabase, więc awaria bazy **nie** przełącza po cichu na konta lokalne, tylko pokazuje błąd.
- **Logika:**
  - `src/lib/engine.js`: plany, progresja, dieta, nagrody;
  - `src/lib/coach.js`: przyjmowanie zmian od trenera, statystyki i alerty;
  - `src/lib/diets.js`: diety trenera i PDF.
- **Serwer:** `netlify/functions/ai.mjs` pośredniczy w dostępie do Gemini. Klucz jest tylko w zmiennych Netlify, funkcja wymaga zalogowania i ma limit 30 zapytań na 10 minut.
- **Baza:** `supabase/schema.sql` + aktualizacje 3 i 4. Plik `supabase/calosc-nowy-projekt.sql` to schemat i aktualizacja 3, dla nowych projektów.
- **Testy:** `supabase/tests/`. Szczegóły w punkcie 6.

## 2. Wyniki audytu (priorytety)

| # | Problem | Status |
|---|---|---|
| 1 | Pierwsze zarejestrowane konto automatycznie zostawało administratorem | **Naprawione** w aktualizacji 4. Admina nadaje się ręcznie. |
| 2 | Brak treningów z datą: podopieczny dostawał cały plan rotacyjny (z założenia jawny), nie było sposobu przygotowania ukrytej przyszłości | **Naprawione:** tabele `workouts` i `workout_logs`, blokada w RLS |
| 3 | Kod trenera wielokrotnego użytku i bez terminu | **Uzupełnione:** jednorazowe zaproszenia ważne 7 dni (`invites`). Kod stały zostaje jako opcja. |
| 4 | Do aktualizacji 3 każdy widział pełne dane administratora | Naprawione wcześniej (aktualizacja 3), potwierdzone testem 09 |
| 5 | AI bez limitu kosztów | Częściowo: limit w pamięci jednej instancji funkcji. Docelowo licznik w bazie. |
| 6 | Brak nagłówków bezpieczeństwa, wersji Node, `.env.example` | **Naprawione** (`netlify.toml`, `.nvmrc`, `.env.example`) |
| 7 | Brak organizacji (zespół trenerów) | Świadomie odłożone. Model: trener = jednoosobowa organizacja, przypisanie `profiles.coach_id`. Patrz punkt 7. |
| 8 | Płatności | Nie podłączone. Flaga `paywall:false`, nic nie jest blokowane. |

## 3. Matryca uprawnień (egzekwowana w bazie, RLS i funkcje `security definer`)

| Obiekt | Podopieczny | Trener | Admin platformy |
|---|---|---|---|
| Własny profil, `data` | odczyt i zapis (tylko `name`, `data`) | to samo | to samo |
| Rola, abonament, `coach`, `coach_id` | brak zapisu | `coach` swoich podopiecznych przez `coach_set` | wszystko przez `set_role` i `set_billing` |
| Profile innych | brak | tylko przypisani podopieczni | wszyscy |
| Prywatne notatki trenera (w jego `data`) | brak (test 09) | swoje | wszystkie (konto techniczne) |
| `workouts` | **tylko dostępne** (punkt 4) | pełny dostęp do swoich podopiecznych | pełny |
| `workout_logs` | własne: zapis i odczyt, edycja do 2 dni | odczyt swoich podopiecznych | odczyt |
| `invites` | brak | własne: tworzenie, odczyt, usuwanie nieużytych | odczyt |
| Wiadomości | do swojego trenera lub admina (tekst) | do swoich podopiecznych | wszystko |

Przeglądarka nigdy nie decyduje o `trainer_id` ani roli. Polityki sprawdzają `auth.uid()`.

## 4. Reguła publikacji treningów (kalendarz)

Trening jest dostępny dla podopiecznego wtedy i tylko wtedy, gdy:

- `status = 'published'`;
- `scheduled_date <= dzisiejsza data w strefie tz` (domyślnie Europe/Warsaw);
- `available_at` jest puste albo już minęło.

Funkcja `public.workout_visible()` w bazie jest jedynym źródłem tej reguły. Front ma jej lustro (`workoutVisible`) tylko do wyświetlania.

Jak zachowują się poszczególne przypadki:

- **Wcześniejsza publikacja przyszłego treningu** nic nie odsłania.
- **Wycofanie publikacji** (powrót do szkicu) ukrywa trening natychmiast przy kolejnym odczycie.
- **Zmiana terminu na przyszły** ukrywa trening ponownie.
- **Kilka treningów jednego dnia** jest dozwolone. Ekran Dziś pokazuje pierwszy niewykonany.
- **Brak treningu** oznacza, że obowiązuje plan rotacyjny.
- **Trening pominięty** trener widzi jako „niewykonany”.
- **Północ i zmiana czasu:** dzień liczymy `now() at time zone tz` na serwerze, a momenty przechowujemy jako `timestamptz` (UTC).
- **Zmiana treningu po rozpoczęciu:** przy starcie wykonanie zapisuje kopię zaleceń (`prescription`) i numer wersji (`workout_version`). Edycja treści podbija `version`, a historia się nie zmienia.
- **Ponowione wysłanie** nie tworzy duplikatu dzięki unikalnemu `(client_id, client_key)`. W przeglądarce działa kolejka ponowień `pompujto:logq` przy braku sieci.

Kanały, którymi przyszły trening **nie** trafia do podopiecznego:

- REST i klient Supabase, w tym wyszukiwanie po treści (testy 19–21);
- eksport (podopieczny eksportuje tylko własne `data`);
- AI (kontekst AI to profil i plan rotacyjny, bez kalendarza);
- powiadomienia (nie wysyłamy treści przyszłych treningów);
- Realtime (nieużywane);
- service worker (nie zapisuje odpowiedzi Supabase, bo to inna domena).

**Plan rotacyjny** (A/B/C) jest z założenia jawny dla podopiecznego. Ukrywanie przyszłości dotyczy kalendarza.

## 5. Co działa (sprawdzone)

- Logowanie i rejestracja (Supabase), wywiad, plan rotacyjny z progresją, dieta, nagrody i postępy.
- Panel trenera:
  - podopieczni i alerty, kreator planów (ręcznie / AI / algorytm, zawsze z poprawkami);
  - diety z PDF, kalendarz z blokadą przyszłości;
  - komentarze do treningów, check-iny.
- Panel administratora z analityką i listą użytkowników.
- PWA: instalacja i kolejka zapisów offline.

## 6. Testy i ich wyniki

- **`supabase/tests/10-rls.sql`: 36/36 PASS.** Uruchomione na lokalnym PostgreSQL 16 z imitacją Supabase (`00-shim.sql`). Używa zwykłych sesji (rola `authenticated` z identyfikatorem w JWT), bez omijania RLS.
  - Obejmuje: brak automatycznego admina, zaproszenia (użycie, ponowne użycie, wygaśnięcie), izolację dwóch trenerów, próby podniesienia roli i abonamentu, prywatne notatki, przyszłe treningi (po id i po treści), dodawanie i przesuwanie przez podopiecznego, idempotencję zapisu, blokadę logowania przyszłości, wycofanie publikacji, wersjonowanie i strefę czasową.
  - Jak uruchomić: patrz komentarz w pliku. Potrzebny lokalny PostgreSQL, **nie uruchamiać w produkcji**.
- **Testy przeglądarkowe (Playwright, tryb lokalny):**
  - trener tworzy zaproszenie, podopieczny rejestruje się z linku;
  - ponowne użycie zaproszenia zostaje odrzucone;
  - trener planuje treningi na dziś i na jutro, a podopieczny widzi tylko dzisiejszy (treści „jutro” nie ma w DOM);
  - wykonanie zapisuje się z kluczem idempotencji, a karta znika po wykonaniu.
- **Niesprawdzone na produkcji:** aktualizacja 4 czeka na uruchomienie w Supabase. Po uruchomieniu trzeba powtórzyć scenariusz na prawdziwych kontach.

## 7. Znane ograniczenia i dalsze kroki (priorytet)

1. **Uruchomić aktualizację 4 w Supabase** i sprawdzić scenariusz kalendarza na produkcji.
2. **Płatności:** dostawca (np. Stripe lub Przelewy24), webhooki z podpisem i idempotencją, uprawnienia wyłącznie z danych serwerowych.
   - Limit 15 podopiecznych trzeba egzekwować w bazie (funkcja przy przypisaniu).
   - Teraz limit jest tylko wyświetlany.
3. **Organizacje i zespoły trenerów** (tabela `organizations` i `memberships`): migracja z `coach_id` bez utraty danych.
4. **Licznik AI w bazie** (dzienny limit na użytkownika) zamiast pamięci instancji.
5. **Raporty i ankiety:**
   - ankiety z wersjami formularzy;
   - raporty ze statusem, oceną trenera i blokadą podwójnego wysłania.
   - Teraz check-in tygodniowy siedzi w `data` podopiecznego.
6. **Zdjęcia sylwetki:** wymagają prywatnego bucketa Storage z politykami. Nie wdrożone.
7. **Dane w `profiles.data` (jsonb):** historia, dieta i nagrody są zapisywane przez właściciela, więc podopieczny może je dowolnie edytować. Wpływa to tylko na jego własne statystyki. Docelowo historia powinna trafiać do `workout_logs`.
8. **Ustalenia prawne** (wymagają właściciela, nie kodu):
   - dane sprzedawcy w regulaminie;
   - okresy retencji;
   - rola trenera jako współadministratora lub podmiotu przetwarzającego dane podopiecznych;
   - region bazy (projekt: eu-north-1).

## 8. Co musi dostarczyć właściciel

- Uruchomienie `supabase/aktualizacja-4-kalendarz-zaproszenia.sql` w Supabase (SQL Editor). Zmiana jest wyłącznie dodająca.
- Poprawne dane SMTP w Supabase:
  - **Username** = login SMTP z Brevo;
  - **Password** = klucz SMTP.
- Dane firmy do `public/config.js` (`company`).
- Decyzja o dostawcy płatności.
