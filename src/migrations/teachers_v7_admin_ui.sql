-- ============================================================
-- teachers_v7_admin_ui.sql — browser-admin proposal review wrappers
-- Apply after teachers_v7.sql and teachers_v7_import.sql.
-- Isolated from all builders until disposable-staging verification.
-- ============================================================

-- get_proposal_groups() is service-role only. This wrapper lets an authenticated
-- admin reach it while keeping the authorization decision inside the function.
create or replace function public.get_faculty_review_groups(p_status text default 'pending')
returns table (
    normalized text, kind text, variants jsonb, variant_count int,
    total_occurrences bigint, candidates jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select * from public.get_proposal_groups(p_status);
end; $$;

-- Approve every spelling/case variant as one new person, atomically. The first
-- proposal creates the teacher; the rest link to that exact id.
create or replace function public.approve_faculty_review_group_as_new(
    p_normalized text, p_display_name text, p_verified boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v_result jsonb; v_teacher_id bigint; v_done int := 0; v_links int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  for r in select id from public.teacher_name_proposals
            where normalized = p_normalized and status in ('pending','deferred')
            order by id for update
  loop
    if v_teacher_id is null then
      v_result := public.approve_proposal_as_new(r.id, p_display_name, p_verified);
      v_teacher_id := (v_result->>'teacher_id')::bigint;
    else
      v_result := public.approve_proposal_as_existing(r.id, v_teacher_id, true);
    end if;
    v_links := v_links + coalesce((v_result->>'playlists_linked')::int, 0);
    v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;

  return jsonb_build_object('normalized', p_normalized, 'variants_resolved', v_done,
    'teacher_id', v_teacher_id, 'playlists_linked', v_links);
end; $$;

create or replace function public.reject_faculty_review_group(
    p_normalized text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v_done int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for r in select id from public.teacher_name_proposals
            where normalized = p_normalized and status in ('pending','deferred')
            order by id for update
  loop
    perform public.reject_proposal(r.id, p_note); v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;
  return jsonb_build_object('normalized', p_normalized, 'variants_rejected', v_done);
end; $$;

create or replace function public.defer_faculty_review_group(
    p_normalized text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v_done int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for r in select id from public.teacher_name_proposals
            where normalized = p_normalized and status = 'pending'
            order by id for update
  loop
    perform public.defer_proposal(r.id, p_note); v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;
  return jsonb_build_object('normalized', p_normalized, 'variants_deferred', v_done);
end; $$;

create or replace function public.split_faculty_review_group(
    p_normalized text, p_teacher_ids bigint[], p_override_kind boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v_result jsonb; v_done int := 0; v_links int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for r in select id from public.teacher_name_proposals
            where normalized = p_normalized and status in ('pending','deferred')
            order by id for update
  loop
    v_result := public.split_proposal(r.id, p_teacher_ids, p_override_kind);
    v_links := v_links + coalesce((v_result->>'links_created')::int, 0);
    v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;
  return jsonb_build_object('normalized', p_normalized, 'variants_resolved', v_done,
    'teachers', p_teacher_ids, 'links_created', v_links);
end; $$;

-- Existing functions below already contain the same is_admin()/service-role
-- body guard. Granting authenticated only lets a real admin reach that guard.
grant execute on function public.scan_free_text_teachers() to authenticated, service_role;
grant execute on function public.approve_group_as_existing(text, bigint, boolean) to authenticated, service_role;

revoke all on function public.get_faculty_review_groups(text) from public, anon;
revoke all on function public.approve_faculty_review_group_as_new(text, text, boolean) from public, anon;
revoke all on function public.reject_faculty_review_group(text, text) from public, anon;
revoke all on function public.defer_faculty_review_group(text, text) from public, anon;
revoke all on function public.split_faculty_review_group(text, bigint[], boolean) from public, anon;

grant execute on function public.get_faculty_review_groups(text) to authenticated, service_role;
grant execute on function public.approve_faculty_review_group_as_new(text, text, boolean) to authenticated, service_role;
grant execute on function public.reject_faculty_review_group(text, text) to authenticated, service_role;
grant execute on function public.defer_faculty_review_group(text, text) to authenticated, service_role;
grant execute on function public.split_faculty_review_group(text, bigint[], boolean) to authenticated, service_role;
