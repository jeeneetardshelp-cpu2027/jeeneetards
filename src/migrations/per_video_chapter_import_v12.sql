-- ============================================================
-- v12 — guarded per-video chapter import. DO NOT apply to production
-- until the backup/restore gate and a disposable-staging rehearsal pass.
--
-- This is an additive delta on top of import_playlist_v6.sql and
-- catalog_management_v11.sql. The legacy import_playlist(jsonb,text)
-- contract is unchanged.
--
-- Mapped mode is intentionally create-only:
--   * one source YouTube playlist remains one course;
--   * every source video carries one reviewed chapter_id;
--   * all chapters must already exist under payload.subject_id;
--   * an existing source playlist is rejected;
--   * reused videos must already have the exact same subject and chapter;
--   * request_id makes an identical retry a read-only replay.
-- ============================================================

begin;

create table if not exists public.playlist_import_audit (
  id bigint generated always as identity primary key,
  request_id uuid not null unique,
  youtube_playlist_id text not null,
  playlist_id bigint references public.playlists(id) on delete set null,
  request_payload jsonb not null,
  before_state jsonb not null,
  after_state jsonb not null,
  result jsonb not null,
  actor_id uuid,
  occurred_at timestamptz not null default now()
);

alter table public.playlist_import_audit enable row level security;
revoke all on table public.playlist_import_audit
  from public, anon, authenticated, service_role;
revoke all on sequence public.playlist_import_audit_id_seq
  from public, anon, authenticated, service_role;
drop policy if exists "admin reads playlist import audit"
  on public.playlist_import_audit;
create policy "admin reads playlist import audit"
  on public.playlist_import_audit
  for select to authenticated
  using (public.is_admin());
grant select on table public.playlist_import_audit
  to authenticated, service_role;

create or replace function public.per_video_chapter_import_snapshot(
  p_playlist_id bigint
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  -- Capture only state owned by the import contract. Community ratings,
  -- popularity counters, verification timestamps, and editorial-review fields
  -- may change independently and must not turn a valid retry into false drift.
  select jsonb_build_object(
    'id', p.id,
    'youtube_playlist_id', p.youtube_playlist_id,
    'title', p.title,
    'teacher', p.teacher,
    'channel_id', p.channel_id,
    'category_id', p.category_id,
    'subject_id', p.subject_id,
    'content_type', p.content_type,
    'language', p.language,
    'difficulty', p.difficulty,
    'audience_focus', p.audience_focus,
    'learning_goal_ids',
      coalesce((
        select jsonb_agg(plg.learning_goal_id order by plg.learning_goal_id)
        from public.playlist_learning_goals plg
        where plg.playlist_id = p.id
      ), '[]'::jsonb),
    'class_level_ids',
      coalesce((
        select jsonb_agg(pcl.class_level_id order by pcl.class_level_id)
        from public.playlist_class_levels pcl
        where pcl.playlist_id = p.id
      ), '[]'::jsonb),
    'board_ids',
      coalesce((
        select jsonb_agg(pb.board_id order by pb.board_id)
        from public.playlist_boards pb
        where pb.playlist_id = p.id
      ), '[]'::jsonb),
    'video_links',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'video_id', pv.video_id,
            'position', pv.position
          )
          order by pv.position, pv.video_id
        )
        from public.playlist_videos pv
        where pv.playlist_id = p.id
      ), '[]'::jsonb)
  )
  from public.playlists p
  where p.id = p_playlist_id;
$$;

create or replace function public.per_video_chapter_import_video_snapshot(
  p_video_id bigint
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  -- Video details can be refreshed from YouTube independently. Replay protects
  -- the structural filing that this mapped import owns.
  select jsonb_build_object(
    'id', v.id,
    'youtube_video_id', v.youtube_video_id,
    'channel_id', v.channel_id,
    'category_id', v.category_id,
    'subject_id', v.subject_id,
    'chapter_id', v.chapter_id,
    'learning_goal_ids',
      coalesce((
        select jsonb_agg(vlg.learning_goal_id order by vlg.learning_goal_id)
        from public.video_learning_goals vlg
        where vlg.video_id = v.id
      ), '[]'::jsonb),
    'class_level_ids',
      coalesce((
        select jsonb_agg(vcl.class_level_id order by vcl.class_level_id)
        from public.video_class_levels vcl
        where vcl.video_id = v.id
      ), '[]'::jsonb)
  )
  from public.videos v
  where v.id = p_video_id;
$$;

create or replace function public.per_video_chapter_import_capability()
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'version', 12,
    'per_video_chapter_id', true,
    'all_or_none_mapping', true,
    'create_only', true,
    'request_replay', true,
    'audit_snapshot', true,
    'rollback_rpc', false
  );
$$;

