begin;

revoke all on function public.catalog_manage_capability()
  from public, anon, authenticated, service_role;
revoke all on function public.get_manage_playlists(text, int, int)
  from public, anon, authenticated, service_role;
revoke all on function public.update_managed_playlist(
  bigint, text, text, text, bigint, bigint[], bigint[], text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.set_managed_video_taxonomy(
  bigint, bigint, bigint[], bigint[], boolean
) from public, anon, authenticated, service_role;
revoke all on function public.clear_managed_video_taxonomy(
  bigint, bigint, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.reassign_video_chapter(
  bigint, bigint, bigint, bigint, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.delete_managed_playlist(bigint, text)
  from public, anon, authenticated, service_role;

drop function if exists public.delete_managed_playlist(bigint, text);
drop function if exists public.reassign_video_chapter(
  bigint, bigint, bigint, bigint, boolean
);
drop function if exists public.clear_managed_video_taxonomy(
  bigint, bigint, boolean
);
drop function if exists public.set_managed_video_taxonomy(
  bigint, bigint, bigint[], bigint[], boolean
);
drop function if exists public.update_managed_playlist(
  bigint, text, text, text, bigint, bigint[], bigint[], text, text, text, text
);
drop function if exists public.get_manage_playlists(text, int, int);
drop function if exists public.catalog_manage_capability();
drop function if exists public.catalog_video_taxonomy_snapshot(bigint);
drop function if exists public.catalog_playlist_snapshot(bigint);

-- The audit table remains so an owner can inspect or reconstruct earlier edits.
commit;
