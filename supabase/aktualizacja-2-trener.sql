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
