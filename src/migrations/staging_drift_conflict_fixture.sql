-- ============================================================
--  STAGING / TEST ONLY — never run against production.
--
--  The BLOCKING drift cases. Applying this file and then running
--  v4_class_levels_migration.sql MUST abort with no changes:
--    * conflict      — array and junction both non-empty and disagreeing
--    * unknown-label — a label outside 10th/11th/12th/Dropper
--
--  This is deliberately NOT part of the normal bootstrap. Apply it only when
--  you want to prove the migration refuses ambiguous data, then remove the
--  rows again before running the real migration:
--
--    delete from public.playlists where title like 'DRIFTFX blocking%';
-- ============================================================

insert into public.institutes_channels (name, youtube_channel_id)
values ('Drift Fixture Channel', 'UCdriftfixture00000001')
on conflict (youtube_channel_id) do nothing;

do $fx$
declare v_id bigint; v_cid bigint;
begin
  -- CONFLICT: array says 12th, junction says 11th. No safe automatic answer.
  if not exists (select 1 from public.playlists where title = 'DRIFTFX blocking conflict') then
    insert into public.playlists (title, teacher, channel_id, category_id, subject_id, class_levels)
    select 'DRIFTFX blocking conflict', 'fixture', ch.id, c.id, s.id, array['12th']
      from public.institutes_channels ch
      join public.categories c on c.name = 'JEE'
      join public.subjects   s on s.slug = 'physics'
     where ch.youtube_channel_id = 'UCdriftfixture00000001'
    returning id into v_id;

    select id into v_cid from public.class_levels where slug = 'class-11';
    insert into public.playlist_class_levels (playlist_id, class_level_id)
      values (v_id, v_cid) on conflict do nothing;
    -- undo any trigger-driven sync so the disagreement really exists
    update public.playlists set class_levels = array['12th'] where id = v_id;
  end if;

  -- UNKNOWN LABEL: 'bogus' maps to no class_levels row.
  if not exists (select 1 from public.playlists where title = 'DRIFTFX blocking unknown label') then
    insert into public.playlists (title, teacher, channel_id, category_id, subject_id, class_levels)
    select 'DRIFTFX blocking unknown label', 'fixture', ch.id, c.id, s.id, array['11th','bogus']
      from public.institutes_channels ch
      join public.categories c on c.name = 'JEE'
      join public.subjects   s on s.slug = 'physics'
     where ch.youtube_channel_id = 'UCdriftfixture00000001';
  end if;
end $fx$;
