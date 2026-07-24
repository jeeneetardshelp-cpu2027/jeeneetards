import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const migration = read("./migrations/comparison_metadata_v8.sql");
const verifier = read("./scripts/verifyComparison.js");
const stagingBuilder = read("./scripts/buildStagingBootstrap.js");
const productionBuilder = read("./scripts/buildProductionMigration.js");

describe("v8 comparison foundation source gates", () => {
  it("extends the bigint schema instead of recreating existing content tables", () => {
    expect(migration).toMatch(/playlist_id\s+bigint primary key/i);
    expect(migration).toMatch(/p_playlist_ids\s+bigint\[\]/i);
    expect(migration).not.toMatch(/create table if not exists public\.playlist_videos/i);
    expect(migration).not.toMatch(/sequence_order/i);
    expect(migration).not.toMatch(/p_playlist_ids\s+uuid\[\]/i);
  });

  it("keeps judgments nullable and gates every public claim on verification", () => {
    expect(migration).toMatch(/case when pa\.review_status = 'verified' then pa\.pacing end/i);
    expect(migration).toMatch(/case when pa\.review_status = 'verified' then pa\.theory_percentage end/i);
    expect(migration).not.toMatch(/coalesce\(pa\.(pacing|theory_percentage|prerequisites_level)/i);
    expect(migration).not.toMatch(/is_complete\s+boolean\s+default\s+true/i);
  });

  it("returns duration only when every chapter lecture has a known duration", () => {
    expect(migration).toMatch(/known_duration_count = chapter_stats\.lecture_count/i);
    expect(migration).toMatch(/then chapter_stats\.duration_seconds\s+else null/i);
  });

  it("scopes coverage to chapter, learning goal, and verified video mappings", () => {
    expect(migration).toMatch(/lgt\.learning_goal_id = p_learning_goal_id/i);
    expect(migration).toMatch(/t\.chapter_id = p_chapter_id/i);
    expect(migration).toMatch(/vt\.review_status = 'verified'/i);
    expect(migration).toMatch(/coverage\.required_topics = 0\s+then null/i);
  });

  it("bounds public comparison and explicitly reports missing context", () => {
    expect(migration).toMatch(/at most 4 playlists may be compared/i);
    expect(migration).toMatch(/'not-found'/i);
    expect(migration).toMatch(/'wrong-chapter'/i);
    expect(migration).toMatch(/security definer\s+set search_path = ''/i);
  });

  it("has non-vacuous staging checks for the truth rules", () => {
    expect(verifier).toMatch(/Comparison control chapter/);
    expect(verifier).not.toMatch(/otherChapter:\s*physicsChapters\[1\]/);
    expect(verifier.match(/source:\s*"editorial-review"/g)).toHaveLength(2);
    expect(verifier).toMatch(/chapter_duration_seconds\) === 1500/i);
    expect(verifier).toMatch(/chapter_duration_seconds === null/i);
    expect(verifier).toMatch(/syllabus_coverage_pct\) === 66\.67/i);
    expect(verifier).toMatch(/proposed editorial claims are invisible/i);
    expect(verifier).toMatch(/raw editorial tables are not readable anonymously/i);
  });

  it("refreshes the PostgREST schema cache after committing new API objects", () => {
    expect(migration).toMatch(/notify\s+pgrst\s*,\s*'reload schema'/i);
  });

  it("remains absent from both verified builders", () => {
    expect(stagingBuilder).not.toMatch(/comparison_metadata_v8|comparison_staging_delta/i);
    expect(productionBuilder).not.toMatch(/comparison_metadata_v8|comparison_staging_delta/i);
  });
});
