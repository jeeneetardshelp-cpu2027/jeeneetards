import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAllPlaylists } from "./youtubeNode.js";

const channelId = process.argv[2];
if (!channelId) throw new Error("Usage: node src/scripts/listChannelPlaylists.js <channel-id>");

const here = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(resolve(here, "../../.env"), "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
}
if (!env.YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY is missing.");

const playlists = await getAllPlaylists(env.YOUTUBE_API_KEY, channelId);
const needle = process.argv.find((arg) => arg.startsWith("--find="))
  ?.slice("--find=".length).toLowerCase();
console.table(playlists.map((playlist, index) => ({
  index: index + 1,
  id: playlist.id,
  title: playlist.title,
  videos: playlist.videoCount,
})).filter((playlist) => !needle
  || playlist.id.toLowerCase() === needle
  || playlist.title.toLowerCase().includes(needle)));
