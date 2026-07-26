import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const harness = readFileSync(
  resolve("src/scripts/verifyPerVideoChapterImportStaging.js"),
  "utf8",
);
const safety = readFileSync(
  resolve("src/scripts/v12StagingHarnessSafety.js"),
  "utf8",
);
const helper = readFileSync(
  resolve(
    "src/migrations/per_video_chapter_import_v12_staging_test_helpers.sql",
  ),
  "utf8",
);
const helperRollback = readFileSync(
  resolve(
    "src/migrations/per_video_chapter_import_v12_staging_test_helpers_rollback.sql",
  ),
  "utf8",
);
const productionBuilder = readFileSync(
  resolve("src/scripts/buildProductionMigration.js"),
  "utf8",
);

describe("v12 disposable-staging harness source contract", () => {
  it("is an explicit standalone command and is excluded from routine test runs", () => {
    expect(packageJson.scripts["verify:v12-import-staging"]).toBe(
      "node src/scripts/verifyPerVideoChapterImportStaging.js",
    );
    expect(packageJson.scripts["test:all"]).not.toContain(
      "verify:v12-import-staging",
    );
    expect(packageJson.scripts["test:all"]).not.toContain(
      "verifyPerVideoChapterImportStaging",
    );
    expect(harness).not.toMatch(/per_video_chapter_import_v12\.sql/);
    expect(harness).not.toMatch(/supabase\s+(db|migration)/i);
  });

  it("requires three local opt-ins plus independent target identity guards", () => {
    expect(safety).toMatch(/TEST_ALLOW=1/);
    expect(safety).toMatch(/V12_TEST_ALLOW=1/);
    expect(safety).toMatch(/--confirm-disposable-v12-staging/);
    expect(safety).toMatch(/matches a known production URL/);
    expect(harness).toMatch(
      /\["staging", "test"\]\.includes\(marker\?\.name\)/,
    );

    const run = harness.slice(harness.indexOf("async function run()"));
    const staticConfig = run.indexOf("validateV12StagingConfig(rawConfig)");
    const liveMarker = run.indexOf("await assertLiveEnvironment(service)");
    const capabilities = run.indexOf("await assertCapabilities()");
    const references = run.indexOf("references = await loadReferences()");
    const collisions = run.indexOf("await assertNoCollisions()");
    const cleanupAuthorization = run.indexOf("cleanupAuthorized = true");
    const mutationAuthorization = run.indexOf("mutationsAttempted = true");
    const firstWriteCall = run.indexOf("await createBaseFixtures()");
    expect(staticConfig).toBeGreaterThan(-1);
    expect(liveMarker).toBeGreaterThan(staticConfig);
    expect(capabilities).toBeGreaterThan(liveMarker);
    expect(references).toBeGreaterThan(capabilities);
    expect(collisions).toBeGreaterThan(references);
    expect(cleanupAuthorization).toBeGreaterThan(collisions);
    expect(mutationAuthorization).toBeGreaterThan(cleanupAuthorization);
    expect(firstWriteCall).toBeGreaterThan(mutationAuthorization);
  });

  it("collision-checks every generated catalogue and request identity", () => {
    expect(harness).toMatch(
      /Object\.values\(tokens\.playlists\)[\s\S]*Object\.values\(tokens\.channels\)[\s\S]*Object\.values\(tokens\.requestIds\)/,
    );
    expect(harness).toMatch(/in\("youtube_playlist_id", playlistIds\)/);
    expect(harness).toMatch(/in\("youtube_video_id", allVideoIds\(\)\)/);
    expect(harness).toMatch(/in\("youtube_channel_id", channelIds\)/);
    expect(harness).toMatch(/in\("slug", tokens\.chapterSlugs\)/);
    expect(harness).toMatch(/in\("name", chapterNames\)/);
    expect(harness).toMatch(/in\("request_id", requestIds\)/);
    expect(harness).toMatch(
      /productionUrls:\s*\[\s*productionEnv\.VITE_SUPABASE_URL,\s*process\.env\.PRODUCTION_SUPABASE_URL/s,
    );
  });

  it("covers authorization, replay, drift, rollback, and both lock outcomes", () => {
    for (const evidence of [
      "anonymous mapped import is denied",
      "confirmed non-admin mapped import is denied",
      "anonymous caller is denied access to a known import audit row",
      "confirmed non-admin sees zero rows for a known import audit",
      "promoted fixture admin reads exactly one known import audit row",
      "exact replay is read-only",
      "same request ID with changed payload is rejected",
      "new request cannot overwrite an existing source course",
      "nonstructural video refresh",
      "structural chapter drift refuses replay",
      "deleted course cannot be resurrected",
      "mid-transaction failure leaves no playlist, video, channel, or audit",
      "concurrent imports sharing an identical mapping both succeed",
      "conflicting concurrent mappings permit exactly one winner",
    ]) {
      expect(harness).toContain(evidence);
    }
    expect(harness).toMatch(/audits\.length === 4/);
    const promotionScope = harness.slice(
      harness.indexOf("let promoted;"),
      harness.indexOf("const replay = must("),
    );
    expect(promotionScope.indexOf("try {")).toBeGreaterThan(-1);
    expect(
      promotionScope.indexOf(
        "promote fixture user for positive audit policy check",
      ),
    ).toBeGreaterThan(promotionScope.indexOf("try {"));
    expect(promotionScope.indexOf("} finally {")).toBeGreaterThan(
      promotionScope.indexOf(
        "promote fixture user for positive audit policy check",
      ),
    );
    expect(promotionScope).toMatch(/is_admin: false/);
    expect(harness).toMatch(
      /"cleanup fixture admin role"[\s\S]*is_admin: false/,
    );
    expect(harness).toMatch(
      /async function mappedImport\(client, payload, timeoutMs = 30_000\)/,
    );
    expect(harness).toMatch(/\.abortSignal\(controller\.signal\)/);
    expect(harness).toMatch(/code: "HARNESS_TIMEOUT"/);
  });

  it("revalidates staging and removes protected audit evidence last", () => {
    const cleanup = harness.slice(
      harness.indexOf("async function cleanupExactFixtures()"),
      harness.indexOf("async function run()"),
    );
    const liveMarker = cleanup.indexOf("await assertLiveEnvironment(service)");
    const demotion = cleanup.indexOf(
      '"demote fixture user before quiescence"',
    );
    const quiescence = cleanup.indexOf(
      '"quiesce_v12_import_test_requests"',
    );
    const playlists = cleanup.indexOf('"cleanup playlists"');
    const videos = cleanup.indexOf('"cleanup videos"');
    const channels = cleanup.indexOf('"cleanup channels"');
    const chapters = cleanup.indexOf('"cleanup chapters"');
    const user = cleanup.indexOf("deleteUser(createdUserId)");
    const residueBeforeAudit = cleanup.indexOf(
      "collectResidue({ includeAudit: false })",
    );
    const audit = cleanup.indexOf('"cleanup_v12_import_test_audit"');
    expect(liveMarker).toBeGreaterThan(-1);
    expect(demotion).toBeGreaterThan(liveMarker);
    expect(quiescence).toBeGreaterThan(demotion);
    expect(playlists).toBeGreaterThan(quiescence);
    expect(videos).toBeGreaterThan(playlists);
    expect(channels).toBeGreaterThan(videos);
    expect(chapters).toBeGreaterThan(channels);
    expect(user).toBeGreaterThan(chapters);
    expect(residueBeforeAudit).toBeGreaterThan(user);
    expect(audit).toBeGreaterThan(residueBeforeAudit);
    expect(cleanup).toMatch(/p_run_token: runId/);
    expect(cleanup).toMatch(
      /p_request_ids: Object\.values\(tokens\.requestIds\)/,
    );
    expect(cleanup).toMatch(/collectResidue\(\)/);
    expect(cleanup).toMatch(/report\.cleanup\.requests_quiesced = true/);
    expect(harness).toMatch(/\.from\("profiles"\)\.select\("id"\)/);
  });

  it("writes only a redacted external report and never claims to apply SQL", () => {
    expect(harness).toMatch(
      /outputDirectory = resolve\(root, "\.\.\/outputs\/v12-import"\)/,
    );
    expect(harness).toMatch(
      /configuration: redactV12StagingConfig\(rawConfig\)/,
    );
    expect(harness).toMatch(/production_touched: false/);
    expect(harness).toMatch(/migrations_applied_by_harness: false/);
    expect(harness).not.toMatch(/configuration:\s*rawConfig/);
  });
});

describe("v12 staging-only SQL helper source contract", () => {
  it("refuses production or incomplete v12 before installing any DDL", () => {
    const guard = helper.indexOf("do $apply_guard$");
    const firstFunction = helper.indexOf(
      "create or replace function public.per_video_chapter_import_v12_test_capability",
    );
    expect(guard).toBeGreaterThan(helper.indexOf("begin;"));
    expect(firstFunction).toBeGreaterThan(guard);
    expect(helper).toMatch(/perform public\.__assert_not_production\(\)/);
    expect(helper).toMatch(
      /to_regprocedure\(\s*'public\.import_playlist_with_chapters\(jsonb,text\)'/i,
    );
    expect(helper).toMatch(
      /to_regprocedure\(\s*'public\.per_video_chapter_import_capability\(\)'/i,
    );
    expect(helper).toMatch(/to_regclass\('public\.playlist_import_audit'\)/);
    expect(helper).toMatch(/'all_or_none_mapping'\)::boolean/);
    expect(helper).toMatch(/'audit_snapshot'\)::boolean/);
  });

  it("keeps failure injection deterministic and inert outside its reserved ID", () => {
    expect(helper).toMatch(/before update of chapter_id on public\.videos/i);
    expect(helper).toMatch(/old\.chapter_id is null/i);
    expect(helper).toMatch(/new\.chapter_id is not null/i);
    expect(helper).toMatch(/new\.youtube_video_id like 'V12FX%'/i);
    expect(helper).toMatch(/perform public\.__assert_not_production\(\)/);
  });

  it("locks, checks, and independently bounds exact per-run audit cleanup", () => {
    expect(helper).toMatch(
      /quiesce_v12_import_test_requests\(\s*p_run_token text,\s*p_request_ids uuid\[\]/i,
    );
    expect(helper).toMatch(
      /set_config\('lock_timeout', '15s', true\)[\s\S]*pg_advisory_xact_lock/i,
    );
    expect(helper).toMatch(
      /revoke all on function public\.quiesce_v12_import_test_requests\(text, uuid\[\]\)\s+from public, anon, authenticated, service_role/i,
    );
    expect(helper).toMatch(
      /grant execute on function public\.quiesce_v12_import_test_requests\(text, uuid\[\]\)\s+to service_role/i,
    );
    expect(helper).toMatch(
      /cleanup_v12_import_test_audit\(\s*p_run_token text,\s*p_request_ids uuid\[\]/i,
    );
    expect(helper).toMatch(/p_run_token !~ '\^\[0-9a-f\]\{6\}\$'/);
    expect(helper).toMatch(/v_count < 1 or v_count > 20/);
    expect(helper).toMatch(/pg_advisory_xact_lock/);
    expect(helper).toMatch(/hashtextextended\(requested\.request_id::text, 12\)/);
    expect(helper).toMatch(
      /where audit\.request_id = any\(p_request_ids\)\s+and audit\.youtube_playlist_id like v_playlist_prefix/i,
    );
    expect(helper).toMatch(
      /revoke all on function public\.cleanup_v12_import_test_audit\(text, uuid\[\]\)\s+from public, anon, authenticated, service_role/i,
    );
    expect(helper).toMatch(
      /grant execute on function public\.cleanup_v12_import_test_audit\(text, uuid\[\]\)\s+to service_role/i,
    );
  });

  it("refuses helper rollback while fixture audit rows remain", () => {
    const auditGuard = helperRollback.indexOf(
      "where youtube_playlist_id like 'TESTV12%'",
    );
    const dropCleanup = helperRollback.indexOf(
      "drop function if exists public.cleanup_v12_import_test_audit",
    );
    expect(helperRollback).toMatch(
      /v_environment not in \('staging', 'test'\)/,
    );
    expect(auditGuard).toBeGreaterThan(-1);
    expect(dropCleanup).toBeGreaterThan(auditGuard);
    expect(helperRollback).toMatch(/run exact cleanup first/);
    expect(helperRollback).toMatch(
      /from public\.playlists\s+where youtube_playlist_id like 'TESTV12%'/i,
    );
    expect(helperRollback).toMatch(
      /from public\.institutes_channels\s+where youtube_channel_id like 'TESTV12%'/i,
    );
    expect(helperRollback).toMatch(
      /from public\.chapters\s+where slug like 'testv12-%'/i,
    );
    expect(helperRollback).toMatch(
      /from auth\.users\s+where email like 'v12-staging-%@example\.com'/i,
    );
  });

  it("is never included in the cumulative production builder", () => {
    expect(productionBuilder).not.toContain(
      "per_video_chapter_import_v12_staging_test_helpers",
    );
    expect(productionBuilder).not.toContain(
      "per_video_chapter_import_v12_test_capability",
    );
  });
});
