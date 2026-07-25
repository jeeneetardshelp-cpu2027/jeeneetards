import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlaylistOwner } from "./youtubeNode.js";

const playlistId = process.argv[2];
if (!playlistId) throw new Error("Usage: node src/scripts/resolvePlaylistOwner.js <playlist-id>");

const here = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(resolve(here, "../../.env"), "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
}
if (!env.YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY is missing.");

console.log(JSON.stringify(await getPlaylistOwner(env.YOUTUBE_API_KEY, playlistId), null, 2));
