-- Альбом и номер трека (из тегов mp3 или имени файла) — чтобы внутри папки треки шли по порядку альбомов.
alter table public.gym_tracks add column if not exists album text not null default '';
alter table public.gym_tracks add column if not exists track_no int;
grant update (folder_id, title, artist, album, track_no) on public.gym_tracks to authenticated;
