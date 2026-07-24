// youtube.js — YouTube Data API v3 helpers for the BROWSER (admin panel).
//
// The key here is bundled into the public frontend by Vite. Restrict it by
// HTTP referrer + API in the Google Cloud Console. The local import script
// has its own copy of these helpers so it can run under Node.

import { isoDurationToSeconds } from "./metadata.js";

const API = "https://www.googleapis.com/youtube/v3";
const KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

export const hasYouTubeKey = Boolean(KEY);

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

async function call(path, params) {
  if (!KEY) throw new Error("No VITE_YOUTUBE_API_KEY in .env — add it and restart.");
  const qs = new URLSearchParams({ ...params, key: KEY });
  const res = await fetch(`${API}/${path}?${qs}`);
  const json = await res.json();
  if (!res.ok) {
    const reason = json?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded")
      throw new Error("YouTube API quota exceeded for today.");
    if (reason === "playlistNotFound")
      throw new Error("That playlist doesn't exist, or it's private.");
    throw new Error(json?.error?.message ?? `YouTube API error ${res.status}`);
  }
  return json;
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
