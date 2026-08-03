-- CREATE-ONLY import: eSaral Mathematics for JEE.
--
-- WHY: measured through the exam-goal filter students browse with, JEE
-- Mathematics had 14 chapters taught by a single institute -- Competishun alone
-- across the whole of calculus, conics, matrices and complex numbers. ALLEN's
-- JEE maths one-shots could not close them because that series pairs chapters
-- ("Determinants and Matrices", "Binomial Theorem & Complex Number"), leaving no
-- single correct chapter_id.
--
-- eSaral's Mathematics Revision series is taught chapter by chapter, so it maps
-- cleanly. Across both files these 58 lessons take the JEE view from 18 to 29 of
-- 32 chapters with two or more institutes, closing 11: Relations and Functions,
-- Differential Equations, Parabola, Complex Numbers, Determinants, Continuity,
-- Definite Integration, Differentiation, Indefinite Integration, Matrices and
-- Applications of Derivatives.
--
-- Three JEE Mathematics gaps remain and are NOT closable from any source now in
-- the catalogue: Ellipse, Application of Integrals and Probability. eSaral
-- covers Parabola and Hyperbola but not Ellipse, and teaches probability only
-- inside combined sets.
--
-- Source     : eSaral — https://www.youtube.com/playlist?list=PLMjEg73ogUEJq01YeDwMPeqtMEJ5QB9Zr
-- Lessons    : 8    Chapters: 7
-- Verified   : every youtube_video_id returned HTTP 200 from YouTube's oEmbed
--              API, all hosted on this one channel, none already present.
--
-- Safe to re-run: aborts rather than duplicating. Order-independent.
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
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCddnJhXMUxzHoH8AZkZSd8w';
  if v_channel_id is null then
    insert into public.institutes_channels (name, youtube_channel_id)
    values ('eSaral', 'UCddnJhXMUxzHoH8AZkZSd8w') returning id into v_channel_id;
  end if;

  select id into strict v_goal_id from public.learning_goals where slug = 'jee';

  if exists (select 1 from public.playlists where title = 'Saralised Mathematics — eSaral') then
    raise exception 'course "%" already exists - this file has already been run', 'Saralised Mathematics — eSaral';
  end if;

  if exists (select 1 from public.videos where youtube_video_id = any(array['XAteF03B_1A', 'qqrvv2T4p18', '-f7qV9mV3wk', 'L-UQRmX9jOo', 'wC07-UgBCbk', '-iMCqkCbO4s', 'cuvZrn6-dU0', 'ISriIXJUvxE'])) then
    raise exception 'at least one of these 8 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Saralised Mathematics — eSaral', 'Saralised Mathematics — eSaral', 'Full-chapter Mathematics one-shots from the official eSaral channel.',
    null, v_channel_id, 1, 3, 'one-shot', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'XAteF03B_1A', 'Determinants', 'Determinants Class 12 JEE Mains & Advanced | one shot | ticks | concept | Formulas | PYQs', 3780, 69),
      (2, 'qqrvv2T4p18', 'Quadratic Equations', 'Quadratic Equations class 11 JEE Mains & Advanced | one shot | ticks | concept | Formulas | PYQs', 2975, 76),
      (3, '-f7qV9mV3wk', 'Sequences & Series', 'Sequences & Series Class 11 JEE Mains & Advanced | one shot | ticks | concept | Formulas | PYQs', 3985, 77),
      (4, 'L-UQRmX9jOo', 'Binomial Theorem', 'Binomial Theorem Class 11 JEE Mains & Advanced | one shot | ticks | concept | Formulas | PYQs', 3294, 78),
      (5, 'wC07-UgBCbk', 'Complex Numbers', 'Complex Numbers Class 11 JEE Mains & Advanced | one shot | ticks | concept | Formulas | PYQs', 2730, 65),
      (6, '-iMCqkCbO4s', 'Limits', 'Limits Class 12 JEE Main & Advanced | one shot | tricks | concept | Formulas | PYQs', 3213, 284),
      (7, 'cuvZrn6-dU0', 'Vector Algebra', 'Vector Algebra Class 12 JEE Main & Advanced | one shot | tricks | concept | Formulas | PYQs', 3456, 72),
      (8, 'ISriIXJUvxE', '3 Dimensional Geometry', '3 Dimensional Geometry Class 12 JEE Main & Advanced | one shot | tricks | concept | Formulas | PYQs', 3364, 72)
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

  if v_inserted <> 8 then
    raise exception 'expected 8 lessons for "%", inserted %', 'Saralised Mathematics — eSaral', v_inserted;
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = v_playlist_id and v.channel_id <> v_channel_id
  ) then
    raise exception 'a lesson in "%" is attributed to a different channel', 'Saralised Mathematics — eSaral';
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Saralised Mathematics — eSaral';
  end if;
end $$;
