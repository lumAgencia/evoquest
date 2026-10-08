create table if not exists public.custom_workouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.custom_workouts enable row level security;
drop policy if exists "Users manage own custom workouts" on public.custom_workouts;
create policy "Users manage own custom workouts" on public.custom_workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
