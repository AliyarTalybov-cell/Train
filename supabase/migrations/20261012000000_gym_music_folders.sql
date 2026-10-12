-- Папки (группы, альбомы) на странице «Музыка». Обложка — картинка в хранилище gym-music/covers/.
create table if not exists public.gym_music_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  cover text,                         -- имя файла в gym-music/covers/ или null
  created_at timestamptz not null default now()
);
alter table public.gym_tracks add column if not exists folder_id uuid references public.gym_music_folders on delete set null;
create index if not exists gym_tracks_folder on public.gym_tracks (folder_id);

alter table public.gym_music_folders enable row level security;
revoke all on public.gym_music_folders from anon;
grant select, insert, update, delete on public.gym_music_folders to authenticated;
drop policy if exists "Папки видят вошедшие" on public.gym_music_folders;
create policy "Папки видят вошедшие" on public.gym_music_folders for select to authenticated using (true);
drop policy if exists "Папки меняет владелец" on public.gym_music_folders;
create policy "Папки меняет владелец" on public.gym_music_folders for all to authenticated
  using ((select auth.uid()) = '63719d65-7465-436c-b3e0-0fd943771228')
  with check ((select auth.uid()) = '63719d65-7465-436c-b3e0-0fd943771228');

-- трек можно перенести в другую папку
grant update (folder_id, title, artist) on public.gym_tracks to authenticated;
drop policy if exists "Треки меняет владелец" on public.gym_tracks;
create policy "Треки меняет владелец" on public.gym_tracks for update to authenticated
  using ((select auth.uid()) = '63719d65-7465-436c-b3e0-0fd943771228')
  with check ((select auth.uid()) = '63719d65-7465-436c-b3e0-0fd943771228');

-- обложки: картинки в том же закрытом хранилище; владелец может их заменять
update storage.buckets set allowed_mime_types = array['audio/mpeg', 'application/json', 'image/jpeg', 'image/png', 'image/webp'] where id = 'gym-music';
drop policy if exists "gym-music: обновляет владелец" on storage.objects;
create policy "gym-music: обновляет владелец" on storage.objects for update to authenticated
  using (bucket_id = 'gym-music' and (select auth.uid()) = '63719d65-7465-436c-b3e0-0fd943771228');
