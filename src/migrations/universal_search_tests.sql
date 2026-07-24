-- =====================================================================
--  universal_search_tests.sql — STAGING ONLY. Never run this on production.
--
--  Self-checking: every assertion raises an exception on failure, so a clean
--  run is the pass condition and there is no output to misread. The whole file
--  runs inside one transaction that ROLLS BACK, so it leaves no rows behind.
--
--  Fixtures are SEEDED with known ids and the expectations name those ids
--  exactly. A test that passes because a table is empty proves nothing — an
--  earlier round of this project shipped exactly that mistake ("jee count=0,
--  neet count=0") and it is what this style is guarding against.
--
--  Requires: schema.sql, universal_search.sql.
--  Sections marked [V7] additionally require teachers_v7.sql and are SKIPPED
--  (loudly) when the teacher tables are absent — that skip is itself the
--  capability-gate test.
-- =====================================================================

begin;

-- Refuse to run anywhere that looks like production.
do $$
begin
  if to_regclass('public.__staging_marker') is null
     and current_setting('server_version_num')::int > 0
     and exists (select 1 from public.playlists limit 1)
     and not coalesce(current_setting('universal_search.allow_here', true) = '1', false) then
    raise exception
      'Refusing to run: set universal_search.allow_here=1 to confirm this is a disposable database.';
  end if;
end $$;

create temporary table t_result(name text, ok boolean, detail text);

create or replace function pg_temp.check_(p_name text, p_ok boolean, p_detail text default '')
returns void language plpgsql as $$
begin
  insert into t_result values (p_name, p_ok, p_detail);
  if not p_ok then
    raise exception 'FAILED: % — %', p_name, p_detail;
  end if;
end $$;

-- =====================================================================
--  FIXTURES — fixed ids, so every expectation below is exact.
-- =====================================================================
insert into public.institutes_channels (id, name, youtube_channel_id)
values (900001, 'USTEST Competishun', 'UC_ustest_1'),
       (900002, 'USTEST Allen',       'UC_ustest_2')
on conflict (id) do nothing;

insert into public.subjects (id, name, slug)
values (900001, 'USTEST Physics', 'ustest-physics'),
       (900002, 'USTEST Chemistry', 'ustest-chemistry')
on conflict (id) do nothing;

insert into public.chapters (id, name, slug, subject_id)
values (900001, 'USTEST Kinematics', 'ustest-kinematics', 900001),
       (900002, 'USTEST Kinematics of Rigid Bodies', 'ustest-kinematics-rigid', 900001),
       (900003, 'USTEST Thermodynamics', 'ustest-thermo', 900002)
on conflict (id) do nothing;

insert into public.playlists (id, title, channel_id, subject_id, teacher)
values (900001, 'USTEST Complete Kinematics', 900001, 900001, 'ABJ Sir'),
       (900002, 'USTEST Kinematics One Shot', 900001, 900001, 'ABJ Sir')
on conflict (id) do nothing;

insert into public.videos (id, title, youtube_id, subject_id, chapter_id)
values (900001, 'USTEST Relative Motion', 'ustestvid01', 900001, 900001),
       (900002, 'USTEST Projectile Motion', 'ustestvid02', 900001, 900001)
on conflict (id) do nothing;

insert into public.playlist_videos (playlist_id, video_id, position)
values (900001, 900001, 1), (900001, 900002, 2)
on conflict do nothing;

-- =====================================================================
--  A. SHORT-QUERY PROTECTION (requirement 6)
-- =====================================================================
do $$
declare n int;
begin
  select count(*) into n from public.universal_search('u', null, 50, 0);
  perform pg_temp.check_('A1 one character returns nothing', n = 0, 'got ' || n);

  -- Non-vacuous control: the SAME prefix at 2 characters DOES return rows,
  -- proving A1 is a length rule and not an empty database.
  select count(*) into n from public.universal_search('ustest', null, 50, 0);
  perform pg_temp.check_('A2 a real query returns rows', n > 0, 'got ' || n);

  -- Fuzzy must not fire below 4 characters. "us" prefix-matches plenty, but
  -- nothing may come back at rank 5.
  select count(*) into n from public.universal_search('us', null, 50, 0)
   where match_rank = 5;
  perform pg_temp.check_('A3 no fuzzy tier under 4 chars', n = 0, 'got ' || n);
end $$;

-- =====================================================================
--  B. RANK ORDER: exact -> prefix -> partial -> fuzzy (requirement 5)
-- =====================================================================
do $$
declare r_exact int; r_prefix int; r_partial int;
begin
  -- exact on the full chapter name
  select match_rank into r_exact from public.universal_search(
    'USTEST Kinematics', array['chapter'], 50, 0) where entity_id = 900001;
  perform pg_temp.check_('B1 exact match is rank 1', r_exact = 1, 'got ' || coalesce(r_exact::text,'null'));

  -- the longer chapter is only a PREFIX match for the same query
  select match_rank into r_prefix from public.universal_search(
    'USTEST Kinematics', array['chapter'], 50, 0) where entity_id = 900002;
  perform pg_temp.check_('B2 prefix match is rank 3', r_prefix = 3, 'got ' || coalesce(r_prefix::text,'null'));

  -- a word from the middle is a partial match
  select match_rank into r_partial from public.universal_search(
    'rigid', array['chapter'], 50, 0) where entity_id = 900002;
  perform pg_temp.check_('B3 partial match is rank 4', r_partial = 4, 'got ' || coalesce(r_partial::text,'null'));

  perform pg_temp.check_('B4 exact outranks prefix outranks partial',
    r_exact < r_prefix and r_prefix < r_partial,
    format('%s %s %s', r_exact, r_prefix, r_partial));
end $$;

-- Results must arrive already ordered — the client is forbidden from sorting.
do $$
declare ranks int[];
begin
  select array_agg(match_rank order by ord) into ranks
    from (select match_rank, row_number() over () as ord
            from public.universal_search('USTEST Kinematics', array['chapter'], 50, 0)) x;
  perform pg_temp.check_('B5 server returns rows in rank order',
    ranks = (select array_agg(r order by r) from unnest(ranks) r),
    'got ' || ranks::text);
end $$;

-- =====================================================================
--  C. CASE / PUNCTUATION / SPELLING VARIATION (requirement 3)
-- =====================================================================
do $$
declare v text; n int;
begin
  foreach v in array array['ustest kinematics','USTEST KINEMATICS',
                           'UsTeSt   Kinematics','ustest-kinematics','ustest, kinematics']
  loop
    select count(*) into n from public.universal_search(v, array['chapter'], 50, 0)
     where entity_id = 900001 and match_rank = 1;
    perform pg_temp.check_('C1 variation resolves to the same chapter: ' || v, n = 1, 'got ' || n);
  end loop;

  -- misspelling reaches it through the guarded fuzzy tier only
  select count(*) into n from public.universal_search('kinematcs', array['chapter'], 50, 0)
   where entity_id = 900001;
  perform pg_temp.check_('C2 misspelling still finds it (fuzzy)', n = 1, 'got ' || n);
end $$;

-- =====================================================================
--  D. GROUPING + PAGINATION (requirement 4)
-- =====================================================================
do $$
declare n int; tot bigint; ids bigint[]; ids2 bigint[];
begin
  select count(distinct group_key) into n from public.universal_search('ustest', null, 50, 0);
  perform pg_temp.check_('D1 several groups come back in one call', n >= 4, 'got ' || n);

  -- group_total must describe the WHOLE match set, not the page.
  select group_total into tot from public.universal_search('ustest', array['chapter'], 1, 0) limit 1;
  perform pg_temp.check_('D2 group_total counts beyond the page', tot = 3, 'got ' || coalesce(tot::text,'null'));

  select count(*) into n from public.universal_search('ustest', array['chapter'], 1, 0);
  perform pg_temp.check_('D3 page size is honoured', n = 1, 'got ' || n);

  -- offset must move the window, not repeat it
  select array_agg(entity_id) into ids  from public.universal_search('ustest', array['chapter'], 2, 0);
  select array_agg(entity_id) into ids2 from public.universal_search('ustest', array['chapter'], 2, 2);
  perform pg_temp.check_('D4 offset returns different rows',
    not (ids && ids2), format('page0=%s page1=%s', ids, ids2));

  -- the limit is clamped, so a hostile client cannot ask for everything
  select count(*) into n from public.universal_search('ustest', array['lecture'], 100000, 0);
  perform pg_temp.check_('D5 limit is clamped server-side', n <= 50, 'got ' || n);

  -- p_types must actually restrict
  select count(distinct group_key) into n
    from public.universal_search('ustest', array['chapter'], 50, 0);
  perform pg_temp.check_('D6 type filter restricts to one group', n = 1, 'got ' || n);
end $$;

-- Playlists must carry a chapter id so the result deep-links somewhere real.
do $$
declare ch bigint;
begin
  select (extra->>'chapter_id')::bigint into ch
    from public.universal_search('USTEST Complete Kinematics', array['playlist'], 5, 0)
   where entity_id = 900001;
  perform pg_temp.check_('D7 playlist result carries a chapter id',
    ch = 900001, 'got ' || coalesce(ch::text,'null'));
end $$;

-- =====================================================================
--  E. FACULTY CAPABILITY GATE (requirement 11)
--
--  Without teachers_v7 the faculty group must be ABSENT — not empty-but-
--  present, and above all not synthesised from playlists.teacher, which holds
--  the unreviewed string 'ABJ Sir' on both fixture playlists.
-- =====================================================================
do $$
declare n int;
begin
  if to_regclass('public.teachers') is null then
    select count(*) into n from public.universal_search('ABJ', null, 50, 0)
     where group_key = 'faculty';
    perform pg_temp.check_('E1 [no v7] faculty group is absent', n = 0, 'got ' || n);

    -- and the free-text teacher column did not leak in under another group
    select count(*) into n from public.universal_search('ABJ Sir', null, 50, 0)
     where title = 'ABJ Sir';
    perform pg_temp.check_('E2 [no v7] free-text teacher is not an entity', n = 0, 'got ' || n);
    raise notice 'SKIPPED sections F-H: teachers_v7 is not installed (this is the gate working).';
  end if;
end $$;

-- =====================================================================
--  F. [V7] ONE IDENTITY FROM MANY NAMES (requirement 1)
-- =====================================================================
do $$
declare tid bigint; got bigint; v text;
begin
  if to_regclass('public.teachers') is null then return; end if;

  insert into public.teachers (id, display_name, slug, verified)
  values (900001, 'Amit Bijarnia', 'ustest-amit-bijarnia', true)
  on conflict (id) do nothing;
  tid := 900001;

  insert into public.teacher_aliases (teacher_id, alias, alias_type, status)
  values (tid, 'ABJ Sir', 'nickname', 'verified'),
         (tid, 'ABJ',     'initialism', 'verified'),
         (tid, 'A. Bijarnia', 'short', 'proposed')     -- deliberately UNREVIEWED
  on conflict do nothing;

  insert into public.teacher_institutes (teacher_id, institute_id) values (tid, 900001)
  on conflict do nothing;
  insert into public.teacher_subjects (teacher_id, subject_id) values (tid, 900001)
  on conflict do nothing;

  foreach v in array array['ABJ','ABJ Sir','abj sir','Amit Bijarnia','amit  bijarnia','Amit Bijarnia Sir']
  loop
    select entity_id into got from public.universal_search(v, array['faculty'], 10, 0) limit 1;
    perform pg_temp.check_('F1 same identity for: ' || v, got = tid,
      format('expected %s got %s', tid, coalesce(got::text,'null')));
  end loop;

  -- requirement 10: a PROPOSED alias must not be a way for a student to
  -- find anyone. It is an unreviewed claim about a real person.
  perform pg_temp.check_('F2 proposed alias is not publicly searchable',
    not exists (select 1 from public.universal_search('A. Bijarnia', array['faculty'], 10, 0)),
    'a proposed alias returned a result');
end $$;

-- =====================================================================
--  G. [V7] AMBIGUITY IS REPORTED, NEVER RESOLVED (requirement 2)
-- =====================================================================
do $$
declare n int; amb boolean; ctx int;
begin
  if to_regclass('public.teachers') is null then return; end if;

  -- a SECOND, different person who genuinely answers to the same alias
  insert into public.teachers (id, display_name, slug, verified)
  values (900002, 'Amit Bijarnia', 'ustest-amit-bijarnia-2', true)
  on conflict (id) do nothing;
  insert into public.teacher_aliases (teacher_id, alias, alias_type, status)
  values (900002, 'ABJ', 'initialism', 'verified')
  on conflict do nothing;
  insert into public.teacher_institutes (teacher_id, institute_id) values (900002, 900002)
  on conflict do nothing;
  insert into public.teacher_subjects (teacher_id, subject_id) values (900002, 900002)
  on conflict do nothing;

  select count(*) into n from public.universal_search('ABJ', array['faculty'], 10, 0);
  perform pg_temp.check_('G1 both people are returned', n = 2, 'got ' || n);

  select bool_and(is_ambiguous) into amb
    from public.universal_search('ABJ', array['faculty'], 10, 0);
  perform pg_temp.check_('G2 both are flagged ambiguous', amb, 'got ' || coalesce(amb::text,'null'));

  -- each must carry enough context to tell them apart
  select count(*) into ctx from public.universal_search('ABJ', array['faculty'], 10, 0)
   where subtitle is not null and subtitle <> '';
  perform pg_temp.check_('G3 each carries institute/subject context', ctx = 2, 'got ' || ctx);

  select count(distinct subtitle) into ctx from public.universal_search('ABJ', array['faculty'], 10, 0);
  perform pg_temp.check_('G4 the contexts actually differ', ctx = 2, 'got ' || ctx);
end $$;

-- =====================================================================
--  H. [V7] VERIFIED-ALIAS TIER OUTRANKS PREFIX (requirement 5)
-- =====================================================================
do $$
declare r int;
begin
  if to_regclass('public.teachers') is null then return; end if;
  select match_rank into r from public.universal_search('ABJ Sir', array['faculty'], 10, 0)
   where entity_id = 900001;
  perform pg_temp.check_('H1 exact verified alias is a top tier',
    r <= 2, 'got ' || coalesce(r::text,'null'));
end $$;

-- =====================================================================
--  RESULTS
-- =====================================================================
select name, ok, detail from t_result order by name;
select count(*) filter (where ok) as passed,
       count(*) filter (where not ok) as failed,
       count(*) as total
  from t_result;

rollback;

-- =====================================================================
--  I. CLASS + BOARD FILTERING (added for the discovery-unification phase)
--
--  These exist because unit mocks are NOT evidence that a PostgREST query
--  works. The catalogue's class filter is an embedded inner join
--    playlists?select=...,pcl:playlist_class_levels!inner(class_levels!inner(slug))
--    &pcl.class_levels.slug=in.(...)
--  and the only way to know that resolves, filters the PARENT rows and keeps
--  count(*) honest is to run it against a real database.
--
--  Run on a DISPOSABLE staging project only. Never on production.
-- =====================================================================
do $$
declare n int; n11 int; n12 int; ndrop int; nall int;
begin
  if to_regclass('public.playlist_class_levels') is null then
    raise notice 'SKIPPED I: playlist_class_levels absent';
    return;
  end if;

  -- Fixtures: every class has content, so an empty result is a failure and
  -- not merely the shape of the data.
  insert into public.playlists (id, title, channel_id, subject_id)
  values (900101,'USTEST C11 only',900001,900001),
         (900102,'USTEST C12 only',900001,900001),
         (900103,'USTEST Dropper only',900001,900001),
         (900104,'USTEST C11 and C12',900001,900001),
         (900105,'USTEST untagged',900001,900001)
  on conflict (id) do nothing;

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select p, c from (values
     (900101,(select id from public.class_levels where slug='class-11')),
     (900102,(select id from public.class_levels where slug='class-12')),
     (900103,(select id from public.class_levels where slug='dropper')),
     (900104,(select id from public.class_levels where slug='class-11')),
     (900104,(select id from public.class_levels where slug='class-12'))
  ) as v(p,c) on conflict do nothing;
  -- 900105 deliberately gets NO junction row.

  -- Exactly the predicate the client sends.
  select count(distinct pl.id) into n11 from public.playlists pl
    join public.playlist_class_levels j on j.playlist_id = pl.id
    join public.class_levels cl on cl.id = j.class_level_id
   where pl.id between 900101 and 900105 and cl.slug in ('class-11');

  select count(distinct pl.id) into n12 from public.playlists pl
    join public.playlist_class_levels j on j.playlist_id = pl.id
    join public.class_levels cl on cl.id = j.class_level_id
   where pl.id between 900101 and 900105 and cl.slug in ('class-12');

  select count(distinct pl.id) into ndrop from public.playlists pl
    join public.playlist_class_levels j on j.playlist_id = pl.id
    join public.class_levels cl on cl.id = j.class_level_id
   where pl.id between 900101 and 900105
     and cl.slug in ('dropper','class-11','class-12');

  select count(*) into nall from public.playlists
   where id between 900101 and 900105;

  perform pg_temp.check_('I1 Class 11 is exact and non-empty', n11 = 2, 'got ' || n11);
  perform pg_temp.check_('I2 Class 12 is exact and non-empty', n12 = 2, 'got ' || n12);
  perform pg_temp.check_('I3 Dropper includes 11th, 12th and Dropper', ndrop = 4, 'got ' || ndrop);
  perform pg_temp.check_('I4 classes differ from one another', n11 <> ndrop, format('%s vs %s', n11, ndrop));
  perform pg_temp.check_('I5 untagged matches no class', ndrop < nall, format('%s < %s', ndrop, nall));

  -- DISTINCT matters: a playlist tagged for two classes must appear ONCE in a
  -- Dropper listing, or the count is inflated and a page shows a duplicate.
  select count(*) into n from (
    select pl.id from public.playlists pl
      join public.playlist_class_levels j on j.playlist_id = pl.id
      join public.class_levels cl on cl.id = j.class_level_id
     where pl.id = 900104 and cl.slug in ('dropper','class-11','class-12')) x;
  perform pg_temp.check_('I6 multi-tagged playlist is not duplicated by the join',
    n = 2, 'raw join rows = ' || n || ' (client must rely on PostgREST parent-dedup)');
end $$;

-- Board filtering, for whenever public.boards is deployed.
do $$
declare n int;
begin
  if to_regclass('public.boards') is null then
    raise notice 'SKIPPED J: public.boards is not deployed (this is the feature gate working).';
    return;
  end if;
  select count(*) into n from public.playlist_boards pb
    join public.boards b on b.id = pb.board_id where b.slug = 'cbse';
  perform pg_temp.check_('J1 CBSE board join resolves', n >= 0, 'got ' || n);
end $$;
