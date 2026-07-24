-- ============================================================
--  Systematic Educational Video Directory  —  Supabase schema
--  Postgres / Supabase.  Paste the whole file into the SQL
--  Editor and press RUN.  Safe to run once on a fresh project.
-- ============================================================


-- 1. INSTITUTES / CHANNELS -----------------------------------
--    One row per coaching institute's YouTube channel.
create table public.institutes_channels (
    id                 bigint generated always as identity primary key,
    name               text not null,
    youtube_channel_id text not null unique,          -- e.g. UCxxxxxxxxxxxxxxxxxxxxxx
    logo_url           text,
    created_at         timestamptz not null default now()
);


-- 2. CATEGORIES  (JEE, NEET, Olympiad) -----------------------
create table public.categories (
    id            bigint generated always as identity primary key,
    name          text not null unique,
    slug          text not null unique,               -- clean URL, e.g. "jee"
    display_order int  not null default 0,            -- lets you order them manually
    created_at    timestamptz not null default now()
);


-- 3. SUBJECTS  (Physics, Chemistry, Mathematics, Biology) ----
--    Kept global so "Physics" is ONE row shared by JEE & NEET.
create table public.subjects (
    id            bigint generated always as identity primary key,
    name          text not null unique,
    slug          text not null unique,
    display_order int  not null default 0,
    created_at    timestamptz not null default now()
);


-- 4. CHAPTERS  (Kinematics, Chemical Bonding, ...) -----------
--    A chapter belongs to exactly one subject.
create table public.chapters (
    id            bigint generated always as identity primary key,
    subject_id    bigint not null
                  references public.subjects(id) on delete cascade,
    name          text not null,
    slug          text not null,
    display_order int  not null default 0,
    created_at    timestamptz not null default now(),
    unique (subject_id, name),          -- no duplicate chapter names within a subject
    unique (subject_id, slug)
);


-- 5. VIDEOS --------------------------------------------------
--    Each video stores only the YouTube ID (never the file).
--    The iframe embed URL is built from that ID in your app.
create table public.videos (
    id               bigint generated always as identity primary key,
    youtube_video_id text not null unique,            -- 11-char YouTube ID
    title            text not null,
    description      text,
    channel_id       bigint not null
                     references public.institutes_channels(id) on delete restrict,
    category_id      bigint not null
                     references public.categories(id)          on delete restrict,
    subject_id       bigint not null
                     references public.subjects(id)            on delete restrict,
    chapter_id       bigint                                    -- optional
                     references public.chapters(id)            on delete set null,
    published_at     date,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);


-- INDEXES ----------------------------------------------------
--    Postgres does not auto-index foreign keys. These make
--    "show all videos in this chapter / subject" fast.
create index idx_chapters_subject on public.chapters (subject_id);
create index idx_videos_channel   on public.videos  (channel_id);
create index idx_videos_category  on public.videos  (category_id);
create index idx_videos_subject   on public.videos  (subject_id);
create index idx_videos_chapter   on public.videos  (chapter_id);


-- AUTO-UPDATE videos.updated_at ------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger trg_videos_updated_at
    before update on public.videos
    for each row execute function public.set_updated_at();


-- ============================================================
--  ROW LEVEL SECURITY (IMPORTANT)
--  Supabase blocks all API access until you add a policy.
--  This directory is PUBLIC to read, but ONLY you (from the
--  dashboard) can add/edit rows. The public app key can read,
--  not write.
-- ============================================================
alter table public.institutes_channels enable row level security;
alter table public.categories          enable row level security;
alter table public.subjects            enable row level security;
alter table public.chapters            enable row level security;
alter table public.videos              enable row level security;

create policy "public read" on public.institutes_channels for select using (true);
create policy "public read" on public.categories          for select using (true);
create policy "public read" on public.subjects            for select using (true);
create policy "public read" on public.chapters            for select using (true);
create policy "public read" on public.videos              for select using (true);


-- ============================================================
--  OPTIONAL STARTER DATA
--  Lets you see the tables working immediately. Delete this
--  block if you'd rather start empty.
-- ============================================================
insert into public.categories (name, slug, display_order) values
    ('JEE',      'jee',      1),
    ('NEET',     'neet',     2),
    ('Olympiad', 'olympiad', 3);

insert into public.subjects (name, slug, display_order) values
    ('Physics',     'physics',     1),
    ('Chemistry',   'chemistry',   2),
    ('Mathematics', 'mathematics', 3),
    ('Biology',     'biology',      4);
