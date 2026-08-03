// Anonymous, read-only verification of the protected original JEE catalogue.
//
// The field order and concatenation below intentionally reproduce the SQL
// fingerprint used at the production migration gates. This script performs
// SELECTs only and never loads a service-role key.
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { allExact, client, rows } from "./dbProbe.js";

export const PROTECTED_JEE_PLAYLIST_ID_MAX_EXCLUSIVE = 167;
export const EXPECTED_JEE_FINGERPRINT = "c742fabf93ff8dd33d6ecd5eb4793db0";

const playlistFields = [
  "id",
  "title",
  "teacher",
  "youtube_playlist_id",
  "category_id",
  "subject_id",
  "class_levels",
  "audience_focus",
  "content_type",
  "language",
  "difficulty",
];

const membershipFields = ["id", "playlist_id", "video_id", "position"];

const orderedRow = (row, fields) =>
  Object.fromEntries(fields.map((field) => [field, row[field]]));

const compareValues = (left, right) => {
  if (left === right) return 0;
  if (left === null || left === undefined) return -1;
  if (right === null || right === undefined) return 1;
  return left < right ? -1 : 1;
};

export function buildJeeFingerprint(playlists, memberships) {
  const orderedPlaylists = playlists
    .map((row) => orderedRow(row, playlistFields))
    .sort((left, right) => compareValues(left.id, right.id));
  const orderedMemberships = memberships
    .map((row) => orderedRow(row, membershipFields))
    .sort(
      (left, right) =>
        compareValues(left.playlist_id, right.playlist_id) ||
        compareValues(left.position, right.position) ||
        compareValues(left.id, right.id),
    );

  const payload =
    orderedPlaylists.map((row) => JSON.stringify(row)).join("|") +
    "|" +
    orderedMemberships.map((row) => JSON.stringify(row)).join("|");

  return createHash("md5").update(payload, "utf8").digest("hex");
}

export function selectJeePlaylistIds(links, maxPlaylistIdExclusive = null) {
  return links
    .map((row) => row.playlist_id)
    .filter(
      (playlistId) =>
        maxPlaylistIdExclusive === null || playlistId < maxPlaylistIdExclusive,
    );
}

export async function readJeeIntegrity(db, { maxPlaylistIdExclusive = null } = {}) {
  const goals = rows(
    "JEE learning goal",
    await db.from("learning_goals").select("id").eq("slug", "jee"),
  );
  if (goals.length !== 1)
    throw new Error(`Expected one JEE learning goal, received ${goals.length}.`);

  const links = await allExact(
    "JEE playlist links",
    (countMode) =>
      db
        .from("playlist_learning_goals")
        .select("playlist_id", countMode ? { count: countMode } : undefined)
        .eq("learning_goal_id", goals[0].id)
        .order("playlist_id"),
    { key: (row) => row.playlist_id },
  );
  const playlistIds = selectJeePlaylistIds(links, maxPlaylistIdExclusive);

  const playlists = await allExact(
    "JEE playlists",
    (countMode) =>
      db
        .from("playlists")
        .select(playlistFields.join(","), countMode ? { count: countMode } : undefined)
        .in("id", playlistIds)
        .order("id"),
  );
  const memberships = await allExact(
    "JEE memberships",
    (countMode) =>
      db
        .from("playlist_videos")
        .select(membershipFields.join(","), countMode ? { count: countMode } : undefined)
        .in("playlist_id", playlistIds)
        .order("playlist_id")
        .order("position")
        .order("id"),
  );

  if (playlists.length !== playlistIds.length)
    throw new Error(
      `JEE playlist link mismatch: ${playlistIds.length} links, ${playlists.length} playlists.`,
    );

  return {
    playlistCount: playlists.length,
    membershipCount: memberships.length,
    fingerprint: buildJeeFingerprint(playlists, memberships),
  };
}

async function main() {
  const expectedArgument = process.argv.find((argument) => argument.startsWith("--expected="));
  const allJee = process.argv.includes("--all");
  const expected = expectedArgument?.slice("--expected=".length)
    || (allJee ? null : EXPECTED_JEE_FINGERPRINT);
  const result = await readJeeIntegrity(client({ env: undefined }), {
    maxPlaylistIdExclusive: allJee
      ? null
      : PROTECTED_JEE_PLAYLIST_ID_MAX_EXCLUSIVE,
  });
  const matches = expected === null ? null : result.fingerprint === expected;

  console.log(JSON.stringify({
    scope: allJee ? "all-jee" : "protected-original-83",
    ...result,
    expected,
    matches,
  }, null, 2));
  if (expected !== null && !matches) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(`JEE fingerprint verification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
