// imageHosts.js — the one list of hosts a student-supplied picture may load from.
//
// Two student-writable surfaces embed images: poll options and forum posts.
// They must not keep separate lists. They already did once — the poll allowlist
// named eleven hosts while the deployed CSP allowed four, so seven of them
// rendered blank, including inside the admin review queue where pictures are
// vetted before publication. Everything that decides "may this image load" now
// reads from here, and src/pollImageCsp.test.js checks this list against the
// poll_image_hosts seed AND the img-src of both deploy configs.
//
// THE RULE FOR ADDING A HOST is not "is this site reputable". It is: can the
// SUBMITTER swap the bytes after a moderator has approved the link? A host that
// serves content the submitter does not control is eligible; a general
// user-upload surface is not, however respectable the domain. That is why
// commons.wikimedia.org is absent while upload.wikimedia.org (where its
// Special:FilePath links redirect to) is present, and it is the standing reason
// for keeping this list short on a site read by 14-18 year olds.
//
// Any host added here must also be added to img-src in BOTH vercel.json and
// netlify.toml, or the browser will block it and the picture will silently fail
// to render — including for the moderator reviewing it.

/** host -> the source name a student would recognise. */
export const APPROVED_IMAGE_HOSTS = Object.freeze({
  "i.ytimg.com": "YouTube",
  "img.youtube.com": "YouTube",
  "yt3.ggpht.com": "YouTube",
  "upload.wikimedia.org": "Wikipedia",
  "assets.openstax.org": "OpenStax",
  "openstax.org": "OpenStax",
  "cdn.kastatic.org": "Khan Academy",
  "ncert.nic.in": "NCERT",
  "www.jeeneetard.com": "this site",
  "jeeneetard.com": "this site",
});

/** The recognisable source names, de-duplicated, for student-facing copy. */
export const APPROVED_IMAGE_SOURCES = [...new Set(Object.values(APPROVED_IMAGE_HOSTS))];

/**
 * Is this absolute URL an image we are willing to load?
 *
 * Deliberately strict, and deliberately not a substring match: `hostname`
 * comes from the URL parser, so `evil.com/?x=ncert.nic.in`,
 * `ncert.nic.in.evil.com` and a userinfo prefix like
 * `https://ncert.nic.in@evil.com/x.png` all fail, where a naive `includes()`
 * would pass all three. Only https — an http image on an https page is blocked
 * as mixed content anyway, so allowing it only produces a silent breakage.
 */
export function isApprovedImageUrl(value) {
  try {
    const parsed = new URL(String(value ?? ""));
    if (parsed.protocol !== "https:") return false;
    return Object.hasOwn(APPROVED_IMAGE_HOSTS, parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
