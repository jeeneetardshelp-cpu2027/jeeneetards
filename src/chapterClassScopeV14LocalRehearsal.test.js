import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(
  resolve(import.meta.dirname, "scripts/rehearseChapterClassScopeV14Local.js"),
  "utf8",
);

describe("chapter class scope v14 local rehearsal", () => {
  it("pins the production snapshot target and reviewed SQL hashes", () => {
    expect(script).toContain("kezelafqhgqrprpadmlf.supabase.co");
    expect(script).toContain(
      "c6961481247c74a36cb449aa6bfab45627ccc2fe2fb876f3701bc0c129ca7315",
    );
    expect(script).toContain(
      "dd46b3456c49c31d1d235e2e9ba3919cb1188a211c4eeb6821aa7a0966ce5dd0",
    );
    expect(script).toContain("chapter_class_scopes_v13_browse_draft.sql");
    expect(script).toContain("rollback_rehearsal.sql");
  });

  it("uses anonymous GET-only production access", () => {
    expect(script).toContain("VITE_SUPABASE_ANON_KEY");
    expect(script).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(script).not.toContain("createClient(");
    expect(script.match(/method: "GET"/g)).toHaveLength(2);
    expect(script).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
  });

  it("checks snapshot stability before running SQL locally", () => {
    expect(script).toContain("beforeCounts");
    expect(script).toContain("afterCounts");
    expect(script).toContain("Production changed during the read-only snapshot");
    expect(script).toContain("snapshot mismatch");
    expect(script).toContain('order: "id.asc"');
    expect(script).toContain('url.searchParams.set("order", order)');
  });

  it("uses an ephemeral in-memory Postgres and verifies rollback", () => {
    expect(script).toContain('import { PGlite } from "@electric-sql/pglite"');
    expect(script).toContain("const pg = new PGlite();");
    expect(script).not.toMatch(/new PGlite\((?:'|")/);
    expect(script).toContain("v14 rollback verified; no persistent database change");
    expect(script).toContain("finalScopeCount.rows[0].n !== 5");
    expect(script).toContain("await pg.close()");
  });
});
