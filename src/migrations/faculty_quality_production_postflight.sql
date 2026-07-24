-- Structural postflight. No fixtures and no content mutation.
do $$
declare missing text[] := '{}'::text[];
begin
  if to_regclass('public.teachers') is null then missing := array_append(missing, 'teachers'); end if;
  if to_regclass('public.teacher_aliases') is null then missing := array_append(missing, 'teacher_aliases'); end if;
  if to_regclass('public.playlist_teachers') is null then missing := array_append(missing, 'playlist_teachers'); end if;
  if to_regclass('public.playlist_quality_reviews') is null then missing := array_append(missing, 'playlist_quality_reviews'); end if;
  if to_regprocedure('public.search_teachers(text,int)') is null then missing := array_append(missing, 'search_teachers'); end if;
  if to_regprocedure('public.universal_search(text,text[],int,int)') is null then missing := array_append(missing, 'universal_search'); end if;
  if to_regprocedure('public.get_content_quality_queue(boolean,int,int)') is null then missing := array_append(missing, 'quality queue'); end if;
  if to_regprocedure('public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)') is null then
    missing := array_append(missing, 'quality review');
  end if;
  if cardinality(missing) > 0 then raise exception 'faculty/quality postflight missing: %', missing; end if;

  if exists (select 1 from public.playlists where source_title is null) then
    raise exception 'source-title backfill is incomplete';
  end if;
  if has_function_privilege('anon', 'public.get_content_quality_queue(boolean,int,int)', 'EXECUTE') then
    raise exception 'anon can execute the editorial queue';
  end if;
  if has_function_privilege('anon', 'public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)', 'EXECUTE') then
    raise exception 'anon can execute editorial writes';
  end if;
end $$;

