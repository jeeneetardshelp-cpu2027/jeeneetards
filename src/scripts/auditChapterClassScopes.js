// Anonymous, read-only evidence for curriculum class/chapter cross-products.
//
//   npm run audit:chapter-classes
//   npm run audit:chapter-classes -- --goal neet --subject physics

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACADEMIC_CLASS_SLUGS,
  buildChapterClassScopeReport,
} from "./chapterClassScopeAudit.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(resolve(root, path), "utf8")
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i))
        .filter(Boolean)
        .map((match) => [
          match[1],
          match[2].replace(/^["']|["']$/g, "").trim(),
        ]),
    );
  } catch {
    return {};
  }
}

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function curriculum(client, goal, classSlug, subject) {
  const { data, error } = await client.rpc("get_browse_curriculum", {
    p_goal: goal,
    p_class: classSlug,
    p_subject: subject,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function main() {
  const env = { ...readEnv(".env"), ...process.env };
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required");

  const goal = argument("goal", "jee");
  const subject = argument("subject", "physics");
  const client = createClient(url, key, { auth: { persistSession: false } });

  const [unfilteredRows, ...classRows] = await Promise.all([
    curriculum(client, goal, null, subject),
    ...ACADEMIC_CLASS_SLUGS.map((classSlug) => curriculum(client, goal, classSlug, subject)),
  ]);
  const rowsByClass = Object.fromEntries(
    ACADEMIC_CLASS_SLUGS.map((classSlug, index) => [classSlug, classRows[index]]),
  );
  const report = buildChapterClassScopeReport(unfilteredRows, rowsByClass);

  console.log(JSON.stringify({ target: { goal, subject }, ...report }, null, 2));
}

main().catch((error) => {
  console.error(`chapter class audit: ${error.message}`);
  process.exitCode = 1;
});
