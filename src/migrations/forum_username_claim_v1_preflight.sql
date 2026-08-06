-- Read-only preflight for the forum username-claim delta.
begin transaction read only;

do $$
declare
  collisions integer;
begin
  if to_regprocedure('public.forum_require_writer()') is null then
    raise exception 'username claim preflight: forum v1 is not installed';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'username'
  ) then
    raise exception 'username claim preflight: profiles.username is missing';
  end if;
  if to_regprocedure('public.forum_claim_username(text)') is not null
     or to_regprocedure('public.forum_get_my_identity()') is not null then
    raise exception 'username claim preflight: claim objects already exist; review drift before retrying';
  end if;

  select count(*)::integer into collisions
  from (
    select lower(btrim(username))
    from public.profiles
    where username is not null
    group by lower(btrim(username))
    having count(*) > 1
  ) duplicates;
  if collisions > 0 then
    raise exception 'username claim preflight: % case-insensitive username collision groups require manual review', collisions;
  end if;
end;
$$;

rollback;
