-- ============================================================================
-- Approve-as-new checks for existing faculty before it creates anyone.
--
-- WHAT HAPPENED. On 2026-09-08 a review batch called
-- approve_faculty_review_group_as_new for 40 names that already belonged to
-- verified teachers credited on the same courses: "Alakh Pandey", "ABJ Sir",
-- "Saleem" and so on. It created 40 unverified copies (teacher ids 98-137),
-- each with its own indexable /faculty page. They were deleted on 2026-09-15
-- and their addresses now redirect (src/retiredFacultySlugs.js).
--
-- WHY NOTHING STOPPED IT. create_teacher already refuses a name that existing
-- faculty answer to -- an exact display name or a verified alias, match_rank 1
-- in search_teachers_internal -- unless the caller passes
-- p_duplicate_acknowledged. approve_proposal_as_new called it with that flag
-- hard-coded:
--
--   v_new := public.create_teacher(coalesce(p_display_name, trim(p.raw_teacher)), '[]'::jsonb, p_verified, true);
--
-- so the check never ran on the one path that creates teachers from the admin
-- panel. It then returned the warning under 'similar_existing', a key
-- create_teacher never sets, so that was always null too. Measured on
-- production 2026-09-15 through search_teachers: every spelling that batch
-- used, typed and raw, is an exact rank-1 match for the teacher it duplicated.
-- The existing check would have refused all 40.
--
-- WHY IT CANNOT SIMPLY ALWAYS REFUSE. Nothing else in the admin panel creates a
-- teacher (create_teacher is service_role only), and two different people can
-- share a name -- the slug trigger numbers a second "Amit Kumar" amit-kumar-2
-- for exactly that. So both functions gain p_duplicate_acknowledged boolean
-- default false. Without it they refuse; the panel shows the matches and asks
-- before sending true.
--
-- WHAT CHANGES
--   * approve_proposal_as_new checks the name being created AND the spelling
--     the courses carry (raw_teacher). create_teacher only ever saw the first.
--   * Only an explicit true acknowledges. A null counts as no acknowledgement;
--     `not null` is null in SQL, which would otherwise skip this check and
--     create_teacher's own.
--   * A name create_teacher would reject anyway -- blank, several people, a
--     team -- is rejected first, in create_teacher's own words, so the panel
--     never asks the curator to confirm something that cannot be created.
--   * approve_faculty_review_group_as_new passes the flag to that check, which
--     runs on the group's first proposal and aborts the whole group when it
--     refuses. The first spelling stands for all of them: the scan stores
--     normalize_person_name(raw_teacher) as normalized, and the check matches
--     on that same normalisation.
--   * A refusal is errcode check_violation (23514) with hint
--     'duplicate_faculty' and the matches as JSON in detail, so the panel can
--     tell it from every other failure and offer to link to each match.
--     Nothing is written; the proposal stays pending.
--   * An acknowledged creation names the faculty it was created beside in the
--     decision log's note. Both results report duplicate_acknowledged and
--     matched_existing in place of the dead 'similar_existing' key.
--   Everything else in both bodies is the baseline's, statement for statement.
--
-- GRANTS. A new parameter is a new signature, so both functions are DROPped
-- and created. This database has Supabase's default privileges (baseline:
-- ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon, authenticated),
-- so a created function is granted straight to anon and authenticated, and a
-- revoke from PUBLIC does not remove that (see 20260915100000). Both are
-- revoked from anon and authenticated BY NAME and given exactly the baseline's
-- grants back:
--   approve_faculty_review_group_as_new   authenticated + service_role
--   approve_proposal_as_new               service_role only
-- The verify block checks has_function_privilege here, on the real database,
-- which is the only place those defaults apply.
--
-- DEPLOY ORDER. Nothing breaks in either order. PostgREST resolves the panel's
-- existing three-argument call to the new function through the default, and
-- the new panel sends p_duplicate_acknowledged only when retrying this
-- refusal, which the old function never produces. But until the panel on
-- `release` has this change, a genuinely different person who shares a name
-- cannot be confirmed from the panel. Ship the panel before, or with, the push.
--
-- THE SELF-TEST refuses a matching spelling, a matching name and a matching
-- group, and creates only when acknowledged. It runs against a real teacher
-- whose name has no pending or deferred proposal, so whatever happens to be in
-- the review queue cannot decide its outcome, inside subtransactions that are
-- rolled back, then checks nothing was left behind. It consumes a few identity
-- values (sequences do not roll back); it writes no rows.
-- ============================================================================

