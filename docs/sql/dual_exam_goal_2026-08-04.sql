-- Tag the lessons whose own titles name BOTH exams with both goals.
--
-- Companion to esaral_neet_goal_2026-08-04.sql, from the same sweep. A handful
-- of Physics and Chemistry lessons are published under titles that explicitly
-- claim both exams -- "Haloalkanes, Haloarenes Part 1 | 2025 | JEE, NEET",
-- "Mechanical Energy Conservation in 1 Shot | NEET & JEE Mains" -- but carry
-- only one goal here. Browse is goal-scoped, so each is invisible to half the
-- students it was made for.
--
-- THE EVIDENCE IS THE CONDITION: a row qualifies only if its own source_title
-- names JEE *and* NEET. That is the publisher's claim, not my inference, and it
-- is checked per row rather than assumed for a batch. This is why an earlier
-- proposal to bulk-tag NEET-only Aakash/ALLEN Chemistry as JEE was declined --
-- those titles claim one exam, and asserting they cover the other would be my
-- guess about syllabus depth.
--
-- It also excludes a false positive the naive "title mentions JEE" query
-- returned: "IOQM 2025 Question Paper Solution by ALLEN JEE" matches only
-- because the CHANNEL NAME is in the title. It names no second exam, is
-- olympiad content, and is correctly tagged already.
--
-- Effect: closes Organic Compounds Containing Halogens for JEE, which until now
-- had only eSaral. The other rows add reach without closing a chapter.
--
-- Additive only, and restricted to Physics and Chemistry -- the two subjects
-- both exams actually share. Mathematics is not a NEET subject and Biology is
-- not a JEE one, so a cross-exam mention there is marketing, not a claim.
--
-- Safe to re-run: idempotent inserts, and the assertions still hold.
do $$
declare
  v_jee bigint;
  v_neet bigint;
  v_dual integer;
  v_added_jee integer;
  v_added_neet integer;
begin
  select id into strict v_jee from public.learning_goals where slug = 'jee';
  select id into strict v_neet from public.learning_goals where slug = 'neet';

  select count(*) into v_dual
  from public.videos v
  where v.subject_id in (1, 2)
    and v.source_title ilike '%jee%'
    and v.source_title ilike '%neet%';

  if v_dual = 0 then
    raise exception 'no lesson names both exams - refusing to guess';
  end if;

  insert into public.video_learning_goals (video_id, learning_goal_id)
  select v.id, v_jee
  from public.videos v
  where v.subject_id in (1, 2)
    and v.source_title ilike '%jee%'
    and v.source_title ilike '%neet%'
  on conflict do nothing;
  get diagnostics v_added_jee = row_count;

  insert into public.video_learning_goals (video_id, learning_goal_id)
  select v.id, v_neet
  from public.videos v
  where v.subject_id in (1, 2)
    and v.source_title ilike '%jee%'
    and v.source_title ilike '%neet%'
  on conflict do nothing;
  get diagnostics v_added_neet = row_count;

  -- Every dual-exam lesson must now carry both goals.
  if exists (
    select 1 from public.videos v
    where v.subject_id in (1, 2)
      and v.source_title ilike '%jee%'
      and v.source_title ilike '%neet%'
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = v.id and g.learning_goal_id = v_jee)
        or not exists (select 1 from public.video_learning_goals g where g.video_id = v.id and g.learning_goal_id = v_neet))
  ) then
    raise exception 'a dual-exam lesson is still missing one of its two goals';
  end if;

  -- Nothing may have gained a goal without its own title naming that exam. This
  -- is what keeps the IOQM lesson, whose title only carries the channel name
  -- "ALLEN JEE", out of the JEE goal.
  if exists (
    select 1 from public.videos v
    join public.video_learning_goals g on g.video_id = v.id
    where g.learning_goal_id = v_neet
      and v.subject_id = 3
  ) then
    raise exception 'a Mathematics lesson carries the NEET goal - Mathematics is not a NEET subject';
  end if;

  raise notice 'dual-exam lessons: %, JEE rows added %, NEET rows added %', v_dual, v_added_jee, v_added_neet;
end $$;
