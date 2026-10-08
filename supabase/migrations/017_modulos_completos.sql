-- EVOQUEST: séries, alimentação, metas, fotos e modelos profissionais.

alter table public.workout_exercise_logs
  add column if not exists set_number integer not null default 1;

alter table public.workout_sessions
  add column if not exists duration_seconds integer not null default 0;

alter table public.food_logs
  add column if not exists meal_type text default 'Refeição',
  add column if not exists protein_g numeric(7,2) default 0,
  add column if not exists carbs_g numeric(7,2) default 0,
  add column if not exists fats_g numeric(7,2) default 0;

create table if not exists public.food_favorites (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null,
  grams numeric(7,2) not null check (grams > 0 and grams <= 3000),
  meal_type text default 'Refeição',
  created_at timestamptz not null default now()
);
alter table public.food_favorites enable row level security;
drop policy if exists "Usuário gerencia alimentos favoritos" on public.food_favorites;
create policy "Usuário gerencia alimentos favoritos" on public.food_favorites
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.body_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_weight_kg numeric(6,2),
  target_waist_cm numeric(6,2),
  target_date date,
  updated_at timestamptz not null default now()
);
alter table public.body_goals enable row level security;
drop policy if exists "Aluno gerencia metas corporais" on public.body_goals;
create policy "Aluno gerencia metas corporais" on public.body_goals
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.progress_photos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_url text not null,
  storage_path text not null,
  pose text not null default 'Frente',
  taken_on date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.progress_photos enable row level security;
drop policy if exists "Aluno gerencia fotos de evolução" on public.progress_photos;
create policy "Aluno gerencia fotos de evolução" on public.progress_photos
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Public progress photos" on storage.objects;
drop policy if exists "Users upload own progress photos" on storage.objects;
drop policy if exists "Users delete own progress photos" on storage.objects;
create policy "Public progress photos" on storage.objects for select using (bucket_id='progress-photos');
create policy "Users upload own progress photos" on storage.objects for insert to authenticated
  with check (bucket_id='progress-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Users delete own progress photos" on storage.objects for delete to authenticated
  using (bucket_id='progress-photos' and (storage.foldername(name))[1]=auth.uid()::text);

create table if not exists public.workout_templates (
  id bigint generated always as identity primary key,
  trainer_id uuid not null references public.app_profiles(user_id) on delete cascade,
  name text not null,
  plan jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.workout_templates enable row level security;
drop policy if exists "Personal gerencia modelos próprios" on public.workout_templates;
create policy "Personal gerencia modelos próprios" on public.workout_templates
  for all to authenticated using (auth.uid()=trainer_id) with check (auth.uid()=trainer_id);

create index if not exists idx_food_favorites_user on public.food_favorites(user_id, created_at desc);
create index if not exists idx_progress_photos_user on public.progress_photos(user_id, taken_on desc);
create index if not exists idx_workout_templates_trainer on public.workout_templates(trainer_id, created_at desc);

notify pgrst, 'reload schema';
