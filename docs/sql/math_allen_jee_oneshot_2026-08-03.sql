-- CREATE-ONLY import: ALLEN JEE Mathematics.
--
-- WHY: Mathematics was the worst subject in the catalogue for teaching
-- diversity -- 31 of 44 chapters taught by a single INSTITUTE, almost all of
-- them Competishun. Aakash NEET and ALLEN NEET cannot help, because Mathematics
-- is not a NEET subject. ALLEN JEE is ALLEN's JEE-side channel: the same
-- institute already trusted in this catalogue for Biology, Chemistry and
-- Physics, teaching the subject Competishun currently owns alone.
--
-- Source     : https://www.youtube.com/playlist?list=PL_aKL95N88s2wFpaZ1BA1xHIKpCfd0dCO
-- Lessons    : 4
-- Chapters   : 77 Sequences and Series; 282 Fundamentals of Mathematics; 58 Inverse Trigonometric Functions; 72 Vectors and Three-Dimensional Geometry
-- Verified   : every youtube_video_id below returned HTTP 200 from YouTube's
--              oEmbed API with author_name "ALLEN JEE", and none was already in
--              the catalogue.
--
-- Lessons that genuinely span several chapters (ALLEN's one-shots often pair
-- two topics, e.g. "Determinants and Matrices") were EXCLUDED rather than filed
-- under a guess -- there is no single correct chapter_id for them.
--
-- Safe to re-run: aborts rather than duplicating. Order-independent; whichever
-- of the 4 files runs first creates the ALLEN JEE channel row.
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
  -- ALLEN JEE is a new institute channel for this catalogue.
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCkUI45drrKTWLxy3q3voJRw';
  if v_channel_id is null then
    insert into public.institutes_channels (name, youtube_channel_id)
    values ('ALLEN JEE', 'UCkUI45drrKTWLxy3q3voJRw')
    returning id into v_channel_id;
  end if;

  select id into strict v_goal_id from public.learning_goals where slug = 'jee';

  if exists (select 1 from public.playlists where title = 'Mathematics One Shot — JEE Main and Advanced') then
    raise exception 'course "%" already exists - this file has already been run', 'Mathematics One Shot — JEE Main and Advanced';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'Y4VoRcXoo60', 'JjTuca-MkGY', 'zLBc7Cxvl-o', 'KhfYOaSi9ko'
    ])
  ) then
    raise exception 'at least one of these 4 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Mathematics One Shot — JEE Main and Advanced', 'Mathematics One Shot — JEE Main and Advanced', 'Full-chapter one-shot Mathematics lectures from the official ALLEN JEE channel.',
    null, v_channel_id, 1, 3, 'one-shot', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels
  where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'Y4VoRcXoo60', 'Sequence & Series — One Shot', 'Sequence & Series Explained in One Shot 🔥| Mission JEE Main and Advanced | Maths by Sachin Sir', 33116, 77),
      (2, 'JjTuca-MkGY', 'Sets and Basic Maths — One Shot', 'Sets and Basic Maths Explained in One Shot 🔥| Mission JEE Main & Advanced | Maths by Sachin Sir', 30146, 282),
      (3, 'zLBc7Cxvl-o', 'Function and Inverse Trigonometric Function', 'Function and Inverse Trigonometric Function🔥| JEE Main & Advanced | Maths by Sachin Sir', 32199, 58),
      (4, 'KhfYOaSi9ko', 'Vectors & 3D Geometry — One Shot', 'Vectors & 3D Geometry One Shot by Sachin Mor Sir🔥 JEE Main & Advanced | ALLEN', 32491, 72)
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

  if v_inserted <> 4 then
    raise exception 'expected 4 lessons for "%", inserted %', 'Mathematics One Shot — JEE Main and Advanced', v_inserted;
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Mathematics One Shot — JEE Main and Advanced';
  end if;
end $$;
