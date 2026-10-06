-- Перенос тренировок программы: {"день": "откуда взять тренировку" | null — отдых}.
alter table public.gym_profile add column if not exists program_moves jsonb not null default '{}'::jsonb;
