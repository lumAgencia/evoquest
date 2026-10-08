alter table public.fitness_assessments
  add column if not exists activity_level text default 'Moderadamente ativo',
  add column if not exists meals_per_day integer default 4,
  add column if not exists diet_preference text default 'Sem preferência',
  add column if not exists food_restrictions text default '';

alter table public.fitness_assessments
  add constraint fitness_assessments_activity_level_check check (activity_level in ('Pouco ativo','Levemente ativo','Moderadamente ativo','Muito ativo')),
  add constraint fitness_assessments_meals_per_day_check check (meals_per_day between 3 and 6),
  add constraint fitness_assessments_diet_preference_check check (diet_preference in ('Sem preferência','Vegetariana','Vegana')),
  add constraint fitness_assessments_food_restrictions_check check (char_length(food_restrictions) <= 500);
