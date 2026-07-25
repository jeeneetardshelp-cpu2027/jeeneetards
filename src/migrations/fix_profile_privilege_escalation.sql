-- Prevent browser clients from assigning or changing profiles.is_admin.
--
-- RLS limits which profile row a user can write, but it cannot limit which
-- columns in that row they can change. The column grants and trigger below are
-- deliberately independent so a later broad table grant cannot silently
-- reopen this privilege boundary.

revoke update (is_admin), insert (is_admin)
on table public.profiles
from anon, authenticated;

create or replace function public.protect_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'UPDATE'
       and new.is_admin is distinct from old.is_admin then
      raise exception using
        errcode = '42501',
        message = 'profiles.is_admin may only be changed by service_role';
    end if;

    if tg_op = 'INSERT'
       and new.is_admin is distinct from false then
      raise exception using
        errcode = '42501',
        message = 'profiles.is_admin may only be assigned by service_role';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_admin_flag()
from public, anon, authenticated;
grant execute on function public.protect_profile_admin_flag()
to service_role;

drop trigger if exists trg_protect_profile_admin_flag
on public.profiles;
create trigger trg_protect_profile_admin_flag
before insert or update on public.profiles
for each row execute function public.protect_profile_admin_flag();
