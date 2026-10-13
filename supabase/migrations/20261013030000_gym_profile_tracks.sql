-- Треки, которые пользователь сам выставил в профиль (до 10). Видят все вошедшие, менять — только владелец.
create table if not exists public.gym_profile_tracks (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  track_id uuid not null references public.gym_tracks on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);
alter table public.gym_profile_tracks enable row level security;
revoke all on public.gym_profile_tracks from anon;
grant select, insert, delete on public.gym_profile_tracks to authenticated;
drop policy if exists "Видят вошедшие" on public.gym_profile_tracks;
create policy "Видят вошедшие" on public.gym_profile_tracks for select to authenticated using (true);
drop policy if exists "Добавляет владелец" on public.gym_profile_tracks;
create policy "Добавляет владелец" on public.gym_profile_tracks for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Удаляет владелец" on public.gym_profile_tracks;
create policy "Удаляет владелец" on public.gym_profile_tracks for delete to authenticated using (user_id = (select auth.uid()));

-- Избранное снова личное: в профиле показывается только то, что выставлено туда отдельно.
drop policy if exists "Видят вошедшие" on public.gym_track_favs;
drop policy if exists "Добавляет владелец" on public.gym_track_favs;
drop policy if exists "Удаляет владелец" on public.gym_track_favs;
drop policy if exists "Только свои" on public.gym_track_favs;
create policy "Только свои" on public.gym_track_favs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
