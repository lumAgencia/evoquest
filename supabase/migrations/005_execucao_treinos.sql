create table if not exists public.workout_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_code text not null,
  workout_title text not null,
  completed_exercises integer not null,
  total_exercises integer not null,
  completed_at timestamptz not null default now()
);

create table if not exists public.workout_exercise_logs (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null,
  completed boolean not null default false,
  weight_kg numeric(6,2),
  repetitions integer,
  created_at timestamptz not null default now()
);

alter table public.workout_sessions enable row level security;
alter table public.workout_exercise_logs enable row level security;

create policy "Usuário gerencia as próprias sessões" on public.workout_sessions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Usuário gerencia os próprios exercícios" on public.workout_exercise_logs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index if not exists workout_sessions_user_date_idx on public.workout_sessions(user_id, completed_at desc);
create index if not exists workout_logs_session_idx on public.workout_exercise_logs(session_id);
