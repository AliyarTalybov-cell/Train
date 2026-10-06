-- Тренировочный дневник. Живёт в той же базе, что и рассрочка (проект RassP), но в своих таблицах gym_*.
-- Каждая строка принадлежит одному пользователю: читать и менять её может только он сам.

create table if not exists public.gym_profile (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  name text not null default '',
  weight_kg numeric(5,1),
  kcal int not null default 2400,
  goal_mode text not null default 'perkg' check (goal_mode in ('perkg', 'percent')),
  protein numeric(5,1) not null default 2,   -- г на кг веса или % калорий, смотря по goal_mode
  fat numeric(5,1) not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  title text not null default '',
  note text not null default '',
  feeling smallint check (feeling between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

create table if not exists public.gym_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id uuid not null references public.gym_workouts on delete cascade,
  position int not null default 0,
  name text not null default '',
  sets jsonb not null default '[]'::jsonb,   -- [{"w": 60, "r": 10, "done": true}]
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists gym_exercises_workout on public.gym_exercises (workout_id, position);

create table if not exists public.gym_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  exercises jsonb not null default '[]'::jsonb,   -- [{"name": "Жим лёжа", "sets": [{"w": 60, "r": 10}]}]
  created_at timestamptz not null default now()
);

create table if not exists public.gym_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kcal numeric(6,1) not null default 0,     -- на 100 г
  protein numeric(6,1) not null default 0,
  fat numeric(6,1) not null default 0,
  carb numeric(6,1) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.gym_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  name text not null,
  grams numeric(7,1),
  kcal numeric(7,1) not null default 0,     -- уже на всю порцию
  protein numeric(6,1) not null default 0,
  fat numeric(6,1) not null default 0,
  carb numeric(6,1) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists gym_meals_day on public.gym_meals (user_id, day);

create table if not exists public.gym_body (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  weight_kg numeric(5,1) not null,
  primary key (user_id, day)
);

do $$
declare t text;
begin
  foreach t in array array['gym_profile','gym_workouts','gym_exercises','gym_templates','gym_foods','gym_meals','gym_body'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "Только свои" on public.%I', t);
    execute format('create policy "Только свои" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
