import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("src/migrations/per_video_chapter_import_v12.sql"),
  "utf8",
);
const preflight = readFileSync(
  resolve("src/migrations/per_video_chapter_import_v12_preflight.sql"),
  "utf8",
);
const postflight = readFileSync(
  resolve("src/migrations/per_video_chapter_import_v12_postflight.sql"),
  "utf8",
);
const rollback = readFileSync(
  resolve("src/migrations/per_video_chapter_import_v12_rollback.sql"),
  "utf8",
);
const importer = readFileSync(resolve("src/scripts/importChannel.js"), "utf8");
const ingestionSafety = readFileSync(
  resolve("src/scripts/ingestionSafety.js"),
  "utf8",
);

describe("per-video chapter import v12 source contract", () => {
  it("is additive and leaves the legacy importer signature untouched", () => {
    expect(migration).toMatch(
      /create or replace function public\.import_playlist_with_chapters\(/i,
    );
    expect(migration).not.toMatch(
      /create or replace function public\.import_playlist\s*\(/i,
    );
    expect(migration).toMatch(
      /public\.import_playlist\(\s*payload - 'request_id' - 'chapter_id' - 'chapter_name'/i,
    );
  });

  it("requires a durable all-or-none mapping to existing same-subject chapters", () => {
    expect(migration).toMatch(/request_id is required for mapped chapter import/i);
    expect(migration).toMatch(
      /mapped chapter import forbids top-level chapter_id\/chapter_name/i,
    );
    expect(migration).toMatch(
      /every mapped video requires a positive whole-number chapter_id/i,
    );
    expect(migration).toMatch(/v_chapter_count < 2/i);
    expect(migration).toMatch(
      /c\.subject_id is distinct from v_subject_id/i,
    );
  });

  it("is create-only and turns an identical request retry into a replay", () => {
    expect(migration).toMatch(/mode is distinct from 'merge'/i);
    expect(migration).toMatch(
      /source playlist already exists; mapped v12 import is create-only/i,
    );
    expect(migration).toMatch(
      /v_existing_audit\.request_payload is distinct from payload/i,
    );
    expect(migration).toMatch(
      /v_current_state is distinct from v_existing_audit\.after_state/i,
    );
    expect(migration).toMatch(/idempotent replay refused/i);
    expect(migration).toMatch(/'idempotent_replay', true/i);
  });

  it("locks reusable videos and rejects subject, chapter, or concurrency drift", () => {
    const playlistLock = migration.indexOf(
      "pg_advisory_xact_lock(hashtext(v_source_playlist_id))",
    );
    const videoRowLock = migration.indexOf(
      "from jsonb_array_elements(payload->'videos') e(item)",
      playlistLock,
    );
    const forUpdate = migration.indexOf("for update of v;", videoRowLock);
    expect(playlistLock).toBeGreaterThan(-1);
    expect(videoRowLock).toBeGreaterThan(playlistLock);
    expect(forUpdate).toBeGreaterThan(videoRowLock);
    expect(migration).toMatch(
      /order by item->>'youtube_video_id'/i,
    );
    expect(migration).toMatch(/pg_advisory_xact_lock\(/i);
    expect(migration).toMatch(
      /v\.chapter_id is distinct from \(item->>'chapter_id'\)::bigint/i,
    );
    expect(migration).toMatch(
      /videos_reused'\)::int <> v_expected_reused/i,
    );
    expect(migration).toMatch(/video chapter changed concurrently/i);
  });

  it("binds the request to reviewed manifest and source evidence", () => {
    expect(migration).toMatch(/v_manifest_sha256.*payload->>'manifest_sha256'/is);
    expect(migration).toMatch(
      /v_source_snapshot_sha256.*payload->>'source_snapshot_sha256'/is,
    );
    expect(migration).toMatch(
      /manifest_assignment_count must equal the mapped video count/i,
    );
    expect(importer).toMatch(/manifestSha256: plan\.chapterManifestSha256/);
    expect(importer).toMatch(/sourceSnapshotSha256: sourceSnapshotSha256\(ytVideos\)/);
    expect(importer).toMatch(/mappedSourceSnapshotEvidence\(videos\)/);
    expect(ingestionSafety).toMatch(/validateMappedSourcePositions\(videos\)/);
    expect(ingestionSafety).not.toMatch(/expectedPosition.*index \+ 1/s);
    expect(ingestionSafety).toMatch(/payload\.manifest_assignment_count = videos\.length/);
  });

  it("records an audit snapshot only after every chapter assignment", () => {
    const baseImport = migration.indexOf("v_result := public.import_playlist(");
    const chapterUpdate = migration.indexOf("set chapter_id = v_requested_chapter_id");
    const auditInsert = migration.indexOf("insert into public.playlist_import_audit");
    expect(baseImport).toBeGreaterThan(-1);
    expect(chapterUpdate).toBeGreaterThan(baseImport);
    expect(auditInsert).toBeGreaterThan(chapterUpdate);
    expect(migration).toMatch(/alter table public\.playlist_import_audit enable row level security/i);
    expect(migration).toMatch(
      /revoke all on table public\.playlist_import_audit\s+from public, anon, authenticated, service_role/i,
    );
    expect(migration).toMatch(
      /revoke all on sequence public\.playlist_import_audit_id_seq\s+from public, anon, authenticated, service_role/i,
    );
    expect(migration).toMatch(
      /create or replace function public\.per_video_chapter_import_video_snapshot/i,
    );
    expect(migration).not.toMatch(/'ratings',/i);
  });

  it("publishes a capability gate and packages read-only evidence plus code rollback", () => {
    expect(migration).toMatch(/'version', 12/i);
    expect(migration).toMatch(/'per_video_chapter_id', true/i);
    expect(migration).toMatch(/'all_or_none_mapping', true/i);
    expect(migration).toMatch(/'create_only', true/i);
    expect(migration).toMatch(/'request_replay', true/i);
    expect(migration).toMatch(/'audit_snapshot', true/i);
    expect(migration).toMatch(
      /grant execute on function public\.per_video_chapter_import_capability\(\)\s+to anon, authenticated, service_role/i,
    );
    expect(preflight).toMatch(/begin read only/i);
    expect(preflight).toMatch(/catalog_playlist_snapshot/i);
    expect(postflight).toMatch(/begin read only/i);
    expect(postflight).toMatch(/per_video_chapter_import_capability/i);
    expect(postflight).toMatch(/admin reads playlist import audit/i);
    expect(postflight).toMatch(
      /has_table_privilege\(\s*'authenticated',\s*'public\.playlist_import_audit'/i,
    );
    expect(postflight).toMatch(
      /has_sequence_privilege\(\s*'authenticated',\s*'public\.playlist_import_audit_id_seq'/i,
    );
    expect(rollback).toMatch(
      /drop function if exists public\.import_playlist_with_chapters/i,
    );
    expect(rollback).toMatch(/Audit evidence and imported catalogue data are retained/i);
  });

  it("makes the CLI capability-check before calling the mapped RPC", () => {
    expect(importer).toMatch(/await assertMappedImportCapability\(db\)/);
    expect(importer).toMatch(/rpc = "import_playlist_with_chapters"/);
    expect(importer).toMatch(/Mapped import requires every reviewed chapter to exist first/i);
    expect(importer).toMatch(/Mapped import has .* unresolved quality/is);
    expect(importer).toMatch(/mappedImportBlockingFindings\(quality\.findings\)/);
    expect(importer).toMatch(/mapped_atomic_verification_findings/);
    expect(importer).toMatch(/source_playlist_replay_unverified/);
    expect(importer).toMatch(/from\("playlist_import_audit"\)/);
    expect(importer).toMatch(/if \(data\.idempotent_replay\)/);
    expect(importer).toMatch(/no rows changed/i);
  });
});
