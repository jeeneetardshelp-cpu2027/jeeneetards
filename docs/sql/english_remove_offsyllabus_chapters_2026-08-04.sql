-- english_remove_offsyllabus_chapters_2026-08-04.sql
--
-- REVERTS PART OF MY OWN WORK FROM EARLIER TODAY.
--
-- english_magnet_brains_2026-08-04.sql created five chapters on the reasoning
-- that the catalogue was "missing" them, inferred from a publisher's playlist
-- rather than from a syllabus. Three of the five are NOT on the CBSE Class 10
-- syllabus and should never have been created:
--
--     The Hundred Dresses I     (2 lessons)
--     The Hundred Dresses II    (2 lessons, plus the "Animals" poem lesson
--                                added later by english_lesson_clarity)
--     The Hack Driver           (1 lesson)
--
-- The other two -- The Making of a Scientist and The Book That Saved the Earth --
-- ARE prescribed, so those stay. The completeness fix was half right.
--
-- THE PRIMARY SOURCE, read directly rather than taken from a summary:
--   https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/English_LL_SecP1_2026-27.pdf
--   linked from https://cbseacademic.nic.in/curriculum_2027.html, whose own
--   header reads "Curriculum for the Academic Year 2026-27".
--
-- Its "Prescribed Books: Published by NCERT, New Delhi" section lists, verbatim:
--
--   1. FIRST FLIGHT
--      A. Prose: 1. A Letter to God  2. Nelson Mandela - Long Walk to Freedom
--         3. Stories About Flying  4. From the Diary of Anne Frank
--         5. Glimpses of India  6. Mijbil the Otter  7. Madam Rides the Bus
--         8. The Sermon at Benares  9. The Proposal (Play)
--      B. Poems: 1. Dust of Snow  2. Fire and Ice  3. A Tiger in the Zoo
--         4. How to Tell Wild Animals  5. The Ball Poem  6. Amanda!
--         7. The Trees  8. Fog  9. The Tale of Custard the Dragon
--         10. For Anne Gregory
--   2. FOOTPRINTS WITHOUT FEET
--      1. A Triumph of Surgery  2. The Thief's Story  3. The Midnight Visitor
--      4. A Question of Trust  5. Footprints Without Feet
--      6. The Making of a Scientist  7. The Necklace  8. Bholi
--      9. The Book that Saved the Earth
--
-- Searching that whole document: "Hundred Dresses" appears ZERO times and
-- "Hack Driver" appears ZERO times. The poem list has ten entries and no
-- standalone "Animals" -- the single "Animals" match in the file is inside
-- "How to Tell Wild Animals", a different poem that IS prescribed and IS
-- already named in a lesson title here.
--
-- 9 prose + 9 Footprints = 18 chapters, which is exactly what English is left
-- with after this file runs.
--
-- WHY IT HAPPENED. The five chapters were created because a Magnet Brains
-- playlist taught them and the catalogue did not have them. That is evidence
-- about what a publisher filmed, not about what CBSE prescribes -- publishers
-- keep older material online for state boards and for students on the previous
-- syllabus. The correct source was always the curriculum document, and it took
-- until after the import to go read it.
--
-- Deleting the lessons cascades their playlist_videos, video_learning_goals,
-- video_class_levels and video_progress rows (every foreign key onto videos is
-- ON DELETE CASCADE -- checked, not assumed). Lessons are removed before their
-- chapters so the delete does not depend on which chapter-level FK rule is live.
--
-- Course positions are renumbered afterwards so both English courses stay clean
-- 1..n runs, and chapter display_order is rewritten to the CBSE book order.
--
-- Guarded: it refuses to run if a chapter holds anything other than the exact
-- lessons named here, so it cannot delete work someone added in the meantime.
-- Idempotent and self-verifying.

begin;

do $revert$
declare
  v_removed_videos int;
  v_removed_chapters int;
  v_ff bigint;
  v_fp bigint;
  r record;
  v_pos int;
