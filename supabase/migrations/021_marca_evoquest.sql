-- EVOQUEST: atualização da identidade para instalações já existentes.
-- Mantém o nome técnico da função de ranking por compatibilidade com o app publicado.

alter table if exists public.trainer_profiles
  alter column invite_code
  set default ('EVOQUEST-' || upper(substr(md5(random()::text), 1, 6)));

do $$
declare
  ranking_definition text;
begin
  if to_regprocedure('public.movra_monthly_ranking()') is not null then
    select pg_get_functiondef('public.movra_monthly_ranking()'::regprocedure)
      into ranking_definition;
    ranking_definition := replace(
      ranking_definition,
      'Jogador MOVRA',
      'Jogador EVOQUEST'
    );
    execute ranking_definition;
  end if;
end;
$$;
