-- Избранные треки: у каждого пользователя свои.
create table if not exists public.gym_track_favs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  track_id uuid not null references public.gym_tracks on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);
alter table public.gym_track_favs enable row level security;
revoke all on public.gym_track_favs from anon;
grant select, insert, delete on public.gym_track_favs to authenticated;
drop policy if exists "Только свои" on public.gym_track_favs;
create policy "Только свои" on public.gym_track_favs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
