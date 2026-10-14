-- Фото прогресса фигуры («до / после»): видит только владелец — и записи, и файлы.
create table if not exists public.gym_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  path text not null,               -- файл в бакете gym-progress: <uid>/<имя>.jpg
  day date not null default current_date,
  weight_kg numeric,
  w int, h int,
  created_at timestamptz not null default now()
);
create index if not exists gym_progress_user on public.gym_progress (user_id, day);
alter table public.gym_progress enable row level security;
revoke all on public.gym_progress from anon;
grant select, insert, update, delete on public.gym_progress to authenticated;
drop policy if exists "Только свои" on public.gym_progress;
create policy "Только свои" on public.gym_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and path like (select auth.uid())::text || '/%');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gym-progress', 'gym-progress', false, 3145728, array['image/jpeg'])
on conflict (id) do update set public = false;

drop policy if exists "gym-progress: только свои" on storage.objects;
create policy "gym-progress: только свои" on storage.objects for select to authenticated
  using (bucket_id = 'gym-progress' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "gym-progress: загружает владелец" on storage.objects;
create policy "gym-progress: загружает владелец" on storage.objects for insert to authenticated
  with check (bucket_id = 'gym-progress' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "gym-progress: удаляет владелец" on storage.objects;
create policy "gym-progress: удаляет владелец" on storage.objects for delete to authenticated
  using (bucket_id = 'gym-progress' and (storage.foldername(name))[1] = (select auth.uid())::text);
