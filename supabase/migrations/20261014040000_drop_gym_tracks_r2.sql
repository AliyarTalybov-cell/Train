-- Cloudflare R2 не понадобилась: убираем флаг r2 (ни один трек туда не переносился).
alter table public.gym_tracks drop column if exists r2;
