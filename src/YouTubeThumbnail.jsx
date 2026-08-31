import { useEffect, useState } from "react";
import { Play } from "lucide-react";

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// hqdefault (480x360, ~20-40KB) suits the large card images; mqdefault
// (320x180, roughly a third the bytes) is plenty for thumbnails drawn at
// ~100px or less — on a cheap phone a 50-lesson list was downloading over a
// megabyte of pixels nobody could see. Both renditions exist for every
// public YouTube video, so the fallback behaviour is unchanged.
export function youtubeThumbnailUrl(videoId, quality = "hqdefault") {
  const id = String(videoId ?? "").trim();
  return YOUTUBE_VIDEO_ID.test(id)
    ? `https://img.youtube.com/vi/${id}/${quality}.jpg`
    : null;
}

export default function YouTubeThumbnail({
  videoId,
  alt = "",
  className = "",
  imageClassName = "",
  eager = false,
  // Default keeps every existing call site pixel-identical; small renditions
  // opt in to "mqdefault" explicitly.
  quality = "hqdefault",
}) {
  const [failed, setFailed] = useState(false);
  const src = youtubeThumbnailUrl(videoId, quality);

  useEffect(() => {
    setFailed(false);
  }, [videoId, quality]);

  return (
    <span className={`relative block overflow-hidden bg-surface-2 ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover ${imageClassName}`}
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-full w-full place-items-center bg-surface-2 text-accent"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full border border-accent-line bg-surface">
            <Play className="h-4 w-4 fill-current" />
          </span>
        </span>
      )}
    </span>
  );
}
