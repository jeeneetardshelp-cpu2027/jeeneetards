import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const draft = readFileSync("src/migrations/content_taxonomy_v15_draft.sql", "utf8");
const GUARD = /do \$not_approved\$[\s\S]*?\$not_approved\$;\s*/;
const executable = draft.replace(GUARD, "");

async function database() {
  const pg = new PGlite();
  await pg.exec(`
    create role anon;
    create role authenticated;
    create table public.playlists (
      id bigint generated always as identity primary key,
      title text not null,
      content_type text,
      difficulty text
    );
    create table public.videos (
      id bigint generated always as identity primary key,
      title text not null
    );
    insert into public.playlists (title, content_type, difficulty)
      values ('Existing course', 'full-course', 'advanced');
    insert into public.videos (title) values ('Existing lesson');
  `);
  await pg.exec(executable);
  return pg;
}

describe("content taxonomy v15 review-only migration", () => {
  it("is fail-closed and never rewrites existing catalogue tables", () => {
    expect(draft).toMatch(/NOT APPROVED: content taxonomy v15/i);
    expect(draft).not.toMatch(/alter\s+table\s+public\.(playlists|videos)\b/i);
    expect(draft).not.toMatch(/(?:update|delete\s+from)\s+public\.(playlists|videos)\b/i);
    expect(draft).not.toMatch(/insert\s+into\s+public\.(playlists|videos)\b/i);
  });

  it("executes on an isolated PostgreSQL database with zero inferred rows", async () => {
    const pg = await database();
    try {
      const state = await pg.query(`
        select
          (select count(*)::integer from public.playlists) as playlists,
          (select count(*)::integer from public.videos) as videos,
          (select count(*)::integer from public.playlist_content_taxonomy) as course_taxonomy,
          (select count(*)::integer from public.video_content_taxonomy) as video_taxonomy
      `);
      expect(state.rows[0]).toEqual({
        playlists: 1,
        videos: 1,
        course_taxonomy: 0,
        video_taxonomy: 0,
      });
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("stores format and multiple purposes independently", async () => {
    const pg = await database();
    try {
      await pg.exec(`
        insert into public.playlist_content_taxonomy (
          playlist_id, content_format, learning_purposes, exam_scopes,
          target_cohorts, teaching_depth, coverage_level, completion_status,
          review_status, review_decision_id, evidence_url, review_note, reviewed_at
        ) values (
          1, 'one-shot', array['revision','pyq'], array['jee-main','jee-advanced'],
          array['class-12','dropper'], 'standard', 'chapter', 'complete',
          'verified', '00000000-0000-4000-8000-000000000001',
          'https://www.youtube.com/playlist?list=PLreviewed',
          'Owner-reviewed source and taxonomy evidence.', now()
        );
      `);
      const row = await pg.query(`
        select content_format, learning_purposes, exam_scopes, target_cohorts
        from public.playlist_content_taxonomy where playlist_id = 1
      `);
      expect(row.rows[0]).toEqual({
        content_format: "one-shot",
        learning_purposes: ["revision", "pyq"],
        exam_scopes: ["jee-main", "jee-advanced"],
        target_cohorts: ["class-12", "dropper"],
      });
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("rejects unreviewed public claims, invalid values and duplicate purposes", async () => {
    const pg = await database();
    try {
      await expect(pg.exec(`
        insert into public.playlist_content_taxonomy (
          playlist_id, content_format, learning_purposes, exam_scopes,
          target_cohorts, teaching_depth, coverage_level, completion_status,
          review_status
        ) values (
          1, 'series', array['theory'], array['jee-main'], array['class-11'],
          'standard', 'chapter', 'complete', 'verified'
        )
      `)).rejects.toThrow(/playlist_taxonomy_verified_gate/i);

      await expect(pg.exec(`
        insert into public.playlist_content_taxonomy (
          playlist_id, learning_purposes
        ) values (1, array['revision','revision'])
      `)).rejects.toThrow(/playlist_taxonomy_purposes_check/i);

      await expect(pg.exec(`
        insert into public.video_content_taxonomy (
          video_id, content_format, learning_purposes
        ) values (1, 'vertical-video', array['theory'])
      `)).rejects.toThrow(/video_taxonomy_format_check/i);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("supports a reviewed Short without placing it in an existing course row", async () => {
    const pg = await database();
    try {
      await pg.exec(`
        insert into public.video_content_taxonomy (
          video_id, content_format, learning_purposes, review_status,
          review_decision_id, evidence_url, review_note, reviewed_at
        ) values (
          1, 'short', array['revision'], 'verified',
          '00000000-0000-4000-8000-000000000002',
          'https://www.youtube.com/shorts/abcdefghijk',
          'Owner-reviewed short-form classification.', now()
        )
      `);
      const row = await pg.query(`
        select content_format, learning_purposes
        from public.video_content_taxonomy where video_id = 1
      `);
      expect(row.rows[0]).toEqual({
        content_format: "short",
        learning_purposes: ["revision"],
      });
      const legacy = await pg.query("select content_type, difficulty from public.playlists where id = 1");
      expect(legacy.rows[0]).toEqual({ content_type: "full-course", difficulty: "advanced" });
    } finally {
      await pg.close();
    }
  }, 30_000);
});
