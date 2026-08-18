// youtube.js — YouTube Data API v3 helpers for the BROWSER (admin panel).
//
// THERE IS NO API KEY IN THIS FILE, AND THERE MUST NEVER BE ONE AGAIN.
//
// This module used to hold `import.meta.env.VITE_YOUTUBE_API_KEY`. Vite inlines
// every VITE_* value into the public bundle, so the key shipped to anyone who
// asked for the admin chunk, and an HTTP-referrer restriction did not protect it
// -- Referer is a header the caller sets. Measured on the live key: no Referer
// gave 403, "Referer: http://localhost:5173/" gave 200 with real data.
//
// Calls now go through api/youtube.js, a server-side proxy that holds the key in
// YOUTUBE_API_KEY (no VITE_ prefix, so it cannot be inlined) and requires an
// admin Supabase session. src/scripts/youtubeNode.js is the separate Node copy
// used by the CLI import scripts.

import { isoDurationToSeconds } from "./metadata.js";
import { supabase } from "./supabaseClient.js";

const PROXY = "/api/youtube";

// The proxy decides whether the caller may spend quota, so the browser can no
// longer answer "do we have a key?" locally. It reports whether the signed-in
// user is able to use the import tools at all, which is the question the form
// actually needs answered.
export const hasYouTubeKey = true;

// Accepts a full playlist URL or a bare playlist id.
//   https://www.youtube.com/playlist?list=PLxxxx  -> PLxxxx
//   https://www.youtube.com/watch?v=abc&list=PLxx -> PLxx
export function extractPlaylistId(input) {
  const s = (input ?? "").trim();
  if (!s) return "";
  const fromUrl = s.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (fromUrl) return fromUrl[1];
  // A bare id — playlist ids are longer than the 11-char video ids.
  if (/^[A-Za-z0-9_-]{13,}$/.test(s)) return s;
  return "";
}

async function call(resource, params) {
  // The proxy authorises on the Supabase session, not on a bundled secret.
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Sign in as an admin to use the import tools.");

  const res = await fetch(PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ resource, params }),
  });

  let json = null;
  try { json = await res.json(); } catch { /* fall through to the status below */ }

  if (!res.ok) {
    // The proxy already flattens Google's error shapes to a plain message and
    // never forwards the raw upstream body, which could echo the key.
    throw new Error(json?.error ?? `YouTube API error ${res.status}`);
  }
  return json ?? {};
}

export async function fetchPlaylistMeta(playlistId) {
  const json = await call("playlists", { part: "snippet", id: playlistId });
  const item = json.items?.[0];
  if (!item) throw new Error("That playlist doesn't exist, or it's private.");
  return {
    id: playlistId,
    title: item.snippet.title,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
  };
}

// Walks every page of the playlist. maxPages is a safety net so a
// 5,000-video playlist can't spin forever or drain the daily quota.
export async function fetchAllPlaylistItems(playlistId, { maxPages = 20 } = {}) {
  const videos = [];
  let pageToken;
  let pages = 0;
  let truncated = false;

  do {
    const json = await call("playlistItems", {
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });

    for (const item of json.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      const title = item.snippet?.title ?? "";
      // Deleted/private entries keep their slot in a playlist but have no
      // usable video behind them. Skip rather than import a dead row.
      if (!videoId) continue;
      if (title === "Deleted video" || title === "Private video") continue;
      videos.push({
        videoId,
        title,
        position: item.snippet?.position ?? videos.length,
        thumbnail:
          item.snippet?.thumbnails?.default?.url ??
          `https://img.youtube.com/vi/${videoId}/default.jpg`,
      });
    }

    pageToken = json.nextPageToken;
    pages += 1;
    if (pageToken && pages >= maxPages) {
      truncated = true;
      break;
    }
  } while (pageToken);

  videos.sort((a, b) => a.position - b.position);

  // playlistItems doesn't carry duration/captions/embeddable — those live on
  // the videos endpoint. Fetch them in batches of 50 and merge in.
  const details = await fetchVideoDetails(videos.map((v) => v.videoId));
  for (const v of videos) Object.assign(v, details.get(v.videoId) ?? {});

  return { videos, truncated };
}

// videos.list part=contentDetails,status for up to 50 ids per call.
// Returns Map(videoId -> { durationSeconds, captionStatus, embeddingStatus }).
export async function fetchVideoDetails(ids) {
  const map = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const json = await call("videos", {
      part: "contentDetails,status",
      id: chunk.join(","),
    });
    for (const it of json.items ?? []) {
      map.set(it.id, {
        durationSeconds: isoDurationToSeconds(it.contentDetails?.duration),
        captionStatus: it.contentDetails?.caption === "true" ? "available" : "none",
        embeddingStatus: it.status?.embeddable === false ? "blocked" : "embeddable",
      });
    }
  }
  return map;
}
