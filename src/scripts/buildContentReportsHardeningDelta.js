import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = readFileSync(
  resolve(root, "src/migrations/content_reports_hardening_v10.sql"),
  "utf8",
);
const output = resolve(root, "content_reports_hardening_staging_delta.sql");
const manifest = resolve(root, "content_reports_hardening_staging_delta.sha256.txt");
const hash = createHash("sha256").update(source).digest("hex");

writeFileSync(output, source, "utf8");
writeFileSync(manifest, `${hash}  content_reports_hardening_staging_delta.sql\n`, "utf8");
console.log(`✓ content_reports_hardening_staging_delta.sql (${source.split(/\r?\n/).length} lines)`);
console.log(`  sha256 ${hash}`);
