-- Программа тренировок: какая выбрана, с какого дня и по каким дням недели (0 — понедельник).
alter table public.gym_profile add column if not exists program_id text;
alter table public.gym_profile add column if not exists program_start date;
alter table public.gym_profile add column if not exists program_days smallint[];
-- План упражнения из программы, например «4 × 6–8».
alter table public.gym_exercises add column if not exists plan text;
