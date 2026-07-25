import { loadEnv } from "vite";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = modeArg?.slice("--mode=".length) || "";
const env = loadEnv(mode, process.cwd(), "");
const readEnvFile = (path) => Object.fromEntries(
  readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i))
    .filter(Boolean)
    .map((match) => [
      match[1],
      match[2].replace(/^["']|["']$/g, "").trim(),
    ]),
);
const staging = mode === "staging" ? readEnvFile(".env.staging") : {};
const baseUrl = mode === "staging"
  ? staging.TEST_SUPABASE_URL
  : env.VITE_SUPABASE_URL;
const serviceKey = mode === "staging"
  ? staging.TEST_SERVICE_KEY
  : env.SUPABASE_SERVICE_ROLE_KEY;

if (!baseUrl || !serviceKey) {
  throw new Error(
    mode === "staging"
      ? "TEST_SUPABASE_URL and TEST_SERVICE_KEY are required"
      : "VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
  );
}

const supabase = createClient(baseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const probes = [
  ["import_playlist", { payload: {}, mode: "merge" }],
  ["set_video_taxonomy", {
    p_video_id: -1,
    p_learning_goal_ids: [-1],
    p_class_level_ids: [-1],
  }],
  ["clear_video_taxonomy", { p_video_id: -1 }],
  ["catalog_manage_capability", {}],
  ["get_manage_playlists", { p_search: "", p_limit: 1, p_offset: 0 }],
  ["update_managed_playlist", {
    p_playlist_id: -1,
    p_expected_title: "__capability_probe__",
    p_title: "__capability_probe__",
    p_teacher: null,
    p_channel_id: -1,
    p_learning_goal_ids: [-1],
    p_class_level_ids: [-1],
    p_content_type: null,
    p_language: null,
    p_difficulty: null,
    p_audience_focus: null,
  }],
  ["set_managed_video_taxonomy", {
    p_playlist_id: -1,
    p_video_id: -1,
    p_learning_goal_ids: [-1],
    p_class_level_ids: [-1],
    p_allow_shared: false,
  }],
  ["clear_managed_video_taxonomy", {
    p_playlist_id: -1,
    p_video_id: -1,
    p_allow_shared: false,
  }],
  ["reassign_video_chapter", {
    p_playlist_id: -1,
    p_video_id: -1,
    p_chapter_id: -1,
    p_expected_current_chapter_id: null,
    p_allow_shared: false,
  }],
  ["delete_managed_playlist", {
    p_playlist_id: -1,
    p_expected_title: "__capability_probe__",
  }],
];

const results = [];
for (const [name, args] of probes) {
  const { error } = await supabase.rpc(name, args);
  results.push({
    function: name,
    exposed: error?.code !== "PGRST202",
    probe_code: error?.code ?? "unexpected-success",
    detail: (error?.details ?? error?.message ?? "").slice(0, 140),
  });
}

console.table(results);

const tables = [
  "playlists",
  "videos",
  "playlist_videos",
  "playlist_ratings",
  "playlist_learning_goals",
  "playlist_class_levels",
  "video_learning_goals",
  "video_class_levels",
  "institutes_channels",
  "categories",
  "chapters",
  "subjects",
  "learning_goals",
  "class_levels",
  "category_learning_goals",
  "learning_goal_class_levels",
];
const tableShape = [];
for (const table of tables) {
  const { data, error } = await supabase.from(table).select("*").limit(1);
  tableShape.push({
    table,
    readable: !error,
    columns: error ? error.code : Object.keys(data?.[0] ?? {}).sort().join(", "),
  });
}
console.table(tableShape);

if (process.argv.includes("--vocabulary")) {
  for (const table of ["categories", "learning_goals", "class_levels"]) {
    const { data, error } = await supabase
      .from(table)
      .select("id, name, slug, display_order")
      .order("display_order");
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(table);
    console.table(data);
  }
}
