// One-time additive faculty binding for the owner-reviewed CBSE Mathematics
// Gate 2 import. This script is idempotent and refuses any catalogue drift.
import { client, count, rows } from "./dbProbe.js";

const PLAYLIST_ID = "PLzYa_EgDSEDJQG-HEQaFMHEIVBq_oMm35";
const COURSE_ID = 156;
const TEACHER_ID = 28;
const CHANNEL_ID = 70;
const SUBJECT_ID = 3;

const db = client({ service: true });

async function exactCount(table) {
  return count(
    table,
    await db.from(table).select("*", { count: "exact", head: true }),
  );
}

function fail(message) {
  throw new Error(`CBSE Mathematics faculty binding refused: ${message}`);
}

async function main() {
  const baseline = {
    playlists: await exactCount("playlists"),
    videos: await exactCount("videos"),
    memberships: await exactCount("playlist_videos"),
    chapters: await exactCount("chapters"),
  };
  if (
    baseline.playlists !== 149
    || baseline.videos !== 1896
    || baseline.memberships !== 1900
    || baseline.chapters !== 169
  ) {
    fail(`catalogue baseline drifted: ${JSON.stringify(baseline)}`);
  }

  const course = rows(
    "reviewed course",
    await db
      .from("playlists")
      .select("id,channel_id,subject_id,teacher")
      .eq("youtube_playlist_id", PLAYLIST_ID),
  );
  if (
    course.length !== 1
    || course[0].id !== COURSE_ID
    || course[0].channel_id !== CHANNEL_ID
    || course[0].subject_id !== SUBJECT_ID
    || course[0].teacher !== "Shobhit Nirwan"
  ) {
    fail("reviewed course identity differs");
  }

  const teacher = rows(
    "reviewed teacher",
    await db
      .from("teachers")
      .select("id,display_name,slug,verified")
      .eq("id", TEACHER_ID),
  );
  if (
    teacher.length !== 1
    || teacher[0].display_name !== "Shobhit Nirwan"
    || teacher[0].slug !== "shobhit-nirwan"
    || teacher[0].verified !== true
  ) {
    fail("verified teacher 28 differs");
  }

  for (const [label, table, value, onConflict] of [
    [
      "teacher channel",
      "teacher_institutes",
      { teacher_id: TEACHER_ID, institute_id: CHANNEL_ID, is_primary: false },
      "teacher_id,institute_id",
    ],
    [
      "teacher subject",
      "teacher_subjects",
      { teacher_id: TEACHER_ID, subject_id: SUBJECT_ID },
      "teacher_id,subject_id",
    ],
    [
      "course teacher",
      "playlist_teachers",
      {
        playlist_id: COURSE_ID,
        teacher_id: TEACHER_ID,
        role: "instructor",
        position: 1,
      },
      "playlist_id,teacher_id",
    ],
  ]) {
    const result = await db
      .from(table)
      .upsert(value, { onConflict, ignoreDuplicates: true });
    if (result.error) fail(`${label}: ${result.error.message}`);
  }

  const links = rows(
    "course teacher postflight",
    await db
      .from("playlist_teachers")
      .select("playlist_id,teacher_id,role,position")
      .eq("playlist_id", COURSE_ID),
  );
  if (
    links.length !== 1
    || links[0].teacher_id !== TEACHER_ID
    || links[0].role !== "instructor"
    || links[0].position !== 1
  ) {
    fail("course teacher postflight differs");
  }

  console.log(JSON.stringify({ baseline, courseId: COURSE_ID, teacherId: TEACHER_ID, links }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
