begin;

drop function if exists public.get_study_material_curriculum(
  text, text, text, text
);

notify pgrst, 'reload schema';

commit;
