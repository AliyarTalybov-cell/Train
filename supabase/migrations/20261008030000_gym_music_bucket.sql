-- Треки для страницы «Музыка»: закрытое хранилище, слушать могут только вошедшие пользователи.
-- Загружаются через CLI; tracks.json в корне — список треков (файл, исполнитель, название, длительность).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gym-music', 'gym-music', false, 31457280, array['audio/mpeg', 'application/json'])
on conflict (id) do update set public = false;

drop policy if exists "gym-music: слушать вошедшим" on storage.objects;
create policy "gym-music: слушать вошедшим" on storage.objects for select to authenticated using (bucket_id = 'gym-music');
