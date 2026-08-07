-- Read-only existing-profile audit. Run before the claim migration and retain
-- the single result row as evidence; it assigns or changes no username.
begin transaction read only;

with classified as (
  select
    id,
    username,
    username = btrim(username)
      and btrim(coalesce(username, '')) ~ '^[A-Za-z0-9_-]{3,30}$' as valid_format,
    lower(btrim(coalesce(username, ''))) ~
      '^(admin|administrator|mod|moderator|staff|support|official|system|root|automod)([-_]?[0-9]+)?$'
      or lower(btrim(coalesce(username, ''))) in (
        'anonymous', 'deleted_student', 'deleted-student',
        'fuck', 'fucker', 'bitch', 'chutiya', 'madarchod', 'bhenchod'
      )
      or lower(btrim(coalesce(username, ''))) ~ '^jeeneetards?(help)?([-_].*)?$'
      as reserved
  from public.profiles
), collisions as (
  select count(*)::integer as groups
  from (
    select lower(btrim(username))
    from public.profiles
    where username is not null
    group by lower(btrim(username))
    having count(*) > 1
  ) duplicates
)
select
  count(*) filter (where username is not null and valid_format and not reserved)::integer
    as valid_usernames,
  count(*) filter (where username is null or not valid_format)::integer
    as missing_or_invalid_usernames,
  count(*) filter (where username is not null and reserved)::integer
    as reserved_usernames,
  (select groups from collisions) as case_insensitive_collision_groups
from classified;

rollback;
