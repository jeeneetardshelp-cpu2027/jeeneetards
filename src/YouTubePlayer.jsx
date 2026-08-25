// =====================================================================
//  YouTubePlayer.jsx  —  embed a video AND catch "embedding disabled"
//
//  A plain <iframe> can't tell you when a creator has blocked embedding.
//  The YouTube IFrame Player API can: it fires an onError event with
//  code 101 or 150 = "embedding disabled by owner" (still watchable on
//  YouTube, so we offer a direct link) and 100 = removed/private (gone
//  everywhere, so we say so plainly and offer no dead link).
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
// showYouTubeLink is false when the video is gone (removed/private): a link to
// a dead YouTube page would just send the student to another error.
function FallbackOverlay({ videoId, message, showYouTubeLink = true }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-center">
      <p className="text-sm text-slate-200">{message}</p>
      {showYouTubeLink && (
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Click here to watch directly on YouTube
        </a>
      )}
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
  // A seek request from outside (e.g. clicking a note's timestamp): { seconds,
  // nonce }. The nonce changing is the trigger, so clicking the same timestamp
  // twice seeks twice.
  seekTo = null,
}) {
  const hostRef = useRef(null);   // stable node that React controls
  const playerRef = useRef(null);
  // A seek asked for before the player exists is remembered here and applied
  // once onReady fires (see the seek effect and onReady below).
  const pendingSeekRef = useRef(null);
  // A fresh course page shows a lightweight, explicit Play control instead of
  // downloading the full YouTube runtime before the student asks for video.
  // In-page lesson changes still activate immediately because their parent
  // passes autoplay=true only after a user interaction.
  const [activatedVideoId, setActivatedVideoId] = useState(
    () => (autoplay ? videoId : null),
  );
  const activated = activatedVideoId === videoId;
  // Optional props use refs so unrelated parent re-renders do not rebuild the
  // iframe mid-watch. Only activation or a lesson identity change may do that.
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
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;
  const onPlaybackRateChangeRef = useRef(onPlaybackRateChange);
  onPlaybackRateChangeRef.current = onPlaybackRateChange;
  // status: "idle" | "loading" | "ready" | "blocked" | "unavailable" | "error"
  const [status, setStatus] = useState(activated ? "loading" : "idle");

  useEffect(() => {
    if (autoplay) setActivatedVideoId(videoId);
  }, [autoplay, videoId]);

  useEffect(() => {
    if (!activated) {
      setStatus("idle");
      return undefined;
    }
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
      // Reaching this effect always follows an explicit Play action or an
      // in-page lesson selection, so starting playback is user-initiated.
      embedUrl.searchParams.set("autoplay", "1");
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
              // A note's timestamp was clicked before the player had loaded:
              // land there now that it is ready.
              if (pendingSeekRef.current != null) {
                const target = pendingSeekRef.current;
                pendingSeekRef.current = null;
                try {
                  playerRef.current?.seekTo(target, true);
                  playerRef.current?.playVideo?.();
                } catch {
                  // torn down between ready and this call — ignore.
                }
              }
            }
          },
          onError: (e) => {
            if (cancelled) return;
            // 100 => the video was removed or made private: there is nothing to
            // watch anywhere, so say that honestly rather than blaming the
            // creator's embed settings. 101 & 150 => embedding disabled by the
            // creator, but it still plays on YouTube itself.
            if (e.data === 100) {
              clearTimeout(timer);
              setStatus("unavailable");
            } else if (e.data === 101 || e.data === 150) {
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
  }, [activated, videoId, title]);

  // "Play the current video" without rebuilding the iframe: the overview's
  // Continue button targets a lesson that is usually ALREADY active, so a
  // URL write alone changes nothing. Parents bump playSignal instead.
  useEffect(() => {
    if (!playSignal) return;
    if (!activated) {
      setActivatedVideoId(videoId);
      return;
    }
    try {
      playerRef.current?.playVideo?.();
    } catch {
      // Player not ready yet — the student still has the normal play button.
    }
  }, [activated, playSignal, videoId]);

  // Seek to a requested second (a clicked note timestamp). Triggered only by
  // the nonce so the same target can be requested repeatedly. If the player
  // has not been built yet, remember the target and activate — onReady lands
  // there; if it is built but the YT instance is still settling, stash it too.
  useEffect(() => {
    const target = seekTo?.seconds;
    if (!seekTo?.nonce || !Number.isFinite(target) || target < 0) return;
    if (!activated) {
      pendingSeekRef.current = target;
      setActivatedVideoId(videoId);
      return;
    }
    const player = playerRef.current;
    if (player?.seekTo) {
      try {
        player.seekTo(target, true);
        player.playVideo?.();
      } catch {
        pendingSeekRef.current = target;
      }
    } else {
      pendingSeekRef.current = target;
    }
    // Only the nonce should trigger a seek; activated/videoId are read fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekTo?.nonce]);

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      {/* The YouTube player renders inside here */}
      <div ref={hostRef} className="h-full w-full" title={title} />

      {!activated && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center text-white">
          <button
            type="button"
            onClick={() => setActivatedVideoId(videoId)}
            aria-label={`Play ${title || "lesson"}`}
            className="grid min-h-16 min-w-16 place-items-center rounded-full bg-red-600 transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <span
              aria-hidden="true"
              className="ml-1 block h-0 w-0 border-y-[9px] border-l-[15px] border-y-transparent border-l-white"
            />
          </button>
          <p className="text-sm font-semibold">Play lesson</p>
          <p className="max-w-sm text-xs text-slate-300">
            The YouTube player loads after you press play.
          </p>
        </div>
      )}

      {activated && status === "loading" && (
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

      {status === "unavailable" && (
        <FallbackOverlay
          videoId={videoId}
          showYouTubeLink={false}
          message="This video is no longer available on YouTube — it was removed or made private."
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
