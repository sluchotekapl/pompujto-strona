-- pompujto.pl – aktualizacja 4: treningi w kalendarzu z serwerową blokadą przyszłości, zapis wykonania bez duplikatów,
-- jednorazowe zaproszenia z datą ważności, koniec reguły „pierwsze konto = administrator”.
-- Zmiany wyłącznie dodające (bez usuwania danych). Bezpieczne do ponownego uruchomienia.

-- 1. Administrator platformy NIE powstaje już automatycznie. Nadaje się go ręcznie (SQL) albo z panelu innego administratora.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  code text; inv text; tr uuid; k text; tok record; tok_token text;
begin
  select value into code from public.app_settings where key = 'invite_code';
  inv := trim(coalesce(new.raw_user_meta_data ->> 'invite', ''));
  k := case when new.raw_user_meta_data ->> 'kind' = 'trainer' then 'trainer' else 'user' end;
  if inv <> '' then
    -- jednorazowe zaproszenie (token) …
    select * into tok from public.invites where token = lower(inv) for update;
    if found then
      if tok.used_at is not null or tok.expires_at < now() then raise exception 'Zaproszenie wygasło albo zostało już użyte'; end if;
      tr := tok.trainer_id; tok_token := tok.token;
    else
      -- … albo stały kod trenera
      select id into tr from public.profiles where trainer_code = upper(inv) and role in ('admin', 'trainer');
    end if;
  end if;
  if tr is null and coalesce(code, '') <> '' and upper(inv) <> upper(code) then
    raise exception 'Nieprawidłowy kod zaproszenia';
  end if;
  insert into public.profiles (id, email, name, role, kind, coach_id, trainer_code, consents)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
          case when k = 'trainer' and tr is null then 'trainer' else 'user' end,
          case when k = 'trainer' and tr is null then 'trainer' else 'user' end,
          tr,
          case when k = 'trainer' and tr is null then upper(substr(md5(new.id::text), 1, 6)) else null end,
          coalesce(new.raw_user_meta_data -> 'consents', '{}'::jsonb));
  if tok_token is not null then
    update public.invites set used_by = new.id, used_at = now() where token = tok_token;
  end if;
  return new;
end;
$$;

-- 2. Jednorazowe zaproszenia
create table if not exists public.invites (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invites_trainer_idx on public.invites (trainer_id, created_at desc);
alter table public.invites enable row level security;
drop policy if exists "invites_own" on public.invites;
create policy "invites_own" on public.invites for select using (trainer_id = auth.uid() or public.is_admin());
drop policy if exists "invites_insert" on public.invites;
create policy "invites_insert" on public.invites for insert with check (trainer_id = auth.uid() and public.is_staff());
drop policy if exists "invites_delete" on public.invites;
create policy "invites_delete" on public.invites for delete using (trainer_id = auth.uid() and used_at is null);
revoke update on public.invites from authenticated, anon;
revoke all on public.invites from anon;

-- Zalogowana osoba przyjmuje zaproszenie (token jednorazowy, z blokadą wiersza – dwa równoczesne użycia nie przejdą)
create or replace function public.redeem_invite(tok text) returns text
language plpgsql security definer set search_path = public as $$
declare r record; n text;
begin
  if auth.uid() is null then raise exception 'Zaloguj się'; end if;
  select * into r from public.invites where token = lower(trim(tok)) for update;
  if not found then raise exception 'Nie ma takiego zaproszenia'; end if;
  if r.used_at is not null then raise exception 'To zaproszenie zostało już użyte'; end if;
  if r.expires_at < now() then raise exception 'Zaproszenie wygasło – poproś trenera o nowe'; end if;
  if r.trainer_id = auth.uid() then raise exception 'To Twoje własne zaproszenie'; end if;
  update public.profiles set coach_id = r.trainer_id where id = auth.uid();
  update public.invites set used_by = auth.uid(), used_at = now() where token = r.token;
  select name into n from public.profiles where id = r.trainer_id;
  return n;
end;
$$;

-- 3. Treningi zaplanowane w kalendarzu
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  trainer_id uuid references public.profiles(id) on delete set null,
  scheduled_date date not null,                  -- dzień treningu w strefie tz
  available_at timestamptz,                      -- opcjonalnie: nie wcześniej niż (np. dzień wcześniej 20:00)
  tz text not null default 'Europe/Warsaw',
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  title text not null check (char_length(title) between 1 and 120),
  content jsonb not null,                        -- dzień planu: ćwiczenia z zaleceniami
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workouts_client_date_idx on public.workouts (client_id, scheduled_date);

-- Jedno miejsce z regułą „trening jest już dostępny dla podopiecznego”. Czas liczony na serwerze, dzień w strefie tz.
-- Dostępny = opublikowany ORAZ jego dzień już nastał ORAZ minął ewentualny available_at.
-- Wcześniejsze opublikowanie przyszłego treningu niczego nie odsłania.
create or replace function public.workout_visible(st text, d date, avail timestamptz, zone text) returns boolean
language sql stable set search_path = public as $$
  select st = 'published'
     and d <= (now() at time zone coalesce(zone, 'Europe/Warsaw'))::date
     and (avail is null or avail <= now());
$$;

alter table public.workouts enable row level security;
drop policy if exists "workouts_select" on public.workouts;
create policy "workouts_select" on public.workouts for select using (
  public.can_manage(client_id)
  or (client_id = auth.uid() and public.workout_visible(status, scheduled_date, available_at, tz))
);
drop policy if exists "workouts_insert" on public.workouts;
create policy "workouts_insert" on public.workouts for insert with check (public.can_manage(client_id) and trainer_id = auth.uid());
drop policy if exists "workouts_update" on public.workouts;
create policy "workouts_update" on public.workouts for update using (public.can_manage(client_id)) with check (public.can_manage(client_id));
drop policy if exists "workouts_delete" on public.workouts;
create policy "workouts_delete" on public.workouts for delete using (public.can_manage(client_id));
revoke all on public.workouts from anon;

create or replace function public.workouts_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.content is distinct from old.content then new.version := old.version + 1; end if;
  return new;
end; $$;
drop trigger if exists workouts_touch on public.workouts;
create trigger workouts_touch before update on public.workouts for each row execute function public.workouts_touch();

-- 4. Zapis wykonania: kopia zaleceń z chwili startu, klucz idempotencji (ponowione żądanie nie tworzy duplikatu)
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete set null,
  client_key text not null check (char_length(client_key) between 6 and 64),
  workout_version int,
  prescription jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, client_key)
);
create index if not exists workout_logs_client_idx on public.workout_logs (client_id, created_at desc);
alter table public.workout_logs enable row level security;
drop policy if exists "logs_select" on public.workout_logs;
create policy "logs_select" on public.workout_logs for select using (client_id = auth.uid() or public.can_manage(client_id));
drop policy if exists "logs_insert" on public.workout_logs;
create policy "logs_insert" on public.workout_logs for insert with check (
  client_id = auth.uid() and (
    workout_id is null or exists (select 1 from public.workouts w where w.id = workout_id and w.client_id = auth.uid()
      and public.workout_visible(w.status, w.scheduled_date, w.available_at, w.tz))
  )
);
drop policy if exists "logs_update" on public.workout_logs;
create policy "logs_update" on public.workout_logs for update using (client_id = auth.uid() and created_at > now() - interval '2 days') with check (
  client_id = auth.uid() and (
    workout_id is null or exists (select 1 from public.workouts w where w.id = workout_id and w.client_id = auth.uid()
      and public.workout_visible(w.status, w.scheduled_date, w.available_at, w.tz))
  )
);
revoke all on public.workout_logs from anon;
