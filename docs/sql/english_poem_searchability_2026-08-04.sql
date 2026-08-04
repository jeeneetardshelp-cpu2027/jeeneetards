-- english_poem_searchability_2026-08-04.sql
--
-- Fixes a regression introduced by english_lesson_clarity_2026-08-04.sql, which
-- I wrote and which is already applied.
--
-- That file renamed three lessons to say they are the single-sitting cut. One of
-- the new titles dropped the poem names to stay under the 90-character limit:
--
--   before  "Two Stories about Flying with How to Tell Wild Animals and The Ball Poem"
--   after   "Two Stories about Flying and Its Poems — Complete Chapter in One Video"
--
-- src/useScopedSearch.js matches on videos.title only. So "How to Tell Wild
-- Animals" and "The Ball Poem" -- two poems on the Class 10 syllabus -- stopped
-- being findable by name anywhere in the catalogue. Verified after the fact by
-- searching all eleven First Flight poems: nine returned a lesson, those two
-- returned nothing. That is the same defect the "Animals" import in the very
-- same file was written to close, reintroduced two lines away from it.
--
-- The fix is a shorter suffix, "— All in One Video" instead of "— Complete
-- Chapter in One Video", which buys back the characters needed to name every
-- poem. Applied to all three so they still read as a set.
--
-- The assertion at the bottom is the one that matters: every First Flight poem
-- must be named by at least one lesson title. That is the actual property --
-- checking the three strings would have passed happily while the poems stayed
-- invisible, which is exactly how this got through the first time.
--
-- Titles only. No lesson, duration, chapter or position changes.
-- Idempotent and self-verifying.

begin;

do $poems$
declare
  v_channel_id bigint;
  r record;
  v_n int := 0;
begin
  select id into strict v_channel_id from public.institutes_channels
   where youtube_channel_id = 'UC3HS6gQ79jjn4xHxogw0HiA';

  for r in
    select * from (values
      ('VfRZ2gUKmIY', 'A Letter to God, Dust of Snow and Fire and Ice — All in One Video'),
      ('EATUz5joXB0', 'Two Stories about Flying, How to Tell Wild Animals and The Ball Poem — All in One Video'),
      ('PF_eFZcfC_4', 'From the Diary of Anne Frank with Amanda — All in One Video')
    ) as t(yt_id, title)
  loop
    if length(r.title) > 90 then
      raise exception 'title for % is % characters, over the 90 src/titleQuality.js allows', r.yt_id, length(r.title);
    end if;
    update public.videos set title = r.title
     where youtube_video_id = r.yt_id and channel_id = v_channel_id;
    if not found then
      raise exception 'lesson % not found on the Magnet Brains channel', r.yt_id;
    end if;
    v_n := v_n + 1;
  end loop;
  raise notice 'retitled % lesson(s)', v_n;
end
$poems$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_poem text;
  v_hits int;
  v_unfindable text[] := '{}';
  v_labelled int;
  v_long int;
begin
  -- THE REAL INVARIANT: every poem CBSE prescribes in First Flight must be named
  -- by at least one English lesson title, because title is all that search sees.
  --
  -- This list is the ten poems in the "Prescribed Books" section of
  -- https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/English_LL_SecP1_2026-27.pdf
  -- (Curriculum for the Academic Year 2026-27), read directly.
  --
  -- It used to carry an eleventh entry, 'Animals'. That was wrong: the poem was
  -- rationalised out and appears nowhere in the prescribed list -- the only
  -- "Animals" in that document is inside "How to Tell Wild Animals". The lesson
  -- for it is removed by english_remove_offsyllabus_chapters_2026-08-04.sql, and
  -- leaving 'Animals' here would have made this assertion fail the moment that
  -- revert ran.
  foreach v_poem in array array[
    'Dust of Snow', 'Fire and Ice', 'A Tiger in the Zoo', 'How to Tell Wild Animals',
    'The Ball Poem', 'Amanda', 'The Trees', 'Fog',
    'The Tale of Custard the Dragon', 'For Anne Gregory'
  ]
  loop
    select count(*) into v_hits
      from public.videos
     where subject_id = 11 and title ilike '%' || v_poem || '%';
    if v_hits = 0 then
      v_unfindable := v_unfindable || v_poem;
    end if;
  end loop;

  if array_length(v_unfindable, 1) > 0 then
    raise exception 'no lesson title names these poem(s), so search cannot return them: %',
      array_to_string(v_unfindable, ', ');
  end if;

  -- The three single-sitting cuts still say so, and nothing else claims to.
  select count(*) into v_labelled from public.videos
   where youtube_video_id in ('VfRZ2gUKmIY', 'EATUz5joXB0', 'PF_eFZcfC_4')
     and title like '%— All in One Video';
  if v_labelled <> 3 then
    raise exception 'expected 3 lessons labelled as the all-in-one cut, found %', v_labelled;
  end if;

  select count(*) into v_long from public.videos
   where subject_id = 11 and length(title) > 90;
  if v_long <> 0 then
    raise exception '% English title(s) exceed 90 characters', v_long;
  end if;

  -- The stale wording must be gone.
  if exists (select 1 from public.videos where title like '%Complete Chapter in One Video')
     or exists (select 1 from public.videos where title like '%and Its Poems%') then
    raise exception 'an old single-sitting title survived the rename';
  end if;

  raise notice 'SELF-TEST PASSED: all 10 prescribed First Flight poems are named by some lesson title; 3 all-in-one cuts labelled; no title over 90 characters.';
end
$verify$;

commit;
