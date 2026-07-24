-- Production preflight for the reviewed faculty + content-quality package.
-- Read-only assertions. Any mismatch aborts before the first schema change.
do $$
declare missing text[] := '{}'::text[];
begin
  if to_regclass('public.playlists') is null then missing := array_append(missing, 'playlists'); end if;
  if to_regclass('public.videos') is null then missing := array_append(missing, 'videos'); end if;
  if to_regclass('public.institutes_channels') is null then missing := array_append(missing, 'institutes_channels'); end if;
  if to_regclass('public.subjects') is null then missing := array_append(missing, 'subjects'); end if;
  if to_regclass('public.learning_goals') is null then missing := array_append(missing, 'learning_goals'); end if;
  if to_regclass('public.playlist_learning_goals') is null then missing := array_append(missing, 'playlist_learning_goals'); end if;
  if to_regclass('public.playlist_class_levels') is null then missing := array_append(missing, 'playlist_class_levels'); end if;
  if to_regprocedure('public.is_admin()') is null then missing := array_append(missing, 'is_admin()'); end if;
  if to_regprocedure('public.import_playlist(jsonb,text)') is null then missing := array_append(missing, 'import_playlist(jsonb,text)'); end if;
  if to_regprocedure('public.create_course(jsonb)') is null then missing := array_append(missing, 'create_course(jsonb)'); end if;
  if to_regprocedure('public.import_playlist(jsonb)') is not null then
    raise exception 'legacy import_playlist(jsonb) overload still exists';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    raise exception 'pg_trgm extension is missing';
  end if;
  if cardinality(missing) > 0 then raise exception 'missing production prerequisites: %', missing; end if;

  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='playlists' and column_name='teacher') then
    raise exception 'playlists.teacher legacy source column is missing';
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='playlists' and column_name='content_type') then
    raise exception 'playlist decision metadata is missing';
  end if;
end $$;