do $preflight$
begin
  if to_regprocedure('public.approve_proposal_as_new(bigint,text,boolean)') is null then
    raise exception 'REFUSING: approve_proposal_as_new(bigint,text,boolean) is missing; this replaces the baseline version';
  end if;
  if to_regprocedure('public.approve_faculty_review_group_as_new(text,text,boolean)') is null then
    raise exception 'REFUSING: approve_faculty_review_group_as_new(text,text,boolean) is missing; this replaces the baseline version';
  end if;
  if to_regprocedure('public.approve_proposal_as_new(bigint,text,boolean,boolean)') is not null
     or to_regprocedure('public.approve_faculty_review_group_as_new(text,text,boolean,boolean)') is not null then
    raise exception 'REFUSING: the four-argument versions already exist';
  end if;
  if to_regprocedure('public.create_teacher(text,jsonb,boolean,boolean)') is null
     or to_regprocedure('public.search_teachers_internal(text,integer,boolean)') is null
     or to_regprocedure('public.approve_proposal_as_existing(bigint,bigint,boolean)') is null
     or to_regprocedure('public.add_teacher_alias(bigint,text,text,boolean)') is null
     or to_regprocedure('public.log_proposal_decision(bigint,text,text,bigint[],text)') is null
     or to_regprocedure('public.looks_like_multiple_people(text)') is null
     or to_regprocedure('public.looks_like_organization(text)') is null then
    raise exception 'REFUSING: a function these approvals call is missing or has a different signature';
  end if;
end
$preflight$;

drop function public.approve_faculty_review_group_as_new(text, text, boolean);
drop function public.approve_proposal_as_new(bigint, text, boolean);

create function public.approve_proposal_as_new(
  p_proposal_id bigint,
  p_display_name text default null,
  p_verified boolean default false,
  p_duplicate_acknowledged boolean default false)
returns jsonb
language plpgsql security definer
set search_path to ''
as $fn$
declare p record; v_new jsonb; v_tid bigint; v_links int := 0;
        v_name text; v_matches jsonb; v_list text; v_note text;
        v_ack boolean := coalesce(p_duplicate_acknowledged, false);
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

  v_name := coalesce(p_display_name, trim(p.raw_teacher));

  -- create_teacher's own refusals, first and in its own words, so a name that
  -- could never be created is not offered as "a different person" to confirm.
  if public.normalize_person_name(v_name) is null then
    raise exception 'display_name is required'; end if;
  if public.looks_like_multiple_people(v_name) then
    raise exception 'display_name "%" looks like more than one person', v_name; end if;
  if public.looks_like_organization(v_name) then
    raise exception 'display_name "%" looks like a team or department, not a person', v_name; end if;

  -- create_teacher's own duplicate test (match_rank 1: an exact display name or
  -- a verified alias), run on the name being created AND on the spelling the
  -- courses carry.
  select jsonb_agg(jsonb_build_object('teacher_id', m.teacher_id, 'display_name', m.display_name,
                                      'slug', m.slug) order by m.teacher_id),
         string_agg(format('%s (#%s)', m.display_name, m.teacher_id), ', ' order by m.teacher_id)
    into v_matches, v_list
    from (select distinct s.teacher_id, s.display_name, s.slug
            from unnest(array[v_name, trim(p.raw_teacher)]) as n(name)
            cross join lateral public.search_teachers_internal(n.name, 5, true) s
           where s.match_rank = 1) m;

  if v_matches is not null and not v_ack then
    raise exception 'Existing faculty already match "%": %. Link this name to them, or confirm it is a different person to create a separate record.', v_name, v_list
      using errcode = 'check_violation', hint = 'duplicate_faculty', detail = v_matches::text;
  end if;
  if v_matches is not null then
    v_note := format('Created as a different person beside existing faculty: %s', v_list);
  end if;

  v_new := public.create_teacher(v_name, '[]'::jsonb, p_verified, v_ack);
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
                                       array[v_tid], v_note);

  return jsonb_build_object('proposal_id', p_proposal_id, 'teacher_id', v_tid,
                            'playlists_linked', v_links,
                            'duplicate_acknowledged', v_ack,
                            'matched_existing', coalesce(v_matches, '[]'::jsonb));
