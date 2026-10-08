alter table public.fitness_assessments
  add column if not exists biological_sex text,
  add column if not exists age integer,
  add column if not exists height_cm numeric(5,2),
  add column if not exists weight_kg numeric(5,2),
  add column if not exists restrictions text default '',
  add column if not exists equipment text default '';

alter table public.fitness_assessments
  add constraint fitness_assessments_biological_sex_check check (biological_sex in ('Masculino','Feminino','Prefiro não informar')),
  add constraint fitness_assessments_age_check check (age between 16 and 100),
  add constraint fitness_assessments_height_cm_check check (height_cm between 100 and 250),
  add constraint fitness_assessments_weight_kg_check check (weight_kg between 30 and 500),
  add constraint fitness_assessments_restrictions_check check (char_length(restrictions) <= 1000),
  add constraint fitness_assessments_equipment_check check (char_length(equipment) <= 1000);
