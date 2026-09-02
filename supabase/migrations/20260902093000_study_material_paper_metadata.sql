-- ============================================================================
-- STRUCTURED PAPER METADATA -- give previous-year papers real columns instead
-- of a title-regex identity.
--
-- WHAT THIS DOES. The papers pillar (the /materials/<exam>/previous-year-papers
-- landings, their per-year pages, the edge renderer and universal_search's
-- 'paper' group) currently tells a question paper from an answer key from a
-- paper-with-solutions by running regexes over `title`. One reworded title
-- silently reshuffles a landing. This migration adds four nullable columns to
-- public.study_materials:
--
--   paper_kind    text  CHECK in ('question_paper','answer_key','paper_with_solutions')
--   paper_year    int   the exam year named in the title (first 20xx)
--   exam_session  text  'Session N' where the title names one, else NULL
--   exam_shift    text  'Shift N'   where the title names one, else NULL
--
-- and BACKFILLS them for every material_type = 'previous_year_paper' row,
-- deterministically, from the title alone. The title grammar is consistent in
-- production (verified live 2026-09-02: 112 'JEE Main%', 44 'JEE Advanced%',
-- 6 'NEET%', 9 'NSEP%' previous_year_paper rows):
--
--   * a title naming 'with Solutions'  -> paper_with_solutions  (the NSEP set)
--   * else a title naming 'Answer Key' -> answer_key            (JEE Main keys)
--   * else                             -> question_paper
--   * paper_year = the first four-digit 20xx in the title ('NSEP 2017-18' -> 2017)
--
-- THE SAME GRAMMAR, TWICE ON PURPOSE. src/studyMaterialLandings.js
-- (parsePaperTitle) implements this classification in JavaScript for the
-- client, and src/paperMetadataSqlRehearsal.test.js executes THIS file on a
-- real Postgres (PGlite) and asserts the two agree title by title. If you
-- change a rule here, change parsePaperTitle too, or that test fails.
--
-- THE CLIENT DOES NOT SELECT THESE COLUMNS YET. Until this migration is
-- applied to production, selecting paper_kind through PostgREST would error
-- every papers page. The client keeps its title parsing this release; the
-- follow-up flip is marked in src/useJeeMainPapers.js next to its SELECT list.
--
-- STAGED, NOT APPLIED. This file waits on the owner's migration gate
-- (supabase/README.md): apply it with `npx supabase db push`, never by pasting
-- into the SQL Editor. `db push` runs EVERY pending migration in timestamp
-- order, so check `npx supabase migration list` first. Everything here is
-- additive and idempotent (add column if not exists; the backfill recomputes
-- the same deterministic values), and no RLS policy, grant or function
-- changes: the new columns are readable exactly where the row already was.
--
-- ROLLBACK.
--   alter table public.study_materials
--     drop constraint if exists study_materials_paper_kind_check,
--     drop constraint if exists study_materials_paper_year_check,
--     drop constraint if exists study_materials_exam_session_check,
--     drop constraint if exists study_materials_exam_shift_check,
--     drop constraint if exists study_materials_paper_metadata_scope;
--   alter table public.study_materials
--     drop column if exists paper_kind,
--     drop column if exists paper_year,
--     drop column if exists exam_session,
--     drop column if exists exam_shift;
-- Nothing selects these columns until the client flip ships, so dropping them
-- restores exactly today's behaviour.
-- ============================================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- ---------------------------------------------------------------------
-- PREFLIGHT. Abort before touching anything if the world this migration
-- assumes is not there.
-- ---------------------------------------------------------------------
do $preflight$
begin
  if to_regclass('public.study_materials') is null then
    raise exception 'study_materials is missing -- apply the baseline first';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'study_materials'
       and column_name = 'title'
  ) then
    raise exception 'study_materials has no title column -- the backfill has nothing to read';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------
-- COLUMNS. Nullable on purpose: notes and formula sheets are not papers,
-- and their rows keep NULL in all four.
-- ---------------------------------------------------------------------
alter table public.study_materials
  add column if not exists paper_kind   text,
  add column if not exists paper_year   integer,
  add column if not exists exam_session text,
  add column if not exists exam_shift   text;

-- ---------------------------------------------------------------------
-- BACKFILL, from the title alone. Deterministic and idempotent: re-running
-- recomputes the same values. Order of the CASE arms matters and mirrors
-- parsePaperTitle in src/studyMaterialLandings.js exactly:
-- 'with solutions' wins over 'answer key' wins over the question-paper
-- default -- the same precedence splitJeeMainPapers has always used.
-- ---------------------------------------------------------------------
update public.study_materials
   set paper_kind = case
         when title ~* 'with[[:space:]]+solutions?' then 'paper_with_solutions'
         when title ~* 'answer[[:space:]]+keys?'    then 'answer_key'
         else 'question_paper'
       end,
       paper_year   = (regexp_match(title, '\m(20[0-9]{2})\M'))[1]::integer,
       exam_session = 'Session ' || (regexp_match(title, 'session[[:space:]]*([0-9]+)', 'i'))[1],
       exam_shift   = 'Shift '   || (regexp_match(title, 'shift[[:space:]]*([0-9]+)',   'i'))[1]
 where material_type = 'previous_year_paper';

