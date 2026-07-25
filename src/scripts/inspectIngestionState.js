import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function readEnv(fileName) {
  const here = dirname(fileURLToPath(import.meta.url));
  const values = {};
  for (const line of readFileSync(resolve(here, `../../${fileName}`), "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  return values;
}

const environment = process.argv.find((arg) => arg.startsWith("--env="))
  ?.slice("--env=".length) ?? "staging";
if (!["staging", "production"].includes(environment)) {
  throw new Error("--env must be staging or production.");
}
const env = readEnv(environment === "staging" ? ".env.staging" : ".env");
const url = env.TEST_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const publicKey = env.TEST_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const db = createClient(url, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [{ data: marker }, { data: channels, error: channelError }, {
  data: playlists,
  error: playlistError,
}] = await Promise.all([
  db.from("app_environment").select("name").maybeSingle(),
  db.from("institutes_channels")
    .select("id,name,youtube_channel_id")
    .order("id"),
  db.from("playlists")
    .select("id,title,youtube_playlist_id,content_type,language,difficulty,institutes_channels(id,name,youtube_channel_id)")
    .order("id"),
]);
if (channelError) throw channelError;
if (playlistError) throw playlistError;

console.log(JSON.stringify({
  requestedEnvironment: environment,
  databaseMarker: marker?.name ?? null,
  placeholderChannels: channels.filter(
    (channel) => channel.youtube_channel_id === "UC_PASTE_YOUR_CHANNEL_ID",
  ),
  channels,
  playlists,
}, null, 2));
