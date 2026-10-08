create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null,
  grams numeric not null check (grams > 0),
  calories integer not null check (calories >= 0),
  consumed_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists food_logs_user_date_idx
  on public.food_logs (user_id, consumed_on desc);

alter table public.food_logs enable row level security;
drop policy if exists "Users manage own food logs" on public.food_logs;
create policy "Users manage own food logs" on public.food_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.exercise_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_exercise text not null,
  replacement_exercise text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, original_exercise)
);

alter table public.exercise_preferences enable row level security;
drop policy if exists "Users manage own exercise preferences" on public.exercise_preferences;
create policy "Users manage own exercise preferences" on public.exercise_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
