-- CHAPTER CLASS SCOPES v14 - READ-ONLY PRODUCTION POSTFLIGHT
-- Target kezelafqhgqrprpadmlf; no data or schema mutation.

with protected as (
  select
    (select count(*)
       from public.playlists p
      where p.id < 167
        and exists (
          select 1
            from public.playlist_learning_goals plg
            join public.learning_goals lg on lg.id = plg.learning_goal_id
           where plg.playlist_id = p.id and lg.slug = 'jee'
        )) as protected_courses,
    (select count(*)
       from public.playlist_videos pv
       join public.playlists p on p.id = pv.playlist_id
      where p.id < 167
        and exists (
          select 1
            from public.playlist_learning_goals plg
            join public.learning_goals lg on lg.id = plg.learning_goal_id
           where plg.playlist_id = p.id and lg.slug = 'jee'
        )) as protected_memberships,
    md5(
      coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
        select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
               p.subject_id, p.class_levels, p.audience_focus, p.content_type,
               p.language, p.difficulty
          from public.playlists p
          join public.playlist_learning_goals plg on plg.playlist_id = p.id
          join public.learning_goals lg on lg.id = plg.learning_goal_id
         where lg.slug = 'jee' and p.id < 167
      ) x), '') || '|' ||
      coalesce((select string_agg(row_to_json(y)::text, '|'
                                  order by y.playlist_id, y.position, y.id) from (
        select pv.id, pv.playlist_id, pv.video_id, pv.position
          from public.playlist_videos pv
          join public.playlists p on p.id = pv.playlist_id
         where p.id < 167 and exists (
           select 1
             from public.playlist_learning_goals plg
             join public.learning_goals lg on lg.id = plg.learning_goal_id
            where plg.playlist_id = p.id and lg.slug = 'jee'
         )
      ) y), '')
    ) as protected_fingerprint
)
select
  (select count(*) from public.playlists) as playlists,
  (select count(*) from public.videos) as videos,
  (select count(*) from public.playlist_videos) as memberships,
  (select count(*) from public.chapters) as chapters,
  (select count(*) from public.subjects) as subjects,
  (select count(*) from public.class_levels) as class_levels,
  (select count(*) from public.chapter_class_levels) as scope_rows,
  (select count(*) from public.chapter_class_levels where reviewed_on = date '2026-08-02') as v14_scope_rows,
  (select count(*) from public.chapter_class_levels ccl
    join public.class_levels cl on cl.id = ccl.class_level_id
   where cl.slug = 'class-11') as class_11_scope_rows,
  (select count(*) from public.chapter_class_levels ccl
    join public.class_levels cl on cl.id = ccl.class_level_id
   where cl.slug = 'class-12') as class_12_scope_rows,
  (select count(*) from public.chapter_class_levels ccl
    join public.class_levels cl on cl.id = ccl.class_level_id
   where cl.slug = 'dropper') as dropper_scope_rows,
  protected.protected_courses,
  protected.protected_memberships,
  protected.protected_fingerprint,
  (
  select count(*) from public.get_browse_curriculum('jee', 'class-11', 'chemistry')
   where level = 'chapter'
) as jee_chemistry_11,
  (
  select count(*) from public.get_browse_curriculum('jee', 'class-12', 'chemistry')
   where level = 'chapter'
) as jee_chemistry_12,
  (
  select count(*) from (
    select slug from public.get_browse_curriculum('jee', 'class-11', 'chemistry')
     where level = 'chapter'
    intersect
    select slug from public.get_browse_curriculum('jee', 'class-12', 'chemistry')
     where level = 'chapter'
  ) overlap_rows
) as jee_chemistry_overlap,
  (
  select count(*) from public.get_browse_curriculum('jee', 'class-11', 'mathematics')
   where level = 'chapter'
) as jee_mathematics_11,
  (
  select count(*) from public.get_browse_curriculum('jee', 'class-12', 'mathematics')
   where level = 'chapter'
) as jee_mathematics_12,
  (
  select count(*) from (
    select slug from public.get_browse_curriculum('jee', 'class-11', 'mathematics')
     where level = 'chapter'
    intersect
    select slug from public.get_browse_curriculum('jee', 'class-12', 'mathematics')
     where level = 'chapter'
  ) overlap_rows
) as jee_mathematics_overlap,
  (
  select count(*) from public.get_browse_curriculum('neet', 'class-11', 'physics')
   where level = 'chapter'
) as neet_physics_11,
  (
  select count(*) from public.get_browse_curriculum('neet', 'class-12', 'physics')
   where level = 'chapter'
) as neet_physics_12,
  (
  select count(*) from (
    select slug from public.get_browse_curriculum('neet', 'class-11', 'physics')
     where level = 'chapter'
    intersect
    select slug from public.get_browse_curriculum('neet', 'class-12', 'physics')
     where level = 'chapter'
  ) overlap_rows
) as neet_physics_overlap,
  (
  select count(*) from public.get_browse_curriculum('neet', 'class-11', 'chemistry')
   where level = 'chapter'
) as neet_chemistry_11,
  (
  select count(*) from public.get_browse_curriculum('neet', 'class-12', 'chemistry')
   where level = 'chapter'
) as neet_chemistry_12,
  (
  select count(*) from (
    select slug from public.get_browse_curriculum('neet', 'class-11', 'chemistry')
     where level = 'chapter'
    intersect
    select slug from public.get_browse_curriculum('neet', 'class-12', 'chemistry')
     where level = 'chapter'
  ) overlap_rows
) as neet_chemistry_overlap,
  (
  select count(*) from public.get_browse_curriculum('neet', 'class-11', 'biology')
   where level = 'chapter'
) as neet_biology_11,
  (
  select count(*) from public.get_browse_curriculum('neet', 'class-12', 'biology')
   where level = 'chapter'
) as neet_biology_12,
  (
  select count(*) from (
    select slug from public.get_browse_curriculum('neet', 'class-11', 'biology')
     where level = 'chapter'
    intersect
    select slug from public.get_browse_curriculum('neet', 'class-12', 'biology')
     where level = 'chapter'
  ) overlap_rows
) as neet_biology_overlap,
  (
  select count(*) from public.get_browse_curriculum('school', 'class-10', 'mathematics')
   where level = 'chapter'
) as school_mathematics_10,
  exists (
    select 1 from public.get_browse_curriculum('school', 'class-10', 'mathematics')
     where level = 'chapter' and slug = 'probability'
  ) as school_probability_visible,
  has_table_privilege('anon', 'public.chapter_class_levels', 'select') as anon_scope_select,
  has_table_privilege('authenticated', 'public.chapter_class_levels', 'select') as authenticated_scope_select,
  has_function_privilege('anon', 'public.get_browse_curriculum(text,text,text)', 'execute') as anon_curriculum_execute,
  has_function_privilege('authenticated', 'public.get_browse_curriculum(text,text,text)', 'execute') as authenticated_curriculum_execute,
  has_function_privilege('anon', 'public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)', 'execute') as anon_facets_execute,
  has_function_privilege('authenticated', 'public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)', 'execute') as authenticated_facets_execute
from protected;
