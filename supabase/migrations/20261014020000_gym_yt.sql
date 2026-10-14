-- YouTube в разделе «Музыка»: общий список видео и плейлистов по ссылкам. Видят все вошедшие, удаляет добавивший.
create table if not exists public.gym_yt (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('video', 'playlist')),
  yt_id text not null check (yt_id ~ '^[A-Za-z0-9_-]{6,64}$'),
  title text not null default '',
  author text not null default '',
  created_at timestamptz not null default now(),
  unique (kind, yt_id)
);
alter table public.gym_yt enable row level security;
revoke all on public.gym_yt from anon;
grant select, insert, delete on public.gym_yt to authenticated;
drop policy if exists "Видят вошедшие" on public.gym_yt;
create policy "Видят вошедшие" on public.gym_yt for select to authenticated using (true);
drop policy if exists "Добавляет вошедший" on public.gym_yt;
create policy "Добавляет вошедший" on public.gym_yt for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Удаляет добавивший" on public.gym_yt;
create policy "Удаляет добавивший" on public.gym_yt for delete to authenticated using (user_id = (select auth.uid()));