create or replace function public.import_playlist_with_chapters(
  payload jsonb,
  mode text default 'merge'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid := nullif(payload->>'request_id', '')::uuid;
  v_subject_id bigint := nullif(payload->>'subject_id', '')::bigint;
  v_source_playlist_id text := nullif(payload->>'youtube_playlist_id', '');
  v_manifest_sha256 text := nullif(payload->>'manifest_sha256', '');
  v_source_snapshot_sha256 text :=
    nullif(payload->>'source_snapshot_sha256', '');
  v_manifest_assignment_count int :=
    nullif(payload->>'manifest_assignment_count', '')::int;
  v_existing_audit public.playlist_import_audit%rowtype;
  v_video jsonb;
  v_video_id bigint;
  v_requested_chapter_id bigint;
  v_current_subject_id bigint;
  v_current_chapter_id bigint;
  v_before_videos jsonb;
  v_before_state jsonb;
  v_after_videos jsonb;
  v_after_state jsonb;
  v_current_state jsonb;
  v_result jsonb;
  v_playlist_id bigint;
  v_expected_reused int;
  v_chapter_count int;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized to import' using errcode = '42501';
  end if;
  if mode is distinct from 'merge' then
    raise exception 'mapped chapter import is create-only and requires merge mode';
  end if;
  if v_request_id is null then
    raise exception 'request_id is required for mapped chapter import';
  end if;

  -- Serialize retries before reading the audit row.
  perform pg_advisory_xact_lock(hashtextextended(v_request_id::text, 12));
  select *
  into v_existing_audit
  from public.playlist_import_audit
  where request_id = v_request_id;
  if found then
    if v_existing_audit.request_payload is distinct from payload then
      raise exception 'request_id was already used with a different payload';
    end if;
    perform pg_advisory_xact_lock(
      hashtext(v_existing_audit.youtube_playlist_id)
    );
    for v_video in
      select item
      from jsonb_array_elements(
        v_existing_audit.request_payload->'videos'
      ) e(item)
      order by item->>'youtube_video_id'
    loop
      perform pg_advisory_xact_lock(
        hashtextextended(v_video->>'youtube_video_id', 12)
      );
    end loop;
    perform p.id
    from public.playlists p
    where p.id = v_existing_audit.playlist_id
    for update of p;
    perform v.id
    from jsonb_array_elements(
      v_existing_audit.request_payload->'videos'
    ) e(item)
    join public.videos v
      on v.youtube_video_id = item->>'youtube_video_id'
    order by v.id
    for update of v;
    select coalesce(
      jsonb_agg(
        public.per_video_chapter_import_video_snapshot(v.id)
        order by v.id
      ),
      '[]'::jsonb
    )
    into v_after_videos
    from jsonb_array_elements(v_existing_audit.request_payload->'videos') e(item)
    join public.videos v
      on v.youtube_video_id = item->>'youtube_video_id';
    v_current_state := jsonb_build_object(
      'playlist',
        public.per_video_chapter_import_snapshot(v_existing_audit.playlist_id),
      'videos',
        v_after_videos
    );
    if v_current_state is distinct from v_existing_audit.after_state then
      raise exception
        'imported catalogue state has drifted; idempotent replay refused';
    end if;
    return v_existing_audit.result
      || jsonb_build_object('idempotent_replay', true);
  end if;

  -- Reuse the hardened legacy validator before any write. Child chapter_ids
  -- are additional v12 fields and are validated below.
  perform public.validate_import_payload(payload - 'request_id', mode, true);

  if v_manifest_sha256 is null
     or v_manifest_sha256 !~ '^[0-9a-f]{64}$'
     or v_source_snapshot_sha256 is null
     or v_source_snapshot_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception
      'manifest_sha256 and source_snapshot_sha256 must be lowercase SHA-256 values';
  end if;
  if v_manifest_assignment_count is distinct from
     jsonb_array_length(payload->'videos') then
    raise exception
      'manifest_assignment_count must equal the mapped video count';
  end if;

  if nullif(payload->>'chapter_id', '') is not null
     or nullif(payload->>'chapter_name', '') is not null then
    raise exception
      'mapped chapter import forbids top-level chapter_id/chapter_name';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(payload->'videos') e(item)
    where jsonb_typeof(item->'chapter_id') is distinct from 'number'
       or (item->'chapter_id' #>> '{}') !~ '^[1-9][0-9]{0,17}$'
  ) then
    raise exception
      'every mapped video requires a positive whole-number chapter_id';
  end if;

  select count(distinct (item->>'chapter_id')::bigint)
  into v_chapter_count
  from jsonb_array_elements(payload->'videos') e(item);
  if v_chapter_count < 2 then
    raise exception
      'mapped chapter import requires at least two distinct chapters';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(payload->'videos') e(item)
    left join public.chapters c
      on c.id = (item->>'chapter_id')::bigint
    where c.id is null or c.subject_id is distinct from v_subject_id
  ) then
    raise exception
      'every mapped chapter must exist and belong to payload.subject_id';
  end if;

  -- Match the base importer's lock order before taking video row locks. This
  -- serializes source identity with legacy imports and avoids playlist/video
  -- lock inversion.
  perform pg_advisory_xact_lock(hashtext(v_source_playlist_id));

  -- The same source cannot become two courses. A retry is handled exclusively
  -- by request_id above; any other existing course is an editorial conflict.
  if exists (
    select 1
    from public.playlists
    where youtube_playlist_id = v_source_playlist_id
  ) then
    raise exception
      'source playlist already exists; mapped v12 import is create-only';
  end if;

  -- Different mapped imports can share a video. Lock all source IDs in stable
  -- order, then require any existing row to agree exactly. NULL is not treated
  -- as agreement: taxonomy correction remains a separate reviewed operation.
  for v_video in
    select item
    from jsonb_array_elements(payload->'videos') e(item)
    order by item->>'youtube_video_id'
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(v_video->>'youtube_video_id', 12)
    );
  end loop;

  -- Management RPCs use row locks rather than the advisory video locks above.
  -- Lock existing rows in stable order before conflict checks and snapshots so
  -- the recorded before_state cannot race a catalog edit.
  perform v.id
  from jsonb_array_elements(payload->'videos') e(item)
  join public.videos v
    on v.youtube_video_id = item->>'youtube_video_id'
  order by v.id
  for update of v;

  if exists (
    select 1
    from jsonb_array_elements(payload->'videos') e(item)
    join public.videos v
      on v.youtube_video_id = item->>'youtube_video_id'
    where v.subject_id is distinct from v_subject_id
       or v.chapter_id is distinct from (item->>'chapter_id')::bigint
  ) then
    raise exception
      'a reused video conflicts with the reviewed subject/chapter mapping';
  end if;

  select coalesce(
    jsonb_agg(
      public.per_video_chapter_import_video_snapshot(v.id)
      order by v.id
    ),
    '[]'::jsonb
  )
  into v_before_videos
  from jsonb_array_elements(payload->'videos') e(item)
  join public.videos v
    on v.youtube_video_id = item->>'youtube_video_id';

  v_expected_reused := jsonb_array_length(v_before_videos);
  v_before_state := jsonb_build_object(
    'playlist', null,
    'videos', v_before_videos
  );

  -- The base importer remains the single implementation for playlist,
  -- membership, goal, class, board, and metadata writes. Removing the
  -- top-level chapter makes new videos temporarily unclassified only inside
  -- this transaction; no other session can observe that intermediate state.
  v_result := public.import_playlist(
    payload - 'request_id' - 'chapter_id' - 'chapter_name',
    mode
  );
  if coalesce((v_result->>'reused_playlist')::boolean, false) then
    raise exception 'source playlist was created concurrently';
  end if;
  if (v_result->>'videos_reused')::int <> v_expected_reused then
    raise exception 'video reuse changed concurrently; retry from a fresh dry-run';
  end if;

  v_playlist_id := (v_result->>'playlist_id')::bigint;
  for v_video in
    select item
    from jsonb_array_elements(payload->'videos') e(item)
    order by item->>'youtube_video_id'
  loop
    v_requested_chapter_id := (v_video->>'chapter_id')::bigint;
    select v.id, v.subject_id, v.chapter_id
    into v_video_id, v_current_subject_id, v_current_chapter_id
    from public.videos v
    where v.youtube_video_id = v_video->>'youtube_video_id'
    for update;

    if not found then
      raise exception 'base import omitted video %',
        v_video->>'youtube_video_id';
    end if;
    if v_current_subject_id is distinct from v_subject_id then
      raise exception 'video subject changed concurrently';
    end if;
    if v_current_chapter_id is not null
       and v_current_chapter_id is distinct from v_requested_chapter_id then
      raise exception 'video chapter changed concurrently';
    end if;
    if v_current_chapter_id is null then
      update public.videos
      set chapter_id = v_requested_chapter_id
      where id = v_video_id;
    end if;
  end loop;

  select coalesce(
    jsonb_agg(
      public.per_video_chapter_import_video_snapshot(v.id)
      order by v.id
    ),
    '[]'::jsonb
  )
  into v_after_videos
  from jsonb_array_elements(payload->'videos') e(item)
  join public.videos v
    on v.youtube_video_id = item->>'youtube_video_id';

  v_after_state := jsonb_build_object(
    'playlist', public.per_video_chapter_import_snapshot(v_playlist_id),
    'videos', v_after_videos
  );
  v_result := v_result || jsonb_build_object(
    'request_id', v_request_id,
    'chapter_count', v_chapter_count,
    'chapter_assignments', jsonb_array_length(payload->'videos'),
    'idempotent_replay', false
  );

  insert into public.playlist_import_audit (
    request_id,
    youtube_playlist_id,
    playlist_id,
    request_payload,
    before_state,
    after_state,
    result,
    actor_id
  ) values (
    v_request_id,
    v_source_playlist_id,
    v_playlist_id,
    payload,
    v_before_state,
    v_after_state,
    v_result,
    auth.uid()
  );

  return v_result;
end;
$$;

revoke all on function public.per_video_chapter_import_snapshot(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.per_video_chapter_import_video_snapshot(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.per_video_chapter_import_capability()
  from public;
revoke all on function public.import_playlist_with_chapters(jsonb, text)
  from public, anon;

grant execute on function public.per_video_chapter_import_capability()
  to anon, authenticated, service_role;
grant execute on function public.import_playlist_with_chapters(jsonb, text)
  to authenticated, service_role;

commit;
