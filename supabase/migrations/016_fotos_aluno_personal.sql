-- Expõe a foto pública do aluno somente na lista autorizada do personal.
-- A edição da foto do aluno e do personal usa o bucket criado na migração 014.

drop function if exists public.trainer_get_students();

create function public.trainer_get_students()
returns table(
  student_id uuid,
  full_name text,
  avatar_url text,
  goal text,
  week_sessions bigint,
  pain_reported boolean,
  connected_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.full_name,
    coalesce(p.avatar_url, ''),
    (
      select f.goal
      from fitness_assessments f
      where f.user_id = p.user_id
      order by f.created_at desc
      limit 1
    ),
    (
      select count(*)
      from workout_sessions w
      where w.user_id = p.user_id
        and w.completed_at >= date_trunc('week', now())
    ),
    coalesce((
      select c.pain_or_discomfort
      from weekly_checkins c
      where c.user_id = p.user_id
      order by c.week_start desc
      limit 1
    ), false),
    l.connected_at
  from trainer_student_links l
  join app_profiles p on p.user_id = l.student_id
  where l.trainer_id = auth.uid()
    and l.status = 'active'
  order by p.full_name;
$$;

revoke all on function public.trainer_get_students() from public;
grant execute on function public.trainer_get_students() to authenticated;

notify pgrst, 'reload schema';
