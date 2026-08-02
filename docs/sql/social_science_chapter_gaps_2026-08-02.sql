-- social_science_chapter_gaps_2026-08-02.sql
--
-- Closes the last two empty chapters in the entire catalogue. A catalogue-wide
-- sweep found exactly two chapters with ZERO videos anywhere: Social Science
-- "Federalism" (142) and "Consumer Rights" (150). Every other chapter across
-- Physics, Chemistry, Mathematics, Biology and Social Science has content.
--
-- WHY THEY WERE EMPTY -- and it is NOT an import bug: both existing courses
-- faithfully mirror their real YouTube playlists, and those playlists genuinely
-- contain only 4 videos each (verified via the YouTube API against playlist ids
-- PLKrMFg1EPRmFEeLMjmfgbQWP2_idaE5y- and PLKrMFg1EPRmEgXtUtF9cCVwh2-6O6wNUH).
-- The creator simply never added these chapters to those playlists.
--
-- ALL CONTENT BELOW IS FROM Digraj Singh Rajput (channel_id 65), the same
-- teacher already behind both courses, and every video was verified live via
-- the YouTube Data API: real id, real duration, embeddable = true.
--
-- 1. FEDERALISM -> appended to the existing Civics course (153).
--    "Federalism | New One Shot | Class 10 Civics 2026-27" is the SAME series
--    and year as the four lessons already in that course (e.g. "Political
--    Parties | New One Shot | Class 10 Civics 2026-27"). Adding it completes
--    NCERT Class 10 Civics chapters 1-5.
--
-- 2. CONSUMER RIGHTS -> a NEW course, not appended to the Economics course
--    (154). That course is a "10 Minutes Rapid Revision" series and the creator
--    never made a rapid-revision episode for Consumer Rights. What does exist is
--    a 5-part chapter walkthrough from an earlier series, which covers the NCERT
--    chapter's own section structure end to end. Mixing a 5-part 2023-24
--    walkthrough into a 4-part 2026-27 rapid-revision course would misrepresent
--    both, so it becomes its own honestly-labelled course instead.
--
-- Respects the playlist_video_channel_guard trigger added on 31 July: every
-- lesson here is published by channel 65, matching its course's channel.
--
-- Idempotent: videos upsert on youtube_video_id; the course insert is guarded so
-- a re-run does not create a duplicate. Self-verifying.

begin;

-- ---------------------------------------------------------------------
-- 1. Federalism -> existing Civics course 153
-- ---------------------------------------------------------------------
do $federalism$
declare
  v_channel_id bigint;
  v_chapter_id bigint;
  v_video_id bigint;
  v_next int;
begin
  select id into v_channel_id from public.institutes_channels where id = 65;
  if v_channel_id is null then raise exception 'channel 65 (Digraj Singh Rajput) not found'; end if;

  select id into v_chapter_id from public.chapters where id = 142 and name = 'Federalism';
  if v_chapter_id is null then raise exception 'chapter 142 Federalism not found'; end if;

  if (select channel_id from public.playlists where id = 153) is distinct from v_channel_id then
    raise exception 'course 153 is not on channel 65 -- refusing to add a lesson that would violate the channel guard';
  end if;

  select coalesce(max(position), 0) + 1 into v_next
    from public.playlist_videos where playlist_id = 153;

  insert into public.videos
    (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id,
     category_id, duration_seconds, embedding_status, last_verified_at)
  values
    ('K5lK3zq5cAc', 'Federalism — One Shot',
     'Federalism | New One Shot | Class 10 Civics 2026-27',
     v_channel_id, 5, v_chapter_id, 4, 4692, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;

  insert into public.playlist_videos (playlist_id, video_id, position)
  values (153, v_video_id, v_next)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$federalism$;

-- ---------------------------------------------------------------------
-- 2. Consumer Rights -> new 5-lesson course
-- ---------------------------------------------------------------------
do $consumer$
declare
  v_channel_id bigint := 65;
  v_chapter_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  r record;
begin
  select id into v_chapter_id from public.chapters where id = 150 and name = 'Consumer Rights';
  if v_chapter_id is null then raise exception 'chapter 150 Consumer Rights not found'; end if;

  select id into v_playlist_id from public.playlists
   where title = 'Consumer Rights — Class 10 Economics' and channel_id = v_channel_id;

  if v_playlist_id is null then
    insert into public.playlists
      (title, teacher, channel_id, subject_id, category_id, content_type, language, difficulty)
    values
      ('Consumer Rights — Class 10 Economics', 'Digraj Singh Rajput', v_channel_id, 5, 4,
       'one-shot', 'hinglish', 'beginner')
    returning id into v_playlist_id;

    insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    select v_playlist_id, id from public.learning_goals where slug = 'school';

    insert into public.playlist_class_levels (playlist_id, class_level_id)
    select v_playlist_id, id from public.class_levels where slug = 'class-10';
  end if;

  for r in
    select * from (values
      (1, 'Consumer Rights — Introduction',
          'Consumer Rights  - Introduction | State Boards 2023-24 | Class 10 Economics',
          '-_uIJtvOsD8', 385),
      (2, 'Consumer Rights — The Consumer in the Marketplace',
          'Consumer Rights  - The Consumer In The Marketplace | State Boards 2023-24 | Class 10 Economics',
          'KCqEDy-PDUY', 948),
      (3, 'Consumer Rights — Consumer Movement',
          'Consumer Rights  - Consumer Movement | State Boards 2023-24 | Class 10 Economics',
          'EPPy2pUBBcU', 928),
      (4, 'Consumer Rights — Rights of the Consumer',
          'Consumer Rights  - Consumer Rights | State Boards 2023-24 | Class 10 Economics',
          'gtFjdcVcvys', 1780),
      (5, 'Consumer Rights — Taking the Movement Forward',
          'Consumer Rights  - Taking The Consumer movement Forward | State Boards 2023-24 | Class 10 Economics',
          '8GPxRXwq0a4', 471)
    ) as t(pos, title, source_title, yt_id, secs)
  loop
    insert into public.videos
      (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id,
       category_id, duration_seconds, embedding_status, last_verified_at)
    values
      (r.yt_id, r.title, r.source_title, v_channel_id, 5, v_chapter_id, 4, r.secs, 'allowed', now())
    on conflict (youtube_video_id) do update set last_verified_at = now()
    returning id into v_video_id;

    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, r.pos)
    on conflict (playlist_id, video_id) do update set position = excluded.position;
  end loop;
end
$consumer$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_empty int;
  v_fed int;
  v_cons int;
  v_c153 int;
  v_badchan int;
begin
  -- The actual goal: no chapter anywhere is left with zero videos.
  select count(*) into v_empty
    from public.chapters c
   where not exists (select 1 from public.videos v where v.chapter_id = c.id);
  if v_empty <> 0 then
    raise exception '% chapter(s) still have zero videos catalogue-wide', v_empty;
  end if;

  select count(*) into v_fed  from public.videos where chapter_id = 142;
  select count(*) into v_cons from public.videos where chapter_id = 150;
  if v_fed < 1 then raise exception 'Federalism still has no video'; end if;
  if v_cons <> 5 then raise exception 'expected 5 Consumer Rights videos, found %', v_cons; end if;

  select count(*) into v_c153 from public.playlist_videos where playlist_id = 153;
  if v_c153 <> 5 then raise exception 'expected course 153 to have 5 lessons, found %', v_c153; end if;

  -- Must not have violated the institute-consistency guard.
  select count(*) into v_badchan
    from public.playlist_videos pv
    join public.videos v    on v.id = pv.video_id
    join public.playlists p on p.id = pv.playlist_id
   where v.channel_id is distinct from p.channel_id;
  if v_badchan <> 0 then
    raise exception '% lesson(s) are published by a channel other than their course''s', v_badchan;
  end if;

  raise notice 'SELF-TEST PASSED: zero empty chapters catalogue-wide; Federalism added to Civics (5 lessons); Consumer Rights course created with 5 lessons; institute consistency intact.';
end
$verify$;

commit;
