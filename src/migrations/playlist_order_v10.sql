-- Curated course order for the paged catalogue.
--
-- display_order is ascending. A large default keeps a newly imported course
-- after deliberately placed courses until an editor reviews its position.
-- Existing zero values were the legacy "not curated" sentinel.

alter table public.playlists
  alter column display_order set default 1000000;

update public.playlists
   set display_order = 1000000
 where display_order = 0;