end; $fn$;

create function public.approve_faculty_review_group_as_new(
  p_normalized text,
  p_display_name text,
  p_verified boolean default false,
  p_duplicate_acknowledged boolean default false)
returns jsonb
language plpgsql security definer
set search_path to ''
as $fn$
declare r record; v_result jsonb; v_teacher_id bigint; v_done int := 0; v_links int := 0;
        v_matches jsonb;
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
      -- The duplicate check runs in here, on the first proposal, and a refusal
      -- aborts the whole group. Checking the first spelling covers them all:
      -- scan_free_text_teachers stores normalize_person_name(raw_teacher) as
      -- normalized, and the check matches on that same normalisation, so
      -- every spelling in a group matches exactly the same faculty.
      v_result := public.approve_proposal_as_new(r.id, p_display_name, p_verified, coalesce(p_duplicate_acknowledged, false));
      v_teacher_id := (v_result->>'teacher_id')::bigint;
      v_matches := v_result->'matched_existing';
    else
      v_result := public.approve_proposal_as_existing(r.id, v_teacher_id, true);
    end if;
    v_links := v_links + coalesce((v_result->>'playlists_linked')::int, 0);
    v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;

  return jsonb_build_object('normalized', p_normalized, 'variants_resolved', v_done,
    'teacher_id', v_teacher_id, 'playlists_linked', v_links,
    'duplicate_acknowledged', coalesce(p_duplicate_acknowledged, false),
    'matched_existing', coalesce(v_matches, '[]'::jsonb));
end; $fn$;

alter function public.approve_proposal_as_new(bigint, text, boolean, boolean) owner to postgres;
alter function public.approve_faculty_review_group_as_new(text, text, boolean, boolean) owner to postgres;

