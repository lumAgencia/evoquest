create table if not exists public.app_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Usuário',
  role text not null default 'student' check (role in ('student','trainer')),
  cref text default '',
  specialty text default '',
  bio text default '',
  invite_code text unique not null default ('EVOQUEST-' || upper(substr(md5(random()::text), 1, 6))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trainer_student_links (
  trainer_id uuid not null references public.app_profiles(user_id) on delete cascade,
  student_id uuid not null references public.app_profiles(user_id) on delete cascade,
  status text not null default 'active' check (status in ('active','ended')),
  connected_at timestamptz not null default now(),
  primary key (trainer_id, student_id),
  check (trainer_id <> student_id)
);

alter table public.app_profiles enable row level security;
alter table public.trainer_student_links enable row level security;

drop policy if exists "Users read own profile" on public.app_profiles;
drop policy if exists "Users create own profile" on public.app_profiles;
drop policy if exists "Users update own profile" on public.app_profiles;
create policy "Users read own profile" on public.app_profiles for select to authenticated using (auth.uid() = user_id);
create policy "Users create own profile" on public.app_profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own profile" on public.app_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Participants read own links" on public.trainer_student_links;
drop policy if exists "Students end own links" on public.trainer_student_links;
create policy "Participants read own links" on public.trainer_student_links for select to authenticated using (auth.uid() in (trainer_id, student_id));
create policy "Students end own links" on public.trainer_student_links for delete to authenticated using (auth.uid() = student_id);

create or replace function public.accept_trainer_invite(invite_code_input text)
returns boolean language plpgsql security definer set search_path = public as $$
declare trainer uuid;
begin
  select user_id into trainer from app_profiles
  where upper(invite_code) = upper(trim(invite_code_input)) and role = 'trainer';
  if trainer is null or trainer = auth.uid() then return false; end if;
  if not exists (select 1 from app_profiles where user_id = auth.uid() and role = 'student') then return false; end if;
  delete from trainer_student_links where student_id = auth.uid() and status = 'active';
  insert into trainer_student_links(trainer_id, student_id, status)
  values (trainer, auth.uid(), 'active')
  on conflict (trainer_id, student_id) do update set status = 'active', connected_at = now();
  return true;
end $$;

create or replace function public.get_my_trainer()
returns table(trainer_id uuid, full_name text, cref text, specialty text, connected_at timestamptz)
language sql security definer set search_path = public as $$
  select p.user_id, p.full_name, p.cref, p.specialty, l.connected_at
  from trainer_student_links l join app_profiles p on p.user_id = l.trainer_id
  where l.student_id = auth.uid() and l.status = 'active' limit 1
$$;

create or replace function public.trainer_get_students()
returns table(student_id uuid, full_name text, goal text, week_sessions bigint, pain_reported boolean, connected_at timestamptz)
language sql security definer set search_path = public as $$
  select p.user_id, p.full_name,
    (select f.goal from fitness_assessments f where f.user_id=p.user_id order by f.created_at desc limit 1),
    (select count(*) from workout_sessions w where w.user_id=p.user_id and w.completed_at >= date_trunc('week', now())),
    coalesce((select c.pain_or_discomfort from weekly_checkins c where c.user_id=p.user_id order by c.week_start desc limit 1), false),
    l.connected_at
  from trainer_student_links l join app_profiles p on p.user_id=l.student_id
  where l.trainer_id=auth.uid() and l.status='active'
  order by p.full_name
$$;

create or replace function public.trainer_get_student_detail(student_input uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not exists (select 1 from trainer_student_links where trainer_id=auth.uid() and student_id=student_input and status='active') then
    raise exception 'Aluno não vinculado';
  end if;
  select jsonb_build_object(
    'assessment', coalesce((select to_jsonb(f) from fitness_assessments f where f.user_id=student_input order by f.created_at desc limit 1), '{}'::jsonb),
    'latest_progress', coalesce((select to_jsonb(p) from progress_records p where p.user_id=student_input order by p.recorded_at desc limit 1), '{}'::jsonb),
    'latest_checkin', coalesce((select to_jsonb(c) from weekly_checkins c where c.user_id=student_input order by c.week_start desc limit 1), '{}'::jsonb),
    'session_count', (select count(*) from workout_sessions w where w.user_id=student_input),
    'plan', coalesce((select cw.plan from custom_workouts cw where cw.user_id=student_input), '[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.trainer_save_student_plan(student_input uuid, plan_input jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from trainer_student_links where trainer_id=auth.uid() and student_id=student_input and status='active') then
    raise exception 'Aluno não vinculado';
  end if;
  if jsonb_typeof(plan_input) <> 'array' then raise exception 'Plano inválido'; end if;
  insert into custom_workouts(user_id, plan, updated_at) values(student_input, plan_input, now())
  on conflict (user_id) do update set plan=excluded.plan, updated_at=now();
  return true;
end $$;

revoke all on function public.accept_trainer_invite(text) from public;
revoke all on function public.get_my_trainer() from public;
revoke all on function public.trainer_get_students() from public;
revoke all on function public.trainer_get_student_detail(uuid) from public;
revoke all on function public.trainer_save_student_plan(uuid,jsonb) from public;
grant execute on function public.accept_trainer_invite(text) to authenticated;
grant execute on function public.get_my_trainer() to authenticated;
grant execute on function public.trainer_get_students() to authenticated;
grant execute on function public.trainer_get_student_detail(uuid) to authenticated;
grant execute on function public.trainer_save_student_plan(uuid,jsonb) to authenticated;
