-- Дневные отметки: сколько спал (пока только сон, сюда же можно добавить шаги, воду).
create table if not exists public.gym_days (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  sleep_h numeric(3,1) check (sleep_h between 0 and 24),
  primary key (user_id, day)
);
alter table public.gym_days enable row level security;
revoke all on public.gym_days from anon;
grant select, insert, update, delete on public.gym_days to authenticated;
drop policy if exists "Только свои" on public.gym_days;
create policy "Только свои" on public.gym_days for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
