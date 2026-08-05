-- Destructive rollback for study_materials_v1.sql. This is intentionally kept
-- separate and is never run by the application or a normal deployment.

begin;

drop function if exists public.get_study_materials(
  text, text, text, text, text, bigint, bigint, text, integer, integer
);
drop table if exists public.study_material_videos;
drop table if exists public.study_material_scopes;
drop table if exists public.study_materials;
drop function if exists public.validate_study_material_scope();
drop function if exists public.touch_study_material_updated_at();

notify pgrst, 'reload schema';

commit;
