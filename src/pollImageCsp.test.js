// The poll picture allowlist and the deployed CSP must agree.
//
// They did not. The seed promised 11 hosts while vercel.json's img-src allowed
// 4, so seven of them — OpenStax, Khan Academy, NCERT, Wikimedia — would have
// been blocked by the browser on the day polls launched. Worst of all in the
// ADMIN REVIEW QUEUE, which renders each submitted picture as an <img> on this
// origin: the reviewer would have seen an empty box and approved pictures they
// could not actually see, defeating the one human control the runbook leans on.
//
// Nothing caught it because no test, preflight or runbook mentioned CSP at all.
// This is that test. It reads the real seed and the real deployed config, so it
// fails if either side moves without the other.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sqlSource = readFileSync("src/migrations/polls_v1.sql", "utf8");
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const netlify = readFileSync("netlify.toml", "utf8");

/** Hosts inserted into poll_image_hosts by the migration's seed block. */
function seededHosts() {
  const block = sqlSource.split("insert into public.poll_image_hosts")[1] ?? "";
  const rows = block.split(";")[0];
  return [...rows.matchAll(/\('([^']+)',/g)].map((m) => m[1]);
}

const imgSrc = (csp) => (csp.match(/img-src ([^;]+);/) ?? [])[1] ?? "";

const vercelCsp = vercel.headers
  .flatMap((rule) => rule.headers ?? [])
  .find((h) => h.key === "Content-Security-Policy")?.value ?? "";

describe("poll image allowlist agrees with the shipped CSP", () => {
  it("finds a real seed and a real policy to compare", () => {
    // Guards the test itself: a silent parse failure would make every
    // assertion below vacuously true.
    expect(seededHosts().length).toBeGreaterThan(4);
    expect(imgSrc(vercelCsp)).toContain("'self'");
  });

  it("allows every seeded host in the Vercel CSP", () => {
    const allowed = imgSrc(vercelCsp);
    for (const host of seededHosts()) {
      // The site's own hosts are covered by 'self'.
      if (host.endsWith("jeeneetard.com") && allowed.includes("'self'") && host.startsWith("www.")) continue;
      expect(allowed, `img-src is missing ${host}`).toContain(host);
    }
  });

  it("keeps Netlify's copy in step with Vercel's", () => {
    // Two deploy targets, one policy — a host added to only one of them is the
    // same silent divergence in a different file.
    const netlifyAllowed = imgSrc(netlify);
    for (const host of seededHosts()) {
      if (host.endsWith("jeeneetard.com") && host.startsWith("www.")) continue;
      expect(netlifyAllowed, `netlify.toml img-src is missing ${host}`).toContain(host);
    }
  });

  it("does not allow commons.wikimedia.org, a user-upload surface", () => {
    // Deliberately dropped on 2026-09-01: its links redirect into
    // upload.wikimedia.org (still allowed), so the diagrams stay reachable
    // without putting a user-upload host in front of an audience of minors.
    expect(seededHosts()).not.toContain("commons.wikimedia.org");
    expect(imgSrc(vercelCsp)).not.toContain("commons.wikimedia.org");
  });
});
