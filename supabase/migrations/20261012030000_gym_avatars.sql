-- Фото профиля: закрытое хранилище gym-avatars, файл лежит в папке <id пользователя>/.
-- Смотреть могут все вошедшие (друзья), менять — только владелец своей папки.
alter table public.gym_profile add column if not exists avatar text;  -- путь в gym-avatars или null

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gym-avatars', 'gym-avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

drop policy if exists "gym-avatars: видят вошедшие" on storage.objects;
create policy "gym-avatars: видят вошедшие" on storage.objects for select to authenticated using (bucket_id = 'gym-avatars');
drop policy if exists "gym-avatars: загружает владелец" on storage.objects;
create policy "gym-avatars: загружает владелец" on storage.objects for insert to authenticated
  with check (bucket_id = 'gym-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "gym-avatars: удаляет владелец" on storage.objects;
create policy "gym-avatars: удаляет владелец" on storage.objects for delete to authenticated
  using (bucket_id = 'gym-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
