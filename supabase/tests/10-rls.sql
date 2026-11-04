-- Testy uprawnień na zwykłych sesjach (rola authenticated + identyfikator w JWT), bez omijania RLS.
-- Uruchamiać WYŁĄCZNIE na lokalnej kopii: 00-shim.sql + schema.sql + aktualizacje 3 i 4. Wynik: tabela PASS/FAIL.
\set QUIET on
create table if not exists public.test_results (n serial, name text, ok boolean, info text);
truncate public.test_results;
grant all on public.test_results to authenticated; grant usage, select on sequence public.test_results_n_seq to authenticated;

create or replace function public.t_as(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false); execute 'set role authenticated'; end; $$;
create or replace function public.t_reset() returns void language plpgsql as $$ begin execute 'reset role'; perform set_config('request.jwt.claims', '', false); end; $$;
create or replace function public.t_ok(name text, ok boolean, info text default '') returns void language sql as $$ insert into public.test_results (name, ok, info) values (name, coalesce(ok, false), info) $$;
grant execute on function public.t_as(uuid), public.t_reset(), public.t_ok(text, boolean, text) to authenticated;

-- ===== Dane syntetyczne =====
-- a = admin platformy, b = trener 1, c = trener 2, d = podopieczny trenera 1, e = podopieczny trenera 2, f = osoba bez trenera
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{"name":"Admin"}');
select public.t_ok('01 pierwsze konto NIE dostaje roli admin', (select role from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'user');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000b', 'trener1@test.local', '{"name":"Trener 1","kind":"trainer"}'),
 ('00000000-0000-0000-0000-00000000000c', 'trener2@test.local', '{"name":"Trener 2","kind":"trainer"}'),
 ('00000000-0000-0000-0000-00000000000f', 'solo@test.local', '{"name":"Solo"}');
update public.profiles set data = '{"coachNotes":{"x":"PRYWATNA NOTATKA"}}' where id = '00000000-0000-0000-0000-00000000000b';

-- trener 1 tworzy zaproszenie jednorazowe; podopieczny d rejestruje się z nim
select public.t_as('00000000-0000-0000-0000-00000000000b');
insert into public.invites (token, trainer_id) values ('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '00000000-0000-0000-0000-00000000000b');
insert into public.invites (token, trainer_id, expires_at) values ('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', '00000000-0000-0000-0000-00000000000b', now() - interval '1 hour');
select public.t_reset();
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000d', 'pod1@test.local', '{"name":"Podopieczny 1","invite":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}');
select public.t_ok('02 rejestracja z zaproszeniem przypisuje trenera', (select coach_id from public.profiles where id = '00000000-0000-0000-0000-00000000000d') = '00000000-0000-0000-0000-00000000000b');
select public.t_ok('03 zaproszenie oznaczone jako użyte', (select used_by from public.invites where token = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') = '00000000-0000-0000-0000-00000000000d');
do $$ begin
  insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000099', 'x@test.local', '{"invite":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}');
  perform public.t_ok('04 ponowne użycie zaproszenia przy rejestracji – odmowa', false);
exception when others then perform public.t_ok('04 ponowne użycie zaproszenia przy rejestracji – odmowa', true, sqlerrm); end $$;
-- e dołącza do trenera 2 stałym kodem
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000e', 'pod2@test.local',
  json_build_object('name', 'Podopieczny 2', 'invite', (select trainer_code from public.profiles where id = '00000000-0000-0000-0000-00000000000c'))::jsonb);

-- osoba f próbuje przyjąć zużyte i wygasłe zaproszenie
select public.t_as('00000000-0000-0000-0000-00000000000f');
do $$ begin perform public.redeem_invite('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'); perform public.t_ok('05 zużyte zaproszenie – odmowa', false);
exception when others then perform public.t_ok('05 zużyte zaproszenie – odmowa', true, sqlerrm); end $$;
do $$ begin perform public.redeem_invite('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'); perform public.t_ok('06 wygasłe zaproszenie – odmowa', false);
exception when others then perform public.t_ok('06 wygasłe zaproszenie – odmowa', true, sqlerrm); end $$;
select public.t_ok('07 f nie widzi zaproszeń trenera', (select count(*) from public.invites) = 0);
select public.t_reset();

-- ===== Izolacja profili =====
select public.t_as('00000000-0000-0000-0000-00000000000d');
select public.t_ok('08 podopieczny widzi tylko siebie', (select count(*) from public.profiles) = 1);
select public.t_ok('09 podopieczny nie odczyta prywatnych notatek trenera', (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 0);
do $$ begin update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000d'; perform public.t_ok('10 podopieczny nie podniesie sobie roli', false);
exception when others then perform public.t_ok('10 podopieczny nie podniesie sobie roli', true, sqlerrm); end $$;
do $$ begin update public.profiles set billing = '{"comp":true}' where id = '00000000-0000-0000-0000-00000000000d'; perform public.t_ok('11 podopieczny nie zmieni abonamentu', false);
exception when others then perform public.t_ok('11 podopieczny nie zmieni abonamentu', true, sqlerrm); end $$;
do $$ begin update public.profiles set coach = '{"program":1}' where id = '00000000-0000-0000-0000-00000000000d'; perform public.t_ok('12 podopieczny nie podrobi danych od trenera', false);
exception when others then perform public.t_ok('12 podopieczny nie podrobi danych od trenera', true, sqlerrm); end $$;
do $$ begin perform public.set_role('00000000-0000-0000-0000-00000000000d', 'admin'); perform public.t_ok('13 set_role tylko dla admina', false);
exception when others then perform public.t_ok('13 set_role tylko dla admina', true, sqlerrm); end $$;
do $$ begin insert into public.messages (from_id, to_id, type, body) values ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000e', 'text', 'hej'); perform public.t_ok('14 wiadomość do obcego podopiecznego – odmowa', false);
exception when others then perform public.t_ok('14 wiadomość do obcego podopiecznego – odmowa', true, sqlerrm); end $$;
select public.t_reset();

select public.t_as('00000000-0000-0000-0000-00000000000c');
select public.t_ok('15 trener 2 nie widzi podopiecznego trenera 1', (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000d') = 0);
do $$ begin perform public.coach_set('00000000-0000-0000-0000-00000000000d', '{"note":"x"}'); perform public.t_ok('16 trener 2 nie zmieni planu cudzego podopiecznego', false);
exception when others then perform public.t_ok('16 trener 2 nie zmieni planu cudzego podopiecznego', true, sqlerrm); end $$;
select public.t_reset();

-- ===== Kalendarz: blokada przyszłych treningów =====
select public.t_as('00000000-0000-0000-0000-00000000000b');
select public.t_ok('17 trener 1 widzi swojego podopiecznego', (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000d') = 1);
insert into public.workouts (id, client_id, trainer_id, scheduled_date, status, title, content) values
 ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000b', (now() at time zone 'Europe/Warsaw')::date, 'published', 'DZIS', '{"slots":[]}'),
 ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000b', (now() at time zone 'Europe/Warsaw')::date + 1, 'published', 'JUTRO-OPUBLIKOWANY', '{"secret":"PRZYSZLOSC"}'),
 ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000b', (now() at time zone 'Europe/Warsaw')::date, 'draft', 'DZIS-SZKIC', '{}'),
 ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000b', (now() at time zone 'Europe/Warsaw')::date - 1, 'cancelled', 'WCZORAJ-ODWOLANY', '{}'),
 ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000b', (now() at time zone 'Europe/Warsaw')::date, 'published', 'DZIS-ZA-2H', '{}'),
 ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000b', (now() at time zone 'Europe/Warsaw')::date - 3, 'published', 'HISTORIA', '{}');
update public.workouts set available_at = now() + interval '2 hours' where id = '10000000-0000-0000-0000-000000000005';
select public.t_ok('18 trener widzi wszystkie swoje treningi (także przyszłe)', (select count(*) from public.workouts) = 6);
select public.t_reset();

select public.t_as('00000000-0000-0000-0000-00000000000d');
select public.t_ok('19 podopieczny widzi tylko dostępne: dziś + historia', (select string_agg(title, ',' order by title) from public.workouts) = 'DZIS,HISTORIA', (select string_agg(title, ',' order by title) from public.workouts));
select public.t_ok('20 przyszły opublikowany trening niedostępny po id', (select count(*) from public.workouts where id = '10000000-0000-0000-0000-000000000002') = 0);
select public.t_ok('21 treść przyszłości nie wycieka zapytaniem po zawartości', (select count(*) from public.workouts where content::text like '%PRZYSZLOSC%') = 0);
do $$ begin insert into public.workouts (client_id, trainer_id, scheduled_date, status, title, content) values ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', current_date, 'published', 'SAM', '{}'); perform public.t_ok('22 podopieczny nie doda sobie treningu', false);
exception when others then perform public.t_ok('22 podopieczny nie doda sobie treningu', true, sqlerrm); end $$;
update public.workouts set status = 'published', scheduled_date = current_date - 5 where id = '10000000-0000-0000-0000-000000000002';
select public.t_ok('23 podopieczny nie przesunie przyszłego treningu', (select count(*) from public.workouts) = 2);
-- zapis wykonania: idempotencja i blokada logowania przyszłości
insert into public.workout_logs (workout_id, client_key, result) values ('10000000-0000-0000-0000-000000000001', 'sesja-123456', '{"sets":1}')
  on conflict (client_id, client_key) do update set result = excluded.result;
insert into public.workout_logs (workout_id, client_key, result) values ('10000000-0000-0000-0000-000000000001', 'sesja-123456', '{"sets":2}')
  on conflict (client_id, client_key) do update set result = excluded.result;
select public.t_ok('24 ponowiony zapis nie tworzy duplikatu', (select count(*) from public.workout_logs where client_key = 'sesja-123456') = 1);
select public.t_ok('25 ponowiony zapis aktualizuje wynik', (select result->>'sets' from public.workout_logs where client_key = 'sesja-123456') = '2');
do $$ begin insert into public.workout_logs (workout_id, client_key) values ('10000000-0000-0000-0000-000000000002', 'sesja-przyszla'); perform public.t_ok('26 nie da się zapisać wykonania przyszłego treningu', false);
exception when others then perform public.t_ok('26 nie da się zapisać wykonania przyszłego treningu', true, sqlerrm); end $$;
select public.t_reset();

select public.t_as('00000000-0000-0000-0000-00000000000c');
select public.t_ok('27 trener 2 nie widzi treningów cudzego podopiecznego', (select count(*) from public.workouts) = 0);
select public.t_ok('28 trener 2 nie widzi wykonania cudzego podopiecznego', (select count(*) from public.workout_logs) = 0);
do $$ begin insert into public.workouts (client_id, trainer_id, scheduled_date, title, content) values ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000c', current_date, 'OBCY', '{}'); perform public.t_ok('29 trener 2 nie doda treningu cudzemu podopiecznemu', false);
exception when others then perform public.t_ok('29 trener 2 nie doda treningu cudzemu podopiecznemu', true, sqlerrm); end $$;
select public.t_reset();

select public.t_as('00000000-0000-0000-0000-00000000000b');
select public.t_ok('30 trener 1 widzi wykonanie swojego podopiecznego', (select count(*) from public.workout_logs) = 1);
update public.workouts set content = '{"slots":[1]}' where id = '10000000-0000-0000-0000-000000000001';
select public.t_ok('31 zmiana treści podbija wersję treningu', (select version from public.workouts where id = '10000000-0000-0000-0000-000000000001') = 2);
update public.workouts set status = 'draft' where id = '10000000-0000-0000-0000-000000000001';
select public.t_reset();
select public.t_as('00000000-0000-0000-0000-00000000000d');
select public.t_ok('32 wycofanie publikacji natychmiast ukrywa trening', (select count(*) from public.workouts where id = '10000000-0000-0000-0000-000000000001') = 0);
select public.t_ok('33 historia wykonania zostaje po wycofaniu', (select count(*) from public.workout_logs) = 1);
select public.t_reset();

-- granica dnia liczona w strefie Europe/Warsaw, nie w UTC
select public.t_ok('34 dzień jutrzejszy (Warszawa) niedostępny', not public.workout_visible('published', (now() at time zone 'Europe/Warsaw')::date + 1, null, 'Europe/Warsaw'));
select public.t_ok('35 dzień dzisiejszy (Warszawa) dostępny', public.workout_visible('published', (now() at time zone 'Europe/Warsaw')::date, null, 'Europe/Warsaw'));
select public.t_ok('36 anon nie ma dostępu do treningów', not has_table_privilege('anon', 'public.workouts', 'select'));

select n, case when ok then 'PASS' else 'FAIL' end as wynik, name, left(info, 70) as info from public.test_results order by n;
select count(*) filter (where ok) as pass, count(*) filter (where not ok) as fail from public.test_results;
