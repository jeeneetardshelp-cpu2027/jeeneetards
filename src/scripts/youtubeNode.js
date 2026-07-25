// youtubeNode.js — YouTube Data API v3 helpers for NODE (the import script).
// Same logic as ../youtube.js, but reads the key from process.env instead of
// Vite's import.meta.env, and takes the key as an argument so the caller
// controls where it comes from.

import { isoDurationToSeconds } from "../metadata.js";

const API = "https://www.googleapis.com/youtube/v3";

async function call(key, path, params) {
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${API}/${path}?${qs}`);
  const json = await res.json();
  if (!res.ok) {
    const reason = json?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded")
      throw new Error("YouTube API quota exceeded for today.");
    throw new Error(json?.error?.message ?? `YouTube API error ${res.status}`);
  }
  return json;
}

export async function getChannel(key, channelId) {
  const json = await call(key, "channels", {
    part: "snippet,contentDetails,statistics",
    id: channelId,
  });
  const item = json.items?.[0];
  if (!item) throw new Error(`No channel found for id ${channelId}.`);
  return {
    id: channelId,
    title: item.snippet.title,
    videoCount: item.statistics?.videoCount ?? "?",
  };
}

export async function getPlaylistOwner(key, playlistId) {
  const json = await call(key, "playlists", {
    part: "snippet,contentDetails",
    id: playlistId,
  });
  const item = json.items?.[0];
  if (!item) throw new Error(`No playlist found for id ${playlistId}.`);
  return {
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    playlistId: item.id,
    playlistTitle: item.snippet.title,
    videoCount: item.contentDetails?.itemCount ?? 0,
  };
}

// Every playlist owned by the channel (walks all pages).
export async function getAllPlaylists(key, channelId) {
  const playlists = [];
  let pageToken;
  do {
    const json = await call(key, "playlists", {
      part: "snippet,contentDetails",
      channelId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    for (const item of json.items ?? []) {
      playlists.push({
        id: item.id,
        title: item.snippet.title,
        videoCount: item.contentDetails?.itemCount ?? 0,
      });
    }
    pageToken = json.nextPageToken;
  } while (pageToken);
  return playlists;
}

// Every video inside a playlist (walks all pages), skipping dead entries.
export async function getPlaylistVideos(key, playlistId) {
  const videos = [];
  let pageToken;
  do {
    const json = await call(key, "playlistItems", {
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    for (const item of json.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      const title = item.snippet?.title ?? "";
      if (!videoId) continue;
      if (title === "Deleted video" || title === "Private video") continue;
      videos.push({
        videoId,
        title,
        position: item.snippet?.position ?? videos.length,
      });
    }
    pageToken = json.nextPageToken;
  } while (pageToken);
  videos.sort((a, b) => a.position - b.position);

  // Merge duration/captions/embeddable from the videos endpoint.
  const details = await getVideoDetails(key, videos.map((v) => v.videoId));
  for (const v of videos) Object.assign(v, details.get(v.videoId) ?? {});

  return videos;
}

// videos.list part=contentDetails,status, 50 ids per call.
export async function getVideoDetails(key, ids) {
  const map = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const json = await call(key, "videos", {
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
