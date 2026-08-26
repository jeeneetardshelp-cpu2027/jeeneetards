// api/og.js — dynamic Open Graph card for a course, as a PNG.
//
// WHY. The single biggest volume of shares is students pasting raw
// /course/:id links into WhatsApp/Telegram batch groups. Every one of those
// previews used to show the same generic social-preview.png. This endpoint
// renders a per-course card (title, teacher, channel, subject colour, lecture
// count, confidence-gated rating) that injectCourseMeta points og:image at —
// so links the site ALREADY generates become branded, clickable previews with
// zero behaviour change asked of anyone.
//
// FAIL OPEN, ALWAYS. A link preview must never break: any invalid id, missing
// course, database hiccup, unsupported title script, or render failure
// redirects to the static /social-preview.png instead of erroring. WhatsApp's
// crawler follows redirects; a 500 here would strip the preview entirely.
//
// RENDERING. satori (element tree -> SVG) + resvg (SVG -> PNG) on the Node
// runtime, with the serif embedded as base64 modules (api/_og/font*.js) so
// the bundler needs no filesystem tracing. The card layout itself is the pure
// courseCardTree in api/_og/cardModel.js, unit-tested separately.
//
// CACHING. s-maxage lets Vercel's CDN serve repeat scrapes of the same course
// for a day without re-rendering; stale-while-revalidate keeps previews fast
// while a fresh card renders behind the scenes when ratings move.

import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import fontRegular from "./_og/fontRegular.js";
import fontBold from "./_og/fontBold.js";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  courseCardModel,
  courseCardTree,
  needsStaticFallback,
  parseCourseId,
} from "./_og/cardModel.js";

const FALLBACK = "https://www.jeeneetard.com/social-preview.png";
const LOOKUP_TIMEOUT_MS = 4000;

function fallback(res) {
  res.statusCode = 302;
  res.setHeader("Location", FALLBACK);
  // Cache the redirect briefly: a course that appears later should get its
  // card, but scrapers hammering a bad URL should not hammer the function.
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600");
  res.end();
}

async function lookupCourse(id) {
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supaUrl || !supaKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${supaUrl}/rest/v1/playlists?id=eq.${encodeURIComponent(id)}` +
        `&select=title,teacher,average_rating,ratings_count,subjects(name)` +
        `,institutes_channels(name),playlist_videos(count)`,
      {
        headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] ?? null : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  try {
    const query = new URL(req.url ?? "/", "https://internal").searchParams;
    const id = parseCourseId(query.get("course"));
    if (!id) return fallback(res);

    const model = courseCardModel(await lookupCourse(id));
    if (!model) return fallback(res);
    // The embedded serif is Latin-only; a Devanagari (or emoji/CJK) title
    // must not be rendered as missing-glyph boxes into a shared image.
    if (needsStaticFallback(`${model.title}${model.teacher}${model.channel}`)) {
      return fallback(res);
    }

    const svg = await satori(courseCardTree(model), {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts: [
        { name: "KaTeX Main", data: fontRegular, weight: 400, style: "normal" },
        { name: "KaTeX Main", data: fontBold, weight: 700, style: "normal" },
      ],
    });
    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: CARD_WIDTH },
    }).render().asPng();

    res.statusCode = 200;
    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
    );
    res.end(png);
  } catch {
    // A preview must never 500 — degrade to the static brand card.
    fallback(res);
  }
}
