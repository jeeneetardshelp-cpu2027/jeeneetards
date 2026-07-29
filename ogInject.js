// ogInject.js — pure helpers for per-course <head> metadata.
//
// Shared by the Vercel Edge middleware (middleware.js) and its local test
// (src/scripts/testCourseMeta.js). No imports, no side effects, no runtime
// assumptions — just string in, string out — so the exact logic that ships
// can be exercised under plain Node before it ever reaches the edge.

const SITE = "https://www.jeeneetard.com";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build the { title, description, url } for a course row from PostgREST. */
export function courseMeta(course, id) {
  const subject = course?.subjects?.name || null;
  const lessons = course?.playlist_videos?.[0]?.count ?? null;
  const title = `${course.title} | JEENEETARD`;
  const parts = [
    "Free course",
    lessons ? `${lessons} lecture${lessons === 1 ? "" : "s"}` : null,
    subject,
    course.teacher ? `by ${course.teacher}` : null,
  ].filter(Boolean);
  const description = `${parts.join(" · ")}. Watch ad-free on JEENEETARD.`;
  return { title, description, url: `${SITE}/course/${id}` };
}

/**
 * Swap the generic homepage <head> tags in the built index.html shell for a
 * course's own. Relies on the tags being single-line (see index.html). Any tag
 * that does not match is simply left as-is — a partial rewrite is still valid
 * HTML, never a broken page.
 */
export function injectCourseMeta(html, meta) {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const u = escapeHtml(meta.url);
  // Function replacements throughout: a string replacement would expand `$`
  // sequences ($&, $', $1, …) in course titles as replace() patterns and
  // corrupt the page — a title like `worth $199` must stay literal text.
  const out = html
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, (m, a, z) => `${a}${d}${z}`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, (m, a, z) => `${a}${t}${z}`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, (m, a, z) => `${a}${d}${z}`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, (m, a, z) => `${a}${u}${z}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, (m, a, z) => `${a}${t}${z}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, (m, a, z) => `${a}${d}${z}`);
  // Canonical: the shell deliberately ships WITHOUT one (a static canonical
  // would claim the homepage for every route). Replace it if an old shell
  // still has it, otherwise insert it next to <title> — which always exists.
  const canonicalTag = `<link rel="canonical" href="${u}" />`;
  return /<link rel="canonical"[^>]*>/.test(out)
    ? out.replace(/<link rel="canonical"[^>]*>/, () => canonicalTag)
    : out.replace(/<title>/, () => `${canonicalTag}\n    <title>`);
}
