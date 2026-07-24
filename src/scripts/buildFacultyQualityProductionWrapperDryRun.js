// Wrap the exact production package in BEGIN/ROLLBACK for a staging-only
// idempotence and data-preservation rehearsal.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const production = readFileSync(resolve(root, "production/faculty_quality_production.sql"), "utf8");
const sql = `-- STAGING-ONLY dry run of the byte-for-byte production package body.
-- Expected final result: one evidence row, then ROLLBACK.
begin;

create temporary table fq_baseline on commit drop as
select
  (select count(*) from public.playlists) as playlists,
  (select count(*) from public.videos) as videos,
  (select count(*) from public.playlist_videos) as playlist_video_links,
  (select count(*) from public.playlist_learning_goals) as goal_links,
  (select count(*) from public.playlist_class_levels) as class_links,
  (select count(*) from public.teachers) as teachers,
  (select count(*) from public.playlist_teachers) as faculty_links;

${production}

do $$
declare b record;
begin
  select * into b from fq_baseline;
  if b.playlists <> (select count(*) from public.playlists)
     or b.videos <> (select count(*) from public.videos)
     or b.playlist_video_links <> (select count(*) from public.playlist_videos)
     or b.goal_links <> (select count(*) from public.playlist_learning_goals)
     or b.class_links <> (select count(*) from public.playlist_class_levels)
     or b.teachers <> (select count(*) from public.teachers)
     or b.faculty_links <> (select count(*) from public.playlist_teachers) then
    raise exception 'production package changed content or identity row counts';
  end if;
end $$;

select
  (select name from public.app_environment where id = true limit 1) as environment,
  to_regprocedure('public.search_teachers(text,int)') is not null as faculty_search,
  to_regprocedure('public.universal_search(text,text[],int,int)') is not null as universal_search,
  to_regprocedure('public.get_content_quality_queue(boolean,int,int)') is not null as quality_queue,
  to_regprocedure('public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)') is not null as quality_review,
  not has_function_privilege('anon','public.get_content_quality_queue(boolean,int,int)','EXECUTE') as queue_private,
  not has_function_privilege('anon','public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)','EXECUTE') as writes_private;

rollback;
`;
const output = resolve(root, "faculty_quality_production_wrapper_dry_run.sql");
writeFileSync(output, sql, "utf8");
const sha = createHash("sha256").update(Buffer.from(sql, "utf8")).digest("hex");
writeFileSync(resolve(root, "faculty_quality_production_wrapper_dry_run.sha256.txt"),
  `${sha}  faculty_quality_production_wrapper_dry_run.sql\n`, "utf8");
console.log(`✓ faculty_quality_production_wrapper_dry_run.sql (${Math.round(Buffer.byteLength(sql) / 1024)} KB)`);
console.log(`  sha256: ${sha}`);
console.log("  target: staging SQL Editor only; ends with ROLLBACK");