revoke all on function public.approve_proposal_as_new(bigint, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.approve_faculty_review_group_as_new(text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.approve_proposal_as_new(bigint, text, boolean, boolean) to service_role;
grant execute on function public.approve_faculty_review_group_as_new(text, text, boolean, boolean) to authenticated, service_role;

do $verify$
declare
  v_fail text[] := array[]::text[];
begin
  if to_regprocedure('public.approve_proposal_as_new(bigint,text,boolean)') is not null then
    v_fail := v_fail || 'the three-argument approve_proposal_as_new still exists, so a call could reach the unchecked body'::text;
  end if;
  if to_regprocedure('public.approve_faculty_review_group_as_new(text,text,boolean)') is not null then
    v_fail := v_fail || 'the three-argument approve_faculty_review_group_as_new still exists, so a call could reach the unchecked body'::text;
  end if;

  -- approve_proposal_as_new: service_role only.
  if has_function_privilege('anon', 'public.approve_proposal_as_new(bigint,text,boolean,boolean)', 'execute') then
    v_fail := v_fail || 'anon can execute approve_proposal_as_new'::text;
  end if;
  if has_function_privilege('authenticated', 'public.approve_proposal_as_new(bigint,text,boolean,boolean)', 'execute') then
    v_fail := v_fail || 'authenticated can execute approve_proposal_as_new, which the baseline grants to service_role only'::text;
  end if;
  if not has_function_privilege('service_role', 'public.approve_proposal_as_new(bigint,text,boolean,boolean)', 'execute') then
    v_fail := v_fail || 'service_role lost approve_proposal_as_new'::text;
  end if;

  -- approve_faculty_review_group_as_new: authenticated + service_role; its own
  -- is_admin() check decides which signed-in users may actually approve.
  if has_function_privilege('anon', 'public.approve_faculty_review_group_as_new(text,text,boolean,boolean)', 'execute') then
    v_fail := v_fail || 'anon can execute approve_faculty_review_group_as_new'::text;
  end if;
  if not has_function_privilege('authenticated', 'public.approve_faculty_review_group_as_new(text,text,boolean,boolean)', 'execute') then
    v_fail := v_fail || 'authenticated lost approve_faculty_review_group_as_new, which the admin panel calls'::text;
  end if;
  if not has_function_privilege('service_role', 'public.approve_faculty_review_group_as_new(text,text,boolean,boolean)', 'execute') then
    v_fail := v_fail || 'service_role lost approve_faculty_review_group_as_new'::text;
  end if;

  if array_length(v_fail, 1) > 0 then
    raise exception 'APPROVE-AS-NEW GRANTS SELF-TEST FAILED (rolled back): %', array_to_string(v_fail, ' | ');
  end if;
end
$verify$;

do $selftest$
declare
  v_fail text[] := array[]::text[];
  v_teacher record;
  v_spelling text;
  v_group_spelling text;
  v_acknowledged_spelling text;
  v_unmatched constant text := 'Zz Selftest Unmatched Spelling Qxj';
  v_nobody constant text := 'Zz Selftest Nobody Qxj';
  v_pid bigint;
  v_teachers bigint;
  v_proposals bigint;
  v_decisions bigint;
  v_hint text;
  v_result jsonb;
begin
  -- A teacher whose name has no pending or deferred proposal, so case 3's group
  -- call meets only the proposal this block inserts, whatever is in the queue.
  select t.id, t.display_name into v_teacher
    from public.teachers t
   where not exists (select 1 from public.teacher_name_proposals q
                      where q.normalized = t.canonical_name
                        and q.status in ('pending','deferred'))
     and not public.looks_like_multiple_people(t.display_name)
     and not public.looks_like_organization(t.display_name)
   order by t.id limit 1;
  if not found then
    raise exception 'REFUSING: no teacher has a name free of pending proposals to test the duplicate check against';
  end if;
  select count(*) into v_teachers from public.teachers;
  select count(*) into v_proposals from public.teacher_name_proposals;
  select count(*) into v_decisions from public.teacher_proposal_decisions;

  -- Spellings of that teacher that no course carries. "Guruji", "Bhaiya" and
  -- "Bhaiyya" are all honorifics normalize_person_name strips, so each
  -- normalises to the teacher's own name. One per case, because raw_teacher is
  -- unique and a case whose guard failed keeps its row until the final raise.
  v_spelling := v_teacher.display_name || ' Guruji Bhaiya';
  v_group_spelling := v_teacher.display_name || ' Bhaiya Guruji';
  v_acknowledged_spelling := v_teacher.display_name || ' Guruji Bhaiyya';
  if public.normalize_person_name(v_spelling) is distinct from public.normalize_person_name(v_teacher.display_name)
     or public.normalize_person_name(v_group_spelling) is distinct from public.normalize_person_name(v_teacher.display_name)
     or public.normalize_person_name(v_acknowledged_spelling) is distinct from public.normalize_person_name(v_teacher.display_name) then
    raise exception 'REFUSING: a self-test spelling of % does not normalise to the teacher''s name', v_teacher.display_name;
  end if;
  if exists (select 1 from public.teacher_name_proposals
              where raw_teacher in (v_spelling, v_group_spelling, v_acknowledged_spelling, v_unmatched)) then
    raise exception 'REFUSING: a self-test spelling already exists as a proposal';
  end if;

  -- 1. The spelling the courses carry matches, the typed name does not.
  begin
    insert into public.teacher_name_proposals (raw_teacher, normalized, occurrences, kind)
    values (v_spelling, public.normalize_person_name(v_spelling), 0, 'single')
    returning id into v_pid;
    perform public.approve_proposal_as_new(v_pid, v_nobody, false, false);
    v_fail := v_fail || 'approve_proposal_as_new created a teacher although the courses'' spelling matches existing faculty'::text;
  exception
    when check_violation then
      get stacked diagnostics v_hint = pg_exception_hint;
      if v_hint is distinct from 'duplicate_faculty' then
        v_fail := v_fail || format('a matching spelling hit a different check_violation (hint %s): %s', coalesce(nullif(v_hint, ''), 'none'), sqlerrm);
      end if;
    when others then
      v_fail := v_fail || format('a matching spelling was refused with SQLSTATE %s, not check_violation: %s', sqlstate, sqlerrm);
  end;

  -- 2. The typed name matches, the spelling does not.
  begin
    insert into public.teacher_name_proposals (raw_teacher, normalized, occurrences, kind)
    values (v_unmatched, public.normalize_person_name(v_unmatched), 0, 'single')
    returning id into v_pid;
    perform public.approve_proposal_as_new(v_pid, v_teacher.display_name, false, false);
    v_fail := v_fail || 'approve_proposal_as_new created a teacher under an existing teacher''s exact name'::text;
  exception
    when check_violation then
      get stacked diagnostics v_hint = pg_exception_hint;
      if v_hint is distinct from 'duplicate_faculty' then
        v_fail := v_fail || format('a matching name hit a different check_violation (hint %s): %s', coalesce(nullif(v_hint, ''), 'none'), sqlerrm);
      end if;
    when others then
      v_fail := v_fail || format('a matching name was refused with SQLSTATE %s, not check_violation: %s', sqlstate, sqlerrm);
  end;

  -- 3. The group function, which is what the admin panel calls.
  begin
    insert into public.teacher_name_proposals (raw_teacher, normalized, occurrences, kind)
    values (v_group_spelling, public.normalize_person_name(v_group_spelling), 0, 'single')
    returning id into v_pid;
    perform public.approve_faculty_review_group_as_new(public.normalize_person_name(v_group_spelling), v_nobody, false, false);
    v_fail := v_fail || 'approve_faculty_review_group_as_new created a teacher although a pending spelling matches existing faculty'::text;
  exception
    when check_violation then
      get stacked diagnostics v_hint = pg_exception_hint;
      if v_hint is distinct from 'duplicate_faculty' then
        v_fail := v_fail || format('a matching group hit a different check_violation (hint %s): %s', coalesce(nullif(v_hint, ''), 'none'), sqlerrm);
      end if;
    when others then
      v_fail := v_fail || format('a matching group was refused with SQLSTATE %s, not check_violation: %s', sqlstate, sqlerrm);
  end;

  -- 4. Acknowledged: a different person with the same name is created. Then
  --    rolled back on purpose.
  begin
    insert into public.teacher_name_proposals (raw_teacher, normalized, occurrences, kind)
    values (v_acknowledged_spelling, public.normalize_person_name(v_acknowledged_spelling), 0, 'single')
    returning id into v_pid;
    v_result := public.approve_proposal_as_new(v_pid, v_teacher.display_name, false, true);
    if (select count(*) from public.teachers) <> v_teachers + 1 then
      v_fail := v_fail || 'an acknowledged approval did not create exactly one teacher'::text;
    end if;
    if not coalesce((v_result->>'duplicate_acknowledged')::boolean, false)
       or jsonb_array_length(coalesce(v_result->'matched_existing', '[]'::jsonb)) = 0 then
      v_fail := v_fail || 'an acknowledged approval did not report the faculty it matched'::text;
    end if;
    if not exists (select 1 from public.teacher_proposal_decisions d
                    where d.proposal_id = v_pid
                      and strpos(coalesce(d.note, ''), v_teacher.display_name) > 0) then
      v_fail := v_fail || 'an acknowledged approval did not name the matched faculty in the decision log'::text;
    end if;
    raise exception 'APPROVE-AS-NEW SELF-TEST ROLLBACK';
  exception when others then
    if sqlerrm <> 'APPROVE-AS-NEW SELF-TEST ROLLBACK' then
      v_fail := v_fail || format('an acknowledged approval failed: %s', sqlerrm);
    end if;
  end;

  if (select count(*) from public.teachers) <> v_teachers then
    v_fail := v_fail || 'the self-test left a teacher behind'::text;
  end if;
  if (select count(*) from public.teacher_name_proposals) <> v_proposals then
    v_fail := v_fail || 'the self-test left a proposal behind'::text;
  end if;
  if (select count(*) from public.teacher_proposal_decisions) <> v_decisions then
    v_fail := v_fail || 'the self-test left a decision behind'::text;
  end if;

  if array_length(v_fail, 1) > 0 then
    raise exception 'APPROVE-AS-NEW SELF-TEST FAILED (rolled back): %', array_to_string(v_fail, ' | ');
  end if;
  raise notice 'APPROVE-AS-NEW NOW CHECKS EXISTING FACULTY: refused a matching spelling, name and group; created a same-name person only when acknowledged; left nothing behind.';
end
$selftest$;
