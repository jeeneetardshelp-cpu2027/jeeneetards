// api/og.js — dynamic Open Graph card for a course or a chapter, as a PNG.
//
// WHY. The single biggest volume of shares is students pasting raw
// /course/:id links into WhatsApp/Telegram batch groups. Every one of those
// previews used to show the same generic social-preview.png. This endpoint
// renders a per-course card (title, teacher, channel, subject colour, lecture
// count, confidence-gated rating) that injectCourseMeta points og:image at —
// so links the site ALREADY generates become branded, clickable previews with
// zero behaviour change asked of anyone.
//
// CHAPTERS. The link ChapterCleared shares is /course/:id/chapter/:chapterId,
// and as measured on 15 Sep 2026 its preview carried the whole COURSE's card.
// ?course=<id>&chapter=<chapterId> renders a chapter card instead: the chapter
// name, the course it is from (unless it is named just like the chapter; see
// api/_og/cardModel.js), and how many of that course's lectures are in it. The
// chapter half is strictly best-effort — if it cannot be confirmed the course
// card is drawn, never the static image and never a 500.
//
// FAIL OPEN, ALWAYS. A link preview must never break: any invalid id, missing
// course, database hiccup, unsupported title script, or render failure
// redirects to the static /social-preview.png instead of erroring. WhatsApp's
// crawler follows redirects; a 500 here would strip the preview entirely.
//
// RENDERING. satori (element tree -> SVG) + resvg (SVG -> PNG) on the Node
// runtime, with the serif embedded as base64 modules (api/_og/font*.js) so
// the bundler needs no filesystem tracing. The card layouts themselves are the
// pure courseCardTree / chapterCardTree in api/_og/cardModel.js, unit-tested
// separately.
//
// CACHING. s-maxage lets Vercel's CDN serve repeat scrapes of the same card
// for a day without re-rendering; stale-while-revalidate keeps previews fast
// while a fresh card renders behind the scenes when ratings move.

import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import fontRegular from "./_og/fontRegular.js";
import fontBold from "./_og/fontBold.js";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  chapterCardModel,
  chapterCardText,
  chapterCardTree,
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

function supabaseConfig() {
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY;
  return supaUrl && supaKey ? { supaUrl, supaKey } : null;
}

