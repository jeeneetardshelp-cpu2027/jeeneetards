-- ============================================================================
-- POLLS v1 -- student polls with approval, voting, comments and sharing.
--
-- This is a review/staging candidate, not production authorization. It
-- creates no public navigation and starts in mode `off`, exactly like
-- forum_v1.sql did.
--
-- WHY THIS IS A SEPARATE MODULE AND NOT A FORUM POST TYPE
-- A poll is structurally a forum post with options attached, and building it
-- that way would have inherited forum_comments, forum_votes, forum_reports
-- and the moderation queue for free. It was rejected for one reason: the
-- forum is deliberately switched off (forum_mode() = 'off') pending owner and
-- legal review of the community rules, and every forum write path routes
-- through forum_require_open(). Polls would have been unreleasable until that
-- review finished. This module has its own mode switch so the two features
-- can launch independently.
--
-- WHAT IT DOES REUSE, DELIBERATELY
--   * public.profiles / auth.users     -- one identity, one username rule
--   * public.forum_suspensions (READ)  -- a student suspended from the forum
--                                         is also silenced here. A suspension
--                                         is about the person, not the page.
--   * public.forum_topics (READ)       -- one subject taxonomy, not two
--   * public.is_admin()                -- one admin boundary
-- Everything it WRITES is its own, so a rollback is a pure drop and can never
-- corrupt live forum data.
--
-- SECURITY SHAPE (identical to forum_v1)
-- Browser roles get no direct table access at all. RLS is on and default-deny
-- for every table; bounded security-definer RPCs are the only student path,
-- so the mode switch, the rate limits and the moderation state cannot be
-- bypassed by crafting a PostgREST query.
-- ============================================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';

-- Fail closed if the identity/admin/forum prerequisites do not match the
-- reviewed application.
do $polls_v1_deps$
declare missing text[] := '{}'::text[];
begin
  if to_regclass('public.profiles') is null then missing := array_append(missing, 'profiles'); end if;
  if to_regclass('public.forum_topics') is null then missing := array_append(missing, 'forum_topics'); end if;
  if to_regclass('public.forum_suspensions') is null then missing := array_append(missing, 'forum_suspensions'); end if;
  if to_regprocedure('public.is_admin()') is null then missing := array_append(missing, 'is_admin()'); end if;
  if to_regprocedure('auth.uid()') is null then missing := array_append(missing, 'auth.uid()'); end if;
  if to_regclass('auth.users') is null then missing := array_append(missing, 'auth.users'); end if;
  if cardinality(missing) > 0 then
    raise exception 'POLLS v1: missing dependencies: %', array_to_string(missing, ', ');
  end if;
end;
$polls_v1_deps$;

-- --------------------------------------------------------------------------
-- 1. Tables
-- --------------------------------------------------------------------------

