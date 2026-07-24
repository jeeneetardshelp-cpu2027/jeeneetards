-- ============================================================
--  STAGING / TEST ONLY — never run against production.
--
--  Manufactures every NON-BLOCKING pre-migration drift direction, the way the
--  v1/v2 era actually produced them. Must run AFTER import_playlist_v4.sql
--  (it needs class_label_to_slug) and BEFORE v4_class_levels_migration.sql —
--  once the derived-array triggers exist, the array can no longer drift and
--  these fixtures would be silently normalised on the way in, proving nothing.
--
--  Blocking cases (conflict, unknown-label) live in
--  staging_drift_conflict_fixture.sql because they must make the migration
--  ABORT; they are applied only by the test that asserts that abort.
--
--  Fixture titles are prefixed DRIFTFX so tests can find them.
-- ============================================================

insert into public.institutes_channels (name, youtube_channel_id)
values ('Drift Fixture Channel', 'UCdriftfixture00000001')
on conflict (youtube_channel_id) do nothing;

-- helper: one row per fixture, created without any junction rows yet
create or replace function public.__fixture_playlist(p_title text, p_labels text[])
returns bigint language plpgsql as $$
declare v_id bigint;
begin
  select id into v_id from public.playlists where title = p_title;
  if v_id is not null then return v_id; end if;
  insert into public.playlists (title, teacher, channel_id, category_id, subject_id, class_levels)
  select p_title, 'fixture', ch.id, c.id, s.id, p_labels
    from public.institutes_channels ch
    join public.categories c on c.name = 'JEE'
    join public.subjects   s on s.slug = 'physics'
   where ch.youtube_channel_id = 'UCdriftfixture00000001'
  returning id into v_id;
  return v_id;
end; $$;

do $fx$
declare v_id bigint; v_cid bigint;
begin
  -- 1. ARRAY-ONLY, single class. Junction empty. v3 would have deleted this.
  v_id := public.__fixture_playlist('DRIFTFX array-only single', array['12th']);

  -- 2. ARRAY-ONLY, multiple classes (review item 6).
  v_id := public.__fixture_playlist('DRIFTFX array-only multi', array['11th','12th','Dropper']);

  -- 3. JUNCTION-ONLY: array empty, junction populated. Safe direction.
  v_id := public.__fixture_playlist('DRIFTFX junction-only', '{}');
  for v_cid in select id from public.class_levels where slug in ('class-11','class-12') loop
    insert into public.playlist_class_levels (playlist_id, class_level_id)
      values (v_id, v_cid) on conflict do nothing;
  end loop;
  -- the junction insert may have synced the array if triggers already exist;
  -- force it back to empty so the fixture really is junction-only.
  update public.playlists set class_levels = '{}' where id = v_id;

  -- 4. AGREE: array and junction already say the same thing.
  v_id := public.__fixture_playlist('DRIFTFX agree', array['11th']);
  select id into v_cid from public.class_levels where slug = 'class-11';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
    values (v_id, v_cid) on conflict do nothing;
  update public.playlists set class_levels = array['11th'] where id = v_id;

  -- 5. BOTH-EMPTY: unclassified. Must survive untouched.
  v_id := public.__fixture_playlist('DRIFTFX both-empty', '{}');
end $fx$;

drop function if exists public.__fixture_playlist(text, text[]);
