-- ============================================================================
-- The review queue tells you WHERE a name teaches, not whether it is a person.
-- This adds the one fact that most often decides it: is the name also the name
-- of the channel its courses sit on?
--
-- WHY. scan_free_text_teachers classifies with two keyword regexes.
-- looks_like_organization matches team|department|faculty|institute|academy|
-- classes and so on. "Magnet Brains" contains none of those words, so it
-- reaches the queue labelled `single` -- offered to a reviewer as a person.
--
-- MEASURED, 8 Sep 2026, working the live queue down from 110 groups to 7:
-- of the nine proposals rejected, SIX were organisations the keyword rule had
-- called `single`:
--
--     Competishun+ (76 courses)   Magnet Brains (10)   NEEV Competishun (4)
--     ExpHub (1)                  Sunlike Study (1)    Hindi Adhyapak (2)
--
-- Every one of them is the name of the YouTube channel its courses sit on.
-- That fact is in the catalogue already and the queue never showed it, so each
-- was caught by hand, one at a time.
--
-- WHAT THIS DELIBERATELY DOES NOT DO: reclassify anything. `kind` is untouched.
-- The signal is a separate column the reviewer reads, because it CANNOT decide
-- on its own -- it is equally true of a teacher who owns their channel. On this
-- catalogue, the same rule flags:
--
--     organisations           Competishun+, Magnet Brains, NEEV Competishun,
--                             Sunlike Study, ExpHub, Hindi Adhyapak
--     real people             Mohit Tyagi (32 courses), Digraj Singh Rajput (5),
--                             Vinay Uppal (1), Shobhit Nirwan (1)
--
-- A rule that rejected on this signal would have removed four real teachers.
-- I know because I wrote that summary earlier the same day and it was wrong;
-- the column is named for the evidence it carries, not for a verdict.
--
-- COMPUTED LIVE, not stored. A stored flag would go stale the moment a channel
-- is renamed or a course is added, and this is a proposal queue whose whole
-- purpose is to be re-read. The join is against playlists, which is 490 rows.
--
-- MIRRORS src/facultyProposalContext.js, which computes the same thing on the
-- client for the same panel: true only when EVERY course carrying the name sits
-- on a channel of that name. A teacher with one self-named course among many is
-- a person, not an organisation, and must not be flagged.
--
-- Return-type change, so these two are DROPped and recreated rather than
-- replaced -- Postgres refuses `create or replace` when the output columns
-- change. Grants are restated because a drop takes them with it.
-- ============================================================================

do $preflight$
begin
  if to_regprocedure('public.get_proposal_groups(text)') is null then
    raise exception 'REFUSING: get_proposal_groups is missing; this migration replaces it, it does not create it';
  end if;
  if to_regprocedure('public.get_faculty_review_groups(text)') is null then
    raise exception 'REFUSING: get_faculty_review_groups is missing';
  end if;
  if to_regclass('public.institutes_channels') is null then
    raise exception 'REFUSING: institutes_channels is missing; the signal joins against it';
  end if;
end
$preflight$;

drop function if exists public.get_faculty_review_groups(text);
drop function if exists public.get_proposal_groups(text);

create or replace function public.get_proposal_groups(p_status text default 'pending')
returns table (
    normalized        text,
    kind              text,
    variants          jsonb,     -- [{proposal_id, raw_teacher, occurrences}]
    variant_count     int,
    total_occurrences bigint,
    candidates        jsonb,     -- existing faculty this group might be
    self_named_channel boolean   -- every course sits on a channel of this name
) language sql stable security definer set search_path = '' as $$
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
                  ), '[]'::jsonb),
         -- TRUE only when the name carries no course that sits anywhere else.
         -- Whitespace is collapsed and case folded, nothing more: this must
         -- match on the name as written, not on a normalisation of its own.
         coalesce((
           select count(*) > 0
              and count(*) filter (
                    where lower(regexp_replace(btrim(ic.name), '[[:space:]]+', ' ', 'g'))
                        = lower(regexp_replace(btrim(pl.teacher), '[[:space:]]+', ' ', 'g'))
                  ) = count(*)
             from public.playlists pl
             left join public.institutes_channels ic on ic.id = pl.institute_channel_id
            where pl.teacher = any (array_agg(p.raw_teacher))
         ), false)
    from public.teacher_name_proposals p
   where p.status = coalesce(p_status, 'pending')
     and p.normalized is not null
   group by p.normalized
   order by sum(p.occurrences) desc;
$$;

alter function public.get_proposal_groups(text) owner to postgres;
revoke all on function public.get_proposal_groups(text) from public;
grant execute on function public.get_proposal_groups(text) to service_role;

create or replace function public.get_faculty_review_groups(p_status text default 'pending')
returns table (
    normalized text, kind text, variants jsonb, variant_count int,
    total_occurrences bigint, candidates jsonb, self_named_channel boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select * from public.get_proposal_groups(p_status);
end; $$;

alter function public.get_faculty_review_groups(text) owner to postgres;
revoke all on function public.get_faculty_review_groups(text) from public;
grant execute on function public.get_faculty_review_groups(text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION. The claim is that this ADDS a fact and changes no
-- classification, so that is what gets checked -- not that the column exists,
-- which a grep would show.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_fail text[] := array[]::text[];
  v_rows int;
  v_null int;
  v_drift int;
begin
  -- It returns, and the new column is there and never null. A null would be
  -- read as "no" by every caller, which is a verdict this cannot make.
  select count(*), count(*) filter (where g.self_named_channel is null)
    into v_rows, v_null
    from public.get_proposal_groups('pending') g;
  if v_null > 0 then
    v_fail := v_fail || (v_null || ' pending groups have a null signal')::text;
  end if;

  -- kind is UNCHANGED. Compared against the proposals table directly, so a
  -- body that quietly reclassified anything fails here rather than surprising
  -- a reviewer later.
  select count(*) into v_drift
    from public.get_proposal_groups('pending') g
    join (select normalized, min(kind) as kind
            from public.teacher_name_proposals
           where status = 'pending' and normalized is not null
           group by normalized) p on p.normalized = g.normalized
   where p.kind is distinct from g.kind;
  if v_drift > 0 then
    v_fail := v_fail || (v_drift || ' groups had their kind changed; this migration must not reclassify')::text;
  end if;

  -- The rule is "EVERY course, not merely one". A group whose courses sit on
  -- more than one distinct channel can never be self-named, so if any such
  -- group is flagged the aggregation is wrong.
  select count(*) into v_drift
    from public.get_proposal_groups('pending') g
   where g.self_named_channel
     and (select count(distinct pl.institute_channel_id)
            from public.playlists pl
           where pl.teacher in (select jsonb_array_elements(g.variants) ->> 'raw_teacher')) > 1;
  if v_drift > 0 then
    v_fail := v_fail || (v_drift || ' groups span several channels yet were flagged self-named')::text;
  end if;

  if array_length(v_fail, 1) > 0 then
    raise exception 'QUEUE SIGNAL SELF-TEST FAILED (rolled back): %', array_to_string(v_fail, ' | ');
  end if;
  raise notice 'QUEUE SIGNAL APPLIED: get_faculty_review_groups now returns self_named_channel over % pending group(s); kind is unchanged.', v_rows;
end
$verify$;