async function lookupCourse(id) {
  const config = supabaseConfig();
  if (!config) return null;
  const { supaUrl, supaKey } = config;
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

/**
 * The chapter's name and how many of THIS course's lectures are in it, in one
 * request. It walks the same playlist -> video -> chapter relationship the
 * middleware uses to confirm membership, so "no row" means "this chapter is not
 * in this course". The count comes from PostgREST's Content-Range total under
 * Prefer: count=exact, scoped by playlist_id — so it is a within-course count.
 * Verified against production 16 Sep 2026: course 88 + chapter 78 returned
 * 206 with Content-Range 0-0/92 and videos.chapters.name "Binomial Theorem";
 * the same chapter is in 114 playlist_videos rows catalogue-wide.
 *
 * Returns { name, lectures } when the chapter is in the course, null when the
 * lookup CONFIRMED it is not (a 2xx with no row), or CHAPTER_UNCONFIRMED when
 * the lookup failed (no config, non-2xx, a throw, the timeout). The two
 * non-card outcomes both draw the course card, but only a confirmed answer may
 * be cached for a day: an unconfirmed one must not pin the course card on the
 * chapter card's canonical URL. Never throws.
 */
const CHAPTER_UNCONFIRMED = Symbol("chapter lookup unconfirmed");

async function lookupChapter(courseId, chapterId) {
  const config = supabaseConfig();
  if (!config) return CHAPTER_UNCONFIRMED;
  const { supaUrl, supaKey } = config;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${supaUrl}/rest/v1/playlist_videos` +
        `?playlist_id=eq.${encodeURIComponent(courseId)}` +
        `&select=videos!inner(chapter_id,chapters(name))` +
        `&videos.chapter_id=eq.${encodeURIComponent(chapterId)}` +
        `&limit=1`,
      {
        headers: {
          apikey: supaKey,
          Authorization: `Bearer ${supaKey}`,
          Prefer: "count=exact",
        },
        signal: controller.signal,
      },
    );
    if (!res.ok) return CHAPTER_UNCONFIRMED;
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    const chapters = row.videos?.chapters;
    const name = Array.isArray(chapters) ? chapters[0]?.name : chapters?.name;
    // "0-0/92" -> 92. An unparseable total just drops the count chip.
    const total = /\/(\d+)\s*$/.exec(res.headers.get("content-range") ?? "");
    return { name: name ?? null, lectures: total ? Number(total[1]) : null };
  } catch {
    return CHAPTER_UNCONFIRMED;
  } finally {
    clearTimeout(timer);
  }
}

function render(tree) {
  return satori(tree, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: [
      { name: "KaTeX Main", data: fontRegular, weight: 400, style: "normal" },
      { name: "KaTeX Main", data: fontBold, weight: 700, style: "normal" },
    ],
  });
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url ?? "/", "https://internal");
    const id = parseCourseId(url.searchParams.get("course"));
    if (!id) return fallback(res);

    // A chapter param that is present but unusable is dropped, not an error:
    // the course is still known, so the variant canonicalises onto the course
    // card below.
    const chapterId = url.searchParams.has("chapter")
      ? parseCourseId(url.searchParams.get("chapter"))
      : null;

    // Collapse every URL variant onto ONE cache object, before doing any work.
    // The CDN keys on the exact query string, so ?course=5&utm_source=x and
    // ?course=5&t=99 are separate entries that each pay a fresh satori+resvg
    // render AND a database read — and this endpoint's URL is published in the
    // og:image of all 483 course pages, where anyone can append to it. The
    // handler ignores every parameter except `course` and `chapter`, so a
    // variant is pure waste. Redirect instead of rendering: scrapers here
    // already follow redirects (the static fallback below relies on it), and
    // the redirect itself is cached for a week so the second hit never reaches
    // the function. The chapter form has exactly one spelling too:
    // ?course=<id>&chapter=<chapterId>, in that order.
    const canonical = chapterId
      ? `?course=${id}&chapter=${chapterId}`
      : `?course=${id}`;
    if (url.search !== canonical) {
      res.statusCode = 308;
      res.setHeader("Location", `/api/og${canonical}`);
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=604800");
      res.end();
      return undefined;
    }

    const [courseRow, chapterInfo] = await Promise.all([
      lookupCourse(id),
      chapterId ? lookupChapter(id, chapterId) : null,
    ]);

    const courseModel = courseCardModel(courseRow);
    if (!courseModel) return fallback(res);

    // Chapter not in the course, lookup failed, or no name: the course card is
    // still true for this link, so draw it rather than the static image.
    const chapterUnconfirmed = chapterInfo === CHAPTER_UNCONFIRMED;
    const chapterModel = chapterId && !chapterUnconfirmed
      ? chapterCardModel(courseRow, chapterInfo)
      : null;

    // The embedded serif is Latin-only; a Devanagari (or emoji/CJK) title
    // must not be rendered as missing-glyph boxes into a shared image. The
    // gate covers every string the chosen card draws.
    const text = chapterModel
      ? chapterCardText(chapterModel)
      : `${courseModel.title}${courseModel.teacher}${courseModel.channel}`;
    if (needsStaticFallback(text)) return fallback(res);

    const svg = await render(
      chapterModel ? chapterCardTree(chapterModel) : courseCardTree(courseModel),
    );
    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: CARD_WIDTH },
    }).render().asPng();

    res.statusCode = 200;
    res.setHeader("Content-Type", "image/png");
    // A course card drawn only because the chapter lookup FAILED is a stand-in
    // on the chapter card's canonical URL: cache it as briefly as fallback()
    // caches a failed course lookup, with no stale window, so the next scrape
    // after a Supabase blip gets the real chapter card.
    res.setHeader(
      "Cache-Control",
      chapterUnconfirmed
        ? "public, max-age=0, s-maxage=3600"
        : "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
    );
    res.end(png);
  } catch {
    // A preview must never 500 — degrade to the static brand card.
    fallback(res);
  }
}
