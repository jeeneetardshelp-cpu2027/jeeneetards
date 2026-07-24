// =====================================================================
//  YouTubePlayer.jsx  —  embed a video AND catch "embedding disabled"
//
//  A plain <iframe> can't tell you when a creator has blocked embedding.
//  The YouTube IFrame Player API can: it fires an onError event with
//  code 101 or 150 = "embedding disabled by owner" (100 = removed/private).
//  When that happens we show a friendly message + a direct YouTube link.
//
//  Usage:  <YouTubePlayer videoId="dQw4w9WgXcQ" title="My lesson" />
// =====================================================================

import { useEffect, useRef, useState } from "react";

// --- Load the IFrame API script ONCE for the whole app --------------
let ytApiPromise = null;
function loadYouTubeAPI() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    // YouTube calls this global function when the API is ready.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === "function") previous();
      resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

// --- The friendly fallback (shown over the player area) -------------
function FallbackOverlay({ videoId, message }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-center">
      <p className="text-sm text-slate-200">{message}</p>
      <a
        href={`https://www.youtube.com/watch?v=${videoId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
      >
        Click here to watch directly on YouTube
      </a>
    </div>
  );
}

export default function YouTubePlayer({ videoId = "", title = "", onPlay = null }) {
  const hostRef = useRef(null);   // stable node that React controls
  const playerRef = useRef(null);
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  // status: "loading" | "ready" | "blocked" | "error"
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    let playbackRecorded = false;
    setStatus("loading");

    // Safety net: if the player never loads (adblocker, network), after 8s
    // we offer the direct link instead of spinning forever.
    const timer = setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "loading" ? "error" : s));
    }, 8000);

    loadYouTubeAPI().then((YT) => {
      if (cancelled || !YT || !hostRef.current) return;

      // Build the iframe ourselves so the privacy-enhanced host is explicit.
      // The IFrame API can attach to an existing iframe when enablejsapi=1.
      const iframe = document.createElement("iframe");
      const embedUrl = new URL(
        `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`,
      );
      embedUrl.searchParams.set("enablejsapi", "1");
      embedUrl.searchParams.set("origin", window.location.origin);
      embedUrl.searchParams.set("autoplay", "0");
      embedUrl.searchParams.set("rel", "0");
      embedUrl.searchParams.set("playsinline", "1");
      iframe.src = embedUrl.toString();
      iframe.title = title || "YouTube video player";
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      hostRef.current.innerHTML = "";
      hostRef.current.appendChild(iframe);

      playerRef.current = new YT.Player(iframe, {
        events: {
          onReady: () => {
            if (!cancelled) {
              clearTimeout(timer);
              setStatus("ready");
            }
          },
          onError: (e) => {
            // 101 & 150 => embedding disabled by owner. 100 => removed/private.
            if (!cancelled && [101, 150, 100].includes(e.data)) {
              clearTimeout(timer);
              setStatus("blocked");
            }
          },
          onStateChange: (e) => {
            const playing = YT.PlayerState?.PLAYING ?? 1;
            if (!cancelled && !playbackRecorded && e.data === playing) {
              playbackRecorded = true;
              onPlayRef.current?.();
            }
          },
        },
      });
    });

    // Cleanup when the modal closes or the video changes.
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch (_) {
          /* ignore */
        }
        playerRef.current = null;
      }
    };
  }, [videoId]);

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      {/* The YouTube player renders inside here */}
      <div ref={hostRef} className="h-full w-full" title={title} />

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
          Loading player…
        </div>
      )}

      {status === "blocked" && (
        <FallbackOverlay
          videoId={videoId}
          message="Playback restricted by creator on external sites."
        />
      )}

      {status === "error" && (
        <FallbackOverlay
          videoId={videoId}
          message="We couldn't load the player here."
        />
      )}
    </div>
  );
}
