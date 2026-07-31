-- fix_null_category_admin_invisibility_2026-07-31.sql
--
-- 64 of 291 live courses (629 lessons, 22% of the catalogue) have a NULL
-- category_id, and public.get_manage_playlists() INNER JOINs public.categories
-- -- so those courses never appear in the admin "Manage Catalogue" list at all,
-- and cannot be edited through the admin tooling. Every other content fix
-- (wrong titles, wrong institute, chapter mistags) is therefore impossible to
-- apply to a fifth of the catalogue. Audit finding A10, 31 July 2026.
--
-- CAUSE: the hand-written SQL import batches (docs/sql/*.sql) insert into
-- public.playlists without category_id. Nothing rejected it, because the
-- column is nullable.
--
-- TWO PARTS:
--   1. Backfill the 64 rows from their learning goal. This is unambiguous --
--      verified against live production that all 64 have EXACTLY ONE learning
--      goal (22 JEE, 42 NEET), none have zero, none have more than one -- and
--      public.category_learning_goals maps goals to categories 1:1.
--   2. Make the admin query use a LEFT JOIN, so a future row with a missing
--      category can never again be silently swallowed. The function below is
--      reproduced verbatim from src/migrations/catalog_management_v11.sql with
--      exactly one word changed ("join" -> "left join" on the categories line).
--
-- Idempotent: the backfill only touches rows that are still NULL, and the
-- function is a create-or-replace. Safe to re-run.

begin;

-- ---------------------------------------------------------------------
-- 1. BACKFILL
-- ---------------------------------------------------------------------
do $backfill$
declare
  v_before int;
  v_ambiguous int;
begin
  select count(*) into v_before from public.playlists where category_id is null;

  -- Refuse to guess if any NULL-category course does not have exactly one
  -- learning goal. Better to abort than to file a course under the wrong exam.
  select count(*) into v_ambiguous
    from public.playlists p
   where p.category_id is null
     and (select count(*) from public.playlist_learning_goals g where g.playlist_id = p.id) <> 1;
  if v_ambiguous > 0 then
    raise exception
      '% course(s) with NULL category_id do not have exactly one learning goal -- refusing to infer a category for them',
      v_ambiguous;
  end if;

  update public.playlists p
     set category_id = clg.category_id
    from public.playlist_learning_goals plg
    join public.category_learning_goals clg
      on clg.learning_goal_id = plg.learning_goal_id
   where plg.playlist_id = p.id
     and p.category_id is null;

  raise notice 'backfilled category_id on % course(s)', v_before;
end
$backfill$;

-- ---------------------------------------------------------------------
-- 2. HARDEN THE ADMIN QUERY (inner join -> left join on categories)
--
-- The replacement below is reproduced verbatim from
-- src/migrations/catalog_management_v11.sql, which is the ONLY definition of
-- this function anywhere in the repo. If production has since drifted (a hand
-- edit in the SQL Editor, a migration that was never checked in), a blind
-- create-or-replace would silently destroy that work -- so refuse instead.
-- ---------------------------------------------------------------------
do $guard$
declare
  v_def text;
begin
  select pg_get_functiondef('public.get_manage_playlists(text, int, int)'::regprocedure) into v_def;

  if position('left join public.categories c on c.id = p.category_id' in v_def) > 0 then
    raise notice 'get_manage_playlists already left-joins categories -- nothing to change (safe re-run)';
  elsif position('join public.categories c on c.id = p.category_id' in v_def) = 0 then
    raise exception
      'live get_manage_playlists does not contain the expected categories join -- production has drifted from catalog_management_v11.sql, refusing to overwrite it. Reconcile by hand.';
  end if;
end
$guard$;

create or replace function public.get_manage_playlists(
  p_search text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  total_count bigint,
  playlist_id bigint,
  title text,
  teacher text,
  youtube_playlist_id text,
  channel_id bigint,
  channel_name text,
  category_id bigint,
  category_name text,
  subject_id bigint,
  subject_name text,
  content_type text,
  language text,
  difficulty text,
  audience_focus text,
  display_order int,
  learning_goal_ids bigint[],
  class_level_ids bigint[],
  videos jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid pagination bounds';
  end if;

  return query
  select
    count(*) over() as total_count,
    p.id,
    p.title,
    p.teacher,
    p.youtube_playlist_id,
    p.channel_id,
    ic.name,
    p.category_id,
    c.name,
    p.subject_id,
    s.name,
    p.content_type,
    p.language,
    p.difficulty,
    p.audience_focus,
    p.display_order,
    coalesce((
      select array_agg(plg.learning_goal_id order by lg.display_order, lg.id)
      from public.playlist_learning_goals plg
      join public.learning_goals lg on lg.id = plg.learning_goal_id
      where plg.playlist_id = p.id
    ), '{}'::bigint[]),
    coalesce((
      select array_agg(pcl.class_level_id order by cl.display_order, cl.id)
      from public.playlist_class_levels pcl
      join public.class_levels cl on cl.id = pcl.class_level_id
      where pcl.playlist_id = p.id
    ), '{}'::bigint[]),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'membership_id', pv.id,
          'position', pv.position,
          'video_id', v.id,
          'title', v.title,
          'youtube_video_id', v.youtube_video_id,
          'chapter_id', v.chapter_id,
          'chapter_name', ch.name,
          'shared_playlist_count', (
            select count(*)
            from public.playlist_videos shared
            where shared.video_id = v.id
          ),
          'learning_goal_ids', coalesce((
            select jsonb_agg(vlg.learning_goal_id order by vlg.learning_goal_id)
            from public.video_learning_goals vlg
            where vlg.video_id = v.id
          ), '[]'::jsonb),
          'class_level_ids', coalesce((
            select jsonb_agg(vcl.class_level_id order by vcl.class_level_id)
            from public.video_class_levels vcl
            where vcl.video_id = v.id
          ), '[]'::jsonb)
        )
        order by pv.position, pv.id
      )
      from public.playlist_videos pv
      join public.videos v on v.id = pv.video_id
      left join public.chapters ch on ch.id = v.chapter_id
      where pv.playlist_id = p.id
    ), '[]'::jsonb)
  from public.playlists p
  join public.institutes_channels ic on ic.id = p.channel_id
  left join public.categories c on c.id = p.category_id
  left join public.subjects s on s.id = p.subject_id
  where nullif(btrim(coalesce(p_search, '')), '') is null
     or p.title ilike '%' || btrim(p_search) || '%'
     or coalesce(p.teacher, '') ilike '%' || btrim(p_search) || '%'
     or coalesce(p.youtube_playlist_id, '') ilike '%' || btrim(p_search) || '%'
  order by p.display_order, p.id
  limit p_limit offset p_offset;
end;
$$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_null int;
  v_def text;
begin
  select count(*) into v_null from public.playlists where category_id is null;
  if v_null <> 0 then
    raise exception '% course(s) still have a NULL category_id', v_null;
  end if;

  select pg_get_functiondef('public.get_manage_playlists(text, int, int)'::regprocedure) into v_def;
  if v_def is null then
    raise exception 'get_manage_playlists is missing after replace';
  end if;
  if position('left join public.categories' in v_def) = 0 then
    raise exception 'get_manage_playlists still inner-joins categories -- the left join did not take';
  end if;

  raise notice 'SELF-TEST PASSED: 0 courses with NULL category_id; admin query now left-joins categories.';
end
$verify$;

commit;
