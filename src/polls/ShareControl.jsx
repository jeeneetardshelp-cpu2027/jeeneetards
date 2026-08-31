// ShareControl.jsx — share a poll.
//
// Three paths, in order of what the device can actually do:
//   1. navigator.share  — the real sheet on a phone, which is where these
//      students are. Not available over plain http or on most desktops.
//   2. WhatsApp         — the channel this audience actually uses. A plain
//      wa.me link needs no SDK, no script, and no tracking.
//   3. Clipboard        — the universal fallback, with visible confirmation.
//
// An AbortError from navigator.share means the student closed the sheet. That
// is not a failure and must not raise an error message.

import { Check, Link2, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Absolute URL for a poll, safe to call during a test render with no window. */
export function pollShareUrl(slug, origin = typeof window === "undefined" ? "" : window.location.origin) {
  return `${origin}/polls/${slug}`;
}

const WHATSAPP_ICON_PATH =
  "M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31-.22.25-.85.83-.85 2.03s.87 2.35.99 2.51c.12.16 1.71 2.61 4.15 3.66.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z";

export default function ShareControl({ url, title, text, className = "", size = "md" }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const confirmCopied = () => {
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2200);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      confirmCopied();
    } catch {
      // Clipboard access can be denied; select-and-copy still works from the
      // address bar, so this stays silent rather than alarming.
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // The student closed the share sheet. Nothing went wrong.
        if (error?.name === "AbortError") return;
      }
    }
    await copyLink();
  };

  const pad = size === "sm" ? "min-h-11 px-3 text-xs" : "min-h-11 px-4 text-sm";
  const base = `inline-flex items-center gap-2 rounded-md border border-hairline bg-surface-2/60 font-medium text-ink-2 transition-colors duration-200 hover:border-accent-line hover:text-ink ${pad}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${text ? `${text} ` : ""}${url}`)}`;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button type="button" onClick={share} className={base}>
        {copied ? <Check aria-hidden="true" className="h-4 w-4 text-accent" /> : <Share2 aria-hidden="true" className="h-4 w-4" />}
        {copied ? "Link copied" : "Share"}
      </button>

      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className={base}
        aria-label="Share this poll on WhatsApp"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d={WHATSAPP_ICON_PATH} />
        </svg>
        WhatsApp
      </a>

      <button
        type="button"
        onClick={copyLink}
        className={base}
        aria-label="Copy a link to this poll"
      >
        <Link2 aria-hidden="true" className="h-4 w-4" />
        Copy link
      </button>

      {/* One live region for the whole control, so a screen reader hears the
          confirmation once rather than per button. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </div>
  );
}
