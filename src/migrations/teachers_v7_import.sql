-- ============================================================
-- teachers_v7_import.sql — atomic faculty-aware import wrappers
--
-- Apply ONLY after:
--   import_playlist_v6.sql
--   teachers_v7.sql
--
-- This file is intentionally absent from both production and staging builders
-- until the corrected faculty model has passed a fresh disposable-staging run.
-- It changes no existing function signature, so an older client remains safe.
-- ============================================================

-- Admin UI capability check. Search and import support are separate on purpose:
-- a database may have teachers_v7 but not these wrappers. In that state the UI
-- must not send teacher_ids to import_playlist(), which would ignore the key.
create or replace function public.faculty_import_capability()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'teacher_ids_supported', true,
    'omitted', 'preserve',
    'empty_array', 'clear',
    'non_empty_array', 'replace');
end; $$;

-- Private validator shared by both wrappers. It runs before the underlying
-- importer performs its first write.
create or replace function public.validate_teacher_ids_payload(payload jsonb)
returns bigint[] language plpgsql stable security definer set search_path = '' as $$
declare v_ids bigint[];
begin
  if not (payload ? 'teacher_ids') then
    raise exception 'teacher_ids key is required by the faculty import wrapper';
  end if;
  if jsonb_typeof(payload->'teacher_ids') <> 'array' then
    raise exception 'teacher_ids must be an array';
  end if;
  if exists (
    select 1 from jsonb_array_elements(payload->'teacher_ids') e
     where jsonb_typeof(e) <> 'number'
        or (e#>>'{}') !~ '^[1-9][0-9]{0,17}$') then
    raise exception 'teacher_ids must contain positive whole numbers within range';
  end if;

  select coalesce(array_agg(x::bigint order by ord), '{}'::bigint[])
    into v_ids
    from jsonb_array_elements_text(payload->'teacher_ids') with ordinality a(x, ord);

  if (select count(distinct x) from unnest(v_ids) x)
     <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'duplicate teacher_id in %', v_ids;
  end if;
  if exists (
    select 1 from unnest(v_ids) x
     where not exists (select 1 from public.teachers t where t.id = x)) then
    raise exception 'unknown teacher_id in %', v_ids;
  end if;
  return v_ids;
end; $$;

create or replace function public.import_playlist_with_teachers(
    payload jsonb, mode text default 'merge')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ids bigint[]; v_result jsonb; v_playlist_id bigint;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized to import' using errcode = '42501';
  end if;

  -- Validation precedes import_playlist(): invalid faculty cannot leave a
  -- playlist, videos or taxonomy behind.
  v_ids := public.validate_teacher_ids_payload(payload);
  v_result := public.import_playlist(payload - 'teacher_ids', mode);
  v_playlist_id := (v_result->>'playlist_id')::bigint;
  perform public.set_playlist_teachers(v_playlist_id, v_ids);

  return v_result || jsonb_build_object(
    'teachers', coalesce(array_length(v_ids, 1), 0),
    'teacher_links_replaced', true);
end; $$;

create or replace function public.create_course_with_teachers(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ids bigint[]; v_result jsonb; v_playlist_id bigint;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_ids := public.validate_teacher_ids_payload(payload);
  v_result := public.create_course(payload - 'teacher_ids');
  v_playlist_id := (v_result->>'playlist_id')::bigint;
  perform public.set_playlist_teachers(v_playlist_id, v_ids);

  return v_result || jsonb_build_object(
    'teachers', coalesce(array_length(v_ids, 1), 0),
    'teacher_links_replaced', true);
end; $$;

revoke all on function public.validate_teacher_ids_payload(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.faculty_import_capability()
  from public, anon;
revoke all on function public.import_playlist_with_teachers(jsonb, text)
  from public, anon;
revoke all on function public.create_course_with_teachers(jsonb)
  from public, anon;

grant execute on function public.faculty_import_capability()
  to authenticated, service_role;
grant execute on function public.import_playlist_with_teachers(jsonb, text)
  to authenticated, service_role;
grant execute on function public.create_course_with_teachers(jsonb)
  to authenticated, service_role;
