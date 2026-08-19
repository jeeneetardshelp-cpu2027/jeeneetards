import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

const TRUSTED_AVATAR_HOSTS = new Set([
  "yt3.ggpht.com",
  "yt3.googleusercontent.com",
]);

export function channelAvatarUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && TRUSTED_AVATAR_HOSTS.has(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export default function ChannelAvatar({ url, name = "", className = "h-8 w-8" }) {
  const [failed, setFailed] = useState(false);
  const src = channelAvatarUrl(url);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-hairline bg-surface-2 text-ink-3 ${className}`}
      title={name || undefined}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Building2 className="h-1/2 w-1/2" />
      )}
    </span>
  );
}
