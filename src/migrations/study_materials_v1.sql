-- ============================================================================
-- Study materials v1
--
-- Foundation only: this migration creates the catalogue and read contract but
-- deliberately inserts no material. A resource is public only after an admin
-- records its source/rights and approves it. V1 supports HTTPS links; storing
-- uploaded PDFs is a separate, owner-approved release.
-- ============================================================================

begin;

do $$
declare
  missing text[] := array[]::text[];
begin
  if to_regclass('public.learning_goals') is null then missing := array_append(missing, 'learning_goals'); end if;
  if to_regclass('public.boards') is null then missing := array_append(missing, 'boards'); end if;
  if to_regclass('public.class_levels') is null then missing := array_append(missing, 'class_levels'); end if;
  if to_regclass('public.subjects') is null then missing := array_append(missing, 'subjects'); end if;
  if to_regclass('public.chapters') is null then missing := array_append(missing, 'chapters'); end if;
  if to_regclass('public.videos') is null then missing := array_append(missing, 'videos'); end if;
  if to_regprocedure('public.is_admin()') is null then missing := array_append(missing, 'is_admin()'); end if;

  if cardinality(missing) > 0 then
    raise exception 'STUDY MATERIALS PREFLIGHT: missing %', array_to_string(missing, ', ');
  end if;
end $$;

create table if not exists public.study_materials (
  id                bigint generated always as identity primary key,
  title             text not null,
  description       text,
  material_type     text not null,
  source_name       text not null,
  source_url        text not null,
  preview_image_url text,
  file_format       text not null default 'web',
  language          text not null default 'English',
  exam_year         integer,
  page_count        integer,
  is_downloadable   boolean not null default false,
  rights_status     text not null,
  rights_note       text,
  review_status     text not null default 'pending',
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint study_materials_title_length
    check (char_length(btrim(title)) between 3 and 180),
  constraint study_materials_description_length
    check (description is null or char_length(description) <= 1000),
  constraint study_materials_type_check
    check (material_type in ('short_notes', 'formula_sheet', 'full_notes', 'previous_year_paper')),
  constraint study_materials_source_name_length
    check (char_length(btrim(source_name)) between 2 and 120),
  constraint study_materials_https_source
    check (source_url ~ '^https://[^[:space:]]+$'),
  constraint study_materials_https_preview
    check (preview_image_url is null or preview_image_url ~ '^https://[^[:space:]]+$'),
  constraint study_materials_file_format_check
    check (file_format in ('web', 'pdf')),
  constraint study_materials_language_check
    check (language in ('English', 'Hindi', 'Hinglish')),
  constraint study_materials_exam_year_check
    check (exam_year is null or exam_year between 2000 and 2100),
  constraint study_materials_page_count_check
    check (page_count is null or page_count > 0),
  constraint study_materials_rights_check
    check (rights_status in ('official_source', 'open_license', 'creator_permission')),
  constraint study_materials_review_check
    check (review_status in ('pending', 'approved', 'rejected')),
  constraint study_materials_publish_gate
    check (
      (review_status = 'approved' and published_at is not null)
      or (review_status <> 'approved' and published_at is null)
    ),
  constraint study_materials_source_identity unique (title, source_url)
);

-- One material may serve several curricula without duplicating the file. For
-- example, a mechanics formula sheet can have one JEE scope and one NEET scope.
-- Scope rows preserve the exact goal/board/class/subject/chapter combination.
create table if not exists public.study_material_scopes (
  id               bigint generated always as identity primary key,
  material_id      bigint not null references public.study_materials(id) on delete cascade,
  learning_goal_id bigint references public.learning_goals(id) on delete restrict,
  board_id         bigint references public.boards(id) on delete restrict,
  class_level_id   bigint references public.class_levels(id) on delete restrict,
  subject_id       bigint references public.subjects(id) on delete restrict,
  chapter_id       bigint references public.chapters(id) on delete restrict,
  created_at       timestamptz not null default now(),
  constraint study_material_scopes_not_empty check (
    learning_goal_id is not null
    or board_id is not null
    or class_level_id is not null
    or subject_id is not null
    or chapter_id is not null
  )
);

