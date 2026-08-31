


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_teacher_alias"("p_teacher_id" bigint, "p_alias" "text", "p_type" "text" DEFAULT 'nickname'::"text", "p_verified" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_shared jsonb;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.teachers where id = p_teacher_id) then
    raise exception 'invalid teacher_id %', p_teacher_id; end if;
  if public.normalize_person_name(p_alias) is null then
    raise exception 'alias % normalises to nothing', p_alias; end if;

  insert into public.teacher_aliases (teacher_id, alias, alias_type, status, source,
                                      created_by, verified_by, verified_at)
  values (p_teacher_id, trim(p_alias), p_type,
          case when p_verified then 'verified' else 'proposed' end, 'manual',
          auth.uid(), case when p_verified then auth.uid() end,
          case when p_verified then now() end)
  on conflict (teacher_id, normalized_alias) do update
    set alias_type = excluded.alias_type,
        -- Verification only ever moves forward. (Not greatest(): relying on
        -- 'verified' > 'proposed' alphabetically would silently invert the
        -- moment someone adds a status like 'withdrawn'.)
        status = case when public.teacher_aliases.status = 'verified'
                        or excluded.status = 'verified' then 'verified'
                      else excluded.status end,
        verified_by = coalesce(excluded.verified_by, public.teacher_aliases.verified_by),
        verified_at = coalesce(excluded.verified_at, public.teacher_aliases.verified_at);

  -- Informational: who else answers to this alias. Not an error.
  select jsonb_agg(jsonb_build_object('teacher_id', t.id, 'display_name', t.display_name))
    into v_shared
    from public.teacher_aliases a join public.teachers t on t.id = a.teacher_id
   where a.normalized_alias = public.normalize_person_name(p_alias)
     and a.teacher_id <> p_teacher_id;

  return jsonb_build_object('teacher_id', p_teacher_id, 'alias', trim(p_alias),
                            'also_used_by', coalesce(v_shared, '[]'::jsonb));
end; $$;


ALTER FUNCTION "public"."add_teacher_alias"("p_teacher_id" bigint, "p_alias" "text", "p_type" "text", "p_verified" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_reviews"() RETURNS TABLE("id" bigint, "playlist_id" bigint, "playlist_title" "text", "user_id" "uuid", "rating" integer, "review" "text", "review_hidden" boolean, "review_hidden_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    r.id, r.playlist_id, p.title, r.user_id, r.rating, r.review,
    r.review_hidden, r.review_hidden_at, r.created_at
  from public.playlist_ratings r
  join public.playlists p on p.id = r.playlist_id
  where public.is_admin()
    and r.review is not null
    and length(trim(r.review)) > 0
  order by r.created_at desc;
$$;


ALTER FUNCTION "public"."admin_list_reviews"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_review_hidden"("p_rating_id" bigint, "p_hidden" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'only an admin may moderate a review';
  end if;

  update public.playlist_ratings
     set review_hidden = p_hidden,
         review_hidden_at = case when p_hidden then now() else null end,
         review_hidden_by = case when p_hidden then auth.uid() else null end
   where id = p_rating_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'rating not found';
  end if;
end;
$$;


ALTER FUNCTION "public"."admin_set_review_hidden"("p_rating_id" bigint, "p_hidden" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_faculty_review_group_as_new"("p_normalized" "text", "p_display_name" "text", "p_verified" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r record; v_result jsonb; v_teacher_id bigint; v_done int := 0; v_links int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  for r in select id from public.teacher_name_proposals
            where normalized = p_normalized and status in ('pending','deferred')
            order by id for update
  loop
    if v_teacher_id is null then
      v_result := public.approve_proposal_as_new(r.id, p_display_name, p_verified);
      v_teacher_id := (v_result->>'teacher_id')::bigint;
    else
      v_result := public.approve_proposal_as_existing(r.id, v_teacher_id, true);
    end if;
    v_links := v_links + coalesce((v_result->>'playlists_linked')::int, 0);
    v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;

  return jsonb_build_object('normalized', p_normalized, 'variants_resolved', v_done,
    'teacher_id', v_teacher_id, 'playlists_linked', v_links);
end; $$;


ALTER FUNCTION "public"."approve_faculty_review_group_as_new"("p_normalized" "text", "p_display_name" "text", "p_verified" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_group_as_existing"("p_normalized" "text", "p_teacher_id" bigint, "p_add_alias" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r record; v_done int := 0; v_res jsonb; v_links int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  for r in select id from public.teacher_name_proposals
            where normalized = p_normalized and status in ('pending','deferred')
            order by id for update
  loop
    v_res := public.approve_proposal_as_existing(r.id, p_teacher_id, p_add_alias);
    v_links := v_links + coalesce((v_res->>'playlists_linked')::int, 0);
    v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;
  return jsonb_build_object('normalized', p_normalized, 'variants_resolved', v_done,
                            'teacher_id', p_teacher_id, 'playlists_linked', v_links);
end; $$;


ALTER FUNCTION "public"."approve_group_as_existing"("p_normalized" "text", "p_teacher_id" bigint, "p_add_alias" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_proposal_as_existing"("p_proposal_id" bigint, "p_teacher_id" bigint, "p_add_alias" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare p record; v_links int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  -- FOR UPDATE: two admins opening the review queue must not both approve
  -- the same proposal and double-link its playlists.
  select * into p from public.teacher_name_proposals where id = p_proposal_id for update;
  if not found then raise exception 'invalid proposal_id %', p_proposal_id; end if;
  if p.status <> 'pending' and p.status <> 'deferred' then
    raise exception 'proposal % is already %', p_proposal_id, p.status; end if;
  if p.kind = 'multi-person' then
    raise exception 'proposal % names more than one person — use split_proposal()', p_proposal_id; end if;
  if p.kind = 'organization-or-team' then
    raise exception 'proposal % is a team/department, not a person — reject it or split it into the real faculty', p_proposal_id; end if;
  if not exists (select 1 from public.teachers where id = p_teacher_id) then
    raise exception 'invalid teacher_id %', p_teacher_id; end if;

  if p_add_alias then
    insert into public.teacher_aliases (teacher_id, alias, alias_type, status, source, created_by, verified_by, verified_at)
    values (p_teacher_id, trim(p.raw_teacher), 'nickname', 'verified', 'migrated', auth.uid(), auth.uid(), now())
    on conflict (teacher_id, normalized_alias) do update
      set status = 'verified', verified_by = auth.uid(), verified_at = now();
  end if;

  insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
  select pl.id, p_teacher_id, 'instructor', 1
    from public.playlists pl where pl.teacher = p.raw_teacher
  on conflict (playlist_id, teacher_id) do nothing;
  get diagnostics v_links = row_count;

  update public.teacher_name_proposals
     set status = 'approved-existing', resolved_teacher_ids = array[p_teacher_id],
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_proposal_id;
  perform public.log_proposal_decision(p_proposal_id, p.raw_teacher, 'approved-existing',
                                       array[p_teacher_id], null);

  return jsonb_build_object('proposal_id', p_proposal_id, 'teacher_id', p_teacher_id,
                            'playlists_linked', v_links);
end; $$;


ALTER FUNCTION "public"."approve_proposal_as_existing"("p_proposal_id" bigint, "p_teacher_id" bigint, "p_add_alias" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_proposal_as_new"("p_proposal_id" bigint, "p_display_name" "text" DEFAULT NULL::"text", "p_verified" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare p record; v_new jsonb; v_tid bigint; v_links int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  -- FOR UPDATE: two admins opening the review queue must not both approve
  -- the same proposal and double-link its playlists.
  select * into p from public.teacher_name_proposals where id = p_proposal_id for update;
  if not found then raise exception 'invalid proposal_id %', p_proposal_id; end if;
  if p.status not in ('pending','deferred') then
    raise exception 'proposal % is already %', p_proposal_id, p.status; end if;
  if p.kind = 'multi-person' then
    raise exception 'proposal % names more than one person — use split_proposal()', p_proposal_id; end if;
  if p.kind = 'organization-or-team' then
    raise exception 'proposal % is a team/department, not a person — reject it or split it into the real faculty', p_proposal_id; end if;

  v_new := public.create_teacher(coalesce(p_display_name, trim(p.raw_teacher)), '[]'::jsonb, p_verified, true);
  v_tid := (v_new->>'teacher_id')::bigint;

  if coalesce(p_display_name, '') <> '' and p_display_name <> p.raw_teacher then
    perform public.add_teacher_alias(v_tid, trim(p.raw_teacher), 'nickname', true);
  end if;

  insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
  select pl.id, v_tid, 'instructor', 1
    from public.playlists pl where pl.teacher = p.raw_teacher
  on conflict (playlist_id, teacher_id) do nothing;
  get diagnostics v_links = row_count;

  update public.teacher_name_proposals
     set status = 'approved-new', resolved_teacher_ids = array[v_tid],
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_proposal_id;
  perform public.log_proposal_decision(p_proposal_id, p.raw_teacher, 'approved-new',
                                       array[v_tid], null);

  return jsonb_build_object('proposal_id', p_proposal_id, 'teacher_id', v_tid,
                            'playlists_linked', v_links,
                            'similar_existing', v_new->'similar_existing');
end; $$;


ALTER FUNCTION "public"."approve_proposal_as_new"("p_proposal_id" bigint, "p_display_name" "text", "p_verified" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_playlist_video_channel"("p_playlist_id" bigint, "p_video_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_video_channel bigint;
  v_course_channel bigint;
begin
  select channel_id into v_video_channel  from public.videos    where id = p_video_id;
  select channel_id into v_course_channel from public.playlists where id = p_playlist_id;

  if v_video_channel is distinct from v_course_channel then
    raise exception
      'lesson % is published by channel %, but course % credits channel % -- a course shows a single institute, so this would misattribute the lesson',
      p_video_id, v_video_channel, p_playlist_id, v_course_channel;
  end if;
end;
$$;


ALTER FUNCTION "public"."assert_playlist_video_channel"("p_playlist_id" bigint, "p_video_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."browse_facet_counts"("p_goal" "text" DEFAULT NULL::"text", "p_class" "text" DEFAULT NULL::"text", "p_subject" "text" DEFAULT NULL::"text", "p_chapter" "text" DEFAULT NULL::"text", "p_channel" bigint DEFAULT NULL::bigint, "p_language" "text"[] DEFAULT NULL::"text"[], "p_type" "text"[] DEFAULT NULL::"text"[], "p_difficulty" "text"[] DEFAULT NULL::"text"[], "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("facet" "text", "value" "text", "n" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with class_options(value, slugs) as (
    values
      ('class-10'::text, array['class-10']::text[]),
      ('class-11'::text, array['class-11']::text[]),
      ('class-12'::text, array['class-12']::text[]),
      ('dropper'::text, array['dropper','class-11','class-12']::text[])
  ), base as (
    select
      pl.id,
      pl.language,
      pl.content_type,
      pl.difficulty,
      pl.channel_id,
      (p_goal is null or exists (
        select 1
        from public.playlist_learning_goals g
        join public.learning_goals lg on lg.id = g.learning_goal_id
        where g.playlist_id = pl.id and lg.slug = p_goal
      )) as ok_goal,
      case
        when p_class is null then true
        when p_chapter is not null then exists (
          select 1
          from public.playlist_videos pv
          join public.videos v on v.id = pv.video_id
          join public.chapters c on c.id = v.chapter_id
          where pv.playlist_id = pl.id
            and c.slug = p_chapter
            and public.chapter_matches_class_scope(c.id, pl.id, p_class)
        )
        else exists (
          select 1
          from public.playlist_class_levels j
          join public.class_levels cl on cl.id = j.class_level_id
          where j.playlist_id = pl.id
            and cl.slug = any(
              case
                when p_class = 'dropper' then array['dropper','class-11','class-12']::text[]
                else array[p_class]::text[]
              end
            )
        )
      end as ok_class,
      (p_subject is null or exists (
        select 1 from public.subjects s
        where s.id = pl.subject_id and s.slug = p_subject
      )) as ok_subject,
      (p_chapter is null or exists (
        select 1
        from public.playlist_videos pv
        join public.videos v on v.id = pv.video_id
        join public.chapters c on c.id = v.chapter_id
        where pv.playlist_id = pl.id and c.slug = p_chapter
      )) as ok_chapter,
      (p_channel is null or pl.channel_id = p_channel) as ok_channel,
      (p_language is null or pl.language = any(p_language)) as ok_language,
      (p_type is null or pl.content_type = any(p_type)) as ok_type,
      (p_difficulty is null or pl.difficulty = any(p_difficulty)) as ok_difficulty,
      -- CHANGED: match with the homepage engine, not a single-column ILIKE, so
      -- these counts agree with the /browse result list (search_playlist_ids,
      -- browse_search_2026-08-25.sql). Uncorrelated subquery -> evaluated once.
      (p_search is null or btrim(p_search) = ''
         or pl.id in (select sid.id from public.search_playlist_ids(btrim(p_search)) sid)) as ok_search
    from public.playlists pl
  ), facets as (
    select 'goal'::text as facet, lg.slug as value, count(distinct b.id)::bigint as n
    from base b
    join public.playlist_learning_goals g on g.playlist_id = b.id
    join public.learning_goals lg on lg.id = g.learning_goal_id
    where b.ok_class and b.ok_subject and b.ok_chapter and b.ok_channel
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
    group by lg.slug

    union all

    select 'class', co.value, count(distinct b.id)::bigint
    from base b
    cross join class_options co
    where b.ok_goal and b.ok_subject and b.ok_chapter and b.ok_channel
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
      and (
        (p_chapter is null and exists (
          select 1
          from public.playlist_class_levels j
          join public.class_levels cl on cl.id = j.class_level_id
          where j.playlist_id = b.id and cl.slug = any(co.slugs)
        ))
        or
        (p_chapter is not null and exists (
          select 1
          from public.playlist_videos pv
          join public.videos v on v.id = pv.video_id
          join public.chapters c on c.id = v.chapter_id
          where pv.playlist_id = b.id
            and c.slug = p_chapter
            and public.chapter_matches_class_scope(c.id, b.id, co.value)
        ))
      )
    group by co.value

    union all

    select 'subject', s.slug, count(distinct b.id)::bigint
    from base b
    join public.playlists pl on pl.id = b.id
    join public.subjects s on s.id = pl.subject_id
    where b.ok_goal and b.ok_class and b.ok_chapter and b.ok_channel
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
    group by s.slug

    union all

    select 'chapter', c.slug, count(distinct b.id)::bigint
    from base b
    join public.playlist_videos pv on pv.playlist_id = b.id
    join public.videos v on v.id = pv.video_id
    join public.chapters c on c.id = v.chapter_id
    where b.ok_goal and b.ok_subject and b.ok_channel
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
      and public.chapter_matches_class_scope(c.id, b.id, p_class)
    group by c.slug

    union all

    select 'language', b.language, count(distinct b.id)::bigint
    from base b
    where b.language is not null
      and b.ok_goal and b.ok_class and b.ok_subject and b.ok_chapter
      and b.ok_channel and b.ok_type and b.ok_difficulty and b.ok_search
    group by b.language

    union all

    select 'type', b.content_type, count(distinct b.id)::bigint
    from base b
    where b.content_type is not null
      and b.ok_goal and b.ok_class and b.ok_subject and b.ok_chapter
      and b.ok_channel and b.ok_language and b.ok_difficulty and b.ok_search
    group by b.content_type

    union all

    select 'difficulty', b.difficulty, count(distinct b.id)::bigint
    from base b
    where b.difficulty is not null
      and b.ok_goal and b.ok_class and b.ok_subject and b.ok_chapter
      and b.ok_channel and b.ok_language and b.ok_type and b.ok_search
    group by b.difficulty

    union all

    select 'channel', b.channel_id::text, count(distinct b.id)::bigint
    from base b
    where b.channel_id is not null
      and b.ok_goal and b.ok_class and b.ok_subject and b.ok_chapter
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
    group by b.channel_id
  )
  select f.facet, f.value, f.n
  from facets f
  where f.n > 0
  order by f.facet, f.value;
$$;


ALTER FUNCTION "public"."browse_facet_counts"("p_goal" "text", "p_class" "text", "p_subject" "text", "p_chapter" "text", "p_channel" bigint, "p_language" "text"[], "p_type" "text"[], "p_difficulty" "text"[], "p_search" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."browse_facet_counts"("p_goal" "text", "p_class" "text", "p_subject" "text", "p_chapter" "text", "p_channel" bigint, "p_language" "text"[], "p_type" "text"[], "p_difficulty" "text"[], "p_search" "text") IS 'Contextual counts using reviewed canonical chapter classes and unchanged course-level Dropper semantics. Search matches via search_playlist_ids (the homepage engine), so counts agree with the /browse result list.';



CREATE OR REPLACE FUNCTION "public"."catalog_manage_capability"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (
    public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'version', 11,
    'paginated_playlist_list', true,
    'playlist_metadata_and_taxonomy', true,
    'video_taxonomy', true,
    'video_chapter_reassignment', true,
    'playlist_deletion', true,
    'audit_snapshots', true
  );
end;
$$;


ALTER FUNCTION "public"."catalog_manage_capability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."catalog_playlist_snapshot"("p_playlist_id" bigint) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select to_jsonb(p) || jsonb_build_object(
    'learning_goal_ids',
      coalesce((
        select jsonb_agg(plg.learning_goal_id order by plg.learning_goal_id)
        from public.playlist_learning_goals plg
        where plg.playlist_id = p.id
      ), '[]'::jsonb),
    'class_level_ids',
      coalesce((
        select jsonb_agg(pcl.class_level_id order by pcl.class_level_id)
        from public.playlist_class_levels pcl
        where pcl.playlist_id = p.id
      ), '[]'::jsonb),
    'video_links',
      coalesce((
        select jsonb_agg(to_jsonb(pv) order by pv.position, pv.id)
        from public.playlist_videos pv
        where pv.playlist_id = p.id
      ), '[]'::jsonb),
    'ratings',
      coalesce((
        select jsonb_agg(to_jsonb(pr) order by pr.created_at, pr.id)
        from public.playlist_ratings pr
        where pr.playlist_id = p.id
      ), '[]'::jsonb)
  )
  from public.playlists p
  where p.id = p_playlist_id;
$$;


ALTER FUNCTION "public"."catalog_playlist_snapshot"("p_playlist_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."catalog_similarity"("text", "text") RETURNS real
    LANGUAGE "sql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $_$ select public.similarity($1, $2) $_$;


ALTER FUNCTION "public"."catalog_similarity"("text", "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."catalog_video_taxonomy_snapshot"("p_video_id" bigint) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select to_jsonb(v) || jsonb_build_object(
    'learning_goal_ids',
      coalesce((
        select jsonb_agg(vlg.learning_goal_id order by vlg.learning_goal_id)
        from public.video_learning_goals vlg
        where vlg.video_id = v.id
      ), '[]'::jsonb),
    'class_level_ids',
      coalesce((
        select jsonb_agg(vcl.class_level_id order by vcl.class_level_id)
        from public.video_class_levels vcl
        where vcl.video_id = v.id
      ), '[]'::jsonb)
  )
  from public.videos v
  where v.id = p_video_id;
$$;


ALTER FUNCTION "public"."catalog_video_taxonomy_snapshot"("p_video_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."catalog_word_similarity"("text", "text") RETURNS real
    LANGUAGE "sql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $_$ select public.word_similarity($1, $2) $_$;


ALTER FUNCTION "public"."catalog_word_similarity"("text", "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."catalog_word_similarity"("text", "text") IS 'Schema-stable wrapper for pg_trgm word_similarity(needle, haystack): best-matching word-boundary extent, not whole-string similarity.';



CREATE OR REPLACE FUNCTION "public"."chapter_matches_class_scope"("p_chapter_id" bigint, "p_playlist_id" bigint, "p_class" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select case
    when p_class is null then true
    when p_class = 'dropper' then exists (
      select 1
      from public.playlist_class_levels pcl
      join public.class_levels cl on cl.id = pcl.class_level_id
      where pcl.playlist_id = p_playlist_id
        and cl.slug = any(array['dropper','class-11','class-12']::text[])
    )
    when exists (
      select 1
      from public.chapter_class_levels reviewed
      where reviewed.chapter_id = p_chapter_id
    ) then exists (
      select 1
      from public.chapter_class_levels reviewed
      join public.class_levels cl on cl.id = reviewed.class_level_id
      where reviewed.chapter_id = p_chapter_id
        and cl.slug = p_class
    )
    else exists (
      select 1
      from public.playlist_class_levels pcl
      join public.class_levels cl on cl.id = pcl.class_level_id
      where pcl.playlist_id = p_playlist_id
        and cl.slug = p_class
    )
  end;
$$;


ALTER FUNCTION "public"."chapter_matches_class_scope"("p_chapter_id" bigint, "p_playlist_id" bigint, "p_class" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."chapter_matches_class_scope"("p_chapter_id" bigint, "p_playlist_id" bigint, "p_class" "text") IS 'Canonical chapter/class predicate with playlist fallback for unreviewed chapters and unchanged Dropper audience semantics.';



CREATE OR REPLACE FUNCTION "public"."class_label_to_slug"("p_label" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select case lower(trim(p_label))
           when '10th' then 'class-10' when '11th' then 'class-11'
           when '12th' then 'class-12' when 'dropper' then 'dropper' end;
$$;


ALTER FUNCTION "public"."class_label_to_slug"("p_label" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_managed_video_taxonomy"("p_playlist_id" bigint, "p_video_id" bigint, "p_allow_shared" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_shared int;
  v_before jsonb;
  v_after jsonb;
begin
  if not (
    public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.playlist_videos
    where playlist_id = p_playlist_id and video_id = p_video_id
  ) then
    raise exception 'video is not linked to this playlist';
  end if;
  select count(*) into v_shared
  from public.playlist_videos
  where video_id = p_video_id;
  if v_shared > 1 and not p_allow_shared then
    raise exception 'video is shared by % playlists; explicit confirmation is required', v_shared;
  end if;

  v_before := public.catalog_video_taxonomy_snapshot(p_video_id);
  delete from public.video_learning_goals where video_id = p_video_id;
  delete from public.video_class_levels where video_id = p_video_id;
  v_after := public.catalog_video_taxonomy_snapshot(p_video_id);

  insert into public.catalog_management_audit (
    action, playlist_id, video_id, before_state, after_state, actor_id
  ) values (
    'clear-video-taxonomy', p_playlist_id, p_video_id,
    v_before, v_after, auth.uid()
  );

  return jsonb_build_object(
    'playlist_id', p_playlist_id,
    'video_id', p_video_id,
    'shared_playlist_count', v_shared,
    'learning_goals', 0,
    'class_levels', 0
  );
end;
$$;


ALTER FUNCTION "public"."clear_managed_video_taxonomy"("p_playlist_id" bigint, "p_video_id" bigint, "p_allow_shared" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_video_taxonomy"("p_video_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_g int; v_c int;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.videos where id = p_video_id) then
    raise exception 'invalid video_id %', p_video_id; end if;
  delete from public.video_learning_goals where video_id = p_video_id;
  get diagnostics v_g = row_count;
  delete from public.video_class_levels where video_id = p_video_id;
  get diagnostics v_c = row_count;
  return jsonb_build_object('video_id', p_video_id, 'goals_removed', v_g, 'classes_removed', v_c);
end; $$;


ALTER FUNCTION "public"."clear_video_taxonomy"("p_video_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."content_quality_capability"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'quality_review_supported', true,
    'source_title_supported', true,
    'faculty_identity_required_for_identified', true,
    'automatic_identity_resolution', false);
end; $$;


ALTER FUNCTION "public"."content_quality_capability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_course"("payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_valid jsonb; v_goal_id bigint; v_class_ids bigint[]; v_board_ids bigint[];
  v_pid bigint; v_cid bigint; v_vid bigint; v_pos int := 0;
  v_expected int; v_actual int;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized' using errcode = '42501'; end if;

  -- Same validator, same rules; only the "carries a video array" part differs.
  v_valid := public.validate_import_payload(payload, 'merge', false);
  v_goal_id := (v_valid->>'goal_id')::bigint;
  v_expected := (v_valid->>'video_count')::int;
  select array_agg(x::bigint) into v_class_ids from jsonb_array_elements_text(v_valid->'class_ids') x;
  select coalesce(array_agg(x::bigint),'{}') into v_board_ids from jsonb_array_elements_text(v_valid->'board_ids') x;

  if not exists (select 1 from public.institutes_channels
                 where id = nullif(payload->>'channel_id','')::bigint) then
    raise exception 'invalid channel_id %', payload->>'channel_id'; end if;

  insert into public.playlists (title, teacher, channel_id, category_id, subject_id,
      content_type, language, difficulty, audience_focus, last_verified_at)
  values (trim(payload->>'title'), nullif(payload->>'teacher',''),
      (payload->>'channel_id')::bigint, (payload->>'category_id')::bigint,
      (payload->>'subject_id')::bigint, nullif(payload->>'content_type',''),
      nullif(payload->>'language',''), nullif(payload->>'difficulty',''),
      nullif(payload->>'audience_focus',''), now())
  returning id into v_pid;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    values (v_pid, v_goal_id) on conflict do nothing;
  foreach v_cid in array v_class_ids loop
    insert into public.playlist_class_levels (playlist_id, class_level_id)
      values (v_pid, v_cid) on conflict do nothing; end loop;
  foreach v_cid in array v_board_ids loop
    insert into public.playlist_boards (playlist_id, board_id)
      values (v_pid, v_cid) on conflict do nothing; end loop;

  for v_vid in select x::bigint from jsonb_array_elements_text(payload->'video_ids') x loop
    v_pos := v_pos + 1;
    insert into public.playlist_videos (playlist_id, video_id, position)
      values (v_pid, v_vid, v_pos) on conflict (playlist_id, video_id) do update set position = excluded.position;
  end loop;

  -- review item 2: the reported lesson count must equal the links that exist.
  select count(*) into v_actual from public.playlist_videos where playlist_id = v_pid;
  if v_actual <> v_expected then
    raise exception 'lesson count mismatch: expected %, linked %', v_expected, v_actual; end if;

  return jsonb_build_object('playlist_id', v_pid, 'lessons', v_actual);
end; $$;


ALTER FUNCTION "public"."create_course"("payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_course_with_teachers"("payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_ids bigint[]; v_result jsonb; v_playlist_id bigint;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_ids := public.validate_teacher_ids_payload(payload);
  v_result := public.create_course(payload - 'teacher_ids');
  v_playlist_id := (v_result->>'playlist_id')::bigint;
  perform public.set_playlist_teachers(v_playlist_id, v_ids);

  return v_result || jsonb_build_object(
    'teachers', coalesce(array_length(v_ids, 1), 0),
    'teacher_links_replaced', true);
end; $$;


ALTER FUNCTION "public"."create_course_with_teachers"("payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_teacher"("p_display_name" "text", "p_aliases" "jsonb" DEFAULT '[]'::"jsonb", "p_verified" boolean DEFAULT false, "p_duplicate_acknowledged" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_id bigint; v_cands jsonb; v_el jsonb; v_alias text; v_type text;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if public.normalize_person_name(p_display_name) is null then
    raise exception 'display_name is required'; end if;
  if public.looks_like_multiple_people(p_display_name) then
    raise exception 'display_name "%" looks like more than one person', p_display_name; end if;

  if public.looks_like_organization(p_display_name) then
    raise exception 'display_name "%" looks like a team or department, not a person', p_display_name; end if;

  -- Duplicate detection happens BEFORE the insert. A strong candidate (an exact
  -- name or verified-alias match) does not PROVE this is the same person — so
  -- creation is not forbidden — but it must not happen by accident. The admin
  -- previews with similar_teachers(), then re-submits with the acknowledgement.
  select jsonb_agg(jsonb_build_object('teacher_id', teacher_id, 'display_name', display_name,
                                      'match_type', match_type, 'institutes', institutes,
                                      'course_count', course_count))
    into v_cands from public.search_teachers_internal(p_display_name, 5, true) where match_rank = 1;
  if v_cands is not null and not p_duplicate_acknowledged then
    raise exception 'existing faculty already match "%": % — review them, then resubmit with p_duplicate_acknowledged := true if this is genuinely a different person',
      p_display_name, v_cands
      using errcode = 'check_violation';
  end if;

  insert into public.teachers (display_name, verified)
  values (trim(p_display_name), p_verified) returning id into v_id;

  insert into public.teacher_aliases (teacher_id, alias, alias_type, status, source, created_by)
  values (v_id, trim(p_display_name), 'full-name',
          case when p_verified then 'verified' else 'proposed' end, 'manual', auth.uid());

  for v_el in select * from jsonb_array_elements(coalesce(p_aliases, '[]'::jsonb)) loop
    if jsonb_typeof(v_el) = 'string' then
      v_alias := v_el #>> '{}'; v_type := 'nickname';
    else
      v_alias := v_el->>'alias'; v_type := coalesce(v_el->>'type', 'nickname');
    end if;
    if public.normalize_person_name(v_alias) is not null then
      insert into public.teacher_aliases (teacher_id, alias, alias_type, status, source, created_by)
      values (v_id, trim(v_alias), v_type, 'proposed', 'manual', auth.uid())
      on conflict (teacher_id, normalized_alias) do nothing;
    end if;
  end loop;

  return jsonb_build_object('teacher_id', v_id, 'created', true,
                            'duplicate_acknowledged', p_duplicate_acknowledged,
                            'matched_before_create', coalesce(v_cands, '[]'::jsonb));
end; $$;


ALTER FUNCTION "public"."create_teacher"("p_display_name" "text", "p_aliases" "jsonb", "p_verified" boolean, "p_duplicate_acknowledged" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."defer_faculty_review_group"("p_normalized" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r record; v_done int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for r in select id from public.teacher_name_proposals
            where normalized = p_normalized and status = 'pending'
            order by id for update
  loop
    perform public.defer_proposal(r.id, p_note); v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;
  return jsonb_build_object('normalized', p_normalized, 'variants_deferred', v_done);
end; $$;


ALTER FUNCTION "public"."defer_faculty_review_group"("p_normalized" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."defer_proposal"("p_proposal_id" bigint, "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_raw text;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  update public.teacher_name_proposals
     set status = 'deferred', note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_proposal_id and status = 'pending'
   returning raw_teacher into v_raw;
  if v_raw is null then raise exception 'proposal % not pending', p_proposal_id; end if;
  perform public.log_proposal_decision(p_proposal_id, v_raw, 'deferred', null, p_note);
  return jsonb_build_object('proposal_id', p_proposal_id, 'status', 'deferred');
end; $$;


ALTER FUNCTION "public"."defer_proposal"("p_proposal_id" bigint, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_managed_playlist"("p_playlist_id" bigint, "p_expected_title" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_playlist public.playlists%rowtype;
  v_before jsonb;
  v_links int;
  v_orphans int;
  v_deleted int;
begin
  if not (
    public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select *
  into v_playlist
  from public.playlists
  where id = p_playlist_id
  for update;
  if not found then
    raise exception 'unknown playlist_id %', p_playlist_id;
  end if;
  if v_playlist.title is distinct from p_expected_title then
    raise exception 'expected title does not match current playlist title';
  end if;

  v_before := public.catalog_playlist_snapshot(p_playlist_id);
  select count(*) into v_links
  from public.playlist_videos
  where playlist_id = p_playlist_id;
  select count(*) into v_orphans
  from public.playlist_videos target
  where target.playlist_id = p_playlist_id
    and not exists (
      select 1
      from public.playlist_videos other
      where other.video_id = target.video_id
        and other.playlist_id <> p_playlist_id
    );

  insert into public.catalog_management_audit (
    action, playlist_id, before_state, after_state, actor_id
  ) values (
    'delete-playlist',
    p_playlist_id,
    v_before,
    jsonb_build_object(
      'playlist_deleted', true,
      'video_rows_retained', v_links,
      'videos_without_another_playlist', v_orphans
    ),
    auth.uid()
  );

  delete from public.playlists where id = p_playlist_id;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'playlist delete affected % rows', v_deleted;
  end if;

  return jsonb_build_object(
    'playlist_id', p_playlist_id,
    'deleted_playlists', v_deleted,
    'deleted_videos', 0,
    'video_rows_retained', v_links,
    'videos_without_another_playlist', v_orphans
  );
end;
$$;


ALTER FUNCTION "public"."delete_managed_playlist"("p_playlist_id" bigint, "p_expected_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."derived_class_levels"("p_playlist_id" bigint) RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(array_agg(lbl order by ord), '{}')
  from (
    select case cl.slug when 'class-10' then '10th' when 'class-11' then '11th'
                        when 'class-12' then '12th' when 'dropper' then 'Dropper'
                        else cl.slug end as lbl,
           cl.display_order as ord
    from public.playlist_class_levels pcl
    join public.class_levels cl on cl.id = pcl.class_level_id
    where pcl.playlist_id = p_playlist_id
  ) s;
$$;


ALTER FUNCTION "public"."derived_class_levels"("p_playlist_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_content_report_submission"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  -- Administrative maintenance and test cleanup use service_role and remain
  -- outside the student limit. RLS is still the primary client boundary.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if v_uid is null or new.reporter_id is distinct from v_uid then
    raise exception using
      errcode = '42501',
      message = 'authenticated reporter_id required';
  end if;

  if new.note is not null and char_length(new.note) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'report note must be 1000 characters or fewer';
  end if;

  if new.target_type = 'video'
     and not exists (select 1 from public.videos where id = new.target_id) then
    raise exception using errcode = '22023', message = 'unknown video target';
  elsif new.target_type = 'playlist'
     and not exists (select 1 from public.playlists where id = new.target_id) then
    raise exception using errcode = '22023', message = 'unknown playlist target';
  end if;

  -- Serialize submissions per account so concurrent requests cannot race past
  -- the duplicate or hourly-limit checks.
  perform pg_advisory_xact_lock(
    hashtextextended('content-report:' || v_uid::text, 0)
  );

  if exists (
    select 1
    from public.content_reports r
    where r.reporter_id = v_uid
      and r.target_type = new.target_type
      and r.target_id = new.target_id
      and r.reason = new.reason
      and r.status = 'pending'
  ) then
    raise exception using
      errcode = '23505',
      message = 'an equivalent report is already pending';
  end if;

  if (
    select count(*)
    from public.content_reports r
    where r.reporter_id = v_uid
      and r.created_at >= now() - interval '1 hour'
  ) >= 10 then
    raise exception using
      errcode = 'P0001',
      message = 'report rate limit exceeded; try again later';
  end if;

  -- Client-supplied moderation state and timestamps are never trusted.
  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_content_report_submission"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_rating_submission"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- Administrative maintenance and tests use service_role and stay outside
  -- this. RLS remains the primary client boundary.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Client-supplied moderation state and timestamps are never trusted. Without
    -- this, created_at could be set to the far future and, because the public
    -- list orders by created_at desc, pin a review to the top of a course
    -- permanently.
    new.created_at := now();
    new.updated_at := now();
    if not public.is_admin() then
      new.review_hidden := false;
      new.review_hidden_at := null;
      new.review_hidden_by := null;
    end if;
  elsif tg_op = 'UPDATE' then
    -- An edit must not be able to rewrite history or jump the queue.
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_rating_submission"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."faculty_import_capability"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'teacher_ids_supported', true,
    'omitted', 'preserve',
    'empty_array', 'clear',
    'non_empty_array', 'replace');
end; $$;


ALTER FUNCTION "public"."faculty_import_capability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."force_derived_class_levels"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
      begin
        new.class_levels := public.derived_class_levels(new.id);
        return new;
      end; $$;


ALTER FUNCTION "public"."force_derived_class_levels"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_adjust_karma"("p_author" "uuid", "p_delta" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if p_author is null or p_delta = 0 then return; end if;
  if not exists (select 1 from public.profiles where id = p_author) then return; end if;
  insert into public.forum_user_stats (user_id, karma)
  values (p_author, p_delta)
  on conflict (user_id) do update set
    karma = public.forum_user_stats.karma + excluded.karma,
    updated_at = now();
end;
$$;


ALTER FUNCTION "public"."forum_adjust_karma"("p_author" "uuid", "p_delta" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_admin_dismiss_report"("p_report_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  actor uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  update public.forum_reports
  set status = 'dismissed', resolved_at = now(), resolved_by = actor
  where id = p_report_id and status = 'pending';

  if not found then
    raise exception using errcode = 'P0002', message = 'pending report not found';
  end if;
end;
$$;


ALTER FUNCTION "public"."forum_admin_dismiss_report"("p_report_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_admin_list_beta_members"() RETURNS TABLE("username" "text", "added_at" timestamp with time zone, "added_by_username" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return query
  select p.username, m.added_at, adder.username
  from public.forum_beta_members m
  join public.profiles p on p.id = m.user_id
  left join public.profiles adder on adder.id = m.added_by
  order by lower(p.username), p.id;
end;
$$;


ALTER FUNCTION "public"."forum_admin_list_beta_members"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_admin_list_reports"("p_limit" integer DEFAULT 100) RETURNS TABLE("id" bigint, "reporter_id" "uuid", "target_type" "text", "target_id" bigint, "reason" "text", "note" "text", "priority" "text", "status" "text", "created_at" timestamp with time zone, "post_id" bigint, "topic_slug" "text", "post_title" "text", "target_author_username" "text", "content_preview" "text", "target_exists" boolean, "target_is_hidden" boolean, "target_is_deleted" boolean, "post_is_locked" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  return query
  select
    r.id,
    r.reporter_id,
    r.target_type,
    r.target_id,
    r.reason,
    r.note,
    r.priority,
    r.status,
    r.created_at,
    case when r.target_type = 'post' then p.id else c.post_id end as post_id,
    t.slug as topic_slug,
    thread.title as post_title,
    author.username as target_author_username,
    case
      when r.target_type = 'post' and p.id is not null then
        left(regexp_replace(p.body, '[[:space:]]+', ' ', 'g'), 600)
      when r.target_type = 'comment' and c.id is not null then
        left(regexp_replace(c.body, '[[:space:]]+', ' ', 'g'), 600)
      else null
    end as content_preview,
    case when r.target_type = 'post' then p.id is not null else c.id is not null end
      as target_exists,
    case when r.target_type = 'post' then p.hidden_at is not null else c.hidden_at is not null end
      as target_is_hidden,
    case when r.target_type = 'post' then p.deleted_at is not null else c.deleted_at is not null end
      as target_is_deleted,
    thread.locked_at is not null as post_is_locked
  from public.forum_reports r
  left join public.forum_posts p
    on r.target_type = 'post' and p.id = r.target_id
  left join public.forum_comments c
    on r.target_type = 'comment' and c.id = r.target_id
  left join public.forum_posts thread
    on thread.id = case when r.target_type = 'post' then p.id else c.post_id end
  left join public.forum_topics t on t.id = thread.topic_id
  left join public.profiles author
    on author.id = case when r.target_type = 'post' then p.author_id else c.author_id end
  where r.status = 'pending'
  order by case r.priority when 'urgent' then 0 else 1 end, r.created_at, r.id
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;


ALTER FUNCTION "public"."forum_admin_list_reports"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_admin_list_suspensions"() RETURNS TABLE("username" "text", "suspended_until" timestamp with time zone, "reason" "text", "created_at" timestamp with time zone, "created_by_username" "text", "is_active" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return query
  select
    p.username,
    s.suspended_until,
    s.reason,
    s.created_at,
    actor.username,
    s.suspended_until > now()
  from public.forum_suspensions s
  join public.profiles p on p.id = s.user_id
  left join public.profiles actor on actor.id = s.created_by
  -- Active first, then soonest to expire. An expired row stays listed until
  -- it is lifted, so a moderator can still see that the account has history.
  order by (s.suspended_until > now()) desc, s.suspended_until, p.id;
end;
$$;


ALTER FUNCTION "public"."forum_admin_list_suspensions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_admin_moderate"("p_target_type" "text", "p_target_id" bigint, "p_action" "text", "p_reason" "text" DEFAULT NULL::"text", "p_report_id" bigint DEFAULT NULL::bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare actor uuid := auth.uid();
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'not authorized'; end if;
  if p_target_type not in ('post', 'comment')
     or p_action not in ('hide', 'unhide', 'lock', 'unlock', 'remove', 'solve', 'unsolve') then
    raise exception using errcode = '22023', message = 'invalid moderation action';
  end if;
  if p_action = 'remove' and char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception using errcode = '22023', message = 'permanent removal requires a reason';
  end if;
  if p_report_id is not null and not exists (
    select 1 from public.forum_reports r
    where r.id = p_report_id and r.status = 'pending'
      and r.target_type = p_target_type and r.target_id = p_target_id
  ) then
    raise exception using errcode = '22023',
      message = 'report does not match the moderation target';
  end if;

  if p_target_type = 'post' then
    if p_action = 'hide' then update public.forum_posts set hidden_at = now(), hidden_by = actor, hidden_reason = p_reason where id = p_target_id;
    elsif p_action = 'unhide' then update public.forum_posts set hidden_at = null, hidden_by = null, hidden_reason = null where id = p_target_id;
    elsif p_action = 'lock' then update public.forum_posts set locked_at = now(), locked_by = actor where id = p_target_id;
    elsif p_action = 'unlock' then update public.forum_posts set locked_at = null, locked_by = null where id = p_target_id;
    elsif p_action = 'solve' then update public.forum_posts set is_solved = true where id = p_target_id;
    elsif p_action = 'unsolve' then update public.forum_posts set is_solved = false where id = p_target_id;
    elsif p_action = 'remove' then delete from public.forum_posts where id = p_target_id;
    end if;
  else
    if p_action not in ('hide', 'unhide', 'remove') then
      raise exception using errcode = '22023', message = 'action does not apply to comments';
    elsif p_action = 'hide' then update public.forum_comments set hidden_at = now(), hidden_by = actor, hidden_reason = p_reason where id = p_target_id;
    elsif p_action = 'unhide' then update public.forum_comments set hidden_at = null, hidden_by = null, hidden_reason = null where id = p_target_id;
    elsif p_action = 'remove' then delete from public.forum_comments where id = p_target_id;
    end if;
  end if;
  if not found then raise exception using errcode = 'P0002', message = 'moderation target not found'; end if;

  insert into public.forum_moderation_log
    (actor_id, action, target_type, target_id, reason, report_id)
  values (actor, p_action, p_target_type, p_target_id, p_reason, p_report_id);
  if p_report_id is not null then
    update public.forum_reports set status = 'reviewed', resolved_at = now(), resolved_by = actor
    where id = p_report_id and status = 'pending';
  end if;
end;
$$;


ALTER FUNCTION "public"."forum_admin_moderate"("p_target_type" "text", "p_target_id" bigint, "p_action" "text", "p_reason" "text", "p_report_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_admin_set_beta_member"("p_username" "text", "p_enabled" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  actor uuid := auth.uid();
  candidate text := btrim(coalesce(p_username, ''));
  target_user uuid;
  affected_rows integer := 0;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_enabled is null then
    raise exception using errcode = '22023', message = 'beta membership state is required';
  end if;
  select p.id into target_user
  from public.profiles p
  where lower(btrim(p.username)) = lower(candidate)
    and public.forum_username_is_allowed(p.username);
  if target_user is null then
    raise exception using errcode = 'P0002', message = 'beta student username not found';
  end if;

  if p_enabled then
    insert into public.forum_beta_members (user_id, added_by)
    values (target_user, actor)
    on conflict (user_id) do nothing;
  else
    delete from public.forum_beta_members where user_id = target_user;
  end if;
  get diagnostics affected_rows = row_count;

  if affected_rows > 0 then
    insert into public.forum_moderation_log
      (actor_id, action, target_type, target_user_id, reason)
    values (
      actor,
      case when p_enabled then 'beta_add' else 'beta_remove' end,
      'user',
      target_user,
      'closed beta membership'
    );
  end if;
  return exists (
    select 1 from public.forum_beta_members where user_id = target_user
  );
end;
$$;


ALTER FUNCTION "public"."forum_admin_set_beta_member"("p_username" "text", "p_enabled" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_admin_set_mode"("p_mode" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare actor uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_mode not in ('off', 'read_only', 'beta', 'open') then
    raise exception using errcode = '22023', message = 'invalid forum mode';
  end if;
  update public.forum_settings
  set mode = p_mode, updated_at = now(), updated_by = actor where id = true;
  insert into public.forum_moderation_log
    (actor_id, action, target_type, reason)
  values (actor, 'set_mode', 'forum', p_mode);
  return p_mode;
end;
$$;


ALTER FUNCTION "public"."forum_admin_set_mode"("p_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_admin_set_suspension"("p_user_id" "uuid", "p_suspended_until" timestamp with time zone, "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare actor uuid := auth.uid(); action_name text;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'not authorized'; end if;
  if p_suspended_until is null or p_suspended_until <= now() then
    delete from public.forum_suspensions where user_id = p_user_id;
    action_name := 'unsuspend';
  else
    insert into public.forum_suspensions (user_id, suspended_until, reason, created_by)
    values (p_user_id, p_suspended_until, p_reason, actor)
    on conflict (user_id) do update set
      suspended_until = excluded.suspended_until, reason = excluded.reason,
      created_by = excluded.created_by, created_at = now();
    action_name := 'suspend';
  end if;
  insert into public.forum_moderation_log
    (actor_id, action, target_type, target_user_id, reason)
  values (actor, action_name, 'user', p_user_id, p_reason);
end;
$$;


ALTER FUNCTION "public"."forum_admin_set_suspension"("p_user_id" "uuid", "p_suspended_until" timestamp with time zone, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_admin_set_suspension_by_username"("p_username" "text", "p_days" integer, "p_reason" "text") RETURNS TABLE("username" "text", "suspended_until" timestamp with time zone, "reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  candidate text := btrim(coalesce(p_username, ''));
  target_user uuid;
  target_is_admin boolean;
  cleaned_reason text := btrim(coalesce(p_reason, ''));
  until timestamptz;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  -- STRICT so a case-insensitive collision is refused rather than resolved
  -- arbitrarily. forum_profiles_username_ci_idx should make that impossible
  -- and the preflight refuses to install without it, but picking one of two
  -- students at random is the kind of failure that must never be silent.
  begin
    select p.id, p.is_admin into strict target_user, target_is_admin
    from public.profiles p
    where lower(btrim(p.username)) = lower(candidate)
      and public.forum_username_is_allowed(p.username);
  exception
    when no_data_found then
      raise exception using errcode = 'P0002', message = 'student username not found';
    when too_many_rows then
      raise exception using errcode = 'P0003',
        message = 'that username matches more than one profile; resolve the collision before suspending';
  end;

  -- Suspension only blocks forum contribution; it does not remove moderator
  -- rights, so creating or extending one cannot contain a compromised
  -- moderator. Lifting must remain possible, though: a student may have been
  -- suspended before being promoted, and this username wrapper is the only
  -- browser-safe path that can identify that account without exposing UUIDs.
  if target_is_admin and p_days is not null and p_days > 0 then
    raise exception using errcode = '42501',
      message = 'moderator accounts cannot be suspended here';
  end if;

  if p_days is null or p_days <= 0 then
    -- Passing a null deadline makes the reviewed RPC delete the row and log
    -- 'unsuspend'. The log reason is not null-checked there, but an empty
    -- audit entry is useless to the next moderator reading it.
    perform public.forum_admin_set_suspension(
      target_user, null, nullif(cleaned_reason, '')
    );
  else
    -- forum_suspensions requires a 3-to-500 character reason and a deadline
    -- after created_at. Both are enforced here so the caller gets a usable
    -- message instead of a raw constraint violation.
    if char_length(cleaned_reason) < 3 or char_length(cleaned_reason) > 500 then
      raise exception using errcode = '22023',
        message = 'a 3 to 500 character suspension reason is required';
    end if;
    if p_days > 365 then
      raise exception using errcode = '22023',
        message = 'suspensions are limited to 365 days';
    end if;
    until := now() + make_interval(days => p_days);
    perform public.forum_admin_set_suspension(target_user, until, cleaned_reason);
  end if;

  return query
  select p.username, s.suspended_until, s.reason
  from public.profiles p
  left join public.forum_suspensions s on s.user_id = p.id
  where p.id = target_user;
end;
$$;


ALTER FUNCTION "public"."forum_admin_set_suspension_by_username"("p_username" "text", "p_days" integer, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_anonymize_profile_content"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.forum_posts
  set title = '[deleted]', body = '', deleted_at = coalesce(deleted_at, now()),
      author_id = null, edited_at = null
  where author_id = old.id;
  update public.forum_comments
  set body = '', deleted_at = coalesce(deleted_at, now()),
      author_id = null, edited_at = null
  where author_id = old.id;
  return old;
end;
$$;


ALTER FUNCTION "public"."forum_anonymize_profile_content"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_apply_comment_count_delta"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.forum_posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.forum_posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."forum_apply_comment_count_delta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_apply_user_content_delta"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target_user uuid;
  delta integer := 0;
  is_post boolean := tg_table_name = 'forum_posts';
begin
  if tg_op = 'INSERT' then
    target_user := new.author_id;
    if new.deleted_at is null then delta := 1; end if;
  elsif tg_op = 'DELETE' then
    target_user := old.author_id;
    if old.deleted_at is null then delta := -1; end if;
  else
    target_user := coalesce(old.author_id, new.author_id);
    if old.deleted_at is null and new.deleted_at is not null then delta := -1;
    elsif old.deleted_at is not null and new.deleted_at is null then delta := 1;
    end if;
  end if;

  if target_user is not null and delta <> 0 then
    -- Seed a valid zero row first. An INSERT that proposes -1 violates the
    -- CHECK constraint before ON CONFLICT can repair it.
    insert into public.forum_user_stats (user_id)
    values (target_user)
    on conflict (user_id) do nothing;
    update public.forum_user_stats set
      post_count = greatest(post_count + case when is_post then delta else 0 end, 0),
      comment_count = greatest(comment_count + case when is_post then 0 else delta end, 0),
      updated_at = now()
    where user_id = target_user;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."forum_apply_user_content_delta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_apply_vote_delta"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  old_author uuid;
  new_author uuid;
  old_value integer := case when tg_op in ('UPDATE', 'DELETE') then old.value else 0 end;
  new_value integer := case when tg_op in ('INSERT', 'UPDATE') then new.value else 0 end;
  old_voter uuid := case when tg_op in ('UPDATE', 'DELETE') then old.voter_id else null end;
  new_voter uuid := case when tg_op in ('INSERT', 'UPDATE') then new.voter_id else null end;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_author := old.target_author_id;
    if old.post_id is not null then
      update public.forum_posts set
        upvote_count = greatest(upvote_count - case when old.value = 1 then 1 else 0 end, 0),
        downvote_count = greatest(downvote_count - case when old.value = -1 then 1 else 0 end, 0),
        score = score - old.value
      where id = old.post_id;
    else
      update public.forum_comments set
        upvote_count = greatest(upvote_count - case when old.value = 1 then 1 else 0 end, 0),
        downvote_count = greatest(downvote_count - case when old.value = -1 then 1 else 0 end, 0),
        score = score - old.value
      where id = old.comment_id;
    end if;
    if old_author is distinct from old_voter then
      perform public.forum_adjust_karma(old_author, -old_value);
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_author := new.target_author_id;
    if new.post_id is not null then
      update public.forum_posts set
        upvote_count = upvote_count + case when new.value = 1 then 1 else 0 end,
        downvote_count = downvote_count + case when new.value = -1 then 1 else 0 end,
        score = score + new.value
      where id = new.post_id;
    else
      update public.forum_comments set
        upvote_count = upvote_count + case when new.value = 1 then 1 else 0 end,
        downvote_count = downvote_count + case when new.value = -1 then 1 else 0 end,
        score = score + new.value
      where id = new.comment_id;
    end if;
    if new_author is distinct from new_voter then
      perform public.forum_adjust_karma(new_author, new_value);
    end if;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."forum_apply_vote_delta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_cast_vote"("p_target_type" "text", "p_target_id" bigint, "p_value" smallint) RETURNS TABLE("viewer_vote" smallint, "score" integer, "upvote_count" integer, "downvote_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := public.forum_require_writer(); existing smallint;
begin
  if p_target_type not in ('post', 'comment') or p_value not in (-1, 1) then
    raise exception using errcode = '22023', message = 'invalid vote';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'forum-vote:' || uid::text || ':' || p_target_type || ':' || p_target_id::text, 0
  ));
  perform public.forum_record_rate_event(uid, 'vote', p_target_id, 100, null);

  if p_target_type = 'post' then
    if not exists (select 1 from public.forum_posts where id = p_target_id and deleted_at is null and hidden_at is null) then
      raise exception using errcode = '22023', message = 'post is unavailable';
    end if;
    select v.value into existing from public.forum_votes v
      where v.voter_id = uid and v.post_id = p_target_id;
    if existing is null then
      insert into public.forum_votes (voter_id, post_id, value) values (uid, p_target_id, p_value);
    elsif existing = p_value then
      delete from public.forum_votes where voter_id = uid and post_id = p_target_id;
    else
      update public.forum_votes set value = p_value, updated_at = now()
      where voter_id = uid and post_id = p_target_id;
    end if;
    return query select coalesce(v.value, 0)::smallint, p.score, p.upvote_count, p.downvote_count
    from public.forum_posts p
    left join public.forum_votes v on v.post_id = p.id and v.voter_id = uid
    where p.id = p_target_id;
  else
    if not exists (
      select 1 from public.forum_comments c join public.forum_posts p on p.id = c.post_id
      where c.id = p_target_id and c.deleted_at is null and c.hidden_at is null
        and p.deleted_at is null and p.hidden_at is null
    ) then raise exception using errcode = '22023', message = 'comment is unavailable'; end if;
    select v.value into existing from public.forum_votes v
      where v.voter_id = uid and v.comment_id = p_target_id;
    if existing is null then
      insert into public.forum_votes (voter_id, comment_id, value) values (uid, p_target_id, p_value);
    elsif existing = p_value then
      delete from public.forum_votes where voter_id = uid and comment_id = p_target_id;
    else
      update public.forum_votes set value = p_value, updated_at = now()
      where voter_id = uid and comment_id = p_target_id;
    end if;
    return query select coalesce(v.value, 0)::smallint, c.score, c.upvote_count, c.downvote_count
    from public.forum_comments c
    left join public.forum_votes v on v.comment_id = c.id and v.voter_id = uid
    where c.id = p_target_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."forum_cast_vote"("p_target_type" "text", "p_target_id" bigint, "p_value" smallint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_claim_username"("p_username" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  uid uuid := auth.uid();
  candidate text := btrim(coalesce(p_username, ''));
  current_username text;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'sign in to choose a username';
  end if;
  if not exists (select 1 from auth.users u where u.id = uid) then
    raise exception using errcode = '42501', message = 'student account is missing';
  end if;
  if not public.forum_username_is_allowed(candidate) then
    raise exception using errcode = '22023',
      message = 'username must be 3 to 30 letters, numbers, underscores or hyphens and cannot be reserved';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('forum-username:' || lower(candidate), 0));
  if exists (
    select 1 from public.profiles p
    where lower(btrim(p.username)) = lower(candidate) and p.id <> uid
  ) then
    raise exception using errcode = '23505', message = 'username is already taken';
  end if;

  select p.username into current_username
  from public.profiles p where p.id = uid for update;
  if public.forum_username_is_allowed(current_username) then
    if lower(btrim(current_username)) = lower(candidate) then return current_username; end if;
    raise exception using errcode = '55000', message = 'username has already been claimed';
  end if;

  insert into public.profiles (id, username)
  values (uid, candidate)
  on conflict (id) do update set username = excluded.username;
  return candidate;
end;
$$;


ALTER FUNCTION "public"."forum_claim_username"("p_username" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_create_comment"("p_post_id" bigint, "p_parent_id" bigint, "p_body" "text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := public.forum_require_writer(); new_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('forum-comment:' || uid::text, 0));
  perform public.forum_record_rate_event(uid, 'comment', p_post_id, 30, null);
  if not exists (
    select 1 from public.forum_posts
    where id = p_post_id and deleted_at is null and hidden_at is null and locked_at is null
  ) then
    raise exception using errcode = '55000', message = 'post is unavailable or locked';
  end if;
  if exists (
    select 1 from public.forum_comments
    where author_id = uid and body = p_body
      and created_at >= now() - interval '1 hour'
  ) then
    raise exception using errcode = '23505', message = 'duplicate recent comment';
  end if;
  insert into public.forum_comments (post_id, parent_id, author_id, body)
  values (p_post_id, p_parent_id, uid, p_body)
  returning id into new_id;
  return new_id;
end;
$$;


ALTER FUNCTION "public"."forum_create_comment"("p_post_id" bigint, "p_parent_id" bigint, "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_create_post"("p_topic_slug" "text", "p_title" "text", "p_body" "text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  uid uuid := public.forum_require_writer();
  topic_id bigint;
  new_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('forum-post:' || uid::text, 0));
  perform public.forum_record_rate_event(uid, 'post', null, 5, 15);
  if exists (
    select 1 from public.forum_posts
    where author_id = uid and body = p_body
      and created_at >= now() - interval '1 hour'
  ) then
    raise exception using errcode = '23505', message = 'duplicate recent post';
  end if;
  if not exists (select 1 from public.forum_posts where author_id = uid)
     and (select count(*) from regexp_matches(p_body, 'https?://', 'gi')) > 2 then
    raise exception using errcode = '22023',
      message = 'a first post may contain at most two external links';
  end if;
  select t.id into topic_id from public.forum_topics t
  where t.slug = p_topic_slug and t.is_active;
  if topic_id is null then
    raise exception using errcode = '22023', message = 'unknown or inactive forum topic';
  end if;
  insert into public.forum_posts (topic_id, author_id, title, body)
  values (topic_id, uid, btrim(p_title), p_body)
  returning id into new_id;
  return new_id;
end;
$$;


ALTER FUNCTION "public"."forum_create_post"("p_topic_slug" "text", "p_title" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_delete_comment"("p_comment_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := public.forum_require_writer();
begin
  update public.forum_comments
  set body = '', deleted_at = now(), author_id = null, edited_at = null
  where id = p_comment_id and author_id = uid and deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'comment is unavailable or not yours';
  end if;
end;
$$;


ALTER FUNCTION "public"."forum_delete_comment"("p_comment_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_delete_post"("p_post_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := public.forum_require_writer();
begin
  update public.forum_posts
  set title = '[deleted]', body = '', deleted_at = now(), author_id = null,
      edited_at = null, is_solved = false
  where id = p_post_id and author_id = uid and deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'post is unavailable or not yours';
  end if;
end;
$$;


ALTER FUNCTION "public"."forum_delete_post"("p_post_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_edit_comment"("p_comment_id" bigint, "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := public.forum_require_writer();
begin
  perform pg_advisory_xact_lock(hashtextextended('forum-edit-comment:' || uid::text, 0));
  if (select count(*) from public.forum_rate_events e
      where e.user_id = uid and e.action = 'edit_comment' and e.target_id = p_comment_id
        and e.created_at >= now() - interval '1 hour') >= 10 then
    raise exception using errcode = 'P0001', message = 'edit limit is 10 per comment per hour';
  end if;
  update public.forum_comments
  set body = p_body, edited_at = now()
  where id = p_comment_id and author_id = uid
    and deleted_at is null and hidden_at is null
    and created_at >= now() - interval '30 minutes';
  if not found then
    raise exception using errcode = '42501',
      message = 'comment is unavailable or its 30-minute edit window has closed';
  end if;
  perform public.forum_record_rate_event(uid, 'edit_comment', p_comment_id, null, null);
end;
$$;


ALTER FUNCTION "public"."forum_edit_comment"("p_comment_id" bigint, "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_edit_post"("p_post_id" bigint, "p_title" "text", "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := public.forum_require_writer();
begin
  perform pg_advisory_xact_lock(hashtextextended('forum-edit-post:' || uid::text, 0));
  if (select count(*) from public.forum_rate_events e
      where e.user_id = uid and e.action = 'edit_post' and e.target_id = p_post_id
        and e.created_at >= now() - interval '1 hour') >= 10 then
    raise exception using errcode = 'P0001', message = 'edit limit is 10 per post per hour';
  end if;
  update public.forum_posts
  set title = btrim(p_title), body = p_body, edited_at = now()
  where id = p_post_id and author_id = uid
    and deleted_at is null and hidden_at is null
    and created_at >= now() - interval '30 minutes';
  if not found then
    raise exception using errcode = '42501',
      message = 'post is unavailable or its 30-minute edit window has closed';
  end if;
  perform public.forum_record_rate_event(uid, 'edit_post', p_post_id, null, null);
end;
$$;


ALTER FUNCTION "public"."forum_edit_post"("p_post_id" bigint, "p_title" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_get_my_identity"() RETURNS TABLE("username" "text", "needs_username" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  uid uuid := auth.uid();
  current_username text;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'sign in to continue';
  end if;
  select p.username into current_username
  from public.profiles p where p.id = uid;
  return query select
    case when public.forum_username_is_allowed(current_username)
      then current_username else null end,
    not public.forum_username_is_allowed(current_username);
end;
$$;


ALTER FUNCTION "public"."forum_get_my_identity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_hot_rank"("p_score" integer, "p_created_at" timestamp with time zone) RETURNS double precision
    LANGUAGE "sql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
  select round((
    (case when p_score > 0 then 1 when p_score < 0 then -1 else 0 end)
      * log(greatest(abs(p_score), 1))
    + (extract(epoch from p_created_at) - 1767225600.0) / 86400.0
  )::numeric, 7)::double precision;
$$;


ALTER FUNCTION "public"."forum_hot_rank"("p_score" integer, "p_created_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_is_beta_member"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    auth.uid() is not null and exists (
      select 1 from public.forum_beta_members m where m.user_id = auth.uid()
    ),
    false
  );
$$;


ALTER FUNCTION "public"."forum_is_beta_member"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_mode"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce((select mode from public.forum_settings where id = true), 'off');
$$;


ALTER FUNCTION "public"."forum_mode"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_prepare_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare parent_depth integer;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if new.parent_id is null then
      new.depth := 0;
    else
      select c.depth into parent_depth
      from public.forum_comments c
      where c.id = new.parent_id and c.post_id = new.post_id;
      if parent_depth is null then
        raise exception using errcode = '23503', message = 'parent comment is not in this post';
      end if;
      new.depth := parent_depth + 1;
      if new.depth > 10 then
        raise exception using errcode = '22023', message = 'maximum comment depth is 10';
      end if;
    end if;
  elsif new.parent_id is distinct from old.parent_id
     or new.post_id is distinct from old.post_id
     or new.depth is distinct from old.depth then
    raise exception using errcode = '42501', message = 'comment tree fields are immutable';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."forum_prepare_comment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_prepare_post"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at := now();
  new.hot_rank := public.forum_hot_rank(new.score, new.created_at);
  return new;
end;
$$;


ALTER FUNCTION "public"."forum_prepare_post"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_prepare_vote"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    if new.post_id is not null then
      select p.author_id into new.target_author_id
      from public.forum_posts p where p.id = new.post_id;
    else
      select c.author_id into new.target_author_id
      from public.forum_comments c where c.id = new.comment_id;
    end if;
    if new.target_author_id is null then
      raise exception using errcode = '22023', message = 'vote target has no active author';
    end if;
  elsif new.voter_id is distinct from old.voter_id
     or new.post_id is distinct from old.post_id
     or new.comment_id is distinct from old.comment_id
     or (
       new.target_author_id is distinct from old.target_author_id
       and not (old.target_author_id is not null and new.target_author_id is null)
     ) then
    raise exception using errcode = '42501', message = 'vote identity and target are immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."forum_prepare_vote"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_record_rate_event"("p_user_id" "uuid", "p_action" "text", "p_target_id" bigint, "p_hour_limit" integer, "p_day_limit" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if p_hour_limit is not null and (
    select count(*) from public.forum_rate_events e
    where e.user_id = p_user_id and e.action = p_action
      and e.created_at >= now() - interval '1 hour'
  ) >= p_hour_limit then
    raise exception using errcode = 'P0001',
      message = p_action || ' hourly rate limit exceeded';
  end if;
  if p_day_limit is not null and (
    select count(*) from public.forum_rate_events e
    where e.user_id = p_user_id and e.action = p_action
      and e.created_at >= now() - interval '1 day'
  ) >= p_day_limit then
    raise exception using errcode = 'P0001',
      message = p_action || ' daily rate limit exceeded';
  end if;
  insert into public.forum_rate_events (user_id, action, target_id)
  values (p_user_id, p_action, p_target_id);
end;
$$;


ALTER FUNCTION "public"."forum_record_rate_event"("p_user_id" "uuid", "p_action" "text", "p_target_id" bigint, "p_hour_limit" integer, "p_day_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_recount_karma"("p_apply" boolean DEFAULT false) RETURNS TABLE("user_id" "uuid", "stored_karma" integer, "actual_karma" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_apply then
    update public.forum_user_stats set karma = 0, updated_at = now();
    insert into public.forum_user_stats (user_id, karma)
    select totals.author_id, sum(totals.karma)::integer
    from (
      select v.target_author_id as author_id, coalesce(sum(v.value), 0)::integer as karma
      from public.forum_votes v
      where v.target_author_id is not null and v.target_author_id <> v.voter_id
      group by v.target_author_id
    ) totals
    group by totals.author_id
    on conflict (user_id) do update set
      karma = public.forum_user_stats.karma + excluded.karma,
      updated_at = now();
  end if;

  return query
  with actual_parts as (
    select v.target_author_id as author_id, sum(v.value)::integer as karma
    from public.forum_votes v
    where v.target_author_id is not null and v.target_author_id <> v.voter_id
    group by v.target_author_id
  ), actual as (
    select author_id, sum(karma)::integer as karma
    from actual_parts group by author_id
  )
  select coalesce(s.user_id, a.author_id), coalesce(s.karma, 0), coalesce(a.karma, 0)
  from public.forum_user_stats s full join actual a on a.author_id = s.user_id
  where coalesce(s.karma, 0) <> coalesce(a.karma, 0)
  order by coalesce(s.user_id, a.author_id);
end;
$$;


ALTER FUNCTION "public"."forum_recount_karma"("p_apply" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_recount_metrics"("p_apply" boolean DEFAULT false) RETURNS TABLE("target_type" "text", "target_id" bigint, "stored_score" integer, "actual_score" integer, "stored_upvotes" integer, "actual_upvotes" integer, "stored_downvotes" integer, "actual_downvotes" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_apply then
    update public.forum_posts p set
      upvote_count = x.ups, downvote_count = x.downs, score = x.ups - x.downs
    from (
      select p2.id,
        count(v.id) filter (where v.value = 1)::integer as ups,
        count(v.id) filter (where v.value = -1)::integer as downs
      from public.forum_posts p2 left join public.forum_votes v on v.post_id = p2.id
      group by p2.id
    ) x where p.id = x.id;
    update public.forum_comments c set
      upvote_count = x.ups, downvote_count = x.downs, score = x.ups - x.downs
    from (
      select c2.id,
        count(v.id) filter (where v.value = 1)::integer as ups,
        count(v.id) filter (where v.value = -1)::integer as downs
      from public.forum_comments c2 left join public.forum_votes v on v.comment_id = c2.id
      group by c2.id
    ) x where c.id = x.id;
  end if;
  return query
  with actual as (
    select 'post'::text as kind, p.id,
      p.score, p.upvote_count, p.downvote_count,
      count(v.id) filter (where v.value = 1)::integer as ups,
      count(v.id) filter (where v.value = -1)::integer as downs
    from public.forum_posts p left join public.forum_votes v on v.post_id = p.id group by p.id
    union all
    select 'comment', c.id, c.score, c.upvote_count, c.downvote_count,
      count(v.id) filter (where v.value = 1)::integer,
      count(v.id) filter (where v.value = -1)::integer
    from public.forum_comments c left join public.forum_votes v on v.comment_id = c.id group by c.id
  )
  select a.kind, a.id, a.score, a.ups - a.downs,
    a.upvote_count, a.ups, a.downvote_count, a.downs
  from actual a
  where a.score <> a.ups - a.downs
     or a.upvote_count <> a.ups or a.downvote_count <> a.downs
  order by a.kind, a.id;
end;
$$;


ALTER FUNCTION "public"."forum_recount_metrics"("p_apply" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_require_open"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if public.forum_mode() not in ('beta', 'open') then
    raise exception using errcode = '55000', message = 'forum is not open for contributions';
  end if;
end;
$$;


ALTER FUNCTION "public"."forum_require_open"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_require_reporter"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := auth.uid();
begin
  if public.forum_mode() = 'off' then
    raise exception using errcode = '55000', message = 'forum is unavailable';
  end if;
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception using errcode = '42501', message = 'sign in to report content';
  end if;
  return uid;
end;
$$;


ALTER FUNCTION "public"."forum_require_reporter"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_require_writer"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  uid uuid := auth.uid();
  profile_created timestamptz;
  handle text;
begin
  perform public.forum_require_open();
  if uid is null then
    raise exception using errcode = '42501', message = 'sign in to contribute';
  end if;
  if public.forum_mode() = 'beta' and not public.forum_is_beta_member() then
    raise exception using errcode = '42501', message = 'closed beta access is required';
  end if;
  select u.created_at, btrim(p.username) into profile_created, handle
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = uid;
  if profile_created is null then
    raise exception using errcode = '42501', message = 'student profile is missing';
  end if;
  if not public.forum_username_is_allowed(handle) then
    raise exception using errcode = '22023',
      message = 'choose a 3 to 30 character username before contributing';
  end if;
  if profile_created > now() - interval '10 minutes' then
    raise exception using errcode = 'P0001',
      message = 'new accounts can contribute after 10 minutes';
  end if;
  if exists (
    select 1 from public.forum_suspensions s
    where s.user_id = uid and s.suspended_until > now()
  ) then
    raise exception using errcode = '42501', message = 'forum posting is temporarily suspended';
  end if;
  return uid;
end;
$$;


ALTER FUNCTION "public"."forum_require_writer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_submit_report"("p_target_type" "text", "p_target_id" bigint, "p_reason" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := public.forum_require_reporter(); new_id bigint; report_count integer;
begin
  if p_target_type not in ('post', 'comment') or p_reason not in (
    'spam', 'abuse_or_bullying', 'personal_information', 'sexual_content',
    'self_harm', 'wrong_or_unsafe_advice', 'off_topic', 'other'
  ) then raise exception using errcode = '22023', message = 'invalid report'; end if;
  if char_length(coalesce(p_note, '')) > 1000 then
    raise exception using errcode = '22023', message = 'report note is limited to 1000 characters';
  end if;
  if (p_target_type = 'post' and not exists (
        select 1 from public.forum_posts where id = p_target_id and hidden_at is null
      )) or (p_target_type = 'comment' and not exists (
        select 1 from public.forum_comments where id = p_target_id and hidden_at is null
      )) then raise exception using errcode = '22023', message = 'report target is unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended('forum-report:' || uid::text, 0));
  perform public.forum_record_rate_event(uid, 'report', p_target_id, 10, null);
  insert into public.forum_reports
    (reporter_id, target_type, target_id, reason, note, priority)
  values
    (uid, p_target_type, p_target_id, p_reason, nullif(btrim(p_note), ''),
     case when p_reason = 'self_harm' then 'urgent' else 'normal' end)
  returning id into new_id;

  if p_reason <> 'self_harm' then
    select count(distinct reporter_id) into report_count
    from public.forum_reports
    where target_type = p_target_type and target_id = p_target_id
      and status = 'pending' and reason <> 'self_harm';
    if report_count >= 3 then
      if p_target_type = 'post' then
        update public.forum_posts set hidden_at = now(), hidden_reason = 'report threshold'
        where id = p_target_id and hidden_at is null;
      else
        update public.forum_comments set hidden_at = now(), hidden_reason = 'report threshold'
        where id = p_target_id and hidden_at is null;
      end if;
      if found then
        insert into public.forum_moderation_log
          (action, target_type, target_id, reason, report_id)
        values ('auto_hide', p_target_type, p_target_id, '3 distinct pending reporters', new_id);
      end if;
    end if;
  end if;
  return new_id;
end;
$$;


ALTER FUNCTION "public"."forum_submit_report"("p_target_type" "text", "p_target_id" bigint, "p_reason" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_toggle_solved"("p_post_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := public.forum_require_writer(); result boolean;
begin
  update public.forum_posts set is_solved = not is_solved
  where id = p_post_id and author_id = uid
    and deleted_at is null and hidden_at is null
  returning is_solved into result;
  if result is null then
    raise exception using errcode = '42501', message = 'post is unavailable or not yours';
  end if;
  return result;
end;
$$;


ALTER FUNCTION "public"."forum_toggle_solved"("p_post_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forum_username_is_allowed"("p_username" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
  select
    p_username = btrim(p_username)
    and btrim(coalesce(p_username, '')) ~ '^[A-Za-z0-9_-]{3,30}$'
    and lower(btrim(p_username)) !~
      '^(admin|administrator|mod|moderator|staff|support|official|system|root|automod)([-_]?[0-9]+)?$'
    and lower(btrim(p_username)) not in (
      'anonymous', 'deleted_student', 'deleted-student',
      'fuck', 'fucker', 'bitch', 'chutiya', 'madarchod', 'bhenchod'
    )
    and lower(btrim(p_username)) !~ '^jeeneetards?(help)?([-_].*)?$'
$_$;


ALTER FUNCTION "public"."forum_username_is_allowed"("p_username" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_browse_curriculum"("p_goal" "text" DEFAULT NULL::"text", "p_class" "text" DEFAULT NULL::"text", "p_subject" "text" DEFAULT NULL::"text") RETURNS TABLE("level" "text", "entity_id" bigint, "slug" "text", "name" "text", "display_order" integer, "course_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with rows as (
    select
      'goal'::text as level,
      lg.id as entity_id,
      lg.slug,
      lg.name,
      lg.display_order,
      count(distinct plg.playlist_id)::bigint as course_count
    from public.learning_goals lg
    left join public.playlist_learning_goals plg
      on plg.learning_goal_id = lg.id
    where p_goal is null and p_subject is null
    group by lg.id, lg.slug, lg.name, lg.display_order

    union all

    -- Subject availability remains course-scoped because no chapter has been
    -- selected yet.
    select
      'subject'::text,
      s.id,
      s.slug,
      s.name,
      s.display_order,
      count(distinct pl.id)::bigint
    from public.subjects s
    join public.playlists pl on pl.subject_id = s.id
    join public.playlist_learning_goals plg on plg.playlist_id = pl.id
    join public.learning_goals lg on lg.id = plg.learning_goal_id
    where p_goal is not null
      and p_subject is null
      and lg.slug = p_goal
      and (
        p_class is null or exists (
          select 1
          from public.playlist_class_levels pcl
          join public.class_levels cl on cl.id = pcl.class_level_id
          where pcl.playlist_id = pl.id
            and cl.slug = any(
              case
                when p_class = 'dropper' then array['dropper','class-11','class-12']::text[]
                else array[p_class]::text[]
              end
            )
        )
      )
    group by s.id, s.slug, s.name, s.display_order

    union all

    select
      'chapter'::text,
      ch.id,
      ch.slug,
      ch.name,
      ch.display_order,
      count(distinct pl.id)::bigint
    from public.chapters ch
    join public.subjects s on s.id = ch.subject_id
    join public.videos v on v.chapter_id = ch.id
    join public.playlist_videos pv on pv.video_id = v.id
    join public.playlists pl on pl.id = pv.playlist_id
    join public.playlist_learning_goals plg on plg.playlist_id = pl.id
    join public.learning_goals lg on lg.id = plg.learning_goal_id
    where p_goal is not null
      and p_subject is not null
      and lg.slug = p_goal
      and s.slug = p_subject
      and public.chapter_matches_class_scope(ch.id, pl.id, p_class)
    group by ch.id, ch.slug, ch.name, ch.display_order
  )
  select r.level, r.entity_id, r.slug, r.name, r.display_order, r.course_count
  from rows r
  order by r.display_order, r.name, r.entity_id;
$$;


ALTER FUNCTION "public"."get_browse_curriculum"("p_goal" "text", "p_class" "text", "p_subject" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_browse_curriculum"("p_goal" "text", "p_class" "text", "p_subject" "text") IS 'Bounded navigation using reviewed canonical chapter classes, with playlist fallback only for unreviewed chapters.';



CREATE OR REPLACE FUNCTION "public"."get_chapter_champions"("p_chapter" bigint) RETURNS TABLE("playlist_id" bigint, "title" "text", "teacher" "text", "institute" "text", "clarity_avg" numeric, "clarity_n" integer, "question_avg" numeric, "question_n" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  with chapter_playlists as (
    select distinct pv.playlist_id
    from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where p_chapter is not null and v.chapter_id = p_chapter
  ),
  dims as (
    -- avg() and count() both ignore NULLs, so a rating that skipped a
    -- dimension neither moves nor inflates that dimension's aggregate.
    select
      r.playlist_id,
      avg(r.clarity_rating)   as clarity_avg,
      count(r.clarity_rating)  as clarity_n,
      avg(r.question_rating)  as question_avg,
      count(r.question_rating) as question_n
    from public.playlist_ratings r
    join chapter_playlists cp on cp.playlist_id = r.playlist_id
    group by r.playlist_id
  )
  select
    d.playlist_id,
    p.title,
    p.teacher,
    ic.name as institute,
    -- The 5-vote floor is RATING_CONFIDENCE_MIN (src/ratingConfidence.js);
    -- below it the average is NULL so no client can show an unconfident score.
    case when d.clarity_n  >= 5 then round(d.clarity_avg,  2) end as clarity_avg,
    d.clarity_n::integer,
    case when d.question_n >= 5 then round(d.question_avg, 2) end as question_avg,
    d.question_n::integer
  from dims d
  join public.playlists p on p.id = d.playlist_id
  left join public.institutes_channels ic on ic.id = p.channel_id
  where d.clarity_n >= 5 or d.question_n >= 5
  order by d.playlist_id;
$$;


ALTER FUNCTION "public"."get_chapter_champions"("p_chapter" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_chapter_champions"("p_chapter" bigint) IS 'Per-course clarity/question rating aggregates for one chapter, confidence-gated at 5 votes per dimension (RATING_CONFIDENCE_MIN). Aggregates only: no user ids, no review text. Definer because anon''s column grant deliberately excludes the dimension columns.';



CREATE OR REPLACE FUNCTION "public"."get_chapter_courses"("p_chapter_id" bigint) RETURNS TABLE("playlist_id" bigint, "title" "text", "teacher" "text", "institute" "text", "lectures" bigint, "average_rating" numeric, "ratings_count" integer, "tags" "text"[], "class_levels" "text"[], "content_type" "text", "language" "text", "difficulty" "text", "total_duration_seconds" bigint)
    LANGUAGE "sql" STABLE
    AS $$
    select
        p.id,
        p.title,
        p.teacher,
        ic.name as institute,
        (select count(*) from public.playlist_videos pv2 where pv2.playlist_id = p.id) as lectures,
        p.average_rating,
        p.ratings_count,
        p.tags,
        p.class_levels,
        p.content_type,
        p.language,
        p.difficulty,
        (select coalesce(sum(v.duration_seconds), 0)
           from public.playlist_videos pv3
           join public.videos v on v.id = pv3.video_id
          where pv3.playlist_id = p.id) as total_duration_seconds
    from public.playlists p
    join public.institutes_channels ic on ic.id = p.channel_id
    where exists (
        select 1
        from public.playlist_videos pv
        join public.videos v on v.id = pv.video_id
        where pv.playlist_id = p.id
          and v.chapter_id = p_chapter_id
    )
    order by p.average_rating desc, p.ratings_count desc;
$$;


ALTER FUNCTION "public"."get_chapter_courses"("p_chapter_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_content_quality_queue"("p_ready" boolean DEFAULT false, "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS TABLE("playlist_id" bigint, "display_title" "text", "source_title" "text", "legacy_teacher" "text", "institute" "text", "subject" "text", "content_type" "text", "language" "text", "difficulty" "text", "title_review_status" "text", "faculty_credit_status" "text", "source_title_changed" boolean, "faculty" "jsonb", "missing_fields" "text"[], "quality_ready" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 200 or p_offset < 0 then
    raise exception 'invalid queue bounds';
  end if;

  return query
  select p.id, p.title, p.source_title, p.teacher, ic.name, s.name,
         p.content_type, p.language, p.difficulty,
         p.title_review_status, p.faculty_credit_status, p.source_title_changed,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'teacher_id', t.id, 'display_name', t.display_name,
             'verified', t.verified, 'position', pt.position
           ) order by pt.position)
           from public.playlist_teachers pt
           join public.teachers t on t.id = pt.teacher_id
           where pt.playlist_id = p.id
         ), '[]'::jsonb),
         q.missing,
         cardinality(q.missing) = 0
    from public.playlists p
    join public.institutes_channels ic on ic.id = p.channel_id
    left join public.subjects s on s.id = p.subject_id
    cross join lateral (select public.playlist_quality_missing(p.id) as missing) q
   where (cardinality(q.missing) = 0) = p_ready
   order by cardinality(q.missing) desc, p.id
   limit p_limit offset p_offset;
end; $$;


ALTER FUNCTION "public"."get_content_quality_queue"("p_ready" boolean, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_faculty_facets"("p_chapter_id" bigint DEFAULT NULL::bigint, "p_subject_id" bigint DEFAULT NULL::bigint, "p_goal_id" bigint DEFAULT NULL::bigint) RETURNS TABLE("teacher_id" bigint, "display_name" "text", "slug" "text", "verified" boolean, "institutes" "text", "course_count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
  select t.id, t.display_name, t.slug, t.verified,
         (select string_agg(ic.name, ', ' order by ic.name)
            from public.teacher_institutes ti
            join public.institutes_channels ic on ic.id = ti.institute_id
           where ti.teacher_id = t.id),
         count(distinct pl.id)
    from public.teachers t
    join public.playlist_teachers pt on pt.teacher_id = t.id
    join public.playlists pl         on pl.id = pt.playlist_id
   where (p_goal_id is null or exists (select 1 from public.playlist_learning_goals g
            where g.playlist_id = pl.id and g.learning_goal_id = p_goal_id))
     and (p_subject_id is null or pl.subject_id = p_subject_id)
     and (p_chapter_id is null or exists (select 1 from public.playlist_videos pv
            join public.videos v on v.id = pv.video_id
           where pv.playlist_id = pl.id and v.chapter_id = p_chapter_id))
   group by t.id, t.display_name, t.slug, t.verified
  having count(distinct pl.id) > 0
   order by count(distinct pl.id) desc, t.verified desc, t.display_name;
$$;


ALTER FUNCTION "public"."get_faculty_facets"("p_chapter_id" bigint, "p_subject_id" bigint, "p_goal_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_faculty_profile"("p_slug" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select case when t.id is null then null else jsonb_build_object(
    'id', t.id, 'display_name', t.display_name, 'slug', t.slug,
    'verified', t.verified, 'bio', t.bio, 'photo_url', t.photo_url,
    'aliases', coalesce((select jsonb_agg(jsonb_build_object(
                            'alias', a.alias, 'type', a.alias_type, 'status', a.status)
                          order by a.status desc, a.alias)
                           from public.teacher_aliases a
                          where a.teacher_id = t.id and a.status <> 'rejected'), '[]'::jsonb),
    'institutes', coalesce((select jsonb_agg(ic.name order by ic.name)
                              from public.teacher_institutes ti
                              join public.institutes_channels ic on ic.id = ti.institute_id
                             where ti.teacher_id = t.id), '[]'::jsonb),
    'course_count', (select count(*) from public.playlist_teachers pt where pt.teacher_id = t.id),
    'courses', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'playlist_id', pl.id, 'title', pl.title, 'subject', s.name, 'role', pt.role,
                 'average_rating', pl.average_rating, 'ratings_count', pl.ratings_count)
               order by pl.title)
          from public.playlist_teachers pt
          join public.playlists pl on pl.id = pt.playlist_id
          left join public.subjects s on s.id = pl.subject_id
         where pt.teacher_id = t.id), '[]'::jsonb)
  ) end
  from public.teachers t where t.slug = p_slug;
$$;


ALTER FUNCTION "public"."get_faculty_profile"("p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_faculty_review_groups"("p_status" "text" DEFAULT 'pending'::"text") RETURNS TABLE("normalized" "text", "kind" "text", "variants" "jsonb", "variant_count" integer, "total_occurrences" bigint, "candidates" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select * from public.get_proposal_groups(p_status);
end; $$;


ALTER FUNCTION "public"."get_faculty_review_groups"("p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_forum_comments"("p_post_id" bigint) RETURNS TABLE("id" bigint, "post_id" bigint, "parent_id" bigint, "depth" integer, "author_username" "text", "body" "text", "is_tombstone" boolean, "score" integer, "upvote_count" integer, "downvote_count" integer, "viewer_vote" smallint, "created_at" timestamp with time zone, "edited_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    c.id, c.post_id, c.parent_id, c.depth,
    case when c.deleted_at is not null or c.hidden_at is not null or c.author_id is null
      then 'Deleted student' else pr.username end,
    case when c.hidden_at is not null then '[removed by moderator]'
      when c.deleted_at is not null then '[deleted]' else c.body end,
    (c.deleted_at is not null or c.hidden_at is not null),
    c.score, c.upvote_count, c.downvote_count,
    coalesce(v.value, 0)::smallint, c.created_at, c.edited_at
  from public.forum_comments c
  join public.forum_posts p on p.id = c.post_id
  left join public.profiles pr on pr.id = c.author_id
  left join public.forum_votes v on v.comment_id = c.id and v.voter_id = auth.uid()
  where public.forum_mode() <> 'off'
    and c.post_id = p_post_id
    and p.hidden_at is null
  order by c.score desc, c.created_at, c.id;
$$;


ALTER FUNCTION "public"."get_forum_comments"("p_post_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_forum_feed"("p_sort" "text" DEFAULT 'hot'::"text", "p_topic_slug" "text" DEFAULT NULL::"text", "p_query" "text" DEFAULT NULL::"text", "p_cursor_hot" double precision DEFAULT NULL::double precision, "p_cursor_score" integer DEFAULT NULL::integer, "p_cursor_created_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_id" bigint DEFAULT NULL::bigint, "p_limit" integer DEFAULT 25) RETURNS TABLE("id" bigint, "topic_slug" "text", "topic_name" "text", "author_username" "text", "title" "text", "body_preview" "text", "is_solved" boolean, "score" integer, "upvote_count" integer, "downvote_count" integer, "comment_count" integer, "viewer_vote" smallint, "hot_rank" double precision, "created_at" timestamp with time zone, "edited_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  raw_query text := nullif(btrim(coalesce(p_query, '')), '');
  search_pattern text;
  effective_sort text := case
    when raw_query is not null then 'new'
    else lower(btrim(coalesce(p_sort, 'hot')))
  end;
  cursor_sql text;
  order_sql text;
  query_sql text;
begin
  if public.forum_mode() = 'off' then return; end if;
  if effective_sort not in ('hot', 'new', 'top') then
    raise exception using errcode = '22023', message = 'invalid forum sort';
  end if;
  if char_length(coalesce(p_query, '')) > 100 then
    raise exception using errcode = '22023', message = 'forum search is limited to 100 characters';
  end if;

  -- Treat LIKE metacharacters as ordinary student search text. chr(92) keeps
  -- the backslash handling independent of standard_conforming_strings.
  if raw_query is not null then
    search_pattern := '%' || replace(replace(replace(
      raw_query,
      chr(92), chr(92) || chr(92)
    ), '%', chr(92) || '%'), '_', chr(92) || '_') || '%';
  end if;

  -- Cursor contract: id is the presence marker. When present, created_at is
  -- always required, plus hot_rank for Hot or score for Top. Reject incomplete
  -- cursors explicitly instead of allowing SQL NULL comparison to return zero
  -- rows without an explanation.
  if p_cursor_id is not null then
    if p_cursor_created_at is null
       or (effective_sort = 'hot' and p_cursor_hot is null)
       or (effective_sort = 'top' and p_cursor_score is null) then
      raise exception using errcode = '22023',
        message = 'incomplete forum cursor for ' || effective_sort || ' sort';
    end if;
  end if;

  -- Concrete sort branches let PostgreSQL use the matching New/Top/Hot index.
  -- A CASE expression in ORDER BY made every branch look like a computed sort.
  if effective_sort = 'hot' then
    cursor_sql := ' and ($6::bigint is null or (p.hot_rank, p.created_at, p.id) < ($3::double precision, $5::timestamptz, $6::bigint))';
    order_sql := 'p.hot_rank desc, p.created_at desc, p.id desc';
  elsif effective_sort = 'top' then
    cursor_sql := ' and ($6::bigint is null or (p.score, p.created_at, p.id) < ($4::integer, $5::timestamptz, $6::bigint))';
    order_sql := 'p.score desc, p.created_at desc, p.id desc';
  else
    cursor_sql := ' and ($6::bigint is null or (p.created_at, p.id) < ($5::timestamptz, $6::bigint))';
    order_sql := 'p.created_at desc, p.id desc';
  end if;

  query_sql := $feed$
    select
      p.id, t.slug, t.name,
      case when p.author_id is null then 'Deleted student' else pr.username end,
      p.title,
      left(regexp_replace(p.body, '[#*_`~$>\\[\\]()]', ' ', 'g'), 360),
      p.is_solved, p.score, p.upvote_count, p.downvote_count, p.comment_count,
      coalesce(v.value, 0)::smallint, p.hot_rank, p.created_at, p.edited_at
    from public.forum_posts p
    join public.forum_topics t on t.id = p.topic_id
    left join public.profiles pr on pr.id = p.author_id
    left join public.forum_votes v
      on v.post_id = p.id and v.voter_id = auth.uid()
    where p.deleted_at is null
      and p.hidden_at is null
      and ($1::text is null or t.slug = $1::text)
      and (
        $2::text is null
        or p.title ilike $2::text escape E'\\'
        or p.body ilike $2::text escape E'\\'
      )
  $feed$ || cursor_sql || ' order by ' || order_sql ||
    ' limit least(greatest(coalesce($7::integer, 25), 1), 25)';

  return query execute query_sql
    using p_topic_slug, search_pattern, p_cursor_hot, p_cursor_score,
          p_cursor_created_at, p_cursor_id, p_limit;
end;
$_$;


ALTER FUNCTION "public"."get_forum_feed"("p_sort" "text", "p_topic_slug" "text", "p_query" "text", "p_cursor_hot" double precision, "p_cursor_score" integer, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" bigint, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_forum_post"("p_post_id" bigint) RETURNS TABLE("id" bigint, "topic_slug" "text", "topic_name" "text", "author_username" "text", "title" "text", "body" "text", "is_solved" boolean, "is_locked" boolean, "is_deleted" boolean, "score" integer, "upvote_count" integer, "downvote_count" integer, "comment_count" integer, "viewer_vote" smallint, "created_at" timestamp with time zone, "edited_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    p.id, t.slug, t.name,
    case when p.deleted_at is not null or p.author_id is null then 'Deleted student' else pr.username end,
    case when p.deleted_at is not null then '[deleted]' else p.title end,
    case when p.deleted_at is not null then '' else p.body end,
    p.is_solved, p.locked_at is not null, p.deleted_at is not null,
    p.score, p.upvote_count, p.downvote_count, p.comment_count,
    coalesce(v.value, 0)::smallint, p.created_at, p.edited_at
  from public.forum_posts p
  join public.forum_topics t on t.id = p.topic_id
  left join public.profiles pr on pr.id = p.author_id
  left join public.forum_votes v on v.post_id = p.id and v.voter_id = auth.uid()
  where public.forum_mode() <> 'off'
    and p.id = p_post_id
    and p.hidden_at is null;
$$;


ALTER FUNCTION "public"."get_forum_post"("p_post_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_forum_topics"() RETURNS TABLE("id" bigint, "slug" "text", "name" "text", "description" "text", "kind" "text", "display_order" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select t.id, t.slug, t.name, t.description, t.kind, t.display_order
  from public.forum_topics t
  where public.forum_mode() <> 'off' and t.is_active
  order by t.display_order, t.id;
$$;


ALTER FUNCTION "public"."get_forum_topics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_manage_playlists"("p_search" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("total_count" bigint, "playlist_id" bigint, "title" "text", "teacher" "text", "youtube_playlist_id" "text", "channel_id" bigint, "channel_name" "text", "category_id" bigint, "category_name" "text", "subject_id" bigint, "subject_name" "text", "content_type" "text", "language" "text", "difficulty" "text", "audience_focus" "text", "display_order" integer, "learning_goal_ids" bigint[], "class_level_ids" bigint[], "videos" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."get_manage_playlists"("p_search" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_poll_submissions"() RETURNS TABLE("id" bigint, "slug" "text", "question" "text", "status" "text", "review_note" "text", "created_at" timestamp with time zone, "reviewed_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select p.id, p.slug, p.question, p.status, p.review_note, p.created_at, p.reviewed_at
  from public.polls p
  where p.author_id = auth.uid() and auth.uid() is not null
  order by p.created_at desc
  limit 50;
$$;


ALTER FUNCTION "public"."get_my_poll_submissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_playlist_comparison"("p_playlist_ids" bigint[], "p_chapter_id" bigint, "p_learning_goal_id" bigint DEFAULT NULL::bigint) RETURNS TABLE("requested_order" integer, "playlist_id" bigint, "course_status" "text", "title" "text", "teacher" "text", "channel_title" "text", "subject_title" "text", "class_levels" "text"[], "language" "text", "content_type" "text", "difficulty" "text", "chapter_lecture_count" bigint, "chapter_duration_seconds" bigint, "pacing" "text", "theory_percentage" smallint, "prerequisites_level" "text", "completeness_status" "text", "best_for" "text", "metadata_verified_at" timestamp with time zone, "coverage_mapped_topics" bigint, "coverage_required_topics" bigint, "syllabus_coverage_pct" numeric, "average_rating" numeric, "ratings_count" integer, "last_verified_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_length int := coalesce(cardinality(p_playlist_ids), 0);
begin
  if v_length = 0 then
    raise exception 'playlist_ids must contain between 1 and 4 ids';
  end if;
  if v_length > 4 then
    raise exception 'at most 4 playlists may be compared';
  end if;
  if exists (
    select 1 from unnest(p_playlist_ids) as supplied(id)
    where supplied.id is null or supplied.id <= 0
  ) then
    raise exception 'playlist_ids must contain positive bigint ids';
  end if;
  if (
    select count(distinct supplied.id)
    from unnest(p_playlist_ids) as supplied(id)
  ) <> v_length then
    raise exception 'playlist_ids must not contain duplicates';
  end if;
  if p_chapter_id is null or p_chapter_id <= 0 or
     not exists (select 1 from public.chapters c where c.id = p_chapter_id) then
    raise exception 'a valid chapter_id is required';
  end if;
  if p_learning_goal_id is not null and not exists (
       select 1 from public.learning_goals lg where lg.id = p_learning_goal_id
     ) then
    raise exception 'unknown learning_goal_id %', p_learning_goal_id;
  end if;

  return query
  with requested as (
    select req.id, req.ordinality::int as ord
      from unnest(p_playlist_ids) with ordinality as req(id, ordinality)
  ),
  selected as (
    select
      r.ord,
      r.id as requested_id,
      p.*,
      ic.name as resolved_channel_title,
      s.name as resolved_subject_title,
      exists (
        select 1
          from public.playlist_videos pv
          join public.videos v on v.id = pv.video_id
         where pv.playlist_id = p.id
           and v.chapter_id = p_chapter_id
      ) as teaches_requested_chapter
    from requested r
    left join public.playlists p on p.id = r.id
    left join public.institutes_channels ic on ic.id = p.channel_id
    left join public.subjects s on s.id = p.subject_id
  )
  select
    sel.ord,
    sel.requested_id,
    case
      when sel.id is null then 'not-found'
      when not sel.teaches_requested_chapter then 'wrong-chapter'
      else 'ok'
    end,
    sel.title,
    sel.teacher,
    sel.resolved_channel_title,
    sel.resolved_subject_title,
    sel.class_levels,
    sel.language,
    sel.content_type,
    sel.difficulty,
    case when sel.id is null then null else chapter_stats.lecture_count end,
    case
      when chapter_stats.lecture_count > 0 and
           chapter_stats.known_duration_count = chapter_stats.lecture_count
        then chapter_stats.duration_seconds
      else null
    end,
    case when pa.review_status = 'verified' then pa.pacing end,
    case when pa.review_status = 'verified' then pa.theory_percentage end,
    case when pa.review_status = 'verified' then pa.prerequisites_level end,
    case when pa.review_status = 'verified' then pa.completeness_status end,
    case when pa.review_status = 'verified' then pa.best_for end,
    case when pa.review_status = 'verified' then pa.verified_at end,
    case
      when sel.id is null or p_learning_goal_id is null or coverage.required_topics = 0
        then null
      else coverage.mapped_topics
    end,
    case
      when sel.id is null or p_learning_goal_id is null or coverage.required_topics = 0
        then null
      else coverage.required_topics
    end,
    case
      when sel.id is null or p_learning_goal_id is null or coverage.required_topics = 0
        then null
      else round(coverage.mapped_topics::numeric * 100 / coverage.required_topics, 2)
    end,
    sel.average_rating,
    sel.ratings_count,
    sel.last_verified_at
  from selected sel
  left join public.playlist_attributes pa on pa.playlist_id = sel.id
  left join lateral (
    select
      count(*)::bigint as lecture_count,
      count(v.duration_seconds)::bigint as known_duration_count,
      sum(v.duration_seconds)::bigint as duration_seconds
    from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = sel.id
      and v.chapter_id = p_chapter_id
  ) chapter_stats on true
  left join lateral (
    select
      (
        select count(*)::bigint
        from public.learning_goal_topics lgt
        join public.topics t on t.id = lgt.topic_id
        where lgt.learning_goal_id = p_learning_goal_id
          and lgt.is_required
          and t.chapter_id = p_chapter_id
      ) as required_topics,
      (
        select count(distinct vt.topic_id)::bigint
        from public.playlist_videos pv
        join public.videos v on v.id = pv.video_id
        join public.video_topics vt on vt.video_id = v.id
        join public.topics t on t.id = vt.topic_id
        join public.learning_goal_topics lgt
          on lgt.topic_id = vt.topic_id
         and lgt.learning_goal_id = p_learning_goal_id
         and lgt.is_required
        where pv.playlist_id = sel.id
          and v.chapter_id = p_chapter_id
          and t.chapter_id = p_chapter_id
          and vt.review_status = 'verified'
      ) as mapped_topics
  ) coverage on true
  order by sel.ord;
end
$$;


ALTER FUNCTION "public"."get_playlist_comparison"("p_playlist_ids" bigint[], "p_chapter_id" bigint, "p_learning_goal_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_playlist_comparison"("p_playlist_ids" bigint[], "p_chapter_id" bigint, "p_learning_goal_id" bigint) IS 'Truthful ordered comparison: max 4 bigint playlist ids, required chapter scope, optional learning-goal coverage. Unknown metadata remains NULL.';



CREATE OR REPLACE FUNCTION "public"."get_poll"("p_slug" "text") RETURNS TABLE("id" bigint, "slug" "text", "question" "text", "detail" "text", "topic_slug" "text", "topic_name" "text", "author_username" "text", "status" "text", "published_at" timestamp with time zone, "closes_at" timestamp with time zone, "vote_count" integer, "comment_count" integer, "viewer_option_id" bigint, "results_visible" boolean, "can_vote" boolean, "options" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with viewer as (select auth.uid() as uid)
  select
    p.id,
    p.slug,
    p.question,
    p.detail,
    t.slug,
    t.name,
    pr.username,
    -- Effective status, as in get_polls_feed: an expired poll reads 'closed'.
    case when public.poll_is_effectively_closed(p.status, p.closes_at)
         then 'closed' else p.status end,
    p.published_at,
    p.closes_at,
    p.vote_count,
    p.comment_count,
    (select v.option_id from public.poll_votes v, viewer
     where v.poll_id = p.id and v.voter_id = viewer.uid),
    public.poll_results_visible(p.id, (select uid from viewer)),
    p.status = 'live'
      and (p.closes_at is null or p.closes_at > now())
      and public.poll_mode() = 'open',
    public.poll_options_json(p.id, (select uid from viewer))
  from public.polls p
  join public.forum_topics t on t.id = p.topic_id
  left join public.profiles pr on pr.id = p.author_id
  where p.slug = p_slug
    and public.poll_mode() <> 'off'
    and p.status in ('live', 'closed');
$$;


ALTER FUNCTION "public"."get_poll"("p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_poll_comments"("p_poll_id" bigint, "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" bigint, "author_username" "text", "body" "text", "created_at" timestamp with time zone, "edited_at" timestamp with time zone, "is_mine" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    c.id,
    pr.username,
    c.body,
    c.created_at,
    c.edited_at,
    c.author_id is not null and c.author_id = auth.uid()
  from public.poll_comments c
  join public.polls p on p.id = c.poll_id
  left join public.profiles pr on pr.id = c.author_id
  where c.poll_id = p_poll_id
    and not c.is_removed
    and public.poll_mode() <> 'off'
    and p.status in ('live', 'closed')
  order by c.created_at desc, c.id desc
  limit greatest(least(coalesce(p_limit, 100), 200), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;


ALTER FUNCTION "public"."get_poll_comments"("p_poll_id" bigint, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_poll_topics"() RETURNS TABLE("slug" "text", "name" "text", "kind" "text", "description" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select t.slug, t.name, t.kind, t.description
  from public.forum_topics t
  where t.is_active
  order by t.display_order, t.name;
$$;


ALTER FUNCTION "public"."get_poll_topics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_polls_feed"("p_sort" "text" DEFAULT 'new'::"text", "p_topic_slug" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" bigint, "slug" "text", "question" "text", "detail" "text", "topic_slug" "text", "topic_name" "text", "author_username" "text", "status" "text", "published_at" timestamp with time zone, "closes_at" timestamp with time zone, "vote_count" integer, "comment_count" integer, "viewer_option_id" bigint, "results_visible" boolean, "options" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with viewer as (select auth.uid() as uid),
  filtered as (
    select p.*
    from public.polls p
    join public.forum_topics t on t.id = p.topic_id
    where public.poll_mode() <> 'off'
      and p.status in ('live', 'closed')
      and (p_topic_slug is null or t.slug = p_topic_slug)
  )
  select
    f.id,
    f.slug,
    f.question,
    f.detail,
    t.slug,
    t.name,
    pr.username,
    -- The EFFECTIVE status, not the stored column: a poll whose closes_at has
    -- passed reads as 'closed' to every client, whether or not
    -- poll_admin_close_expired() has run yet.
    case when public.poll_is_effectively_closed(f.status, f.closes_at)
         then 'closed' else f.status end,
    f.published_at,
    f.closes_at,
    f.vote_count,
    f.comment_count,
    (select v.option_id from public.poll_votes v, viewer
     where v.poll_id = f.id and v.voter_id = viewer.uid),
    public.poll_results_visible(f.id, (select uid from viewer)),
    public.poll_options_json(f.id, (select uid from viewer))
  from filtered f
  join public.forum_topics t on t.id = f.topic_id
  left join public.profiles pr on pr.id = f.author_id
  order by
    case when p_sort = 'top' then f.vote_count end desc nulls last,
    case when p_sort = 'closing' then f.closes_at end asc nulls last,
    f.published_at desc,
    f.id desc
  limit greatest(least(coalesce(p_limit, 20), 50), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;


ALTER FUNCTION "public"."get_polls_feed"("p_sort" "text", "p_topic_slug" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_proposal_groups"("p_status" "text" DEFAULT 'pending'::"text") RETURNS TABLE("normalized" "text", "kind" "text", "variants" "jsonb", "variant_count" integer, "total_occurrences" bigint, "candidates" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select p.normalized,
         min(p.kind) as kind,
         jsonb_agg(jsonb_build_object('proposal_id', p.id, 'raw_teacher', p.raw_teacher,
                                      'occurrences', p.occurrences) order by p.raw_teacher),
         count(*)::int,
         sum(p.occurrences),
         coalesce((select jsonb_agg(jsonb_build_object('teacher_id', c.teacher_id,
                     'display_name', c.display_name, 'match_type', c.match_type,
                     'institutes', c.institutes, 'course_count', c.course_count))
                     from public.search_teachers_internal(min(p.raw_teacher), 5, true) c
                    where c.match_rank <= 2), '[]'::jsonb)
    from public.teacher_name_proposals p
   where p.status = coalesce(p_status, 'pending')
     and p.normalized is not null
   group by p.normalized
   order by sum(p.occurrences) desc;
$$;


ALTER FUNCTION "public"."get_proposal_groups"("p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_study_material_curriculum"("p_goal_slug" "text" DEFAULT NULL::"text", "p_board_slug" "text" DEFAULT NULL::"text", "p_class_slug" "text" DEFAULT NULL::"text", "p_subject_slug" "text" DEFAULT NULL::"text") RETURNS TABLE("level" "text", "entity_id" bigint, "slug" "text", "name" "text", "display_order" integer, "resource_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."get_study_material_curriculum"("p_goal_slug" "text", "p_board_slug" "text", "p_class_slug" "text", "p_subject_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_study_materials"("p_goal_slug" "text" DEFAULT NULL::"text", "p_board_slug" "text" DEFAULT NULL::"text", "p_class_slug" "text" DEFAULT NULL::"text", "p_subject_slug" "text" DEFAULT NULL::"text", "p_chapter_slug" "text" DEFAULT NULL::"text", "p_chapter_id" bigint DEFAULT NULL::bigint, "p_video_id" bigint DEFAULT NULL::bigint, "p_material_type" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 60, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" bigint, "title" "text", "description" "text", "material_type" "text", "source_name" "text", "source_url" "text", "preview_image_url" "text", "file_format" "text", "language" "text", "exam_year" integer, "page_count" integer, "is_downloadable" boolean, "rights_status" "text", "scopes" "jsonb", "total_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with matching as (
    select m.*
      from public.study_materials m
     where m.review_status = 'approved'
       and m.published_at <= now()
       and (p_material_type is null or m.material_type = p_material_type)
       and exists (
         select 1
           from public.study_material_scopes s
           left join public.learning_goals lg on lg.id = s.learning_goal_id
           left join public.boards b on b.id = s.board_id
           left join public.class_levels cl on cl.id = s.class_level_id
           left join public.subjects sub on sub.id = s.subject_id
           left join public.chapters ch on ch.id = s.chapter_id
          where s.material_id = m.id
            and (p_goal_slug is null or lg.slug = p_goal_slug)
            and (p_board_slug is null or b.slug = p_board_slug)
            and (p_class_slug is null or cl.slug = p_class_slug)
            and (p_subject_slug is null or sub.slug = p_subject_slug)
            and (p_chapter_slug is null or ch.slug = p_chapter_slug)
       )
       and (
         (p_chapter_id is null and p_video_id is null)
         or exists (
           select 1 from public.study_material_scopes chapter_scope
            where chapter_scope.material_id = m.id
              and chapter_scope.chapter_id = p_chapter_id
         )
         or exists (
           select 1 from public.study_material_videos mv
            where mv.material_id = m.id
              and mv.video_id = p_video_id
         )
       )
  ),
  projected as (
    select
      m.id,
      m.title,
      m.description,
      m.material_type,
      m.source_name,
      m.source_url,
      m.preview_image_url,
      m.file_format,
      m.language,
      m.exam_year,
      m.page_count,
      m.is_downloadable,
      m.rights_status,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'goal', lg.slug,
          'board', b.slug,
          'class', cl.slug,
          'subject', case when sub.id is null then null else jsonb_build_object('id', sub.id, 'slug', sub.slug, 'name', sub.name) end,
          'chapter', case when ch.id is null then null else jsonb_build_object('id', ch.id, 'slug', ch.slug, 'name', ch.name) end
        ) order by lg.display_order nulls last, b.display_order nulls last,
                   cl.display_order nulls last, sub.display_order nulls last,
                   ch.display_order nulls last)
          from public.study_material_scopes s
          left join public.learning_goals lg on lg.id = s.learning_goal_id
          left join public.boards b on b.id = s.board_id
          left join public.class_levels cl on cl.id = s.class_level_id
          left join public.subjects sub on sub.id = s.subject_id
          left join public.chapters ch on ch.id = s.chapter_id
         where s.material_id = m.id
      ), '[]'::jsonb) as scopes
    from matching m
  )
  select
    p.*,
    count(*) over() as total_count
  from projected p
  order by
    case p.material_type
      when 'short_notes' then 1
      when 'formula_sheet' then 2
      when 'full_notes' then 3
      when 'previous_year_paper' then 4
      else 5
    end,
    p.exam_year desc nulls last,
    p.title,
    p.id
  limit least(greatest(coalesce(p_limit, 60), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;


ALTER FUNCTION "public"."get_study_materials"("p_goal_slug" "text", "p_board_slug" "text", "p_class_slug" "text", "p_subject_slug" "text", "p_chapter_slug" "text", "p_chapter_id" bigint, "p_video_id" bigint, "p_material_type" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    insert into public.profiles (id, full_name, avatar_url)
    values (
        new.id,
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'avatar_url'
    );
    return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_playlist"("payload" "jsonb", "mode" "text" DEFAULT 'merge'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_valid jsonb; v_goal_id bigint; v_class_ids bigint[]; v_board_ids bigint[];
  v_channel_id bigint; v_playlist_id bigint;
  v_category_id bigint := nullif(payload->>'category_id','')::bigint;
  v_subject_id bigint := nullif(payload->>'subject_id','')::bigint;
  v_chapter_id bigint := nullif(payload->>'chapter_id','')::bigint;
  v_chapter_name text := nullif(payload->>'chapter_name','');
  v_video jsonb; v_video_id bigint; v_cid bigint; v_pos int := 0;
  v_added int := 0; v_reused int := 0; v_reused_pl boolean := false;
  v_inserted boolean := false; v_keep bigint[] := '{}';
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized to import' using errcode = '42501';
  end if;

  v_valid := public.validate_import_payload(payload, mode, true);
  v_goal_id := (v_valid->>'goal_id')::bigint;
  select array_agg(x::bigint) into v_class_ids from jsonb_array_elements_text(v_valid->'class_ids') x;
  select coalesce(array_agg(x::bigint),'{}') into v_board_ids from jsonb_array_elements_text(v_valid->'board_ids') x;

  -- Serialise imports of the SAME playlist so concurrency is deterministic.
  perform pg_advisory_xact_lock(hashtext(payload->>'youtube_playlist_id'));

  -- channel: race-safe upsert
  v_channel_id := nullif(payload->>'channel_id','')::bigint;
  if v_channel_id is not null then
    if not exists (select 1 from public.institutes_channels where id = v_channel_id) then
      raise exception 'invalid channel_id %', v_channel_id; end if;
  else
    if nullif(payload#>>'{channel,youtube_channel_id}','') is null then
      raise exception 'channel_id or channel.youtube_channel_id required'; end if;
    insert into public.institutes_channels (name, youtube_channel_id)
    values (payload#>>'{channel,name}', payload#>>'{channel,youtube_channel_id}')
    on conflict (youtube_channel_id) do update set name = public.institutes_channels.name
    returning id into v_channel_id;
  end if;

  -- chapter: resolve-or-create, race-safe, inside this transaction
  if v_chapter_id is null and v_chapter_name is not null then
    insert into public.chapters (name, slug, subject_id)
    values (v_chapter_name,
            regexp_replace(regexp_replace(lower(v_chapter_name),'[^a-z0-9]+','-','g'),'(^-+|-+$)','','g'),
            v_subject_id)
    on conflict (subject_id, name) do update set name = public.chapters.name
    returning id into v_chapter_id;
  end if;

  -- playlist: race-safe upsert on the partial unique index
  select id into v_playlist_id from public.playlists where youtube_playlist_id = payload->>'youtube_playlist_id';
  if v_playlist_id is null then
    insert into public.playlists (
        title, teacher, channel_id, category_id, subject_id,
        content_type, language, difficulty, audience_focus, youtube_playlist_id, last_verified_at)
    values (trim(payload->>'title'), nullif(payload->>'teacher',''), v_channel_id, v_category_id, v_subject_id,
        nullif(payload->>'content_type',''), nullif(payload->>'language',''),
        nullif(payload->>'difficulty',''), nullif(payload->>'audience_focus',''),
        payload->>'youtube_playlist_id', now())
    on conflict (youtube_playlist_id) where youtube_playlist_id is not null
      do update set last_verified_at = now()
    -- xmax = 0 means we truly INSERTed; non-zero means a concurrent transaction
    -- won the race and we took the DO UPDATE branch instead.
    returning id, (xmax = 0) into v_playlist_id, v_inserted;
    v_reused_pl := not v_inserted;
  else
    v_reused_pl := true;
  end if;

  if v_reused_pl then
    if mode = 'replace' then
      -- replace DOES re-home the playlist's channel (see docs §4).
      update public.playlists set
          title = trim(payload->>'title'), teacher = nullif(payload->>'teacher',''),
          channel_id = v_channel_id, category_id = v_category_id, subject_id = v_subject_id,
          content_type = nullif(payload->>'content_type',''),
          language = nullif(payload->>'language',''),
          difficulty = nullif(payload->>'difficulty',''),
          audience_focus = nullif(payload->>'audience_focus',''), last_verified_at = now()
       where id = v_playlist_id;
      delete from public.playlist_learning_goals where playlist_id = v_playlist_id;
      delete from public.playlist_class_levels   where playlist_id = v_playlist_id;
      delete from public.playlist_boards         where playlist_id = v_playlist_id;
    else
      update public.playlists set
          content_type   = coalesce(content_type,  nullif(payload->>'content_type','')),
          language       = coalesce(language,       nullif(payload->>'language','')),
          difficulty     = coalesce(difficulty,     nullif(payload->>'difficulty','')),
          audience_focus = coalesce(audience_focus, nullif(payload->>'audience_focus','')),
          last_verified_at = now()
       where id = v_playlist_id;
    end if;
  end if;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    values (v_playlist_id, v_goal_id) on conflict do nothing;
  foreach v_cid in array v_class_ids loop
    insert into public.playlist_class_levels (playlist_id, class_level_id)
      values (v_playlist_id, v_cid) on conflict do nothing;
  end loop;
  foreach v_cid in array v_board_ids loop
    insert into public.playlist_boards (playlist_id, board_id)
      values (v_playlist_id, v_cid) on conflict do nothing;
  end loop;

  for v_video in select * from jsonb_array_elements(payload->'videos') loop
    v_pos := v_pos + 1;
    select id into v_video_id from public.videos where youtube_video_id = v_video->>'youtube_video_id';
    if v_video_id is null then
      insert into public.videos (
          youtube_video_id, title, channel_id, category_id, subject_id, chapter_id,
          duration_seconds, caption_status, embedding_status, last_verified_at)
      values (v_video->>'youtube_video_id', trim(v_video->>'title'), v_channel_id,
          v_category_id, v_subject_id, v_chapter_id,
          nullif(v_video->>'duration_seconds','')::int,
          nullif(v_video->>'caption_status',''), nullif(v_video->>'embedding_status',''), now())
      on conflict (youtube_video_id) do update set last_verified_at = now()
      returning id, (xmax = 0) into v_video_id, v_inserted;
      -- review item 5: a concurrent transaction may have created this video
      -- between our SELECT and our INSERT. xmax tells us which branch ran, so
      -- the counters describe what actually happened rather than what we hoped.
      if v_inserted then v_added := v_added + 1; else v_reused := v_reused + 1; end if;
    else
      v_reused := v_reused + 1;
      update public.videos set
          duration_seconds = coalesce(nullif(v_video->>'duration_seconds','')::int, duration_seconds),
          caption_status   = coalesce(nullif(v_video->>'caption_status',''), caption_status),
          embedding_status = coalesce(nullif(v_video->>'embedding_status',''), embedding_status),
          last_verified_at = now()
       where id = v_video_id;
    end if;

    -- Video taxonomy stays ADDITIVE (never strips other playlists' meaning).
    -- Corrections go through set_video_taxonomy() / clear_video_taxonomy().
    insert into public.video_learning_goals (video_id, learning_goal_id)
      values (v_video_id, v_goal_id) on conflict do nothing;
    foreach v_cid in array v_class_ids loop
      insert into public.video_class_levels (video_id, class_level_id)
        values (v_video_id, v_cid) on conflict do nothing;
    end loop;

    insert into public.playlist_videos (playlist_id, video_id, position)
      values (v_playlist_id, v_video_id, v_pos)
      on conflict (playlist_id, video_id) do update set position = excluded.position;
    v_keep := v_keep || v_video_id;
  end loop;

  if mode = 'replace' then
    delete from public.playlist_videos where playlist_id = v_playlist_id and video_id <> all(v_keep);
  end if;

  return jsonb_build_object('playlist_id', v_playlist_id, 'mode', mode,
    'reused_playlist', v_reused_pl, 'videos_added', v_added,
    'videos_reused', v_reused, 'lessons', v_pos);
end; $_$;


ALTER FUNCTION "public"."import_playlist"("payload" "jsonb", "mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_playlist_with_chapters"("payload" "jsonb", "mode" "text" DEFAULT 'merge'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_request_id uuid := nullif(payload->>'request_id', '')::uuid;
  v_subject_id bigint := nullif(payload->>'subject_id', '')::bigint;
  v_source_playlist_id text := nullif(payload->>'youtube_playlist_id', '');
  v_manifest_sha256 text := nullif(payload->>'manifest_sha256', '');
  v_source_snapshot_sha256 text :=
    nullif(payload->>'source_snapshot_sha256', '');
  v_manifest_assignment_count int :=
    nullif(payload->>'manifest_assignment_count', '')::int;
  v_existing_audit public.playlist_import_audit%rowtype;
  v_video jsonb;
  v_video_id bigint;
  v_requested_chapter_id bigint;
  v_current_subject_id bigint;
  v_current_chapter_id bigint;
  v_before_videos jsonb;
  v_before_state jsonb;
  v_after_videos jsonb;
  v_after_state jsonb;
  v_current_state jsonb;
  v_result jsonb;
  v_playlist_id bigint;
  v_expected_reused int;
  v_chapter_count int;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized to import' using errcode = '42501';
  end if;
  if mode is distinct from 'merge' then
    raise exception 'mapped chapter import is create-only and requires merge mode';
  end if;
  if v_request_id is null then
    raise exception 'request_id is required for mapped chapter import';
  end if;

  -- Serialize retries before reading the audit row.
  perform pg_advisory_xact_lock(hashtextextended(v_request_id::text, 12));
  select *
  into v_existing_audit
  from public.playlist_import_audit
  where request_id = v_request_id;
  if found then
    if v_existing_audit.request_payload is distinct from payload then
      raise exception 'request_id was already used with a different payload';
    end if;
    perform pg_advisory_xact_lock(
      hashtext(v_existing_audit.youtube_playlist_id)
    );
    for v_video in
      select item
      from jsonb_array_elements(
        v_existing_audit.request_payload->'videos'
      ) e(item)
      order by item->>'youtube_video_id'
    loop
      perform pg_advisory_xact_lock(
        hashtextextended(v_video->>'youtube_video_id', 12)
      );
    end loop;
    perform p.id
    from public.playlists p
    where p.id = v_existing_audit.playlist_id
    for update of p;
    perform v.id
    from jsonb_array_elements(
      v_existing_audit.request_payload->'videos'
    ) e(item)
    join public.videos v
      on v.youtube_video_id = item->>'youtube_video_id'
    order by v.id
    for update of v;
    select coalesce(
      jsonb_agg(
        public.per_video_chapter_import_video_snapshot(v.id)
        order by v.id
      ),
      '[]'::jsonb
    )
    into v_after_videos
    from jsonb_array_elements(v_existing_audit.request_payload->'videos') e(item)
    join public.videos v
      on v.youtube_video_id = item->>'youtube_video_id';
    v_current_state := jsonb_build_object(
      'playlist',
        public.per_video_chapter_import_snapshot(v_existing_audit.playlist_id),
      'videos',
        v_after_videos
    );
    if v_current_state is distinct from v_existing_audit.after_state then
      raise exception
        'imported catalogue state has drifted; idempotent replay refused';
    end if;
    return v_existing_audit.result
      || jsonb_build_object('idempotent_replay', true);
  end if;

  -- Reuse the hardened legacy validator before any write. Child chapter_ids
  -- are additional v12 fields and are validated below.
  perform public.validate_import_payload(payload - 'request_id', mode, true);

  if v_manifest_sha256 is null
     or v_manifest_sha256 !~ '^[0-9a-f]{64}$'
     or v_source_snapshot_sha256 is null
     or v_source_snapshot_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception
      'manifest_sha256 and source_snapshot_sha256 must be lowercase SHA-256 values';
  end if;
  if v_manifest_assignment_count is distinct from
     jsonb_array_length(payload->'videos') then
    raise exception
      'manifest_assignment_count must equal the mapped video count';
  end if;

  if nullif(payload->>'chapter_id', '') is not null
     or nullif(payload->>'chapter_name', '') is not null then
    raise exception
      'mapped chapter import forbids top-level chapter_id/chapter_name';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(payload->'videos') e(item)
    where jsonb_typeof(item->'chapter_id') is distinct from 'number'
       or (item->'chapter_id' #>> '{}') !~ '^[1-9][0-9]{0,17}$'
  ) then
    raise exception
      'every mapped video requires a positive whole-number chapter_id';
  end if;

  select count(distinct (item->>'chapter_id')::bigint)
  into v_chapter_count
  from jsonb_array_elements(payload->'videos') e(item);
  if v_chapter_count < 2 then
    raise exception
      'mapped chapter import requires at least two distinct chapters';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(payload->'videos') e(item)
    left join public.chapters c
      on c.id = (item->>'chapter_id')::bigint
    where c.id is null or c.subject_id is distinct from v_subject_id
  ) then
    raise exception
      'every mapped chapter must exist and belong to payload.subject_id';
  end if;

  -- Match the base importer's lock order before taking video row locks. This
  -- serializes source identity with legacy imports and avoids playlist/video
  -- lock inversion.
  perform pg_advisory_xact_lock(hashtext(v_source_playlist_id));

  -- The same source cannot become two courses. A retry is handled exclusively
  -- by request_id above; any other existing course is an editorial conflict.
  if exists (
    select 1
    from public.playlists
    where youtube_playlist_id = v_source_playlist_id
  ) then
    raise exception
      'source playlist already exists; mapped v12 import is create-only';
  end if;

  -- Different mapped imports can share a video. Lock all source IDs in stable
  -- order, then require any existing row to agree exactly. NULL is not treated
  -- as agreement: taxonomy correction remains a separate reviewed operation.
  for v_video in
    select item
    from jsonb_array_elements(payload->'videos') e(item)
    order by item->>'youtube_video_id'
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(v_video->>'youtube_video_id', 12)
    );
  end loop;

  -- Management RPCs use row locks rather than the advisory video locks above.
  -- Lock existing rows in stable order before conflict checks and snapshots so
  -- the recorded before_state cannot race a catalog edit.
  perform v.id
  from jsonb_array_elements(payload->'videos') e(item)
  join public.videos v
    on v.youtube_video_id = item->>'youtube_video_id'
  order by v.id
  for update of v;

  if exists (
    select 1
    from jsonb_array_elements(payload->'videos') e(item)
    join public.videos v
      on v.youtube_video_id = item->>'youtube_video_id'
    where v.subject_id is distinct from v_subject_id
       or v.chapter_id is distinct from (item->>'chapter_id')::bigint
  ) then
    raise exception
      'a reused video conflicts with the reviewed subject/chapter mapping';
  end if;

  select coalesce(
    jsonb_agg(
      public.per_video_chapter_import_video_snapshot(v.id)
      order by v.id
    ),
    '[]'::jsonb
  )
  into v_before_videos
  from jsonb_array_elements(payload->'videos') e(item)
  join public.videos v
    on v.youtube_video_id = item->>'youtube_video_id';

  v_expected_reused := jsonb_array_length(v_before_videos);
  v_before_state := jsonb_build_object(
    'playlist', null,
    'videos', v_before_videos
  );

  -- The base importer remains the single implementation for playlist,
  -- membership, goal, class, board, and metadata writes. Removing the
  -- top-level chapter makes new videos temporarily unclassified only inside
  -- this transaction; no other session can observe that intermediate state.
  v_result := public.import_playlist(
    payload - 'request_id' - 'chapter_id' - 'chapter_name',
    mode
  );
  if coalesce((v_result->>'reused_playlist')::boolean, false) then
    raise exception 'source playlist was created concurrently';
  end if;
  if (v_result->>'videos_reused')::int <> v_expected_reused then
    raise exception 'video reuse changed concurrently; retry from a fresh dry-run';
  end if;

  v_playlist_id := (v_result->>'playlist_id')::bigint;
  for v_video in
    select item
    from jsonb_array_elements(payload->'videos') e(item)
    order by item->>'youtube_video_id'
  loop
    v_requested_chapter_id := (v_video->>'chapter_id')::bigint;
    select v.id, v.subject_id, v.chapter_id
    into v_video_id, v_current_subject_id, v_current_chapter_id
    from public.videos v
    where v.youtube_video_id = v_video->>'youtube_video_id'
    for update;

    if not found then
      raise exception 'base import omitted video %',
        v_video->>'youtube_video_id';
    end if;
    if v_current_subject_id is distinct from v_subject_id then
      raise exception 'video subject changed concurrently';
    end if;
    if v_current_chapter_id is not null
       and v_current_chapter_id is distinct from v_requested_chapter_id then
      raise exception 'video chapter changed concurrently';
    end if;
    if v_current_chapter_id is null then
      update public.videos
      set chapter_id = v_requested_chapter_id
      where id = v_video_id;
    end if;
  end loop;

  select coalesce(
    jsonb_agg(
      public.per_video_chapter_import_video_snapshot(v.id)
      order by v.id
    ),
    '[]'::jsonb
  )
  into v_after_videos
  from jsonb_array_elements(payload->'videos') e(item)
  join public.videos v
    on v.youtube_video_id = item->>'youtube_video_id';

  v_after_state := jsonb_build_object(
    'playlist', public.per_video_chapter_import_snapshot(v_playlist_id),
    'videos', v_after_videos
  );
  v_result := v_result || jsonb_build_object(
    'request_id', v_request_id,
    'chapter_count', v_chapter_count,
    'chapter_assignments', jsonb_array_length(payload->'videos'),
    'idempotent_replay', false
  );

  insert into public.playlist_import_audit (
    request_id,
    youtube_playlist_id,
    playlist_id,
    request_payload,
    before_state,
    after_state,
    result,
    actor_id
  ) values (
    v_request_id,
    v_source_playlist_id,
    v_playlist_id,
    payload,
    v_before_state,
    v_after_state,
    v_result,
    auth.uid()
  );

  return v_result;
end;
$_$;


ALTER FUNCTION "public"."import_playlist_with_chapters"("payload" "jsonb", "mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_playlist_with_quality"("payload" "jsonb", "mode" "text" DEFAULT 'merge'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_source text; v_result jsonb; v_playlist_id bigint; v_old_source text;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized to import' using errcode = '42501';
  end if;
  v_source := btrim(coalesce(payload->>'source_title',''));
  if v_source = '' or char_length(v_source) > 500 then
    raise exception 'source_title is required and must be at most 500 characters';
  end if;

  v_result := public.import_playlist(payload - 'source_title', mode);
  v_playlist_id := (v_result->>'playlist_id')::bigint;
  select source_title into v_old_source from public.playlists where id = v_playlist_id for update;
  update public.playlists
     set source_title = v_source,
         source_title_changed = v_old_source is not null and v_old_source is distinct from v_source
   where id = v_playlist_id;
  return v_result || jsonb_build_object('source_title_captured', true);
end; $$;


ALTER FUNCTION "public"."import_playlist_with_quality"("payload" "jsonb", "mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_playlist_with_teachers"("payload" "jsonb", "mode" "text" DEFAULT 'merge'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_ids bigint[]; v_result jsonb; v_playlist_id bigint; v_source text; v_old_source text;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized to import' using errcode = '42501';
  end if;
  v_ids := public.validate_teacher_ids_payload(payload);
  v_source := nullif(btrim(coalesce(payload->>'source_title','')), '');
  if v_source is not null and char_length(v_source) > 500 then
    raise exception 'source_title must be at most 500 characters';
  end if;

  v_result := public.import_playlist(payload - 'teacher_ids' - 'source_title', mode);
  v_playlist_id := (v_result->>'playlist_id')::bigint;
  perform public.set_playlist_teachers(v_playlist_id, v_ids);
  update public.playlists
     set faculty_credit_status = case when cardinality(v_ids) > 0 then 'identified' else 'pending' end
   where id = v_playlist_id;
  if v_source is not null then
    select source_title into v_old_source from public.playlists where id = v_playlist_id for update;
    update public.playlists
       set source_title = v_source,
           source_title_changed = v_old_source is not null and v_old_source is distinct from v_source
     where id = v_playlist_id;
  end if;
  return v_result || jsonb_build_object(
    'teachers', cardinality(v_ids), 'teacher_links_replaced', true,
    'source_title_captured', v_source is not null);
end; $$;


ALTER FUNCTION "public"."import_playlist_with_teachers"("payload" "jsonb", "mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select coalesce(
        (select p.is_admin from public.profiles p where p.id = auth.uid()),
        false
    );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_proposal_decision"("p_proposal_id" bigint, "p_raw" "text", "p_decision" "text", "p_teacher_ids" bigint[], "p_note" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  insert into public.teacher_proposal_decisions
         (proposal_id, raw_teacher, decision, teacher_ids, note, decided_by)
  values (p_proposal_id, p_raw, p_decision, p_teacher_ids, p_note, auth.uid());
$$;


ALTER FUNCTION "public"."log_proposal_decision"("p_proposal_id" bigint, "p_raw" "text", "p_decision" "text", "p_teacher_ids" bigint[], "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."looks_like_multiple_people"("p_name" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(p_name, '') ~* '[&+/]|(\y(and|aur|evam|with)\y)|,';
$$;


ALTER FUNCTION "public"."looks_like_multiple_people"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."looks_like_organization"("p_name" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(p_name, '') ~* '\y(team|department|dept|faculty|faculties|teachers|staff|various|multiple|panel|group|institute|academy|classes)\y';
$$;


ALTER FUNCTION "public"."looks_like_organization"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_class_levels"("p_enable_triggers" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_bad_labels text; v_conflicts text; v_n_conflict int;
  v_backfilled int := 0; v_drift int; r record; v_cid bigint;
  v_run uuid := gen_random_uuid();
  v_counts jsonb;
begin
  -- This function is invoked two ways: from the SQL Editor as part of the
  -- migration, and over PostgREST by the test suite. In the SQL Editor there
  -- is no JWT, so auth.uid()/auth.role() are both NULL and the service_role
  -- check alone would reject the migration outright.
  --
  -- session_user, NOT current_user: inside a SECURITY DEFINER function
  -- current_user is always the function owner (postgres), which would make the
  -- check vacuously true for every caller. session_user stays the role that
  -- actually connected — 'postgres' in the SQL Editor, 'authenticator' for
  -- PostgREST — so this cannot be reached through the API.
  if not (public.is_admin()
          or auth.role() = 'service_role'
          or session_user in ('postgres', 'supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;

  -- 1. unknown labels abort
  select string_agg(format('playlist %s: %s', p.id, p.class_levels), '; ')
    into v_bad_labels
    from public.playlists p
   where exists (select 1 from unnest(coalesce(p.class_levels,'{}')) l
                 where public.class_label_to_slug(l) is null);
  if v_bad_labels is not null then
    raise exception 'ABORT: unknown class label(s): %', v_bad_labels; end if;

  -- 2. ambiguous conflicts abort
  select count(*), string_agg(format('playlist %s: array=%s junction=%s', id, a, j), '; ')
    into v_n_conflict, v_conflicts
    from (
      select p.id,
             (select array_agg(distinct x order by x) from unnest(coalesce(p.class_levels,'{}')) x) as a,
             (select array_agg(distinct x order by x) from unnest(public.derived_class_levels(p.id)) x) as j
        from public.playlists p
    ) s
   where coalesce(array_length(a,1),0) > 0
     and coalesce(array_length(j,1),0) > 0
     and a is distinct from j;
  if coalesce(v_n_conflict,0) > 0 then
    raise exception 'ABORT: % playlist(s) disagree between array and junction: %', v_n_conflict, v_conflicts; end if;

  -- 3. audit + backfill. Prior runs are PRESERVED (review item 7).
  for r in
    select p.id,
           (select array_agg(distinct x order by x) from unnest(coalesce(p.class_levels,'{}')) x) as a,
           (select array_agg(distinct x order by x) from unnest(public.derived_class_levels(p.id)) x) as j
      from public.playlists p
  loop
    if coalesce(array_length(r.a,1),0) = 0 and coalesce(array_length(r.j,1),0) = 0 then
      insert into public.class_levels_migration_audit (run_id, playlist_id, verdict, array_labels, junction_labels)
        values (v_run, r.id, 'both-empty', r.a, r.j);
    elsif coalesce(array_length(r.j,1),0) = 0 then
      for v_cid in
        select cl.id from unnest(r.a) x
          join public.class_levels cl on cl.slug = public.class_label_to_slug(x)
      loop
        insert into public.playlist_class_levels (playlist_id, class_level_id)
          values (r.id, v_cid) on conflict do nothing;
      end loop;
      v_backfilled := v_backfilled + 1;
      insert into public.class_levels_migration_audit (run_id, playlist_id, verdict, array_labels, junction_labels)
        values (v_run, r.id, 'array-only', r.a, r.j);
    elsif coalesce(array_length(r.a,1),0) = 0 then
      insert into public.class_levels_migration_audit (run_id, playlist_id, verdict, array_labels, junction_labels)
        values (v_run, r.id, 'junction-only', r.a, r.j);
    else
      insert into public.class_levels_migration_audit (run_id, playlist_id, verdict, array_labels, junction_labels)
        values (v_run, r.id, 'agree', r.a, r.j);
    end if;
  end loop;

  update public.playlists p
     set class_levels = public.derived_class_levels(p.id)
   where coalesce(array_length(p.class_levels,1),0) = 0
     and coalesce(array_length(public.derived_class_levels(p.id),1),0) > 0;

  -- 4. verify zero drift before enabling anything
  select count(*) into v_drift
    from public.playlists p
   where (select array_agg(distinct x order by x) from unnest(coalesce(p.class_levels,'{}')) x)
         is distinct from
         (select array_agg(distinct x order by x) from unnest(public.derived_class_levels(p.id)) x);
  if v_drift > 0 then
    raise exception 'ABORT: % playlist(s) still drift after backfill. No triggers were enabled.', v_drift; end if;

  -- 5. only now is it safe to make the array derived
  if p_enable_triggers then
    execute $ddl$
      create or replace function public.force_derived_class_levels()
      returns trigger language plpgsql security definer set search_path = '' as $fn$
      begin
        new.class_levels := public.derived_class_levels(new.id);
        return new;
      end; $fn$;
    $ddl$;
    execute $ddl$
      create or replace function public.sync_playlist_class_levels_array()
      returns trigger language plpgsql security definer set search_path = '' as $fn$
      declare v_pid bigint := coalesce(new.playlist_id, old.playlist_id);
      begin
        update public.playlists set class_levels = public.derived_class_levels(v_pid) where id = v_pid;
        return null;
      end; $fn$;
    $ddl$;
    execute 'drop trigger if exists trg_force_class_levels on public.playlists';
    execute 'create trigger trg_force_class_levels before insert or update on public.playlists
               for each row execute function public.force_derived_class_levels()';
    execute 'drop trigger if exists trg_sync_pl_class_array on public.playlist_class_levels';
    execute 'create trigger trg_sync_pl_class_array after insert or delete on public.playlist_class_levels
               for each row execute function public.sync_playlist_class_levels_array()';
  end if;

  select jsonb_object_agg(verdict, n) into v_counts
    from (select verdict, count(*) n from public.class_levels_migration_audit
           where run_id = v_run group by verdict) s;

  return jsonb_build_object('run_id', v_run, 'backfilled', v_backfilled,
    'drift_after', v_drift, 'triggers_enabled', p_enable_triggers, 'verdicts', v_counts);
end; $_$;


ALTER FUNCTION "public"."migrate_class_levels"("p_enable_triggers" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_person_name"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  -- UNICODE-SAFE. Do not remove "non-alphanumeric" characters here:
  -- PostgreSQL recognises Devanagari base letters as [:alnum:] but not their
  -- combining vowel marks. Replacing punctuation and whitespace preserves
  -- complete Indic-script words instead of breaking them into consonants.
  -- Original-script names and their
  -- transliterations are kept as SEPARATE reviewed aliases (alias_type
  -- 'transliteration'), never folded into one another.
  select nullif(
    trim(
      regexp_replace(                                     -- 4. collapse whitespace
        regexp_replace(                                   -- 3. strip honorifics (Latin only)
          regexp_replace(                                 -- 2. punctuation/whitespace -> space
            regexp_replace(                               -- 1. drop apostrophes
              lower(coalesce(p_name, '')), '[''’`´]', '', 'g'),
            '[[:punct:][:space:]]+', ' ', 'g'),
          '\y(sir|maam|mam|madam|mister|mr|mrs|ms|miss|dr|doctor|prof|professor|ji|bhaiya|bhaiyya|guruji)\y',
          ' ', 'g'),
        '\s+', ' ', 'g')
    ), '');
$$;


ALTER FUNCTION "public"."normalize_person_name"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_search_text"("p_text" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select nullif(
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(coalesce(p_text, '')), '[''’`´]', '', 'g'),
          '[[:punct:][:space:]]+', ' ', 'g'),
        '\s+', ' ', 'g')
    ), '');
$$;


ALTER FUNCTION "public"."normalize_search_text"("p_text" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."normalize_search_text"("p_text" "text") IS 'Case/punctuation-insensitive comparison key for non-person text. Unicode-safe.';



CREATE OR REPLACE FUNCTION "public"."per_video_chapter_import_capability"() RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object(
    'version', 12,
    'per_video_chapter_id', true,
    'all_or_none_mapping', true,
    'create_only', true,
    'request_replay', true,
    'audit_snapshot', true,
    'rollback_rpc', false
  );
$$;


ALTER FUNCTION "public"."per_video_chapter_import_capability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."per_video_chapter_import_snapshot"("p_playlist_id" bigint) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  -- Capture only state owned by the import contract. Community ratings,
  -- popularity counters, verification timestamps, and editorial-review fields
  -- may change independently and must not turn a valid retry into false drift.
  select jsonb_build_object(
    'id', p.id,
    'youtube_playlist_id', p.youtube_playlist_id,
    'title', p.title,
    'teacher', p.teacher,
    'channel_id', p.channel_id,
    'category_id', p.category_id,
    'subject_id', p.subject_id,
    'content_type', p.content_type,
    'language', p.language,
    'difficulty', p.difficulty,
    'audience_focus', p.audience_focus,
    'learning_goal_ids',
      coalesce((
        select jsonb_agg(plg.learning_goal_id order by plg.learning_goal_id)
        from public.playlist_learning_goals plg
        where plg.playlist_id = p.id
      ), '[]'::jsonb),
    'class_level_ids',
      coalesce((
        select jsonb_agg(pcl.class_level_id order by pcl.class_level_id)
        from public.playlist_class_levels pcl
        where pcl.playlist_id = p.id
      ), '[]'::jsonb),
    'board_ids',
      coalesce((
        select jsonb_agg(pb.board_id order by pb.board_id)
        from public.playlist_boards pb
        where pb.playlist_id = p.id
      ), '[]'::jsonb),
    'video_links',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'video_id', pv.video_id,
            'position', pv.position
          )
          order by pv.position, pv.video_id
        )
        from public.playlist_videos pv
        where pv.playlist_id = p.id
      ), '[]'::jsonb)
  )
  from public.playlists p
  where p.id = p_playlist_id;
$$;


ALTER FUNCTION "public"."per_video_chapter_import_snapshot"("p_playlist_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."per_video_chapter_import_video_snapshot"("p_video_id" bigint) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  -- Video details can be refreshed from YouTube independently. Replay protects
  -- the structural filing that this mapped import owns.
  select jsonb_build_object(
    'id', v.id,
    'youtube_video_id', v.youtube_video_id,
    'channel_id', v.channel_id,
    'category_id', v.category_id,
    'subject_id', v.subject_id,
    'chapter_id', v.chapter_id,
    'learning_goal_ids',
      coalesce((
        select jsonb_agg(vlg.learning_goal_id order by vlg.learning_goal_id)
        from public.video_learning_goals vlg
        where vlg.video_id = v.id
      ), '[]'::jsonb),
    'class_level_ids',
      coalesce((
        select jsonb_agg(vcl.class_level_id order by vcl.class_level_id)
        from public.video_class_levels vcl
        where vcl.video_id = v.id
      ), '[]'::jsonb)
  )
  from public.videos v
  where v.id = p_video_id;
$$;


ALTER FUNCTION "public"."per_video_chapter_import_video_snapshot"("p_video_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."playlist_channel_still_matches"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_bad bigint;
begin
  if new.channel_id is not distinct from old.channel_id then
    return null;
  end if;

  select pv.video_id into v_bad
    from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
   where pv.playlist_id = new.id
     and v.channel_id is distinct from new.channel_id
   limit 1;

  if v_bad is not null then
    perform public.assert_playlist_video_channel(new.id, v_bad);
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."playlist_channel_still_matches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."playlist_quality_missing"("p_playlist_id" bigint) RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select array_remove(array[
    case when p.title_review_status <> 'approved' then 'title-review' end,
    case when p.source_title is null or btrim(p.source_title) = '' then 'source-title' end,
    case when p.source_title_changed then 'source-title-changed' end,
    case when p.faculty_credit_status not in ('identified','team') then 'faculty-credit' end,
    case when p.faculty_credit_status = 'identified' and not exists (
      select 1 from public.playlist_teachers pt where pt.playlist_id = p.id
    ) then 'faculty-link' end,
    case when p.faculty_credit_status = 'team' and exists (
      select 1 from public.playlist_teachers pt where pt.playlist_id = p.id
    ) then 'faculty-team-conflict' end,
    case when p.content_type is null then 'course-type' end,
    case when p.language is null then 'language' end,
    case when p.difficulty is null then 'difficulty' end,
    case when p.subject_id is null then 'subject' end,
    case when not exists (
      select 1 from public.playlist_learning_goals plg where plg.playlist_id = p.id
    ) then 'learning-goal' end,
    case when not exists (
      select 1 from public.playlist_class_levels pcl where pcl.playlist_id = p.id
    ) then 'class-level' end,
    case when not exists (
      select 1 from public.playlist_videos pv where pv.playlist_id = p.id
    ) then 'lessons' end,
    case when exists (
      select 1
        from public.playlist_videos pv
        join public.videos v on v.id = pv.video_id
       where pv.playlist_id = p.id and v.chapter_id is null
    ) then 'lesson-chapter' end
  ]::text[], null::text)
  from public.playlists p where p.id = p_playlist_id;
$$;


ALTER FUNCTION "public"."playlist_quality_missing"("p_playlist_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."playlist_video_channel_matches"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.assert_playlist_video_channel(new.playlist_id, new.video_id);
  return null;
end;
$$;


ALTER FUNCTION "public"."playlist_video_channel_matches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_add_comment"("p_poll_id" bigint, "p_body" "text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  uid uuid := public.poll_require_writer();
  poll_status text;
  new_id bigint;
begin
  select status into poll_status from public.polls where id = p_poll_id;
  if poll_status is null or poll_status not in ('live', 'closed') then
    raise exception using errcode = '55000', message = 'this poll is not open for comments';
  end if;

  perform public.poll_record_rate_event(uid, 'comment', p_poll_id, 10, 40);

  insert into public.poll_comments (poll_id, author_id, body)
  values (p_poll_id, uid, btrim(p_body))
  returning id into new_id;
  return new_id;
end;
$$;


ALTER FUNCTION "public"."poll_add_comment"("p_poll_id" bigint, "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_admin_close_expired"() RETURNS TABLE("id" bigint, "question" "text", "closed_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;

  return query
  update public.polls p
  set status = 'closed'
  where p.status = 'live'
    and p.closes_at is not null
    and p.closes_at <= now()
  returning p.id, p.question, p.closes_at;
end;
$$;


ALTER FUNCTION "public"."poll_admin_close_expired"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_admin_list_pending"("p_limit" integer DEFAULT 50) RETURNS TABLE("id" bigint, "slug" "text", "question" "text", "detail" "text", "topic_slug" "text", "topic_name" "text", "author_username" "text", "created_at" timestamp with time zone, "options" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    p.id, p.slug, p.question, p.detail, t.slug, t.name, pr.username, p.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'position', o.position, 'label', o.label, 'image_url', o.image_url
      ) order by o.position)
      from public.poll_options o where o.poll_id = p.id
    ), '[]'::jsonb)
  from public.polls p
  join public.forum_topics t on t.id = p.topic_id
  left join public.profiles pr on pr.id = p.author_id
  where public.is_admin() and p.status = 'pending'
  order by p.created_at asc
  limit greatest(least(coalesce(p_limit, 50), 200), 1);
$$;


ALTER FUNCTION "public"."poll_admin_list_pending"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_admin_list_reports"("p_limit" integer DEFAULT 100) RETURNS TABLE("id" bigint, "target_type" "text", "poll_id" bigint, "poll_slug" "text", "poll_question" "text", "comment_id" bigint, "comment_body" "text", "comment_removed" boolean, "reporter_username" "text", "reason" "text", "detail" "text", "status" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    r.id, r.target_type,
    coalesce(r.poll_id, c.poll_id),
    tp.slug, tp.question,
    r.comment_id, c.body, c.is_removed,
    pr.username, r.reason, r.detail, r.status, r.created_at
  from public.poll_reports r
  left join public.poll_comments c on c.id = r.comment_id
  left join public.polls tp on tp.id = coalesce(r.poll_id, c.poll_id)
  left join public.profiles pr on pr.id = r.reporter_id
  where public.is_admin() and r.status = 'open'
  order by r.created_at desc
  limit greatest(least(coalesce(p_limit, 100), 200), 1);
$$;


ALTER FUNCTION "public"."poll_admin_list_reports"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_admin_resolve_report"("p_report_id" bigint, "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;
  if p_status not in ('actioned', 'dismissed') then
    raise exception using errcode = '22023', message = 'unknown report resolution';
  end if;
  update public.poll_reports
  set status = p_status, resolved_by = auth.uid(), resolved_at = now()
  where id = p_report_id and status = 'open';
end;
$$;


ALTER FUNCTION "public"."poll_admin_resolve_report"("p_report_id" bigint, "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_admin_review"("p_poll_id" bigint, "p_decision" "text", "p_note" "text" DEFAULT NULL::"text", "p_closes_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare current_status text;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception using errcode = '22023', message = 'decision must be approve or reject';
  end if;
  select status into current_status from public.polls where id = p_poll_id;
  if current_status is null then
    raise exception using errcode = '22023', message = 'that poll no longer exists';
  end if;
  if current_status <> 'pending' then
    raise exception using errcode = '55000', message = 'this poll has already been reviewed';
  end if;
  if p_decision = 'reject' and nullif(btrim(coalesce(p_note, '')), '') is null then
    -- A rejection the student cannot learn from is just a silent deletion.
    raise exception using errcode = '22023', message = 'a rejection needs a short reason';
  end if;

  -- The status = 'pending' predicate makes two concurrent reviews resolve
  -- deterministically: the SELECT guard above can pass for both callers, but
  -- only the first UPDATE matches, and the loser falls into the not-found
  -- branch instead of silently overwriting the winner's decision.
  update public.polls
  set status = case when p_decision = 'approve' then 'live' else 'rejected' end,
      review_note = nullif(btrim(coalesce(p_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      published_at = case when p_decision = 'approve' then now() else null end,
      closes_at = case when p_decision = 'approve' then p_closes_at else null end
  where id = p_poll_id and status = 'pending';

  if not found then
    raise exception using errcode = '55000', message = 'this poll has already been reviewed';
  end if;

  return p_decision;
end;
$$;


ALTER FUNCTION "public"."poll_admin_review"("p_poll_id" bigint, "p_decision" "text", "p_note" "text", "p_closes_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_admin_set_comment_removed"("p_comment_id" bigint, "p_removed" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;
  update public.poll_comments
  set is_removed = p_removed,
      removed_by = case when p_removed then auth.uid() else null end,
      removed_at = case when p_removed then now() else null end
  where id = p_comment_id;
end;
$$;


ALTER FUNCTION "public"."poll_admin_set_comment_removed"("p_comment_id" bigint, "p_removed" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_admin_set_mode"("p_mode" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;
  if p_mode not in ('off', 'read_only', 'open') then
    raise exception using errcode = '22023', message = 'unknown poll mode';
  end if;
  update public.poll_settings
  set mode = p_mode, updated_at = now(), updated_by = auth.uid()
  where id = true;
  return p_mode;
end;
$$;


ALTER FUNCTION "public"."poll_admin_set_mode"("p_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_admin_set_option_image"("p_option_id" bigint, "p_image_url" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;
  update public.poll_options
  set image_url = nullif(btrim(coalesce(p_image_url, '')), '')
  where id = p_option_id;
end;
$$;


ALTER FUNCTION "public"."poll_admin_set_option_image"("p_option_id" bigint, "p_image_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_admin_set_status"("p_poll_id" bigint, "p_status" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;
  if p_status not in ('live', 'closed', 'hidden') then
    raise exception using errcode = '22023', message = 'unknown poll status';
  end if;
  -- published_at, not just reviewed_at. A REJECTED poll has been reviewed but
  -- never published, and letting this RPC set it 'live' would trip the table
  -- CHECK and surface a raw constraint violation to an admin. Publishing a
  -- rejected submission is a re-review, not a status change.
  update public.polls set status = p_status where id = p_poll_id
    and reviewed_at is not null and published_at is not null;
  if not found then
    raise exception using errcode = '22023',
      message = 'only a published poll can be closed, hidden or restored';
  end if;
  return p_status;
end;
$$;


ALTER FUNCTION "public"."poll_admin_set_status"("p_poll_id" bigint, "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_apply_comment_delta"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target bigint := coalesce(new.poll_id, old.poll_id);
  was_visible boolean := tg_op <> 'INSERT' and not old.is_removed;
  is_visible boolean := tg_op <> 'DELETE' and not new.is_removed;
begin
  -- comment_count is the count a student sees, so a removed comment must not
  -- be counted -- otherwise "12 comments" renders 11.
  if is_visible and not was_visible then
    update public.polls set comment_count = comment_count + 1 where id = target;
  elsif was_visible and not is_visible then
    update public.polls set comment_count = greatest(comment_count - 1, 0) where id = target;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."poll_apply_comment_delta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_apply_vote_delta"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.poll_options set vote_count = vote_count + 1 where id = new.option_id;
    update public.polls set vote_count = vote_count + 1 where id = new.poll_id;
  elsif tg_op = 'DELETE' then
    update public.poll_options set vote_count = greatest(vote_count - 1, 0) where id = old.option_id;
    update public.polls set vote_count = greatest(vote_count - 1, 0) where id = old.poll_id;
  elsif old.option_id is distinct from new.option_id then
    -- Changing your mind moves the vote; the poll total is unchanged.
    update public.poll_options set vote_count = greatest(vote_count - 1, 0) where id = old.option_id;
    update public.poll_options set vote_count = vote_count + 1 where id = new.option_id;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."poll_apply_vote_delta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_cast_vote"("p_poll_id" bigint, "p_option_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  uid uuid := public.poll_require_voter();
  poll_row public.polls;
begin
  select * into poll_row from public.polls where id = p_poll_id;
  if poll_row.id is null or poll_row.status <> 'live' then
    raise exception using errcode = '55000', message = 'this poll is not accepting votes';
  end if;
  if poll_row.closes_at is not null and poll_row.closes_at <= now() then
    raise exception using errcode = '55000', message = 'this poll has closed';
  end if;
  if not exists (
    select 1 from public.poll_options o where o.id = p_option_id and o.poll_id = p_poll_id
  ) then
    raise exception using errcode = '22023', message = 'that option does not belong to this poll';
  end if;

  perform public.poll_record_rate_event(uid, 'vote', p_poll_id, 60, 300);

  insert into public.poll_votes (poll_id, voter_id, option_id)
  values (p_poll_id, uid, p_option_id)
  on conflict (poll_id, voter_id)
  do update set option_id = excluded.option_id, updated_at = now();
end;
$$;


ALTER FUNCTION "public"."poll_cast_vote"("p_poll_id" bigint, "p_option_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_clear_vote"("p_poll_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := public.poll_require_voter();
begin
  delete from public.poll_votes where poll_id = p_poll_id and voter_id = uid;
end;
$$;


ALTER FUNCTION "public"."poll_clear_vote"("p_poll_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_delete_comment"("p_comment_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'sign in first';
  end if;
  -- Deleting your own words stays possible even in read_only mode and while
  -- suspended. Taking something back is not a contribution.
  delete from public.poll_comments where id = p_comment_id and author_id = uid;
  if not found then
    raise exception using errcode = '42501', message = 'you can only delete your own comment';
  end if;
end;
$$;


ALTER FUNCTION "public"."poll_delete_comment"("p_comment_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_edit_comment"("p_comment_id" bigint, "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := public.poll_require_writer();
begin
  update public.poll_comments
  set body = btrim(p_body), edited_at = now()
  where id = p_comment_id and author_id = uid and not is_removed;
  if not found then
    raise exception using errcode = '42501', message = 'you can only edit your own comment';
  end if;
end;
$$;


ALTER FUNCTION "public"."poll_edit_comment"("p_comment_id" bigint, "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_image_host_allowed"("p_url" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
  -- Require the host to be immediately followed by '/' or end-of-string, NOT
  -- ':'. Stopping at ':' let a userinfo URL like
  -- "https://i.ytimg.com:80@evil.com/x" extract "i.ytimg.com" and pass, even
  -- though a browser resolves that to evil.com. The poll_options.image_url
  -- column CHECK also rejects such a URL, but this function must be safe on its
  -- own so a future caller that skips the column cannot be fooled.
  select p_url is null
    or exists (
      select 1 from public.poll_image_hosts h
      where h.host = lower(substring(p_url from '^https://([a-z0-9.-]+)(?:/|$)'))
    );
$_$;


ALTER FUNCTION "public"."poll_image_host_allowed"("p_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_is_effectively_closed"("p_status" "text", "p_closes_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select p_status = 'closed'
      or (p_status = 'live' and p_closes_at is not null and p_closes_at <= now());
$$;


ALTER FUNCTION "public"."poll_is_effectively_closed"("p_status" "text", "p_closes_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_mode"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce((select mode from public.poll_settings where id = true), 'off');
$$;


ALTER FUNCTION "public"."poll_mode"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_options_json"("p_poll_id" bigint, "p_viewer" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with ctx as (
    select
      public.poll_results_visible(p_poll_id, p_viewer) as visible,
      coalesce((select p.vote_count from public.polls p where p.id = p_poll_id), 0) as total,
      (select v.option_id from public.poll_votes v
       where v.poll_id = p_poll_id and v.voter_id = p_viewer) as viewer_option
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'position', o.position,
        'label', o.label,
        'image_url', o.image_url,
        'vote_count', case when ctx.visible then o.vote_count else null end,
        'share', case
          when not ctx.visible then null
          when ctx.total = 0 then 0
          else round((o.vote_count::numeric * 100) / ctx.total, 1)
        end,
        'viewer_choice', coalesce(o.id = ctx.viewer_option, false)
      )
      order by o.position
    ),
    '[]'::jsonb
  )
  from public.poll_options o
  cross join ctx
  where o.poll_id = p_poll_id;
$$;


ALTER FUNCTION "public"."poll_options_json"("p_poll_id" bigint, "p_viewer" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_record_rate_event"("p_user_id" "uuid", "p_action" "text", "p_target_id" bigint, "p_hour_limit" integer, "p_day_limit" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if p_hour_limit is not null and (
    select count(*) from public.poll_rate_events e
    where e.user_id = p_user_id and e.action = p_action
      and e.created_at >= now() - interval '1 hour'
  ) >= p_hour_limit then
    raise exception using errcode = 'P0001',
      message = p_action || ' hourly rate limit exceeded';
  end if;
  if p_day_limit is not null and (
    select count(*) from public.poll_rate_events e
    where e.user_id = p_user_id and e.action = p_action
      and e.created_at >= now() - interval '1 day'
  ) >= p_day_limit then
    raise exception using errcode = 'P0001',
      message = p_action || ' daily rate limit exceeded';
  end if;
  insert into public.poll_rate_events (user_id, action, target_id)
  values (p_user_id, p_action, p_target_id);
end;
$$;


ALTER FUNCTION "public"."poll_record_rate_event"("p_user_id" "uuid", "p_action" "text", "p_target_id" bigint, "p_hour_limit" integer, "p_day_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_recount_metrics"("p_apply" boolean DEFAULT false) RETURNS TABLE("scope" "text", "id" bigint, "stored" integer, "actual" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;

  -- Report first, into a temp table, so the caller always sees the drift that
  -- WAS there even when p_apply then repairs it.
  create temporary table poll_recount_drift on commit drop as
  select 'option_votes'::text as scope, o.id,
         o.vote_count as stored,
         (select count(*)::integer from public.poll_votes v where v.option_id = o.id) as actual
  from public.poll_options o
  union all
  select 'poll_votes', p.id, p.vote_count,
         (select count(*)::integer from public.poll_votes v where v.poll_id = p.id)
  from public.polls p
  union all
  select 'poll_comments', p.id, p.comment_count,
         (select count(*)::integer from public.poll_comments c
          where c.poll_id = p.id and not c.is_removed)
  from public.polls p;

  delete from poll_recount_drift d where d.stored = d.actual;

  if p_apply then
    update public.poll_options o set vote_count = d.actual
    from poll_recount_drift d where d.scope = 'option_votes' and o.id = d.id;
    update public.polls p set vote_count = d.actual
    from poll_recount_drift d where d.scope = 'poll_votes' and p.id = d.id;
    update public.polls p set comment_count = d.actual
    from poll_recount_drift d where d.scope = 'poll_comments' and p.id = d.id;
  end if;

  return query select d.scope, d.id, d.stored, d.actual from poll_recount_drift d
  order by d.scope, d.id;
end;
$$;


ALTER FUNCTION "public"."poll_recount_metrics"("p_apply" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_require_open"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if public.poll_mode() <> 'open' then
    raise exception using errcode = '55000', message = 'polls are not open for contributions';
  end if;
end;
$$;


ALTER FUNCTION "public"."poll_require_open"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_require_reporter"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := auth.uid();
begin
  if public.poll_mode() = 'off' then
    raise exception using errcode = '55000', message = 'polls are unavailable';
  end if;
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception using errcode = '42501', message = 'sign in to report content';
  end if;
  return uid;
end;
$$;


ALTER FUNCTION "public"."poll_require_reporter"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_require_voter"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := auth.uid();
begin
  perform public.poll_require_open();
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception using errcode = '42501', message = 'sign in to vote';
  end if;
  if exists (
    select 1 from public.forum_suspensions s
    where s.user_id = uid and s.suspended_until > now()
  ) then
    raise exception using errcode = '42501', message = 'voting is temporarily suspended';
  end if;
  return uid;
end;
$$;


ALTER FUNCTION "public"."poll_require_voter"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_require_writer"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  uid uuid := auth.uid();
  profile_created timestamptz;
  handle text;
begin
  perform public.poll_require_open();
  if uid is null then
    raise exception using errcode = '42501', message = 'sign in to take part';
  end if;
  select u.created_at, btrim(p.username) into profile_created, handle
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = uid;
  if profile_created is null then
    raise exception using errcode = '42501', message = 'student profile is missing';
  end if;
  if handle is null or handle !~ '^[A-Za-z0-9_]{3,30}$' then
    raise exception using errcode = '22023',
      message = 'choose a 3 to 30 character username before taking part';
  end if;
  if profile_created > now() - interval '10 minutes' then
    raise exception using errcode = 'P0001',
      message = 'new accounts can take part after 10 minutes';
  end if;
  if exists (
    select 1 from public.forum_suspensions s
    where s.user_id = uid and s.suspended_until > now()
  ) then
    raise exception using errcode = '42501', message = 'posting is temporarily suspended';
  end if;
  return uid;
end;
$_$;


ALTER FUNCTION "public"."poll_require_writer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_results_visible"("p_poll_id" bigint, "p_viewer" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    (select public.poll_is_effectively_closed(p.status, p.closes_at)
     from public.polls p where p.id = p_poll_id),
    false
  )
  or (p_viewer is not null and (
    exists (select 1 from public.poll_votes v
            where v.poll_id = p_poll_id and v.voter_id = p_viewer)
    or exists (select 1 from public.profiles p
               where p.id = p_viewer and p.is_admin)
  ));
$$;


ALTER FUNCTION "public"."poll_results_visible"("p_poll_id" bigint, "p_viewer" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_slugify"("p_text" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  select coalesce(
    nullif(
      btrim(
        regexp_replace(
          regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'),
          '(^-+|-+$)', '', 'g'
        ),
        '-'
      ),
      ''
    ),
    'poll'
  );
$_$;


ALTER FUNCTION "public"."poll_slugify"("p_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_submit"("p_topic_slug" "text", "p_question" "text", "p_detail" "text", "p_options" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  uid uuid := public.poll_require_writer();
  topic bigint;
  option_count integer;
  new_id bigint;
  item jsonb;
  idx smallint := 0;
  label text;
  image text;
begin
  select id into topic from public.forum_topics
  where slug = p_topic_slug and is_active;
  if topic is null then
    raise exception using errcode = '22023', message = 'choose a subject for this poll';
  end if;

  if jsonb_typeof(p_options) <> 'array' then
    raise exception using errcode = '22023', message = 'options must be a list';
  end if;
  option_count := jsonb_array_length(p_options);
  if option_count < 2 or option_count > 6 then
    raise exception using errcode = '22023', message = 'a poll needs between 2 and 6 options';
  end if;

  -- Two a day. A poll costs an admin a review, so the limit is about the
  -- reviewer's time as much as about abuse.
  perform public.poll_record_rate_event(uid, 'submit', null, 2, 2);

  insert into public.polls (slug, topic_id, question, detail, author_id, status)
  values ('pending-submission', topic, btrim(p_question),
          nullif(btrim(coalesce(p_detail, '')), ''), uid, 'pending')
  returning id into new_id;

  -- The slug is derived after the insert so it can carry the id and never
  -- collide, even when two students ask the same question. rtrim the trailing
  -- hyphen: poll_slugify strips edge hyphens, but the 60-char left() can cut on
  -- an internal one, and then '-' || id would make '--', which violates the
  -- slug CHECK and aborts a perfectly valid submission with a raw error.
  update public.polls
  set slug = rtrim(left(public.poll_slugify(btrim(p_question)), 60), '-') || '-' || new_id::text
  where id = new_id;

  for item in select * from jsonb_array_elements(p_options) loop
    idx := idx + 1;
    label := btrim(coalesce(item->>'label', ''));
    image := nullif(btrim(coalesce(item->>'image_url', '')), '');
    if label = '' then
      raise exception using errcode = '22023', message = 'every option needs a label';
    end if;
    if image is not null and not public.poll_image_host_allowed(image) then
      raise exception using errcode = '22023',
        message = 'picture links must come from an approved image host';
    end if;
    insert into public.poll_options (poll_id, position, label, image_url)
    values (new_id, idx, label, image);
  end loop;

  return new_id;
end;
$$;


ALTER FUNCTION "public"."poll_submit"("p_topic_slug" "text", "p_question" "text", "p_detail" "text", "p_options" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_submit_report"("p_target_type" "text", "p_target_id" bigint, "p_reason" "text", "p_detail" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare uid uuid := public.poll_require_reporter();
begin
  if p_target_type not in ('poll', 'comment') then
    raise exception using errcode = '22023', message = 'unknown report target';
  end if;

  perform public.poll_record_rate_event(uid, 'report', p_target_id, 10, 30);

  if p_target_type = 'poll' then
    if not exists (select 1 from public.polls where id = p_target_id) then
      raise exception using errcode = '22023', message = 'that poll no longer exists';
    end if;
    insert into public.poll_reports (target_type, poll_id, reporter_id, reason, detail)
    values ('poll', p_target_id, uid, p_reason, nullif(btrim(coalesce(p_detail, '')), ''))
    on conflict do nothing;
  else
    if not exists (select 1 from public.poll_comments where id = p_target_id) then
      raise exception using errcode = '22023', message = 'that comment no longer exists';
    end if;
    insert into public.poll_reports (target_type, comment_id, reporter_id, reason, detail)
    values ('comment', p_target_id, uid, p_reason, nullif(btrim(coalesce(p_detail, '')), ''))
    on conflict do nothing;
  end if;
end;
$$;


ALTER FUNCTION "public"."poll_submit_report"("p_target_type" "text", "p_target_id" bigint, "p_reason" "text", "p_detail" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poll_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."poll_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_profile_admin_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'UPDATE'
       and new.is_admin is distinct from old.is_admin then
      raise exception using
        errcode = '42501',
        message = 'profiles.is_admin may only be changed by service_role';
    end if;

    if tg_op = 'INSERT'
       and new.is_admin is distinct from false then
      raise exception using
        errcode = '42501',
        message = 'profiles.is_admin may only be assigned by service_role';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."protect_profile_admin_flag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_review_moderation_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'UPDATE'
     and (new.review_hidden is distinct from old.review_hidden
          or new.review_hidden_at is distinct from old.review_hidden_at
          or new.review_hidden_by is distinct from old.review_hidden_by)
     and not public.is_admin() then
    raise exception using
      errcode = '42501',
      message = 'playlist_ratings review_hidden* columns may only be changed by an admin';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."protect_review_moderation_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_migration_audit"("p_keep_runs" integer DEFAULT 3) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_removed int;
begin
  -- Same reasoning as migrate_class_levels(): retention is an operator action,
  -- normally run from the SQL Editor. See the comment there on session_user.
  if not (public.is_admin()
          or auth.role() = 'service_role'
          or session_user in ('postgres', 'supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  delete from public.class_levels_migration_audit
   where run_id is not null
     and run_id not in (
       select run_id from (
         select run_id, max(migrated_at) as t
           from public.class_levels_migration_audit
          where run_id is not null
          group by run_id order by t desc limit p_keep_runs) keep);
  get diagnostics v_removed = row_count;
  return jsonb_build_object('removed', v_removed, 'kept_runs', p_keep_runs);
end; $$;


ALTER FUNCTION "public"."purge_migration_audit"("p_keep_runs" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reassign_video_chapter"("p_playlist_id" bigint, "p_video_id" bigint, "p_chapter_id" bigint, "p_expected_current_chapter_id" bigint, "p_allow_shared" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_video_subject_id bigint;
  v_current_chapter_id bigint;
  v_chapter_subject_id bigint;
  v_shared int;
  v_before jsonb;
  v_after jsonb;
begin
  if not (
    public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select v.subject_id, v.chapter_id
  into v_video_subject_id, v_current_chapter_id
  from public.videos v
  where v.id = p_video_id
    and exists (
      select 1
      from public.playlist_videos pv
      where pv.playlist_id = p_playlist_id
        and pv.video_id = v.id
    )
  for update;
  if not found then
    raise exception 'video is not linked to this playlist';
  end if;
  if v_current_chapter_id is distinct from p_expected_current_chapter_id then
    raise exception 'expected chapter does not match current video chapter';
  end if;

  select subject_id
  into v_chapter_subject_id
  from public.chapters
  where id = p_chapter_id;
  if not found then
    raise exception 'unknown chapter_id %', p_chapter_id;
  end if;
  if v_chapter_subject_id is distinct from v_video_subject_id then
    raise exception 'chapter subject does not match video subject';
  end if;

  select count(*) into v_shared
  from public.playlist_videos
  where video_id = p_video_id;
  if v_shared > 1 and not p_allow_shared then
    raise exception 'video is shared by % playlists; explicit confirmation is required', v_shared;
  end if;

  v_before := public.catalog_video_taxonomy_snapshot(p_video_id);
  update public.videos
  set chapter_id = p_chapter_id
  where id = p_video_id;
  v_after := public.catalog_video_taxonomy_snapshot(p_video_id);

  insert into public.catalog_management_audit (
    action, playlist_id, video_id, before_state, after_state, actor_id
  ) values (
    'reassign-video-chapter', p_playlist_id, p_video_id,
    v_before, v_after, auth.uid()
  );

  return jsonb_build_object(
    'playlist_id', p_playlist_id,
    'video_id', p_video_id,
    'chapter_id', p_chapter_id,
    'shared_playlist_count', v_shared
  );
end;
$$;


ALTER FUNCTION "public"."reassign_video_chapter"("p_playlist_id" bigint, "p_video_id" bigint, "p_chapter_id" bigint, "p_expected_current_chapter_id" bigint, "p_allow_shared" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_playlist_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    pid bigint := coalesce(new.playlist_id, old.playlist_id);
begin
    update public.playlists
    set average_rating = (
            select coalesce(round(avg(rating)::numeric, 2), 0)
            from public.playlist_ratings
            where playlist_id = pid
        ),
        ratings_count = (
            select count(*)
            from public.playlist_ratings
            where playlist_id = pid
        )
    where id = pid;
    return null;
end;
$$;


ALTER FUNCTION "public"."refresh_playlist_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_faculty_review_group"("p_normalized" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r record; v_done int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for r in select id from public.teacher_name_proposals
            where normalized = p_normalized and status in ('pending','deferred')
            order by id for update
  loop
    perform public.reject_proposal(r.id, p_note); v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;
  return jsonb_build_object('normalized', p_normalized, 'variants_rejected', v_done);
end; $$;


ALTER FUNCTION "public"."reject_faculty_review_group"("p_normalized" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_proposal"("p_proposal_id" bigint, "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_raw text;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  update public.teacher_name_proposals
     set status = 'rejected', note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_proposal_id and status in ('pending','deferred')
   returning raw_teacher into v_raw;
  if v_raw is null then raise exception 'proposal % not pending', p_proposal_id; end if;
  -- Same transaction: a history with holes in it is not a history.
  perform public.log_proposal_decision(p_proposal_id, v_raw, 'rejected', null, p_note);
  return jsonb_build_object('proposal_id', p_proposal_id, 'status', 'rejected');
end; $$;


ALTER FUNCTION "public"."reject_proposal"("p_proposal_id" bigint, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_teacher_exact"("p_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_result jsonb;
begin
  -- Admin/importer only. It reports candidates reached through PROPOSED
  -- aliases (that is the point of the 'unverified-match' outcome), so exposing
  -- it to ordinary authenticated users would leak exactly what the alias RLS
  -- above is protecting.
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  with hits as (
    select * from public.search_teachers_internal(p_name, 25, true) where match_rank <= 2
  ),
  verified_hits as (select * from hits where match_rank = 1)
  select case
    when (select count(*) from hits) = 0 then
      jsonb_build_object('resolved', false, 'reason', 'no-match', 'candidates', '[]'::jsonb)
    when (select count(*) from verified_hits) = 1 then
      jsonb_build_object('resolved', true, 'teacher_id', (select teacher_id from verified_hits))
    when (select count(*) from verified_hits) > 1 then
      jsonb_build_object('resolved', false, 'reason', 'ambiguous',
        'candidates', (select jsonb_agg(jsonb_build_object('teacher_id', teacher_id,
            'display_name', display_name, 'institutes', institutes, 'subjects', subjects,
            'course_count', course_count)) from verified_hits))
    else
      -- only unreviewed aliases matched: candidates exist, but nothing is proven
      jsonb_build_object('resolved', false, 'reason', 'unverified-match',
        'candidates', (select jsonb_agg(jsonb_build_object('teacher_id', teacher_id,
            'display_name', display_name, 'matched_on', matched_on, 'alias_status', alias_status,
            'institutes', institutes, 'course_count', course_count)) from hits))
  end
  into v_result;
  return v_result;
end; $$;


ALTER FUNCTION "public"."resolve_teacher_exact"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_playlist_quality"("p_playlist_id" bigint, "p_display_title" "text", "p_teacher_ids" bigint[], "p_faculty_status" "text", "p_content_type" "text", "p_language" "text", "p_difficulty" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  p public.playlists%rowtype;
  v_title text;
  v_before jsonb;
  v_after jsonb;
  v_missing text[];
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into p from public.playlists where id = p_playlist_id for update;
  if not found then raise exception 'unknown playlist_id %', p_playlist_id; end if;

  v_title := regexp_replace(btrim(coalesce(p_display_title, '')), '\s+', ' ', 'g');
  if char_length(v_title) < 3 or char_length(v_title) > 90 then
    raise exception 'display title must contain 3 to 90 characters';
  end if;
  if p_teacher_ids is null then raise exception 'teacher_ids must be explicit'; end if;
  if p_faculty_status not in ('identified','team','unknown') then
    raise exception 'invalid faculty status %', p_faculty_status;
  end if;
  if p_faculty_status = 'identified' and cardinality(p_teacher_ids) = 0 then
    raise exception 'identified faculty requires at least one teacher id';
  end if;
  if p_faculty_status = 'team' and cardinality(p_teacher_ids) <> 0 then
    raise exception 'team credit cannot carry individual teacher ids';
  end if;
  if p_faculty_status = 'team' and char_length(btrim(coalesce(p_note,''))) < 3 then
    raise exception 'team credit requires an editorial note';
  end if;
  if p_content_type not in ('full-course','one-shot','revision','pyq','practice') then
    raise exception 'invalid content_type %', p_content_type;
  end if;
  if p_language not in ('hindi','english','hinglish') then
    raise exception 'invalid language %', p_language;
  end if;
  if p_difficulty not in ('beginner','intermediate','advanced') then
    raise exception 'invalid difficulty %', p_difficulty;
  end if;

  v_before := jsonb_build_object(
    'title', p.title, 'title_review_status', p.title_review_status,
    'faculty_credit_status', p.faculty_credit_status,
    'content_type', p.content_type, 'language', p.language, 'difficulty', p.difficulty,
    'teacher_ids', coalesce((select jsonb_agg(pt.teacher_id order by pt.position)
      from public.playlist_teachers pt where pt.playlist_id = p.id), '[]'::jsonb));

  -- Identity replacement stays delegated to the v7 write contract. It
  -- validates duplicate/unknown ids before deleting existing links.
  perform public.set_playlist_teachers(p.id, p_teacher_ids);

  update public.playlists
     set title = v_title,
         title_review_status = 'approved',
         faculty_credit_status = p_faculty_status,
         content_type = p_content_type,
         language = p_language,
         difficulty = p_difficulty,
         source_title_changed = false
   where id = p.id;

  v_after := jsonb_build_object(
    'title', v_title, 'title_review_status', 'approved',
    'faculty_credit_status', p_faculty_status,
    'content_type', p_content_type, 'language', p_language, 'difficulty', p_difficulty,
    'teacher_ids', to_jsonb(p_teacher_ids));
  insert into public.playlist_quality_reviews
    (playlist_id, before_state, after_state, note, reviewed_by)
  values (p.id, v_before, v_after, nullif(btrim(p_note), ''), auth.uid());

  v_missing := public.playlist_quality_missing(p.id);
  return jsonb_build_object('playlist_id', p.id, 'missing_fields', v_missing,
    'quality_ready', cardinality(v_missing) = 0);
end; $$;


ALTER FUNCTION "public"."review_playlist_quality"("p_playlist_id" bigint, "p_display_title" "text", "p_teacher_ids" bigint[], "p_faculty_status" "text", "p_content_type" "text", "p_language" "text", "p_difficulty" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."scan_free_text_teachers"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r record; v_new int := 0; v_multi int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;

  for r in
    select p.teacher as raw, count(*) as n
      from public.playlists p
     where nullif(trim(coalesce(p.teacher,'')), '') is not null
     group by p.teacher
  loop
    insert into public.teacher_name_proposals (raw_teacher, normalized, occurrences, kind)
    values (r.raw, public.normalize_person_name(r.raw), r.n,
            -- organisation is checked FIRST: "Physics Department" also trips the
            -- multi-person separators, but it is not two people — it is nobody,
            -- and it must never become a teacher record.
            case when public.normalize_person_name(r.raw) is null then 'blank'
                 when public.looks_like_organization(r.raw) then 'organization-or-team'
                 when public.looks_like_multiple_people(r.raw) then 'multi-person'
                 else 'single' end)
    on conflict (raw_teacher) do update set occurrences = excluded.occurrences;
    v_new := v_new + 1;
    if public.looks_like_multiple_people(r.raw) then v_multi := v_multi + 1; end if;
  end loop;

  return jsonb_build_object(
    'proposals_total',   (select count(*) from public.teacher_name_proposals),
    'pending',           (select count(*) from public.teacher_name_proposals where status = 'pending'),
    'multi_person',      v_multi,
    'teachers_created',  0,
    'aliases_created',   0,
    'playlist_links_created', 0,
    'note', 'proposal only — nothing was written to teachers, aliases or playlist_teachers');
end; $$;


ALTER FUNCTION "public"."scan_free_text_teachers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_filler_tokens"() RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    AS $$
  select array[
    'a', 'an', 'the', 'of', 'in', 'on', 'for', 'to',
    'and', 'or', 'is', 'are', 'was', 'be', 'by', 'with',
    'from', 'at', 'as', 'it', 'this', 'that', 'my', 'me',
    'i', 'how', 'what', 'why', 'when', 'which', 'who', 'where',
    'can', 'do', 'does', 'solve', 'solved', 'solving', 'solution', 'explain',
    'explained', 'explanation', 'find', 'finding', 'learn', 'study', 'understand', 'revise',
    'revision', 'problem', 'question', 'numerical', 'example', 'exercise', 'practice', 'sum',
    'lecture', 'lesson', 'video', 'playlist', 'course', 'class', 'chapter', 'topic',
    'note', 'pdf', 'best', 'good', 'easy', 'quick', 'fast', 'complete',
    'full', 'free', 'new', 'latest', 'all', 'any', 'please', 'help',
    'need', 'want', 'ncert', 'cbse', 'syllabus', 'exam', 'paper', 'test',
    'mock', 'preparation', 'std', 'standard', 'th', 'nd', 'rd', 'st'
  ]::text[];
$$;


ALTER FUNCTION "public"."search_filler_tokens"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_filler_tokens"() IS 'Query words that express intent or exam scaffolding rather than subject matter. Removed from universal_search tokens so one filler word cannot fail an all-tokens-must-match query.';



CREATE OR REPLACE FUNCTION "public"."search_latin_key"("p_text" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  select public.normalize_search_text(public.translit_devanagari(p_text));
$$;


ALTER FUNCTION "public"."search_latin_key"("p_text" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_latin_key"("p_text" "text") IS 'Script-neutral comparison key: Devanagari transliterated to Latin, then normalize_search_text. Identity transform for Latin input, so one key serves Latin and Devanagari content and queries in all four combinations.';



CREATE OR REPLACE FUNCTION "public"."search_playlist_ids"("p_query" "text") RETURNS TABLE("id" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'public', 'pg_temp'
    AS $$
declare t record;
begin
  select * into t from public.search_query_tokens(p_query);
  if t.qlen is null or t.qlen < 2 then
    return;
  end if;
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);
  return query
    select pl.id
      from public.playlists pl
     where (   public.search_latin_key(pl.title) like '%' || t.q_long || '%'
            or public.search_latin_key(pl.title) like t.q || '%'
            or public.search_latin_key(pl.title) %> t.q_long )
       and public.search_rank_tokens(public.search_latin_key(pl.title), t.q_tokens, t.q) is not null;
end; $$;


ALTER FUNCTION "public"."search_playlist_ids"("p_query" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_playlist_ids"("p_query" "text") IS 'Course ids whose title matches p_query with universal_search''s playlist logic (multi-token AND, trigram typo, Hinglish). For the /browse course list to search as well as the homepage.';



CREATE OR REPLACE FUNCTION "public"."search_query_tokens"("p_query" "text") RETURNS TABLE("qlen" integer, "q" "text", "q_tokens" "text"[], "q_long" "text")
    LANGUAGE "plpgsql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  q_raw     text := public.normalize_search_text(p_query);
  v_q       text := public.search_latin_key(p_query);
  v_tokens  text[];
  v_content text[];
  v_long    text;
begin
  qlen := least(coalesce(length(q_raw), 0), coalesce(length(v_q), 0));
  q := v_q;

  v_tokens := array_remove(string_to_array(coalesce(v_q, ''), ' '), '');

  v_content := array(
    select tok
      from unnest(v_tokens) as tok
     where tok <> ''
       and not (tok = any (public.search_filler_tokens()))
       and not (public.search_singular(tok) = any (public.search_filler_tokens()))
       and tok !~ '^[0-9]{1,2}$'
  );
  if cardinality(v_content) > 0 then
    v_tokens := v_content;
  end if;
  q_tokens := v_tokens;

  select tok into v_long
    from unnest(v_tokens) as tok
   order by length(tok) desc, tok
   limit 1;
  q_long := coalesce(v_long, v_q);

  return next;
end; $_$;


ALTER FUNCTION "public"."search_query_tokens"("p_query" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_query_tokens"("p_query" "text") IS 'universal_search tokenisation as a reusable helper (latin key, filler-filtered tokens, longest token, length floor). Lets browse search tokenise identically to the homepage.';



CREATE OR REPLACE FUNCTION "public"."search_rank"("p_haystack" "text", "p_needle" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when p_needle is null or p_haystack is null then null
    when p_haystack = p_needle                                            then 1
    when length(p_needle) >= 2 and p_haystack like p_needle || '%'        then 3
    when length(p_needle) >= 3 and p_haystack like '%' || p_needle || '%' then 4
    -- Fuzzy is the only tier that can be wrong in a surprising way, so it is
    -- both length-guarded and threshold-guarded.
    when length(p_needle) >= 4 and public.catalog_similarity(p_haystack, p_needle) >= 0.4 then 5
    else null
  end;
$$;


ALTER FUNCTION "public"."search_rank"("p_haystack" "text", "p_needle" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_rank_tokens"("p_haystack" "text", "p_tokens" "text"[], "p_needle" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when p_needle is null or p_haystack is null                            then null
    when p_haystack = p_needle                                            then 1
    when length(p_needle) >= 2 and p_haystack like p_needle || '%'         then 3
    -- Tier 4: EVERY token present. This is what makes "motion gravity"
    -- work, and for a single-token query it reduces to the old 'partial' tier.
    when length(p_needle) >= 3
         and p_tokens is not null
         and cardinality(p_tokens) > 0
         and not exists (
               select 1
                 from unnest(p_tokens) as tok
                where tok <> ''
                  -- typed OR singular: "problems" must reach a title that says
                  -- "Problem". Widening only -- the typed form alone passing is
                  -- exactly the old behaviour.
                  and position(tok in p_haystack) = 0
                  and position(public.search_singular(tok) in p_haystack) = 0
             )                                                            then 4
    -- Fuzzy is the only tier that can be wrong in a surprising way, so it is
    -- both length-guarded and threshold-guarded. word_similarity(needle,
    -- haystack) — NOT similarity() — because the haystack is a 90-character
    -- lecture title and whole-string similarity drowns in it (P2).
    -- EVERY token must clear the threshold, not just the needle as a whole.
    -- word_similarity maximises over ONE contiguous extent, so 'class 12' was
    -- satisfied by matching only 'class' and dragged 253 Class-11 lectures in.
    -- group_total is a contract column the UI renders, so this has to be tight.
    when length(p_needle) >= 4
         and not exists (
           select 1 from unnest(p_tokens) as tok
            where tok <> ''
              -- typed OR singular, same as tier 4. The typed form is tried
              -- as-is, which is what keeps typo queries like "kinamatics"
              -- working -- rewriting the token broke them once already.
              and public.catalog_word_similarity(tok, p_haystack) < 0.5
              and public.catalog_word_similarity(public.search_singular(tok), p_haystack) < 0.5
         )                                                              then 5
    else null
  end;
$$;


ALTER FUNCTION "public"."search_rank_tokens"("p_haystack" "text", "p_tokens" "text"[], "p_needle" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_rank_tokens"("p_haystack" "text", "p_tokens" "text"[], "p_needle" "text") IS 'Match tier for universal_search: 1 exact, 3 prefix, 4 all tokens present, 5 word-similarity fuzzy, null no match.';



CREATE OR REPLACE FUNCTION "public"."search_singular"("p_tok" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    AS $$
  select case when length(p_tok) > 4 and right(p_tok, 1) = 's'
              then left(p_tok, length(p_tok) - 1)
              else p_tok end;
$$;


ALTER FUNCTION "public"."search_singular"("p_tok" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_singular"("p_tok" "text") IS 'One trailing s off a 5+ character token. Lets plural queries reach singular titles without rewriting what the student typed.';



CREATE OR REPLACE FUNCTION "public"."search_teacher_candidates"("p_query" "text", "p_limit" integer DEFAULT 10) RETURNS TABLE("teacher_id" bigint, "display_name" "text", "slug" "text", "verified" boolean, "match_type" "text", "match_rank" integer, "matched_on" "text", "alias_status" "text", "institutes" "text", "subjects" "text", "goals" "text", "course_count" bigint, "is_ambiguous" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- Granting this to `authenticated` without a body check made "admin search"
  -- available to every signed-in student. The grant is not the boundary; this is.
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select * from public.search_teachers_internal(p_query, p_limit, true);
end; $$;


ALTER FUNCTION "public"."search_teacher_candidates"("p_query" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_teachers"("p_query" "text", "p_limit" integer DEFAULT 10) RETURNS TABLE("teacher_id" bigint, "display_name" "text", "slug" "text", "verified" boolean, "match_type" "text", "match_rank" integer, "matched_on" "text", "alias_status" "text", "institutes" "text", "subjects" "text", "goals" "text", "course_count" bigint, "is_ambiguous" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select * from public.search_teachers_internal(p_query, p_limit, false);
$$;


ALTER FUNCTION "public"."search_teachers"("p_query" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_teachers_internal"("p_query" "text", "p_limit" integer, "p_include_unverified" boolean) RETURNS TABLE("teacher_id" bigint, "display_name" "text", "slug" "text", "verified" boolean, "match_type" "text", "match_rank" integer, "matched_on" "text", "alias_status" "text", "institutes" "text", "subjects" "text", "goals" "text", "course_count" bigint, "is_ambiguous" boolean)
    LANGUAGE "sql" STABLE
    AS $$
  with nq as (
    select public.normalize_person_name(p_query) as q,
           length(public.normalize_person_name(p_query)) as qlen
  ),
  cand as (
      -- A teacher's own display name is always searchable, even when the
      -- teacher record is unverified; the UI shows that status.
      select t.id as tid, 1 as rk, 'exact-name'::text as mt, t.display_name as mo, null::text as st
        from public.teachers t, nq where nq.q is not null and t.canonical_name = nq.q
      union all
      select a.teacher_id, 1, 'exact-alias', a.alias, a.status
        from public.teacher_aliases a, nq
       where nq.q is not null and a.normalized_alias = nq.q and a.status = 'verified'
      union all
      select a.teacher_id, 2, 'exact-alias-unverified', a.alias, a.status
        from public.teacher_aliases a, nq
       where p_include_unverified and nq.q is not null
         and a.normalized_alias = nq.q and a.status = 'proposed'
      union all
      select t.id, 3, 'prefix', t.display_name, null
        from public.teachers t, nq
       where nq.q is not null and nq.qlen >= 2 and t.canonical_name like nq.q || '%'
      union all
      select a.teacher_id, 3, 'prefix-alias', a.alias, a.status
        from public.teacher_aliases a, nq
       where nq.q is not null and nq.qlen >= 2
         and (a.status = 'verified' or (p_include_unverified and a.status = 'proposed'))
         and a.normalized_alias like nq.q || '%'
      union all
      select t.id, 4, 'partial', t.display_name, null
        from public.teachers t, nq
       where nq.q is not null and nq.qlen >= 3 and t.canonical_name like '%' || nq.q || '%'
      union all
      select a.teacher_id, 4, 'partial-alias', a.alias, a.status
        from public.teacher_aliases a, nq
       where nq.q is not null and nq.qlen >= 3
         and (a.status = 'verified' or (p_include_unverified and a.status = 'proposed'))
         and a.normalized_alias like '%' || nq.q || '%'
      union all
      -- fuzzy needs 4+ characters: on "AB" trigram matches nearly everyone and
      -- would bury the real answer while making an ambiguous alias look decisive
      select t.id, 5, 'fuzzy', t.display_name, null
        from public.teachers t, nq
       where nq.q is not null and nq.qlen >= 4 and public.catalog_similarity(t.canonical_name, nq.q) >= 0.4
      union all
      select a.teacher_id, 5, 'fuzzy-alias', a.alias, a.status
        from public.teacher_aliases a, nq
       where nq.q is not null and nq.qlen >= 4
         and (a.status = 'verified' or (p_include_unverified and a.status = 'proposed'))
         and public.catalog_similarity(a.normalized_alias, nq.q) >= 0.4
  ),
  best as (select distinct on (tid) tid, rk, mt, mo, st from cand order by tid, rk, mt),
  toprank as (select min(rk) as r, count(*) as n from best where rk = (select min(rk) from best))
  select b.tid, t.display_name, t.slug, t.verified, b.mt, b.rk, b.mo, b.st,
         (select string_agg(ic.name, ', ' order by ic.name) from public.teacher_institutes ti
            join public.institutes_channels ic on ic.id = ti.institute_id where ti.teacher_id = b.tid),
         (select string_agg(sj.name, ', ' order by sj.name) from public.teacher_subjects ts
            join public.subjects sj on sj.id = ts.subject_id where ts.teacher_id = b.tid),
         (select string_agg(lg.name, ', ' order by lg.name) from public.teacher_learning_goals tg
            join public.learning_goals lg on lg.id = tg.learning_goal_id where tg.teacher_id = b.tid),
         (select count(*) from public.playlist_teachers pt where pt.teacher_id = b.tid),
         (b.rk = (select r from toprank) and (select n from toprank) > 1)
    from best b join public.teachers t on t.id = b.tid
   order by b.rk, t.verified desc,
            (select count(*) from public.playlist_teachers pt where pt.teacher_id = b.tid) desc,
            t.display_name
   limit greatest(coalesce(p_limit, 10), 1);
$$;


ALTER FUNCTION "public"."search_teachers_internal"("p_query" "text", "p_limit" integer, "p_include_unverified" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_video_ids"("p_query" "text") RETURNS TABLE("id" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'public', 'pg_temp'
    AS $$
declare t record;
begin
  select * into t from public.search_query_tokens(p_query);
  if t.qlen is null or t.qlen < 2 then
    return;
  end if;
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);
  return query
    select v.id
      from public.videos v
     where (   public.search_latin_key(v.title) like '%' || t.q_long || '%'
            or public.search_latin_key(v.title) like t.q || '%'
            or public.search_latin_key(v.title) %> t.q_long )
       and public.search_rank_tokens(public.search_latin_key(v.title), t.q_tokens, t.q) is not null
     order by public.search_rank_tokens(public.search_latin_key(v.title), t.q_tokens, t.q),
              length(v.title), v.id
     limit 500;
end; $$;


ALTER FUNCTION "public"."search_video_ids"("p_query" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_video_ids"("p_query" "text") IS 'Lecture ids whose title matches p_query with universal_search''s lecture logic. Relevance-ordered, capped at 500 so a broad query cannot overflow a URL id-filter.';



CREATE OR REPLACE FUNCTION "public"."set_alias_normalized"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.normalized_alias := public.normalize_person_name(new.alias);
  if new.normalized_alias is null then
    raise exception 'alias % normalises to nothing', new.alias;
  end if;
  return new;
end; $$;


ALTER FUNCTION "public"."set_alias_normalized"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_managed_video_taxonomy"("p_playlist_id" bigint, "p_video_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[], "p_allow_shared" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_shared int;
  v_category_slug text;
  v_before jsonb;
  v_after jsonb;
begin
  if not (
    public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.playlist_videos
    where playlist_id = p_playlist_id and video_id = p_video_id
  ) then
    raise exception 'video is not linked to this playlist';
  end if;
  if coalesce(cardinality(p_learning_goal_ids), 0) = 0
     or coalesce(cardinality(p_class_level_ids), 0) = 0 then
    raise exception 'learning goals and class levels are required';
  end if;
  if (
    select count(*) from unnest(p_learning_goal_ids) as goals(goal_id)
  ) <> (
    select count(distinct goal_id)
    from unnest(p_learning_goal_ids) as goals(goal_id)
  ) or (
    select count(*) from unnest(p_class_level_ids) as classes(class_id)
  ) <> (
    select count(distinct class_id)
    from unnest(p_class_level_ids) as classes(class_id)
  ) then
    raise exception 'duplicate taxonomy ids are not allowed';
  end if;
  if exists (
    select 1 from unnest(p_learning_goal_ids) as goals(goal_id)
    where not exists (
      select 1 from public.learning_goals where id = goals.goal_id
    )
  ) or exists (
    select 1 from unnest(p_class_level_ids) as classes(class_id)
    where not exists (
      select 1 from public.class_levels where id = classes.class_id
    )
  ) then
    raise exception 'unknown taxonomy id';
  end if;

  select c.slug
  into v_category_slug
  from public.videos v
  join public.categories c on c.id = v.category_id
  where v.id = p_video_id
  for update of v;
  if not found then
    raise exception 'unknown video_id %', p_video_id;
  end if;
  if exists (
    select 1
    from public.learning_goals lg
    where lg.id = any(p_learning_goal_ids)
      and lg.slug is distinct from v_category_slug
  ) then
    raise exception 'learning goal does not match the video category';
  end if;
  if v_category_slug in ('jee', 'neet') and exists (
    select 1
    from public.class_levels cl
    where cl.id = any(p_class_level_ids)
      and cl.slug not in ('class-11', 'class-12', 'dropper')
  ) then
    raise exception 'class level does not match the video category';
  end if;

  select count(*) into v_shared
  from public.playlist_videos
  where video_id = p_video_id;
  if v_shared > 1 and not p_allow_shared then
    raise exception 'video is shared by % playlists; explicit confirmation is required', v_shared;
  end if;

  v_before := public.catalog_video_taxonomy_snapshot(p_video_id);
  delete from public.video_learning_goals where video_id = p_video_id;
  delete from public.video_class_levels where video_id = p_video_id;
  insert into public.video_learning_goals (video_id, learning_goal_id)
  select p_video_id, goals.goal_id
  from unnest(p_learning_goal_ids) as goals(goal_id);
  insert into public.video_class_levels (video_id, class_level_id)
  select p_video_id, classes.class_id
  from unnest(p_class_level_ids) as classes(class_id);
  v_after := public.catalog_video_taxonomy_snapshot(p_video_id);

  insert into public.catalog_management_audit (
    action, playlist_id, video_id, before_state, after_state, actor_id
  ) values (
    'set-video-taxonomy', p_playlist_id, p_video_id,
    v_before, v_after, auth.uid()
  );

  return jsonb_build_object(
    'playlist_id', p_playlist_id,
    'video_id', p_video_id,
    'shared_playlist_count', v_shared,
    'learning_goals', cardinality(p_learning_goal_ids),
    'class_levels', cardinality(p_class_level_ids)
  );
end;
$$;


ALTER FUNCTION "public"."set_managed_video_taxonomy"("p_playlist_id" bigint, "p_video_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[], "p_allow_shared" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_playlist_teachers"("p_playlist_id" bigint, "p_teacher_ids" bigint[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_id bigint; v_pos int := 0; v_bad bigint[];
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if p_teacher_ids is null then
    raise exception 'set_playlist_teachers requires an array; omit the key upstream to preserve'; end if;
  if not exists (select 1 from public.playlists where id = p_playlist_id) then
    raise exception 'invalid playlist_id %', p_playlist_id; end if;
  if (select count(distinct x) from unnest(p_teacher_ids) x)
     <> coalesce(array_length(p_teacher_ids,1),0) then
    raise exception 'duplicate teacher_id in %', p_teacher_ids; end if;
  select array_agg(x) into v_bad from unnest(p_teacher_ids) x
   where not exists (select 1 from public.teachers t where t.id = x);
  if v_bad is not null then
    raise exception 'unknown teacher_id(s) % — create the faculty record first', v_bad; end if;

  delete from public.playlist_teachers where playlist_id = p_playlist_id;
  foreach v_id in array p_teacher_ids loop
    v_pos := v_pos + 1;
    insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
    values (p_playlist_id, v_id, case when v_pos = 1 then 'instructor' else 'co-instructor' end, v_pos);
  end loop;
  return jsonb_build_object('playlist_id', p_playlist_id, 'teachers', v_pos);
end; $$;


ALTER FUNCTION "public"."set_playlist_teachers"("p_playlist_id" bigint, "p_teacher_ids" bigint[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_teacher_canonical"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare v_base text; v_slug text; v_n int := 1;
begin
  new.canonical_name := public.normalize_person_name(new.display_name);
  if new.canonical_name is null then
    raise exception 'teacher display_name % normalises to nothing', new.display_name;
  end if;
  if new.slug is null or new.slug = '' then
    -- Two concurrent "Amit Kumar" inserts would otherwise both scan, both pick
    -- amit-kumar-2, and one would die on the unique index. Serialise slug
    -- allocation per canonical name for the duration of the transaction.
    perform pg_advisory_xact_lock(hashtext('teacher_slug:' || new.canonical_name));
    -- Slugs must be unique for URLs even though NAMES need not be, so a second
    -- "Amit Kumar" becomes amit-kumar-2 rather than colliding or merging.
    v_base := regexp_replace(new.canonical_name, '\s+', '-', 'g');
    v_slug := v_base;
    while exists (select 1 from public.teachers t
                   where t.slug = v_slug and t.id is distinct from new.id) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    end loop;
    new.slug := v_slug;
  end if;
  return new;
end; $$;


ALTER FUNCTION "public"."set_teacher_canonical"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_teacher_context"("p_teacher_id" bigint, "p_institute_ids" bigint[] DEFAULT NULL::bigint[], "p_subject_ids" bigint[] DEFAULT NULL::bigint[], "p_goal_ids" bigint[] DEFAULT NULL::bigint[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_id bigint; v_bad bigint[];
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.teachers where id = p_teacher_id) then
    raise exception 'invalid teacher_id %', p_teacher_id; end if;

  if p_institute_ids is not null then
    if (select count(distinct x) from unnest(p_institute_ids) x) <> coalesce(array_length(p_institute_ids,1),0) then
      raise exception 'duplicate institute_id'; end if;
    select array_agg(x) into v_bad from unnest(p_institute_ids) x
     where not exists (select 1 from public.institutes_channels c where c.id = x);
    if v_bad is not null then raise exception 'unknown institute_id(s) %', v_bad; end if;
    delete from public.teacher_institutes where teacher_id = p_teacher_id;
    foreach v_id in array p_institute_ids loop
      insert into public.teacher_institutes (teacher_id, institute_id) values (p_teacher_id, v_id);
    end loop;
  end if;

  if p_subject_ids is not null then
    if (select count(distinct x) from unnest(p_subject_ids) x) <> coalesce(array_length(p_subject_ids,1),0) then
      raise exception 'duplicate subject_id'; end if;
    select array_agg(x) into v_bad from unnest(p_subject_ids) x
     where not exists (select 1 from public.subjects sj where sj.id = x);
    if v_bad is not null then raise exception 'unknown subject_id(s) %', v_bad; end if;
    delete from public.teacher_subjects where teacher_id = p_teacher_id;
    foreach v_id in array p_subject_ids loop
      insert into public.teacher_subjects (teacher_id, subject_id) values (p_teacher_id, v_id);
    end loop;
  end if;

  if p_goal_ids is not null then
    if (select count(distinct x) from unnest(p_goal_ids) x) <> coalesce(array_length(p_goal_ids,1),0) then
      raise exception 'duplicate learning_goal_id'; end if;
    select array_agg(x) into v_bad from unnest(p_goal_ids) x
     where not exists (select 1 from public.learning_goals g where g.id = x);
    if v_bad is not null then raise exception 'unknown learning_goal_id(s) %', v_bad; end if;
    delete from public.teacher_learning_goals where teacher_id = p_teacher_id;
    foreach v_id in array p_goal_ids loop
      insert into public.teacher_learning_goals (teacher_id, learning_goal_id) values (p_teacher_id, v_id);
    end loop;
  end if;

  return jsonb_build_object('teacher_id', p_teacher_id,
    'institutes', (select count(*) from public.teacher_institutes where teacher_id = p_teacher_id),
    'subjects',   (select count(*) from public.teacher_subjects   where teacher_id = p_teacher_id),
    'goals',      (select count(*) from public.teacher_learning_goals where teacher_id = p_teacher_id));
end; $$;


ALTER FUNCTION "public"."set_teacher_context"("p_teacher_id" bigint, "p_institute_ids" bigint[], "p_subject_ids" bigint[], "p_goal_ids" bigint[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    new.updated_at = now();
    return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_video_taxonomy"("p_video_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_gid bigint; v_cid bigint;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.videos where id = p_video_id) then
    raise exception 'invalid video_id %', p_video_id; end if;

  if coalesce(array_length(p_learning_goal_ids,1),0) = 0
     or coalesce(array_length(p_class_level_ids,1),0) = 0 then
    raise exception 'at least one learning goal and one class level are required; use clear_video_taxonomy() to remove all taxonomy';
  end if;

  -- review item 6: duplicates are rejected BEFORE any delete happens.
  if (select count(distinct x) from unnest(p_learning_goal_ids) x) <> array_length(p_learning_goal_ids,1) then
    raise exception 'duplicate learning_goal_id in %', p_learning_goal_ids; end if;
  if (select count(distinct x) from unnest(p_class_level_ids) x) <> array_length(p_class_level_ids,1) then
    raise exception 'duplicate class_level_id in %', p_class_level_ids; end if;

  if exists (select 1 from unnest(p_learning_goal_ids) g
             where not exists (select 1 from public.learning_goals where id = g)) then
    raise exception 'invalid learning_goal_id in %', p_learning_goal_ids; end if;
  if exists (select 1 from unnest(p_class_level_ids) c
             where not exists (select 1 from public.class_levels where id = c)) then
    raise exception 'invalid class_level_id in %', p_class_level_ids; end if;

  -- NOTE: deliberately NO category check here. A single Physics lecture
  -- genuinely serves both JEE and NEET, and videos.category_id is
  -- single-valued, so constraining goals to the video's category would make
  -- that legitimate case unrepresentable. The category↔goal mapping is
  -- enforced where filing intent is declared (import / create_course); the
  -- guarantee that Browse and Explore agree comes from both of them reading
  -- the goal junction, not from narrowing a video to one goal.

  foreach v_gid in array p_learning_goal_ids loop
    foreach v_cid in array p_class_level_ids loop
      if not exists (select 1 from public.learning_goal_class_levels m
                     where m.learning_goal_id = v_gid and m.class_level_id = v_cid) then
        raise exception 'class_level % is not valid for learning_goal %', v_cid, v_gid; end if;
    end loop;
  end loop;

  delete from public.video_learning_goals where video_id = p_video_id;
  delete from public.video_class_levels   where video_id = p_video_id;
  foreach v_gid in array p_learning_goal_ids loop
    insert into public.video_learning_goals (video_id, learning_goal_id) values (p_video_id, v_gid); end loop;
  foreach v_cid in array p_class_level_ids loop
    insert into public.video_class_levels (video_id, class_level_id) values (p_video_id, v_cid); end loop;

  return jsonb_build_object('video_id', p_video_id,
    'goals', array_length(p_learning_goal_ids,1), 'classes', array_length(p_class_level_ids,1));
end; $$;


ALTER FUNCTION "public"."set_video_taxonomy"("p_video_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_video_teachers"("p_video_id" bigint, "p_teacher_ids" bigint[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_id bigint; v_n int := 0; v_bad bigint[];
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if p_teacher_ids is null then raise exception 'requires an array'; end if;
  if not exists (select 1 from public.videos where id = p_video_id) then
    raise exception 'invalid video_id %', p_video_id; end if;
  if (select count(distinct x) from unnest(p_teacher_ids) x)
     <> coalesce(array_length(p_teacher_ids,1),0) then
    raise exception 'duplicate teacher_id in %', p_teacher_ids; end if;
  select array_agg(x) into v_bad from unnest(p_teacher_ids) x
   where not exists (select 1 from public.teachers t where t.id = x);
  if v_bad is not null then raise exception 'unknown teacher_id(s) %', v_bad; end if;

  delete from public.video_teachers where video_id = p_video_id;
  foreach v_id in array p_teacher_ids loop
    insert into public.video_teachers (video_id, teacher_id) values (p_video_id, v_id);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('video_id', p_video_id, 'teachers', v_n);
end; $$;


ALTER FUNCTION "public"."set_video_teachers"("p_video_id" bigint, "p_teacher_ids" bigint[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."similar_teachers"("p_name" "text", "p_limit" integer DEFAULT 5) RETURNS TABLE("teacher_id" bigint, "display_name" "text", "slug" "text", "verified" boolean, "match_type" "text", "match_rank" integer, "matched_on" "text", "alias_status" "text", "institutes" "text", "subjects" "text", "goals" "text", "course_count" bigint, "is_ambiguous" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select * from public.search_teachers_internal(p_name, p_limit, true);
end; $$;


ALTER FUNCTION "public"."similar_teachers"("p_name" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."split_faculty_review_group"("p_normalized" "text", "p_teacher_ids" bigint[], "p_override_kind" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r record; v_result jsonb; v_done int := 0; v_links int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for r in select id from public.teacher_name_proposals
            where normalized = p_normalized and status in ('pending','deferred')
            order by id for update
  loop
    v_result := public.split_proposal(r.id, p_teacher_ids, p_override_kind);
    v_links := v_links + coalesce((v_result->>'links_created')::int, 0);
    v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;
  return jsonb_build_object('normalized', p_normalized, 'variants_resolved', v_done,
    'teachers', p_teacher_ids, 'links_created', v_links);
end; $$;


ALTER FUNCTION "public"."split_faculty_review_group"("p_normalized" "text", "p_teacher_ids" bigint[], "p_override_kind" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."split_proposal"("p_proposal_id" bigint, "p_teacher_ids" bigint[], "p_override_kind" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare p record; v_id bigint; v_pos int := 0; v_links int := 0; v_total int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  -- FOR UPDATE: two admins opening the review queue must not both approve
  -- the same proposal and double-link its playlists.
  select * into p from public.teacher_name_proposals where id = p_proposal_id for update;
  if not found then raise exception 'invalid proposal_id %', p_proposal_id; end if;
  if p.status not in ('pending','deferred') then
    raise exception 'proposal % is already %', p_proposal_id, p.status; end if;
  if coalesce(array_length(p_teacher_ids,1),0) < 2 then
    raise exception 'split needs at least two teacher_ids'; end if;
  -- Splitting a value that does not look like several people is usually a
  -- mistake, so it needs an explicit override rather than silent acceptance.
  if p.kind not in ('multi-person','organization-or-team') and not p_override_kind then
    raise exception 'proposal % is kind "%" — pass p_override_kind := true to split it anyway',
      p_proposal_id, p.kind; end if;
  if (select count(distinct x) from unnest(p_teacher_ids) x) <> array_length(p_teacher_ids,1) then
    raise exception 'duplicate teacher_id in %', p_teacher_ids; end if;
  if exists (select 1 from unnest(p_teacher_ids) x
             where not exists (select 1 from public.teachers t where t.id = x)) then
    raise exception 'unknown teacher_id in %', p_teacher_ids; end if;

  foreach v_id in array p_teacher_ids loop
    v_pos := v_pos + 1;
    insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
    select pl.id, v_id, case when v_pos = 1 then 'instructor' else 'co-instructor' end, v_pos
      from public.playlists pl where pl.teacher = p.raw_teacher
    on conflict (playlist_id, teacher_id) do nothing;
    get diagnostics v_links = row_count;
    v_total := v_total + v_links;
  end loop;

  update public.teacher_name_proposals
     set status = 'split', resolved_teacher_ids = p_teacher_ids,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_proposal_id;
  perform public.log_proposal_decision(p_proposal_id, p.raw_teacher, 'split', p_teacher_ids, null);

  return jsonb_build_object('proposal_id', p_proposal_id, 'teachers', p_teacher_ids,
                            'links_created', v_total);
end; $$;


ALTER FUNCTION "public"."split_proposal"("p_proposal_id" bigint, "p_teacher_ids" bigint[], "p_override_kind" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_playlist_class_levels_array"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
      declare v_pid bigint := coalesce(new.playlist_id, old.playlist_id);
      begin
        update public.playlists set class_levels = public.derived_class_levels(v_pid) where id = v_pid;
        return null;
      end; $$;


ALTER FUNCTION "public"."sync_playlist_class_levels_array"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_playlist_attributes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end
$$;


ALTER FUNCTION "public"."touch_playlist_attributes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_study_material_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_study_material_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."translit_devanagari"("p_text" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
declare
  -- '[' U+0900 '-' U+097F ']' built with chr() for the same reason as above.
  c_deva  constant text := '[' || chr(2304) || '-' || chr(2431) || ']';
  v_len   int;
  v_i     int := 1;
  v_cp    int;
  v_cons  text := null;   -- consonant awaiting its vowel: 'k', 'bh', 'gy', ...
  v_out   text := '';
  v_v     text;
  v_c     text;
begin
  -- Contract: STRICT-safe on null.
  if p_text is null then
    return null;
  end if;

  -- IDENTITY FAST PATH, and the reason one key can serve both scripts: text
  -- with no Devanagari in it is returned byte-for-byte unchanged. Every Latin
  -- title and every Latin query takes this branch, so the loop never runs on
  -- the overwhelmingly common case and this function costs one regex test.
  if p_text !~ c_deva then
    return p_text;
  end if;

  v_len := length(p_text);

  while v_i <= v_len loop
    v_cp := ascii(substr(p_text, v_i, 1));

    -- ---- ज्ञ, the one conjunct that does NOT fall out of the general rules.
    -- ज=j + ञ=n would give "jn", but every Hindi speaker says and types "gy"
    -- (ज्ञान -> "gyaana", विज्ञान -> "vigyaana"). Three code points, so it has
    -- to be matched by lookahead and therefore has to come first.
    -- ascii(substr()) past the end is ascii('') = 0, so this cannot over-read.
    if v_cp = 2332                                          -- U+091C  JA
       and ascii(substr(p_text, v_i + 1, 1)) = 2381          -- U+094D  VIRAMA
       and ascii(substr(p_text, v_i + 2, 1)) = 2334          -- U+091E  NYA
    then
      if v_cons is not null then v_out := v_out || v_cons || 'a'; end if;
      v_cons := 'gy';
      v_i := v_i + 3;
      continue;
    end if;

    -- ---- OUTSIDE THE DEVANAGARI BLOCK: pass through unchanged.
    if v_cp < 2304 or v_cp > 2431 then                      -- U+0900 .. U+097F
      -- The one documented exception. ZWNJ/ZWJ are invisible cluster-shaping
      -- controls that appear INSIDE Devanagari words (क्‌ष) and mean nothing
      -- lexically. Passing them through would leave a zero-width character in
      -- the key, where normalize_search_text will not remove it either (it is
      -- Cf, neither punct nor space), so the same word stored with and without
      -- one would get two different keys and one of them would never match.
      -- Dropping them cannot affect Latin input: Latin text never contains
      -- them, so the identity guarantee above is untouched.
      if v_cp = 8204 or v_cp = 8205 then                    -- U+200C, U+200D
        v_i := v_i + 1;
        continue;
      end if;
      if v_cons is not null then v_out := v_out || v_cons || 'a'; v_cons := null; end if;
      v_out := v_out || substr(p_text, v_i, 1);
      v_i := v_i + 1;
      continue;
    end if;

    -- ---- DEPENDENT VOWEL SIGNS (matras). These REPLACE the inherent 'a'.
    v_v := case v_cp
             when 2362 then 'e'     -- U+093A  vowel sign OE
             when 2363 then 'aa'    -- U+093B  vowel sign OOE
             when 2366 then 'a'     -- U+093E  vowel sign AA  (short: students type 'sakhi', not 'saakhii')
             when 2367 then 'i'     -- U+093F  vowel sign I
             when 2368 then 'i'     -- U+0940  vowel sign II  (short, see AA)
             when 2369 then 'u'     -- U+0941  vowel sign U
             when 2370 then 'u'     -- U+0942  vowel sign UU  (short, see AA)
             when 2371 then 'ri'    -- U+0943  vowel sign VOCALIC R
             when 2372 then 'ri'    -- U+0944  vowel sign VOCALIC RR
             when 2373 then 'e'     -- U+0945  vowel sign CANDRA E
             when 2374 then 'e'     -- U+0946  vowel sign SHORT E
             when 2375 then 'e'     -- U+0947  vowel sign E
             when 2376 then 'ai'    -- U+0948  vowel sign AI
             when 2377 then 'o'     -- U+0949  vowel sign CANDRA O
             when 2378 then 'o'     -- U+094A  vowel sign SHORT O
             when 2379 then 'o'     -- U+094B  vowel sign O
             when 2380 then 'au'    -- U+094C  vowel sign AU
             when 2382 then 'e'     -- U+094E  vowel sign PRISHTHAMATRA E
             when 2383 then 'au'    -- U+094F  vowel sign AW
             when 2402 then 'li'    -- U+0962  vowel sign VOCALIC L
             when 2403 then 'li'    -- U+0963  vowel sign VOCALIC LL
           end;
    if v_v is not null then
      v_out  := v_out || coalesce(v_cons, '') || v_v;
      v_cons := null;
      v_i    := v_i + 1;
      continue;
    end if;

    -- ---- VIRAMA: cancel the inherent 'a'. This is what builds conjuncts.
    if v_cp = 2381 then                                     -- U+094D  VIRAMA
      v_out  := v_out || coalesce(v_cons, '');
      v_cons := null;
      v_i    := v_i + 1;
      continue;
    end if;

    -- ---- MARKS THAT PRODUCE NOTHING.
    -- Dropped WITHOUT flushing v_cons: the pending consonant is simply carried
    -- past them, which is what a combining mark should do. Deferring the flush
    -- can never lose it — the next branch or the end of the loop emits it.
    -- Nukta matters most: dropping it makes ड+U+093C give exactly the same key
    -- as the precomposed ड़ U+095C, so canonically-different spellings of
    -- बड़े both key to "bade" and the expression index stays trustworthy.
    if v_cp = 2364                                          -- U+093C  NUKTA
       or v_cp = 2365                                       -- U+093D  AVAGRAHA
       or (v_cp between 2385 and 2391)                      -- U+0951..U+0957 accents
       or v_cp = 2417                                       -- U+0971  high spacing dot
       or v_cp = 2429                                       -- U+097D  glottal stop
    then
      v_i := v_i + 1;
      continue;
    end if;

    -- ---- Everything from here FLUSHES the pending consonant first.
    -- हंस must become "hansa", not "hnsa": the anusvara follows a consonant
    -- that still owns its inherent 'a'.
    if v_cons is not null then v_out := v_out || v_cons || 'a'; v_cons := null; end if;

    -- ---- NASALISATION AND ASPIRATION MARKS.
    if v_cp = 2304 or v_cp = 2305 or v_cp = 2306 then
      v_out := v_out || 'n';        -- U+0900 inverted candrabindu, U+0901 ँ, U+0902 ं
      v_i := v_i + 1;
      continue;
    end if;
    if v_cp = 2307 then                                     -- U+0903  VISARGA
      v_out := v_out || 'h';
      v_i := v_i + 1;
      continue;
    end if;

    -- ---- INDEPENDENT VOWELS.
    v_v := case v_cp
             when 2308 then 'a'     -- U+0904  SHORT A
             when 2309 then 'a'     -- U+0905  A
             when 2310 then 'a'     -- U+0906  AA  (short, see the matra table)
             when 2311 then 'i'     -- U+0907  I
             when 2312 then 'i'     -- U+0908  II  (short)
             when 2313 then 'u'     -- U+0909  U
             when 2314 then 'u'     -- U+090A  UU  (short)
             when 2315 then 'ri'    -- U+090B  VOCALIC R
             when 2316 then 'li'    -- U+090C  VOCALIC L
             when 2317 then 'e'     -- U+090D  CANDRA E
             when 2318 then 'e'     -- U+090E  SHORT E
             when 2319 then 'e'     -- U+090F  E
             when 2320 then 'ai'    -- U+0910  AI
             when 2321 then 'o'     -- U+0911  CANDRA O
             when 2322 then 'o'     -- U+0912  SHORT O
             when 2323 then 'o'     -- U+0913  O
             when 2324 then 'au'    -- U+0914  AU
             when 2400 then 'ri'    -- U+0960  VOCALIC RR
             when 2401 then 'li'    -- U+0961  VOCALIC LL
             when 2418 then 'a'     -- U+0972  CANDRA A
             when 2419 then 'a'     -- U+0973  OE
             when 2420 then 'a'     -- U+0974  OOE
             when 2421 then 'au'    -- U+0975  AW
             when 2422 then 'u'     -- U+0976  UE
             when 2423 then 'uu'    -- U+0977  UUE
           end;
    if v_v is not null then
      v_out := v_out || v_v;
      v_i   := v_i + 1;
      continue;
    end if;

    -- ---- CONSONANTS. The value is the consonant ALONE; the inherent 'a' is
    -- added later, by whichever branch flushes it. The precomposed nukta forms
    -- U+0958..U+095F map to the same letters as base+U+093C on purpose (see
    -- the nukta note above) — क़/ख़/ग़/ज़ lose the Perso-Arabic distinction
    -- (q/x/gh/z) because a student typing a chapter name does not make it.
    v_c := case v_cp
             when 2325 then 'k'     -- U+0915  KA
             when 2326 then 'kh'    -- U+0916  KHA
             when 2327 then 'g'     -- U+0917  GA
             when 2328 then 'gh'    -- U+0918  GHA
             when 2329 then 'n'     -- U+0919  NGA
             when 2330 then 'ch'    -- U+091A  CA
             when 2331 then 'chh'   -- U+091B  CHA   (छ; keeps छ distinct from च)
             when 2332 then 'j'     -- U+091C  JA
             when 2333 then 'jh'    -- U+091D  JHA
             when 2334 then 'n'     -- U+091E  NYA
             when 2335 then 't'     -- U+091F  TTA
             when 2336 then 'th'    -- U+0920  TTHA
             when 2337 then 'd'     -- U+0921  DDA
             when 2338 then 'dh'    -- U+0922  DDHA
             when 2339 then 'n'     -- U+0923  NNA
             when 2340 then 't'     -- U+0924  TA
             when 2341 then 'th'    -- U+0925  THA
             when 2342 then 'd'     -- U+0926  DA
             when 2343 then 'dh'    -- U+0927  DHA
             when 2344 then 'n'     -- U+0928  NA
             when 2345 then 'n'     -- U+0929  NNNA
             when 2346 then 'p'     -- U+092A  PA
             when 2347 then 'ph'    -- U+092B  PHA
             when 2348 then 'b'     -- U+092C  BA
             when 2349 then 'bh'    -- U+092D  BHA
             when 2350 then 'm'     -- U+092E  MA
             when 2351 then 'y'     -- U+092F  YA
             when 2352 then 'r'     -- U+0930  RA
             when 2353 then 'r'     -- U+0931  RRA
             when 2354 then 'l'     -- U+0932  LA
             when 2355 then 'l'     -- U+0933  LLA
             when 2356 then 'l'     -- U+0934  LLLA
             when 2357 then 'v'     -- U+0935  VA
             when 2358 then 'sh'    -- U+0936  SHA
             when 2359 then 'sh'    -- U+0937  SSA
             when 2360 then 's'     -- U+0938  SA
             when 2361 then 'h'     -- U+0939  HA
             when 2392 then 'k'     -- U+0958  QA    (= KA + nukta)
             when 2393 then 'kh'    -- U+0959  KHHA
             when 2394 then 'g'     -- U+095A  GHHA
             when 2395 then 'j'     -- U+095B  ZA
             when 2396 then 'd'     -- U+095C  DDDHA (ड़)
             when 2397 then 'dh'    -- U+095D  RHA   (ढ़)
             when 2398 then 'ph'    -- U+095E  FA    (फ़)
             when 2399 then 'y'     -- U+095F  YYA
             when 2424 then 'd'     -- U+0978  MARWARI DDA
             when 2425 then 'jh'    -- U+0979  ZHA
             when 2426 then 'y'     -- U+097A  HEAVY YA
             when 2427 then 'g'     -- U+097B  GGA
             when 2428 then 'j'     -- U+097C  JJA
             when 2430 then 'd'     -- U+097E  DDDA
             when 2431 then 'b'     -- U+097F  BBA
           end;
    if v_c is not null then
      v_cons := v_c;
      v_i    := v_i + 1;
      continue;
    end if;

    -- ---- DEVANAGARI DIGITS U+0966..U+096F -> 0..9.
    if v_cp between 2406 and 2415 then
      v_out := v_out || (v_cp - 2406)::text;
      v_i   := v_i + 1;
      continue;
    end if;

    -- ---- DANDA / DOUBLE DANDA / ABBREVIATION SIGN are sentence punctuation:
    -- a space, which normalize_search_text then collapses.
    if v_cp = 2404 or v_cp = 2405 or v_cp = 2416 then        -- U+0964 U+0965 U+0970
      v_out := v_out || ' ';
      v_i   := v_i + 1;
      continue;
    end if;

    if v_cp = 2384 then                                      -- U+0950  OM
      v_out := v_out || 'om';
      v_i   := v_i + 1;
      continue;
    end if;

    -- Unassigned / unhandled inside the block: drop it rather than leak a
    -- Devanagari character into something called a *Latin* key.
    v_i := v_i + 1;
  end loop;

  -- Trailing consonant still holding its inherent 'a' (पद -> "pada").
  if v_cons is not null then v_out := v_out || v_cons || 'a'; end if;

  return v_out;
end
$$;


ALTER FUNCTION "public"."translit_devanagari"("p_text" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."translit_devanagari"("p_text" "text") IS 'Mechanical Devanagari->Latin transliteration in the spelling an Indian student types. Identity for non-Devanagari input. Only ever adds letters, never removes them.';



CREATE OR REPLACE FUNCTION "public"."universal_search"("p_query" "text", "p_types" "text"[] DEFAULT NULL::"text"[], "p_limit" integer DEFAULT 5, "p_offset" integer DEFAULT 0) RETURNS TABLE("group_key" "text", "entity_id" bigint, "title" "text", "subtitle" "text", "aka" "text", "slug" "text", "match_type" "text", "match_rank" integer, "matched_on" "text", "is_ambiguous" boolean, "group_total" bigint, "extra" "jsonb")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'public', 'pg_temp'
    AS $_$
declare
  -- Two normalisations, on purpose. q is the Latin key and is what everything
  -- is matched on. q_raw exists only to measure the length of what the student
  -- actually typed, so transliteration cannot smuggle a 1-character query past
  -- the floor in design note 4.
  q_raw    text := public.normalize_search_text(p_query);
  q        text := public.search_latin_key(p_query);
  qlen     int  := least(coalesce(length(q_raw), 0), coalesce(length(q), 0));
  q_tokens text[];
  q_content text[];
  q_long   text;
  lim      int  := least(greatest(coalesce(p_limit, 5), 1), 50);
  off      int  := greatest(coalesce(p_offset, 0), 0);
  want     text[] := case when p_types is null or cardinality(p_types) = 0
                          then array['faculty','chapter','playlist','lecture','institute']
                          else p_types end;
begin
  -- Design note 4. One character is not a query; returning the top of the
  -- alphabet for "a" trains students to ignore the suggestions entirely.
  if qlen < 2 then
    return;
  end if;

  -- Design note 7: pin the %> threshold transaction-locally so behaviour does
  -- not depend on a per-database GUC. Must happen before the first %> below.
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);

  -- Tokens. q is already lower-cased, punctuation-stripped and single-spaced by
  -- search_latin_key, so splitting on a single space is exact; array_remove is
  -- belt and braces.
  q_tokens := array_remove(string_to_array(q, ' '), '');

  -- Filler removal. Tiers 4 and 5 in search_rank_tokens both require EVERY
  -- token to match, so one word that no title contains kills the whole query.
  -- Measured against production on 2026-08-10: 19 of 43 realistic student
  -- queries returned nothing, including "how to solve pulley problems" while
  -- "Pulley Problem - Newton's Laws of Motion" sat in the catalogue, and
  -- "friction problems" while 5 Friction lectures did.
  --
  -- Tokens are FILTERED, never rewritten. The first deploy also singularised
  -- the surviving tokens here ("problems" -> "problem"), and that broke the
  -- typo tier: "kinamatics" became "kinamatic", whose trigrams lost the shared
  -- 'ics' tail with "kinematics" and fell below the 0.5 fuzzy threshold --
  -- 14 rows -> 0, a measured regression. Plural-widening now lives inside
  -- search_rank_tokens, where each tier accepts a token's typed OR singular
  -- form; the tokens themselves stay exactly as the student typed them, so the
  -- fuzzy tier sees the same strings it always did.
  --
  -- A token is filler if EITHER its typed or its singular form is in the list;
  -- both directions are needed. Typed-only lets "problems" through (the list
  -- holds "problem"); singular-only lets "class" through, because "class"
  -- singularises to "clas", which no list holds.
  --
  -- If filtering would leave nothing, keep the original tokens. Without that
  -- guard a query of pure filler ("how to") empties q_tokens, and tier 5's
  -- "not exists (unnest(empty))" is vacuously true, which would match every
  -- row in the catalogue.
  q_content := array(
    select tok
      from unnest(q_tokens) as tok
     where tok <> ''
       and not (tok = any (public.search_filler_tokens()))
       and not (public.search_singular(tok) = any (public.search_filler_tokens()))
       and tok !~ '^[0-9]{1,2}$'
  );
  if cardinality(q_content) > 0 then
    q_tokens := q_content;
  end if;

  -- The longest token drives the index prefilter (design note 6). Ties are
  -- broken alphabetically so the same query always produces the same plan.
  select tok into q_long
    from unnest(q_tokens) as tok
   order by length(tok) desc, tok
   limit 1;
  q_long := coalesce(q_long, q);

  ---------------------------------------------------------------- faculty
  -- Dynamic SQL: these tables may not exist (see design note 2). A static
  -- reference would make the whole function fail to CREATE on a database
  -- without teachers_v7. Verbatim from the shipped version — faculty ranking is
  -- search_teachers()' business and is deliberately untouched by v11, which is
  -- also why it is passed the RAW p_query and not the Latin key.
  if 'faculty' = any(want) and to_regclass('public.teachers') is not null then
    return query execute $dyn$
      with hits as (
        select s.teacher_id, s.display_name, s.slug, s.match_type, s.match_rank,
               s.matched_on, s.is_ambiguous, s.institutes, s.subjects, s.goals,
               s.verified
          from public.search_teachers($1, 50) s
      ), counted as (
        select h.*, count(*) over () as total from hits h
      )
      select 'faculty'::text,
             c.teacher_id,
             c.display_name,
             -- "Competishun · Physics · JEE" — the context that makes two
             -- people with the same name distinguishable.
             nullif(concat_ws(' · ', nullif(c.institutes,''), nullif(c.subjects,''),
                                     nullif(c.goals,'')), ''),
             -- VERIFIED aliases only. RLS on teacher_aliases enforces this
             -- independently; the predicate here is belt and braces.
             (select string_agg(a.alias, ', ' order by a.alias)
                from public.teacher_aliases a
               where a.teacher_id = c.teacher_id
                 and a.status = 'verified'
                 and public.normalize_person_name(a.alias)
                     is distinct from public.normalize_person_name(c.display_name)),
             c.slug, c.match_type, c.match_rank, c.matched_on, c.is_ambiguous,
             c.total,
             jsonb_build_object('verified', c.verified)
        from counted c
       order by c.match_rank, c.display_name
       limit $2 offset $3
    $dyn$ using p_query, lim, off;
  end if;

  ---------------------------------------------------------------- chapters
  if 'chapter' = any(want) then
    return query
    with m as (
      select ch.id, ch.name,
             public.search_rank_tokens(public.search_latin_key(ch.name), q_tokens, q) as rk,
             s.name as subject
        from public.chapters ch
        left join public.subjects s on s.id = ch.subject_id
       -- CONTENT GUARD (from search_hide_empty_chapters.sql, preserved): never
       -- suggest a chapter with no lessons mapped to it, so parked/empty
       -- chapters cannot dead-end the searcher.
       where exists (select 1 from public.videos v where v.chapter_id = ch.id)
         -- SARGABLE (design note 6). Every disjunct is a gin_trgm_ops member
         -- applied to the indexed expression verbatim.
         and (   public.search_latin_key(ch.name) like '%' || q_long || '%'
              or public.search_latin_key(ch.name) like q || '%'
              or public.search_latin_key(ch.name) %> q_long )
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'chapter'::text, c.id, c.name, c.subject, null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.name, false, c.total,
           jsonb_build_object('chapter_id', c.id)
      from counted c
     -- Within a tier, the shortest name is the closest match: for "motion",
     -- "Motion" should outrank "Motion in a Straight Line".
     order by c.rk, length(c.name), c.name
     limit lim offset off;
  end if;

  ---------------------------------------------------------------- playlists
  if 'playlist' = any(want) then
    return query
    with m as (
      select pl.id, pl.title,
             public.search_rank_tokens(public.search_latin_key(pl.title), q_tokens, q) as rk,
             nullif(concat_ws(' · ', nullif(pl.teacher,''), ic.name, s.name), '') as ctx,
             -- first chapter this playlist teaches, so the result deep-links
             -- to a watchable page rather than a dead end. Now evaluated only
             -- for rows that survived the index prefilter, not for every
             -- playlist in the table.
             (select v.chapter_id
                from public.playlist_videos pv
                join public.videos v on v.id = pv.video_id
               where pv.playlist_id = pl.id and v.chapter_id is not null
               order by pv.position limit 1) as chapter_id
        from public.playlists pl
        left join public.institutes_channels ic on ic.id = pl.channel_id
        left join public.subjects s on s.id = pl.subject_id
       where (   public.search_latin_key(pl.title) like '%' || q_long || '%'
              or public.search_latin_key(pl.title) like q || '%'
              or public.search_latin_key(pl.title) %> q_long )
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'playlist'::text, c.id, c.title, c.ctx, null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.title, false, c.total,
           jsonb_build_object('chapter_id', c.chapter_id)
      from counted c
     order by c.rk, length(c.title), c.title
     limit lim offset off;
  end if;

  ---------------------------------------------------------------- lectures
  if 'lecture' = any(want) then
    return query
    with m as (
      select v.id, v.title,
             public.search_rank_tokens(public.search_latin_key(v.title), q_tokens, q) as rk,
             nullif(concat_ws(' · ', ch.name, s.name), '') as ctx,
             v.chapter_id, v.subject_id,
             v.youtube_video_id,
             -- The course this lesson sits in, so a lecture result can open the
             -- LESSON rather than dumping the student on a filtered catalogue
             -- to hunt for what they just found. Lowest playlist_id keeps the
             -- choice deterministic for a lesson shared by several courses;
             -- the subquery runs only on rows the index prefilter returned.
             (select pv.playlist_id
                from public.playlist_videos pv
               where pv.video_id = v.id
               order by pv.playlist_id
               limit 1) as playlist_id
        from public.videos v
        left join public.chapters ch on ch.id = v.chapter_id
        left join public.subjects s  on s.id = v.subject_id
       where (   public.search_latin_key(v.title) like '%' || q_long || '%'
              or public.search_latin_key(v.title) like q || '%'
              or public.search_latin_key(v.title) %> q_long )
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'lecture'::text, c.id, c.title, c.ctx, null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.title, false, c.total,
           -- extra is jsonb, so new keys are additive: the RETURNS TABLE
           -- signature is unchanged and older clients ignore what they do not
           -- read (see Home.jsx resultHref, which falls back when absent).
           jsonb_build_object('chapter_id', c.chapter_id, 'subject_id', c.subject_id,
                              'playlist_id', c.playlist_id,
                              'youtube_video_id', c.youtube_video_id)
      from counted c
     order by c.rk, length(c.title), c.title
     limit lim offset off;
  end if;

  ---------------------------------------------------------------- institutes
  if 'institute' = any(want) then
    return query
    with m as (
      select ic.id, ic.name,
             public.search_rank_tokens(public.search_latin_key(ic.name), q_tokens, q) as rk,
             (select count(*) from public.playlists pl where pl.channel_id = ic.id) as n
        from public.institutes_channels ic
       where (   public.search_latin_key(ic.name) like '%' || q_long || '%'
              or public.search_latin_key(ic.name) like q || '%'
              or public.search_latin_key(ic.name) %> q_long )
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'institute'::text, c.id, c.name,
           case when c.n = 0 then null
                else c.n || ' course' || case when c.n = 1 then '' else 's' end end,
           null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.name, false, c.total,
           jsonb_build_object('institute_id', c.id)
      from counted c
     order by c.rk, length(c.name), c.name
     limit lim offset off;
  end if;
end; $_$;


ALTER FUNCTION "public"."universal_search"("p_query" "text", "p_types" "text"[], "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."universal_search"("p_query" "text", "p_types" "text"[], "p_limit" integer, "p_offset" integer) IS 'Grouped, server-ranked, paginated search. Sargable trigram predicates, multi-token AND matching, word-similarity typo tolerance, Devanagari/Latin bridge. Faculty group appears only where teachers_v7 is installed. Chapter group hides content-less chapters.';



CREATE OR REPLACE FUNCTION "public"."update_managed_playlist"("p_playlist_id" bigint, "p_expected_title" "text", "p_title" "text", "p_teacher" "text", "p_channel_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[], "p_content_type" "text", "p_language" "text", "p_difficulty" "text", "p_audience_focus" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_playlist public.playlists%rowtype;
  v_title text := regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g');
  v_teacher text := nullif(regexp_replace(btrim(coalesce(p_teacher, '')), '\s+', ' ', 'g'), '');
  v_content_type text := nullif(btrim(coalesce(p_content_type, '')), '');
  v_language text := nullif(btrim(coalesce(p_language, '')), '');
  v_difficulty text := nullif(btrim(coalesce(p_difficulty, '')), '');
  v_audience_focus text := nullif(btrim(coalesce(p_audience_focus, '')), '');
  v_category_slug text;
  v_before jsonb;
  v_after jsonb;
  v_legacy_classes text[];
begin
  if not (
    public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select *
  into v_playlist
  from public.playlists
  where id = p_playlist_id
  for update;
  if not found then
    raise exception 'unknown playlist_id %', p_playlist_id;
  end if;
  if v_playlist.title is distinct from p_expected_title then
    raise exception 'expected title does not match current playlist title';
  end if;
  if char_length(v_title) < 3 or char_length(v_title) > 160 then
    raise exception 'title must contain 3 to 160 characters';
  end if;
  if not exists (
    select 1 from public.institutes_channels where id = p_channel_id
  ) then
    raise exception 'unknown channel_id %', p_channel_id;
  end if;
  if coalesce(cardinality(p_learning_goal_ids), 0) = 0 then
    raise exception 'at least one learning goal is required';
  end if;
  if coalesce(cardinality(p_class_level_ids), 0) = 0 then
    raise exception 'at least one class level is required';
  end if;
  if (
    select count(*) from unnest(p_learning_goal_ids) as goals(goal_id)
  ) <> (
    select count(distinct goal_id)
    from unnest(p_learning_goal_ids) as goals(goal_id)
  ) then
    raise exception 'duplicate learning goal ids are not allowed';
  end if;
  if (
    select count(*) from unnest(p_class_level_ids) as classes(class_id)
  ) <> (
    select count(distinct class_id)
    from unnest(p_class_level_ids) as classes(class_id)
  ) then
    raise exception 'duplicate class level ids are not allowed';
  end if;
  if exists (
    select 1
    from unnest(p_learning_goal_ids) as goals(goal_id)
    where not exists (
      select 1 from public.learning_goals where id = goals.goal_id
    )
  ) then
    raise exception 'unknown learning goal id';
  end if;
  if exists (
    select 1
    from unnest(p_class_level_ids) as classes(class_id)
    where not exists (
      select 1 from public.class_levels where id = classes.class_id
    )
  ) then
    raise exception 'unknown class level id';
  end if;

  select c.slug
  into v_category_slug
  from public.categories c
  where c.id = v_playlist.category_id;
  if exists (
    select 1
    from public.learning_goals lg
    where lg.id = any(p_learning_goal_ids)
      and lg.slug is distinct from v_category_slug
  ) then
    raise exception 'learning goal does not match the playlist category';
  end if;
  if v_category_slug in ('jee', 'neet') and exists (
    select 1
    from public.class_levels cl
    where cl.id = any(p_class_level_ids)
      and cl.slug not in ('class-11', 'class-12', 'dropper')
  ) then
    raise exception 'class level does not match the playlist category';
  end if;
  if v_content_type is not null and v_content_type not in (
    'full-course', 'one-shot', 'revision', 'pyq', 'practice'
  ) then
    raise exception 'invalid content type';
  end if;
  if v_language is not null and v_language not in (
    'hindi', 'english', 'hinglish'
  ) then
    raise exception 'invalid language';
  end if;
  if v_difficulty is not null and v_difficulty not in (
    'beginner', 'intermediate', 'advanced'
  ) then
    raise exception 'invalid difficulty';
  end if;
  if v_audience_focus is not null and not exists (
    select 1
    from public.class_levels cl
    where cl.id = any(p_class_level_ids)
      and v_audience_focus = case cl.slug
        when 'class-10' then '10th'
        when 'class-11' then '11th'
        when 'class-12' then '12th'
        when 'dropper' then 'dropper'
        else cl.slug
      end
  ) then
    raise exception 'audience focus must match a selected class level';
  end if;

  v_before := public.catalog_playlist_snapshot(p_playlist_id);

  update public.playlists
  set title = v_title,
      teacher = v_teacher,
      channel_id = p_channel_id,
      content_type = v_content_type,
      language = v_language,
      difficulty = v_difficulty,
      audience_focus = v_audience_focus
  where id = p_playlist_id;

  delete from public.playlist_learning_goals
  where playlist_id = p_playlist_id;
  insert into public.playlist_learning_goals (
    playlist_id, learning_goal_id
  )
  select p_playlist_id, goals.goal_id
  from unnest(p_learning_goal_ids) as goals(goal_id);

  delete from public.playlist_class_levels
  where playlist_id = p_playlist_id;
  insert into public.playlist_class_levels (
    playlist_id, class_level_id
  )
  select p_playlist_id, classes.class_id
  from unnest(p_class_level_ids) as classes(class_id);

  select coalesce(array_agg(
    case cl.slug
      when 'class-10' then '10th'
      when 'class-11' then '11th'
      when 'class-12' then '12th'
      when 'dropper' then 'dropper'
      else cl.slug
    end
    order by cl.display_order, cl.id
  ), '{}'::text[])
  into v_legacy_classes
  from public.class_levels cl
  where cl.id = any(p_class_level_ids);

  update public.playlists
  set class_levels = v_legacy_classes
  where id = p_playlist_id;

  v_after := public.catalog_playlist_snapshot(p_playlist_id);
  insert into public.catalog_management_audit (
    action, playlist_id, before_state, after_state, actor_id
  ) values (
    'update-playlist', p_playlist_id, v_before, v_after, auth.uid()
  );

  return jsonb_build_object(
    'playlist_id', p_playlist_id,
    'title', v_title,
    'learning_goals', cardinality(p_learning_goal_ids),
    'class_levels', cardinality(p_class_level_ids)
  );
end;
$$;


ALTER FUNCTION "public"."update_managed_playlist"("p_playlist_id" bigint, "p_expected_title" "text", "p_title" "text", "p_teacher" "text", "p_channel_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[], "p_content_type" "text", "p_language" "text", "p_difficulty" "text", "p_audience_focus" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_import_payload"("payload" "jsonb", "mode" "text", "require_videos" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  MAX_VIDEOS constant int := 500;
  MAX_SECS   constant int := 86400;          -- 24h per lecture
  v_goal_id bigint := nullif(payload->>'learning_goal_id','')::bigint;
  v_goal_slug text;
  v_category_id bigint := nullif(payload->>'category_id','')::bigint;
  v_subject_id  bigint := nullif(payload->>'subject_id','')::bigint;
  v_chapter_id  bigint := nullif(payload->>'chapter_id','')::bigint;
  v_labels text[]; v_class_ids bigint[]; v_board_ids bigint[];
  v_focus text := nullif(payload->>'audience_focus','');
  v_vids jsonb := payload->'videos'; v_count int;
  v_ypid text := nullif(payload->>'youtube_playlist_id','');
  v_vid_ids jsonb := payload->'video_ids'; v_vid_count int;
begin
  if mode not in ('merge','replace') then raise exception 'invalid mode %, expected merge|replace', mode; end if;
  if nullif(trim(payload->>'title'),'') is null then raise exception 'title is required'; end if;

  if require_videos and v_ypid is null then raise exception 'youtube_playlist_id is required'; end if;
  if v_ypid is not null and v_ypid !~ '^[A-Za-z0-9_-]{6,64}$' then
    raise exception 'invalid youtube_playlist_id format'; end if;
  if payload ? 'channel' and nullif(payload#>>'{channel,youtube_channel_id}','') is not null
     and (payload#>>'{channel,youtube_channel_id}') !~ '^[A-Za-z0-9_-]{6,64}$' then
    raise exception 'invalid youtube_channel_id format'; end if;

  if v_goal_id is null then
    raise exception 'learning_goal_id is required (it is no longer derived from the category)'; end if;
  select slug into v_goal_slug from public.learning_goals where id = v_goal_id;
  if v_goal_slug is null then raise exception 'invalid learning_goal_id %', v_goal_id; end if;

  if v_category_id is null or not exists (select 1 from public.categories where id = v_category_id) then
    raise exception 'invalid category_id %', v_category_id; end if;

  -- review item 1: the pair must be a declared, legal combination.
  if not exists (select 1 from public.category_learning_goals m
                 where m.category_id = v_category_id and m.learning_goal_id = v_goal_id) then
    raise exception 'category % is not valid for learning goal % (Browse and Explore would disagree)',
      v_category_id, v_goal_id;
  end if;

  if v_subject_id is null or not exists (select 1 from public.subjects where id = v_subject_id) then
    raise exception 'invalid subject_id %', v_subject_id; end if;
  if v_chapter_id is not null and not exists (
      select 1 from public.chapters where id = v_chapter_id and subject_id = v_subject_id) then
    raise exception 'chapter % does not belong to subject %', v_chapter_id, v_subject_id; end if;

  if payload ? 'board_ids' then
    if jsonb_typeof(payload->'board_ids') <> 'array' then raise exception 'board_ids must be an array'; end if;
    select coalesce(array_agg(x::bigint),'{}') into v_board_ids
      from jsonb_array_elements_text(payload->'board_ids') x;
    if exists (select 1 from unnest(v_board_ids) b
               where not exists (select 1 from public.boards where id = b)) then
      raise exception 'invalid board_id in %', v_board_ids; end if;
  else
    v_board_ids := '{}';
  end if;
  if v_goal_slug = 'school' and coalesce(array_length(v_board_ids,1),0) = 0 then
    raise exception 'school-board content requires at least one board_id'; end if;
  if v_goal_slug <> 'school' and coalesce(array_length(v_board_ids,1),0) > 0 then
    raise exception 'board_ids apply only to the School Boards learning goal'; end if;

  select coalesce(array_agg(x),'{}') into v_labels from jsonb_array_elements_text(payload->'class_labels') x;
  if array_length(v_labels,1) is null then raise exception 'at least one class label is required'; end if;
  if exists (select 1 from unnest(v_labels) l where public.class_label_to_slug(l) is null) then
    raise exception 'unknown class label in %', v_labels; end if;
  select coalesce(array_agg(cl.id),'{}') into v_class_ids
    from unnest(v_labels) label
    join public.class_levels cl on cl.slug = public.class_label_to_slug(label);
  if exists (
      select 1 from unnest(v_class_ids) cid
      where not exists (select 1 from public.learning_goal_class_levels m
                        where m.learning_goal_id = v_goal_id and m.class_level_id = cid)) then
    raise exception 'class % not valid for this learning goal', v_labels; end if;

  if v_focus is not null and not (v_focus = any(v_labels)) then
    raise exception 'audience_focus % is not among applicable classes %', v_focus, v_labels; end if;

  if nullif(payload->>'content_type','') is not null
     and payload->>'content_type' not in ('full-course','one-shot','revision','pyq','practice') then
    raise exception 'invalid content_type %', payload->>'content_type'; end if;
  if nullif(payload->>'language','') is not null
     and payload->>'language' not in ('hindi','english','hinglish') then
    raise exception 'invalid language %', payload->>'language'; end if;
  if nullif(payload->>'difficulty','') is not null
     and payload->>'difficulty' not in ('beginner','intermediate','advanced') then
    raise exception 'invalid difficulty %', payload->>'difficulty'; end if;

  -- ---- manual course: video_ids (review item 5) ----
  --
  -- The v4 check was `jsonb_typeof(e) <> 'number' or (e->>0) !~ '^[0-9]+$'`.
  -- `->>0` addresses an ARRAY ELEMENT; applied to a JSON scalar it returns
  -- NULL, so the regex arm was always NULL and never rejected anything. Only
  -- the type arm did any work — 0, -1, 1.5 and 10^30 all sailed through.
  -- `#>>'{}'` extracts the scalar itself, which is what was meant.
  if not require_videos then
    if v_vid_ids is null or jsonb_typeof(v_vid_ids) <> 'array' or jsonb_array_length(v_vid_ids) = 0 then
      raise exception 'video_ids must be a non-empty array'; end if;
    v_vid_count := jsonb_array_length(v_vid_ids);
    if v_vid_count > MAX_VIDEOS then
      raise exception 'too many videos (%, max %)', v_vid_count, MAX_VIDEOS; end if;
    -- number type rejects string/null/object/array/boolean;
    -- the pattern rejects 0, negatives, decimals and >18-digit overflow.
    if exists (select 1 from jsonb_array_elements(v_vid_ids) e
               where jsonb_typeof(e) <> 'number'
                  or (e#>>'{}') !~ '^[1-9][0-9]{0,17}$') then
      raise exception 'video_ids must all be positive whole numbers within range'; end if;
    if (select count(distinct x) from jsonb_array_elements_text(v_vid_ids) x) <> v_vid_count then
      raise exception 'duplicate video_id in payload'; end if;
    if exists (select 1 from jsonb_array_elements_text(v_vid_ids) x
               where not exists (select 1 from public.videos v where v.id = x::bigint)) then
      raise exception 'video_ids contains an id that does not exist'; end if;

    return jsonb_build_object('goal_id', v_goal_id, 'class_ids', to_jsonb(v_class_ids),
                              'board_ids', to_jsonb(v_board_ids), 'video_count', v_vid_count);
  end if;

  if v_vids is null or jsonb_typeof(v_vids) <> 'array' or jsonb_array_length(v_vids) = 0 then
    raise exception 'videos must be a non-empty array'; end if;
  v_count := jsonb_array_length(v_vids);
  if v_count > MAX_VIDEOS then raise exception 'playlist too large (% videos, max %)', v_count, MAX_VIDEOS; end if;
  if exists (select 1 from jsonb_array_elements(v_vids) e
             where (e->>'youtube_video_id') is null or (e->>'youtube_video_id') !~ '^[A-Za-z0-9_-]{11}$') then
    raise exception 'a video has a missing/invalid youtube_video_id'; end if;
  if (select count(distinct e->>'youtube_video_id') from jsonb_array_elements(v_vids) e) <> v_count then
    raise exception 'duplicate youtube_video_id in payload'; end if;
  if exists (select 1 from jsonb_array_elements(v_vids) e where nullif(trim(e->>'title'),'') is null) then
    raise exception 'a video has a blank title'; end if;
  if exists (select 1 from jsonb_array_elements(v_vids) e
             where (e->>'duration_seconds') is not null
               and ((e->>'duration_seconds')::int <= 0 or (e->>'duration_seconds')::int > MAX_SECS)) then
    raise exception 'a video has an out-of-range duration (1..% seconds)', MAX_SECS; end if;

  return jsonb_build_object('goal_id', v_goal_id, 'class_ids', to_jsonb(v_class_ids),
                            'board_ids', to_jsonb(v_board_ids), 'video_count', v_count);
end; $_$;


ALTER FUNCTION "public"."validate_import_payload"("payload" "jsonb", "mode" "text", "require_videos" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_study_material_scope"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  chapter_subject_id bigint;
  goal_slug text;
begin
  if new.chapter_id is not null then
    select c.subject_id into chapter_subject_id
      from public.chapters c
     where c.id = new.chapter_id;
    if chapter_subject_id is null then
      raise exception 'Unknown study material chapter id %', new.chapter_id;
    end if;
    if new.subject_id is null then
      new.subject_id := chapter_subject_id;
    elsif new.subject_id <> chapter_subject_id then
      raise exception 'Study material chapter and subject do not match';
    end if;
  end if;

  if new.board_id is not null then
    if new.learning_goal_id is null then
      raise exception 'A board-scoped material also requires a learning goal';
    end if;
    select lg.slug into goal_slug
      from public.learning_goals lg
     where lg.id = new.learning_goal_id;
    if goal_slug is distinct from 'school' then
      raise exception 'Board-scoped material must use the School learning goal';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_study_material_scope"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_teacher_ids_payload"("payload" "jsonb") RETURNS bigint[]
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare v_ids bigint[];
begin
  if not (payload ? 'teacher_ids') then
    raise exception 'teacher_ids key is required by the faculty import wrapper';
  end if;
  if jsonb_typeof(payload->'teacher_ids') <> 'array' then
    raise exception 'teacher_ids must be an array';
  end if;
  if exists (
    select 1 from jsonb_array_elements(payload->'teacher_ids') e
     where jsonb_typeof(e) <> 'number'
        or (e#>>'{}') !~ '^[1-9][0-9]{0,17}$') then
    raise exception 'teacher_ids must contain positive whole numbers within range';
  end if;

  select coalesce(array_agg(x::bigint order by ord), '{}'::bigint[])
    into v_ids
    from jsonb_array_elements_text(payload->'teacher_ids') with ordinality a(x, ord);

  if (select count(distinct x) from unnest(v_ids) x)
     <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'duplicate teacher_id in %', v_ids;
  end if;
  if exists (
    select 1 from unnest(v_ids) x
     where not exists (select 1 from public.teachers t where t.id = x)) then
    raise exception 'unknown teacher_id in %', v_ids;
  end if;
  return v_ids;
end; $_$;


ALTER FUNCTION "public"."validate_teacher_ids_payload"("payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."video_channel_still_matches"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_bad bigint;
begin
  if new.channel_id is not distinct from old.channel_id then
    return null;
  end if;

  select pv.playlist_id into v_bad
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
   where pv.video_id = new.id
     and p.channel_id is distinct from new.channel_id
   limit 1;

  if v_bad is not null then
    perform public.assert_playlist_video_channel(v_bad, new.id);
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."video_channel_still_matches"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_environment" (
    "id" boolean DEFAULT true NOT NULL,
    "name" "text" NOT NULL,
    CONSTRAINT "app_environment_id_check" CHECK ("id"),
    CONSTRAINT "app_environment_name_check" CHECK (("name" = ANY (ARRAY['production'::"text", 'staging'::"text", 'test'::"text"])))
);


ALTER TABLE "public"."app_environment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."boards" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."boards" OWNER TO "postgres";


ALTER TABLE "public"."boards" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."boards_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."catalog_management_audit" (
    "id" bigint NOT NULL,
    "action" "text" NOT NULL,
    "playlist_id" bigint,
    "video_id" bigint,
    "before_state" "jsonb" NOT NULL,
    "after_state" "jsonb",
    "actor_id" "uuid",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "catalog_management_audit_action_check" CHECK (("action" = ANY (ARRAY['update-playlist'::"text", 'set-video-taxonomy'::"text", 'clear-video-taxonomy'::"text", 'reassign-video-chapter'::"text", 'delete-playlist'::"text"])))
);


ALTER TABLE "public"."catalog_management_audit" OWNER TO "postgres";


ALTER TABLE "public"."catalog_management_audit" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."catalog_management_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


ALTER TABLE "public"."categories" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."categories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."category_learning_goals" (
    "category_id" bigint NOT NULL,
    "learning_goal_id" bigint NOT NULL
);


ALTER TABLE "public"."category_learning_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chapter_class_levels" (
    "chapter_id" bigint NOT NULL,
    "class_level_id" bigint NOT NULL,
    "source_url" "text" NOT NULL,
    "scope_note" "text" NOT NULL,
    "reviewed_on" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chapter_class_levels" OWNER TO "postgres";


COMMENT ON TABLE "public"."chapter_class_levels" IS 'Canonical academic class membership for chapters. Course audience tags must not determine this.';



CREATE TABLE IF NOT EXISTS "public"."chapters" (
    "id" bigint NOT NULL,
    "subject_id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "display_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chapters" OWNER TO "postgres";


ALTER TABLE "public"."chapters" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."chapters_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."class_levels" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."class_levels" OWNER TO "postgres";


ALTER TABLE "public"."class_levels" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."class_levels_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."class_levels_migration_audit" (
    "id" bigint NOT NULL,
    "playlist_id" bigint NOT NULL,
    "verdict" "text" NOT NULL,
    "array_labels" "text"[],
    "junction_labels" "text"[],
    "migrated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "run_id" "uuid"
);


ALTER TABLE "public"."class_levels_migration_audit" OWNER TO "postgres";


ALTER TABLE "public"."class_levels_migration_audit" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."class_levels_migration_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."content_reports" (
    "id" bigint NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" bigint NOT NULL,
    "reason" "text" NOT NULL,
    "note" "text",
    "reporter_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_reports_reason_check" CHECK (("reason" = ANY (ARRAY['broken'::"text", 'wrong-category'::"text", 'inappropriate'::"text", 'other'::"text"]))),
    CONSTRAINT "content_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "content_reports_target_type_check" CHECK (("target_type" = ANY (ARRAY['video'::"text", 'playlist'::"text"])))
);


ALTER TABLE "public"."content_reports" OWNER TO "postgres";


ALTER TABLE "public"."content_reports" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."content_reports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."forum_admin_transfer_state" (
    "id" boolean DEFAULT true NOT NULL,
    "previous_admin_id" "uuid" NOT NULL,
    "target_admin_id" "uuid" NOT NULL,
    "transferred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rolled_back_at" timestamp with time zone,
    CONSTRAINT "forum_admin_transfer_state_check" CHECK (("previous_admin_id" <> "target_admin_id")),
    CONSTRAINT "forum_admin_transfer_state_id_check" CHECK ("id")
);


ALTER TABLE "public"."forum_admin_transfer_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_beta_members" (
    "user_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "added_by" "uuid"
);


ALTER TABLE "public"."forum_beta_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_comments" (
    "id" bigint NOT NULL,
    "post_id" bigint NOT NULL,
    "author_id" "uuid",
    "parent_id" bigint,
    "body" "text" NOT NULL,
    "depth" integer DEFAULT 0 NOT NULL,
    "upvote_count" integer DEFAULT 0 NOT NULL,
    "downvote_count" integer DEFAULT 0 NOT NULL,
    "score" integer DEFAULT 0 NOT NULL,
    "hidden_at" timestamp with time zone,
    "hidden_by" "uuid",
    "hidden_reason" "text",
    "deleted_at" timestamp with time zone,
    "edited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_comments_depth_check" CHECK ((("depth" >= 0) AND ("depth" <= 10))),
    CONSTRAINT "forum_comments_downvote_count_check" CHECK (("downvote_count" >= 0)),
    CONSTRAINT "forum_comments_hidden_shape" CHECK ((("hidden_at" IS NOT NULL) OR (("hidden_by" IS NULL) AND ("hidden_reason" IS NULL)))),
    CONSTRAINT "forum_comments_live_body" CHECK ((("deleted_at" IS NOT NULL) OR (("char_length"("btrim"("body")) >= 1) AND ("char_length"("btrim"("body")) <= 10000)))),
    CONSTRAINT "forum_comments_score_matches_counts" CHECK (("score" = ("upvote_count" - "downvote_count"))),
    CONSTRAINT "forum_comments_upvote_count_check" CHECK (("upvote_count" >= 0))
);


ALTER TABLE "public"."forum_comments" OWNER TO "postgres";


ALTER TABLE "public"."forum_comments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."forum_comments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."forum_install_state" (
    "id" boolean DEFAULT true NOT NULL,
    "installed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "baseline_username_fingerprint" "text" NOT NULL,
    "installed_topic_fingerprint" "text" NOT NULL,
    "anon_insert_table" boolean NOT NULL,
    "anon_update_table" boolean NOT NULL,
    "authenticated_insert_table" boolean NOT NULL,
    "authenticated_update_table" boolean NOT NULL,
    "anon_insert_columns" "text"[] NOT NULL,
    "anon_update_columns" "text"[] NOT NULL,
    "authenticated_insert_columns" "text"[] NOT NULL,
    "authenticated_update_columns" "text"[] NOT NULL,
    CONSTRAINT "forum_install_state_id_check" CHECK ("id")
);


ALTER TABLE "public"."forum_install_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_moderation_log" (
    "id" bigint NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" bigint,
    "target_user_id" "uuid",
    "reason" "text",
    "report_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_moderation_log_action_check" CHECK (("action" = ANY (ARRAY['hide'::"text", 'unhide'::"text", 'lock'::"text", 'unlock'::"text", 'remove'::"text", 'solve'::"text", 'unsolve'::"text", 'auto_hide'::"text", 'suspend'::"text", 'unsuspend'::"text", 'set_mode'::"text", 'beta_add'::"text", 'beta_remove'::"text"]))),
    CONSTRAINT "forum_moderation_log_target_type_check" CHECK (("target_type" = ANY (ARRAY['post'::"text", 'comment'::"text", 'user'::"text", 'forum'::"text"]))),
    CONSTRAINT "forum_moderation_remove_reason" CHECK ((("action" <> 'remove'::"text") OR ("char_length"("btrim"(COALESCE("reason", ''::"text"))) >= 3)))
);


ALTER TABLE "public"."forum_moderation_log" OWNER TO "postgres";


ALTER TABLE "public"."forum_moderation_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."forum_moderation_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."forum_posts" (
    "id" bigint NOT NULL,
    "topic_id" bigint NOT NULL,
    "author_id" "uuid",
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "is_solved" boolean DEFAULT false NOT NULL,
    "upvote_count" integer DEFAULT 0 NOT NULL,
    "downvote_count" integer DEFAULT 0 NOT NULL,
    "score" integer DEFAULT 0 NOT NULL,
    "hot_rank" double precision DEFAULT 0 NOT NULL,
    "comment_count" integer DEFAULT 0 NOT NULL,
    "hidden_at" timestamp with time zone,
    "hidden_by" "uuid",
    "hidden_reason" "text",
    "locked_at" timestamp with time zone,
    "locked_by" "uuid",
    "deleted_at" timestamp with time zone,
    "edited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_posts_comment_count_check" CHECK (("comment_count" >= 0)),
    CONSTRAINT "forum_posts_downvote_count_check" CHECK (("downvote_count" >= 0)),
    CONSTRAINT "forum_posts_hidden_shape" CHECK ((("hidden_at" IS NOT NULL) OR (("hidden_by" IS NULL) AND ("hidden_reason" IS NULL)))),
    CONSTRAINT "forum_posts_live_body" CHECK ((("deleted_at" IS NOT NULL) OR (("char_length"("btrim"("body")) >= 1) AND ("char_length"("btrim"("body")) <= 20000)))),
    CONSTRAINT "forum_posts_live_title" CHECK ((("deleted_at" IS NOT NULL) OR (("char_length"("btrim"("title")) >= 10) AND ("char_length"("btrim"("title")) <= 300)))),
    CONSTRAINT "forum_posts_locked_shape" CHECK ((("locked_at" IS NOT NULL) OR ("locked_by" IS NULL))),
    CONSTRAINT "forum_posts_score_matches_counts" CHECK (("score" = ("upvote_count" - "downvote_count"))),
    CONSTRAINT "forum_posts_upvote_count_check" CHECK (("upvote_count" >= 0))
);


ALTER TABLE "public"."forum_posts" OWNER TO "postgres";


ALTER TABLE "public"."forum_posts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."forum_posts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."forum_rate_events" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "target_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_rate_events_action_check" CHECK (("action" = ANY (ARRAY['post'::"text", 'comment'::"text", 'edit_post'::"text", 'edit_comment'::"text", 'vote'::"text", 'report'::"text"])))
);


ALTER TABLE "public"."forum_rate_events" OWNER TO "postgres";


ALTER TABLE "public"."forum_rate_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."forum_rate_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."forum_reports" (
    "id" bigint NOT NULL,
    "reporter_id" "uuid",
    "target_type" "text" NOT NULL,
    "target_id" bigint NOT NULL,
    "reason" "text" NOT NULL,
    "note" "text",
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_reports_note_check" CHECK ((("note" IS NULL) OR ("char_length"("note") <= 1000))),
    CONSTRAINT "forum_reports_priority_check" CHECK (("priority" = ANY (ARRAY['normal'::"text", 'urgent'::"text"]))),
    CONSTRAINT "forum_reports_reason_check" CHECK (("reason" = ANY (ARRAY['spam'::"text", 'abuse_or_bullying'::"text", 'personal_information'::"text", 'sexual_content'::"text", 'self_harm'::"text", 'wrong_or_unsafe_advice'::"text", 'off_topic'::"text", 'other'::"text"]))),
    CONSTRAINT "forum_reports_resolution_shape" CHECK (((("status" = 'pending'::"text") AND ("resolved_at" IS NULL) AND ("resolved_by" IS NULL)) OR (("status" <> 'pending'::"text") AND ("resolved_at" IS NOT NULL)))),
    CONSTRAINT "forum_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "forum_reports_target_type_check" CHECK (("target_type" = ANY (ARRAY['post'::"text", 'comment'::"text"])))
);


ALTER TABLE "public"."forum_reports" OWNER TO "postgres";


ALTER TABLE "public"."forum_reports" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."forum_reports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."forum_settings" (
    "id" boolean DEFAULT true NOT NULL,
    "mode" "text" DEFAULT 'off'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "forum_settings_id_check" CHECK ("id"),
    CONSTRAINT "forum_settings_mode_check" CHECK (("mode" = ANY (ARRAY['off'::"text", 'read_only'::"text", 'beta'::"text", 'open'::"text"])))
);


ALTER TABLE "public"."forum_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_suspensions" (
    "user_id" "uuid" NOT NULL,
    "suspended_until" timestamp with time zone NOT NULL,
    "reason" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_suspensions_check" CHECK (("suspended_until" > "created_at")),
    CONSTRAINT "forum_suspensions_reason_check" CHECK ((("char_length"("btrim"("reason")) >= 3) AND ("char_length"("btrim"("reason")) <= 500)))
);


ALTER TABLE "public"."forum_suspensions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_topics" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "kind" "text" NOT NULL,
    "display_order" integer DEFAULT 1000 NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_topics_description_check" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 240))),
    CONSTRAINT "forum_topics_kind_check" CHECK (("kind" = ANY (ARRAY['academic'::"text", 'non_academic'::"text"]))),
    CONSTRAINT "forum_topics_name_check" CHECK ((("char_length"("btrim"("name")) >= 2) AND ("char_length"("btrim"("name")) <= 50))),
    CONSTRAINT "forum_topics_slug_check" CHECK (("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text"))
);


ALTER TABLE "public"."forum_topics" OWNER TO "postgres";


ALTER TABLE "public"."forum_topics" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."forum_topics_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."forum_user_stats" (
    "user_id" "uuid" NOT NULL,
    "karma" integer DEFAULT 0 NOT NULL,
    "post_count" integer DEFAULT 0 NOT NULL,
    "comment_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_user_stats_comment_count_check" CHECK (("comment_count" >= 0)),
    CONSTRAINT "forum_user_stats_post_count_check" CHECK (("post_count" >= 0))
);


ALTER TABLE "public"."forum_user_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_votes" (
    "id" bigint NOT NULL,
    "voter_id" "uuid" NOT NULL,
    "target_author_id" "uuid",
    "post_id" bigint,
    "comment_id" bigint,
    "value" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_votes_exactly_one_target" CHECK (((("post_id" IS NOT NULL) AND ("comment_id" IS NULL)) OR (("post_id" IS NULL) AND ("comment_id" IS NOT NULL)))),
    CONSTRAINT "forum_votes_value_check" CHECK (("value" = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE "public"."forum_votes" OWNER TO "postgres";


ALTER TABLE "public"."forum_votes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."forum_votes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."institutes_channels" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "youtube_channel_id" "text" NOT NULL,
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."institutes_channels" OWNER TO "postgres";


ALTER TABLE "public"."institutes_channels" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."institutes_channels_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."learning_goal_class_levels" (
    "learning_goal_id" bigint NOT NULL,
    "class_level_id" bigint NOT NULL
);


ALTER TABLE "public"."learning_goal_class_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learning_goal_topics" (
    "learning_goal_id" bigint NOT NULL,
    "topic_id" bigint NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."learning_goal_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learning_goals" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."learning_goals" OWNER TO "postgres";


ALTER TABLE "public"."learning_goals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."learning_goals_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."playlist_attributes" (
    "playlist_id" bigint NOT NULL,
    "pacing" "text",
    "theory_percentage" smallint,
    "prerequisites_level" "text",
    "completeness_status" "text" DEFAULT 'unassessed'::"text" NOT NULL,
    "best_for" "text",
    "review_status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "evidence_note" "text",
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "playlist_attributes_check" CHECK ((("review_status" <> 'verified'::"text") OR ("verified_at" IS NOT NULL))),
    CONSTRAINT "playlist_attributes_completeness_status_check" CHECK (("completeness_status" = ANY (ARRAY['unassessed'::"text", 'partial'::"text", 'complete'::"text"]))),
    CONSTRAINT "playlist_attributes_pacing_check" CHECK ((("pacing" IS NULL) OR ("pacing" = ANY (ARRAY['slow'::"text", 'moderate'::"text", 'fast'::"text", 'crash-course'::"text"])))),
    CONSTRAINT "playlist_attributes_prerequisites_level_check" CHECK ((("prerequisites_level" IS NULL) OR ("prerequisites_level" = ANY (ARRAY['none'::"text", 'basic'::"text", 'intermediate'::"text", 'advanced'::"text"])))),
    CONSTRAINT "playlist_attributes_review_status_check" CHECK (("review_status" = ANY (ARRAY['proposed'::"text", 'verified'::"text", 'rejected'::"text"]))),
    CONSTRAINT "playlist_attributes_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'import'::"text", 'editorial-review'::"text"]))),
    CONSTRAINT "playlist_attributes_theory_percentage_check" CHECK ((("theory_percentage" IS NULL) OR (("theory_percentage" >= 0) AND ("theory_percentage" <= 100))))
);


ALTER TABLE "public"."playlist_attributes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."playlist_boards" (
    "playlist_id" bigint NOT NULL,
    "board_id" bigint NOT NULL
);


ALTER TABLE "public"."playlist_boards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."playlist_class_levels" (
    "playlist_id" bigint NOT NULL,
    "class_level_id" bigint NOT NULL
);


ALTER TABLE "public"."playlist_class_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."playlist_import_audit" (
    "id" bigint NOT NULL,
    "request_id" "uuid" NOT NULL,
    "youtube_playlist_id" "text" NOT NULL,
    "playlist_id" bigint,
    "request_payload" "jsonb" NOT NULL,
    "before_state" "jsonb" NOT NULL,
    "after_state" "jsonb" NOT NULL,
    "result" "jsonb" NOT NULL,
    "actor_id" "uuid",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."playlist_import_audit" OWNER TO "postgres";


ALTER TABLE "public"."playlist_import_audit" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."playlist_import_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."playlist_learning_goals" (
    "playlist_id" bigint NOT NULL,
    "learning_goal_id" bigint NOT NULL
);


ALTER TABLE "public"."playlist_learning_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."playlist_quality_reviews" (
    "id" bigint NOT NULL,
    "playlist_id" bigint NOT NULL,
    "before_state" "jsonb" NOT NULL,
    "after_state" "jsonb" NOT NULL,
    "note" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."playlist_quality_reviews" OWNER TO "postgres";


ALTER TABLE "public"."playlist_quality_reviews" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."playlist_quality_reviews_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."playlist_ratings" (
    "id" bigint NOT NULL,
    "playlist_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "review" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clarity_rating" integer,
    "question_rating" integer,
    "difficulty" "text",
    "best_for" "text",
    "review_hidden" boolean DEFAULT false NOT NULL,
    "review_hidden_at" timestamp with time zone,
    "review_hidden_by" "uuid",
    CONSTRAINT "playlist_ratings_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "plr_best_for_check" CHECK ((("best_for" IS NULL) OR ("best_for" = ANY (ARRAY['first-learning'::"text", 'revision'::"text", 'practice'::"text"])))),
    CONSTRAINT "plr_clarity_range" CHECK ((("clarity_rating" IS NULL) OR (("clarity_rating" >= 1) AND ("clarity_rating" <= 5)))),
    CONSTRAINT "plr_difficulty_check" CHECK ((("difficulty" IS NULL) OR ("difficulty" = ANY (ARRAY['beginner'::"text", 'moderate'::"text", 'advanced'::"text"])))),
    CONSTRAINT "plr_question_range" CHECK ((("question_rating" IS NULL) OR (("question_rating" >= 1) AND ("question_rating" <= 5)))),
    CONSTRAINT "plr_review_length" CHECK ((("review" IS NULL) OR ("char_length"("review") <= 1000)))
);


ALTER TABLE "public"."playlist_ratings" OWNER TO "postgres";


ALTER TABLE "public"."playlist_ratings" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."playlist_ratings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."playlist_teachers" (
    "playlist_id" bigint NOT NULL,
    "teacher_id" bigint NOT NULL,
    "role" "text" DEFAULT 'instructor'::"text" NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "playlist_teachers_role_check" CHECK (("role" = ANY (ARRAY['instructor'::"text", 'co-instructor'::"text", 'guest'::"text"])))
);


ALTER TABLE "public"."playlist_teachers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."playlist_videos" (
    "id" bigint NOT NULL,
    "playlist_id" bigint NOT NULL,
    "video_id" bigint NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."playlist_videos" OWNER TO "postgres";


ALTER TABLE "public"."playlist_videos" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."playlist_videos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."playlists" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "slug" "text",
    "channel_id" bigint NOT NULL,
    "category_id" bigint,
    "subject_id" bigint,
    "thumbnail_url" "text",
    "display_order" integer DEFAULT 1000000 NOT NULL,
    "average_rating" numeric(3,2) DEFAULT 0 NOT NULL,
    "ratings_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "teacher" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "youtube_playlist_id" "text",
    "class_levels" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "content_type" "text",
    "language" "text",
    "difficulty" "text",
    "last_verified_at" timestamp with time zone,
    "audience_focus" "text",
    "view_count_total" bigint DEFAULT 0 NOT NULL,
    "popularity_score" numeric DEFAULT 0 NOT NULL,
    "stats_fetched_at" timestamp with time zone,
    "source_title" "text",
    "source_title_changed" boolean DEFAULT false NOT NULL,
    "title_review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "faculty_credit_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    CONSTRAINT "playlists_content_type_check" CHECK ((("content_type" IS NULL) OR ("content_type" = ANY (ARRAY['full-course'::"text", 'one-shot'::"text", 'revision'::"text", 'pyq'::"text", 'practice'::"text"])))),
    CONSTRAINT "playlists_difficulty_check" CHECK ((("difficulty" IS NULL) OR ("difficulty" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"])))),
    CONSTRAINT "playlists_faculty_credit_status_check" CHECK (("faculty_credit_status" = ANY (ARRAY['pending'::"text", 'identified'::"text", 'team'::"text", 'unknown'::"text"]))),
    CONSTRAINT "playlists_language_check" CHECK ((("language" IS NULL) OR ("language" = ANY (ARRAY['hindi'::"text", 'english'::"text", 'hinglish'::"text"])))),
    CONSTRAINT "playlists_title_review_status_check" CHECK (("title_review_status" = ANY (ARRAY['pending'::"text", 'approved'::"text"])))
);


ALTER TABLE "public"."playlists" OWNER TO "postgres";


ALTER TABLE "public"."playlists" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."playlists_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."poll_comments" (
    "id" bigint NOT NULL,
    "poll_id" bigint NOT NULL,
    "author_id" "uuid",
    "body" "text" NOT NULL,
    "is_removed" boolean DEFAULT false NOT NULL,
    "removed_by" "uuid",
    "removed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    CONSTRAINT "poll_comments_body_check" CHECK ((("char_length"("btrim"("body")) >= 2) AND ("char_length"("btrim"("body")) <= 1500)))
);


ALTER TABLE "public"."poll_comments" OWNER TO "postgres";


ALTER TABLE "public"."poll_comments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."poll_comments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."poll_image_hosts" (
    "host" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "poll_image_hosts_host_check" CHECK ((("host" = "lower"("host")) AND ("host" ~ '^[a-z0-9.-]+$'::"text")))
);


ALTER TABLE "public"."poll_image_hosts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poll_options" (
    "id" bigint NOT NULL,
    "poll_id" bigint NOT NULL,
    "position" smallint NOT NULL,
    "label" "text" NOT NULL,
    "image_url" "text",
    "vote_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "poll_options_image_url_check" CHECK ((("image_url" IS NULL) OR ("image_url" ~ '^https://[a-z0-9.-]+/'::"text"))),
    CONSTRAINT "poll_options_label_check" CHECK ((("char_length"("btrim"("label")) >= 1) AND ("char_length"("btrim"("label")) <= 80))),
    CONSTRAINT "poll_options_position_check" CHECK ((("position" >= 1) AND ("position" <= 6))),
    CONSTRAINT "poll_options_vote_count_check" CHECK (("vote_count" >= 0))
);


ALTER TABLE "public"."poll_options" OWNER TO "postgres";


ALTER TABLE "public"."poll_options" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."poll_options_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."poll_rate_events" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "target_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "poll_rate_events_action_check" CHECK (("action" = ANY (ARRAY['submit'::"text", 'vote'::"text", 'comment'::"text", 'report'::"text"])))
);


ALTER TABLE "public"."poll_rate_events" OWNER TO "postgres";


ALTER TABLE "public"."poll_rate_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."poll_rate_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."poll_reports" (
    "id" bigint NOT NULL,
    "target_type" "text" NOT NULL,
    "poll_id" bigint,
    "comment_id" bigint,
    "reporter_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "detail" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    CONSTRAINT "poll_reports_check" CHECK (((("target_type" = 'poll'::"text") AND ("poll_id" IS NOT NULL) AND ("comment_id" IS NULL)) OR (("target_type" = 'comment'::"text") AND ("comment_id" IS NOT NULL) AND ("poll_id" IS NULL)))),
    CONSTRAINT "poll_reports_detail_check" CHECK ((("detail" IS NULL) OR ("char_length"("btrim"("detail")) <= 500))),
    CONSTRAINT "poll_reports_reason_check" CHECK (("reason" = ANY (ARRAY['spam'::"text", 'abuse'::"text", 'personal_information'::"text", 'off_topic'::"text", 'misinformation'::"text", 'other'::"text"]))),
    CONSTRAINT "poll_reports_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'actioned'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "poll_reports_target_type_check" CHECK (("target_type" = ANY (ARRAY['poll'::"text", 'comment'::"text"])))
);


ALTER TABLE "public"."poll_reports" OWNER TO "postgres";


ALTER TABLE "public"."poll_reports" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."poll_reports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."poll_settings" (
    "id" boolean DEFAULT true NOT NULL,
    "mode" "text" DEFAULT 'off'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "poll_settings_id_check" CHECK ("id"),
    CONSTRAINT "poll_settings_mode_check" CHECK (("mode" = ANY (ARRAY['off'::"text", 'read_only'::"text", 'open'::"text"])))
);


ALTER TABLE "public"."poll_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poll_votes" (
    "poll_id" bigint NOT NULL,
    "voter_id" "uuid" NOT NULL,
    "option_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."poll_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."polls" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "topic_id" bigint NOT NULL,
    "question" "text" NOT NULL,
    "detail" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "author_id" "uuid",
    "review_note" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "closes_at" timestamp with time zone,
    "vote_count" integer DEFAULT 0 NOT NULL,
    "comment_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "polls_check" CHECK ((("status" <> ALL (ARRAY['live'::"text", 'closed'::"text"])) OR (("reviewed_at" IS NOT NULL) AND ("published_at" IS NOT NULL)))),
    CONSTRAINT "polls_check1" CHECK ((("closes_at" IS NULL) OR ("published_at" IS NULL) OR ("closes_at" > "published_at"))),
    CONSTRAINT "polls_comment_count_check" CHECK (("comment_count" >= 0)),
    CONSTRAINT "polls_detail_check" CHECK ((("detail" IS NULL) OR ("char_length"("btrim"("detail")) <= 600))),
    CONSTRAINT "polls_question_check" CHECK ((("char_length"("btrim"("question")) >= 10) AND ("char_length"("btrim"("question")) <= 160))),
    CONSTRAINT "polls_review_note_check" CHECK ((("review_note" IS NULL) OR ("char_length"("btrim"("review_note")) <= 500))),
    CONSTRAINT "polls_slug_check" CHECK (("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text")),
    CONSTRAINT "polls_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'live'::"text", 'rejected'::"text", 'closed'::"text", 'hidden'::"text"]))),
    CONSTRAINT "polls_vote_count_check" CHECK (("vote_count" >= 0))
);


ALTER TABLE "public"."polls" OWNER TO "postgres";


ALTER TABLE "public"."polls" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."polls_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_material_scopes" (
    "id" bigint NOT NULL,
    "material_id" bigint NOT NULL,
    "learning_goal_id" bigint,
    "board_id" bigint,
    "class_level_id" bigint,
    "subject_id" bigint,
    "chapter_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "study_material_scopes_not_empty" CHECK ((("learning_goal_id" IS NOT NULL) OR ("board_id" IS NOT NULL) OR ("class_level_id" IS NOT NULL) OR ("subject_id" IS NOT NULL) OR ("chapter_id" IS NOT NULL)))
);


ALTER TABLE "public"."study_material_scopes" OWNER TO "postgres";


ALTER TABLE "public"."study_material_scopes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."study_material_scopes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."study_material_videos" (
    "material_id" bigint NOT NULL,
    "video_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."study_material_videos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_materials" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "material_type" "text" NOT NULL,
    "source_name" "text" NOT NULL,
    "source_url" "text" NOT NULL,
    "preview_image_url" "text",
    "file_format" "text" DEFAULT 'web'::"text" NOT NULL,
    "language" "text" DEFAULT 'English'::"text" NOT NULL,
    "exam_year" integer,
    "page_count" integer,
    "is_downloadable" boolean DEFAULT false NOT NULL,
    "rights_status" "text" NOT NULL,
    "rights_note" "text",
    "review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "study_materials_description_length" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 1000))),
    CONSTRAINT "study_materials_exam_year_check" CHECK ((("exam_year" IS NULL) OR (("exam_year" >= 2000) AND ("exam_year" <= 2100)))),
    CONSTRAINT "study_materials_file_format_check" CHECK (("file_format" = ANY (ARRAY['web'::"text", 'pdf'::"text"]))),
    CONSTRAINT "study_materials_https_preview" CHECK ((("preview_image_url" IS NULL) OR ("preview_image_url" ~ '^https://[^[:space:]]+$'::"text"))),
    CONSTRAINT "study_materials_https_source" CHECK (("source_url" ~ '^https://[^[:space:]]+$'::"text")),
    CONSTRAINT "study_materials_language_check" CHECK (("language" = ANY (ARRAY['English'::"text", 'Hindi'::"text", 'Hinglish'::"text"]))),
    CONSTRAINT "study_materials_page_count_check" CHECK ((("page_count" IS NULL) OR ("page_count" > 0))),
    CONSTRAINT "study_materials_publish_gate" CHECK (((("review_status" = 'approved'::"text") AND ("published_at" IS NOT NULL)) OR (("review_status" <> 'approved'::"text") AND ("published_at" IS NULL)))),
    CONSTRAINT "study_materials_review_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "study_materials_rights_check" CHECK (("rights_status" = ANY (ARRAY['official_source'::"text", 'open_license'::"text", 'creator_permission'::"text"]))),
    CONSTRAINT "study_materials_source_name_length" CHECK ((("char_length"("btrim"("source_name")) >= 2) AND ("char_length"("btrim"("source_name")) <= 120))),
    CONSTRAINT "study_materials_title_length" CHECK ((("char_length"("btrim"("title")) >= 3) AND ("char_length"("btrim"("title")) <= 180))),
    CONSTRAINT "study_materials_type_check" CHECK (("material_type" = ANY (ARRAY['short_notes'::"text", 'formula_sheet'::"text", 'full_notes'::"text", 'previous_year_paper'::"text"])))
);


ALTER TABLE "public"."study_materials" OWNER TO "postgres";


ALTER TABLE "public"."study_materials" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."study_materials_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."subjects" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subjects" OWNER TO "postgres";


ALTER TABLE "public"."subjects" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."subjects_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."teacher_aliases" (
    "id" bigint NOT NULL,
    "teacher_id" bigint NOT NULL,
    "alias" "text" NOT NULL,
    "normalized_alias" "text" NOT NULL,
    "alias_type" "text" DEFAULT 'nickname'::"text" NOT NULL,
    "status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_by" "uuid",
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "teacher_aliases_alias_type_check" CHECK (("alias_type" = ANY (ARRAY['full-name'::"text", 'short'::"text", 'initials'::"text", 'nickname'::"text", 'maiden'::"text", 'transliteration'::"text", 'misspelling'::"text"]))),
    CONSTRAINT "teacher_aliases_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'migrated'::"text", 'import'::"text", 'student-report'::"text"]))),
    CONSTRAINT "teacher_aliases_status_check" CHECK (("status" = ANY (ARRAY['proposed'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."teacher_aliases" OWNER TO "postgres";


ALTER TABLE "public"."teacher_aliases" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."teacher_aliases_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."teacher_institutes" (
    "teacher_id" bigint NOT NULL,
    "institute_id" bigint NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."teacher_institutes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_learning_goals" (
    "teacher_id" bigint NOT NULL,
    "learning_goal_id" bigint NOT NULL
);


ALTER TABLE "public"."teacher_learning_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_name_proposals" (
    "id" bigint NOT NULL,
    "raw_teacher" "text" NOT NULL,
    "normalized" "text",
    "occurrences" integer DEFAULT 0 NOT NULL,
    "kind" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "resolved_teacher_ids" bigint[],
    "note" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "teacher_name_proposals_kind_check" CHECK (("kind" = ANY (ARRAY['single'::"text", 'multi-person'::"text", 'organization-or-team'::"text", 'blank'::"text"]))),
    CONSTRAINT "teacher_name_proposals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved-existing'::"text", 'approved-new'::"text", 'split'::"text", 'rejected'::"text", 'deferred'::"text"])))
);


ALTER TABLE "public"."teacher_name_proposals" OWNER TO "postgres";


ALTER TABLE "public"."teacher_name_proposals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."teacher_name_proposals_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."teacher_proposal_decisions" (
    "id" bigint NOT NULL,
    "proposal_id" bigint NOT NULL,
    "raw_teacher" "text" NOT NULL,
    "decision" "text" NOT NULL,
    "teacher_ids" bigint[],
    "note" "text",
    "decided_by" "uuid",
    "decided_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "teacher_proposal_decisions_decision_check" CHECK (("decision" = ANY (ARRAY['approved-existing'::"text", 'approved-new'::"text", 'split'::"text", 'rejected'::"text", 'deferred'::"text"])))
);


ALTER TABLE "public"."teacher_proposal_decisions" OWNER TO "postgres";


ALTER TABLE "public"."teacher_proposal_decisions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."teacher_proposal_decisions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."teacher_subjects" (
    "teacher_id" bigint NOT NULL,
    "subject_id" bigint NOT NULL
);


ALTER TABLE "public"."teacher_subjects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teachers" (
    "id" bigint NOT NULL,
    "display_name" "text" NOT NULL,
    "canonical_name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "bio" "text",
    "photo_url" "text",
    "verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teachers" OWNER TO "postgres";


ALTER TABLE "public"."teachers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."teachers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."topics" (
    "id" bigint NOT NULL,
    "chapter_id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."topics" OWNER TO "postgres";


ALTER TABLE "public"."topics" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."topics_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."video_class_levels" (
    "video_id" bigint NOT NULL,
    "class_level_id" bigint NOT NULL
);


ALTER TABLE "public"."video_class_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_comments" (
    "id" bigint NOT NULL,
    "video_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parent_id" bigint,
    "body" "text" NOT NULL,
    "timestamp_seconds" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "video_comments_body_check" CHECK (("char_length"("body") > 0))
);


ALTER TABLE "public"."video_comments" OWNER TO "postgres";


ALTER TABLE "public"."video_comments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."video_comments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."video_learning_goals" (
    "video_id" bigint NOT NULL,
    "learning_goal_id" bigint NOT NULL
);


ALTER TABLE "public"."video_learning_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_progress" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "playlist_id" bigint NOT NULL,
    "video_id" bigint NOT NULL,
    "chapter_id" bigint,
    "position_seconds" numeric DEFAULT 0 NOT NULL,
    "duration_seconds" numeric,
    "watched" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "video_progress_duration_seconds_check" CHECK ((("duration_seconds" IS NULL) OR ("duration_seconds" >= (0)::numeric))),
    CONSTRAINT "video_progress_position_seconds_check" CHECK (("position_seconds" >= (0)::numeric))
);


ALTER TABLE "public"."video_progress" OWNER TO "postgres";


ALTER TABLE "public"."video_progress" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."video_progress_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."video_stats" (
    "video_id" bigint NOT NULL,
    "view_count" bigint,
    "like_count" bigint,
    "views_per_day" numeric,
    "popularity_score" numeric DEFAULT 0 NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."video_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_teachers" (
    "video_id" bigint NOT NULL,
    "teacher_id" bigint NOT NULL
);


ALTER TABLE "public"."video_teachers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_topics" (
    "video_id" bigint NOT NULL,
    "topic_id" bigint NOT NULL,
    "coverage_kind" "text" DEFAULT 'theory'::"text" NOT NULL,
    "review_status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "video_topics_check" CHECK ((("review_status" <> 'verified'::"text") OR ("verified_at" IS NOT NULL))),
    CONSTRAINT "video_topics_coverage_kind_check" CHECK (("coverage_kind" = ANY (ARRAY['theory'::"text", 'practice'::"text", 'pyq'::"text", 'mixed'::"text"]))),
    CONSTRAINT "video_topics_review_status_check" CHECK (("review_status" = ANY (ARRAY['proposed'::"text", 'verified'::"text", 'rejected'::"text"]))),
    CONSTRAINT "video_topics_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'import'::"text", 'editorial-review'::"text"])))
);


ALTER TABLE "public"."video_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."videos" (
    "id" bigint NOT NULL,
    "youtube_video_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "channel_id" bigint NOT NULL,
    "category_id" bigint NOT NULL,
    "subject_id" bigint NOT NULL,
    "chapter_id" bigint,
    "published_at" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duration_seconds" integer,
    "caption_status" "text",
    "embedding_status" "text",
    "last_verified_at" timestamp with time zone,
    "source_title" "text"
);


ALTER TABLE "public"."videos" OWNER TO "postgres";


ALTER TABLE "public"."videos" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."videos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."app_environment"
    ADD CONSTRAINT "app_environment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."catalog_management_audit"
    ADD CONSTRAINT "catalog_management_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."category_learning_goals"
    ADD CONSTRAINT "category_learning_goals_pkey" PRIMARY KEY ("category_id", "learning_goal_id");



ALTER TABLE ONLY "public"."chapter_class_levels"
    ADD CONSTRAINT "chapter_class_levels_pkey" PRIMARY KEY ("chapter_id", "class_level_id");



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_subject_id_name_key" UNIQUE ("subject_id", "name");



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_subject_id_slug_key" UNIQUE ("subject_id", "slug");



ALTER TABLE ONLY "public"."class_levels_migration_audit"
    ADD CONSTRAINT "class_levels_migration_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_levels"
    ADD CONSTRAINT "class_levels_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."class_levels"
    ADD CONSTRAINT "class_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_levels"
    ADD CONSTRAINT "class_levels_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_admin_transfer_state"
    ADD CONSTRAINT "forum_admin_transfer_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_beta_members"
    ADD CONSTRAINT "forum_beta_members_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_id_post_unique" UNIQUE ("id", "post_id");



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_install_state"
    ADD CONSTRAINT "forum_install_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_moderation_log"
    ADD CONSTRAINT "forum_moderation_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_posts"
    ADD CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_rate_events"
    ADD CONSTRAINT "forum_rate_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_reports"
    ADD CONSTRAINT "forum_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_settings"
    ADD CONSTRAINT "forum_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_suspensions"
    ADD CONSTRAINT "forum_suspensions_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."forum_topics"
    ADD CONSTRAINT "forum_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_topics"
    ADD CONSTRAINT "forum_topics_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."forum_user_stats"
    ADD CONSTRAINT "forum_user_stats_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."forum_votes"
    ADD CONSTRAINT "forum_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institutes_channels"
    ADD CONSTRAINT "institutes_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institutes_channels"
    ADD CONSTRAINT "institutes_channels_youtube_channel_id_key" UNIQUE ("youtube_channel_id");



ALTER TABLE ONLY "public"."learning_goal_class_levels"
    ADD CONSTRAINT "learning_goal_class_levels_pkey" PRIMARY KEY ("learning_goal_id", "class_level_id");



ALTER TABLE ONLY "public"."learning_goal_topics"
    ADD CONSTRAINT "learning_goal_topics_pkey" PRIMARY KEY ("learning_goal_id", "topic_id");



ALTER TABLE ONLY "public"."learning_goals"
    ADD CONSTRAINT "learning_goals_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."learning_goals"
    ADD CONSTRAINT "learning_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_goals"
    ADD CONSTRAINT "learning_goals_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."playlist_attributes"
    ADD CONSTRAINT "playlist_attributes_pkey" PRIMARY KEY ("playlist_id");



ALTER TABLE ONLY "public"."playlist_boards"
    ADD CONSTRAINT "playlist_boards_pkey" PRIMARY KEY ("playlist_id", "board_id");



ALTER TABLE ONLY "public"."playlist_class_levels"
    ADD CONSTRAINT "playlist_class_levels_pkey" PRIMARY KEY ("playlist_id", "class_level_id");



ALTER TABLE ONLY "public"."playlist_import_audit"
    ADD CONSTRAINT "playlist_import_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playlist_import_audit"
    ADD CONSTRAINT "playlist_import_audit_request_id_key" UNIQUE ("request_id");



ALTER TABLE ONLY "public"."playlist_learning_goals"
    ADD CONSTRAINT "playlist_learning_goals_pkey" PRIMARY KEY ("playlist_id", "learning_goal_id");



ALTER TABLE ONLY "public"."playlist_quality_reviews"
    ADD CONSTRAINT "playlist_quality_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playlist_ratings"
    ADD CONSTRAINT "playlist_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playlist_ratings"
    ADD CONSTRAINT "playlist_ratings_playlist_id_user_id_key" UNIQUE ("playlist_id", "user_id");



ALTER TABLE ONLY "public"."playlist_teachers"
    ADD CONSTRAINT "playlist_teachers_pkey" PRIMARY KEY ("playlist_id", "teacher_id");



ALTER TABLE ONLY "public"."playlist_videos"
    ADD CONSTRAINT "playlist_videos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playlist_videos"
    ADD CONSTRAINT "playlist_videos_playlist_id_video_id_key" UNIQUE ("playlist_id", "video_id");



ALTER TABLE ONLY "public"."playlists"
    ADD CONSTRAINT "playlists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playlists"
    ADD CONSTRAINT "playlists_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."poll_comments"
    ADD CONSTRAINT "poll_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_image_hosts"
    ADD CONSTRAINT "poll_image_hosts_pkey" PRIMARY KEY ("host");



ALTER TABLE ONLY "public"."poll_options"
    ADD CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_options"
    ADD CONSTRAINT "poll_options_poll_id_position_key" UNIQUE ("poll_id", "position");



ALTER TABLE ONLY "public"."poll_rate_events"
    ADD CONSTRAINT "poll_rate_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_reports"
    ADD CONSTRAINT "poll_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_settings"
    ADD CONSTRAINT "poll_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("poll_id", "voter_id");



ALTER TABLE ONLY "public"."polls"
    ADD CONSTRAINT "polls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."polls"
    ADD CONSTRAINT "polls_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."study_material_scopes"
    ADD CONSTRAINT "study_material_scopes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_material_videos"
    ADD CONSTRAINT "study_material_videos_pkey" PRIMARY KEY ("material_id", "video_id");



ALTER TABLE ONLY "public"."study_materials"
    ADD CONSTRAINT "study_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_materials"
    ADD CONSTRAINT "study_materials_source_identity" UNIQUE ("title", "source_url");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."teacher_aliases"
    ADD CONSTRAINT "teacher_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_aliases"
    ADD CONSTRAINT "teacher_aliases_teacher_id_normalized_alias_key" UNIQUE ("teacher_id", "normalized_alias");



ALTER TABLE ONLY "public"."teacher_institutes"
    ADD CONSTRAINT "teacher_institutes_pkey" PRIMARY KEY ("teacher_id", "institute_id");



ALTER TABLE ONLY "public"."teacher_learning_goals"
    ADD CONSTRAINT "teacher_learning_goals_pkey" PRIMARY KEY ("teacher_id", "learning_goal_id");



ALTER TABLE ONLY "public"."teacher_name_proposals"
    ADD CONSTRAINT "teacher_name_proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_name_proposals"
    ADD CONSTRAINT "teacher_name_proposals_raw_teacher_key" UNIQUE ("raw_teacher");



ALTER TABLE ONLY "public"."teacher_proposal_decisions"
    ADD CONSTRAINT "teacher_proposal_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_subjects"
    ADD CONSTRAINT "teacher_subjects_pkey" PRIMARY KEY ("teacher_id", "subject_id");



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_chapter_id_name_key" UNIQUE ("chapter_id", "name");



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_chapter_id_slug_key" UNIQUE ("chapter_id", "slug");



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_class_levels"
    ADD CONSTRAINT "video_class_levels_pkey" PRIMARY KEY ("video_id", "class_level_id");



ALTER TABLE ONLY "public"."video_comments"
    ADD CONSTRAINT "video_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_learning_goals"
    ADD CONSTRAINT "video_learning_goals_pkey" PRIMARY KEY ("video_id", "learning_goal_id");



ALTER TABLE ONLY "public"."video_progress"
    ADD CONSTRAINT "video_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_progress"
    ADD CONSTRAINT "video_progress_user_id_playlist_id_video_id_key" UNIQUE ("user_id", "playlist_id", "video_id");



ALTER TABLE ONLY "public"."video_stats"
    ADD CONSTRAINT "video_stats_pkey" PRIMARY KEY ("video_id");



ALTER TABLE ONLY "public"."video_teachers"
    ADD CONSTRAINT "video_teachers_pkey" PRIMARY KEY ("video_id", "teacher_id");



ALTER TABLE ONLY "public"."video_topics"
    ADD CONSTRAINT "video_topics_pkey" PRIMARY KEY ("video_id", "topic_id");



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_youtube_video_id_key" UNIQUE ("youtube_video_id");



CREATE INDEX "forum_comments_author_idx" ON "public"."forum_comments" USING "btree" ("author_id", "created_at" DESC);



CREATE INDEX "forum_comments_parent_idx" ON "public"."forum_comments" USING "btree" ("parent_id");



CREATE INDEX "forum_comments_post_idx" ON "public"."forum_comments" USING "btree" ("post_id", "score" DESC, "created_at", "id");



CREATE INDEX "forum_moderation_target_idx" ON "public"."forum_moderation_log" USING "btree" ("target_type", "target_id", "created_at" DESC);



CREATE INDEX "forum_posts_author_idx" ON "public"."forum_posts" USING "btree" ("author_id", "created_at" DESC);



CREATE INDEX "forum_posts_hot_idx" ON "public"."forum_posts" USING "btree" ("hot_rank" DESC, "created_at" DESC, "id" DESC) WHERE (("deleted_at" IS NULL) AND ("hidden_at" IS NULL));



CREATE INDEX "forum_posts_new_idx" ON "public"."forum_posts" USING "btree" ("created_at" DESC, "id" DESC) WHERE (("deleted_at" IS NULL) AND ("hidden_at" IS NULL));



CREATE INDEX "forum_posts_top_idx" ON "public"."forum_posts" USING "btree" ("score" DESC, "created_at" DESC, "id" DESC) WHERE (("deleted_at" IS NULL) AND ("hidden_at" IS NULL));



CREATE INDEX "forum_posts_topic_hot_idx" ON "public"."forum_posts" USING "btree" ("topic_id", "hot_rank" DESC, "created_at" DESC, "id" DESC) WHERE (("deleted_at" IS NULL) AND ("hidden_at" IS NULL));



CREATE INDEX "forum_posts_topic_new_idx" ON "public"."forum_posts" USING "btree" ("topic_id", "created_at" DESC, "id" DESC) WHERE (("deleted_at" IS NULL) AND ("hidden_at" IS NULL));



CREATE UNIQUE INDEX "forum_profiles_username_ci_idx" ON "public"."profiles" USING "btree" ("lower"("btrim"("username"))) WHERE ("username" IS NOT NULL);



CREATE INDEX "forum_rate_events_limit_idx" ON "public"."forum_rate_events" USING "btree" ("user_id", "action", "created_at" DESC);



CREATE UNIQUE INDEX "forum_reports_one_pending" ON "public"."forum_reports" USING "btree" ("reporter_id", "target_type", "target_id", "reason") WHERE (("reporter_id" IS NOT NULL) AND ("status" = 'pending'::"text"));



CREATE INDEX "forum_reports_queue_idx" ON "public"."forum_reports" USING "btree" ("priority" DESC, "created_at", "id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "forum_votes_comment_idx" ON "public"."forum_votes" USING "btree" ("comment_id") WHERE ("comment_id" IS NOT NULL);



CREATE INDEX "forum_votes_post_idx" ON "public"."forum_votes" USING "btree" ("post_id") WHERE ("post_id" IS NOT NULL);



CREATE UNIQUE INDEX "forum_votes_unique_comment" ON "public"."forum_votes" USING "btree" ("voter_id", "comment_id") WHERE ("comment_id" IS NOT NULL);



CREATE UNIQUE INDEX "forum_votes_unique_post" ON "public"."forum_votes" USING "btree" ("voter_id", "post_id") WHERE ("post_id" IS NOT NULL);



CREATE INDEX "forum_votes_voter_idx" ON "public"."forum_votes" USING "btree" ("voter_id");



CREATE INDEX "idx_alias_norm" ON "public"."teacher_aliases" USING "btree" ("normalized_alias");



CREATE INDEX "idx_alias_norm_pattern" ON "public"."teacher_aliases" USING "btree" ("normalized_alias" "text_pattern_ops");



CREATE INDEX "idx_alias_norm_trgm" ON "public"."teacher_aliases" USING "gin" ("normalized_alias" "public"."gin_trgm_ops");



CREATE INDEX "idx_alias_teacher" ON "public"."teacher_aliases" USING "btree" ("teacher_id");



CREATE INDEX "idx_chapters_name_latin_pattern" ON "public"."chapters" USING "btree" ("public"."search_latin_key"("name") "text_pattern_ops");



CREATE INDEX "idx_chapters_name_latin_trgm" ON "public"."chapters" USING "gin" ("public"."search_latin_key"("name") "public"."gin_trgm_ops");



CREATE INDEX "idx_chapters_name_pattern" ON "public"."chapters" USING "btree" ("public"."normalize_search_text"("name") "text_pattern_ops");



CREATE INDEX "idx_chapters_name_trgm" ON "public"."chapters" USING "gin" ("public"."normalize_search_text"("name") "public"."gin_trgm_ops");



CREATE INDEX "idx_chapters_subject" ON "public"."chapters" USING "btree" ("subject_id");



CREATE INDEX "idx_content_reports_status" ON "public"."content_reports" USING "btree" ("status");



CREATE INDEX "idx_decisions_proposal" ON "public"."teacher_proposal_decisions" USING "btree" ("proposal_id");



CREATE INDEX "idx_institutes_name_latin_pattern" ON "public"."institutes_channels" USING "btree" ("public"."search_latin_key"("name") "text_pattern_ops");



CREATE INDEX "idx_institutes_name_latin_trgm" ON "public"."institutes_channels" USING "gin" ("public"."search_latin_key"("name") "public"."gin_trgm_ops");



CREATE INDEX "idx_institutes_name_trgm" ON "public"."institutes_channels" USING "gin" ("public"."normalize_search_text"("name") "public"."gin_trgm_ops");



CREATE INDEX "idx_lgt_topic" ON "public"."learning_goal_topics" USING "btree" ("topic_id");



CREATE INDEX "idx_pb_board" ON "public"."playlist_boards" USING "btree" ("board_id");



CREATE INDEX "idx_pcl_class" ON "public"."playlist_class_levels" USING "btree" ("class_level_id");



CREATE INDEX "idx_pcl_class_playlist" ON "public"."playlist_class_levels" USING "btree" ("class_level_id", "playlist_id");



CREATE INDEX "idx_playlists_avg_rating" ON "public"."playlists" USING "btree" ("average_rating" DESC);



CREATE INDEX "idx_playlists_category" ON "public"."playlists" USING "btree" ("category_id");



CREATE INDEX "idx_playlists_channel" ON "public"."playlists" USING "btree" ("channel_id");



CREATE INDEX "idx_playlists_popularity" ON "public"."playlists" USING "btree" ("popularity_score" DESC);



CREATE INDEX "idx_playlists_subject" ON "public"."playlists" USING "btree" ("subject_id");



CREATE INDEX "idx_playlists_tags" ON "public"."playlists" USING "gin" ("tags");



CREATE INDEX "idx_playlists_title_latin_pattern" ON "public"."playlists" USING "btree" ("public"."search_latin_key"("title") "text_pattern_ops");



CREATE INDEX "idx_playlists_title_latin_trgm" ON "public"."playlists" USING "gin" ("public"."search_latin_key"("title") "public"."gin_trgm_ops");



CREATE INDEX "idx_playlists_title_pattern" ON "public"."playlists" USING "btree" ("public"."normalize_search_text"("title") "text_pattern_ops");



CREATE INDEX "idx_playlists_title_trgm" ON "public"."playlists" USING "gin" ("public"."normalize_search_text"("title") "public"."gin_trgm_ops");



CREATE INDEX "idx_playlists_views" ON "public"."playlists" USING "btree" ("view_count_total" DESC);



CREATE INDEX "idx_plg_goal" ON "public"."playlist_learning_goals" USING "btree" ("learning_goal_id");



CREATE INDEX "idx_plg_goal_playlist" ON "public"."playlist_learning_goals" USING "btree" ("learning_goal_id", "playlist_id");



CREATE INDEX "idx_plratings_playlist" ON "public"."playlist_ratings" USING "btree" ("playlist_id");



CREATE INDEX "idx_plratings_user" ON "public"."playlist_ratings" USING "btree" ("user_id");



CREATE INDEX "idx_plvideos_playlist" ON "public"."playlist_videos" USING "btree" ("playlist_id");



CREATE INDEX "idx_plvideos_video" ON "public"."playlist_videos" USING "btree" ("video_id");



CREATE INDEX "idx_pqr_playlist_time" ON "public"."playlist_quality_reviews" USING "btree" ("playlist_id", "reviewed_at" DESC);



CREATE INDEX "idx_proposal_status" ON "public"."teacher_name_proposals" USING "btree" ("status");



CREATE INDEX "idx_pt_teacher" ON "public"."playlist_teachers" USING "btree" ("teacher_id");



CREATE INDEX "idx_study_material_scopes_board" ON "public"."study_material_scopes" USING "btree" ("board_id", "material_id");



CREATE INDEX "idx_study_material_scopes_chapter" ON "public"."study_material_scopes" USING "btree" ("chapter_id", "material_id");



CREATE INDEX "idx_study_material_scopes_class" ON "public"."study_material_scopes" USING "btree" ("class_level_id", "material_id");



CREATE INDEX "idx_study_material_scopes_goal" ON "public"."study_material_scopes" USING "btree" ("learning_goal_id", "material_id");



CREATE INDEX "idx_study_material_scopes_subject" ON "public"."study_material_scopes" USING "btree" ("subject_id", "material_id");



CREATE INDEX "idx_study_material_videos_video" ON "public"."study_material_videos" USING "btree" ("video_id", "material_id");



CREATE INDEX "idx_study_materials_public_order" ON "public"."study_materials" USING "btree" ("material_type", "published_at" DESC, "id") WHERE ("review_status" = 'approved'::"text");



CREATE INDEX "idx_teachers_canonical" ON "public"."teachers" USING "btree" ("canonical_name");



CREATE INDEX "idx_teachers_canonical_pattern" ON "public"."teachers" USING "btree" ("canonical_name" "text_pattern_ops");



CREATE INDEX "idx_teachers_canonical_trgm" ON "public"."teachers" USING "gin" ("canonical_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_ti_inst" ON "public"."teacher_institutes" USING "btree" ("institute_id");



CREATE INDEX "idx_tlg_goal" ON "public"."teacher_learning_goals" USING "btree" ("learning_goal_id");



CREATE INDEX "idx_topics_chapter_order" ON "public"."topics" USING "btree" ("chapter_id", "display_order", "id");



CREATE INDEX "idx_ts_sub" ON "public"."teacher_subjects" USING "btree" ("subject_id");



CREATE INDEX "idx_vcl_class" ON "public"."video_class_levels" USING "btree" ("class_level_id");



CREATE INDEX "idx_vcomments_parent" ON "public"."video_comments" USING "btree" ("parent_id");



CREATE INDEX "idx_vcomments_user" ON "public"."video_comments" USING "btree" ("user_id");



CREATE INDEX "idx_vcomments_video" ON "public"."video_comments" USING "btree" ("video_id");



CREATE INDEX "idx_video_stats_fetched" ON "public"."video_stats" USING "btree" ("fetched_at");



CREATE INDEX "idx_video_stats_popularity" ON "public"."video_stats" USING "btree" ("popularity_score" DESC);



CREATE INDEX "idx_video_stats_views" ON "public"."video_stats" USING "btree" ("view_count" DESC);



CREATE INDEX "idx_video_topics_topic_verified" ON "public"."video_topics" USING "btree" ("topic_id", "video_id") WHERE ("review_status" = 'verified'::"text");



CREATE INDEX "idx_videos_category" ON "public"."videos" USING "btree" ("category_id");



CREATE INDEX "idx_videos_channel" ON "public"."videos" USING "btree" ("channel_id");



CREATE INDEX "idx_videos_chapter" ON "public"."videos" USING "btree" ("chapter_id");



CREATE INDEX "idx_videos_subject" ON "public"."videos" USING "btree" ("subject_id");



CREATE INDEX "idx_videos_title_latin_pattern" ON "public"."videos" USING "btree" ("public"."search_latin_key"("title") "text_pattern_ops");



CREATE INDEX "idx_videos_title_latin_trgm" ON "public"."videos" USING "gin" ("public"."search_latin_key"("title") "public"."gin_trgm_ops");



CREATE INDEX "idx_videos_title_pattern" ON "public"."videos" USING "btree" ("public"."normalize_search_text"("title") "text_pattern_ops");



CREATE INDEX "idx_videos_title_trgm" ON "public"."videos" USING "gin" ("public"."normalize_search_text"("title") "public"."gin_trgm_ops");



CREATE INDEX "idx_vlg_goal" ON "public"."video_learning_goals" USING "btree" ("learning_goal_id");



CREATE INDEX "idx_vt_teacher" ON "public"."video_teachers" USING "btree" ("teacher_id");



CREATE INDEX "poll_comments_author_idx" ON "public"."poll_comments" USING "btree" ("author_id", "created_at" DESC);



CREATE INDEX "poll_comments_poll_idx" ON "public"."poll_comments" USING "btree" ("poll_id", "created_at" DESC);



CREATE INDEX "poll_options_poll_idx" ON "public"."poll_options" USING "btree" ("poll_id", "position");



CREATE INDEX "poll_rate_events_limit_idx" ON "public"."poll_rate_events" USING "btree" ("user_id", "action", "created_at" DESC);



CREATE UNIQUE INDEX "poll_reports_one_per_comment_idx" ON "public"."poll_reports" USING "btree" ("reporter_id", "comment_id") WHERE ("target_type" = 'comment'::"text");



CREATE UNIQUE INDEX "poll_reports_one_per_poll_idx" ON "public"."poll_reports" USING "btree" ("reporter_id", "poll_id") WHERE ("target_type" = 'poll'::"text");



CREATE INDEX "poll_reports_queue_idx" ON "public"."poll_reports" USING "btree" ("created_at" DESC) WHERE ("status" = 'open'::"text");



CREATE INDEX "poll_votes_option_idx" ON "public"."poll_votes" USING "btree" ("option_id");



CREATE INDEX "poll_votes_voter_idx" ON "public"."poll_votes" USING "btree" ("voter_id");



CREATE INDEX "polls_author_idx" ON "public"."polls" USING "btree" ("author_id", "created_at" DESC);



CREATE INDEX "polls_closing_idx" ON "public"."polls" USING "btree" ("closes_at") WHERE (("status" = 'live'::"text") AND ("closes_at" IS NOT NULL));



CREATE INDEX "polls_live_new_idx" ON "public"."polls" USING "btree" ("published_at" DESC, "id" DESC) WHERE ("status" = 'live'::"text");



CREATE INDEX "polls_live_top_idx" ON "public"."polls" USING "btree" ("vote_count" DESC, "id" DESC) WHERE ("status" = 'live'::"text");



CREATE INDEX "polls_review_queue_idx" ON "public"."polls" USING "btree" ("created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "polls_topic_idx" ON "public"."polls" USING "btree" ("topic_id", "published_at" DESC) WHERE ("status" = 'live'::"text");



CREATE UNIQUE INDEX "study_material_scopes_unique_scope" ON "public"."study_material_scopes" USING "btree" ("material_id", COALESCE("learning_goal_id", (0)::bigint), COALESCE("board_id", (0)::bigint), COALESCE("class_level_id", (0)::bigint), COALESCE("subject_id", (0)::bigint), COALESCE("chapter_id", (0)::bigint));



CREATE UNIQUE INDEX "uq_playlists_youtube_playlist_id" ON "public"."playlists" USING "btree" ("youtube_playlist_id") WHERE ("youtube_playlist_id" IS NOT NULL);



CREATE CONSTRAINT TRIGGER "playlist_channel_guard" AFTER UPDATE OF "channel_id" ON "public"."playlists" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."playlist_channel_still_matches"();



CREATE CONSTRAINT TRIGGER "playlist_video_channel_guard" AFTER INSERT OR UPDATE ON "public"."playlist_videos" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."playlist_video_channel_matches"();



CREATE OR REPLACE TRIGGER "poll_comments_apply_delta" AFTER INSERT OR DELETE OR UPDATE ON "public"."poll_comments" FOR EACH ROW EXECUTE FUNCTION "public"."poll_apply_comment_delta"();



CREATE OR REPLACE TRIGGER "poll_votes_apply_delta" AFTER INSERT OR DELETE OR UPDATE ON "public"."poll_votes" FOR EACH ROW EXECUTE FUNCTION "public"."poll_apply_vote_delta"();



CREATE OR REPLACE TRIGGER "polls_touch_updated_at" BEFORE UPDATE ON "public"."polls" FOR EACH ROW EXECUTE FUNCTION "public"."poll_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_alias_normalized" BEFORE INSERT OR UPDATE ON "public"."teacher_aliases" FOR EACH ROW EXECUTE FUNCTION "public"."set_alias_normalized"();



CREATE OR REPLACE TRIGGER "trg_enforce_content_report_submission" BEFORE INSERT ON "public"."content_reports" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_content_report_submission"();



CREATE OR REPLACE TRIGGER "trg_enforce_rating_submission" BEFORE INSERT OR UPDATE ON "public"."playlist_ratings" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_rating_submission"();



CREATE OR REPLACE TRIGGER "trg_force_class_levels" BEFORE INSERT OR UPDATE ON "public"."playlists" FOR EACH ROW EXECUTE FUNCTION "public"."force_derived_class_levels"();



CREATE OR REPLACE TRIGGER "trg_forum_anonymize_profile" BEFORE DELETE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."forum_anonymize_profile_content"();



CREATE OR REPLACE TRIGGER "trg_forum_comment_count" AFTER INSERT OR DELETE ON "public"."forum_comments" FOR EACH ROW EXECUTE FUNCTION "public"."forum_apply_comment_count_delta"();



CREATE OR REPLACE TRIGGER "trg_forum_comment_stats" AFTER INSERT OR DELETE OR UPDATE ON "public"."forum_comments" FOR EACH ROW EXECUTE FUNCTION "public"."forum_apply_user_content_delta"();



CREATE OR REPLACE TRIGGER "trg_forum_post_stats" AFTER INSERT OR DELETE OR UPDATE ON "public"."forum_posts" FOR EACH ROW EXECUTE FUNCTION "public"."forum_apply_user_content_delta"();



CREATE OR REPLACE TRIGGER "trg_forum_prepare_comment" BEFORE INSERT OR UPDATE ON "public"."forum_comments" FOR EACH ROW EXECUTE FUNCTION "public"."forum_prepare_comment"();



CREATE OR REPLACE TRIGGER "trg_forum_prepare_post" BEFORE INSERT OR UPDATE ON "public"."forum_posts" FOR EACH ROW EXECUTE FUNCTION "public"."forum_prepare_post"();



CREATE OR REPLACE TRIGGER "trg_forum_prepare_vote" BEFORE INSERT OR UPDATE ON "public"."forum_votes" FOR EACH ROW EXECUTE FUNCTION "public"."forum_prepare_vote"();



CREATE OR REPLACE TRIGGER "trg_forum_vote_delta" AFTER INSERT OR DELETE OR UPDATE ON "public"."forum_votes" FOR EACH ROW EXECUTE FUNCTION "public"."forum_apply_vote_delta"();



CREATE OR REPLACE TRIGGER "trg_plratings_updated_at" BEFORE UPDATE ON "public"."playlist_ratings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_protect_profile_admin_flag" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_admin_flag"();



CREATE OR REPLACE TRIGGER "trg_protect_review_moderation_columns" BEFORE UPDATE ON "public"."playlist_ratings" FOR EACH ROW EXECUTE FUNCTION "public"."protect_review_moderation_columns"();



CREATE OR REPLACE TRIGGER "trg_refresh_playlist_rating" AFTER INSERT OR DELETE OR UPDATE ON "public"."playlist_ratings" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_playlist_rating"();



CREATE OR REPLACE TRIGGER "trg_study_material_updated_at" BEFORE UPDATE ON "public"."study_materials" FOR EACH ROW EXECUTE FUNCTION "public"."touch_study_material_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_pl_class_array" AFTER INSERT OR DELETE ON "public"."playlist_class_levels" FOR EACH ROW EXECUTE FUNCTION "public"."sync_playlist_class_levels_array"();



CREATE OR REPLACE TRIGGER "trg_teacher_canonical" BEFORE INSERT OR UPDATE ON "public"."teachers" FOR EACH ROW EXECUTE FUNCTION "public"."set_teacher_canonical"();



CREATE OR REPLACE TRIGGER "trg_touch_playlist_attributes" BEFORE UPDATE ON "public"."playlist_attributes" FOR EACH ROW EXECUTE FUNCTION "public"."touch_playlist_attributes"();



CREATE OR REPLACE TRIGGER "trg_validate_study_material_scope" BEFORE INSERT OR UPDATE ON "public"."study_material_scopes" FOR EACH ROW EXECUTE FUNCTION "public"."validate_study_material_scope"();



CREATE OR REPLACE TRIGGER "trg_vcomments_updated_at" BEFORE UPDATE ON "public"."video_comments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_videos_updated_at" BEFORE UPDATE ON "public"."videos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE CONSTRAINT TRIGGER "video_channel_guard" AFTER UPDATE OF "channel_id" ON "public"."videos" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."video_channel_still_matches"();



ALTER TABLE ONLY "public"."category_learning_goals"
    ADD CONSTRAINT "category_learning_goals_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_learning_goals"
    ADD CONSTRAINT "category_learning_goals_learning_goal_id_fkey" FOREIGN KEY ("learning_goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chapter_class_levels"
    ADD CONSTRAINT "chapter_class_levels_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chapter_class_levels"
    ADD CONSTRAINT "chapter_class_levels_class_level_id_fkey" FOREIGN KEY ("class_level_id") REFERENCES "public"."class_levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_beta_members"
    ADD CONSTRAINT "forum_beta_members_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_beta_members"
    ADD CONSTRAINT "forum_beta_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_hidden_by_fkey" FOREIGN KEY ("hidden_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_parent_same_post" FOREIGN KEY ("parent_id", "post_id") REFERENCES "public"."forum_comments"("id", "post_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_moderation_log"
    ADD CONSTRAINT "forum_moderation_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_moderation_log"
    ADD CONSTRAINT "forum_moderation_log_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."forum_reports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_moderation_log"
    ADD CONSTRAINT "forum_moderation_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_posts"
    ADD CONSTRAINT "forum_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_posts"
    ADD CONSTRAINT "forum_posts_hidden_by_fkey" FOREIGN KEY ("hidden_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_posts"
    ADD CONSTRAINT "forum_posts_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_posts"
    ADD CONSTRAINT "forum_posts_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."forum_topics"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."forum_rate_events"
    ADD CONSTRAINT "forum_rate_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_reports"
    ADD CONSTRAINT "forum_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_reports"
    ADD CONSTRAINT "forum_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_settings"
    ADD CONSTRAINT "forum_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_suspensions"
    ADD CONSTRAINT "forum_suspensions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_suspensions"
    ADD CONSTRAINT "forum_suspensions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_user_stats"
    ADD CONSTRAINT "forum_user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_votes"
    ADD CONSTRAINT "forum_votes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."forum_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_votes"
    ADD CONSTRAINT "forum_votes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_votes"
    ADD CONSTRAINT "forum_votes_target_author_id_fkey" FOREIGN KEY ("target_author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_votes"
    ADD CONSTRAINT "forum_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_goal_class_levels"
    ADD CONSTRAINT "learning_goal_class_levels_class_level_id_fkey" FOREIGN KEY ("class_level_id") REFERENCES "public"."class_levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_goal_class_levels"
    ADD CONSTRAINT "learning_goal_class_levels_learning_goal_id_fkey" FOREIGN KEY ("learning_goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_goal_topics"
    ADD CONSTRAINT "learning_goal_topics_learning_goal_id_fkey" FOREIGN KEY ("learning_goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_goal_topics"
    ADD CONSTRAINT "learning_goal_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_attributes"
    ADD CONSTRAINT "playlist_attributes_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_attributes"
    ADD CONSTRAINT "playlist_attributes_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."playlist_boards"
    ADD CONSTRAINT "playlist_boards_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_boards"
    ADD CONSTRAINT "playlist_boards_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_class_levels"
    ADD CONSTRAINT "playlist_class_levels_class_level_id_fkey" FOREIGN KEY ("class_level_id") REFERENCES "public"."class_levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_class_levels"
    ADD CONSTRAINT "playlist_class_levels_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_import_audit"
    ADD CONSTRAINT "playlist_import_audit_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."playlist_learning_goals"
    ADD CONSTRAINT "playlist_learning_goals_learning_goal_id_fkey" FOREIGN KEY ("learning_goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_learning_goals"
    ADD CONSTRAINT "playlist_learning_goals_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_quality_reviews"
    ADD CONSTRAINT "playlist_quality_reviews_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_quality_reviews"
    ADD CONSTRAINT "playlist_quality_reviews_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."playlist_ratings"
    ADD CONSTRAINT "playlist_ratings_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_ratings"
    ADD CONSTRAINT "playlist_ratings_review_hidden_by_fkey" FOREIGN KEY ("review_hidden_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."playlist_ratings"
    ADD CONSTRAINT "playlist_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_teachers"
    ADD CONSTRAINT "playlist_teachers_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_teachers"
    ADD CONSTRAINT "playlist_teachers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."playlist_videos"
    ADD CONSTRAINT "playlist_videos_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_videos"
    ADD CONSTRAINT "playlist_videos_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlists"
    ADD CONSTRAINT "playlists_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."playlists"
    ADD CONSTRAINT "playlists_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."institutes_channels"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."playlists"
    ADD CONSTRAINT "playlists_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."poll_comments"
    ADD CONSTRAINT "poll_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."poll_comments"
    ADD CONSTRAINT "poll_comments_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_comments"
    ADD CONSTRAINT "poll_comments_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."poll_options"
    ADD CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_rate_events"
    ADD CONSTRAINT "poll_rate_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_reports"
    ADD CONSTRAINT "poll_reports_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."poll_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_reports"
    ADD CONSTRAINT "poll_reports_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_reports"
    ADD CONSTRAINT "poll_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_reports"
    ADD CONSTRAINT "poll_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."poll_settings"
    ADD CONSTRAINT "poll_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."polls"
    ADD CONSTRAINT "polls_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."polls"
    ADD CONSTRAINT "polls_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."polls"
    ADD CONSTRAINT "polls_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."forum_topics"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_material_scopes"
    ADD CONSTRAINT "study_material_scopes_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."study_material_scopes"
    ADD CONSTRAINT "study_material_scopes_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."study_material_scopes"
    ADD CONSTRAINT "study_material_scopes_class_level_id_fkey" FOREIGN KEY ("class_level_id") REFERENCES "public"."class_levels"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."study_material_scopes"
    ADD CONSTRAINT "study_material_scopes_learning_goal_id_fkey" FOREIGN KEY ("learning_goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."study_material_scopes"
    ADD CONSTRAINT "study_material_scopes_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."study_materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_material_scopes"
    ADD CONSTRAINT "study_material_scopes_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."study_material_videos"
    ADD CONSTRAINT "study_material_videos_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."study_materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_material_videos"
    ADD CONSTRAINT "study_material_videos_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_aliases"
    ADD CONSTRAINT "teacher_aliases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teacher_aliases"
    ADD CONSTRAINT "teacher_aliases_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_aliases"
    ADD CONSTRAINT "teacher_aliases_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teacher_institutes"
    ADD CONSTRAINT "teacher_institutes_institute_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_institutes"
    ADD CONSTRAINT "teacher_institutes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_learning_goals"
    ADD CONSTRAINT "teacher_learning_goals_learning_goal_id_fkey" FOREIGN KEY ("learning_goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_learning_goals"
    ADD CONSTRAINT "teacher_learning_goals_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_name_proposals"
    ADD CONSTRAINT "teacher_name_proposals_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teacher_proposal_decisions"
    ADD CONSTRAINT "teacher_proposal_decisions_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teacher_proposal_decisions"
    ADD CONSTRAINT "teacher_proposal_decisions_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."teacher_name_proposals"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."teacher_subjects"
    ADD CONSTRAINT "teacher_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_subjects"
    ADD CONSTRAINT "teacher_subjects_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_class_levels"
    ADD CONSTRAINT "video_class_levels_class_level_id_fkey" FOREIGN KEY ("class_level_id") REFERENCES "public"."class_levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_class_levels"
    ADD CONSTRAINT "video_class_levels_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_comments"
    ADD CONSTRAINT "video_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."video_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_comments"
    ADD CONSTRAINT "video_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_comments"
    ADD CONSTRAINT "video_comments_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_learning_goals"
    ADD CONSTRAINT "video_learning_goals_learning_goal_id_fkey" FOREIGN KEY ("learning_goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_learning_goals"
    ADD CONSTRAINT "video_learning_goals_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_progress"
    ADD CONSTRAINT "video_progress_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."video_progress"
    ADD CONSTRAINT "video_progress_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_progress"
    ADD CONSTRAINT "video_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_progress"
    ADD CONSTRAINT "video_progress_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_stats"
    ADD CONSTRAINT "video_stats_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_teachers"
    ADD CONSTRAINT "video_teachers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."video_teachers"
    ADD CONSTRAINT "video_teachers_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_topics"
    ADD CONSTRAINT "video_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_topics"
    ADD CONSTRAINT "video_topics_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."video_topics"
    ADD CONSTRAINT "video_topics_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."institutes_channels"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE RESTRICT;



CREATE POLICY "admin deletes" ON "public"."boards" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admin deletes" ON "public"."class_levels" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admin deletes" ON "public"."learning_goals" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admin deletes" ON "public"."playlist_class_levels" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admin deletes" ON "public"."playlist_learning_goals" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admin deletes" ON "public"."video_class_levels" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admin deletes" ON "public"."video_learning_goals" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admin inserts" ON "public"."boards" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin inserts" ON "public"."chapters" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin inserts" ON "public"."class_levels" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin inserts" ON "public"."institutes_channels" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin inserts" ON "public"."learning_goals" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin inserts" ON "public"."playlist_class_levels" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin inserts" ON "public"."playlist_learning_goals" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin inserts" ON "public"."playlist_videos" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin inserts" ON "public"."playlists" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin inserts" ON "public"."video_class_levels" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin inserts" ON "public"."video_learning_goals" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin inserts" ON "public"."videos" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin read aliases" ON "public"."teacher_aliases" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admin read audit" ON "public"."class_levels_migration_audit" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin read decisions" ON "public"."teacher_proposal_decisions" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin read proposals" ON "public"."teacher_name_proposals" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin reads catalog management audit" ON "public"."catalog_management_audit" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admin reads playlist import audit" ON "public"."playlist_import_audit" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admin reads quality reviews" ON "public"."playlist_quality_reviews" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admin reads reports" ON "public"."content_reports" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin updates reports" ON "public"."content_reports" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins delete" ON "public"."study_material_scopes" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admins delete" ON "public"."study_material_videos" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admins delete" ON "public"."study_materials" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admins insert" ON "public"."study_material_scopes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins insert" ON "public"."study_material_videos" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins insert" ON "public"."study_materials" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins update" ON "public"."study_material_scopes" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins update" ON "public"."study_material_videos" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins update" ON "public"."study_materials" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."app_environment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."boards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalog_management_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."category_learning_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chapter_class_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chapters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."class_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."class_levels_migration_audit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments are public" ON "public"."video_comments" FOR SELECT USING (true);



ALTER TABLE "public"."content_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "env readable" ON "public"."app_environment" FOR SELECT USING (true);



CREATE POLICY "forum admins inspect comments" ON "public"."forum_comments" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "forum admins inspect moderation log" ON "public"."forum_moderation_log" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "forum admins inspect posts" ON "public"."forum_posts" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "forum admins inspect reports" ON "public"."forum_reports" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "forum admins inspect settings" ON "public"."forum_settings" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "forum admins inspect suspensions" ON "public"."forum_suspensions" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "forum admins inspect topics" ON "public"."forum_topics" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."forum_admin_transfer_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_beta_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_install_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_moderation_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_rate_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_suspensions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_user_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."institutes_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learning_goal_class_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learning_goal_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learning_goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner and admin read all ratings" ON "public"."playlist_ratings" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



ALTER TABLE "public"."playlist_attributes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playlist_boards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playlist_class_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playlist_import_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playlist_learning_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playlist_quality_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playlist_ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playlist_teachers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playlist_videos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playlists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "poll admins inspect comments" ON "public"."poll_comments" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "poll admins inspect image hosts" ON "public"."poll_image_hosts" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "poll admins inspect options" ON "public"."poll_options" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "poll admins inspect polls" ON "public"."polls" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "poll admins inspect reports" ON "public"."poll_reports" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "poll admins inspect settings" ON "public"."poll_settings" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "poll admins inspect votes" ON "public"."poll_votes" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."poll_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."poll_image_hosts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."poll_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."poll_rate_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."poll_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."poll_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."poll_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."polls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles are public" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."boards" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."categories" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."category_learning_goals" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."chapters" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."class_levels" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."institutes_channels" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."learning_goal_class_levels" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."learning_goals" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."playlist_boards" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."playlist_class_levels" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."playlist_learning_goals" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."playlist_teachers" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."playlist_videos" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."playlists" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."subjects" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."teacher_institutes" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."teacher_learning_goals" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."teacher_subjects" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."teachers" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."video_class_levels" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."video_learning_goals" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."video_teachers" FOR SELECT USING (true);



CREATE POLICY "public read" ON "public"."videos" FOR SELECT USING (true);



CREATE POLICY "public read canonical chapter classes" ON "public"."chapter_class_levels" FOR SELECT USING (true);



CREATE POLICY "public read verified" ON "public"."teacher_aliases" FOR SELECT TO "authenticated", "anon" USING (("status" = 'verified'::"text"));



CREATE POLICY "public reads approved material scopes" ON "public"."study_material_scopes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."study_materials" "m"
  WHERE (("m"."id" = "study_material_scopes"."material_id") AND ("m"."review_status" = 'approved'::"text") AND ("m"."published_at" <= "now"())))));



CREATE POLICY "public reads approved material videos" ON "public"."study_material_videos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."study_materials" "m"
  WHERE (("m"."id" = "study_material_videos"."material_id") AND ("m"."review_status" = 'approved'::"text") AND ("m"."published_at" <= "now"())))));



CREATE POLICY "public reads approved study materials" ON "public"."study_materials" FOR SELECT USING ((("review_status" = 'approved'::"text") AND ("published_at" <= "now"())));



CREATE POLICY "public reads stats" ON "public"."video_stats" FOR SELECT USING (true);



CREATE POLICY "signed-in users report own" ON "public"."content_reports" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("reporter_id" = "auth"."uid"())));



ALTER TABLE "public"."study_material_scopes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."study_material_videos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."study_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subjects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_aliases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_institutes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_learning_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_name_proposals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_proposal_decisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_subjects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teachers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user deletes own comment" ON "public"."video_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user deletes own progress" ON "public"."video_progress" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user deletes own rating" ON "public"."playlist_ratings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user inserts own comment" ON "public"."video_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user inserts own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "user inserts own progress" ON "public"."video_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user inserts own rating" ON "public"."playlist_ratings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user reads own progress" ON "public"."video_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user updates own comment" ON "public"."video_comments" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user updates own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "user updates own progress" ON "public"."video_progress" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user updates own rating" ON "public"."playlist_ratings" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."video_class_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_learning_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_teachers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."videos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "visible ratings are public" ON "public"."playlist_ratings" FOR SELECT USING (("review_hidden" = false));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."add_teacher_alias"("p_teacher_id" bigint, "p_alias" "text", "p_type" "text", "p_verified" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_teacher_alias"("p_teacher_id" bigint, "p_alias" "text", "p_type" "text", "p_verified" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_list_reviews"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_reviews"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_reviews"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_review_hidden"("p_rating_id" bigint, "p_hidden" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_review_hidden"("p_rating_id" bigint, "p_hidden" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_review_hidden"("p_rating_id" bigint, "p_hidden" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_faculty_review_group_as_new"("p_normalized" "text", "p_display_name" "text", "p_verified" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_faculty_review_group_as_new"("p_normalized" "text", "p_display_name" "text", "p_verified" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_faculty_review_group_as_new"("p_normalized" "text", "p_display_name" "text", "p_verified" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_group_as_existing"("p_normalized" "text", "p_teacher_id" bigint, "p_add_alias" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_group_as_existing"("p_normalized" "text", "p_teacher_id" bigint, "p_add_alias" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."approve_group_as_existing"("p_normalized" "text", "p_teacher_id" bigint, "p_add_alias" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."approve_proposal_as_existing"("p_proposal_id" bigint, "p_teacher_id" bigint, "p_add_alias" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_proposal_as_existing"("p_proposal_id" bigint, "p_teacher_id" bigint, "p_add_alias" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_proposal_as_new"("p_proposal_id" bigint, "p_display_name" "text", "p_verified" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_proposal_as_new"("p_proposal_id" bigint, "p_display_name" "text", "p_verified" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."assert_playlist_video_channel"("p_playlist_id" bigint, "p_video_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_playlist_video_channel"("p_playlist_id" bigint, "p_video_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."browse_facet_counts"("p_goal" "text", "p_class" "text", "p_subject" "text", "p_chapter" "text", "p_channel" bigint, "p_language" "text"[], "p_type" "text"[], "p_difficulty" "text"[], "p_search" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."browse_facet_counts"("p_goal" "text", "p_class" "text", "p_subject" "text", "p_chapter" "text", "p_channel" bigint, "p_language" "text"[], "p_type" "text"[], "p_difficulty" "text"[], "p_search" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."browse_facet_counts"("p_goal" "text", "p_class" "text", "p_subject" "text", "p_chapter" "text", "p_channel" bigint, "p_language" "text"[], "p_type" "text"[], "p_difficulty" "text"[], "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."browse_facet_counts"("p_goal" "text", "p_class" "text", "p_subject" "text", "p_chapter" "text", "p_channel" bigint, "p_language" "text"[], "p_type" "text"[], "p_difficulty" "text"[], "p_search" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."catalog_manage_capability"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."catalog_manage_capability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."catalog_manage_capability"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."catalog_playlist_snapshot"("p_playlist_id" bigint) FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."catalog_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."catalog_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."catalog_similarity"("text", "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."catalog_video_taxonomy_snapshot"("p_video_id" bigint) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."catalog_word_similarity"("text", "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."catalog_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."catalog_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."catalog_word_similarity"("text", "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."chapter_matches_class_scope"("p_chapter_id" bigint, "p_playlist_id" bigint, "p_class" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chapter_matches_class_scope"("p_chapter_id" bigint, "p_playlist_id" bigint, "p_class" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."chapter_matches_class_scope"("p_chapter_id" bigint, "p_playlist_id" bigint, "p_class" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."chapter_matches_class_scope"("p_chapter_id" bigint, "p_playlist_id" bigint, "p_class" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."class_label_to_slug"("p_label" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."class_label_to_slug"("p_label" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."class_label_to_slug"("p_label" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."clear_managed_video_taxonomy"("p_playlist_id" bigint, "p_video_id" bigint, "p_allow_shared" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clear_managed_video_taxonomy"("p_playlist_id" bigint, "p_video_id" bigint, "p_allow_shared" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_managed_video_taxonomy"("p_playlist_id" bigint, "p_video_id" bigint, "p_allow_shared" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."clear_video_taxonomy"("p_video_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clear_video_taxonomy"("p_video_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_video_taxonomy"("p_video_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."content_quality_capability"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."content_quality_capability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."content_quality_capability"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_course"("payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_course"("payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_course"("payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_course_with_teachers"("payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_course_with_teachers"("payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_course_with_teachers"("payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_teacher"("p_display_name" "text", "p_aliases" "jsonb", "p_verified" boolean, "p_duplicate_acknowledged" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_teacher"("p_display_name" "text", "p_aliases" "jsonb", "p_verified" boolean, "p_duplicate_acknowledged" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."defer_faculty_review_group"("p_normalized" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."defer_faculty_review_group"("p_normalized" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."defer_faculty_review_group"("p_normalized" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."defer_proposal"("p_proposal_id" bigint, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."defer_proposal"("p_proposal_id" bigint, "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_managed_playlist"("p_playlist_id" bigint, "p_expected_title" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_managed_playlist"("p_playlist_id" bigint, "p_expected_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_managed_playlist"("p_playlist_id" bigint, "p_expected_title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."derived_class_levels"("p_playlist_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."derived_class_levels"("p_playlist_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."derived_class_levels"("p_playlist_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_content_report_submission"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_content_report_submission"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_rating_submission"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_rating_submission"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."faculty_import_capability"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."faculty_import_capability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."faculty_import_capability"() TO "service_role";



GRANT ALL ON FUNCTION "public"."force_derived_class_levels"() TO "anon";
GRANT ALL ON FUNCTION "public"."force_derived_class_levels"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_derived_class_levels"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."forum_adjust_karma"("p_author" "uuid", "p_delta" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_adjust_karma"("p_author" "uuid", "p_delta" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."forum_admin_dismiss_report"("p_report_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_admin_dismiss_report"("p_report_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_admin_dismiss_report"("p_report_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_admin_list_beta_members"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_admin_list_beta_members"() TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_admin_list_beta_members"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_admin_list_reports"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_admin_list_reports"("p_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_admin_list_reports"("p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_admin_list_suspensions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_admin_list_suspensions"() TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_admin_list_suspensions"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_admin_moderate"("p_target_type" "text", "p_target_id" bigint, "p_action" "text", "p_reason" "text", "p_report_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_admin_moderate"("p_target_type" "text", "p_target_id" bigint, "p_action" "text", "p_reason" "text", "p_report_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_admin_moderate"("p_target_type" "text", "p_target_id" bigint, "p_action" "text", "p_reason" "text", "p_report_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_admin_set_beta_member"("p_username" "text", "p_enabled" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_admin_set_beta_member"("p_username" "text", "p_enabled" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_admin_set_beta_member"("p_username" "text", "p_enabled" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_admin_set_mode"("p_mode" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_admin_set_mode"("p_mode" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_admin_set_mode"("p_mode" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_admin_set_suspension"("p_user_id" "uuid", "p_suspended_until" timestamp with time zone, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_admin_set_suspension"("p_user_id" "uuid", "p_suspended_until" timestamp with time zone, "p_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_admin_set_suspension"("p_user_id" "uuid", "p_suspended_until" timestamp with time zone, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_admin_set_suspension_by_username"("p_username" "text", "p_days" integer, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_admin_set_suspension_by_username"("p_username" "text", "p_days" integer, "p_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_admin_set_suspension_by_username"("p_username" "text", "p_days" integer, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_anonymize_profile_content"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_anonymize_profile_content"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."forum_apply_comment_count_delta"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_apply_comment_count_delta"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."forum_apply_user_content_delta"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_apply_user_content_delta"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."forum_apply_vote_delta"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_apply_vote_delta"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."forum_cast_vote"("p_target_type" "text", "p_target_id" bigint, "p_value" smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_cast_vote"("p_target_type" "text", "p_target_id" bigint, "p_value" smallint) TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_cast_vote"("p_target_type" "text", "p_target_id" bigint, "p_value" smallint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_claim_username"("p_username" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_claim_username"("p_username" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_claim_username"("p_username" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_create_comment"("p_post_id" bigint, "p_parent_id" bigint, "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_create_comment"("p_post_id" bigint, "p_parent_id" bigint, "p_body" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_create_comment"("p_post_id" bigint, "p_parent_id" bigint, "p_body" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_create_post"("p_topic_slug" "text", "p_title" "text", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_create_post"("p_topic_slug" "text", "p_title" "text", "p_body" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_create_post"("p_topic_slug" "text", "p_title" "text", "p_body" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_delete_comment"("p_comment_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_delete_comment"("p_comment_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_delete_comment"("p_comment_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_delete_post"("p_post_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_delete_post"("p_post_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_delete_post"("p_post_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_edit_comment"("p_comment_id" bigint, "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_edit_comment"("p_comment_id" bigint, "p_body" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_edit_comment"("p_comment_id" bigint, "p_body" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_edit_post"("p_post_id" bigint, "p_title" "text", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_edit_post"("p_post_id" bigint, "p_title" "text", "p_body" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_edit_post"("p_post_id" bigint, "p_title" "text", "p_body" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_get_my_identity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_get_my_identity"() TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_get_my_identity"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_hot_rank"("p_score" integer, "p_created_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_hot_rank"("p_score" integer, "p_created_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."forum_is_beta_member"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_is_beta_member"() TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_is_beta_member"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_mode"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_mode"() TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_mode"() TO "anon";
GRANT ALL ON FUNCTION "public"."forum_mode"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_prepare_comment"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_prepare_comment"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."forum_prepare_post"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_prepare_post"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."forum_prepare_vote"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_prepare_vote"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."forum_record_rate_event"("p_user_id" "uuid", "p_action" "text", "p_target_id" bigint, "p_hour_limit" integer, "p_day_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_record_rate_event"("p_user_id" "uuid", "p_action" "text", "p_target_id" bigint, "p_hour_limit" integer, "p_day_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."forum_recount_karma"("p_apply" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_recount_karma"("p_apply" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_recount_karma"("p_apply" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_recount_metrics"("p_apply" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_recount_metrics"("p_apply" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_recount_metrics"("p_apply" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_require_open"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_require_open"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."forum_require_reporter"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_require_reporter"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."forum_require_writer"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_require_writer"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."forum_submit_report"("p_target_type" "text", "p_target_id" bigint, "p_reason" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_submit_report"("p_target_type" "text", "p_target_id" bigint, "p_reason" "text", "p_note" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_submit_report"("p_target_type" "text", "p_target_id" bigint, "p_reason" "text", "p_note" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_toggle_solved"("p_post_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_toggle_solved"("p_post_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."forum_toggle_solved"("p_post_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."forum_username_is_allowed"("p_username" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forum_username_is_allowed"("p_username" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_browse_curriculum"("p_goal" "text", "p_class" "text", "p_subject" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_browse_curriculum"("p_goal" "text", "p_class" "text", "p_subject" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_browse_curriculum"("p_goal" "text", "p_class" "text", "p_subject" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_browse_curriculum"("p_goal" "text", "p_class" "text", "p_subject" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_chapter_champions"("p_chapter" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_chapter_champions"("p_chapter" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_chapter_champions"("p_chapter" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chapter_champions"("p_chapter" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_chapter_courses"("p_chapter_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_chapter_courses"("p_chapter_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chapter_courses"("p_chapter_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_content_quality_queue"("p_ready" boolean, "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_content_quality_queue"("p_ready" boolean, "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_content_quality_queue"("p_ready" boolean, "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_faculty_facets"("p_chapter_id" bigint, "p_subject_id" bigint, "p_goal_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_faculty_facets"("p_chapter_id" bigint, "p_subject_id" bigint, "p_goal_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_faculty_facets"("p_chapter_id" bigint, "p_subject_id" bigint, "p_goal_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_faculty_profile"("p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_faculty_profile"("p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_faculty_profile"("p_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_faculty_review_groups"("p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_faculty_review_groups"("p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_faculty_review_groups"("p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_forum_comments"("p_post_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_forum_comments"("p_post_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_forum_comments"("p_post_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_forum_feed"("p_sort" "text", "p_topic_slug" "text", "p_query" "text", "p_cursor_hot" double precision, "p_cursor_score" integer, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" bigint, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_forum_feed"("p_sort" "text", "p_topic_slug" "text", "p_query" "text", "p_cursor_hot" double precision, "p_cursor_score" integer, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" bigint, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_forum_feed"("p_sort" "text", "p_topic_slug" "text", "p_query" "text", "p_cursor_hot" double precision, "p_cursor_score" integer, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" bigint, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_forum_post"("p_post_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_forum_post"("p_post_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_forum_post"("p_post_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_forum_topics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_forum_topics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_forum_topics"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_manage_playlists"("p_search" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_manage_playlists"("p_search" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_manage_playlists"("p_search" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_poll_submissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_poll_submissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_poll_submissions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_playlist_comparison"("p_playlist_ids" bigint[], "p_chapter_id" bigint, "p_learning_goal_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_playlist_comparison"("p_playlist_ids" bigint[], "p_chapter_id" bigint, "p_learning_goal_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_playlist_comparison"("p_playlist_ids" bigint[], "p_chapter_id" bigint, "p_learning_goal_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_playlist_comparison"("p_playlist_ids" bigint[], "p_chapter_id" bigint, "p_learning_goal_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_poll"("p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_poll"("p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_poll"("p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_poll_comments"("p_poll_id" bigint, "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_poll_comments"("p_poll_id" bigint, "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_poll_comments"("p_poll_id" bigint, "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_poll_topics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_poll_topics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_poll_topics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_polls_feed"("p_sort" "text", "p_topic_slug" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_polls_feed"("p_sort" "text", "p_topic_slug" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_polls_feed"("p_sort" "text", "p_topic_slug" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_proposal_groups"("p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_proposal_groups"("p_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_study_material_curriculum"("p_goal_slug" "text", "p_board_slug" "text", "p_class_slug" "text", "p_subject_slug" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_study_material_curriculum"("p_goal_slug" "text", "p_board_slug" "text", "p_class_slug" "text", "p_subject_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_study_material_curriculum"("p_goal_slug" "text", "p_board_slug" "text", "p_class_slug" "text", "p_subject_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_study_material_curriculum"("p_goal_slug" "text", "p_board_slug" "text", "p_class_slug" "text", "p_subject_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_study_materials"("p_goal_slug" "text", "p_board_slug" "text", "p_class_slug" "text", "p_subject_slug" "text", "p_chapter_slug" "text", "p_chapter_id" bigint, "p_video_id" bigint, "p_material_type" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_study_materials"("p_goal_slug" "text", "p_board_slug" "text", "p_class_slug" "text", "p_subject_slug" "text", "p_chapter_slug" "text", "p_chapter_id" bigint, "p_video_id" bigint, "p_material_type" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_study_materials"("p_goal_slug" "text", "p_board_slug" "text", "p_class_slug" "text", "p_subject_slug" "text", "p_chapter_slug" "text", "p_chapter_id" bigint, "p_video_id" bigint, "p_material_type" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_study_materials"("p_goal_slug" "text", "p_board_slug" "text", "p_class_slug" "text", "p_subject_slug" "text", "p_chapter_slug" "text", "p_chapter_id" bigint, "p_video_id" bigint, "p_material_type" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."import_playlist"("payload" "jsonb", "mode" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."import_playlist"("payload" "jsonb", "mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_playlist"("payload" "jsonb", "mode" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."import_playlist_with_chapters"("payload" "jsonb", "mode" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."import_playlist_with_chapters"("payload" "jsonb", "mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_playlist_with_chapters"("payload" "jsonb", "mode" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."import_playlist_with_quality"("payload" "jsonb", "mode" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."import_playlist_with_quality"("payload" "jsonb", "mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_playlist_with_quality"("payload" "jsonb", "mode" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."import_playlist_with_teachers"("payload" "jsonb", "mode" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."import_playlist_with_teachers"("payload" "jsonb", "mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_playlist_with_teachers"("payload" "jsonb", "mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_proposal_decision"("p_proposal_id" bigint, "p_raw" "text", "p_decision" "text", "p_teacher_ids" bigint[], "p_note" "text") FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."looks_like_multiple_people"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."looks_like_multiple_people"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."looks_like_multiple_people"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."looks_like_organization"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."looks_like_organization"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."looks_like_organization"("p_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."migrate_class_levels"("p_enable_triggers" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."migrate_class_levels"("p_enable_triggers" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_person_name"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_person_name"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_person_name"("p_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_search_text"("p_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_search_text"("p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_search_text"("p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_search_text"("p_text" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."per_video_chapter_import_capability"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."per_video_chapter_import_capability"() TO "anon";
GRANT ALL ON FUNCTION "public"."per_video_chapter_import_capability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."per_video_chapter_import_capability"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."per_video_chapter_import_snapshot"("p_playlist_id" bigint) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."per_video_chapter_import_video_snapshot"("p_video_id" bigint) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."playlist_channel_still_matches"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."playlist_channel_still_matches"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."playlist_quality_missing"("p_playlist_id" bigint) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."playlist_video_channel_matches"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."playlist_video_channel_matches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_add_comment"("p_poll_id" bigint, "p_body" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."poll_add_comment"("p_poll_id" bigint, "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_add_comment"("p_poll_id" bigint, "p_body" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_admin_close_expired"() TO "anon";
GRANT ALL ON FUNCTION "public"."poll_admin_close_expired"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_admin_close_expired"() TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_admin_list_pending"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."poll_admin_list_pending"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_admin_list_pending"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_admin_list_reports"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."poll_admin_list_reports"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_admin_list_reports"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_admin_resolve_report"("p_report_id" bigint, "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."poll_admin_resolve_report"("p_report_id" bigint, "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_admin_resolve_report"("p_report_id" bigint, "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_admin_review"("p_poll_id" bigint, "p_decision" "text", "p_note" "text", "p_closes_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."poll_admin_review"("p_poll_id" bigint, "p_decision" "text", "p_note" "text", "p_closes_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_admin_review"("p_poll_id" bigint, "p_decision" "text", "p_note" "text", "p_closes_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_admin_set_comment_removed"("p_comment_id" bigint, "p_removed" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."poll_admin_set_comment_removed"("p_comment_id" bigint, "p_removed" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_admin_set_comment_removed"("p_comment_id" bigint, "p_removed" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_admin_set_mode"("p_mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."poll_admin_set_mode"("p_mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_admin_set_mode"("p_mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_admin_set_option_image"("p_option_id" bigint, "p_image_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."poll_admin_set_option_image"("p_option_id" bigint, "p_image_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_admin_set_option_image"("p_option_id" bigint, "p_image_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_admin_set_status"("p_poll_id" bigint, "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."poll_admin_set_status"("p_poll_id" bigint, "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_admin_set_status"("p_poll_id" bigint, "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_apply_comment_delta"() TO "anon";
GRANT ALL ON FUNCTION "public"."poll_apply_comment_delta"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_apply_comment_delta"() TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_apply_vote_delta"() TO "anon";
GRANT ALL ON FUNCTION "public"."poll_apply_vote_delta"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_apply_vote_delta"() TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_cast_vote"("p_poll_id" bigint, "p_option_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."poll_cast_vote"("p_poll_id" bigint, "p_option_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_cast_vote"("p_poll_id" bigint, "p_option_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_clear_vote"("p_poll_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."poll_clear_vote"("p_poll_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_clear_vote"("p_poll_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_delete_comment"("p_comment_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."poll_delete_comment"("p_comment_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_delete_comment"("p_comment_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_edit_comment"("p_comment_id" bigint, "p_body" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."poll_edit_comment"("p_comment_id" bigint, "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_edit_comment"("p_comment_id" bigint, "p_body" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."poll_image_host_allowed"("p_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."poll_image_host_allowed"("p_url" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."poll_is_effectively_closed"("p_status" "text", "p_closes_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."poll_is_effectively_closed"("p_status" "text", "p_closes_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_mode"() TO "anon";
GRANT ALL ON FUNCTION "public"."poll_mode"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_mode"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."poll_options_json"("p_poll_id" bigint, "p_viewer" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."poll_options_json"("p_poll_id" bigint, "p_viewer" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."poll_record_rate_event"("p_user_id" "uuid", "p_action" "text", "p_target_id" bigint, "p_hour_limit" integer, "p_day_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."poll_record_rate_event"("p_user_id" "uuid", "p_action" "text", "p_target_id" bigint, "p_hour_limit" integer, "p_day_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_recount_metrics"("p_apply" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."poll_recount_metrics"("p_apply" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_recount_metrics"("p_apply" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."poll_require_open"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."poll_require_open"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."poll_require_reporter"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."poll_require_reporter"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."poll_require_voter"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."poll_require_voter"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."poll_require_writer"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."poll_require_writer"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."poll_results_visible"("p_poll_id" bigint, "p_viewer" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."poll_results_visible"("p_poll_id" bigint, "p_viewer" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."poll_slugify"("p_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."poll_slugify"("p_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_submit"("p_topic_slug" "text", "p_question" "text", "p_detail" "text", "p_options" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."poll_submit"("p_topic_slug" "text", "p_question" "text", "p_detail" "text", "p_options" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_submit"("p_topic_slug" "text", "p_question" "text", "p_detail" "text", "p_options" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_submit_report"("p_target_type" "text", "p_target_id" bigint, "p_reason" "text", "p_detail" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."poll_submit_report"("p_target_type" "text", "p_target_id" bigint, "p_reason" "text", "p_detail" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_submit_report"("p_target_type" "text", "p_target_id" bigint, "p_reason" "text", "p_detail" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."poll_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."poll_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."poll_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_profile_admin_flag"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_profile_admin_flag"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_review_moderation_columns"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_review_moderation_columns"() TO "service_role";
GRANT ALL ON FUNCTION "public"."protect_review_moderation_columns"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."purge_migration_audit"("p_keep_runs" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purge_migration_audit"("p_keep_runs" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reassign_video_chapter"("p_playlist_id" bigint, "p_video_id" bigint, "p_chapter_id" bigint, "p_expected_current_chapter_id" bigint, "p_allow_shared" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reassign_video_chapter"("p_playlist_id" bigint, "p_video_id" bigint, "p_chapter_id" bigint, "p_expected_current_chapter_id" bigint, "p_allow_shared" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reassign_video_chapter"("p_playlist_id" bigint, "p_video_id" bigint, "p_chapter_id" bigint, "p_expected_current_chapter_id" bigint, "p_allow_shared" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_playlist_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_playlist_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_playlist_rating"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reject_faculty_review_group"("p_normalized" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_faculty_review_group"("p_normalized" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_faculty_review_group"("p_normalized" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reject_proposal"("p_proposal_id" bigint, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_proposal"("p_proposal_id" bigint, "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_teacher_exact"("p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_teacher_exact"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_teacher_exact"("p_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."review_playlist_quality"("p_playlist_id" bigint, "p_display_title" "text", "p_teacher_ids" bigint[], "p_faculty_status" "text", "p_content_type" "text", "p_language" "text", "p_difficulty" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_playlist_quality"("p_playlist_id" bigint, "p_display_title" "text", "p_teacher_ids" bigint[], "p_faculty_status" "text", "p_content_type" "text", "p_language" "text", "p_difficulty" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_playlist_quality"("p_playlist_id" bigint, "p_display_title" "text", "p_teacher_ids" bigint[], "p_faculty_status" "text", "p_content_type" "text", "p_language" "text", "p_difficulty" "text", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."scan_free_text_teachers"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."scan_free_text_teachers"() TO "service_role";
GRANT ALL ON FUNCTION "public"."scan_free_text_teachers"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."search_filler_tokens"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_filler_tokens"() TO "anon";
GRANT ALL ON FUNCTION "public"."search_filler_tokens"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_filler_tokens"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_latin_key"("p_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_latin_key"("p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_latin_key"("p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_latin_key"("p_text" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_playlist_ids"("p_query" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_playlist_ids"("p_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_playlist_ids"("p_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_playlist_ids"("p_query" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_query_tokens"("p_query" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_query_tokens"("p_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_query_tokens"("p_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_query_tokens"("p_query" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_rank"("p_haystack" "text", "p_needle" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_rank"("p_haystack" "text", "p_needle" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_rank"("p_haystack" "text", "p_needle" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_rank"("p_haystack" "text", "p_needle" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_rank_tokens"("p_haystack" "text", "p_tokens" "text"[], "p_needle" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_rank_tokens"("p_haystack" "text", "p_tokens" "text"[], "p_needle" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_rank_tokens"("p_haystack" "text", "p_tokens" "text"[], "p_needle" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_rank_tokens"("p_haystack" "text", "p_tokens" "text"[], "p_needle" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_singular"("p_tok" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_singular"("p_tok" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_singular"("p_tok" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_singular"("p_tok" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_teacher_candidates"("p_query" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_teacher_candidates"("p_query" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_teacher_candidates"("p_query" "text", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_teachers"("p_query" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_teachers"("p_query" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_teachers"("p_query" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_teachers"("p_query" "text", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_teachers_internal"("p_query" "text", "p_limit" integer, "p_include_unverified" boolean) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."search_video_ids"("p_query" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_video_ids"("p_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_video_ids"("p_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_video_ids"("p_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_alias_normalized"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_alias_normalized"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_alias_normalized"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_managed_video_taxonomy"("p_playlist_id" bigint, "p_video_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[], "p_allow_shared" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_managed_video_taxonomy"("p_playlist_id" bigint, "p_video_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[], "p_allow_shared" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_managed_video_taxonomy"("p_playlist_id" bigint, "p_video_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[], "p_allow_shared" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_playlist_teachers"("p_playlist_id" bigint, "p_teacher_ids" bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_playlist_teachers"("p_playlist_id" bigint, "p_teacher_ids" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_playlist_teachers"("p_playlist_id" bigint, "p_teacher_ids" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_teacher_canonical"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_teacher_canonical"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_teacher_canonical"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_teacher_context"("p_teacher_id" bigint, "p_institute_ids" bigint[], "p_subject_ids" bigint[], "p_goal_ids" bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_teacher_context"("p_teacher_id" bigint, "p_institute_ids" bigint[], "p_subject_ids" bigint[], "p_goal_ids" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_teacher_context"("p_teacher_id" bigint, "p_institute_ids" bigint[], "p_subject_ids" bigint[], "p_goal_ids" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_video_taxonomy"("p_video_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_video_taxonomy"("p_video_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_video_taxonomy"("p_video_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_video_teachers"("p_video_id" bigint, "p_teacher_ids" bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_video_teachers"("p_video_id" bigint, "p_teacher_ids" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_video_teachers"("p_video_id" bigint, "p_teacher_ids" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."similar_teachers"("p_name" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."similar_teachers"("p_name" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."similar_teachers"("p_name" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."split_faculty_review_group"("p_normalized" "text", "p_teacher_ids" bigint[], "p_override_kind" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."split_faculty_review_group"("p_normalized" "text", "p_teacher_ids" bigint[], "p_override_kind" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."split_faculty_review_group"("p_normalized" "text", "p_teacher_ids" bigint[], "p_override_kind" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."split_proposal"("p_proposal_id" bigint, "p_teacher_ids" bigint[], "p_override_kind" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."split_proposal"("p_proposal_id" bigint, "p_teacher_ids" bigint[], "p_override_kind" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_playlist_class_levels_array"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_playlist_class_levels_array"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_playlist_class_levels_array"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."touch_playlist_attributes"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."touch_study_material_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_study_material_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_study_material_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."translit_devanagari"("p_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."translit_devanagari"("p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."translit_devanagari"("p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."translit_devanagari"("p_text" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."universal_search"("p_query" "text", "p_types" "text"[], "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."universal_search"("p_query" "text", "p_types" "text"[], "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."universal_search"("p_query" "text", "p_types" "text"[], "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."universal_search"("p_query" "text", "p_types" "text"[], "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_managed_playlist"("p_playlist_id" bigint, "p_expected_title" "text", "p_title" "text", "p_teacher" "text", "p_channel_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[], "p_content_type" "text", "p_language" "text", "p_difficulty" "text", "p_audience_focus" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_managed_playlist"("p_playlist_id" bigint, "p_expected_title" "text", "p_title" "text", "p_teacher" "text", "p_channel_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[], "p_content_type" "text", "p_language" "text", "p_difficulty" "text", "p_audience_focus" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_managed_playlist"("p_playlist_id" bigint, "p_expected_title" "text", "p_title" "text", "p_teacher" "text", "p_channel_id" bigint, "p_learning_goal_ids" bigint[], "p_class_level_ids" bigint[], "p_content_type" "text", "p_language" "text", "p_difficulty" "text", "p_audience_focus" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_import_payload"("payload" "jsonb", "mode" "text", "require_videos" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_import_payload"("payload" "jsonb", "mode" "text", "require_videos" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_study_material_scope"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_study_material_scope"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_study_material_scope"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_teacher_ids_payload"("payload" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."video_channel_still_matches"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."video_channel_still_matches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."app_environment" TO "anon";
GRANT ALL ON TABLE "public"."app_environment" TO "authenticated";
GRANT ALL ON TABLE "public"."app_environment" TO "service_role";



GRANT ALL ON TABLE "public"."boards" TO "anon";
GRANT ALL ON TABLE "public"."boards" TO "authenticated";
GRANT ALL ON TABLE "public"."boards" TO "service_role";



GRANT ALL ON SEQUENCE "public"."boards_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."boards_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."boards_id_seq" TO "service_role";



GRANT SELECT ON TABLE "public"."catalog_management_audit" TO "authenticated";
GRANT SELECT ON TABLE "public"."catalog_management_audit" TO "service_role";



GRANT ALL ON SEQUENCE "public"."catalog_management_audit_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."catalog_management_audit_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."catalog_management_audit_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."category_learning_goals" TO "anon";
GRANT ALL ON TABLE "public"."category_learning_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."category_learning_goals" TO "service_role";



GRANT ALL ON TABLE "public"."chapter_class_levels" TO "service_role";
GRANT SELECT ON TABLE "public"."chapter_class_levels" TO "anon";
GRANT SELECT ON TABLE "public"."chapter_class_levels" TO "authenticated";



GRANT ALL ON TABLE "public"."chapters" TO "anon";
GRANT ALL ON TABLE "public"."chapters" TO "authenticated";
GRANT ALL ON TABLE "public"."chapters" TO "service_role";



GRANT ALL ON SEQUENCE "public"."chapters_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."chapters_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."chapters_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."class_levels" TO "anon";
GRANT ALL ON TABLE "public"."class_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."class_levels" TO "service_role";



GRANT ALL ON SEQUENCE "public"."class_levels_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."class_levels_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."class_levels_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."class_levels_migration_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."class_levels_migration_audit" TO "service_role";



GRANT ALL ON SEQUENCE "public"."class_levels_migration_audit_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."class_levels_migration_audit_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."class_levels_migration_audit_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."content_reports" TO "anon";
GRANT ALL ON TABLE "public"."content_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."content_reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."content_reports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."content_reports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."forum_comments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."forum_comments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."forum_comments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."forum_comments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."forum_moderation_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."forum_moderation_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."forum_moderation_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."forum_moderation_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."forum_posts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."forum_posts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."forum_posts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."forum_posts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."forum_rate_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."forum_rate_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."forum_rate_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."forum_rate_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."forum_reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."forum_reports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."forum_reports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."forum_reports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."forum_settings" TO "service_role";



GRANT ALL ON TABLE "public"."forum_suspensions" TO "service_role";



GRANT ALL ON TABLE "public"."forum_topics" TO "service_role";



GRANT ALL ON SEQUENCE "public"."forum_topics_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."forum_topics_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."forum_topics_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."forum_user_stats" TO "service_role";



GRANT ALL ON TABLE "public"."forum_votes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."forum_votes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."forum_votes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."forum_votes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."institutes_channels" TO "anon";
GRANT ALL ON TABLE "public"."institutes_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."institutes_channels" TO "service_role";



GRANT ALL ON SEQUENCE "public"."institutes_channels_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."institutes_channels_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."institutes_channels_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."learning_goal_class_levels" TO "anon";
GRANT ALL ON TABLE "public"."learning_goal_class_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_goal_class_levels" TO "service_role";



GRANT ALL ON TABLE "public"."learning_goal_topics" TO "service_role";



GRANT ALL ON TABLE "public"."learning_goals" TO "anon";
GRANT ALL ON TABLE "public"."learning_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_goals" TO "service_role";



GRANT ALL ON SEQUENCE "public"."learning_goals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."learning_goals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."learning_goals_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."playlist_attributes" TO "service_role";



GRANT ALL ON TABLE "public"."playlist_boards" TO "anon";
GRANT ALL ON TABLE "public"."playlist_boards" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist_boards" TO "service_role";



GRANT ALL ON TABLE "public"."playlist_class_levels" TO "anon";
GRANT ALL ON TABLE "public"."playlist_class_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist_class_levels" TO "service_role";



GRANT SELECT ON TABLE "public"."playlist_import_audit" TO "authenticated";
GRANT SELECT ON TABLE "public"."playlist_import_audit" TO "service_role";



GRANT ALL ON TABLE "public"."playlist_learning_goals" TO "anon";
GRANT ALL ON TABLE "public"."playlist_learning_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist_learning_goals" TO "service_role";



GRANT SELECT ON TABLE "public"."playlist_quality_reviews" TO "authenticated";
GRANT SELECT ON TABLE "public"."playlist_quality_reviews" TO "service_role";



GRANT ALL ON SEQUENCE "public"."playlist_quality_reviews_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."playlist_quality_reviews_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."playlist_quality_reviews_id_seq" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."playlist_ratings" TO "anon";
GRANT ALL ON TABLE "public"."playlist_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist_ratings" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."playlist_ratings" TO "anon";



GRANT SELECT("playlist_id") ON TABLE "public"."playlist_ratings" TO "anon";



GRANT SELECT("rating") ON TABLE "public"."playlist_ratings" TO "anon";



GRANT SELECT("review") ON TABLE "public"."playlist_ratings" TO "anon";



GRANT SELECT("created_at") ON TABLE "public"."playlist_ratings" TO "anon";



GRANT SELECT("difficulty") ON TABLE "public"."playlist_ratings" TO "anon";



GRANT SELECT("best_for") ON TABLE "public"."playlist_ratings" TO "anon";



GRANT SELECT("review_hidden") ON TABLE "public"."playlist_ratings" TO "anon";



GRANT ALL ON SEQUENCE "public"."playlist_ratings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."playlist_ratings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."playlist_ratings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."playlist_teachers" TO "anon";
GRANT ALL ON TABLE "public"."playlist_teachers" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist_teachers" TO "service_role";



GRANT ALL ON TABLE "public"."playlist_videos" TO "anon";
GRANT ALL ON TABLE "public"."playlist_videos" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist_videos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."playlist_videos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."playlist_videos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."playlist_videos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."playlists" TO "anon";
GRANT ALL ON TABLE "public"."playlists" TO "authenticated";
GRANT ALL ON TABLE "public"."playlists" TO "service_role";



GRANT ALL ON SEQUENCE "public"."playlists_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."playlists_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."playlists_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."poll_comments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."poll_comments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."poll_comments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."poll_comments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."poll_image_hosts" TO "service_role";



GRANT ALL ON TABLE "public"."poll_options" TO "service_role";



GRANT ALL ON SEQUENCE "public"."poll_options_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."poll_options_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."poll_options_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."poll_rate_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."poll_rate_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."poll_rate_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."poll_rate_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."poll_reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."poll_reports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."poll_reports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."poll_reports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."poll_settings" TO "service_role";



GRANT ALL ON TABLE "public"."poll_votes" TO "service_role";



GRANT ALL ON TABLE "public"."polls" TO "service_role";



GRANT ALL ON SEQUENCE "public"."polls_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."polls_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."polls_id_seq" TO "service_role";



GRANT REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("id"),INSERT("id") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("username") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("username") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("full_name") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("full_name"),INSERT("full_name"),UPDATE("full_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("avatar_url") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("avatar_url"),INSERT("avatar_url"),UPDATE("avatar_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."study_material_scopes" TO "service_role";
GRANT SELECT ON TABLE "public"."study_material_scopes" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."study_material_scopes" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."study_material_scopes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."study_material_scopes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."study_material_scopes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."study_material_videos" TO "service_role";
GRANT SELECT ON TABLE "public"."study_material_videos" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."study_material_videos" TO "authenticated";



GRANT ALL ON TABLE "public"."study_materials" TO "service_role";
GRANT SELECT ON TABLE "public"."study_materials" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."study_materials" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."study_materials_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."study_materials_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."study_materials_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."subjects" TO "anon";
GRANT ALL ON TABLE "public"."subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."subjects" TO "service_role";



GRANT ALL ON SEQUENCE "public"."subjects_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."subjects_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."subjects_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_aliases" TO "anon";
GRANT ALL ON TABLE "public"."teacher_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_aliases" TO "service_role";



GRANT ALL ON SEQUENCE "public"."teacher_aliases_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teacher_aliases_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teacher_aliases_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_institutes" TO "anon";
GRANT ALL ON TABLE "public"."teacher_institutes" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_institutes" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_learning_goals" TO "anon";
GRANT ALL ON TABLE "public"."teacher_learning_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_learning_goals" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_name_proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_name_proposals" TO "service_role";



GRANT ALL ON SEQUENCE "public"."teacher_name_proposals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teacher_name_proposals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teacher_name_proposals_id_seq" TO "service_role";



GRANT SELECT ON TABLE "public"."teacher_proposal_decisions" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."teacher_proposal_decisions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teacher_proposal_decisions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teacher_proposal_decisions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_subjects" TO "anon";
GRANT ALL ON TABLE "public"."teacher_subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_subjects" TO "service_role";



GRANT ALL ON TABLE "public"."teachers" TO "anon";
GRANT ALL ON TABLE "public"."teachers" TO "authenticated";
GRANT ALL ON TABLE "public"."teachers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."teachers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teachers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teachers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."topics" TO "service_role";



GRANT ALL ON SEQUENCE "public"."topics_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."topics_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."topics_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."video_class_levels" TO "anon";
GRANT ALL ON TABLE "public"."video_class_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."video_class_levels" TO "service_role";



GRANT ALL ON TABLE "public"."video_comments" TO "anon";
GRANT ALL ON TABLE "public"."video_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."video_comments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."video_comments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."video_comments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."video_comments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."video_learning_goals" TO "anon";
GRANT ALL ON TABLE "public"."video_learning_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."video_learning_goals" TO "service_role";



GRANT ALL ON TABLE "public"."video_progress" TO "anon";
GRANT ALL ON TABLE "public"."video_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."video_progress" TO "service_role";



GRANT ALL ON SEQUENCE "public"."video_progress_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."video_progress_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."video_progress_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."video_stats" TO "anon";
GRANT ALL ON TABLE "public"."video_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."video_stats" TO "service_role";



GRANT ALL ON TABLE "public"."video_teachers" TO "anon";
GRANT ALL ON TABLE "public"."video_teachers" TO "authenticated";
GRANT ALL ON TABLE "public"."video_teachers" TO "service_role";



GRANT ALL ON TABLE "public"."video_topics" TO "service_role";



GRANT ALL ON TABLE "public"."videos" TO "anon";
GRANT ALL ON TABLE "public"."videos" TO "authenticated";
GRANT ALL ON TABLE "public"."videos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."videos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."videos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."videos_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































