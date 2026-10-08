-- Índices usados nas telas do aluno e no prontuário do personal.
-- Podem ser executados mais de uma vez com segurança.

create index if not exists idx_fitness_assessments_user_created
  on public.fitness_assessments (user_id, created_at desc);

create index if not exists idx_progress_records_user_recorded
  on public.progress_records (user_id, recorded_at desc, id desc);

create index if not exists idx_workout_sessions_user_completed
  on public.workout_sessions (user_id, completed_at desc);

create index if not exists idx_weekly_checkins_user_week
  on public.weekly_checkins (user_id, week_start desc);

create index if not exists idx_exercise_logs_user_created
  on public.workout_exercise_logs (user_id, created_at desc);

create index if not exists idx_trainer_changes_student_created
  on public.trainer_change_log (student_id, created_at desc);

create index if not exists idx_trainer_links_active_student
  on public.trainer_student_links (student_id, trainer_id)
  where status = 'active';

create index if not exists idx_trainer_links_active_trainer
  on public.trainer_student_links (trainer_id, student_id)
  where status = 'active';

notify pgrst, 'reload schema';
