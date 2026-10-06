-- Музыка: треки на конкретный день и на день недели (каждый вторник и т. п.); ссылки на плеер Яндекс Музыки.
alter table public.gym_days add column if not exists music jsonb not null default '[]'::jsonb;
alter table public.gym_profile add column if not exists week_music jsonb not null default '{}'::jsonb;
