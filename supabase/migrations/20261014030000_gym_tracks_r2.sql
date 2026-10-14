-- Трек лежит в Cloudflare R2 (а не в хранилище Supabase): ссылки на него выдаёт функция gym-r2.
alter table public.gym_tracks add column if not exists r2 boolean not null default false;
