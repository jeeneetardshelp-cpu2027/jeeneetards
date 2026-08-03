import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const chapterSource = readFileSync(
  "docs/sql/competishun_prmo_ioqm_chapter_2026-08-03.sql",
  "utf8",
);
const courseSource = readFileSync(
  "docs/sql/competishun_prmo_ioqm_solutions_2026-08-03.sql",
  "utf8",
);

describe("Competishun PRMO/IOQM production package", () => {
  it("pins the reviewed Gate 1 artifact hash", () => {
    expect(createHash("sha256").update(chapterSource, "utf8").digest("hex")).toBe(
      "9eac1540f7b5c580ae548d812b96f05009b84e5b466d1bc3ef17d3becccef91a",
    );
  });

  it("is guarded create-only chapter and class-scope SQL", () => {
    expect(chapterSource).toContain("begin;");
    expect(chapterSource).toContain("insert into public.chapters");
    expect(chapterSource).toContain("insert into public.chapter_class_levels");
    expect(chapterSource).toContain("PRMO and IOQM Solutions");
    expect(chapterSource).toContain("prmo-and-ioqm-solutions");
    expect(chapterSource).toContain(
      "https://olympiads.hbcse.tifr.res.in/how-to-prepare/past-papers/",
    );
    expect(chapterSource).toContain("where cl.slug in ('class-11', 'class-12')");
    expect(chapterSource).toContain("commit;");
    expect(chapterSource).not.toMatch(/\b(update|delete|drop|alter|truncate)\b/i);
  });

  it("pins exact baseline, reuse, and protected-fingerprint guards", () => {
    expect(chapterSource).toContain("from public.playlists) <> 310");
    expect(chapterSource).toContain("from public.videos) <> 3637");
    expect(chapterSource).toContain("from public.playlist_videos) <> 3643");
    expect(chapterSource).toContain("from public.chapters) <> 241");
    expect(chapterSource).toContain("from public.chapter_class_levels) <> 90");
    expect(chapterSource).toContain("dows6wBBk3A");
    expect(chapterSource).toContain("X3BWR79DtyU");
    expect(chapterSource).toContain("c742fabf93ff8dd33d6ecd5eb4793db0");
  });

  it("pins the reviewed Gate 2 artifact hash", () => {
    expect(createHash("sha256").update(courseSource, "utf8").digest("hex")).toBe(
      "c017a5dcc6e68c5cd5b45fe45180bfb9f565dfa34cf7a82821e4d6df9caa6874",
    );
  });

  it("is a source-ID-null, create-only Competishun+ course artifact", () => {
    expect(courseSource).toContain("insert into public.playlists");
    expect(courseSource).toContain("insert into public.videos");
    expect(courseSource).toContain("insert into public.playlist_videos");
    expect(courseSource).toContain(
      "playlist_videos(playlist_id,video_id,position)",
    );
    expect(courseSource).toContain("'PRMO & IOQM Solutions (2018'");
    expect(courseSource).toContain("chr(8211)");
    expect(courseSource).toContain("youtube_playlist_id is null");
    expect(courseSource).toContain("1c06eb34-fbdc-4d3b-a239-39f256f889e8");
    expect(courseSource).toContain("'Competishun+',81,3,3");
    expect(courseSource).toContain("values(r.y,r.t,r.s,81,3,3,298,r.d");
    expect(courseSource).toContain("'pyq','hinglish'");
    expect(courseSource).not.toMatch(/\b(update|delete|drop|alter|truncate)\b/i);
  });

  it("guards exact Gate 2 totals, fingerprints, non-reuse, and lesson order", () => {
    expect(courseSource).toContain(
      "row(317::bigint,3728::bigint,3734::bigint,242::bigint,92::bigint)",
    );
    expect(courseSource).toContain(
      "row(318::bigint,3732::bigint,3738::bigint,4::bigint,12::bigint)",
    );
    expect(courseSource).toContain(
      "dows6wBBk3A,3YvuUlM2OHY,2qm5UjRyIcs,X3BWR79DtyU",
    );
    expect(courseSource).toContain("PRMO/IOQM baseline or reuse mismatch");
  });
});
