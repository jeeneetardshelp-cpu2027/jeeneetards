// Refresh public YouTube channel avatars stored in institutes_channels.logo_url.
//
// Safe by default:
//   npm run refresh:channel-logos              # dry run, no writes
//   npm run refresh:channel-logos -- --apply   # update changed rows
//
// YouTube channel metadata should be refreshed regularly rather than treated
// as permanent. This script uses one channels.list call per 50 channels and
// updates existing rows only; it never creates or deletes catalogue data.

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const API = "https://www.googleapis.com/youtube/v3/channels";
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{20,}$/;
const TRUSTED_HOSTS = new Set(["yt3.ggpht.com", "yt3.googleusercontent.com"]);

function loadEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, "../../.env");
  const env = {};
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
    }
  }
  return { ...env, ...process.env };
}

export function trustedYouTubeLogoUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && TRUSTED_HOSTS.has(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function buildChannelLogoUpdates(channels, youtubeItems) {
  const logoByChannel = new Map();
  for (const item of youtubeItems ?? []) {
    const candidate =
      item.snippet?.thumbnails?.default?.url ??
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.high?.url;
    const logoUrl = trustedYouTubeLogoUrl(candidate);
    if (CHANNEL_ID.test(item.id ?? "") && logoUrl) logoByChannel.set(item.id, logoUrl);
  }

  const invalid = [];
  const missing = [];
  const updates = [];
  for (const channel of channels ?? []) {
    if (!CHANNEL_ID.test(channel.youtube_channel_id ?? "")) {
      invalid.push(channel);
      continue;
    }
    const logoUrl = logoByChannel.get(channel.youtube_channel_id);
    if (!logoUrl) {
      missing.push(channel);
      continue;
    }
    if (channel.logo_url !== logoUrl) {
      updates.push({ id: channel.id, name: channel.name, logo_url: logoUrl });
    }
  }
  return { updates, invalid, missing };
}

async function fetchChannelItems(ids, apiKey) {
  const items = [];
  for (let index = 0; index < ids.length; index += 50) {
    const chunk = ids.slice(index, index + 50);
    const query = new URLSearchParams({
      part: "snippet",
      id: chunk.join(","),
      key: apiKey,
    });
    const response = await fetch(`${API}?${query}`);
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message ?? `YouTube API ${response.status}`);
    items.push(...(json.items ?? []));
  }
  return items;
}

const fail = (message) => {
  console.error(`Channel logo refresh failed: ${message}`);
  process.exitCode = 1;
};

export async function main() {
  const apply = process.argv.includes("--apply");
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const youtubeKey = env.YOUTUBE_API_KEY;
  if (!url || !serviceKey || !youtubeKey) {
    throw new Error("VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and YOUTUBE_API_KEY are required.");
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: channels, error } = await db
    .from("institutes_channels")
    .select("id, name, youtube_channel_id, logo_url")
    .order("id");
  if (error) throw new Error(`reading channels: ${error.message}`);

  const ids = channels
    .map((channel) => channel.youtube_channel_id)
    .filter((id) => CHANNEL_ID.test(id ?? ""));
  const items = await fetchChannelItems(ids, youtubeKey);
  const plan = buildChannelLogoUpdates(channels, items);

  console.log(`${channels.length} channel(s); ${items.length} matched on YouTube; ${plan.updates.length} update(s).`);
  if (plan.invalid.length) console.log(`Invalid channel ids: ${plan.invalid.map((row) => row.name).join(", ")}`);
  if (plan.missing.length) console.log(`Missing on YouTube: ${plan.missing.map((row) => row.name).join(", ")}`);

  if (!apply) {
    console.log("DRY RUN — no database writes. Re-run with --apply after reviewing this summary.");
    return plan;
  }
  if (plan.invalid.length || plan.missing.length) {
    throw new Error("refusing a partial apply while channel ids are invalid or missing on YouTube");
  }

  for (const row of plan.updates) {
    const { error: updateError } = await db
      .from("institutes_channels")
      .update({ logo_url: row.logo_url })
      .eq("id", row.id);
    if (updateError) throw new Error(`updating ${row.name}: ${updateError.message}`);
  }
  console.log(`Applied ${plan.updates.length} channel logo update(s).`);
  return plan;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => fail(error.message ?? String(error)));
}
