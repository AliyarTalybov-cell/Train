-- Фото в профиле: файлы — в закрытом хранилище gym-avatars в папке владельца (<id>/photos/...),
-- права на файлы там уже есть: видят вошедшие, загружает и удаляет только владелец своей папки.
create table if not exists public.gym_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  path text not null,
  w int, h int,
  created_at timestamptz not null default now()
);
create index if not exists gym_photos_user on public.gym_photos (user_id, created_at desc);
alter table public.gym_photos enable row level security;
revoke all on public.gym_photos from anon;
grant select, insert, delete on public.gym_photos to authenticated;
drop policy if exists "Видят вошедшие" on public.gym_photos;
create policy "Видят вошедшие" on public.gym_photos for select to authenticated using (true);
drop policy if exists "Добавляет владелец" on public.gym_photos;
create policy "Добавляет владелец" on public.gym_photos for insert to authenticated
  with check (user_id = (select auth.uid()) and path like (select auth.uid())::text || '/photos/%');
drop policy if exists "Удаляет владелец" on public.gym_photos;
create policy "Удаляет владелец" on public.gym_photos for delete to authenticated using (user_id = (select auth.uid()));

-- Избранные треки видны всем вошедшим — их показывают в профиле. Менять по-прежнему можно только свои.
drop policy if exists "Только свои" on public.gym_track_favs;
drop policy if exists "Видят вошедшие" on public.gym_track_favs;
create policy "Видят вошедшие" on public.gym_track_favs for select to authenticated using (true);
drop policy if exists "Добавляет владелец" on public.gym_track_favs;
create policy "Добавляет владелец" on public.gym_track_favs for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Удаляет владелец" on public.gym_track_favs;
create policy "Удаляет владелец" on public.gym_track_favs for delete to authenticated using (user_id = (select auth.uid()));
