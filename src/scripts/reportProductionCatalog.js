// Anonymous, read-only production catalogue inventory.
//
// This script uses the same public key as the browser and performs one SELECT.
// It never imports a service-role key and contains no insert/update/delete/RPC.
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCatalogInventory,
  findPlaylistOverlaps,
} from "./catalogInventory.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDirectory = resolve(root, "../outputs");
const outputPath = resolve(outputDirectory, "catalog-production-inventory.json");

function readEnv(path) {
  const values = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (match)
      values[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  return values;
}

const env = readEnv(resolve(root, ".env"));
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error("Public Supabase values are missing from .env.");
  process.exit(2);
}

const db = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await db
  .from("playlists")
  .select(
    "id,title,teacher,youtube_playlist_id,language,content_type,difficulty," +
      "average_rating,ratings_count,subjects(name,slug),institutes_channels(name)," +
      "playlist_videos(count)," +
      "playlist_learning_goals(learning_goals(name,slug))," +
      "playlist_class_levels(class_levels(name,slug))",
  )
  .order("id");

if (error) {
  console.error(`Catalogue inventory failed: ${error.message}`);
  process.exit(1);
}

const report = buildCatalogInventory(data);
const { data: memberships, error: membershipError } = await db
  .from("playlist_videos")
  .select("playlist_id,video_id,position,videos(youtube_video_id,title)")
  .order("playlist_id")
  .order("position");
if (membershipError) {
  console.error(`Playlist-overlap inventory failed: ${membershipError.message}`);
  process.exit(1);
}
report.overlaps = findPlaylistOverlaps(memberships, report.courses);
report.summary.duplicateCandidates = report.overlaps.filter(
  (overlap) => overlap.leftFullyContained || overlap.rightFullyContained,
).length;
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.table(report.courses.map((course) => ({
  id: course.id,
  title: course.title,
  subject: course.subject,
  stage: course.classLevels.join(", ") || "missing",
  teacher: course.teacher ?? "missing",
  language: course.language ?? "missing",
  difficulty: course.difficulty ?? "missing",
  lectures: course.lectures,
  missing: course.missing.join(", "),
  issues: course.issues.join(", "),
})));
if (report.overlaps.length) {
  console.log("Playlist video overlap:");
  console.table(report.overlaps.map((overlap) => ({
    left: `${overlap.leftId}: ${overlap.leftTitle}`,
    right: `${overlap.rightId}: ${overlap.rightTitle}`,
    shared: overlap.sharedCount,
    leftLectures: overlap.leftCount,
    rightLectures: overlap.rightCount,
    leftFullyContained: overlap.leftFullyContained,
    rightFullyContained: overlap.rightFullyContained,
  })));
}
console.log(JSON.stringify(report.summary, null, 2));
console.log(`Read-only report saved to ${outputPath}`);
