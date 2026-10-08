drop function if exists public.trainer_get_student_detail_v2(uuid);

create function public.trainer_get_student_detail_v2(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if not exists (
    select 1 from trainer_student_links
    where trainer_id = auth.uid() and student_id = p_student_id and status = 'active'
  ) then raise exception 'Aluno não vinculado a este personal'; end if;

  select jsonb_build_object(
    'assessment', coalesce((select to_jsonb(f) from fitness_assessments f where f.user_id=p_student_id order by f.created_at desc limit 1), '{}'::jsonb),
    'latest_progress', coalesce((select to_jsonb(p) from progress_records p where p.user_id=p_student_id order by p.recorded_at desc limit 1), '{}'::jsonb),
    'latest_checkin', coalesce((select to_jsonb(c) from weekly_checkins c where c.user_id=p_student_id order by c.week_start desc limit 1), '{}'::jsonb),
    'session_count', (select count(*) from workout_sessions w where w.user_id=p_student_id),
    'plan', coalesce((select cw.plan from custom_workouts cw where cw.user_id=p_student_id), '[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke all on function public.trainer_get_student_detail_v2(uuid) from public;
grant execute on function public.trainer_get_student_detail_v2(uuid) to authenticated;
notify pgrst, 'reload schema';
