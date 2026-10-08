-- Amplia o prontuário do personal com alimentação e desempenho por exercício.
create or replace function public.trainer_get_student_workspace_v4(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not exists (select 1 from trainer_student_links where trainer_id=auth.uid() and student_id=p_student_id and status='active') then
    raise exception 'Aluno não vinculado a este personal';
  end if;
  select jsonb_build_object(
    'assessment', coalesce((select to_jsonb(f) from fitness_assessments f where f.user_id=p_student_id order by f.created_at desc limit 1), '{}'::jsonb),
    'latest_progress', coalesce((select to_jsonb(p) from progress_records p where p.user_id=p_student_id order by p.recorded_at desc,p.id desc limit 1), '{}'::jsonb),
    'progress_history', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from progress_records where user_id=p_student_id order by recorded_at desc,id desc limit 30) x), '[]'::jsonb),
    'checkins', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from weekly_checkins where user_id=p_student_id order by week_start desc limit 16) x), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from workout_sessions where user_id=p_student_id order by completed_at desc limit 60) x), '[]'::jsonb),
    'exercise_logs', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from workout_exercise_logs where user_id=p_student_id order by created_at desc limit 250) x), '[]'::jsonb),
    'changes', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from trainer_change_log where student_id=p_student_id order by created_at desc limit 30) x), '[]'::jsonb),
    'plan', coalesce((select plan from custom_workouts where user_id=p_student_id), '[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke all on function public.trainer_get_student_workspace_v4(uuid) from public;
grant execute on function public.trainer_get_student_workspace_v4(uuid) to authenticated;
notify pgrst, 'reload schema';
