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

export default function YouTubePlayer({
  videoId = "",
  title = "",
  onPlay = null,
  onPlaying = null,
  onEnded = null,
  onProgress = null,
  startSeconds = 0,
  autoplay = false,
  playbackRate = null,
  onPlaybackRateChange = null,
  playSignal = 0,
}) {
  const hostRef = useRef(null);   // stable node that React controls
  const playerRef = useRef(null);
  // All optional props are read through refs so the effect can keep its
  // [videoId, title] dependency array — a parent re-render must never
  // rebuild the iframe mid-watch.
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const onPlayingRef = useRef(onPlaying);
  onPlayingRef.current = onPlaying;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const startSecondsRef = useRef(startSeconds);
  startSecondsRef.current = startSeconds;
  const autoplayRef = useRef(autoplay);
  autoplayRef.current = autoplay;
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;
  const onPlaybackRateChangeRef = useRef(onPlaybackRateChange);
  onPlaybackRateChangeRef.current = onPlaybackRateChange;
  // status: "loading" | "ready" | "blocked" | "error"
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    let playbackRecorded = false;
    let endedRecorded = false;
    let progressTimer = null;
    setStatus("loading");

    // Safety net: if the player never loads (adblocker, network), after 8s
    // we offer the direct link instead of spinning forever.
    const timer = setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "loading" ? "error" : s));
    }, 8000);

    // Every report carries the videoId THIS player was built for. Reports can
    // fire in the window between a lesson-change render and this effect's
    // cleanup, so the consumer must be able to tell whose numbers these are.
    // Defined at effect scope so the cleanup can flush one final position
    // before the player is destroyed (a lesson switch or route change must
    // not silently discard up to 5s of resume point).
    const reportProgress = () => {
      const player = playerRef.current;
      // A position is only meaningful if this lesson ACTUALLY played. Without
      // the playbackRecorded gate, the cleanup/pagehide flush below fires for a
      // lesson the student merely opened and left — and the consumer records
      // that as a real watch, which then syncs to the server and comes back as
      // permanent fabricated watch history on every device. playbackRecorded
      // flips only on a genuine YouTube PLAYING event and resets per lesson,
      // so it is exactly the right signal.
      if (!player || !playbackRecorded) return;
      try {
        onProgressRef.current?.({
          videoId,
          seconds: player.getCurrentTime(),
          duration: player.getDuration(),
        });
      } catch {
        // Destroyed players throw on any method call — skip the report.
      }
    };
    // A closed tab is the same story as a route change: flush what we have.
    const flushOnPageHide = () => reportProgress();
    window.addEventListener("pagehide", flushOnPageHide);

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
      embedUrl.searchParams.set("autoplay", autoplayRef.current ? "1" : "0");
      embedUrl.searchParams.set("rel", "0");
      embedUrl.searchParams.set("playsinline", "1");
      // Resume point: YouTube only accepts whole seconds in start=.
      const startAt = Math.floor(startSecondsRef.current || 0);
      if (startAt > 0) embedUrl.searchParams.set("start", String(startAt));
      iframe.src = embedUrl.toString();
      iframe.title = title || "YouTube video player";
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      hostRef.current.innerHTML = "";
      hostRef.current.appendChild(iframe);

      const stopProgressTimer = () => {
        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = null;
        }
      };

      playerRef.current = new YT.Player(iframe, {
        events: {
          onReady: () => {
            if (!cancelled) {
              clearTimeout(timer);
              setStatus("ready");
              // Saved playback rate is applied once here; later changes come
              // from the user via YouTube's own controls.
              const rate = playbackRateRef.current;
              if (rate) {
                try {
                  playerRef.current?.setPlaybackRate(rate);
                } catch {
                  // The player may have been torn down before ready settled.
                }
              }
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
            if (cancelled) return;
            const playing = YT.PlayerState?.PLAYING ?? 1;
            const paused = YT.PlayerState?.PAUSED ?? 2;
            const ended = YT.PlayerState?.ENDED ?? 0;
            if (e.data === playing) {
              if (!playbackRecorded) {
                playbackRecorded = true;
                onPlayRef.current?.();
              }
              // Unlike onPlay (first playback only, feeds the watch history),
              // onPlaying fires on EVERY resume — the up-next overlay uses it
              // to get out of the way when the student replays a lesson.
              onPlayingRef.current?.({ videoId });
              // A replay must be allowed to end again: re-arm ENDED so the
              // overlay and the finished-position write both fire next time.
              endedRecorded = false;
            }
            // Progress ticks only while PLAYING; any other state stops them.
            if (e.data === playing) {
              if (!progressTimer) {
                progressTimer = setInterval(reportProgress, 5000);
              }
            } else {
              stopProgressTimer();
              // One final report on pause so the resume point is fresh.
              if (e.data === paused) reportProgress();
            }
            if (!endedRecorded && e.data === ended) {
              endedRecorded = true;
              onEndedRef.current?.({ videoId });
            }
          },
          onPlaybackRateChange: (e) => {
            if (!cancelled) onPlaybackRateChangeRef.current?.(e.data);
          },
        },
      });
    });

    // Cleanup when the modal closes or the video changes.
    return () => {
      // Final flush BEFORE destroying: the interval only reports every 5s,
      // and a lesson switch mid-tick would otherwise lose that tail.
      reportProgress();
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("pagehide", flushOnPageHide);
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch {
          // The player may already have been removed by the iframe API.
        }
        playerRef.current = null;
      }
    };
  }, [videoId, title]);

  // "Play the current video" without rebuilding the iframe: the overview's
  // Continue button targets a lesson that is usually ALREADY active, so a
  // URL write alone changes nothing. Parents bump playSignal instead.
  useEffect(() => {
    if (!playSignal) return;
    try {
      playerRef.current?.playVideo?.();
    } catch {
      // Player not ready yet — the student still has the normal play button.
    }
  }, [playSignal]);

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
