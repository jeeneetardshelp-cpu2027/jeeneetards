-- ============================================================
--  STEP 1  —  Structured learning-goal + class-level data.
--  Run once in the Supabase SQL Editor. Safe to run more than once.
--
--  ADDITIVE and NON-BREAKING: this adds new reference + junction
--  tables ALONGSIDE the existing schema. The current app keeps
--  reading categories/subject_id/chapter_id/class_levels exactly as
--  before. Rewiring the app to read these new tables is a LATER step.
--
--  Why junction tables: membership is many-to-many. One YouTube video
--  can apply to BOTH JEE and NEET (no duplicate row), and a course can
--  serve Class 11 + 12 + Dropper at once. A single column can't express
--  that; a link table can.
--
--  Three separate axes (never one mixed list):
--    learning_goals : JEE / NEET / Olympiad / School Boards
--    boards         : CBSE (…ICSE / state later)
--    class_levels   : Class 10 / 11 / 12 / Dropper
-- ============================================================


-- ------------------------------------------------------------
-- 1. REFERENCE TABLES
-- ------------------------------------------------------------
create table if not exists public.learning_goals (
    id            bigint generated always as identity primary key,
    name          text not null unique,
    slug          text not null unique,
    display_order int  not null default 0,
    created_at    timestamptz not null default now()
);

create table if not exists public.boards (
    id            bigint generated always as identity primary key,
    name          text not null unique,
    slug          text not null unique,
    display_order int  not null default 0,
    created_at    timestamptz not null default now()
);

-- NOTE: this is a TABLE named class_levels. It does not collide with the
-- existing playlists.class_levels ARRAY COLUMN (different namespace). The
-- column is retired in a later step once reads move to the junction below.
create table if not exists public.class_levels (
    id            bigint generated always as identity primary key,
    name          text not null unique,     -- "Class 11"
    slug          text not null unique,      -- "class-11"
    display_order int  not null default 0,
    created_at    timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 2. SEED the reference data (idempotent)
-- ------------------------------------------------------------
insert into public.learning_goals (name, slug, display_order) values
    ('JEE',           'jee',      1),
    ('NEET',          'neet',     2),
    ('Olympiad',      'olympiad', 3),
    ('School Boards', 'school',   4)
on conflict (slug) do nothing;

insert into public.boards (name, slug, display_order) values
    ('CBSE', 'cbse', 1)
on conflict (slug) do nothing;

insert into public.class_levels (name, slug, display_order) values
    ('Class 10', 'class-10', 1),
    ('Class 11', 'class-11', 2),
    ('Class 12', 'class-12', 3),
    ('Dropper',  'dropper',  4)
on conflict (slug) do nothing;


-- ------------------------------------------------------------
-- 3. JUNCTION TABLES  (many-to-many)
--    Only the goal + class-level links belong to step 1. The
--    subject/chapter/topic junctions come in a later step, when reads
--    move off the single subject_id/chapter_id columns.
-- ------------------------------------------------------------
create table if not exists public.playlist_learning_goals (
    playlist_id      bigint not null references public.playlists(id)       on delete cascade,
    learning_goal_id bigint not null references public.learning_goals(id)  on delete cascade,
    primary key (playlist_id, learning_goal_id)
);

create table if not exists public.video_learning_goals (
    video_id         bigint not null references public.videos(id)          on delete cascade,
    learning_goal_id bigint not null references public.learning_goals(id)  on delete cascade,
    primary key (video_id, learning_goal_id)
);

create table if not exists public.playlist_class_levels (
    playlist_id    bigint not null references public.playlists(id)     on delete cascade,
    class_level_id bigint not null references public.class_levels(id)  on delete cascade,
    primary key (playlist_id, class_level_id)
);

create table if not exists public.video_class_levels (
    video_id       bigint not null references public.videos(id)        on delete cascade,
    class_level_id bigint not null references public.class_levels(id)  on delete cascade,
    primary key (video_id, class_level_id)
);

create index if not exists idx_plg_goal  on public.playlist_learning_goals (learning_goal_id);
create index if not exists idx_vlg_goal  on public.video_learning_goals    (learning_goal_id);
create index if not exists idx_pcl_class on public.playlist_class_levels    (class_level_id);
create index if not exists idx_vcl_class on public.video_class_levels       (class_level_id);


-- ------------------------------------------------------------
-- 4. ROW LEVEL SECURITY  — public read, admin-only writes.
--    Mirrors the existing pattern; is_admin() comes from admin_policies.sql.
-- ------------------------------------------------------------
alter table public.learning_goals          enable row level security;
alter table public.boards                  enable row level security;
alter table public.class_levels            enable row level security;
alter table public.playlist_learning_goals enable row level security;
alter table public.video_learning_goals    enable row level security;
alter table public.playlist_class_levels   enable row level security;
alter table public.video_class_levels      enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'learning_goals','boards','class_levels',
    'playlist_learning_goals','video_learning_goals',
    'playlist_class_levels','video_class_levels'
  ] loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select using (true)', t);
    execute format('drop policy if exists "admin inserts" on public.%I', t);
    execute format('create policy "admin inserts" on public.%I for insert to authenticated with check (public.is_admin())', t);
    execute format('drop policy if exists "admin deletes" on public.%I', t);
    execute format('create policy "admin deletes" on public.%I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;


-- ------------------------------------------------------------
-- 5. BACKFILL from the existing data (idempotent)
-- ------------------------------------------------------------

-- 5a. Learning goals from the current single category_id.
--     categories.name (JEE/NEET/Olympiad) matches learning_goals.name.
insert into public.video_learning_goals (video_id, learning_goal_id)
select v.id, lg.id
from public.videos v
join public.categories c      on c.id = v.category_id
join public.learning_goals lg on lg.name = c.name
on conflict do nothing;

insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
select p.id, lg.id
from public.playlists p
join public.categories c      on c.id = p.category_id
join public.learning_goals lg on lg.name = c.name
on conflict do nothing;

-- 5b. Class levels from the existing playlists.class_levels text[] array,
--     mapping the old labels ("11th","Dropper") to the new rows.
--     (Currently every array is empty, so this inserts nothing yet — it's
--     here so the migration stays correct once content gets tagged.)
insert into public.playlist_class_levels (playlist_id, class_level_id)
select p.id, cl.id
from public.playlists p
cross join lateral unnest(p.class_levels) as label
join public.class_levels cl on cl.slug = case lower(label)
    when '10th'    then 'class-10'
    when '11th'    then 'class-11'
    when '12th'    then 'class-12'
    when 'dropper' then 'dropper'
    else null
end
on conflict do nothing;

-- 5c. A video's class levels = the union of the classes of the playlists
--     that contain it (videos carry no class of their own yet).
insert into public.video_class_levels (video_id, class_level_id)
select distinct pv.video_id, pcl.class_level_id
from public.playlist_videos pv
join public.playlist_class_levels pcl on pcl.playlist_id = pv.playlist_id
on conflict do nothing;


-- ------------------------------------------------------------
-- 6. CHECK  — run these after to see what landed:
--     select name, (select count(*) from public.video_learning_goals v where v.learning_goal_id = lg.id) as videos
--       from public.learning_goals lg order by display_order;
--     select * from public.class_levels order by display_order;
-- ------------------------------------------------------------
