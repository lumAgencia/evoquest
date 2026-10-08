-- Prontuário compartilhado: o personal grava nas mesmas tabelas consumidas pelo aluno.
create table if not exists public.trainer_change_log (
  id bigint generated always as identity primary key,
  trainer_id uuid not null references public.app_profiles(user_id) on delete cascade,
  student_id uuid not null references public.app_profiles(user_id) on delete cascade,
  change_type text not null check (change_type in ('workout','assessment','measurement')),
  summary text not null,
  created_at timestamptz not null default now()
);

alter table public.trainer_change_log enable row level security;
drop policy if exists "Participants read trainer changes" on public.trainer_change_log;
create policy "Participants read trainer changes" on public.trainer_change_log for select to authenticated
using (auth.uid() in (trainer_id, student_id));

create or replace function public.trainer_get_student_workspace_v3(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not exists (select 1 from trainer_student_links where trainer_id=auth.uid() and student_id=p_student_id and status='active') then
    raise exception 'Aluno não vinculado a este personal';
  end if;
  select jsonb_build_object(
    'assessment', coalesce((select to_jsonb(f) from fitness_assessments f where f.user_id=p_student_id order by f.created_at desc limit 1), '{}'::jsonb),
    'latest_progress', coalesce((select to_jsonb(p) from progress_records p where p.user_id=p_student_id order by p.recorded_at desc, p.id desc limit 1), '{}'::jsonb),
    'progress_history', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from progress_records where user_id=p_student_id order by recorded_at desc, id desc limit 30) x), '[]'::jsonb),
    'checkins', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from weekly_checkins where user_id=p_student_id order by week_start desc limit 12) x), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from workout_sessions where user_id=p_student_id order by completed_at desc limit 30) x), '[]'::jsonb),
    'changes', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from trainer_change_log where student_id=p_student_id order by created_at desc limit 30) x), '[]'::jsonb),
    'plan', coalesce((select cw.plan from custom_workouts cw where cw.user_id=p_student_id), '[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.trainer_save_student_plan_v3(p_student_id uuid, p_plan jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from trainer_student_links where trainer_id=auth.uid() and student_id=p_student_id and status='active') then raise exception 'Aluno não vinculado'; end if;
  if jsonb_typeof(p_plan) <> 'array' or jsonb_array_length(p_plan)=0 then raise exception 'O plano precisa ter ao menos um treino'; end if;
  insert into custom_workouts(user_id,plan,updated_at) values(p_student_id,p_plan,now())
  on conflict(user_id) do update set plan=excluded.plan,updated_at=now();
  insert into trainer_change_log(trainer_id,student_id,change_type,summary) values(auth.uid(),p_student_id,'workout','Prancheta de treino atualizada');
  return true;
end $$;

create or replace function public.trainer_update_student_assessment(p_student_id uuid, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare assessment_id public.fitness_assessments.id%type;
begin
  if not exists (select 1 from trainer_student_links where trainer_id=auth.uid() and student_id=p_student_id and status='active') then raise exception 'Aluno não vinculado'; end if;
  select id into assessment_id from fitness_assessments where user_id=p_student_id order by created_at desc limit 1;
  if assessment_id is null then raise exception 'O aluno ainda não concluiu a avaliação inicial'; end if;
  update fitness_assessments set
    goal=coalesce(nullif(p_data->>'goal',''),goal), training_place=coalesce(nullif(p_data->>'training_place',''),training_place),
    training_days=coalesce((nullif(p_data->>'training_days',''))::int,training_days), experience_level=coalesce(nullif(p_data->>'experience_level',''),experience_level),
    biological_sex=coalesce(nullif(p_data->>'biological_sex',''),biological_sex), age=coalesce((nullif(p_data->>'age',''))::int,age),
    height_cm=coalesce((nullif(p_data->>'height_cm',''))::numeric,height_cm), weight_kg=coalesce((nullif(p_data->>'weight_kg',''))::numeric,weight_kg),
    restrictions=coalesce(p_data->>'restrictions',restrictions), equipment=coalesce(p_data->>'equipment',equipment),
    activity_level=coalesce(nullif(p_data->>'activity_level',''),activity_level), meals_per_day=coalesce((nullif(p_data->>'meals_per_day',''))::int,meals_per_day),
    diet_preference=coalesce(nullif(p_data->>'diet_preference',''),diet_preference), food_restrictions=coalesce(p_data->>'food_restrictions',food_restrictions), updated_at=now()
  where id=assessment_id;
  insert into trainer_change_log(trainer_id,student_id,change_type,summary) values(auth.uid(),p_student_id,'assessment','Avaliação e metas atualizadas');
  return true;
end $$;

create or replace function public.trainer_add_student_measurement(p_student_id uuid, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from trainer_student_links where trainer_id=auth.uid() and student_id=p_student_id and status='active') then raise exception 'Aluno não vinculado'; end if;
  if nullif(p_data->>'weight_kg','') is null then raise exception 'Informe o peso'; end if;
  insert into progress_records(user_id,recorded_at,weight_kg,notes,neck_cm,shoulders_cm,chest_cm,waist_cm,abdomen_cm,hips_cm,arm_right_relaxed_cm,arm_left_relaxed_cm,arm_right_flexed_cm,arm_left_flexed_cm,forearm_right_cm,forearm_left_cm,thigh_right_cm,thigh_left_cm,calf_right_cm,calf_left_cm,skinfold_chest_mm,skinfold_midaxillary_mm,skinfold_triceps_mm,skinfold_subscapular_mm,skinfold_abdominal_mm,skinfold_suprailiac_mm,skinfold_thigh_mm,skinfold_biceps_mm,skinfold_calf_mm)
  values(p_student_id,coalesce((nullif(p_data->>'recorded_at',''))::date,current_date),(p_data->>'weight_kg')::numeric,coalesce(p_data->>'notes',''),
  (nullif(p_data->>'neck_cm',''))::numeric,(nullif(p_data->>'shoulders_cm',''))::numeric,(nullif(p_data->>'chest_cm',''))::numeric,(nullif(p_data->>'waist_cm',''))::numeric,(nullif(p_data->>'abdomen_cm',''))::numeric,(nullif(p_data->>'hips_cm',''))::numeric,(nullif(p_data->>'arm_right_relaxed_cm',''))::numeric,(nullif(p_data->>'arm_left_relaxed_cm',''))::numeric,(nullif(p_data->>'arm_right_flexed_cm',''))::numeric,(nullif(p_data->>'arm_left_flexed_cm',''))::numeric,(nullif(p_data->>'forearm_right_cm',''))::numeric,(nullif(p_data->>'forearm_left_cm',''))::numeric,(nullif(p_data->>'thigh_right_cm',''))::numeric,(nullif(p_data->>'thigh_left_cm',''))::numeric,(nullif(p_data->>'calf_right_cm',''))::numeric,(nullif(p_data->>'calf_left_cm',''))::numeric,(nullif(p_data->>'skinfold_chest_mm',''))::numeric,(nullif(p_data->>'skinfold_midaxillary_mm',''))::numeric,(nullif(p_data->>'skinfold_triceps_mm',''))::numeric,(nullif(p_data->>'skinfold_subscapular_mm',''))::numeric,(nullif(p_data->>'skinfold_abdominal_mm',''))::numeric,(nullif(p_data->>'skinfold_suprailiac_mm',''))::numeric,(nullif(p_data->>'skinfold_thigh_mm',''))::numeric,(nullif(p_data->>'skinfold_biceps_mm',''))::numeric,(nullif(p_data->>'skinfold_calf_mm',''))::numeric);
  insert into trainer_change_log(trainer_id,student_id,change_type,summary) values(auth.uid(),p_student_id,'measurement','Nova avaliação corporal registrada');
  return true;
end $$;

revoke all on function public.trainer_get_student_workspace_v3(uuid) from public;
revoke all on function public.trainer_save_student_plan_v3(uuid,jsonb) from public;
revoke all on function public.trainer_update_student_assessment(uuid,jsonb) from public;
revoke all on function public.trainer_add_student_measurement(uuid,jsonb) from public;
grant execute on function public.trainer_get_student_workspace_v3(uuid) to authenticated;
grant execute on function public.trainer_save_student_plan_v3(uuid,jsonb) to authenticated;
grant execute on function public.trainer_update_student_assessment(uuid,jsonb) to authenticated;
grant execute on function public.trainer_add_student_measurement(uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
