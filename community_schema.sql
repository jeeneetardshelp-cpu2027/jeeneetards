-- ============================================================
--  COMMUNITY LAYER — additive migration
--  Run this AFTER the original schema.sql, once, in the SQL Editor.
--  Adds: profiles, playlists, playlist_videos, playlist_ratings,
--        video_comments  (+ auto-averaged ratings + row security)
-- ============================================================


-- ------------------------------------------------------------
-- 0. PROFILES  — public identity for each signed-up student.
--    auth.users holds the private login; profiles holds the public
--    name/avatar shown next to reviews and comments.
-- ------------------------------------------------------------
create table public.profiles (
    id         uuid primary key references auth.users(id) on delete cascade,
    username   text unique,
    full_name  text,
    avatar_url text,
    created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, full_name, avatar_url)
    values (
        new.id,
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'avatar_url'
    );
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();


-- ------------------------------------------------------------
-- 1. PLAYLISTS  — a course = a group of videos, "by" a channel.
--    average_rating & ratings_count are DENORMALISED here so you can
--    sort/filter courses by rating instantly (kept fresh by trigger #6).
-- ------------------------------------------------------------
create table public.playlists (
    id             bigint generated always as identity primary key,
    title          text not null,
    description    text,
    slug           text unique,
    channel_id     bigint not null references public.institutes_channels(id) on delete restrict,
    category_id    bigint references public.categories(id) on delete set null,
    subject_id     bigint references public.subjects(id)   on delete set null,
    thumbnail_url  text,
    -- Curated courses use small ascending values. New, uncurated courses stay
    -- at the end until an editor deliberately places them.
    display_order  int  not null default 1000000,
    average_rating numeric(3,2) not null default 0,   -- maintained by trigger
    ratings_count  int          not null default 0,   -- maintained by trigger
    created_at     timestamptz  not null default now()
);


-- ------------------------------------------------------------
-- 2. PLAYLIST_VIDEOS  — which videos are in a course, and in what order.
--    This junction table is what actually "groups" videos into a course.
-- ------------------------------------------------------------
create table public.playlist_videos (
    id          bigint generated always as identity primary key,
    playlist_id bigint not null references public.playlists(id) on delete cascade,
    video_id    bigint not null references public.videos(id)    on delete cascade,
    position    int    not null default 0,   -- lesson order inside the course
    created_at  timestamptz not null default now(),
    unique (playlist_id, video_id)           -- no duplicate video in one course
);


-- ------------------------------------------------------------
-- 3. PLAYLIST_RATINGS  — 1–5 stars + optional written review, per course.
--    One rating per user per playlist (they can edit it later).
-- ------------------------------------------------------------
create table public.playlist_ratings (
    id          bigint generated always as identity primary key,
    playlist_id bigint not null references public.playlists(id) on delete cascade,
    user_id     uuid   not null references public.profiles(id)  on delete cascade,
    rating      int    not null check (rating between 1 and 5),
    review      text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (playlist_id, user_id)            -- one vote per student per course
);


-- ------------------------------------------------------------
-- 4. VIDEO_COMMENTS  — nested doubts/feedback, with optional timestamp.
--    parent_id -> another comment = threaded replies.
--    timestamp_seconds lets a student point to a moment in the video.
-- ------------------------------------------------------------
create table public.video_comments (
    id                bigint generated always as identity primary key,
    video_id          bigint not null references public.videos(id)  on delete cascade,
    user_id           uuid   not null references public.profiles(id) on delete cascade,
    parent_id         bigint references public.video_comments(id)    on delete cascade,
    body              text   not null check (char_length(body) > 0),
    timestamp_seconds int,                  -- e.g. 272 = a doubt at 4:32 (optional)
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 5. INDEXES  — foreign keys + the rating sort column.
-- ------------------------------------------------------------
create index idx_playlists_channel    on public.playlists (channel_id);
create index idx_playlists_category    on public.playlists (category_id);
create index idx_playlists_subject     on public.playlists (subject_id);
create index idx_playlists_avg_rating  on public.playlists (average_rating desc);

create index idx_plvideos_playlist     on public.playlist_videos (playlist_id);
create index idx_plvideos_video        on public.playlist_videos (video_id);

create index idx_plratings_playlist    on public.playlist_ratings (playlist_id);
create index idx_plratings_user        on public.playlist_ratings (user_id);

create index idx_vcomments_video       on public.video_comments (video_id);
create index idx_vcomments_parent      on public.video_comments (parent_id);
create index idx_vcomments_user        on public.video_comments (user_id);


-- ------------------------------------------------------------
-- 6. AUTO-AVERAGE  — the "optimised average ratings" part.
--    When a rating is added / changed / removed, recompute that
--    playlist's average_rating + ratings_count. Reads stay instant
--    because the numbers live on the (indexed) playlists row.
-- ------------------------------------------------------------
create or replace function public.refresh_playlist_rating()
returns trigger
language plpgsql
as $$
declare
    pid bigint := coalesce(new.playlist_id, old.playlist_id);
begin
    update public.playlists
    set average_rating = (
            select coalesce(round(avg(rating)::numeric, 2), 0)
            from public.playlist_ratings
            where playlist_id = pid
        ),
        ratings_count = (
            select count(*)
            from public.playlist_ratings
            where playlist_id = pid
        )
    where id = pid;
    return null;
end;
$$;

create trigger trg_refresh_playlist_rating
    after insert or update or delete on public.playlist_ratings
    for each row execute function public.refresh_playlist_rating();


-- ------------------------------------------------------------
-- 7. updated_at auto-touch for editable rows.
--    (set_updated_at may already exist from schema.sql — re-creating
--     it with "or replace" is harmless.)
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger trg_plratings_updated_at
    before update on public.playlist_ratings
    for each row execute function public.set_updated_at();

create trigger trg_vcomments_updated_at
    before update on public.video_comments
    for each row execute function public.set_updated_at();


-- ============================================================
-- 8. ROW LEVEL SECURITY
--    Everyone can READ community content. Signed-in students can
--    write ONLY their own ratings/comments. Playlists themselves are
--    curated by you (written from the dashboard / service role).
-- ============================================================
alter table public.profiles         enable row level security;
alter table public.playlists        enable row level security;
alter table public.playlist_videos  enable row level security;
alter table public.playlist_ratings enable row level security;
alter table public.video_comments   enable row level security;

-- profiles: public read, each user manages their own row
create policy "profiles are public"       on public.profiles for select using (true);
create policy "user inserts own profile"  on public.profiles for insert with check (auth.uid() = id);
create policy "user updates own profile"  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- playlists & their videos: public read only (you curate via dashboard)
create policy "public read" on public.playlists       for select using (true);
create policy "public read" on public.playlist_videos for select using (true);

-- playlist_ratings: public read, owner writes
create policy "ratings are public"      on public.playlist_ratings for select using (true);
create policy "user inserts own rating" on public.playlist_ratings for insert with check (auth.uid() = user_id);
create policy "user updates own rating" on public.playlist_ratings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user deletes own rating" on public.playlist_ratings for delete using (auth.uid() = user_id);

-- video_comments: public read, owner writes
create policy "comments are public"      on public.video_comments for select using (true);
create policy "user inserts own comment" on public.video_comments for insert with check (auth.uid() = user_id);
create policy "user updates own comment" on public.video_comments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user deletes own comment" on public.video_comments for delete using (auth.uid() = user_id);
