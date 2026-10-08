-- EVOQUEST v0.52: temporada mensal e ranking por objetivo.
-- O ranking usa atividade e consistência. Peso e medidas nunca são expostos.

create or replace function public.movra_monthly_ranking()
returns table(
  rank bigint,
  display_name text,
  avatar_url text,
  points bigint,
  workouts bigint,
  active_days bigint,
  is_me boolean
)
language sql
security definer
set search_path = public
as $$
  with current_goal as (
    select f.goal
    from public.fitness_assessments f
    where f.user_id = auth.uid()
    order by f.created_at desc
    limit 1
  ),
  eligible as (
    select
      p.user_id,
      p.full_name,
      p.avatar_url,
      latest.goal
    from public.app_profiles p
    join lateral (
      select f.goal
      from public.fitness_assessments f
      where f.user_id = p.user_id
      order by f.created_at desc
      limit 1
    ) latest on true
    -- Contas profissionais não possuem avaliação física própria e, por isso,
    -- já ficam naturalmente fora do ranking sem depender de account_type.
    where latest.goal = (select goal from current_goal)
  ),
  session_score as (
    select
      e.user_id,
      count(s.id)::bigint as workouts,
      count(distinct (s.completed_at at time zone 'America/Sao_Paulo')::date)::bigint as active_days,
      coalesce(sum(s.completed_exercises), 0)::bigint as exercises
    from eligible e
    left join public.workout_sessions s
      on s.user_id = e.user_id
      and s.completed_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo')
    group by e.user_id
  ),
  progress_score as (
    select
      e.user_id,
      count(r.id)::bigint as progress_updates
    from eligible e
    left join public.progress_records r
      on r.user_id = e.user_id
      and r.recorded_at >= date_trunc('month', current_date)::date
    group by e.user_id
  ),
  scored as (
    select
      e.user_id,
      case
        when trim(coalesce(e.full_name, '')) = '' then 'Jogador EVOQUEST'
        else split_part(trim(e.full_name), ' ', 1) ||
          case
            when position(' ' in trim(e.full_name)) > 0
              then ' ' || left(split_part(trim(e.full_name), ' ', 2), 1) || '.'
            else ''
          end
      end as display_name,
      e.avatar_url,
      (ss.workouts * 100 + ss.exercises * 10 + ss.active_days * 25 + ps.progress_updates * 40)::bigint as points,
      ss.workouts,
      ss.active_days
    from eligible e
    join session_score ss on ss.user_id = e.user_id
    join progress_score ps on ps.user_id = e.user_id
  ),
  ranked as (
    select
      row_number() over (order by s.points desc, s.active_days desc, s.display_name) as rank,
      s.*
    from scored s
  )
  select
    r.rank,
    r.display_name,
    r.avatar_url,
    r.points,
    r.workouts,
    r.active_days,
    r.user_id = auth.uid() as is_me
  from ranked r
  order by r.rank
  limit 100;
$$;

revoke all on function public.movra_monthly_ranking() from public;
grant execute on function public.movra_monthly_ranking() to authenticated;
