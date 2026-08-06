-- ============================================================================
-- FORUM v1 ROLLBACK-ALWAYS STAGING REHEARSAL
-- DISPOSABLE STAGING ONLY. NEVER RUN ON PRODUCTION.
--
-- Exact core SHA-256: 9fcf733655cd268589915254078c1e1d6d68da5fd252d5b9d73b290b283d9866
-- Generated from the reviewed preflight, core and postflight sources.
-- The core/postflight transaction wrappers are removed only so this entire
-- rehearsal can end in one unconditional ROLLBACK.
--
-- Requirements:
--   * public.app_environment has exactly the staging marker
--   * at least one existing admin profile linked to auth.users
--   * at least four non-admin profiles linked to auth.users and older than 10m
--
-- The selected usernames are changed only inside this transaction. Every
-- schema object, fixture row, username change and forum action is rolled back.
-- If the SQL client stops on an error, execute ROLLBACK immediately.
-- ============================================================================

-- Exact read-only preflight runs before the rehearsal transaction.
-- FORUM v1 read-only preflight.
-- Run against the intended target before forum_v1.sql. It changes nothing and
-- refuses a partial/previous forum installation rather than guessing at drift.

begin transaction read only;

do $$
declare
  missing text[] := '{}'::text[];
  existing text[] := '{}'::text[];
  object_name text;
begin
  if to_regclass('public.profiles') is null then
    missing := array_append(missing, 'public.profiles');
  end if;
  if to_regprocedure('public.is_admin()') is null then
    missing := array_append(missing, 'public.is_admin()');
  end if;
  if to_regprocedure('auth.uid()') is null then
    missing := array_append(missing, 'auth.uid()');
  end if;
  if to_regprocedure('auth.role()') is null then
    missing := array_append(missing, 'auth.role()');
  end if;
  if to_regclass('auth.users') is null then
    missing := array_append(missing, 'auth.users');
  end if;

  if to_regclass('public.profiles') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'id' and udt_name = 'uuid'
    ) then missing := array_append(missing, 'profiles.id uuid'); end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'username'
    ) then missing := array_append(missing, 'profiles.username'); end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'created_at'
    ) then missing := array_append(missing, 'profiles.created_at'); end if;
  end if;

  foreach object_name in array array[
    'forum_settings', 'forum_topics', 'forum_posts', 'forum_comments',
    'forum_votes', 'forum_user_stats', 'forum_reports',
    'forum_moderation_log', 'forum_suspensions', 'forum_rate_events'
  ] loop
    if to_regclass('public.' || object_name) is not null then
      existing := array_append(existing, object_name);
    end if;
  end loop;

  if cardinality(missing) > 0 then
    raise exception 'FORUM v1 PREFLIGHT: missing dependencies: %',
      array_to_string(missing, ', ');
  end if;
  if cardinality(existing) > 0 then
    raise exception 'FORUM v1 PREFLIGHT: existing forum objects require drift review: %',
      array_to_string(existing, ', ');
  end if;
end;
$$;

select
  current_database() as database_name,
  to_regclass('public.profiles') is not null as profiles_ready,
  to_regprocedure('public.is_admin()') is not null as admin_guard_ready,
  false as database_changed;

commit;


begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $forum_stage_guard$
declare environment_count integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;
  select count(*) into environment_count
  from public.app_environment where id = true and lower(name) = 'staging';
  if environment_count <> 1 then
    raise exception 'REFUSING: forum rehearsal requires exactly one staging marker';
  end if;
  if to_regclass('public.forum_posts') is not null then
    raise exception 'REFUSING: forum objects already exist';
  end if;
end;
$forum_stage_guard$;

-- Exact reviewed core, with only its outer BEGIN/COMMIT removed.
-- SOURCE SHA-256: 9fcf733655cd268589915254078c1e1d6d68da5fd252d5b9d73b290b283d9866
-- ============================================================================
-- FORUM v1 -- private-by-default forum foundation for JEENEETARD.
--
-- This is a review/staging candidate, not production authorization.
-- It creates no public navigation and starts in mode `off`.
-- Browser roles receive no direct table access: bounded RPCs are the only
-- student path, so RLS, moderation and the remote mode cannot be bypassed.
-- ============================================================================

-- Fail closed if the identity/admin prerequisites do not match the reviewed
-- application. The standalone Prisma prototype is deliberately irrelevant.
do $$
declare missing text[] := '{}'::text[];
begin
  if to_regclass('public.profiles') is null then missing := array_append(missing, 'profiles'); end if;
  if to_regprocedure('public.is_admin()') is null then missing := array_append(missing, 'is_admin()'); end if;
  if to_regprocedure('auth.uid()') is null then missing := array_append(missing, 'auth.uid()'); end if;
  if to_regprocedure('auth.role()') is null then missing := array_append(missing, 'auth.role()'); end if;
  if to_regclass('auth.users') is null then missing := array_append(missing, 'auth.users'); end if;
  if cardinality(missing) > 0 then
    raise exception 'FORUM v1: missing dependencies: %', array_to_string(missing, ', ');
  end if;
end;
$$;

-- --------------------------------------------------------------------------
-- 1. Tables
-- --------------------------------------------------------------------------

create table public.forum_settings (
  id boolean primary key default true check (id),
  mode text not null default 'off' check (mode in ('off', 'read_only', 'open')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.forum_settings (id, mode) values (true, 'off');

create table public.forum_topics (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 2 and 50),
  description text check (description is null or char_length(description) <= 240),
  kind text not null check (kind in ('academic', 'non_academic')),
  display_order integer not null default 1000,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.forum_posts (
  id bigint generated always as identity primary key,
  topic_id bigint not null references public.forum_topics(id) on delete restrict,
  author_id uuid references public.profiles(id) on delete set null,
  title text not null,
  body text not null,
  is_solved boolean not null default false,
  upvote_count integer not null default 0 check (upvote_count >= 0),
  downvote_count integer not null default 0 check (downvote_count >= 0),
  score integer not null default 0,
  hot_rank double precision not null default 0,
  comment_count integer not null default 0 check (comment_count >= 0),
  hidden_at timestamptz,
  hidden_by uuid references public.profiles(id) on delete set null,
  hidden_reason text,
  locked_at timestamptz,
  locked_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forum_posts_live_title check (
    deleted_at is not null or char_length(btrim(title)) between 10 and 300
  ),
  constraint forum_posts_live_body check (
    deleted_at is not null or char_length(btrim(body)) between 1 and 20000
  ),
  constraint forum_posts_score_matches_counts check (
    score = upvote_count - downvote_count
  ),
  constraint forum_posts_hidden_shape check (
    hidden_at is not null or (hidden_by is null and hidden_reason is null)
  ),
  constraint forum_posts_locked_shape check (
    locked_at is not null or locked_by is null
  )
);

create table public.forum_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.forum_posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  parent_id bigint,
  body text not null,
  depth integer not null default 0 check (depth between 0 and 10),
  upvote_count integer not null default 0 check (upvote_count >= 0),
  downvote_count integer not null default 0 check (downvote_count >= 0),
  score integer not null default 0,
  hidden_at timestamptz,
  hidden_by uuid references public.profiles(id) on delete set null,
  hidden_reason text,
  deleted_at timestamptz,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forum_comments_live_body check (
    deleted_at is not null or char_length(btrim(body)) between 1 and 10000
  ),
  constraint forum_comments_score_matches_counts check (
    score = upvote_count - downvote_count
  ),
  constraint forum_comments_hidden_shape check (
    hidden_at is not null or (hidden_by is null and hidden_reason is null)
  ),
  constraint forum_comments_id_post_unique unique (id, post_id),
  constraint forum_comments_parent_same_post foreign key (parent_id, post_id)
    references public.forum_comments(id, post_id) on delete cascade
);

create table public.forum_votes (
  id bigint generated always as identity primary key,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  target_author_id uuid references public.profiles(id) on delete set null,
  post_id bigint references public.forum_posts(id) on delete cascade,
  comment_id bigint references public.forum_comments(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forum_votes_exactly_one_target check (
    (post_id is not null and comment_id is null)
    or (post_id is null and comment_id is not null)
  )
);

create table public.forum_user_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  karma integer not null default 0,
  post_count integer not null default 0 check (post_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  updated_at timestamptz not null default now()
);

create table public.forum_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id bigint not null,
  reason text not null check (reason in (
    'spam', 'abuse_or_bullying', 'personal_information', 'sexual_content',
    'self_harm', 'wrong_or_unsafe_advice', 'off_topic', 'other'
  )),
  note text check (note is null or char_length(note) <= 1000),
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint forum_reports_resolution_shape check (
    (status = 'pending' and resolved_at is null and resolved_by is null)
    or (status <> 'pending' and resolved_at is not null)
  )
);

create table public.forum_moderation_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in (
    'hide', 'unhide', 'lock', 'unlock', 'remove', 'solve', 'unsolve',
    'auto_hide', 'suspend', 'unsuspend', 'set_mode'
  )),
  target_type text not null check (target_type in ('post', 'comment', 'user', 'forum')),
  target_id bigint,
  target_user_id uuid references public.profiles(id) on delete set null,
  reason text,
  report_id bigint references public.forum_reports(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint forum_moderation_remove_reason check (
    action <> 'remove' or char_length(btrim(coalesce(reason, ''))) >= 3
  )
);

