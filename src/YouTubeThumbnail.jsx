import { useEffect, useState } from "react";
import { Play } from "lucide-react";

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeThumbnailUrl(videoId) {
  const id = String(videoId ?? "").trim();
  return YOUTUBE_VIDEO_ID.test(id)
    ? `https://img.youtube.com/vi/${id}/hqdefault.jpg`
    : null;
}

export default function YouTubeThumbnail({
  videoId,
  alt = "",
  className = "",
  imageClassName = "",
  eager = false,
}) {
  const [failed, setFailed] = useState(false);
  const src = youtubeThumbnailUrl(videoId);

  useEffect(() => {
    setFailed(false);
  }, [videoId]);

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
