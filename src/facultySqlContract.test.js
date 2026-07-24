import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync("src/migrations/teachers_v7_import.sql", "utf8");
const ADMIN_SQL = readFileSync("src/migrations/teachers_v7_admin_ui.sql", "utf8");
const STAGING = readFileSync("src/scripts/buildStagingBootstrap.js", "utf8");
const PRODUCTION = readFileSync("src/scripts/buildProductionMigration.js", "utf8");
const FACULTY_BUILDER = readFileSync("src/scripts/buildFacultyStagingDelta.js", "utf8");
const FACULTY_VERIFIER = readFileSync("src/scripts/verifyFaculty.js", "utf8");
const FOUNDATION_SQL = readFileSync("src/migrations/teachers_v7.sql", "utf8");
const SEARCH_SQL = readFileSync("src/migrations/universal_search.sql", "utf8");
const REPAIR_SQL = readFileSync("src/migrations/faculty_staging_repair_1.sql", "utf8");

describe("faculty SQL stays isolated until staging evidence exists", () => {
  it("is absent from both executable migration builders", () => {
    expect(STAGING).not.toContain('"src/migrations/teachers_v7.sql"');
    expect(STAGING).not.toContain('"src/migrations/teachers_v7_import.sql"');
    expect(STAGING).not.toContain('"src/migrations/teachers_v7_admin_ui.sql"');
    expect(PRODUCTION).not.toContain('"src/migrations/teachers_v7.sql"');
    expect(PRODUCTION).not.toContain('"src/migrations/teachers_v7_import.sql"');
    expect(PRODUCTION).not.toContain('"src/migrations/teachers_v7_admin_ui.sql"');
  });

  it("has a separate disposable-staging builder in dependency order", () => {
    const foundation = FACULTY_BUILDER.indexOf('"src/migrations/teachers_v7.sql"');
    const imports = FACULTY_BUILDER.indexOf('"src/migrations/teachers_v7_import.sql"');
    const admin = FACULTY_BUILDER.indexOf('"src/migrations/teachers_v7_admin_ui.sql"');
    const search = FACULTY_BUILDER.indexOf('"src/migrations/universal_search.sql"');
    expect(foundation).toBeGreaterThan(-1);
    expect(foundation).toBeLessThan(imports);
    expect(imports).toBeLessThan(admin);
    expect(admin).toBeLessThan(search);
    expect(FACULTY_BUILDER).toContain("DISPOSABLE STAGING ONLY");
  });

  it("guards the real-database verifier and cleans exact run-scoped ids", () => {
    expect(FACULTY_VERIFIER).toContain('cfg("TEST_ALLOW") !== "1"');
    expect(FACULTY_VERIFIER).toContain('URL === production.VITE_SUPABASE_URL');
    expect(FACULTY_VERIFIER).toContain('from("app_environment")');
    expect(FACULTY_VERIFIER).toContain('in("youtube_playlist_id", playlistIds)');
    expect(FACULTY_VERIFIER).not.toMatch(/\.like\(|\.ilike\(/);
    expect(FACULTY_VERIFIER).toContain("cleanup residue");
  });

  it("preserves Indic combining marks and reaches pg_trgm in Supabase's schema", () => {
    expect(FOUNDATION_SQL).toContain("[[:punct:][:space:]]+");
    expect(SEARCH_SQL).toContain("[[:punct:][:space:]]+");
    expect(FOUNDATION_SQL).not.toContain("[^[:alnum:]]+");
    expect(SEARCH_SQL).not.toContain("[^[:alnum:]]+");
    expect(FOUNDATION_SQL).toContain("public.catalog_similarity");
    expect(SEARCH_SQL).toContain("public.catalog_similarity");
    expect(FOUNDATION_SQL).toContain("e.extname = 'pg_trgm'");
    expect(SEARCH_SQL).toContain("e.extname = 'pg_trgm'");
    expect(FOUNDATION_SQL).not.toContain("extensions.similarity");
    expect(SEARCH_SQL).not.toContain("extensions.similarity");
  });

  it("makes the first staging repair self-checking and rebuilds expression indexes", () => {
    expect(REPAIR_SQL).toContain("Unicode person normalization is still broken");
    expect(REPAIR_SQL).toContain("public.catalog_similarity('amit', 'amit')");
    expect(REPAIR_SQL.match(/reindex index public\./g)).toHaveLength(7);
    expect(REPAIR_SQL).toContain("perform * from public.search_teachers");
    expect(REPAIR_SQL).toContain("perform * from public.universal_search");
  });

  it("keeps grouped review decisions transactional and admin-guarded", () => {
    expect(ADMIN_SQL).toContain("approve_faculty_review_group_as_new");
    expect(ADMIN_SQL).toContain("split_faculty_review_group");
    expect(ADMIN_SQL.match(/not authorized/g)?.length).toBeGreaterThanOrEqual(5);
    expect(ADMIN_SQL).not.toMatch(/grant execute[\s\S]*to anon/);
  });

  it("advertises import support separately from teacher search", () => {
    expect(SQL).toContain("faculty_import_capability");
    expect(SQL).toContain("'teacher_ids_supported', true");
  });

  it("validates faculty before the first underlying import write", () => {
    const wrapper = SQL.slice(SQL.indexOf("public.import_playlist_with_teachers"));
    expect(wrapper.indexOf("validate_teacher_ids_payload(payload)"))
      .toBeLessThan(wrapper.indexOf("public.import_playlist(payload - 'teacher_ids', mode)"));
  });

  it("keeps replacement in the same transaction as content import", () => {
    expect(SQL).toContain("perform public.set_playlist_teachers(v_playlist_id, v_ids)");
    expect(SQL).toContain("public.create_course(payload - 'teacher_ids')");
  });

  it("does not grant faculty import to anonymous callers", () => {
    expect(SQL).toMatch(/revoke all on function public\.import_playlist_with_teachers[\s\S]*from public, anon/);
    expect(SQL).not.toMatch(/grant execute on function public\.import_playlist_with_teachers[\s\S]*to anon/);
  });
});