-- Optional direct attachment for a genuinely lesson-specific handout. Normal
-- chapter material needs no duplicate video link: the active video's chapter
-- is enough to retrieve it.
create table if not exists public.study_material_videos (
  material_id bigint not null references public.study_materials(id) on delete cascade,
  video_id    bigint not null references public.videos(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (material_id, video_id)
);

create unique index if not exists study_material_scopes_unique_scope
  on public.study_material_scopes (
    material_id,
    coalesce(learning_goal_id, 0),
    coalesce(board_id, 0),
    coalesce(class_level_id, 0),
    coalesce(subject_id, 0),
    coalesce(chapter_id, 0)
  );

create index if not exists idx_study_materials_public_order
  on public.study_materials (material_type, published_at desc, id)
  where review_status = 'approved';
create index if not exists idx_study_material_scopes_goal
  on public.study_material_scopes (learning_goal_id, material_id);
create index if not exists idx_study_material_scopes_board
  on public.study_material_scopes (board_id, material_id);
create index if not exists idx_study_material_scopes_class
  on public.study_material_scopes (class_level_id, material_id);
create index if not exists idx_study_material_scopes_subject
  on public.study_material_scopes (subject_id, material_id);
create index if not exists idx_study_material_scopes_chapter
  on public.study_material_scopes (chapter_id, material_id);
create index if not exists idx_study_material_videos_video
  on public.study_material_videos (video_id, material_id);

create or replace function public.validate_study_material_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chapter_subject_id bigint;
  goal_slug text;
begin
  if new.chapter_id is not null then
    select c.subject_id into chapter_subject_id
      from public.chapters c
     where c.id = new.chapter_id;
    if chapter_subject_id is null then
      raise exception 'Unknown study material chapter id %', new.chapter_id;
    end if;
    if new.subject_id is null then
      new.subject_id := chapter_subject_id;
    elsif new.subject_id <> chapter_subject_id then
      raise exception 'Study material chapter and subject do not match';
    end if;
  end if;

  if new.board_id is not null then
    if new.learning_goal_id is null then
      raise exception 'A board-scoped material also requires a learning goal';
    end if;
    select lg.slug into goal_slug
      from public.learning_goals lg
     where lg.id = new.learning_goal_id;
    if goal_slug is distinct from 'school' then
      raise exception 'Board-scoped material must use the School learning goal';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_study_material_scope on public.study_material_scopes;
create trigger trg_validate_study_material_scope
  before insert or update on public.study_material_scopes
  for each row execute function public.validate_study_material_scope();

create or replace function public.touch_study_material_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_study_material_updated_at on public.study_materials;
create trigger trg_study_material_updated_at
  before update on public.study_materials
  for each row execute function public.touch_study_material_updated_at();

alter table public.study_materials enable row level security;
alter table public.study_material_scopes enable row level security;
alter table public.study_material_videos enable row level security;

drop policy if exists "public reads approved study materials" on public.study_materials;
create policy "public reads approved study materials"
  on public.study_materials for select
  using (review_status = 'approved' and published_at <= now());

drop policy if exists "public reads approved material scopes" on public.study_material_scopes;
create policy "public reads approved material scopes"
  on public.study_material_scopes for select
  using (exists (
    select 1 from public.study_materials m
     where m.id = material_id
       and m.review_status = 'approved'
       and m.published_at <= now()
  ));

drop policy if exists "public reads approved material videos" on public.study_material_videos;
create policy "public reads approved material videos"
  on public.study_material_videos for select
  using (exists (
    select 1 from public.study_materials m
     where m.id = material_id
       and m.review_status = 'approved'
       and m.published_at <= now()
  ));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'study_materials', 'study_material_scopes', 'study_material_videos'
  ] loop
    execute format('drop policy if exists "admins insert" on public.%I', table_name);
    execute format(
      'create policy "admins insert" on public.%I for insert to authenticated with check (public.is_admin())',
      table_name
    );
    execute format('drop policy if exists "admins update" on public.%I', table_name);
    execute format(
      'create policy "admins update" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
      table_name
    );
    execute format('drop policy if exists "admins delete" on public.%I', table_name);
    execute format(
      'create policy "admins delete" on public.%I for delete to authenticated using (public.is_admin())',
      table_name
    );
  end loop;
end $$;

