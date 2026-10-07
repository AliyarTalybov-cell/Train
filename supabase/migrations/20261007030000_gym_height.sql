-- Рост в профиле дневника
alter table public.gym_profile add column if not exists height_cm numeric(4,1);
