-- investigate_rls_auto_enable_2026-07-30.sql — READ ONLY, changes nothing.
--
-- The schema audit found `rls_auto_enable` live in production with no
-- source file anywhere in this repo -- it takes zero parameters, which is
-- consistent with a maintenance helper (possibly something Supabase's own
-- Security Advisor offered to create, since "enable RLS on tables that
-- don't have it" is exactly the kind of one-click remediation it suggests).
--
-- This ONLY reads the function's definition and who can call it. It does
-- NOT execute the function -- if it does something like enabling RLS on a
-- table that currently has none, calling it blind could immediately start
-- blocking real traffic on that table. Read what it does first.

select pg_get_functiondef('public.rls_auto_enable'::regproc) as definition;

select routine_name, security_type, external_language
  from information_schema.routines
 where routine_schema = 'public' and routine_name = 'rls_auto_enable';

select grantee, privilege_type
  from information_schema.routine_privileges
 where routine_schema = 'public' and routine_name = 'rls_auto_enable';
