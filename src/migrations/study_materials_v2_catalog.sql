-- ============================================================================
-- Study materials v2: material-backed filter curriculum
--
-- The course catalogue cannot power these filters: a reviewed CBSE resource
-- may exist before the site has a CBSE lecture for the same chapter. This
-- bounded RPC exposes only taxonomy nodes that contain approved material.
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.study_materials') is null
     or to_regclass('public.study_material_scopes') is null then
    raise exception 'STUDY MATERIALS V2 PREFLIGHT: apply study_materials_v1.sql first';
  end if;
end $$;

create or replace function public.get_study_material_curriculum(
  p_goal_slug text default null,
  p_board_slug text default null,
  p_class_slug text default null,
  p_subject_slug text default null
)
returns table (
  level text,
  entity_id bigint,
  slug text,
  name text,
  display_order integer,
  resource_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with approved_scopes as (
    select s.*
      from public.study_material_scopes s
      join public.study_materials m on m.id = s.material_id
     where m.review_status = 'approved'
       and m.published_at <= now()
  ),
  nodes as (
    select
      'goal'::text as level,
      lg.id as entity_id,
      lg.slug,
      lg.name,
      lg.display_order,
      count(distinct s.material_id)::bigint as resource_count
    from approved_scopes s
    join public.learning_goals lg on lg.id = s.learning_goal_id
    group by lg.id, lg.slug, lg.name, lg.display_order

    union all

    select
      'board', b.id, b.slug, b.name, b.display_order,
      count(distinct s.material_id)::bigint
    from approved_scopes s
    join public.boards b on b.id = s.board_id
    left join public.learning_goals lg on lg.id = s.learning_goal_id
    where p_goal_slug is null or lg.slug = p_goal_slug
    group by b.id, b.slug, b.name, b.display_order

    union all

    select
      'class', cl.id, cl.slug, cl.name, cl.display_order,
      count(distinct s.material_id)::bigint
    from approved_scopes s
    join public.class_levels cl on cl.id = s.class_level_id
    left join public.learning_goals lg on lg.id = s.learning_goal_id
    left join public.boards b on b.id = s.board_id
    where (p_goal_slug is null or lg.slug = p_goal_slug)
      and (p_board_slug is null or b.slug = p_board_slug)
    group by cl.id, cl.slug, cl.name, cl.display_order

    union all

    select
      'subject', sub.id, sub.slug, sub.name, sub.display_order,
      count(distinct s.material_id)::bigint
    from approved_scopes s
    join public.subjects sub on sub.id = s.subject_id
    left join public.learning_goals lg on lg.id = s.learning_goal_id
    left join public.boards b on b.id = s.board_id
    left join public.class_levels cl on cl.id = s.class_level_id
    where (p_goal_slug is null or lg.slug = p_goal_slug)
      and (p_board_slug is null or b.slug = p_board_slug)
      and (p_class_slug is null or cl.slug = p_class_slug)
    group by sub.id, sub.slug, sub.name, sub.display_order

    union all

    select
      'chapter', ch.id, ch.slug, ch.name, ch.display_order,
      count(distinct s.material_id)::bigint
    from approved_scopes s
    join public.chapters ch on ch.id = s.chapter_id
    left join public.learning_goals lg on lg.id = s.learning_goal_id
    left join public.boards b on b.id = s.board_id
    left join public.class_levels cl on cl.id = s.class_level_id
    left join public.subjects sub on sub.id = s.subject_id
    where (p_goal_slug is null or lg.slug = p_goal_slug)
      and (p_board_slug is null or b.slug = p_board_slug)
      and (p_class_slug is null or cl.slug = p_class_slug)
      and (p_subject_slug is null or sub.slug = p_subject_slug)
    group by ch.id, ch.slug, ch.name, ch.display_order
  )
  select n.*
    from nodes n
   order by
     case n.level
       when 'goal' then 1
       when 'board' then 2
       when 'class' then 3
       when 'subject' then 4
       when 'chapter' then 5
       else 6
     end,
     n.display_order,
     n.name,
     n.entity_id;
$$;

revoke all on function public.get_study_material_curriculum(
  text, text, text, text
) from public;
grant execute on function public.get_study_material_curriculum(
  text, text, text, text
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
