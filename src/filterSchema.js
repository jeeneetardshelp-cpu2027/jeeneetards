// filterSchema.js — WHICH filters exist, and why the others do not.
//
// This is the matrix from the phase brief, expressed as code so the UI cannot
// drift from it. A filter appears in the panel if and only if it is listed in
// AVAILABLE. DEFERRED entries are NOT rendered at all — not greyed out, not
// disabled. A disabled control is a promise the product cannot keep, and a
// column of them reads as a broken site rather than an honest one.
//
// Every `source` below was confirmed against the live database before being
// written here. Nothing is aspirational.

import { COURSE_TYPES, DIFFICULTIES, LANGUAGES } from "./filterModel.js";

/**
 * Filters backed by real columns/junctions today.
 *
 * `kind`
 *   dimension — options come from a small lookup table (goals, subjects, …)
 *   enum      — options come from the canonical vocabulary in filterModel.js
 *
 * `param` is the canonical URL key. `dependsOn` drives the cascade.
 */
export const AVAILABLE = [
  {
    key: "goal", param: "goal", label: "Exam", kind: "dimension",
    table: "learning_goals",
    source: "playlist_learning_goals -> learning_goals.slug",
  },
  {
    key: "class", param: "class", label: "Class", kind: "dimension",
    table: "class_levels",
    source: "playlist_class_levels -> class_levels.slug",
    dependsOn: "goal",
  },
  {
    key: "subject", param: "subject", label: "Subject", kind: "dimension",
    table: "subjects",
    source: "playlists.subject_id -> subjects",
    dependsOn: "goal",
  },
  {
    key: "chapter", param: "chapter", label: "Chapter", kind: "dimension",
    table: "chapters",
    source: "playlist_videos -> videos.chapter_id",
    dependsOn: "subject",
    // Chapters are the one dimension that grows without bound, so the panel
    // scopes them to the chosen subject and makes them searchable.
    scopedBy: "subject", searchable: true,
  },
  {
    key: "channel", param: "channel", label: "Channel", kind: "dimension",
    table: "institutes_channels",
    source: "playlists.channel_id -> institutes_channels.id",
    searchable: true,
    // NAMED "Channel", NOT "Institute", on purpose. institutes_channels is a
    // registry of YouTube channels: one row per channel, keyed by
    // youtube_channel_id. It is not a curated institute identity — an
    // institute that runs two channels appears as two rows, and there is no
    // merge or alias mechanism. Calling it "Institute" in the UI would assert
    // an identity model the schema does not implement.
  },
  {
    key: "language", param: "language", label: "Language", kind: "enum",
    options: LANGUAGES, source: "playlists.language",
  },
  {
    key: "type", param: "type", label: "Course type", kind: "enum",
    options: COURSE_TYPES, source: "playlists.content_type",
  },
  {
    key: "difficulty", param: "difficulty", label: "Difficulty", kind: "enum",
    options: DIFFICULTIES, source: "playlists.difficulty",
  },
];

/**
 * Deliberately NOT rendered. Each entry records the exact missing dependency,
 * so "why is there no board filter?" has a written answer and re-enabling one
 * is a matter of satisfying a stated condition rather than a judgement call.
 */
export const DEFERRED = [
  {
    key: "board", label: "Board",
    reason: "The playlist_boards junction does not exist. public.boards itself " +
            "DOES exist (CBSE) — an earlier report of mine wrongly said otherwise, " +
            "because useBoards queries both tables in one Promise.all and logs " +
            "either error under the label 'boards:'.",
    unblockedBy: "create public.playlist_boards (playlist_id, board_id)",
  },
  {
    key: "faculty", label: "Faculty",
    reason: "playlists.teacher is unreviewed free text and cannot distinguish " +
            "two people with the same name. The teachers/teacher_aliases tables " +
            "are absent.",
    unblockedBy: "teachers_v7.sql applied and verified on a disposable staging project",
  },
  {
    key: "duration", label: "Total duration",
    reason: "videos.duration_seconds exists, but there is no playlist-level " +
            "aggregate. Summing it in the browser would mean fetching every " +
            "playlist_videos row — the exact pattern this phase forbids.",
    unblockedBy: "a view or RPC summing duration_seconds over playlist_videos",
  },
  {
    key: "coverage", label: "Syllabus coverage",
    reason: "No coverage column exists. A percentage would have to be invented.",
    unblockedBy: "a curated coverage field on playlists",
  },
  {
    key: "rating", label: "Rating",
    reason: "average_rating and ratings_count exist, but ranking or filtering by " +
            "a raw average promotes a 5.0 from one review above a 4.6 from two " +
            "hundred.",
    unblockedBy: "confidence rules (see RATING_CONFIDENCE_MIN) applied database-side",
  },
];

export const isAvailable = (key) => AVAILABLE.some((f) => f.key === key);
export const filterByKey = (key) => AVAILABLE.find((f) => f.key === key) ?? null;

/** Every canonical URL parameter this phase owns. Used by Clear All. */
// Search is rendered outside FilterPanel, and `teacher` is capability-gated by
// teachers_v7 rather than listed in AVAILABLE (which is always rendered).
// Both still narrow the result set, so both must count in the mobile filter
// badge and enable Reset.
export const FILTER_PARAMS = ["q", ...AVAILABLE.map((f) => f.param), "teacher"];
