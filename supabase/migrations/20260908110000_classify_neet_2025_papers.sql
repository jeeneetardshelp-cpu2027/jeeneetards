-- ---------------------------------------------------------------------
-- Four NEET UG 2025 papers never got their metadata, because the seed landed
-- AFTER the backfill that was supposed to give it to them.
--
-- WHAT HAPPENED, from the chain itself:
--   20260902093000_study_material_paper_metadata.sql  09:30  classified every
--       previous_year_paper row then present — 183 of them — and its own
--       self-verification asserted zero unclassified. True when it ran.
--   20260902122500_neet_ug_2025_papers.sql            12:25  inserted four
--       NEET UG 2025 rows. Three hours later, so the backfill could not have
--       seen them, and the seed set exam_year but not paper_year/paper_kind.
--
-- Neither file is wrong on its own. The gap is that "every paper is
-- classified" was established once, as a fact about a moment, and nothing
-- carried it forward — so the README row claiming zero unclassified has been
-- describing 184 of 188 rows since 2 Sep.
--
-- MEASURED ON PRODUCTION, 8 Sep 2026: exactly four rows have a null
-- paper_year or paper_kind, and they are ids 414-417, "NEET UG 2025 - Set 45
-- / 46 / 47 / 48 (English)". The other 184 are complete.
--
-- NOT A STUDENT-VISIBLE BUG TODAY, and worth saying so rather than
-- overselling the fix. /materials/neet/previous-year-papers groups all four
-- under a "2025" heading right now, because the client falls back to reading
-- the year out of the title. This removes the crutch, not a broken page.
--
-- NOTHING IS INVENTED HERE. Both values come from the rows themselves:
--   paper_year  := exam_year, which is already 2025 on all four
--   paper_kind  := 'question_paper', which is what every other NEET row
--                  carries (ids 385-390: 2024 Set T1/R1 and the four 2026
--                  re-examination sets)
-- exam_session and exam_shift stay null, also matching every other NEET row —
-- NEET UG is one sitting, unlike JEE Main's sessions and shifts.
--
-- SCOPE IS FOUR ROWS, ADDRESSED BY ID. No wildcard, no title LIKE: a pattern
-- that matched more than intended would rewrite classified rows, and the
-- postflight below would not notice because they would still be non-null.
-- ---------------------------------------------------------------------

begin;

-- PREFLIGHT. Refuse if the shape is not what was measured, rather than
-- silently doing nothing (or something) against a schema that has moved.
do $preflight$
declare
  v_missing int;
begin
  if to_regclass('public.study_materials') is null then
    raise exception 'study_materials does not exist';
  end if;
  perform 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'study_materials'
      and column_name in ('paper_year', 'paper_kind', 'exam_year');
  if not found then
    raise exception 'paper_year / paper_kind / exam_year are not all present on study_materials';
  end if;

  -- The four rows must still be there, still unclassified, still 2025.
  select count(*) into v_missing
    from public.study_materials
   where id in (414, 415, 416, 417)
     and material_type = 'previous_year_paper'
     and exam_year = 2025
     and (paper_year is null or paper_kind is null);
  if v_missing <> 4 then
    raise exception
      'expected exactly 4 unclassified NEET UG 2025 rows at ids 414-417, found %. Someone may have fixed this already, or the ids have moved — re-measure before running.',
      v_missing;
  end if;
end;
$preflight$;

update public.study_materials
   set paper_year = exam_year,          -- already 2025 on all four
       paper_kind = 'question_paper',   -- as every other NEET UG row
       updated_at = now()
 where id in (414, 415, 416, 417)
   and material_type = 'previous_year_paper'
   and (paper_year is null or paper_kind is null);

-- ---------------------------------------------------------------------
-- POSTFLIGHT. Inside the transaction, so a wrong result rolls the whole thing
-- back. It asserts the GENERAL property, not just the four rows: no
-- previous_year_paper row anywhere is left unclassified. That is the claim the
-- README has been making since 2 Sep, and this is the first time it is checked
-- rather than asserted.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_unclassified int;
  v_fixed        int;
  v_stray        text;
begin
  select count(*) into v_fixed
    from public.study_materials
   where id in (414, 415, 416, 417)
     and paper_year = 2025
     and paper_kind = 'question_paper';
  if v_fixed <> 4 then
    raise exception 'FAILED: expected 4 classified rows at ids 414-417, got %', v_fixed;
  end if;

  select count(*) into v_unclassified
    from public.study_materials
   where material_type = 'previous_year_paper'
     and (paper_year is null or paper_kind is null);
  if v_unclassified <> 0 then
    raise exception 'FAILED: % previous_year_paper rows are still unclassified', v_unclassified;
  end if;

  -- Nothing outside the four was touched: every NEET UG row must still carry a
  -- null session and shift, which is what distinguishes NEET's single sitting
  -- from JEE Main's sessions and shifts. A wildcard update would show up here.
  select string_agg(title, '; ') into v_stray
    from public.study_materials
   where material_type = 'previous_year_paper'
     and title like 'NEET UG%'
     and (exam_session is not null or exam_shift is not null);
  if v_stray is not null then
    raise exception 'FAILED: a NEET UG row gained a session or shift: %', v_stray;
  end if;

  raise notice 'NEET UG 2025 papers classified: 4 rows, 0 previous_year_paper rows left unclassified';
end;
$verify$;

commit;
