-- ============================================================
--  SEED — your first real content.
--  Safe to run even if Kinematics chapter already exists.
--
--  Replace CAPITALISED placeholders before running:
--    PASTE_ID_1 / 2 / 3  →  real 11-char YouTube video IDs
--    your real lecture titles
--    UC_PASTE_YOUR_CHANNEL_ID  →  your YouTube channel ID
-- ============================================================

do $$
declare
    v_jee      bigint;
    v_physics  bigint;
    v_chapter  bigint;
    v_channel  bigint;
    v_playlist bigint;
    v_vid1     bigint;
    v_vid2     bigint;
    v_vid3     bigint;
begin
    -- Look up category + subject (already created by schema.sql)
    select id into v_jee     from public.categories where slug = 'jee';
    select id into v_physics from public.subjects   where slug = 'physics';

    -- Chapter: get existing Kinematics OR create it if missing
    insert into public.chapters (subject_id, name, slug)
    values (v_physics, 'Kinematics', 'kinematics')
    on conflict (subject_id, name) do nothing;

    select id into v_chapter
    from public.chapters
    where subject_id = v_physics and name = 'Kinematics';

    -- Channel: get existing Competishun channel OR create it
    insert into public.institutes_channels (name, youtube_channel_id)
    values ('Competishun', 'UC_PASTE_YOUR_CHANNEL_ID')
    on conflict (youtube_channel_id) do nothing;

    select id into v_channel
    from public.institutes_channels
    where youtube_channel_id = 'UC_PASTE_YOUR_CHANNEL_ID';

    -- Videos (replace IDs + titles with your real lectures)
    insert into public.videos
        (youtube_video_id, title, channel_id, category_id, subject_id, chapter_id)
    values ('PASTE_ID_1', 'Kinematics — Introduction',   v_channel, v_jee, v_physics, v_chapter)
    on conflict (youtube_video_id) do nothing
    returning id into v_vid1;

    -- If video already existed, look it up
    if v_vid1 is null then
        select id into v_vid1 from public.videos where youtube_video_id = 'PASTE_ID_1';
    end if;

    insert into public.videos
        (youtube_video_id, title, channel_id, category_id, subject_id, chapter_id)
    values ('PASTE_ID_2', 'Motion Graphs Explained',     v_channel, v_jee, v_physics, v_chapter)
    on conflict (youtube_video_id) do nothing
    returning id into v_vid2;

    if v_vid2 is null then
        select id into v_vid2 from public.videos where youtube_video_id = 'PASTE_ID_2';
    end if;

    insert into public.videos
        (youtube_video_id, title, channel_id, category_id, subject_id, chapter_id)
    values ('PASTE_ID_3', 'Relative Velocity',            v_channel, v_jee, v_physics, v_chapter)
    on conflict (youtube_video_id) do nothing
    returning id into v_vid3;

    if v_vid3 is null then
        select id into v_vid3 from public.videos where youtube_video_id = 'PASTE_ID_3';
    end if;

    -- Playlist / course
    insert into public.playlists
        (title, teacher, channel_id, category_id, subject_id, tags)
    values (
        'Complete Kinematics', 'ABJ Sir',
        v_channel, v_jee, v_physics,
        array['Best for Beginners', 'Concept Clarity']
    )
    on conflict do nothing
    returning id into v_playlist;

    if v_playlist is null then
        select id into v_playlist
        from public.playlists
        where title = 'Complete Kinematics' and channel_id = v_channel;
    end if;

    -- Link videos into the course in order (skip if already linked)
    insert into public.playlist_videos (playlist_id, video_id, position)
    values
        (v_playlist, v_vid1, 1),
        (v_playlist, v_vid2, 2),
        (v_playlist, v_vid3, 3)
    on conflict (playlist_id, video_id) do nothing;

    raise notice 'Done. chapter_id=%, channel_id=%, playlist_id=%',
        v_chapter, v_channel, v_playlist;
end $$;