begin
  -- Refuse to delete anything unexpected. Each off-syllabus chapter must hold
  -- EXACTLY the lessons this file was written against.
  for r in
    select * from (values
      ('The Hundred Dresses I',  array['xVAem2AWNgk', 'uV0MsRmnXoA']),
      ('The Hundred Dresses II', array['Hw4IHPhEl9Q', 'pFVvu24gPW8', '0lgsPSZd1RE']),
      ('The Hack Driver',        array['kYeZxsNKVgw'])
    ) as t(chapter_name, ids)
  loop
    if exists (select 1 from public.chapters where subject_id = 11 and name = r.chapter_name) then
      if exists (
        select 1 from public.videos v
        join public.chapters c on c.id = v.chapter_id
        where c.subject_id = 11 and c.name = r.chapter_name
          and not (v.youtube_video_id = any (r.ids))
      ) then
        raise exception 'chapter "%" holds a lesson this file does not know about - refusing to delete someone else''s work', r.chapter_name;
      end if;
    end if;
  end loop;

  -- 1. lessons first (cascades every junction, including watch progress)
  delete from public.videos
   where youtube_video_id in
     ('xVAem2AWNgk', 'uV0MsRmnXoA', 'Hw4IHPhEl9Q', 'pFVvu24gPW8', '0lgsPSZd1RE', 'kYeZxsNKVgw');
  get diagnostics v_removed_videos = row_count;

  -- 2. then the chapters themselves
  delete from public.chapters
   where subject_id = 11
     and name in ('The Hundred Dresses I', 'The Hundred Dresses II', 'The Hack Driver');
  get diagnostics v_removed_chapters = row_count;

  raise notice 'removed % lesson(s) and % chapter(s)', v_removed_videos, v_removed_chapters;

  -- 3. chapter order = the CBSE prescribed order, 1..18
  update public.chapters set display_order = t.ord
    from (values
      ('A Letter to God', 1), ('Nelson Mandela: Long Walk to Freedom', 2),
      ('Two Stories about Flying', 3), ('From the Diary of Anne Frank', 4),
      ('Glimpses of India', 5), ('Mijbil the Otter', 6), ('Madam Rides the Bus', 7),
      ('The Sermon at Benares', 8), ('The Proposal', 9),
      ('A Triumph of Surgery', 10), ('The Thief''s Story', 11),
      ('The Midnight Visitor', 12), ('A Question of Trust', 13),
      ('Footprints Without Feet', 14), ('The Making of a Scientist', 15),
      ('The Necklace', 16), ('Bholi', 17), ('The Book That Saved the Earth', 18)
    ) as t(nm, ord)
   where public.chapters.subject_id = 11 and public.chapters.name = t.nm;

  -- 4. close the gaps the deleted lessons left in each course's positions
  for v_ff in
    select id from public.playlists
     where subject_id = 11
       and channel_id = (select id from public.institutes_channels
                          where youtube_channel_id = 'UC3HS6gQ79jjn4xHxogw0HiA')
  loop
    v_pos := 0;
    for r in
      select pv.video_id
        from public.playlist_videos pv
        join public.videos v on v.id = pv.video_id
        join public.chapters c on c.id = v.chapter_id
       where pv.playlist_id = v_ff
       order by c.display_order, pv.position
    loop
      v_pos := v_pos + 1;
      update public.playlist_videos set position = v_pos
       where playlist_id = v_ff and video_id = r.video_id;
    end loop;
  end loop;
end
$revert$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n int;
  v_extra text;
  v_missing text;
  v_empty int;
  v_dup int;
  r record;
begin
  -- The prescribed list, exactly as the CBSE 2026-27 document gives it.
  create temp table _cbse (nm text) on commit drop;
  insert into _cbse values
    ('A Letter to God'), ('Nelson Mandela: Long Walk to Freedom'),
    ('Two Stories about Flying'), ('From the Diary of Anne Frank'),
    ('Glimpses of India'), ('Mijbil the Otter'), ('Madam Rides the Bus'),
    ('The Sermon at Benares'), ('The Proposal'),
    ('A Triumph of Surgery'), ('The Thief''s Story'), ('The Midnight Visitor'),
    ('A Question of Trust'), ('Footprints Without Feet'),
    ('The Making of a Scientist'), ('The Necklace'), ('Bholi'),
    ('The Book That Saved the Earth');

  select count(*) into v_n from public.chapters where subject_id = 11;
  if v_n <> 18 then raise exception 'expected 18 English chapters, found %', v_n; end if;

  select string_agg(c.name, ', ') into v_extra
    from public.chapters c
   where c.subject_id = 11 and not exists (select 1 from _cbse where nm = c.name);
  if v_extra is not null then
    raise exception 'English still holds chapter(s) CBSE does not prescribe: %', v_extra;
  end if;

  select string_agg(nm, ', ') into v_missing
    from _cbse
   where not exists (select 1 from public.chapters c where c.subject_id = 11 and c.name = _cbse.nm);
  if v_missing is not null then
    raise exception 'English is missing prescribed chapter(s): %', v_missing;
  end if;

  -- None of the removed lessons may survive anywhere.
  if exists (select 1 from public.videos where youtube_video_id in
      ('xVAem2AWNgk', 'uV0MsRmnXoA', 'Hw4IHPhEl9Q', 'pFVvu24gPW8', '0lgsPSZd1RE', 'kYeZxsNKVgw')) then
    raise exception 'an off-syllabus lesson survived the delete';
  end if;

  -- display_order must be a clean 1..18.
  select count(*) into v_dup from (
    select display_order from public.chapters where subject_id = 11
     group by display_order having count(*) > 1) d;
  if v_dup <> 0 then raise exception 'English chapters share a display_order'; end if;
  select count(*) into v_n from public.chapters
   where subject_id = 11 and display_order between 1 and 18;
  if v_n <> 18 then raise exception 'English display_order is not a clean 1..18 run'; end if;

  -- No chapter may have been emptied by the delete.
  select count(*) into v_empty
    from public.chapters c
   where c.subject_id = 11
     and not exists (select 1 from public.videos v where v.chapter_id = c.id);
  if v_empty <> 0 then raise exception '% English chapter(s) now have no lessons', v_empty; end if;

  -- Every course must still be a clean 1..n run.
  for r in select id, title from public.playlists where subject_id = 11 loop
    select count(*) into v_n from public.playlist_videos where playlist_id = r.id;
    select count(*) into v_dup from public.playlist_videos
     where playlist_id = r.id and position between 1 and v_n;
    if v_dup <> v_n then
      raise exception 'course "%" positions are not a clean 1..% run', r.title, v_n;
    end if;
  end loop;

  raise notice 'SELF-TEST PASSED: English is exactly the 18 chapters CBSE prescribes for 2026-27; 6 off-syllabus lessons removed; every course still a clean run.';
end
$verify$;

commit;