revoke all on table public.study_materials from public, anon, authenticated;
revoke all on table public.study_material_scopes from public, anon, authenticated;
revoke all on table public.study_material_videos from public, anon, authenticated;
grant select on table public.study_materials to anon, authenticated;
grant select on table public.study_material_scopes to anon, authenticated;
grant select on table public.study_material_videos to anon, authenticated;
grant insert, update, delete on table public.study_materials to authenticated;
grant insert, update, delete on table public.study_material_scopes to authenticated;
grant insert, update, delete on table public.study_material_videos to authenticated;
grant all on table public.study_materials to service_role;
grant all on table public.study_material_scopes to service_role;
grant all on table public.study_material_videos to service_role;
grant usage, select on sequence public.study_materials_id_seq to authenticated, service_role;
grant usage, select on sequence public.study_material_scopes_id_seq to authenticated, service_role;

-- One bounded read powers both surfaces. The directory supplies taxonomy
-- slugs; the watch page supplies the active chapter/video ids. Returned scopes
-- let cards explain exactly where a shared material applies.
create or replace function public.get_study_materials(
  p_goal_slug text default null,
  p_board_slug text default null,
  p_class_slug text default null,
  p_subject_slug text default null,
  p_chapter_slug text default null,
  p_chapter_id bigint default null,
  p_video_id bigint default null,
  p_material_type text default null,
  p_limit integer default 60,
  p_offset integer default 0
)
returns table (
  id bigint,
  title text,
  description text,
  material_type text,
  source_name text,
  source_url text,
  preview_image_url text,
  file_format text,
  language text,
  exam_year integer,
  page_count integer,
  is_downloadable boolean,
  rights_status text,
  scopes jsonb,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with matching as (
    select m.*
      from public.study_materials m
     where m.review_status = 'approved'
       and m.published_at <= now()
       and (p_material_type is null or m.material_type = p_material_type)
       and exists (
         select 1
           from public.study_material_scopes s
           left join public.learning_goals lg on lg.id = s.learning_goal_id
           left join public.boards b on b.id = s.board_id
           left join public.class_levels cl on cl.id = s.class_level_id
           left join public.subjects sub on sub.id = s.subject_id
           left join public.chapters ch on ch.id = s.chapter_id
          where s.material_id = m.id
            and (p_goal_slug is null or lg.slug = p_goal_slug)
            and (p_board_slug is null or b.slug = p_board_slug)
            and (p_class_slug is null or cl.slug = p_class_slug)
            and (p_subject_slug is null or sub.slug = p_subject_slug)
            and (p_chapter_slug is null or ch.slug = p_chapter_slug)
       )
       and (
         (p_chapter_id is null and p_video_id is null)
         or exists (
           select 1 from public.study_material_scopes chapter_scope
            where chapter_scope.material_id = m.id
              and chapter_scope.chapter_id = p_chapter_id
         )
         or exists (
           select 1 from public.study_material_videos mv
            where mv.material_id = m.id
              and mv.video_id = p_video_id
         )
       )
  ),
  projected as (
    select
      m.id,
      m.title,
      m.description,
      m.material_type,
      m.source_name,
      m.source_url,
      m.preview_image_url,
      m.file_format,
      m.language,
      m.exam_year,
      m.page_count,
      m.is_downloadable,
      m.rights_status,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'goal', lg.slug,
          'board', b.slug,
          'class', cl.slug,
          'subject', case when sub.id is null then null else jsonb_build_object('id', sub.id, 'slug', sub.slug, 'name', sub.name) end,
          'chapter', case when ch.id is null then null else jsonb_build_object('id', ch.id, 'slug', ch.slug, 'name', ch.name) end
        ) order by lg.display_order nulls last, b.display_order nulls last,
                   cl.display_order nulls last, sub.display_order nulls last,
                   ch.display_order nulls last)
          from public.study_material_scopes s
          left join public.learning_goals lg on lg.id = s.learning_goal_id
          left join public.boards b on b.id = s.board_id
          left join public.class_levels cl on cl.id = s.class_level_id
          left join public.subjects sub on sub.id = s.subject_id
          left join public.chapters ch on ch.id = s.chapter_id
         where s.material_id = m.id
      ), '[]'::jsonb) as scopes
    from matching m
  )
  select
    p.*,
    count(*) over() as total_count
  from projected p
  order by
    case p.material_type
      when 'short_notes' then 1
      when 'formula_sheet' then 2
      when 'full_notes' then 3
      when 'previous_year_paper' then 4
      else 5
    end,
    p.exam_year desc nulls last,
    p.title,
    p.id
  limit least(greatest(coalesce(p_limit, 60), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_study_materials(
  text, text, text, text, text, bigint, bigint, text, integer, integer
) from public;
grant execute on function public.get_study_materials(
  text, text, text, text, text, bigint, bigint, text, integer, integer
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
