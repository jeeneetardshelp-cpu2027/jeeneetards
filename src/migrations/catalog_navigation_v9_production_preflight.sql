-- Production-only compatibility checks for catalogue navigation v9.
-- This block changes nothing. Any failed condition aborts the transaction
-- before an index or function is created.

do $preflight$
declare
  v_table text;
  v_missing text;
  v_bad_environment boolean := false;
begin
  if to_regclass('public.app_environment') is not null then
    execute $query$
      select exists (
        select 1
        from public.app_environment
        where lower(coalesce(name, '')) in ('staging', 'test', 'development', 'dev')
      )
    $query$ into v_bad_environment;
  end if;

  if v_bad_environment then
    raise exception 'REFUSING: catalog navigation production delta was pointed at a non-production environment';
  end if;

  foreach v_table in array array[
    'public.playlists',
    'public.videos',
    'public.playlist_videos',
    'public.learning_goals',
    'public.playlist_learning_goals',
    'public.class_levels',
    'public.playlist_class_levels',
    'public.subjects',
    'public.chapters'
  ] loop
    if to_regclass(v_table) is null then
      raise exception 'REFUSING: required table % does not exist', v_table;
    end if;
    if not has_table_privilege('anon', v_table, 'SELECT') then
      raise exception 'REFUSING: anon lacks SELECT on required table %', v_table;
    end if;
  end loop;

  select string_agg(format('%I.%I', wanted.table_name, wanted.column_name), ', ')
    into v_missing
    from (values
      ('playlists', 'id'), ('playlists', 'title'),
      ('playlists', 'subject_id'), ('playlists', 'channel_id'),
      ('playlists', 'language'), ('playlists', 'content_type'),
      ('playlists', 'difficulty'),
      ('videos', 'id'), ('videos', 'chapter_id'),
      ('chapters', 'id'), ('chapters', 'subject_id'),
      ('chapters', 'slug'), ('chapters', 'name'),
      ('chapters', 'display_order'),
      ('subjects', 'id'), ('subjects', 'slug'),
      ('subjects', 'name'), ('subjects', 'display_order'),
      ('learning_goals', 'id'), ('learning_goals', 'slug'),
      ('learning_goals', 'name'), ('learning_goals', 'display_order'),
      ('class_levels', 'id'), ('class_levels', 'slug')
    ) as wanted(table_name, column_name)
   where not exists (
     select 1
       from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = wanted.table_name
        and c.column_name = wanted.column_name
   );

  if v_missing is not null then
    raise exception 'REFUSING: required columns are missing: %', v_missing;
  end if;

  if to_regprocedure('public.get_browse_curriculum(text,text,text)') is not null then
    raise exception 'REFUSING: get_browse_curriculum(text,text,text) already exists; review before replacing it';
  end if;

  if to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)') is not null then
    raise exception 'REFUSING: browse_facet_counts(...) already exists; review before replacing it';
  end if;
end
$preflight$;

