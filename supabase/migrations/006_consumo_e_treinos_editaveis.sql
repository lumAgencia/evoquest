create table if not exists public.food_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null,
  grams numeric(7,2) not null check (grams > 0 and grams <= 3000),
  calories integer not null check (calories >= 0 and calories <= 10000),
  consumed_on date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.food_logs enable row level security;
create policy "Usuário gerencia o próprio consumo" on public.food_logs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index if not exists food_logs_user_day_idx on public.food_logs(user_id, consumed_on desc);

create table if not exists public.exercise_preferences (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_exercise text not null,
  replacement_exercise text not null,
  updated_at timestamptz not null default now(),
  unique(user_id, original_exercise)
);
alter table public.exercise_preferences enable row level security;
create policy "Usuário gerencia as próprias substituições" on public.exercise_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
