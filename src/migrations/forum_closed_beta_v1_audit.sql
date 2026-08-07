-- Read-only closed-beta audit. Returns counts and readiness booleans only;
-- no account ids, emails, profile names, or student content are exposed.
begin transaction read only;

select
  public.forum_mode() as forum_mode,
  (select count(*)::integer from public.forum_topics where is_active) as active_topics,
  (select count(*)::integer from public.forum_posts) as post_count,
  (select count(*)::integer from public.forum_comments) as comment_count,
  (select count(*)::integer from public.forum_reports) as report_count,
  (select count(*)::integer from public.profiles where is_admin) as admin_count,
  (select count(*)::integer from public.profiles
    where public.forum_username_is_allowed(username)) as claim_ready_profiles,
  exists (
    select 1 from public.profiles
    where is_admin and public.forum_username_is_allowed(username)
  ) as moderation_admin_ready,
  to_regclass('public.forum_beta_members') is not null as beta_table_present,
  to_regprocedure('public.forum_is_beta_member()') is not null as beta_check_present,
  to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is not null
    as beta_admin_write_present,
  to_regprocedure('public.forum_admin_list_beta_members()') is not null
    as beta_admin_list_present;

rollback;
