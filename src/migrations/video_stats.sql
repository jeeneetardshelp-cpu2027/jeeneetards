-- ============================================================
--  VIDEO STATS  —  volatile YouTube statistics (view/like counts)
--  and the popularity rollups that power view/popularity sorting.
--
--  Kept in a SEPARATE table from public.videos ON PURPOSE: YouTube's
--  API Terms require stored statistics to be refreshed or deleted on a
--  cadence (treat 30 days as the ceiling), while the catalog row is
--  permanent. Separating them makes the refresh/purge job a single
--  query and leaves the catalog immutable. Run once.
-- ============================================================

create table if not exists public.video_stats (
    video_id         bigint primary key
                     references public.videos(id) on delete cascade,
    view_count       bigint,
    like_count       bigint,                 -- null when the creator hides likes
    -- views per day since publish, computed at fetch time. Age-fair signal.
    views_per_day    numeric,
    -- log-dampened, recency-weighted score used by the "Most popular" sort.
    -- Recomputed every refresh (see src/scripts/statsMath.js for the formula).
    popularity_score numeric  not null default 0,
    fetched_at       timestamptz not null default now()
);

-- Sort individual lectures by raw views / by popularity.
create index if not exists idx_video_stats_views
    on public.video_stats (view_count desc);
create index if not exists idx_video_stats_popularity
    on public.video_stats (popularity_score desc);
-- Find stale rows to refresh / purge on the ToS cadence.
create index if not exists idx_video_stats_fetched
    on public.video_stats (fetched_at);

alter table public.video_stats enable row level security;

-- Counts are public, read-only. There is deliberately NO insert/update/delete
-- policy: only the service-role refresh job (which bypasses RLS) may write,
-- matching how the rest of the catalog is maintained.
drop policy if exists "public reads stats" on public.video_stats;
create policy "public reads stats" on public.video_stats
    for select using (true);


-- ------------------------------------------------------------
--  Denormalised popularity rollups on playlists (mirrors the
--  existing average_rating / ratings_count pattern). A playlist is
--  not a YouTube video and has no native view count, so course
--  popularity is aggregated from its member videos by the refresh job.
-- ------------------------------------------------------------
alter table public.playlists
    add column if not exists view_count_total bigint  not null default 0,
    add column if not exists popularity_score numeric not null default 0,
    add column if not exists stats_fetched_at timestamptz;  -- oldest member fetch; drives "views as of …"

create index if not exists idx_playlists_popularity
    on public.playlists (popularity_score desc);
create index if not exists idx_playlists_views
    on public.playlists (view_count_total desc);