create table public.poll_settings (
  id boolean primary key default true check (id),
  mode text not null default 'off' check (mode in ('off', 'read_only', 'open')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.poll_settings (id, mode) values (true, 'off');

-- Hosts a STUDENT may point a picture option at. An arbitrary https URL is a
-- bait-and-switch risk: the submitter can swap the image after an admin has
-- approved the poll, and the audience is 14-18. Admins are not restricted to
-- this list (poll_admin_set_option_image), because an admin choosing a URL is
-- itself the review step.
create table public.poll_image_hosts (
  host text primary key check (host = lower(host) and host ~ '^[a-z0-9.-]+$'),
  note text,
  created_at timestamptz not null default now()
);

-- THE RULE FOR ADDING A HOST, and it is not "is this site reputable":
-- can the STUDENT WHO SUBMITTED THE POLL replace the bytes at that URL after
-- an admin has approved it? If yes, the host does not belong here however
-- respectable it looks. That single question rules out every general-purpose
-- image host -- imgur, postimg, ibb, Google Drive, Dropbox, Discord CDN --
-- because anyone can upload there and swap the file afterwards. The hosts
-- below all serve content the submitter does not control.
--
-- commons.wikimedia.org was REMOVED on 2026-09-01. Its Special:FilePath links
-- redirect into upload.wikimedia.org, which is still allowed, so the useful
-- diagrams remain reachable — but Commons is itself a user-upload surface that
-- carries explicit material, and this audience is 14-18. Losing the redirect
-- form costs a submitter one extra click; allowing it would have put the one
-- genuinely user-generated image host in front of children.
insert into public.poll_image_hosts (host, note) values
  ('i.ytimg.com', 'YouTube video thumbnails -- already the catalogue image source'),
  ('img.youtube.com', 'YouTube thumbnail alias'),
  ('yt3.ggpht.com', 'YouTube channel avatars'),
  ('upload.wikimedia.org', 'Wikimedia -- serves the images for Wikipedia and Commons'),
  ('assets.openstax.org', 'OpenStax CC-BY textbook figures -- physics, chemistry and biology diagrams'),
  ('openstax.org', 'OpenStax apex, for figures not served from the assets subdomain'),
  ('cdn.kastatic.org', 'Khan Academy article and exercise images'),
  ('ncert.nic.in', 'NCERT -- the official syllabus authority these courses follow'),
  ('www.jeeneetard.com', 'This site. Anything an admin puts in public/ is by definition reviewed.'),
  ('jeeneetard.com', 'This site, apex form');

create table public.polls (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  topic_id bigint not null references public.forum_topics(id) on delete restrict,
  question text not null check (char_length(btrim(question)) between 10 and 160),
  detail text check (detail is null or char_length(btrim(detail)) <= 600),
  -- 'pending' is the only status a student submission can be created in.
  status text not null default 'pending'
    check (status in ('pending', 'live', 'rejected', 'closed', 'hidden')),
  author_id uuid references public.profiles(id) on delete set null,
  review_note text check (review_note is null or char_length(btrim(review_note)) <= 500),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  closes_at timestamptz,
  vote_count integer not null default 0 check (vote_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A published poll must have been reviewed. The approval gate is expressed
  -- as a constraint so that no future RPC can accidentally publish an
  -- unreviewed submission.
  check (status not in ('live', 'closed')
         or (reviewed_at is not null and published_at is not null)),
  check (closes_at is null or published_at is null or closes_at > published_at)
);

create table public.poll_options (
  id bigint generated always as identity primary key,
  poll_id bigint not null references public.polls(id) on delete cascade,
  position smallint not null check (position between 1 and 6),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  image_url text check (image_url is null or image_url ~ '^https://[a-z0-9.-]+/'),
  vote_count integer not null default 0 check (vote_count >= 0),
  unique (poll_id, position)
);

-- One vote per student per poll, changeable while the poll is live. The
-- primary key IS the rule -- ballot stuffing is not something an RPC has to
-- remember to check.
create table public.poll_votes (
  poll_id bigint not null references public.polls(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  option_id bigint not null references public.poll_options(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, voter_id)
);

create table public.poll_comments (
  id bigint generated always as identity primary key,
  poll_id bigint not null references public.polls(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 2 and 1500),
  is_removed boolean not null default false,
  removed_by uuid references public.profiles(id) on delete set null,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table public.poll_reports (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('poll', 'comment')),
  poll_id bigint references public.polls(id) on delete cascade,
  comment_id bigint references public.poll_comments(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in
    ('spam', 'abuse', 'personal_information', 'off_topic', 'misinformation', 'other')),
  detail text check (detail is null or char_length(btrim(detail)) <= 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  -- Exactly one target, and it matches the declared type.
  check (
    (target_type = 'poll' and poll_id is not null and comment_id is null)
    or (target_type = 'comment' and comment_id is not null and poll_id is null)
  )
  -- One report per person per thing -- see the two partial unique indexes
  -- below. A plain `unique (reporter_id, target_type, poll_id, comment_id)`
  -- looks like it says that and does NOT: the unused column is NULL, and
  -- Postgres treats NULLs in a unique constraint as distinct, so the same
  -- student could report one poll a hundred times. Caught by
  -- pollsV1Sql.test.js, which asserted a queue of 1 and found 2.
);

-- Append-only, so throttling survives a student deleting their own content.
create table public.poll_rate_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('submit', 'vote', 'comment', 'report')),
  target_id bigint,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 2. Indexes
-- --------------------------------------------------------------------------

create index polls_live_new_idx on public.polls (published_at desc, id desc)
  where status = 'live';
create index polls_live_top_idx on public.polls (vote_count desc, id desc)
  where status = 'live';
create index polls_closing_idx on public.polls (closes_at asc)
  where status = 'live' and closes_at is not null;
create index polls_topic_idx on public.polls (topic_id, published_at desc)
  where status = 'live';
create index polls_review_queue_idx on public.polls (created_at asc)
  where status = 'pending';
create index polls_author_idx on public.polls (author_id, created_at desc);

create index poll_options_poll_idx on public.poll_options (poll_id, position);
create index poll_votes_option_idx on public.poll_votes (option_id);
create index poll_votes_voter_idx on public.poll_votes (voter_id);
create index poll_comments_poll_idx on public.poll_comments (poll_id, created_at desc);
create index poll_comments_author_idx on public.poll_comments (author_id, created_at desc);
create index poll_reports_queue_idx on public.poll_reports (created_at desc) where status = 'open';
create unique index poll_reports_one_per_poll_idx
  on public.poll_reports (reporter_id, poll_id) where target_type = 'poll';
create unique index poll_reports_one_per_comment_idx
  on public.poll_reports (reporter_id, comment_id) where target_type = 'comment';
create index poll_rate_events_limit_idx on public.poll_rate_events (user_id, action, created_at desc);

-- --------------------------------------------------------------------------
-- 3. Counter triggers
--
-- polls.vote_count, poll_options.vote_count and polls.comment_count are
-- maintained ONLY here. Nothing else may write them -- the same rule the
-- catalogue already applies to playlists.average_rating.
-- --------------------------------------------------------------------------

create or replace function public.poll_touch_updated_at()
returns trigger
language plpgsql
as $poll_touch_updated_at$
begin
  new.updated_at := now();
  return new;
end;
$poll_touch_updated_at$;

create trigger polls_touch_updated_at
  before update on public.polls
  for each row execute function public.poll_touch_updated_at();

create or replace function public.poll_apply_vote_delta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $poll_apply_vote_delta$
begin
  if tg_op = 'INSERT' then
    update public.poll_options set vote_count = vote_count + 1 where id = new.option_id;
    update public.polls set vote_count = vote_count + 1 where id = new.poll_id;
  elsif tg_op = 'DELETE' then
    update public.poll_options set vote_count = greatest(vote_count - 1, 0) where id = old.option_id;
    update public.polls set vote_count = greatest(vote_count - 1, 0) where id = old.poll_id;
  elsif old.option_id is distinct from new.option_id then
    -- Changing your mind moves the vote; the poll total is unchanged.
    update public.poll_options set vote_count = greatest(vote_count - 1, 0) where id = old.option_id;
    update public.poll_options set vote_count = vote_count + 1 where id = new.option_id;
  end if;
  return null;
end;
$poll_apply_vote_delta$;

create trigger poll_votes_apply_delta
  after insert or update or delete on public.poll_votes
  for each row execute function public.poll_apply_vote_delta();

create or replace function public.poll_apply_comment_delta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $poll_apply_comment_delta$
declare
  target bigint := coalesce(new.poll_id, old.poll_id);
  was_visible boolean := tg_op <> 'INSERT' and not old.is_removed;
  is_visible boolean := tg_op <> 'DELETE' and not new.is_removed;
begin
  -- comment_count is the count a student sees, so a removed comment must not
  -- be counted -- otherwise "12 comments" renders 11.
  if is_visible and not was_visible then
    update public.polls set comment_count = comment_count + 1 where id = target;
  elsif was_visible and not is_visible then
    update public.polls set comment_count = greatest(comment_count - 1, 0) where id = target;
  end if;
  return null;
end;
$poll_apply_comment_delta$;

create trigger poll_comments_apply_delta
  after insert or update or delete on public.poll_comments
  for each row execute function public.poll_apply_comment_delta();

-- --------------------------------------------------------------------------
-- 4. Mode, identity and throttling gates
-- --------------------------------------------------------------------------

create or replace function public.poll_mode()
returns text
language sql
stable
security definer
set search_path = ''
as $poll_mode$
  select coalesce((select mode from public.poll_settings where id = true), 'off');
$poll_mode$;

create or replace function public.poll_require_open()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $poll_require_open$
begin
  if public.poll_mode() <> 'open' then
    raise exception using errcode = '55000', message = 'polls are not open for contributions';
  end if;
end;
$poll_require_open$;

-- The writer gate. Mirrors forum_require_writer() on purpose: same username
-- rule, same 10-minute account age, and the SAME suspension table, so a
-- student silenced in one place is silenced in both.
create or replace function public.poll_require_writer()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $poll_require_writer$
declare
  uid uuid := auth.uid();
  profile_created timestamptz;
  handle text;
begin
  perform public.poll_require_open();
  if uid is null then
    raise exception using errcode = '42501', message = 'sign in to take part';
  end if;
  select u.created_at, btrim(p.username) into profile_created, handle
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = uid;
  if profile_created is null then
    raise exception using errcode = '42501', message = 'student profile is missing';
  end if;
  if handle is null or handle !~ '^[A-Za-z0-9_]{3,30}$' then
    raise exception using errcode = '22023',
      message = 'choose a 3 to 30 character username before taking part';
  end if;
  if profile_created > now() - interval '10 minutes' then
    raise exception using errcode = 'P0001',
      message = 'new accounts can take part after 10 minutes';
  end if;
  if exists (
    select 1 from public.forum_suspensions s
    where s.user_id = uid and s.suspended_until > now()
  ) then
    raise exception using errcode = '42501', message = 'posting is temporarily suspended';
  end if;
  return uid;
end;
$poll_require_writer$;

-- Voting is a lighter action than publishing text: it needs an account, but
-- not a chosen public username, because a vote is never attributed in public.
create or replace function public.poll_require_voter()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $poll_require_voter$
declare uid uuid := auth.uid();
begin
  perform public.poll_require_open();
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception using errcode = '42501', message = 'sign in to vote';
  end if;
  if exists (
    select 1 from public.forum_suspensions s
    where s.user_id = uid and s.suspended_until > now()
  ) then
    raise exception using errcode = '42501', message = 'voting is temporarily suspended';
  end if;
  return uid;
end;
$poll_require_voter$;

-- Reporting is a safety action, not ordinary publishing. It stays available
-- in read-only mode, and a posting suspension must not silence a reporter.
create or replace function public.poll_require_reporter()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $poll_require_reporter$
declare uid uuid := auth.uid();
begin
  if public.poll_mode() = 'off' then
    raise exception using errcode = '55000', message = 'polls are unavailable';
  end if;
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception using errcode = '42501', message = 'sign in to report content';
  end if;
  return uid;
end;
$poll_require_reporter$;

create or replace function public.poll_record_rate_event(
  p_user_id uuid,
  p_action text,
  p_target_id bigint,
  p_hour_limit integer,
  p_day_limit integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $poll_record_rate_event$
begin
  if p_hour_limit is not null and (
    select count(*) from public.poll_rate_events e
    where e.user_id = p_user_id and e.action = p_action
      and e.created_at >= now() - interval '1 hour'
  ) >= p_hour_limit then
    raise exception using errcode = 'P0001',
      message = p_action || ' hourly rate limit exceeded';
  end if;
  if p_day_limit is not null and (
    select count(*) from public.poll_rate_events e
    where e.user_id = p_user_id and e.action = p_action
      and e.created_at >= now() - interval '1 day'
  ) >= p_day_limit then
    raise exception using errcode = 'P0001',
      message = p_action || ' daily rate limit exceeded';
  end if;
  insert into public.poll_rate_events (user_id, action, target_id)
  values (p_user_id, p_action, p_target_id);
end;
$poll_record_rate_event$;

-- --------------------------------------------------------------------------
-- 5. Helpers
-- --------------------------------------------------------------------------

create or replace function public.poll_slugify(p_text text)
returns text
language sql
immutable
as $poll_slugify$
  select coalesce(
    nullif(
      btrim(
        regexp_replace(
          regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'),
          '(^-+|-+$)', '', 'g'
        ),
        '-'
      ),
      ''
    ),
    'poll'
  );
$poll_slugify$;

create or replace function public.poll_image_host_allowed(p_url text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $poll_image_host_allowed$
  -- Require the host to be immediately followed by '/' or end-of-string, NOT
  -- ':'. Stopping at ':' let a userinfo URL like
  -- "https://i.ytimg.com:80@evil.com/x" extract "i.ytimg.com" and pass, even
  -- though a browser resolves that to evil.com. The poll_options.image_url
  -- column CHECK also rejects such a URL, but this function must be safe on its
  -- own so a future caller that skips the column cannot be fooled.
  select p_url is null
    or exists (
      select 1 from public.poll_image_hosts h
      where h.host = lower(substring(p_url from '^https://([a-z0-9.-]+)(?:/|$)'))
    );
$poll_image_host_allowed$;

-- Results stay hidden until the viewer has voted. This is enforced HERE and
-- not in React: sending every option's count to a browser that then chooses
-- not to draw it is not hiding anything.
-- Takes an id rather than a `public.polls` row on purpose. A composite-typed
-- parameter forces every caller to cast a CTE row back to the table type,
-- which is exactly the kind of thing that works in one query and breaks in
-- the next one someone writes.
-- THE one definition of "this poll is closed", used by every read path.
--
-- A poll can be closed two ways: an admin sets status='closed', or its
-- closes_at passes. Nothing transitions the column when time runs out, so the
-- column alone is not the answer -- and when different code answered this
-- question differently, an expired poll became a permanent dead end (voting
-- blocked by closes_at, results still hidden because status was 'live').
-- Every caller now shares this function so the two notions cannot drift apart
-- again. poll_admin_close_expired() below makes the stored column catch up,
-- but correctness must not depend on that having run.
create or replace function public.poll_is_effectively_closed(
  p_status text,
  p_closes_at timestamptz
)
returns boolean
language sql
stable
as $poll_is_effectively_closed$
  select p_status = 'closed'
      or (p_status = 'live' and p_closes_at is not null and p_closes_at <= now());
$poll_is_effectively_closed$;

create or replace function public.poll_results_visible(
  p_poll_id bigint,
  p_viewer uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $poll_results_visible$
  select coalesce(
    (select public.poll_is_effectively_closed(p.status, p.closes_at)
     from public.polls p where p.id = p_poll_id),
    false
  )
  or (p_viewer is not null and (
    exists (select 1 from public.poll_votes v
            where v.poll_id = p_poll_id and v.voter_id = p_viewer)
    or exists (select 1 from public.profiles p
               where p.id = p_viewer and p.is_admin)
  ));
$poll_results_visible$;

-- The options payload every read RPC returns. `vote_count` and `share` are
-- null until results are visible.
create or replace function public.poll_options_json(
  p_poll_id bigint,
  p_viewer uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $poll_options_json$
  with ctx as (
    select
      public.poll_results_visible(p_poll_id, p_viewer) as visible,
      coalesce((select p.vote_count from public.polls p where p.id = p_poll_id), 0) as total,
      (select v.option_id from public.poll_votes v
       where v.poll_id = p_poll_id and v.voter_id = p_viewer) as viewer_option
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'position', o.position,
        'label', o.label,
        'image_url', o.image_url,
        'vote_count', case when ctx.visible then o.vote_count else null end,
        'share', case
          when not ctx.visible then null
          when ctx.total = 0 then 0
          else round((o.vote_count::numeric * 100) / ctx.total, 1)
        end,
        'viewer_choice', coalesce(o.id = ctx.viewer_option, false)
      )
      order by o.position
    ),
    '[]'::jsonb
  )
  from public.poll_options o
  cross join ctx
  where o.poll_id = p_poll_id;
$poll_options_json$;

-- --------------------------------------------------------------------------
-- 6. Read RPCs
--
-- Pagination is limit/offset, not the forum's keyset cursor. Deliberate: a
-- poll feed is tens of rows, not thousands, and every sort here is over an
-- indexed partial index. Revisit if the live poll count ever passes ~500.
-- --------------------------------------------------------------------------

create or replace function public.get_poll_topics()
returns table (slug text, name text, kind text, description text)
language sql
stable
security definer
set search_path = ''
as $get_poll_topics$
  select t.slug, t.name, t.kind, t.description
  from public.forum_topics t
  where t.is_active
  order by t.display_order, t.name;
$get_poll_topics$;

create or replace function public.get_polls_feed(
  p_sort text default 'new',
  p_topic_slug text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id bigint,
  slug text,
  question text,
  detail text,
  topic_slug text,
  topic_name text,
  author_username text,
  status text,
  published_at timestamptz,
  closes_at timestamptz,
  vote_count integer,
  comment_count integer,
  viewer_option_id bigint,
  results_visible boolean,
  options jsonb
)
language sql
stable
security definer
set search_path = ''
as $get_polls_feed$
  with viewer as (select auth.uid() as uid),
  filtered as (
    select p.*
    from public.polls p
    join public.forum_topics t on t.id = p.topic_id
    where public.poll_mode() <> 'off'
      and p.status in ('live', 'closed')
      and (p_topic_slug is null or t.slug = p_topic_slug)
  )
  select
    f.id,
    f.slug,
    f.question,
    f.detail,
    t.slug,
    t.name,
    pr.username,
    -- The EFFECTIVE status, not the stored column: a poll whose closes_at has
    -- passed reads as 'closed' to every client, whether or not
    -- poll_admin_close_expired() has run yet.
    case when public.poll_is_effectively_closed(f.status, f.closes_at)
         then 'closed' else f.status end,
    f.published_at,
    f.closes_at,
    f.vote_count,
    f.comment_count,
    (select v.option_id from public.poll_votes v, viewer
     where v.poll_id = f.id and v.voter_id = viewer.uid),
    public.poll_results_visible(f.id, (select uid from viewer)),
    public.poll_options_json(f.id, (select uid from viewer))
  from filtered f
  join public.forum_topics t on t.id = f.topic_id
  left join public.profiles pr on pr.id = f.author_id
  order by
    case when p_sort = 'top' then f.vote_count end desc nulls last,
    case when p_sort = 'closing' then f.closes_at end asc nulls last,
    f.published_at desc,
    f.id desc
  limit greatest(least(coalesce(p_limit, 20), 50), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$get_polls_feed$;

create or replace function public.get_poll(p_slug text)
returns table (
  id bigint,
  slug text,
  question text,
  detail text,
  topic_slug text,
  topic_name text,
  author_username text,
  status text,
  published_at timestamptz,
  closes_at timestamptz,
  vote_count integer,
  comment_count integer,
  viewer_option_id bigint,
  results_visible boolean,
  can_vote boolean,
  options jsonb
)
language sql
stable
security definer
set search_path = ''
as $get_poll$
  with viewer as (select auth.uid() as uid)
  select
    p.id,
    p.slug,
    p.question,
    p.detail,
    t.slug,
    t.name,
    pr.username,
    -- Effective status, as in get_polls_feed: an expired poll reads 'closed'.
    case when public.poll_is_effectively_closed(p.status, p.closes_at)
         then 'closed' else p.status end,
    p.published_at,
    p.closes_at,
    p.vote_count,
    p.comment_count,
    (select v.option_id from public.poll_votes v, viewer
     where v.poll_id = p.id and v.voter_id = viewer.uid),
    public.poll_results_visible(p.id, (select uid from viewer)),
    p.status = 'live'
      and (p.closes_at is null or p.closes_at > now())
      and public.poll_mode() = 'open',
    public.poll_options_json(p.id, (select uid from viewer))
  from public.polls p
  join public.forum_topics t on t.id = p.topic_id
  left join public.profiles pr on pr.id = p.author_id
  where p.slug = p_slug
    and public.poll_mode() <> 'off'
    and p.status in ('live', 'closed');
$get_poll$;

create or replace function public.get_poll_comments(
  p_poll_id bigint,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id bigint,
  author_username text,
  body text,
  created_at timestamptz,
  edited_at timestamptz,
  is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $get_poll_comments$
  select
    c.id,
    pr.username,
    c.body,
    c.created_at,
    c.edited_at,
    c.author_id is not null and c.author_id = auth.uid()
  from public.poll_comments c
  join public.polls p on p.id = c.poll_id
  left join public.profiles pr on pr.id = c.author_id
  where c.poll_id = p_poll_id
    and not c.is_removed
    and public.poll_mode() <> 'off'
    and p.status in ('live', 'closed')
  order by c.created_at desc, c.id desc
  limit greatest(least(coalesce(p_limit, 100), 200), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$get_poll_comments$;

-- A student's own submissions, whatever their status -- so "waiting for
-- review" and "not approved, here is why" are visible to the person who
-- wrote them and to nobody else.
create or replace function public.get_my_poll_submissions()
returns table (
  id bigint,
  slug text,
  question text,
  status text,
  review_note text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $get_my_poll_submissions$
  select p.id, p.slug, p.question, p.status, p.review_note, p.created_at, p.reviewed_at
  from public.polls p
  where p.author_id = auth.uid() and auth.uid() is not null
  order by p.created_at desc
  limit 50;
$get_my_poll_submissions$;

-- --------------------------------------------------------------------------
-- 7. Student write RPCs
-- --------------------------------------------------------------------------

-- Submit a poll for review. Always lands as 'pending'; nothing here can
-- publish. Options arrive as [{"label": "...", "image_url": "..."}].
create or replace function public.poll_submit(
  p_topic_slug text,
  p_question text,
  p_detail text,
  p_options jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $poll_submit$
declare
  uid uuid := public.poll_require_writer();
  topic bigint;
  option_count integer;
  new_id bigint;
  item jsonb;
  idx smallint := 0;
  label text;
  image text;
begin
  select id into topic from public.forum_topics
  where slug = p_topic_slug and is_active;
  if topic is null then
    raise exception using errcode = '22023', message = 'choose a subject for this poll';
  end if;

  if jsonb_typeof(p_options) <> 'array' then
    raise exception using errcode = '22023', message = 'options must be a list';
  end if;
  option_count := jsonb_array_length(p_options);
  if option_count < 2 or option_count > 6 then
    raise exception using errcode = '22023', message = 'a poll needs between 2 and 6 options';
  end if;

  -- Two a day. A poll costs an admin a review, so the limit is about the
  -- reviewer's time as much as about abuse.
  perform public.poll_record_rate_event(uid, 'submit', null, 2, 2);

  insert into public.polls (slug, topic_id, question, detail, author_id, status)
  values ('pending-submission', topic, btrim(p_question),
          nullif(btrim(coalesce(p_detail, '')), ''), uid, 'pending')
  returning id into new_id;

  -- The slug is derived after the insert so it can carry the id and never
  -- collide, even when two students ask the same question. rtrim the trailing
  -- hyphen: poll_slugify strips edge hyphens, but the 60-char left() can cut on
  -- an internal one, and then '-' || id would make '--', which violates the
  -- slug CHECK and aborts a perfectly valid submission with a raw error.
  update public.polls
  set slug = rtrim(left(public.poll_slugify(btrim(p_question)), 60), '-') || '-' || new_id::text
  where id = new_id;

  for item in select * from jsonb_array_elements(p_options) loop
    idx := idx + 1;
    label := btrim(coalesce(item->>'label', ''));
    image := nullif(btrim(coalesce(item->>'image_url', '')), '');
    if label = '' then
      raise exception using errcode = '22023', message = 'every option needs a label';
    end if;
    if image is not null and not public.poll_image_host_allowed(image) then
      raise exception using errcode = '22023',
        message = 'picture links must come from an approved image host';
    end if;
    insert into public.poll_options (poll_id, position, label, image_url)
    values (new_id, idx, label, image);
  end loop;

  return new_id;
end;
$poll_submit$;

create or replace function public.poll_cast_vote(p_poll_id bigint, p_option_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $poll_cast_vote$
declare
  uid uuid := public.poll_require_voter();
  poll_row public.polls;
begin
  select * into poll_row from public.polls where id = p_poll_id;
  if poll_row.id is null or poll_row.status <> 'live' then
    raise exception using errcode = '55000', message = 'this poll is not accepting votes';
  end if;
  if poll_row.closes_at is not null and poll_row.closes_at <= now() then
    raise exception using errcode = '55000', message = 'this poll has closed';
  end if;
  if not exists (
    select 1 from public.poll_options o where o.id = p_option_id and o.poll_id = p_poll_id
  ) then
    raise exception using errcode = '22023', message = 'that option does not belong to this poll';
  end if;

  perform public.poll_record_rate_event(uid, 'vote', p_poll_id, 60, 300);

  insert into public.poll_votes (poll_id, voter_id, option_id)
  values (p_poll_id, uid, p_option_id)
  on conflict (poll_id, voter_id)
  do update set option_id = excluded.option_id, updated_at = now();
end;
$poll_cast_vote$;

create or replace function public.poll_clear_vote(p_poll_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $poll_clear_vote$
declare uid uuid := public.poll_require_voter();
begin
  delete from public.poll_votes where poll_id = p_poll_id and voter_id = uid;
end;
$poll_clear_vote$;

create or replace function public.poll_add_comment(p_poll_id bigint, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $poll_add_comment$
declare
  uid uuid := public.poll_require_writer();
  poll_status text;
  new_id bigint;
begin
  select status into poll_status from public.polls where id = p_poll_id;
  if poll_status is null or poll_status not in ('live', 'closed') then
    raise exception using errcode = '55000', message = 'this poll is not open for comments';
  end if;

  perform public.poll_record_rate_event(uid, 'comment', p_poll_id, 10, 40);

  insert into public.poll_comments (poll_id, author_id, body)
  values (p_poll_id, uid, btrim(p_body))
  returning id into new_id;
  return new_id;
end;
$poll_add_comment$;

create or replace function public.poll_edit_comment(p_comment_id bigint, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $poll_edit_comment$
declare uid uuid := public.poll_require_writer();
begin
  update public.poll_comments
  set body = btrim(p_body), edited_at = now()
  where id = p_comment_id and author_id = uid and not is_removed;
  if not found then
    raise exception using errcode = '42501', message = 'you can only edit your own comment';
  end if;
end;
$poll_edit_comment$;

create or replace function public.poll_delete_comment(p_comment_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $poll_delete_comment$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'sign in first';
  end if;
  -- Deleting your own words stays possible even in read_only mode and while
  -- suspended. Taking something back is not a contribution.
  delete from public.poll_comments where id = p_comment_id and author_id = uid;
  if not found then
    raise exception using errcode = '42501', message = 'you can only delete your own comment';
  end if;
end;
$poll_delete_comment$;

create or replace function public.poll_submit_report(
  p_target_type text,
  p_target_id bigint,
  p_reason text,
  p_detail text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $poll_submit_report$
declare uid uuid := public.poll_require_reporter();
begin
  if p_target_type not in ('poll', 'comment') then
    raise exception using errcode = '22023', message = 'unknown report target';
  end if;

  perform public.poll_record_rate_event(uid, 'report', p_target_id, 10, 30);

  if p_target_type = 'poll' then
    if not exists (select 1 from public.polls where id = p_target_id) then
      raise exception using errcode = '22023', message = 'that poll no longer exists';
    end if;
    insert into public.poll_reports (target_type, poll_id, reporter_id, reason, detail)
    values ('poll', p_target_id, uid, p_reason, nullif(btrim(coalesce(p_detail, '')), ''))
    on conflict do nothing;
  else
    if not exists (select 1 from public.poll_comments where id = p_target_id) then
      raise exception using errcode = '22023', message = 'that comment no longer exists';
    end if;
    insert into public.poll_reports (target_type, comment_id, reporter_id, reason, detail)
    values ('comment', p_target_id, uid, p_reason, nullif(btrim(coalesce(p_detail, '')), ''))
    on conflict do nothing;
  end if;
end;
$poll_submit_report$;

-- --------------------------------------------------------------------------
-- 8. Admin RPCs
-- --------------------------------------------------------------------------

create or replace function public.poll_admin_set_mode(p_mode text)
returns text
language plpgsql
security definer
set search_path = ''
as $poll_admin_set_mode$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;
  if p_mode not in ('off', 'read_only', 'open') then
    raise exception using errcode = '22023', message = 'unknown poll mode';
  end if;
  update public.poll_settings
  set mode = p_mode, updated_at = now(), updated_by = auth.uid()
  where id = true;
  return p_mode;
end;
$poll_admin_set_mode$;

-- The review queue: everything waiting, with its options, so an admin can
-- read the question AND see the picture links before approving.
create or replace function public.poll_admin_list_pending(p_limit integer default 50)
returns table (
  id bigint,
  slug text,
  question text,
  detail text,
  topic_slug text,
  topic_name text,
  author_username text,
  created_at timestamptz,
  options jsonb
)
language sql
stable
security definer
set search_path = ''
as $poll_admin_list_pending$
  select
    p.id, p.slug, p.question, p.detail, t.slug, t.name, pr.username, p.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'position', o.position, 'label', o.label, 'image_url', o.image_url
      ) order by o.position)
      from public.poll_options o where o.poll_id = p.id
    ), '[]'::jsonb)
  from public.polls p
  join public.forum_topics t on t.id = p.topic_id
  left join public.profiles pr on pr.id = p.author_id
  where public.is_admin() and p.status = 'pending'
  order by p.created_at asc
  limit greatest(least(coalesce(p_limit, 50), 200), 1);
$poll_admin_list_pending$;

create or replace function public.poll_admin_review(
  p_poll_id bigint,
  p_decision text,
  p_note text default null,
  p_closes_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $poll_admin_review$
declare current_status text;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception using errcode = '22023', message = 'decision must be approve or reject';
  end if;
  select status into current_status from public.polls where id = p_poll_id;
  if current_status is null then
    raise exception using errcode = '22023', message = 'that poll no longer exists';
  end if;
  if current_status <> 'pending' then
    raise exception using errcode = '55000', message = 'this poll has already been reviewed';
  end if;
  if p_decision = 'reject' and nullif(btrim(coalesce(p_note, '')), '') is null then
    -- A rejection the student cannot learn from is just a silent deletion.
    raise exception using errcode = '22023', message = 'a rejection needs a short reason';
  end if;

  -- The status = 'pending' predicate makes two concurrent reviews resolve
  -- deterministically: the SELECT guard above can pass for both callers, but
  -- only the first UPDATE matches, and the loser falls into the not-found
  -- branch instead of silently overwriting the winner's decision.
  update public.polls
  set status = case when p_decision = 'approve' then 'live' else 'rejected' end,
      review_note = nullif(btrim(coalesce(p_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      published_at = case when p_decision = 'approve' then now() else null end,
      closes_at = case when p_decision = 'approve' then p_closes_at else null end
  where id = p_poll_id and status = 'pending';

  if not found then
    raise exception using errcode = '55000', message = 'this poll has already been reviewed';
  end if;

  return p_decision;
end;
$poll_admin_review$;

-- Persist the time-based transition the read paths already apply.
--
-- Reads are correct without this (poll_is_effectively_closed), so nothing
-- breaks if it never runs -- but the stored column would stay 'live' forever
-- on an expired poll, which misleads anyone querying the table directly and
-- keeps expired polls out of any status-based admin view. Idempotent by
-- construction: the WHERE clause matches nothing on a second run.
--
-- Returns the polls it closed so the caller can report a real number instead
-- of claiming success blindly. Safe to call from a scheduled job (pg_cron) or
-- by hand from the admin panel; see the activation runbook.
create or replace function public.poll_admin_close_expired()
returns table (id bigint, question text, closed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $poll_admin_close_expired$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;

  return query
  update public.polls p
  set status = 'closed'
  where p.status = 'live'
    and p.closes_at is not null
    and p.closes_at <= now()
  returning p.id, p.question, p.closes_at;
end;
$poll_admin_close_expired$;

-- Close (stop voting, keep it readable) or hide (take it off the site).
create or replace function public.poll_admin_set_status(p_poll_id bigint, p_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $poll_admin_set_status$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;
  if p_status not in ('live', 'closed', 'hidden') then
    raise exception using errcode = '22023', message = 'unknown poll status';
  end if;
  -- published_at, not just reviewed_at. A REJECTED poll has been reviewed but
  -- never published, and letting this RPC set it 'live' would trip the table
  -- CHECK and surface a raw constraint violation to an admin. Publishing a
  -- rejected submission is a re-review, not a status change.
  update public.polls set status = p_status where id = p_poll_id
    and reviewed_at is not null and published_at is not null;
  if not found then
    raise exception using errcode = '22023',
      message = 'only a published poll can be closed, hidden or restored';
  end if;
  return p_status;
end;
$poll_admin_set_status$;

-- An admin may set any https picture, allowlist or not: choosing that URL is
-- itself the review. The column CHECK still rejects a non-https link.
create or replace function public.poll_admin_set_option_image(
  p_option_id bigint,
  p_image_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $poll_admin_set_option_image$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;
  update public.poll_options
  set image_url = nullif(btrim(coalesce(p_image_url, '')), '')
  where id = p_option_id;
end;
$poll_admin_set_option_image$;

create or replace function public.poll_admin_set_comment_removed(
  p_comment_id bigint,
  p_removed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $poll_admin_set_comment_removed$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;
  update public.poll_comments
  set is_removed = p_removed,
      removed_by = case when p_removed then auth.uid() else null end,
      removed_at = case when p_removed then now() else null end
  where id = p_comment_id;
end;
$poll_admin_set_comment_removed$;

create or replace function public.poll_admin_list_reports(p_limit integer default 100)
returns table (
  id bigint,
  target_type text,
  poll_id bigint,
  poll_slug text,
  poll_question text,
  comment_id bigint,
  comment_body text,
  comment_removed boolean,
  reporter_username text,
  reason text,
  detail text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $poll_admin_list_reports$
  select
    r.id, r.target_type,
    coalesce(r.poll_id, c.poll_id),
    tp.slug, tp.question,
    r.comment_id, c.body, c.is_removed,
    pr.username, r.reason, r.detail, r.status, r.created_at
  from public.poll_reports r
  left join public.poll_comments c on c.id = r.comment_id
  left join public.polls tp on tp.id = coalesce(r.poll_id, c.poll_id)
  left join public.profiles pr on pr.id = r.reporter_id
  where public.is_admin() and r.status = 'open'
  order by r.created_at desc
  limit greatest(least(coalesce(p_limit, 100), 200), 1);
$poll_admin_list_reports$;

create or replace function public.poll_admin_resolve_report(
  p_report_id bigint,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $poll_admin_resolve_report$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;
  if p_status not in ('actioned', 'dismissed') then
    raise exception using errcode = '22023', message = 'unknown report resolution';
  end if;
  update public.poll_reports
  set status = p_status, resolved_by = auth.uid(), resolved_at = now()
  where id = p_report_id and status = 'open';
end;
$poll_admin_resolve_report$;

-- Repair tool, for the same reason forum_recount_metrics() exists: trigger
-- maintained counters need an auditable way to prove they are still right.
create or replace function public.poll_recount_metrics(p_apply boolean default false)
returns table (scope text, id bigint, stored integer, actual integer)
language plpgsql
security definer
set search_path = ''
as $poll_recount_metrics$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin only';
  end if;

  -- Report first, into a temp table, so the caller always sees the drift that
  -- WAS there even when p_apply then repairs it.
  create temporary table poll_recount_drift on commit drop as
  select 'option_votes'::text as scope, o.id,
         o.vote_count as stored,
         (select count(*)::integer from public.poll_votes v where v.option_id = o.id) as actual
  from public.poll_options o
  union all
  select 'poll_votes', p.id, p.vote_count,
         (select count(*)::integer from public.poll_votes v where v.poll_id = p.id)
  from public.polls p
  union all
  select 'poll_comments', p.id, p.comment_count,
         (select count(*)::integer from public.poll_comments c
          where c.poll_id = p.id and not c.is_removed)
  from public.polls p;

  delete from poll_recount_drift d where d.stored = d.actual;

  if p_apply then
    update public.poll_options o set vote_count = d.actual
    from poll_recount_drift d where d.scope = 'option_votes' and o.id = d.id;
    update public.polls p set vote_count = d.actual
    from poll_recount_drift d where d.scope = 'poll_votes' and p.id = d.id;
    update public.polls p set comment_count = d.actual
    from poll_recount_drift d where d.scope = 'poll_comments' and p.id = d.id;
  end if;

  return query select d.scope, d.id, d.stored, d.actual from poll_recount_drift d
  order by d.scope, d.id;
end;
$poll_recount_metrics$;

-- --------------------------------------------------------------------------
-- 9. Row level security -- default deny on every table
--
-- No policy grants anything to anon or authenticated. The RPCs above are
-- security definer, so they are the ONLY student path. Admin-visible SELECT
-- policies exist purely so the Supabase dashboard is usable.
-- --------------------------------------------------------------------------

alter table public.poll_settings enable row level security;
alter table public.poll_image_hosts enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.poll_comments enable row level security;
alter table public.poll_reports enable row level security;
alter table public.poll_rate_events enable row level security;

create policy "poll admins inspect settings" on public.poll_settings
  for select to authenticated using (public.is_admin());
create policy "poll admins inspect image hosts" on public.poll_image_hosts
  for select to authenticated using (public.is_admin());
create policy "poll admins inspect polls" on public.polls
  for select to authenticated using (public.is_admin());
create policy "poll admins inspect options" on public.poll_options
  for select to authenticated using (public.is_admin());
create policy "poll admins inspect votes" on public.poll_votes
  for select to authenticated using (public.is_admin());
create policy "poll admins inspect comments" on public.poll_comments
  for select to authenticated using (public.is_admin());
create policy "poll admins inspect reports" on public.poll_reports
  for select to authenticated using (public.is_admin());

-- --------------------------------------------------------------------------
-- 10. Grants
-- --------------------------------------------------------------------------

revoke all on public.poll_settings from anon, authenticated;
revoke all on public.poll_image_hosts from anon, authenticated;
revoke all on public.polls from anon, authenticated;
revoke all on public.poll_options from anon, authenticated;
revoke all on public.poll_votes from anon, authenticated;
revoke all on public.poll_comments from anon, authenticated;
revoke all on public.poll_reports from anon, authenticated;
revoke all on public.poll_rate_events from anon, authenticated;

-- Internal helpers: never callable from a browser.
revoke all on function public.poll_require_open() from public, anon, authenticated;
revoke all on function public.poll_require_writer() from public, anon, authenticated;
revoke all on function public.poll_require_voter() from public, anon, authenticated;
revoke all on function public.poll_require_reporter() from public, anon, authenticated;
revoke all on function public.poll_record_rate_event(uuid, text, bigint, integer, integer)
  from public, anon, authenticated;
revoke all on function public.poll_is_effectively_closed(text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.poll_results_visible(bigint, uuid)
  from public, anon, authenticated;
revoke all on function public.poll_options_json(bigint, uuid)
  from public, anon, authenticated;
revoke all on function public.poll_image_host_allowed(text) from public, anon, authenticated;
revoke all on function public.poll_slugify(text) from public, anon, authenticated;

-- Public reads: browsing a poll never requires an account.
grant execute on function public.poll_mode() to anon, authenticated;
grant execute on function public.get_poll_topics() to anon, authenticated;
grant execute on function public.get_polls_feed(text, text, integer, integer) to anon, authenticated;
grant execute on function public.get_poll(text) to anon, authenticated;
grant execute on function public.get_poll_comments(bigint, integer, integer) to anon, authenticated;

-- Taking part requires an account.
grant execute on function public.get_my_poll_submissions() to authenticated;
grant execute on function public.poll_submit(text, text, text, jsonb) to authenticated;
grant execute on function public.poll_cast_vote(bigint, bigint) to authenticated;
grant execute on function public.poll_clear_vote(bigint) to authenticated;
grant execute on function public.poll_add_comment(bigint, text) to authenticated;
grant execute on function public.poll_edit_comment(bigint, text) to authenticated;
grant execute on function public.poll_delete_comment(bigint) to authenticated;
grant execute on function public.poll_submit_report(text, bigint, text, text) to authenticated;

-- Admin RPCs are granted to authenticated but every one of them re-checks
-- is_admin() internally; the grant is not the boundary.
grant execute on function public.poll_admin_set_mode(text) to authenticated;
grant execute on function public.poll_admin_list_pending(integer) to authenticated;
grant execute on function public.poll_admin_review(bigint, text, text, timestamptz) to authenticated;
grant execute on function public.poll_admin_set_status(bigint, text) to authenticated;
grant execute on function public.poll_admin_close_expired() to authenticated;
grant execute on function public.poll_admin_set_option_image(bigint, text) to authenticated;
grant execute on function public.poll_admin_set_comment_removed(bigint, boolean) to authenticated;
grant execute on function public.poll_admin_list_reports(integer) to authenticated;
grant execute on function public.poll_admin_resolve_report(bigint, text) to authenticated;
grant execute on function public.poll_recount_metrics(boolean) to authenticated;

commit;