-- ---------------------------------------------------------------------
-- CONSTRAINTS, added after the backfill so they validate it in one pass.
-- ---------------------------------------------------------------------
alter table public.study_materials
  drop constraint if exists study_materials_paper_kind_check,
  drop constraint if exists study_materials_paper_year_check,
  drop constraint if exists study_materials_exam_session_check,
  drop constraint if exists study_materials_exam_shift_check,
  drop constraint if exists study_materials_paper_metadata_scope;

alter table public.study_materials
  add constraint study_materials_paper_kind_check check (
    paper_kind is null
    or paper_kind in ('question_paper', 'answer_key', 'paper_with_solutions')
  ),
  add constraint study_materials_paper_year_check check (
    paper_year is null or (paper_year >= 2000 and paper_year <= 2100)
  ),
  add constraint study_materials_exam_session_check check (
    exam_session is null or exam_session ~ '^Session [0-9]+$'
  ),
  add constraint study_materials_exam_shift_check check (
    exam_shift is null or exam_shift ~ '^Shift [0-9]+$'
  ),
  -- Paper metadata belongs to papers. A notes row that grows a paper_kind is
  -- a data-entry mistake this table should refuse, not display.
  add constraint study_materials_paper_metadata_scope check (
    material_type = 'previous_year_paper'
    or (paper_kind is null and paper_year is null
        and exam_session is null and exam_shift is null)
  );

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION. Abort the whole migration -- the transaction rolls
-- back, columns included -- if any paper row came out unclassified or
-- classified against its own title.
-- ---------------------------------------------------------------------
do $selftest$
declare
  n_unclassified int;
  n_question     int;
  n_key          int;
  n_solutions    int;
  n_total        int;
  n_jee_main     int;
  n_jee_advanced int;
  n_neet         int;
  n_nsep         int;
begin
  -- Every previous-year paper must have a kind and a year. A title with no
  -- 20xx year in it would leave paper_year NULL: that is a grammar break the
  -- owner must see BEFORE this applies, not a row that silently vanishes
  -- from every year page.
  select count(*) into n_unclassified
    from public.study_materials
   where material_type = 'previous_year_paper'
     and (paper_kind is null or paper_year is null);
  if n_unclassified > 0 then
    raise exception
      '% previous_year_paper row(s) have no paper_kind or paper_year after the backfill -- a title has left the known grammar; fix the title or the grammar before applying',
      n_unclassified;
  end if;

  -- The kind must agree with the title it was derived from.
  if exists (
    select 1 from public.study_materials
     where material_type = 'previous_year_paper'
       and paper_kind = 'answer_key'
       and title !~* 'answer[[:space:]]+keys?'
  ) then
    raise exception 'a row is marked answer_key but its title never says Answer Key';
  end if;
  if exists (
    select 1 from public.study_materials
     where material_type = 'previous_year_paper'
       and paper_kind = 'paper_with_solutions'
       and title !~* 'with[[:space:]]+solutions?'
  ) then
    raise exception 'a row is marked paper_with_solutions but its title never says with Solutions';
  end if;
  if exists (
    select 1 from public.study_materials
     where material_type = 'previous_year_paper'
       and paper_kind = 'question_paper'
       and (title ~* 'with[[:space:]]+solutions?' or title ~* 'answer[[:space:]]+keys?')
  ) then
    raise exception 'a row is marked question_paper although its title claims a key or solutions';
  end if;

  -- Non-paper rows must be untouched.
  if exists (
    select 1 from public.study_materials
     where material_type <> 'previous_year_paper'
       and (paper_kind is not null or paper_year is not null
            or exam_session is not null or exam_shift is not null)
  ) then
    raise exception 'a non-paper row acquired paper metadata -- the backfill filter is wrong';
  end if;

  -- The per-kind and per-exam counts, printed so `db push` output shows what
  -- the backfill actually decided. Against production on 2026-09-02 the
  -- prefix counts should read 112 JEE Main / 44 JEE Advanced / 6 NEET /
  -- 9 NSEP, with all 9 NSEP rows as paper_with_solutions. Printed, not
  -- asserted: this migration must also apply cleanly to staging copies and
  -- rehearsal databases with different data.
  select count(*) filter (where paper_kind = 'question_paper'),
         count(*) filter (where paper_kind = 'answer_key'),
         count(*) filter (where paper_kind = 'paper_with_solutions'),
         count(*),
         count(*) filter (where title like 'JEE Main%'),
         count(*) filter (where title like 'JEE Advanced%'),
         count(*) filter (where title like 'NEET%'),
         count(*) filter (where title like 'NSEP%')
    into n_question, n_key, n_solutions, n_total,
         n_jee_main, n_jee_advanced, n_neet, n_nsep
    from public.study_materials
   where material_type = 'previous_year_paper';

  raise notice 'paper kinds: % question_paper, % answer_key, % paper_with_solutions (% previous-year papers in all)',
    n_question, n_key, n_solutions, n_total;
  raise notice 'by title prefix: % JEE Main, % JEE Advanced, % NEET, % NSEP',
    n_jee_main, n_jee_advanced, n_neet, n_nsep;

  raise notice 'SELF-TEST PASSED: every previous-year paper has a paper_kind and paper_year, every kind agrees with its title, and non-paper rows carry no paper metadata.';
end
$selftest$;

commit;
