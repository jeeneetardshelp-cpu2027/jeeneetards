// Build the one-time repair discovered by the first real Phase 4 staging run.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = resolve(root, "src/migrations/faculty_staging_repair_1.sql");
const output = resolve(root, "faculty_staging_repair_1.sql");
const hashFile = resolve(root, "faculty_staging_repair_1.sha256.txt");
const sql = readFileSync(source, "utf8");
writeFileSync(output, sql, "utf8");
const sha = createHash("sha256").update(Buffer.from(sql, "utf8")).digest("hex");
writeFileSync(hashFile, `${sha}  faculty_staging_repair_1.sql\n`, "utf8");
console.log(`✓ faculty_staging_repair_1.sql written (${Math.round(Buffer.byteLength(sql) / 1024)} KB)`);
console.log(`  sha256: ${sha}`);
console.log("  target: disposable faculty staging only");
