-- pompujto.pl – schemat bazy Supabase.
-- Uruchom raz w Supabase: SQL Editor → New query → wklej całość → Run.
-- Pierwsza osoba, która założy konto, automatycznie zostaje administratorem (trenerem).

-- 1. Profile użytkowników (cały stan aplikacji w kolumnie data)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Ustawienia aplikacji (np. kod zaproszenia)
create table if not exists public.app_settings (
  key text primary key,
  value text
);
insert into public.app_settings (key, value) values ('invite_code', '') on conflict do nothing;

-- 3. Wiadomości: od trenera do ludzi (tekst, plan, nagroda) i od ludzi do trenera
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  from_id uuid references public.profiles(id) on delete set null,
  to_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'text' check (type in ('text', 'plan', 'reward')),
  title text,
  body text,
  payload jsonb,
  read boolean not null default false,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_to_idx on public.messages (to_id, created_at desc);

-- Pomocnicza funkcja: czy zalogowany użytkownik jest adminem
create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Nowy użytkownik → profil. Pierwszy = admin. Sprawdza kod zaproszenia, jeśli jest ustawiony.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  code text;
  first boolean;
begin
  select value into code from public.app_settings where key = 'invite_code';
  select not exists (select 1 from public.profiles where role = 'admin') into first;
  if not first and coalesce(code, '') <> '' and coalesce(new.raw_user_meta_data ->> 'invite', '') <> code then
    raise exception 'Nieprawidłowy kod zaproszenia';
  end if;
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
          case when first then 'admin' else 'user' end);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Zmiana roli – tylko admin
create or replace function public.set_role(uid uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Tylko administrator'; end if;
  if new_role not in ('user', 'admin') then raise exception 'Zła rola'; end if;
  if uid = auth.uid() and new_role = 'user' then raise exception 'Nie możesz odebrać roli sobie'; end if;
  update public.profiles set role = new_role where id = uid;
end;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.is_admin() or role = 'admin');  -- każdy widzi trenerów (żeby mógł do nich pisać)
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Użytkownik może zmieniać tylko swoje imię i dane – roli nie
revoke update on public.profiles from authenticated, anon;
grant update (name, data, updated_at) on public.profiles to authenticated;

drop policy if exists "settings_admin" on public.app_settings;
create policy "settings_admin" on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages for select
  using (to_id = auth.uid() or from_id = auth.uid() or public.is_admin());
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert
  with check (
    from_id = auth.uid() and (
      public.is_admin()
      or exists (select 1 from public.profiles p where p.id = to_id and p.role = 'admin')
    ) and (type = 'text' or public.is_admin())
  );
drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own" on public.messages for update
  using (to_id = auth.uid()) with check (to_id = auth.uid());
revoke update on public.messages from authenticated, anon;
grant update (read, done) on public.messages to authenticated;
drop policy if exists "messages_delete_admin" on public.messages;
create policy "messages_delete_admin" on public.messages for delete using (public.is_admin());

-- ===== Aktualizacja 2: panel trenera =====
-- pompujto.pl – aktualizacja 2: panel trenera (podopieczni, plany od trenera, edycja przez trenera).
-- Uruchom RAZ w Supabase: SQL Editor → New query → wklej całość → Run.
-- Bezpieczne do ponownego uruchomienia.

-- 1. Dane ustawiane przez trenera (plan, ankieta, uwaga) i przypisanie do trenera
alter table public.profiles add column if not exists coach jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists coach_id uuid references public.profiles(id) on delete set null;

-- Podopieczny nie może sam zmieniać tych kolumn (ma prawo tylko do name, data, updated_at)
revoke update on public.profiles from authenticated, anon;
grant update (name, data, updated_at) on public.profiles to authenticated;

-- 2. Trener zapisuje plan / ankietę / uwagę dla podopiecznego
create or replace function public.coach_set(uid uuid, patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Tylko trener'; end if;
  update public.profiles set coach = coalesce(coach, '{}'::jsonb) || patch where id = uid;
end;
$$;

-- 3. Trener przypisuje podopiecznego do siebie (albo innego trenera)
create or replace function public.coach_assign(uid uuid, cid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Tylko trener'; end if;
  update public.profiles set coach_id = cid where id = uid;
end;
$$;

-- 4. Nowe osoby trafiają automatycznie do pierwszego trenera
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  code text;
  first boolean;
  head uuid;
begin
  select value into code from public.app_settings where key = 'invite_code';
  select not exists (select 1 from public.profiles where role = 'admin') into first;
  if not first and coalesce(code, '') <> '' and coalesce(new.raw_user_meta_data ->> 'invite', '') <> code then
    raise exception 'Nieprawidłowy kod zaproszenia';
  end if;
  select id into head from public.profiles where role = 'admin' order by created_at limit 1;
  insert into public.profiles (id, email, name, role, coach_id)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
          case when first then 'admin' else 'user' end,
          case when first then null else head end);
  return new;
end;
$$;

-- 5. Osoby, które już są w bazie, przypisz do pierwszego trenera
update public.profiles p set coach_id = (select id from public.profiles where role = 'admin' order by created_at limit 1)
where p.role = 'user' and p.coach_id is null;
