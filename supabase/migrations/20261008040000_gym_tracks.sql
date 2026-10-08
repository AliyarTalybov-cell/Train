-- Список треков страницы «Музыка» — в таблице, чтобы новые появлялись сразу после загрузки.
-- Слушать могут все вошедшие; загружать и удалять — только владелец сайта.
create table if not exists public.gym_tracks (
  id uuid primary key default gen_random_uuid(),
  file text not null unique,          -- имя файла в хранилище gym-music/tracks/
  artist text not null default '',
  title text not null,
  sec int,                            -- длительность в секундах
  added_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);
alter table public.gym_tracks enable row level security;
revoke all on public.gym_tracks from anon;
grant select, insert, delete on public.gym_tracks to authenticated;
drop policy if exists "Треки видят вошедшие" on public.gym_tracks;
create policy "Треки видят вошедшие" on public.gym_tracks for select to authenticated using (true);
drop policy if exists "Треки добавляет владелец" on public.gym_tracks;
create policy "Треки добавляет владелец" on public.gym_tracks for insert to authenticated
  with check ((select auth.uid()) = '63719d65-7465-436c-b3e0-0fd943771228');
drop policy if exists "Треки удаляет владелец" on public.gym_tracks;
create policy "Треки удаляет владелец" on public.gym_tracks for delete to authenticated
  using ((select auth.uid()) = '63719d65-7465-436c-b3e0-0fd943771228');

drop policy if exists "gym-music: загружает владелец" on storage.objects;
create policy "gym-music: загружает владелец" on storage.objects for insert to authenticated
  with check (bucket_id = 'gym-music' and (select auth.uid()) = '63719d65-7465-436c-b3e0-0fd943771228');
drop policy if exists "gym-music: удаляет владелец" on storage.objects;
create policy "gym-music: удаляет владелец" on storage.objects for delete to authenticated
  using (bucket_id = 'gym-music' and (select auth.uid()) = '63719d65-7465-436c-b3e0-0fd943771228');