create table public.forum_suspensions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  suspended_until timestamptz not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (suspended_until > created_at)
);

-- Append-only action timestamps make throttling independent of whether a vote
-- is later removed or a post is tombstoned. Without this table, vote/unvote
-- loops and repeated edits could erase their own rate-limit evidence.
create table public.forum_rate_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('post', 'comment', 'edit_post', 'edit_comment', 'vote', 'report')),
  target_id bigint,
  created_at timestamptz not null default now()
);

-- Approved launch topics only. Motivation and General remain absent/inactive
-- until their separately reviewed moderation paths exist.
insert into public.forum_topics
  (slug, name, description, kind, display_order, is_active)
values
  ('physics', 'Physics', 'Mechanics, electricity, optics and modern physics.', 'academic', 10, true),
  ('chemistry', 'Chemistry', 'Physical, organic and inorganic chemistry.', 'academic', 20, true),
  ('mathematics', 'Mathematics', 'Algebra, calculus, geometry and JEE mathematics.', 'academic', 30, true),
  ('biology', 'Biology', 'Botany and zoology for NEET.', 'academic', 40, true),
  ('strategy', 'Strategy', 'Timetables, revision and exam strategy.', 'non_academic', 50, true),
  ('exam-admissions', 'Exam & Admissions', 'Forms, dates, counselling and admissions.', 'non_academic', 60, true);

-- --------------------------------------------------------------------------
-- 2. Indexes
-- --------------------------------------------------------------------------

create index forum_posts_new_idx
  on public.forum_posts (created_at desc, id desc)
  where deleted_at is null and hidden_at is null;
create index forum_posts_top_idx
  on public.forum_posts (score desc, created_at desc, id desc)
  where deleted_at is null and hidden_at is null;
create index forum_posts_hot_idx
  on public.forum_posts (hot_rank desc, created_at desc, id desc)
  where deleted_at is null and hidden_at is null;
create index forum_posts_topic_new_idx
  on public.forum_posts (topic_id, created_at desc, id desc)
  where deleted_at is null and hidden_at is null;
create index forum_posts_topic_hot_idx
  on public.forum_posts (topic_id, hot_rank desc, created_at desc, id desc)
  where deleted_at is null and hidden_at is null;
create index forum_posts_author_idx on public.forum_posts (author_id, created_at desc);

create index forum_comments_post_idx
  on public.forum_comments (post_id, score desc, created_at, id);
create index forum_comments_parent_idx on public.forum_comments (parent_id);
create index forum_comments_author_idx on public.forum_comments (author_id, created_at desc);

create unique index forum_votes_unique_post
  on public.forum_votes (voter_id, post_id) where post_id is not null;
create unique index forum_votes_unique_comment
  on public.forum_votes (voter_id, comment_id) where comment_id is not null;
create index forum_votes_post_idx on public.forum_votes (post_id) where post_id is not null;
create index forum_votes_comment_idx on public.forum_votes (comment_id) where comment_id is not null;
create index forum_votes_voter_idx on public.forum_votes (voter_id);

create unique index forum_reports_one_pending
  on public.forum_reports (reporter_id, target_type, target_id, reason)
  where reporter_id is not null and status = 'pending';
create index forum_reports_queue_idx
  on public.forum_reports (priority desc, created_at, id) where status = 'pending';
create index forum_moderation_target_idx
  on public.forum_moderation_log (target_type, target_id, created_at desc);
create index forum_rate_events_limit_idx
  on public.forum_rate_events (user_id, action, created_at desc);

-- --------------------------------------------------------------------------
-- 3. Internal invariants and counter triggers
-- --------------------------------------------------------------------------

create or replace function public.forum_hot_rank(
  p_score integer,
  p_created_at timestamptz
)
returns double precision
language sql
immutable
strict
set search_path = ''
as $$
  select round((
    (case when p_score > 0 then 1 when p_score < 0 then -1 else 0 end)
      * log(greatest(abs(p_score), 1))
    + (extract(epoch from p_created_at) - 1767225600.0) / 86400.0
  )::numeric, 7)::double precision;
$$;

create or replace function public.forum_prepare_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.hot_rank := public.forum_hot_rank(new.score, new.created_at);
  return new;
end;
$$;

create trigger trg_forum_prepare_post
before insert or update on public.forum_posts
for each row execute function public.forum_prepare_post();

create or replace function public.forum_prepare_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare parent_depth integer;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if new.parent_id is null then
      new.depth := 0;
    else
      select c.depth into parent_depth
      from public.forum_comments c
      where c.id = new.parent_id and c.post_id = new.post_id;
      if parent_depth is null then
        raise exception using errcode = '23503', message = 'parent comment is not in this post';
      end if;
      new.depth := parent_depth + 1;
      if new.depth > 10 then
        raise exception using errcode = '22023', message = 'maximum comment depth is 10';
      end if;
    end if;
  elsif new.parent_id is distinct from old.parent_id
     or new.post_id is distinct from old.post_id
     or new.depth is distinct from old.depth then
    raise exception using errcode = '42501', message = 'comment tree fields are immutable';
  end if;
  return new;
end;
$$;

create trigger trg_forum_prepare_comment
before insert or update on public.forum_comments
for each row execute function public.forum_prepare_comment();

create or replace function public.forum_apply_user_content_delta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid;
  delta integer := 0;
  is_post boolean := tg_table_name = 'forum_posts';
begin
  if tg_op = 'INSERT' then
    target_user := new.author_id;
    if new.deleted_at is null then delta := 1; end if;
  elsif tg_op = 'DELETE' then
    target_user := old.author_id;
    if old.deleted_at is null then delta := -1; end if;
  else
    target_user := coalesce(old.author_id, new.author_id);
    if old.deleted_at is null and new.deleted_at is not null then delta := -1;
    elsif old.deleted_at is not null and new.deleted_at is null then delta := 1;
    end if;
  end if;

  if target_user is not null and delta <> 0 then
    -- Seed a valid zero row first. An INSERT that proposes -1 violates the
    -- CHECK constraint before ON CONFLICT can repair it.
    insert into public.forum_user_stats (user_id)
    values (target_user)
    on conflict (user_id) do nothing;
    update public.forum_user_stats set
      post_count = greatest(post_count + case when is_post then delta else 0 end, 0),
      comment_count = greatest(comment_count + case when is_post then 0 else delta end, 0),
      updated_at = now()
    where user_id = target_user;
  end if;
  return null;
end;
$$;

create trigger trg_forum_post_stats
after insert or update or delete on public.forum_posts
for each row execute function public.forum_apply_user_content_delta();
create trigger trg_forum_comment_stats
after insert or update or delete on public.forum_comments
for each row execute function public.forum_apply_user_content_delta();

create or replace function public.forum_apply_comment_count_delta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.forum_posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.forum_posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger trg_forum_comment_count
after insert or delete on public.forum_comments
for each row execute function public.forum_apply_comment_count_delta();

