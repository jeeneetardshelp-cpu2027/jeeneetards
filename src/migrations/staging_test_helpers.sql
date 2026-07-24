-- ============================================================
--  STAGING / TEST ONLY — the production migration path NEVER applies this.
--
--  These functions exist purely so the integration suite can inspect and
--  manufacture database states. They were previously defined inside the v5
--  migration, which meant a production apply would have installed a function
--  that disables a trigger. That is not something production should be able
--  to do, however well guarded.
--
--  Apply AFTER import_playlist_v6.sql (they use app_environment and is_admin)
--  and BEFORE v6_class_levels_migration.sql.
--
--  Every one of them refuses to run unless the database self-identifies as
--  staging/test via public.app_environment, so even if this file were applied
--  to production by mistake, the functions would still decline to act.
-- ============================================================

create or replace function public.__assert_not_production()
returns void language plpgsql security definer set search_path = '' as $$
declare v_env text;
begin
  select name into v_env from public.app_environment limit 1;
  if v_env is null or v_env not in ('staging','test') then
    raise exception 'refusing: database is not marked staging/test (got %)', coalesce(v_env,'<none>');
  end if;
end; $$;

-- Lets the suite assert trigger state over PostgREST.
create or replace function public.has_trigger(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from pg_trigger where tgname = p_name and not tgisinternal);
$$;

-- Once the derived-array triggers exist the array can no longer drift, so a
-- blocking state cannot be created through normal writes. This makes one with
-- the trigger briefly disabled.
create or replace function public.seed_blocking_drift_fixture()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_cid bigint; v_ch bigint; v_cat bigint; v_sub bigint;
begin
  perform public.__assert_not_production();
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized' using errcode = '42501'; end if;

  insert into public.institutes_channels (name, youtube_channel_id)
  values ('Drift Fixture Channel', 'UCdriftfixture00000001')
  on conflict (youtube_channel_id) do nothing;
  select id into v_ch from public.institutes_channels where youtube_channel_id = 'UCdriftfixture00000001';
  select id into v_cat from public.categories where slug = 'jee';
  select id into v_sub from public.subjects where slug = 'physics';

  execute 'alter table public.playlists disable trigger trg_force_class_levels';

  -- CONFLICT: array says 12th, junction says 11th.
  insert into public.playlists (title, teacher, channel_id, category_id, subject_id, class_levels)
  values ('DRIFTFX blocking conflict', 'fixture', v_ch, v_cat, v_sub, array['12th'])
  returning id into v_id;
  select id into v_cid from public.class_levels where slug = 'class-11';
  insert into public.playlist_class_levels (playlist_id, class_level_id) values (v_id, v_cid);
  update public.playlists set class_levels = array['12th'] where id = v_id;

  -- UNKNOWN LABEL
  insert into public.playlists (title, teacher, channel_id, category_id, subject_id, class_levels)
  values ('DRIFTFX blocking unknown label', 'fixture', v_ch, v_cat, v_sub, array['11th','bogus']);

  execute 'alter table public.playlists enable trigger trg_force_class_levels';
  return jsonb_build_object('seeded', 2);
end; $$;

create or replace function public.clear_blocking_drift_fixture()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  perform public.__assert_not_production();
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized' using errcode = '42501'; end if;
  delete from public.playlists where title like 'DRIFTFX blocking%';
  get diagnostics v_n = row_count;
  return jsonb_build_object('removed', v_n);
end; $$;

-- `authenticated` must be revoked EXPLICITLY: Supabase's default privileges
-- grant EXECUTE on every new public function to anon, authenticated and
-- service_role, so revoking only public/anon leaves every logged-in user
-- holding EXECUTE on these test helpers. See the note in import_playlist_v6.sql.
revoke all on function public.__assert_not_production() from public, anon, authenticated;
revoke all on function public.has_trigger(text) from public, anon, authenticated;
revoke all on function public.seed_blocking_drift_fixture() from public, anon, authenticated;
revoke all on function public.clear_blocking_drift_fixture() from public, anon, authenticated;
grant execute on function public.has_trigger(text) to service_role;
grant execute on function public.seed_blocking_drift_fixture() to service_role;
grant execute on function public.clear_blocking_drift_fixture() to service_role;
