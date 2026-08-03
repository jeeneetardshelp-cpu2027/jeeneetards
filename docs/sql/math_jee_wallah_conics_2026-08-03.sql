-- CREATE-ONLY import: JEE Wallah Conic Sections.
--
-- This closes ELLIPSE, the last JEE Mathematics chapter that no other source in
-- the catalogue teaches standalone. eSaral covers Parabola and Hyperbola but
-- skips Ellipse; ALLEN teaches all three inside one combined "Conic Section:
-- Parabola, Ellipse & Hyperbola" one-shot with no single correct chapter_id.
--
-- JEE Wallah teaches all three in ONE playlist but as separate sequential
-- lessons, so each is filed by the conic it actually covers: lessons 1-4
-- Parabola, 5-8 Ellipse, 9-11 Hyperbola. Parabola and Hyperbola gain a further
-- institute as a side effect.
--
-- Source     : JEE Wallah — https://www.youtube.com/playlist?list=PLxyGaR3hEy3ghkvwRziVJgipOKrSoALpB
-- Lessons    : 11
-- Verified   : all 11 youtube_video_ids returned HTTP 200 from YouTube's
--              oEmbed API with author_name "JEE Wallah", all distinct, and none
--              already in the catalogue.
--
-- NOT included, and why: JEE Wallah has 26 further chapter-level Maths
-- playlists, but they close no additional chapter -- the pending eSaral
-- Mathematics files already give those chapters a second institute, so importing
-- them would add depth, not diversity. Its Kinetic Theory of Gases lesson is
-- likewise skipped: that chapter is already Physics Wallah-only, and JEE Wallah
-- is the same institute, so it would not close anything.
--
-- Safe to re-run: aborts rather than duplicating.
do $$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_row record;
  v_level record;
  v_inserted integer := 0;
begin
  select id into strict v_channel_id from public.institutes_channels
  where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';

  select id into strict v_goal_id from public.learning_goals where slug = 'jee';

  if exists (select 1 from public.playlists where title = 'Conic Sections — JEE Wallah') then
    raise exception 'course "%" already exists - this file has already been run', 'Conic Sections — JEE Wallah';
  end if;

  if exists (select 1 from public.videos where youtube_video_id = any(array['VJDV8ZkzosI', '_mNwcTi_lA8', 'cyP3fmJ4OFc', 'oqqpdjlJ42w', 'uKaRo87uN0o', '_jRKitFTXKo', 'o7lK-MsR7As', 'cxMR-zH1SxE', 'JKEHMlrACgo', 'C4k-l2C0ZVE', 'BNxwlLFEScY'])) then
    raise exception 'at least one of these 11 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Conic Sections — JEE Wallah', 'Conic Sections — JEE Wallah',
    'Parabola, ellipse and hyperbola taught in sequence, from the official JEE Wallah channel.',
    null, v_channel_id, 1, 3, 'full-course', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'VJDV8ZkzosI', 'Conic Sections — Standard Parabolas', 'Conic Section 01 | Standard Parabolas | Position of a Point WRT Parabola | Class 11/JEE | RAFTAAR', 6010, 63),
      (2, '_mNwcTi_lA8', 'Conic Sections — Parametric Equation', 'Conic Section 02 | Parametric Equation | Position of a Point WET Parabola |  Class 11/JEE | RAFTAAR', 6624, 63),
      (3, 'cyP3fmJ4OFc', 'Conic Sections — Properties of Focal Chord', 'Conic Section 03 | Properties of Focal Chord | Condition of Tangency | Class 11/JEE | RAFTAAR', 6321, 63),
      (4, 'oqqpdjlJ42w', 'Conic Sections — Equation Of Normal To The Parabola', 'Conic Section 04 | Equation Of Normal To The Parabola | Class 11/JEE | RAFTAAR', 5617, 63),
      (5, 'uKaRo87uN0o', 'Conic Sections — Standard Equation of Ellipse', 'Conic Section 05 | Standard Equation of Ellipse | Class 11/JEE | RAFTAAR', 4070, 60),
      (6, '_jRKitFTXKo', 'Conic Sections — Parametric Form of Ellipse', 'Conic Section 06 | Parametric Form of Ellipse | Point OF Contact | Class 11/JEE | RAFTAAR', 4316, 60),
      (7, 'o7lK-MsR7As', 'Conic Sections — Normal to an Ellipse', 'Conic Section 07 | Normal to an Ellipse | Chord Of Contact | Class 11/JEE | RAFTAAR', 4363, 60),
      (8, 'cxMR-zH1SxE', 'Conic Sections — Pair of Tangents', 'Conic Section 08 | Pair of Tangents | Important Results On Ellipse | Class 11/JEE | RAFTAAR', 5419, 60),
      (9, 'JKEHMlrACgo', 'Conic Sections — Introduction and Equation of Hyperbola', 'Conic Section 09 | Introduction and Equation of Hyperbola | Class 11/JEE | RAFTAAR', 5216, 61),
      (10, 'C4k-l2C0ZVE', 'Conic Sections — Position of a Point - Equation of Tangent', 'Conic Section -10 | Position of a Point - Equation of Tangent | Class 11/JEE | RAFTAAR', 6020, 61),
      (11, 'BNxwlLFEScY', 'Conic Sections — Important Highlights Of Hyperbola', 'Conic Section 11 | Important Highlights Of Hyperbola | Class 11/JEE | RAFTAAR', 4458, 61)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds, chapter_id)
    order by position
  loop
    if not exists (select 1 from public.chapters where id = v_row.chapter_id and subject_id = 3) then
      raise exception 'chapter % is not a Mathematics chapter', v_row.chapter_id;
    end if;

    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      3, v_row.chapter_id, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);

    for v_level in
      select id from public.class_levels where slug in ('class-11', 'class-12', 'dropper')
    loop
      insert into public.video_class_levels (video_id, class_level_id)
      values (v_video_id, v_level.id) on conflict do nothing;
    end loop;

    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);
    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> 11 then
    raise exception 'expected 11 lessons, inserted %', v_inserted;
  end if;

  -- The whole point of this file: Ellipse must no longer be single-institute.
  if not exists (
    select 1 from public.videos where chapter_id = 60 and channel_id = v_channel_id
  ) then
    raise exception 'no Ellipse lesson was filed - the chapter split did not work';
  end if;
end $$;
