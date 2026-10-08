-- Друзья: все вошедшие видят профили и тренировки друг друга (только чтение). Менять по-прежнему можно только своё.
do $$
declare t text;
begin
  foreach t in array array['gym_profile','gym_workouts','gym_exercises'] loop
    execute format('drop policy if exists "Видно всем вошедшим" on public.%I', t);
    execute format('create policy "Видно всем вошедшим" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

-- Тренировка или программа, которую один пользователь предложил другому. Получатель принимает или отклоняет.
create table if not exists public.gym_shares (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null default auth.uid() references auth.users on delete cascade,
  to_user uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('workout', 'program')),
  day date,                                   -- на какой день предложена тренировка
  payload jsonb not null default '{}'::jsonb, -- workout: {"title", "items": [{"name", "s", "r"}]}; program: {"program_id", "days"}
  note text not null default '',
  status text not null default 'new' check (status in ('new', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create index if not exists gym_shares_to on public.gym_shares (to_user, status);
create index if not exists gym_shares_from on public.gym_shares (from_user, created_at);

alter table public.gym_shares enable row level security;
revoke all on public.gym_shares from anon;
revoke all on public.gym_shares from authenticated;
grant select, insert, delete on public.gym_shares to authenticated;
grant update (status) on public.gym_shares to authenticated;
drop policy if exists "Свои предложения" on public.gym_shares;
create policy "Свои предложения" on public.gym_shares for select to authenticated using ((select auth.uid()) in (from_user, to_user));
drop policy if exists "Отправлять от себя" on public.gym_shares;
create policy "Отправлять от себя" on public.gym_shares for insert to authenticated with check (from_user = (select auth.uid()));
drop policy if exists "Отвечает получатель" on public.gym_shares;
create policy "Отвечает получатель" on public.gym_shares for update to authenticated using (to_user = (select auth.uid())) with check (to_user = (select auth.uid()));
drop policy if exists "Удалять свои" on public.gym_shares;
create policy "Удалять свои" on public.gym_shares for delete to authenticated using ((select auth.uid()) in (from_user, to_user));