create or replace function public.forum_adjust_karma(
  p_author uuid,
  p_delta integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_author is null or p_delta = 0 then return; end if;
  if not exists (select 1 from public.profiles where id = p_author) then return; end if;
  insert into public.forum_user_stats (user_id, karma)
  values (p_author, p_delta)
  on conflict (user_id) do update set
    karma = public.forum_user_stats.karma + excluded.karma,
    updated_at = now();
end;
$$;

create or replace function public.forum_prepare_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.post_id is not null then
      select p.author_id into new.target_author_id
      from public.forum_posts p where p.id = new.post_id;
    else
      select c.author_id into new.target_author_id
      from public.forum_comments c where c.id = new.comment_id;
    end if;
    if new.target_author_id is null then
      raise exception using errcode = '22023', message = 'vote target has no active author';
    end if;
  elsif new.voter_id is distinct from old.voter_id
     or new.post_id is distinct from old.post_id
     or new.comment_id is distinct from old.comment_id
     or (
       new.target_author_id is distinct from old.target_author_id
       and not (old.target_author_id is not null and new.target_author_id is null)
     ) then
    raise exception using errcode = '42501', message = 'vote identity and target are immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_forum_prepare_vote
before insert or update on public.forum_votes
for each row execute function public.forum_prepare_vote();

create or replace function public.forum_apply_vote_delta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_author uuid;
  new_author uuid;
  old_value integer := case when tg_op in ('UPDATE', 'DELETE') then old.value else 0 end;
  new_value integer := case when tg_op in ('INSERT', 'UPDATE') then new.value else 0 end;
  old_voter uuid := case when tg_op in ('UPDATE', 'DELETE') then old.voter_id else null end;
  new_voter uuid := case when tg_op in ('INSERT', 'UPDATE') then new.voter_id else null end;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_author := old.target_author_id;
    if old.post_id is not null then
      update public.forum_posts set
        upvote_count = greatest(upvote_count - case when old.value = 1 then 1 else 0 end, 0),
        downvote_count = greatest(downvote_count - case when old.value = -1 then 1 else 0 end, 0),
        score = score - old.value
      where id = old.post_id;
    else
      update public.forum_comments set
        upvote_count = greatest(upvote_count - case when old.value = 1 then 1 else 0 end, 0),
        downvote_count = greatest(downvote_count - case when old.value = -1 then 1 else 0 end, 0),
        score = score - old.value
      where id = old.comment_id;
    end if;
    if old_author is distinct from old_voter then
      perform public.forum_adjust_karma(old_author, -old_value);
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_author := new.target_author_id;
    if new.post_id is not null then
      update public.forum_posts set
        upvote_count = upvote_count + case when new.value = 1 then 1 else 0 end,
        downvote_count = downvote_count + case when new.value = -1 then 1 else 0 end,
        score = score + new.value
      where id = new.post_id;
    else
      update public.forum_comments set
        upvote_count = upvote_count + case when new.value = 1 then 1 else 0 end,
        downvote_count = downvote_count + case when new.value = -1 then 1 else 0 end,
        score = score + new.value
      where id = new.comment_id;
    end if;
    if new_author is distinct from new_voter then
      perform public.forum_adjust_karma(new_author, new_value);
    end if;
  end if;
  return null;
end;
$$;

create trigger trg_forum_vote_delta
after insert or update or delete on public.forum_votes
for each row execute function public.forum_apply_vote_delta();

-- Account deletion removes the student's authored text but keeps reply
-- structure. Vote cascades still pass through the vote trigger above.
create or replace function public.forum_anonymize_profile_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.forum_posts
  set title = '[deleted]', body = '', deleted_at = coalesce(deleted_at, now()),
      author_id = null, edited_at = null
  where author_id = old.id;
  update public.forum_comments
  set body = '', deleted_at = coalesce(deleted_at, now()),
      author_id = null, edited_at = null
  where author_id = old.id;
  return old;
end;
$$;

create trigger trg_forum_anonymize_profile
before delete on public.profiles
for each row execute function public.forum_anonymize_profile_content();

-- --------------------------------------------------------------------------
-- 4. Security helpers and remote mode
-- --------------------------------------------------------------------------

create or replace function public.forum_mode()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select mode from public.forum_settings where id = true), 'off');
$$;

create or replace function public.forum_require_open()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.forum_mode() <> 'open' then
    raise exception using errcode = '55000', message = 'forum is not open for contributions';
  end if;
end;
$$;

create or replace function public.forum_require_writer()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  profile_created timestamptz;
  handle text;
begin
  perform public.forum_require_open();
  if uid is null then
    raise exception using errcode = '42501', message = 'sign in to contribute';
  end if;
  select u.created_at, btrim(p.username) into profile_created, handle
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = uid;
  if profile_created is null then
    raise exception using errcode = '42501', message = 'student profile is missing';
  end if;
  if handle is null or handle !~ '^[A-Za-z0-9_]{3,30}$' then
    raise exception using errcode = '22023',
      message = 'choose a 3 to 30 character username before contributing';
  end if;
  if profile_created > now() - interval '10 minutes' then
    raise exception using errcode = 'P0001',
      message = 'new accounts can contribute after 10 minutes';
  end if;
  if exists (
    select 1 from public.forum_suspensions s
    where s.user_id = uid and s.suspended_until > now()
  ) then
    raise exception using errcode = '42501', message = 'forum posting is temporarily suspended';
  end if;
  return uid;
end;
$$;

-- Reporting is a safety action, not ordinary publishing. Keep it available in
-- read-only mode and do not let a posting suspension silence a reporter.
create or replace function public.forum_require_reporter()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if public.forum_mode() = 'off' then
    raise exception using errcode = '55000', message = 'forum is unavailable';
  end if;
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception using errcode = '42501', message = 'sign in to report content';
  end if;
  return uid;
end;
$$;

