-- ============================================================
-- CHAPTER CLASS SCOPES v14 - READ-ONLY CLONE PREFLIGHT
-- ISOLATED RESTORE CLONE ONLY. NEVER RUN ON PRODUCTION.
-- Generated from one hash-pinned review artifact. No writes.
-- ============================================================

select
  (select count(*) from public.playlists) as playlists,
  (select count(*) from public.videos) as videos,
  (select count(*) from public.playlist_videos) as memberships,
  (select count(*) from public.chapters) as chapters,
  (select count(*) from public.subjects) as subjects,
  (select count(*) from public.class_levels) as class_levels,
  to_regclass('public.chapter_class_levels') as scope_table,
  (select count(*) from public.chapter_class_levels) as scope_rows,
  to_regprocedure('public.get_browse_curriculum(text,text,text)') is not null as has_curriculum_rpc,
  to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)') is not null as has_facet_rpc;


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
  ) as protected_fingerprint;


select ch.slug as chapter_slug, cl.slug as class_slug
  from public.chapter_class_levels ccl
  join public.chapters ch on ch.id = ccl.chapter_id
  join public.class_levels cl on cl.id = ccl.class_level_id
 order by ch.slug, cl.slug;
