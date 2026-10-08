create table if not exists public.weekly_checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  workouts_completed integer not null check (workouts_completed between 0 and 7),
  energy integer not null check (energy between 1 and 5),
  sleep_quality integer not null check (sleep_quality between 1 and 5),
  nutrition_adherence integer not null check (nutrition_adherence between 1 and 5),
  training_difficulty integer not null check (training_difficulty between 1 and 5),
  pain_or_discomfort boolean not null default false,
  notes text default '' check (char_length(notes) <= 1000),
  recommendation_title text not null,
  recommendation_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.weekly_checkins enable row level security;

create policy "Usuário visualiza os próprios check-ins" on public.weekly_checkins for select to authenticated using ((select auth.uid()) = user_id);
create policy "Usuário cria o próprio check-in" on public.weekly_checkins for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Usuário atualiza o próprio check-in" on public.weekly_checkins for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Usuário exclui o próprio check-in" on public.weekly_checkins for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists weekly_checkins_user_week_idx on public.weekly_checkins(user_id, week_start desc);
