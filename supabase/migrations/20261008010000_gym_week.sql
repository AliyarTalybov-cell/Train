-- Раскладка недели программы: 7 элементов (пн…вс), в каждом номер тренировки программы или null — отдых.
alter table public.gym_profile add column if not exists program_week jsonb;