create or replace function public.forum_record_rate_event(
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
as $$
begin
  if p_hour_limit is not null and (
    select count(*) from public.forum_rate_events e
    where e.user_id = p_user_id and e.action = p_action
      and e.created_at >= now() - interval '1 hour'
  ) >= p_hour_limit then
    raise exception using errcode = 'P0001',
      message = p_action || ' hourly rate limit exceeded';
  end if;
  if p_day_limit is not null and (
    select count(*) from public.forum_rate_events e
    where e.user_id = p_user_id and e.action = p_action
      and e.created_at >= now() - interval '1 day'
  ) >= p_day_limit then
    raise exception using errcode = 'P0001',
      message = p_action || ' daily rate limit exceeded';
  end if;
  insert into public.forum_rate_events (user_id, action, target_id)
  values (p_user_id, p_action, p_target_id);
end;
$$;

create or replace function public.forum_admin_set_mode(p_mode text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_mode not in ('off', 'read_only', 'open') then
    raise exception using errcode = '22023', message = 'invalid forum mode';
  end if;
  update public.forum_settings
  set mode = p_mode, updated_at = now(), updated_by = actor where id = true;
  insert into public.forum_moderation_log
    (actor_id, action, target_type, reason)
  values (actor, 'set_mode', 'forum', p_mode);
  return p_mode;
end;
$$;

-- --------------------------------------------------------------------------
-- 5. Bounded public reads
-- --------------------------------------------------------------------------

create or replace function public.get_forum_topics()
returns table (
  id bigint, slug text, name text, description text, kind text, display_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.slug, t.name, t.description, t.kind, t.display_order
  from public.forum_topics t
  where public.forum_mode() <> 'off' and t.is_active
  order by t.display_order, t.id;
$$;

create or replace function public.get_forum_feed(
  p_sort text default 'hot',
  p_topic_slug text default null,
  p_query text default null,
  p_cursor_hot double precision default null,
  p_cursor_score integer default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id bigint default null,
  p_limit integer default 25
)
returns table (
  id bigint,
  topic_slug text,
  topic_name text,
  author_username text,
  title text,
  body_preview text,
  is_solved boolean,
  score integer,
  upvote_count integer,
  downvote_count integer,
  comment_count integer,
  viewer_vote smallint,
  hot_rank double precision,
  created_at timestamptz,
  edited_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  raw_query text := nullif(btrim(coalesce(p_query, '')), '');
  search_pattern text;
  effective_sort text := case
    when raw_query is not null then 'new'
    else lower(btrim(coalesce(p_sort, 'hot')))
  end;
  cursor_sql text;
  order_sql text;
  query_sql text;
begin
  if public.forum_mode() = 'off' then return; end if;
  if effective_sort not in ('hot', 'new', 'top') then
    raise exception using errcode = '22023', message = 'invalid forum sort';
  end if;
  if char_length(coalesce(p_query, '')) > 100 then
    raise exception using errcode = '22023', message = 'forum search is limited to 100 characters';
  end if;

  -- Treat LIKE metacharacters as ordinary student search text. chr(92) keeps
  -- the backslash handling independent of standard_conforming_strings.
  if raw_query is not null then
    search_pattern := '%' || replace(replace(replace(
      raw_query,
      chr(92), chr(92) || chr(92)
    ), '%', chr(92) || '%'), '_', chr(92) || '_') || '%';
  end if;

  -- Cursor contract: id is the presence marker. When present, created_at is
  -- always required, plus hot_rank for Hot or score for Top. Reject incomplete
  -- cursors explicitly instead of allowing SQL NULL comparison to return zero
  -- rows without an explanation.
  if p_cursor_id is not null then
    if p_cursor_created_at is null
       or (effective_sort = 'hot' and p_cursor_hot is null)
       or (effective_sort = 'top' and p_cursor_score is null) then
      raise exception using errcode = '22023',
        message = 'incomplete forum cursor for ' || effective_sort || ' sort';
    end if;
  end if;

  -- Concrete sort branches let PostgreSQL use the matching New/Top/Hot index.
  -- A CASE expression in ORDER BY made every branch look like a computed sort.
  if effective_sort = 'hot' then
    cursor_sql := ' and ($6::bigint is null or (p.hot_rank, p.created_at, p.id) < ($3::double precision, $5::timestamptz, $6::bigint))';
    order_sql := 'p.hot_rank desc, p.created_at desc, p.id desc';
  elsif effective_sort = 'top' then
    cursor_sql := ' and ($6::bigint is null or (p.score, p.created_at, p.id) < ($4::integer, $5::timestamptz, $6::bigint))';
    order_sql := 'p.score desc, p.created_at desc, p.id desc';
  else
    cursor_sql := ' and ($6::bigint is null or (p.created_at, p.id) < ($5::timestamptz, $6::bigint))';
    order_sql := 'p.created_at desc, p.id desc';
  end if;

  query_sql := $feed$
    select
      p.id, t.slug, t.name,
      case when p.author_id is null then 'Deleted student' else pr.username end,
      p.title,
      left(regexp_replace(p.body, '[#*_`~$>\\[\\]()]', ' ', 'g'), 360),
      p.is_solved, p.score, p.upvote_count, p.downvote_count, p.comment_count,
      coalesce(v.value, 0)::smallint, p.hot_rank, p.created_at, p.edited_at
    from public.forum_posts p
    join public.forum_topics t on t.id = p.topic_id
    left join public.profiles pr on pr.id = p.author_id
    left join public.forum_votes v
      on v.post_id = p.id and v.voter_id = auth.uid()
    where p.deleted_at is null
      and p.hidden_at is null
      and ($1::text is null or t.slug = $1::text)
      and (
        $2::text is null
        or p.title ilike $2::text escape E'\\'
        or p.body ilike $2::text escape E'\\'
      )
  $feed$ || cursor_sql || ' order by ' || order_sql ||
    ' limit least(greatest(coalesce($7::integer, 25), 1), 25)';

  return query execute query_sql
    using p_topic_slug, search_pattern, p_cursor_hot, p_cursor_score,
          p_cursor_created_at, p_cursor_id, p_limit;
end;
$$;

create or replace function public.get_forum_post(p_post_id bigint)
returns table (
  id bigint, topic_slug text, topic_name text, author_username text,
  title text, body text, is_solved boolean, is_locked boolean,
  is_deleted boolean, score integer, upvote_count integer,
  downvote_count integer, comment_count integer, viewer_vote smallint,
  created_at timestamptz, edited_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, t.slug, t.name,
    case when p.deleted_at is not null or p.author_id is null then 'Deleted student' else pr.username end,
    case when p.deleted_at is not null then '[deleted]' else p.title end,
    case when p.deleted_at is not null then '' else p.body end,
    p.is_solved, p.locked_at is not null, p.deleted_at is not null,
    p.score, p.upvote_count, p.downvote_count, p.comment_count,
    coalesce(v.value, 0)::smallint, p.created_at, p.edited_at
  from public.forum_posts p
  join public.forum_topics t on t.id = p.topic_id
  left join public.profiles pr on pr.id = p.author_id
  left join public.forum_votes v on v.post_id = p.id and v.voter_id = auth.uid()
  where public.forum_mode() <> 'off'
    and p.id = p_post_id
    and p.hidden_at is null;
$$;

create or replace function public.get_forum_comments(p_post_id bigint)
returns table (
  id bigint, post_id bigint, parent_id bigint, depth integer,
  author_username text, body text, is_tombstone boolean,
  score integer, upvote_count integer, downvote_count integer,
  viewer_vote smallint, created_at timestamptz, edited_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.post_id, c.parent_id, c.depth,
    case when c.deleted_at is not null or c.hidden_at is not null or c.author_id is null
      then 'Deleted student' else pr.username end,
    case when c.hidden_at is not null then '[removed by moderator]'
      when c.deleted_at is not null then '[deleted]' else c.body end,
    (c.deleted_at is not null or c.hidden_at is not null),
    c.score, c.upvote_count, c.downvote_count,
    coalesce(v.value, 0)::smallint, c.created_at, c.edited_at
  from public.forum_comments c
  join public.forum_posts p on p.id = c.post_id
  left join public.profiles pr on pr.id = c.author_id
  left join public.forum_votes v on v.comment_id = c.id and v.voter_id = auth.uid()
  where public.forum_mode() <> 'off'
    and c.post_id = p_post_id
    and p.hidden_at is null
  order by c.score desc, c.created_at, c.id;
$$;

-- --------------------------------------------------------------------------
-- 6. Student writes
-- --------------------------------------------------------------------------

create or replace function public.forum_create_post(
  p_topic_slug text,
  p_title text,
  p_body text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.forum_require_writer();
  topic_id bigint;
  new_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('forum-post:' || uid::text, 0));
  perform public.forum_record_rate_event(uid, 'post', null, 5, 15);
  if exists (
    select 1 from public.forum_posts
    where author_id = uid and body = p_body
      and created_at >= now() - interval '1 hour'
  ) then
    raise exception using errcode = '23505', message = 'duplicate recent post';
  end if;
  if not exists (select 1 from public.forum_posts where author_id = uid)
     and (select count(*) from regexp_matches(p_body, 'https?://', 'gi')) > 2 then
    raise exception using errcode = '22023',
      message = 'a first post may contain at most two external links';
  end if;
  select t.id into topic_id from public.forum_topics t
  where t.slug = p_topic_slug and t.is_active;
  if topic_id is null then
    raise exception using errcode = '22023', message = 'unknown or inactive forum topic';
  end if;
  insert into public.forum_posts (topic_id, author_id, title, body)
  values (topic_id, uid, btrim(p_title), p_body)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.forum_edit_post(
  p_post_id bigint,
  p_title text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := public.forum_require_writer();
begin
  perform pg_advisory_xact_lock(hashtextextended('forum-edit-post:' || uid::text, 0));
  if (select count(*) from public.forum_rate_events e
      where e.user_id = uid and e.action = 'edit_post' and e.target_id = p_post_id
        and e.created_at >= now() - interval '1 hour') >= 10 then
    raise exception using errcode = 'P0001', message = 'edit limit is 10 per post per hour';
  end if;
  update public.forum_posts
  set title = btrim(p_title), body = p_body, edited_at = now()
  where id = p_post_id and author_id = uid
    and deleted_at is null and hidden_at is null
    and created_at >= now() - interval '30 minutes';
  if not found then
    raise exception using errcode = '42501',
      message = 'post is unavailable or its 30-minute edit window has closed';
  end if;
  perform public.forum_record_rate_event(uid, 'edit_post', p_post_id, null, null);
end;
$$;

create or replace function public.forum_delete_post(p_post_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := public.forum_require_writer();
begin
  update public.forum_posts
  set title = '[deleted]', body = '', deleted_at = now(), author_id = null,
      edited_at = null, is_solved = false
  where id = p_post_id and author_id = uid and deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'post is unavailable or not yours';
  end if;
end;
$$;

create or replace function public.forum_toggle_solved(p_post_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := public.forum_require_writer(); result boolean;
begin
  update public.forum_posts set is_solved = not is_solved
  where id = p_post_id and author_id = uid
    and deleted_at is null and hidden_at is null
  returning is_solved into result;
  if result is null then
    raise exception using errcode = '42501', message = 'post is unavailable or not yours';
  end if;
  return result;
end;
$$;

create or replace function public.forum_create_comment(
  p_post_id bigint,
  p_parent_id bigint,
  p_body text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := public.forum_require_writer(); new_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('forum-comment:' || uid::text, 0));
  perform public.forum_record_rate_event(uid, 'comment', p_post_id, 30, null);
  if not exists (
    select 1 from public.forum_posts
    where id = p_post_id and deleted_at is null and hidden_at is null and locked_at is null
  ) then
    raise exception using errcode = '55000', message = 'post is unavailable or locked';
  end if;
  if exists (
    select 1 from public.forum_comments
    where author_id = uid and body = p_body
      and created_at >= now() - interval '1 hour'
  ) then
    raise exception using errcode = '23505', message = 'duplicate recent comment';
  end if;
  insert into public.forum_comments (post_id, parent_id, author_id, body)
  values (p_post_id, p_parent_id, uid, p_body)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.forum_edit_comment(p_comment_id bigint, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := public.forum_require_writer();
begin
  perform pg_advisory_xact_lock(hashtextextended('forum-edit-comment:' || uid::text, 0));
  if (select count(*) from public.forum_rate_events e
      where e.user_id = uid and e.action = 'edit_comment' and e.target_id = p_comment_id
        and e.created_at >= now() - interval '1 hour') >= 10 then
    raise exception using errcode = 'P0001', message = 'edit limit is 10 per comment per hour';
  end if;
  update public.forum_comments
  set body = p_body, edited_at = now()
  where id = p_comment_id and author_id = uid
    and deleted_at is null and hidden_at is null
    and created_at >= now() - interval '30 minutes';
  if not found then
    raise exception using errcode = '42501',
      message = 'comment is unavailable or its 30-minute edit window has closed';
  end if;
  perform public.forum_record_rate_event(uid, 'edit_comment', p_comment_id, null, null);
end;
$$;

create or replace function public.forum_delete_comment(p_comment_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := public.forum_require_writer();
begin
  update public.forum_comments
  set body = '', deleted_at = now(), author_id = null, edited_at = null
  where id = p_comment_id and author_id = uid and deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'comment is unavailable or not yours';
  end if;
end;
$$;

create or replace function public.forum_cast_vote(
  p_target_type text,
  p_target_id bigint,
  p_value smallint
)
returns table (viewer_vote smallint, score integer, upvote_count integer, downvote_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := public.forum_require_writer(); existing smallint;
begin
  if p_target_type not in ('post', 'comment') or p_value not in (-1, 1) then
    raise exception using errcode = '22023', message = 'invalid vote';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'forum-vote:' || uid::text || ':' || p_target_type || ':' || p_target_id::text, 0
  ));
  perform public.forum_record_rate_event(uid, 'vote', p_target_id, 100, null);

  if p_target_type = 'post' then
    if not exists (select 1 from public.forum_posts where id = p_target_id and deleted_at is null and hidden_at is null) then
      raise exception using errcode = '22023', message = 'post is unavailable';
    end if;
    select v.value into existing from public.forum_votes v
      where v.voter_id = uid and v.post_id = p_target_id;
    if existing is null then
      insert into public.forum_votes (voter_id, post_id, value) values (uid, p_target_id, p_value);
    elsif existing = p_value then
      delete from public.forum_votes where voter_id = uid and post_id = p_target_id;
    else
      update public.forum_votes set value = p_value, updated_at = now()
      where voter_id = uid and post_id = p_target_id;
    end if;
    return query select coalesce(v.value, 0)::smallint, p.score, p.upvote_count, p.downvote_count
    from public.forum_posts p
    left join public.forum_votes v on v.post_id = p.id and v.voter_id = uid
    where p.id = p_target_id;
  else
    if not exists (
      select 1 from public.forum_comments c join public.forum_posts p on p.id = c.post_id
      where c.id = p_target_id and c.deleted_at is null and c.hidden_at is null
        and p.deleted_at is null and p.hidden_at is null
    ) then raise exception using errcode = '22023', message = 'comment is unavailable'; end if;
    select v.value into existing from public.forum_votes v
      where v.voter_id = uid and v.comment_id = p_target_id;
    if existing is null then
      insert into public.forum_votes (voter_id, comment_id, value) values (uid, p_target_id, p_value);
    elsif existing = p_value then
      delete from public.forum_votes where voter_id = uid and comment_id = p_target_id;
    else
      update public.forum_votes set value = p_value, updated_at = now()
      where voter_id = uid and comment_id = p_target_id;
    end if;
    return query select coalesce(v.value, 0)::smallint, c.score, c.upvote_count, c.downvote_count
    from public.forum_comments c
    left join public.forum_votes v on v.comment_id = c.id and v.voter_id = uid
    where c.id = p_target_id;
  end if;
end;
$$;

create or replace function public.forum_submit_report(
  p_target_type text,
  p_target_id bigint,
  p_reason text,
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := public.forum_require_reporter(); new_id bigint; report_count integer;
begin
  if p_target_type not in ('post', 'comment') or p_reason not in (
    'spam', 'abuse_or_bullying', 'personal_information', 'sexual_content',
    'self_harm', 'wrong_or_unsafe_advice', 'off_topic', 'other'
  ) then raise exception using errcode = '22023', message = 'invalid report'; end if;
  if char_length(coalesce(p_note, '')) > 1000 then
    raise exception using errcode = '22023', message = 'report note is limited to 1000 characters';
  end if;
  if (p_target_type = 'post' and not exists (
        select 1 from public.forum_posts where id = p_target_id and hidden_at is null
      )) or (p_target_type = 'comment' and not exists (
        select 1 from public.forum_comments where id = p_target_id and hidden_at is null
      )) then raise exception using errcode = '22023', message = 'report target is unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended('forum-report:' || uid::text, 0));
  perform public.forum_record_rate_event(uid, 'report', p_target_id, 10, null);
  insert into public.forum_reports
    (reporter_id, target_type, target_id, reason, note, priority)
  values
    (uid, p_target_type, p_target_id, p_reason, nullif(btrim(p_note), ''),
     case when p_reason = 'self_harm' then 'urgent' else 'normal' end)
  returning id into new_id;

  if p_reason <> 'self_harm' then
    select count(distinct reporter_id) into report_count
    from public.forum_reports
    where target_type = p_target_type and target_id = p_target_id
      and status = 'pending' and reason <> 'self_harm';
    if report_count >= 3 then
      if p_target_type = 'post' then
        update public.forum_posts set hidden_at = now(), hidden_reason = 'report threshold'
        where id = p_target_id and hidden_at is null;
      else
        update public.forum_comments set hidden_at = now(), hidden_reason = 'report threshold'
        where id = p_target_id and hidden_at is null;
      end if;
      if found then
        insert into public.forum_moderation_log
          (action, target_type, target_id, reason, report_id)
        values ('auto_hide', p_target_type, p_target_id, '3 distinct pending reporters', new_id);
      end if;
    end if;
  end if;
  return new_id;
end;
$$;

-- --------------------------------------------------------------------------
-- 7. Admin moderation and audit
-- --------------------------------------------------------------------------

create or replace function public.forum_admin_moderate(
  p_target_type text,
  p_target_id bigint,
  p_action text,
  p_reason text default null,
  p_report_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'not authorized'; end if;
  if p_target_type not in ('post', 'comment')
     or p_action not in ('hide', 'unhide', 'lock', 'unlock', 'remove', 'solve', 'unsolve') then
    raise exception using errcode = '22023', message = 'invalid moderation action';
  end if;
  if p_action = 'remove' and char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception using errcode = '22023', message = 'permanent removal requires a reason';
  end if;
  if p_report_id is not null and not exists (
    select 1 from public.forum_reports r
    where r.id = p_report_id and r.status = 'pending'
      and r.target_type = p_target_type and r.target_id = p_target_id
  ) then
    raise exception using errcode = '22023',
      message = 'report does not match the moderation target';
  end if;

  if p_target_type = 'post' then
    if p_action = 'hide' then update public.forum_posts set hidden_at = now(), hidden_by = actor, hidden_reason = p_reason where id = p_target_id;
    elsif p_action = 'unhide' then update public.forum_posts set hidden_at = null, hidden_by = null, hidden_reason = null where id = p_target_id;
    elsif p_action = 'lock' then update public.forum_posts set locked_at = now(), locked_by = actor where id = p_target_id;
    elsif p_action = 'unlock' then update public.forum_posts set locked_at = null, locked_by = null where id = p_target_id;
    elsif p_action = 'solve' then update public.forum_posts set is_solved = true where id = p_target_id;
    elsif p_action = 'unsolve' then update public.forum_posts set is_solved = false where id = p_target_id;
    elsif p_action = 'remove' then delete from public.forum_posts where id = p_target_id;
    end if;
  else
    if p_action not in ('hide', 'unhide', 'remove') then
      raise exception using errcode = '22023', message = 'action does not apply to comments';
    elsif p_action = 'hide' then update public.forum_comments set hidden_at = now(), hidden_by = actor, hidden_reason = p_reason where id = p_target_id;
    elsif p_action = 'unhide' then update public.forum_comments set hidden_at = null, hidden_by = null, hidden_reason = null where id = p_target_id;
    elsif p_action = 'remove' then delete from public.forum_comments where id = p_target_id;
    end if;
  end if;
  if not found then raise exception using errcode = 'P0002', message = 'moderation target not found'; end if;

  insert into public.forum_moderation_log
    (actor_id, action, target_type, target_id, reason, report_id)
  values (actor, p_action, p_target_type, p_target_id, p_reason, p_report_id);
  if p_report_id is not null then
    update public.forum_reports set status = 'reviewed', resolved_at = now(), resolved_by = actor
    where id = p_report_id and status = 'pending';
  end if;
end;
$$;

create or replace function public.forum_recount_karma(p_apply boolean default false)
returns table (user_id uuid, stored_karma integer, actual_karma integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_apply then
    update public.forum_user_stats set karma = 0, updated_at = now();
    insert into public.forum_user_stats (user_id, karma)
    select totals.author_id, sum(totals.karma)::integer
    from (
      select v.target_author_id as author_id, coalesce(sum(v.value), 0)::integer as karma
      from public.forum_votes v
      where v.target_author_id is not null and v.target_author_id <> v.voter_id
      group by v.target_author_id
    ) totals
    group by totals.author_id
    on conflict (user_id) do update set
      karma = public.forum_user_stats.karma + excluded.karma,
      updated_at = now();
  end if;

  return query
  with actual_parts as (
    select v.target_author_id as author_id, sum(v.value)::integer as karma
    from public.forum_votes v
    where v.target_author_id is not null and v.target_author_id <> v.voter_id
    group by v.target_author_id
  ), actual as (
    select author_id, sum(karma)::integer as karma
    from actual_parts group by author_id
  )
  select coalesce(s.user_id, a.author_id), coalesce(s.karma, 0), coalesce(a.karma, 0)
  from public.forum_user_stats s full join actual a on a.author_id = s.user_id
  where coalesce(s.karma, 0) <> coalesce(a.karma, 0)
  order by coalesce(s.user_id, a.author_id);
end;
$$;

create or replace function public.forum_admin_set_suspension(
  p_user_id uuid,
  p_suspended_until timestamptz,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); action_name text;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'not authorized'; end if;
  if p_suspended_until is null or p_suspended_until <= now() then
    delete from public.forum_suspensions where user_id = p_user_id;
    action_name := 'unsuspend';
  else
    insert into public.forum_suspensions (user_id, suspended_until, reason, created_by)
    values (p_user_id, p_suspended_until, p_reason, actor)
    on conflict (user_id) do update set
      suspended_until = excluded.suspended_until, reason = excluded.reason,
      created_by = excluded.created_by, created_at = now();
    action_name := 'suspend';
  end if;
  insert into public.forum_moderation_log
    (actor_id, action, target_type, target_user_id, reason)
  values (actor, action_name, 'user', p_user_id, p_reason);
end;
$$;

create or replace function public.forum_admin_list_reports(p_limit integer default 100)
returns table (
  id bigint, reporter_id uuid, target_type text, target_id bigint,
  reason text, note text, priority text, status text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'not authorized'; end if;
  return query select r.id, r.reporter_id, r.target_type, r.target_id,
    r.reason, r.note, r.priority, r.status, r.created_at
  from public.forum_reports r
  where r.status = 'pending'
  order by case r.priority when 'urgent' then 0 else 1 end, r.created_at, r.id
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.forum_recount_metrics(p_apply boolean default false)
returns table (
  target_type text, target_id bigint, stored_score integer, actual_score integer,
  stored_upvotes integer, actual_upvotes integer,
  stored_downvotes integer, actual_downvotes integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_apply then
    update public.forum_posts p set
      upvote_count = x.ups, downvote_count = x.downs, score = x.ups - x.downs
    from (
      select p2.id,
        count(v.id) filter (where v.value = 1)::integer as ups,
        count(v.id) filter (where v.value = -1)::integer as downs
      from public.forum_posts p2 left join public.forum_votes v on v.post_id = p2.id
      group by p2.id
    ) x where p.id = x.id;
    update public.forum_comments c set
      upvote_count = x.ups, downvote_count = x.downs, score = x.ups - x.downs
    from (
      select c2.id,
        count(v.id) filter (where v.value = 1)::integer as ups,
        count(v.id) filter (where v.value = -1)::integer as downs
      from public.forum_comments c2 left join public.forum_votes v on v.comment_id = c2.id
      group by c2.id
    ) x where c.id = x.id;
  end if;
  return query
  with actual as (
    select 'post'::text as kind, p.id,
      p.score, p.upvote_count, p.downvote_count,
      count(v.id) filter (where v.value = 1)::integer as ups,
      count(v.id) filter (where v.value = -1)::integer as downs
    from public.forum_posts p left join public.forum_votes v on v.post_id = p.id group by p.id
    union all
    select 'comment', c.id, c.score, c.upvote_count, c.downvote_count,
      count(v.id) filter (where v.value = 1)::integer,
      count(v.id) filter (where v.value = -1)::integer
    from public.forum_comments c left join public.forum_votes v on v.comment_id = c.id group by c.id
  )
  select a.kind, a.id, a.score, a.ups - a.downs,
    a.upvote_count, a.ups, a.downvote_count, a.downs
  from actual a
  where a.score <> a.ups - a.downs
     or a.upvote_count <> a.ups or a.downvote_count <> a.downs
  order by a.kind, a.id;
end;
$$;

-- --------------------------------------------------------------------------
-- 8. RLS and grants -- no browser role gets direct table access.
-- --------------------------------------------------------------------------

alter table public.forum_settings enable row level security;
alter table public.forum_topics enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_comments enable row level security;
alter table public.forum_votes enable row level security;
alter table public.forum_user_stats enable row level security;
alter table public.forum_reports enable row level security;
alter table public.forum_moderation_log enable row level security;
alter table public.forum_suspensions enable row level security;
alter table public.forum_rate_events enable row level security;

create policy "forum admins inspect settings" on public.forum_settings
  for select to authenticated using (public.is_admin());
create policy "forum admins inspect topics" on public.forum_topics
  for select to authenticated using (public.is_admin());
create policy "forum admins inspect posts" on public.forum_posts
  for select to authenticated using (public.is_admin());
create policy "forum admins inspect comments" on public.forum_comments
  for select to authenticated using (public.is_admin());
create policy "forum admins inspect reports" on public.forum_reports
  for select to authenticated using (public.is_admin());
create policy "forum admins inspect moderation log" on public.forum_moderation_log
  for select to authenticated using (public.is_admin());
create policy "forum admins inspect suspensions" on public.forum_suspensions
  for select to authenticated using (public.is_admin());

revoke all on table public.forum_settings, public.forum_topics,
  public.forum_posts, public.forum_comments, public.forum_votes,
  public.forum_user_stats, public.forum_reports,
  public.forum_moderation_log, public.forum_suspensions,
  public.forum_rate_events
from public, anon, authenticated;

grant all on table public.forum_settings, public.forum_topics,
  public.forum_posts, public.forum_comments, public.forum_votes,
  public.forum_user_stats, public.forum_reports,
  public.forum_moderation_log, public.forum_suspensions,
  public.forum_rate_events
to service_role;

grant usage, select on sequence
  public.forum_topics_id_seq, public.forum_posts_id_seq,
  public.forum_comments_id_seq, public.forum_votes_id_seq,
  public.forum_reports_id_seq, public.forum_moderation_log_id_seq,
  public.forum_rate_events_id_seq
to service_role;

do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'forum_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.signature);
  end loop;
end;
$$;

grant execute on function public.forum_mode() to anon, authenticated, service_role;
grant execute on function public.get_forum_topics() to anon, authenticated, service_role;
grant execute on function public.get_forum_feed(text,text,text,double precision,integer,timestamptz,bigint,integer)
  to anon, authenticated, service_role;
grant execute on function public.get_forum_post(bigint) to anon, authenticated, service_role;
grant execute on function public.get_forum_comments(bigint) to anon, authenticated, service_role;

grant execute on function public.forum_create_post(text,text,text) to authenticated, service_role;
grant execute on function public.forum_edit_post(bigint,text,text) to authenticated, service_role;
grant execute on function public.forum_delete_post(bigint) to authenticated, service_role;
grant execute on function public.forum_toggle_solved(bigint) to authenticated, service_role;
grant execute on function public.forum_create_comment(bigint,bigint,text) to authenticated, service_role;
grant execute on function public.forum_edit_comment(bigint,text) to authenticated, service_role;
grant execute on function public.forum_delete_comment(bigint) to authenticated, service_role;
grant execute on function public.forum_cast_vote(text,bigint,smallint) to authenticated, service_role;
grant execute on function public.forum_submit_report(text,bigint,text,text) to authenticated, service_role;

grant execute on function public.forum_admin_set_mode(text) to authenticated, service_role;
grant execute on function public.forum_admin_moderate(text,bigint,text,text,bigint) to authenticated, service_role;
grant execute on function public.forum_admin_set_suspension(uuid,timestamptz,text) to authenticated, service_role;
grant execute on function public.forum_admin_list_reports(integer) to authenticated, service_role;
grant execute on function public.forum_recount_metrics(boolean) to authenticated, service_role;
grant execute on function public.forum_recount_karma(boolean) to authenticated, service_role;

-- Structural self-check. Behavioural/adversarial checks belong to disposable
-- staging and the local PGlite rehearsal, not a persistent migration.
do $$
declare missing text[] := '{}'::text[];
begin
  if to_regclass('public.forum_posts') is null then missing := array_append(missing, 'forum_posts'); end if;
  if to_regclass('public.forum_votes') is null then missing := array_append(missing, 'forum_votes'); end if;
  if to_regprocedure('public.forum_cast_vote(text,bigint,smallint)') is null then missing := array_append(missing, 'forum_cast_vote'); end if;
  if to_regprocedure('public.forum_admin_set_mode(text)') is null then missing := array_append(missing, 'forum_admin_set_mode'); end if;
  if (select count(*) from public.forum_topics where is_active) <> 6 then missing := array_append(missing, 'six active launch topics'); end if;
  if (select mode from public.forum_settings where id = true) <> 'off' then missing := array_append(missing, 'fail-closed mode'); end if;
  if cardinality(missing) > 0 then
    raise exception 'FORUM v1 self-check failed: %', array_to_string(missing, ', ');
  end if;
end;
$$;

notify pgrst, 'reload schema';


-- Exact structural postflight, inside the rollback-always transaction.
-- FORUM v1 read-only structural postflight.
-- It creates no fixtures and changes no forum state.

do $$
declare missing text[] := '{}'::text[];
begin
  if to_regclass('public.forum_settings') is null then missing := array_append(missing, 'forum_settings'); end if;
  if to_regclass('public.forum_topics') is null then missing := array_append(missing, 'forum_topics'); end if;
  if to_regclass('public.forum_posts') is null then missing := array_append(missing, 'forum_posts'); end if;
  if to_regclass('public.forum_comments') is null then missing := array_append(missing, 'forum_comments'); end if;
  if to_regclass('public.forum_votes') is null then missing := array_append(missing, 'forum_votes'); end if;
  if to_regclass('public.forum_user_stats') is null then missing := array_append(missing, 'forum_user_stats'); end if;
  if to_regclass('public.forum_reports') is null then missing := array_append(missing, 'forum_reports'); end if;
  if to_regclass('public.forum_moderation_log') is null then missing := array_append(missing, 'forum_moderation_log'); end if;
  if to_regclass('public.forum_suspensions') is null then missing := array_append(missing, 'forum_suspensions'); end if;
  if to_regclass('public.forum_rate_events') is null then missing := array_append(missing, 'forum_rate_events'); end if;

  if to_regprocedure('public.forum_mode()') is null then missing := array_append(missing, 'forum_mode()'); end if;
  if to_regprocedure('public.get_forum_feed(text,text,text,double precision,integer,timestamp with time zone,bigint,integer)') is null then
    missing := array_append(missing, 'get_forum_feed()');
  end if;
  if to_regprocedure('public.forum_create_post(text,text,text)') is null then missing := array_append(missing, 'forum_create_post()'); end if;
  if to_regprocedure('public.forum_cast_vote(text,bigint,smallint)') is null then missing := array_append(missing, 'forum_cast_vote()'); end if;
  if to_regprocedure('public.forum_submit_report(text,bigint,text,text)') is null then missing := array_append(missing, 'forum_submit_report()'); end if;
  if to_regprocedure('public.forum_admin_moderate(text,bigint,text,text,bigint)') is null then missing := array_append(missing, 'forum_admin_moderate()'); end if;
  if to_regprocedure('public.forum_recount_karma(boolean)') is null then missing := array_append(missing, 'forum_recount_karma()'); end if;

  if cardinality(missing) > 0 then
    raise exception 'FORUM v1 POSTFLIGHT: missing: %', array_to_string(missing, ', ');
  end if;

  if (select mode from public.forum_settings where id = true) <> 'off' then
    raise exception 'FORUM v1 POSTFLIGHT: forum did not fail closed';
  end if;
  if (select count(*) from public.forum_topics where is_active) <> 6 then
    raise exception 'FORUM v1 POSTFLIGHT: expected six active launch topics';
  end if;
  if exists (
    select 1 from public.forum_topics where slug in ('motivation', 'general') and is_active
  ) then raise exception 'FORUM v1 POSTFLIGHT: deferred topics are active'; end if;

  if has_table_privilege('anon', 'public.forum_posts', 'SELECT')
     or has_table_privilege('authenticated', 'public.forum_posts', 'INSERT')
     or has_table_privilege('authenticated', 'public.forum_votes', 'SELECT')
     or has_table_privilege('authenticated', 'public.forum_moderation_log', 'UPDATE') then
    raise exception 'FORUM v1 POSTFLIGHT: direct browser table privilege leaked';
  end if;
  if not has_function_privilege(
    'anon',
    'public.get_forum_feed(text,text,text,double precision,integer,timestamp with time zone,bigint,integer)',
    'EXECUTE'
  ) then raise exception 'FORUM v1 POSTFLIGHT: anonymous feed RPC missing'; end if;
  if has_function_privilege('anon', 'public.forum_create_post(text,text,text)', 'EXECUTE') then
    raise exception 'FORUM v1 POSTFLIGHT: anonymous create RPC leaked';
  end if;
  if not has_function_privilege('authenticated', 'public.forum_create_post(text,text,text)', 'EXECUTE') then
    raise exception 'FORUM v1 POSTFLIGHT: authenticated create RPC missing';
  end if;
  if has_function_privilege('anon', 'public.forum_admin_set_mode(text)', 'EXECUTE') then
    raise exception 'FORUM v1 POSTFLIGHT: anonymous mode control leaked';
  end if;
end;
$$;

select
  (select mode from public.forum_settings where id = true) as forum_mode,
  (select count(*) from public.forum_topics where is_active) as active_topics,
  (select count(*) from public.forum_posts) as posts,
  (select count(*) from public.forum_comments) as comments,
  (select count(*) from public.forum_reports where status = 'pending') as pending_reports,
  false as database_changed;


-- Select real, existing staging identities. No auth.users row is manufactured;
-- the rehearsal refuses if staging has not been provisioned adequately.
do $forum_stage_identities$
declare
  admin_id uuid;
  students uuid[];
begin
  select p.id into admin_id
  from public.profiles p join auth.users u on u.id = p.id
  where p.is_admin is true
  order by p.created_at, p.id
  limit 1;

  select array_agg(id order by created_at, id) into students
  from (
    select p.id, u.created_at
    from public.profiles p join auth.users u on u.id = p.id
    where coalesce(p.is_admin, false) is false
      and u.created_at <= now() - interval '10 minutes'
      and p.id is distinct from admin_id
    order by u.created_at, p.id
    limit 4
  ) candidates;

  if admin_id is null then
    raise exception 'REFUSING: staging needs one admin profile';
  end if;
  if coalesce(cardinality(students), 0) <> 4 then
    raise exception 'REFUSING: staging needs four non-admin users older than 10 minutes';
  end if;

  perform set_config('forum_stage.admin', admin_id::text, true);
  perform set_config('forum_stage.author', students[1]::text, true);
  perform set_config('forum_stage.voter', students[2]::text, true);
  perform set_config('forum_stage.reporter2', students[3]::text, true);
  perform set_config('forum_stage.reporter3', students[4]::text, true);

  -- Prove the username blocker without requiring persistent staging profile
  -- changes. reporter3 stays username-less for the negative test and can still
  -- file a safety report; the other three get valid transaction-local handles.
  update public.profiles
  set username = 'fs_' || right(replace(id::text, '-', ''), 27)
  where id = any(students[1:3]);
  update public.profiles set username = null where id = students[4];
end;
$forum_stage_identities$;

-- Security-invoker helpers catch expected failures while preserving the real
-- caller role. They are temporary in effect because the outer transaction
-- always rolls back.
create function public.__forum_stage_direct_table_denied()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1 from public.forum_posts limit 1;
  raise exception 'ROLE TEST: direct forum_posts SELECT unexpectedly succeeded';
exception when insufficient_privilege then
  return true;
end;
$$;
revoke all on function public.__forum_stage_direct_table_denied() from public;
grant execute on function public.__forum_stage_direct_table_denied() to anon, authenticated;

create function public.__forum_stage_username_gate()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.forum_create_post(
    'physics', 'This title should not be accepted', 'The profile has no username.'
  );
  raise exception 'USERNAME TEST: username-less publishing unexpectedly succeeded';
exception when sqlstate '22023' then
  if sqlerrm not like 'choose a 3 to 30 character username%' then raise; end if;
  return true;
end;
$$;
revoke all on function public.__forum_stage_username_gate() from public;
grant execute on function public.__forum_stage_username_gate() to authenticated;

create function public.__forum_stage_read_only_gate()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.forum_create_post(
    'physics', 'This title should be blocked in read only', 'Read only must reject publishing.'
  );
  raise exception 'MODE TEST: read-only publishing unexpectedly succeeded';
exception when sqlstate '55000' then
  if sqlerrm not like 'forum is not open%' then raise; end if;
  return true;
end;
$$;
revoke all on function public.__forum_stage_read_only_gate() from public;
grant execute on function public.__forum_stage_read_only_gate() to authenticated;

create function public.__forum_stage_cursor_gate(p_post_id bigint)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform * from public.get_forum_feed(
    p_sort => 'hot', p_cursor_created_at => now(), p_cursor_id => p_post_id
  );
  raise exception 'CURSOR TEST: incomplete cursor unexpectedly succeeded';
exception when sqlstate '22023' then
  if sqlerrm not like 'incomplete forum cursor%' then raise; end if;
  return true;
end;
$$;
revoke all on function public.__forum_stage_cursor_gate(bigint) from public;
grant execute on function public.__forum_stage_cursor_gate(bigint) to anon, authenticated;

-- Real authenticated role + admin JWT claims: open the transaction-local forum.
select set_config('request.jwt.claim.sub', current_setting('forum_stage.admin'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.forum_admin_set_mode('open') as opened_mode;
reset role;

-- Real authenticated role + username-less student: publishing is rejected by
-- the hard database gate even though EXECUTE is granted.
select set_config('request.jwt.claim.sub', current_setting('forum_stage.reporter3'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.__forum_stage_username_gate() as username_gate_passed;
reset role;

do $forum_stage_username_assert$
begin
  if current_setting('request.jwt.claim.sub') <> current_setting('forum_stage.reporter3') then
    raise exception 'USERNAME TEST: JWT subject drifted';
  end if;
end;
$forum_stage_username_assert$;

-- Real authenticated author creates two posts, including literal LIKE symbols.
select set_config('request.jwt.claim.sub', current_setting('forum_stage.author'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select set_config(
  'forum_stage.post_id',
  public.forum_create_post(
    'physics',
    'Why does the normal force become zero?',
    'I understand the equation, but not the physical reason.'
  )::text,
  true
);
select public.forum_create_post(
  'mathematics',
  'Understanding a literal 100% result',
  'What does 100%_complete mean in C:\notes?'
) as search_fixture_post;
select set_config(
  'forum_stage.comment_id',
  public.forum_create_comment(
    current_setting('forum_stage.post_id')::bigint,
    null,
    'The track can push but it cannot pull the object.'
  )::text,
  true
);
reset role;

-- Real authenticated voter exercises RPC grant, auth.uid(), vote trigger and
-- private viewer state. Direct table access must still fail.
select set_config('request.jwt.claim.sub', current_setting('forum_stage.voter'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select * from public.forum_cast_vote(
  'post', current_setting('forum_stage.post_id')::bigint, 1::smallint
);
select public.__forum_stage_direct_table_denied() as authenticated_table_denied;
reset role;

-- Real anonymous role can use only the public read RPCs. Search metacharacters
-- are literal, not wildcard operators, and incomplete cursors fail clearly.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;
select count(*) as anonymous_topic_count from public.get_forum_topics();
select count(*) as anonymous_feed_count from public.get_forum_feed();
select count(*) as literal_percent_matches from public.get_forum_feed(p_query => '%');
select count(*) as literal_underscore_matches from public.get_forum_feed(p_query => '_complete');
select count(*) as literal_backslash_matches from public.get_forum_feed(p_query => 'C:\notes');
select public.__forum_stage_cursor_gate(current_setting('forum_stage.post_id')::bigint)
  as incomplete_cursor_rejected;
select public.__forum_stage_direct_table_denied() as anonymous_table_denied;
reset role;

do $forum_stage_read_assert$
declare
  percent_count integer;
  underscore_count integer;
  slash_count integer;
begin
  select count(*) into percent_count from public.get_forum_feed(p_query => '%');
  select count(*) into underscore_count from public.get_forum_feed(p_query => '_complete');
  select count(*) into slash_count from public.get_forum_feed(p_query => 'C:\notes');
  if percent_count <> 1 or underscore_count <> 1 or slash_count <> 1 then
    raise exception 'SEARCH TEST: literal LIKE escaping failed (%%, _, \) = (%, %, %)',
      percent_count, underscore_count, slash_count;
  end if;
end;
$forum_stage_read_assert$;

-- Three distinct authenticated reporters trigger auto-hide. The fourth user
-- deliberately has no username, proving reports remain a safety action rather
-- than a publishing privilege.
select set_config('request.jwt.claim.sub', current_setting('forum_stage.voter'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.forum_submit_report('post', current_setting('forum_stage.post_id')::bigint, 'spam', null);
reset role;
select set_config('request.jwt.claim.sub', current_setting('forum_stage.reporter2'), true);
set local role authenticated;
select public.forum_submit_report('post', current_setting('forum_stage.post_id')::bigint, 'spam', null);
reset role;
select set_config('request.jwt.claim.sub', current_setting('forum_stage.reporter3'), true);
set local role authenticated;
select public.forum_submit_report('post', current_setting('forum_stage.post_id')::bigint, 'spam', null);
reset role;

-- Admin verifies the queue, counters and karma, restores the auto-hidden post,
-- then switches to read-only for the final role test.
select set_config('request.jwt.claim.sub', current_setting('forum_stage.admin'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select count(*) as admin_pending_reports from public.forum_admin_list_reports();
select count(*) as score_drift_rows from public.forum_recount_metrics(false);
select count(*) as karma_drift_rows from public.forum_recount_karma(false);
select public.forum_admin_moderate(
  'post', current_setting('forum_stage.post_id')::bigint,
  'unhide', 'staging rehearsal restore', null
);
select public.forum_admin_set_mode('read_only') as read_only_mode;
reset role;

-- Real authenticated role is now read-only, while the post remains readable.
select set_config('request.jwt.claim.sub', current_setting('forum_stage.author'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.__forum_stage_read_only_gate() as read_only_write_blocked;
select count(*) as authenticated_read_rows
from public.get_forum_post(current_setting('forum_stage.post_id')::bigint);
reset role;

select set_config('request.jwt.claim.sub', current_setting('forum_stage.admin'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
do $forum_stage_final_assert$
begin
  if (select score from public.forum_posts
      where id = current_setting('forum_stage.post_id')::bigint) <> 1 then
    raise exception 'VOTE TEST: expected score 1';
  end if;
  if (select count(*) from public.forum_reports
      where target_type = 'post'
        and target_id = current_setting('forum_stage.post_id')::bigint) <> 3 then
    raise exception 'REPORT TEST: expected three distinct reports';
  end if;
  if exists (select 1 from public.forum_recount_metrics(false))
     or exists (select 1 from public.forum_recount_karma(false)) then
    raise exception 'RECOUNT TEST: metric drift detected';
  end if;
  if public.forum_mode() <> 'read_only' then
    raise exception 'MODE TEST: expected read_only';
  end if;
  if (select count(*) from public.get_forum_topics()) <> 6 then
    raise exception 'ROLE TEST: expected six readable topics';
  end if;
end;
$forum_stage_final_assert$;

-- The only terminal action for a successful rehearsal.
rollback;

-- These checks run after rollback against the restored staging database.
select
  (select name from public.app_environment where id = true) as environment_after,
  to_regclass('public.forum_posts') is null as forum_posts_removed,
  to_regclass('public.forum_votes') is null as forum_votes_removed,
  to_regprocedure('public.forum_create_post(text,text,text)') is null as forum_rpcs_removed;
