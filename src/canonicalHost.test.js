// One host serves this site to students: www.jeeneetard.com.
//
// Vercel also kept the project's auto-generated alias live and serving a full
// 200 — same pages, same robots.txt "Allow: /". That split the site three ways:
// Google could index a duplicate under a domain the owner does not own, shares
// carried that URL instead of the real one, and Web Analytics counted its hits
// as visitors, inflating the number the owner uses to decide what to build.
//
// The redirect is exact-matched ON PURPOSE. Preview deployments live on
// sibling *.vercel.app hosts and are how every PR gets reviewed, so a wildcard
// here would have broken the review flow to fix an SEO leak.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const hostRules = (vercel.redirects ?? []).filter((r) =>
  (r.has ?? []).some((h) => h.type === "host"));
const rule = hostRules.find((r) => r.source !== "/") ?? hostRules[0];
const rootRule = hostRules.find((r) => r.source === "/");

describe("non-canonical hosts redirect to the real domain", () => {
  it("declares a host-conditional redirect at all", () => {
    // Asserts the input exists before anything below reasons about it.
    expect(rule, "no host-conditional redirect in vercel.json").toBeTruthy();
    expect(rule.destination).toBe("https://www.jeeneetard.com/:path*");
  });

  it("is permanent, so search engines consolidate rather than keep both", () => {
    expect(rule.permanent).toBe(true);
  });

  it("carries the path through instead of dumping everyone on the homepage", () => {
    // A deep share of /course/5 must land on /course/5, not "/".
    expect(rule.source).toBe("/:path*");
    expect(rule.destination).toContain(":path*");
  });

  it("matches the live production alias", () => {
    const re = new RegExp(rule.has.find((h) => h.type === "host").value);
    expect(re.test("jeeneetards-nine.vercel.app")).toBe(true);
  });

  it("does NOT match the canonical host, so it cannot loop", () => {
    const re = new RegExp(rule.has.find((h) => h.type === "host").value);
    expect(re.test("www.jeeneetard.com")).toBe(false);
    expect(re.test("jeeneetard.com")).toBe(false);
  });

  it("does NOT match preview deployments, which PR review depends on", () => {
    const re = new RegExp(rule.has.find((h) => h.type === "host").value);
    for (const host of [
      "jeeneetards-git-main-jeeneet.vercel.app",
      "jeeneetards-abc123xyz-jeeneet.vercel.app",
      "jeeneetards-git-claude-reconcile-release-jeeneet.vercel.app",
    ]) {
      expect(re.test(host), `would have broken preview host ${host}`).toBe(false);
    }
  });

  it("anchors the pattern, so the dots are literal", () => {
    const value = rule.has.find((h) => h.type === "host").value;
    expect(value.startsWith("^")).toBe(true);
    expect(value.endsWith("$")).toBe(true);
    // An unescaped dot matches any character; a host-shaped near-miss must fail.
    expect(new RegExp(value).test("jeeneetards-nineXvercelYapp")).toBe(false);
  });
});

// Found by checking the LIVE site, not the config: Vercel's "/:path*" did not
// match the bare root, so every sub-path redirected while the HOMEPAGE — the
// page most likely to be indexed and shared — kept serving 200 on the alias.
// A config test cannot know the platform's matching semantics; only a request
// can. This pins the explicit rule that closes it.
describe("the homepage redirects too, not just sub-paths", () => {
  it("declares an explicit root rule", () => {
    expect(rootRule, "no redirect with source '/' — the homepage will leak").toBeTruthy();
    expect(rootRule.destination).toBe("https://www.jeeneetard.com/");
    expect(rootRule.permanent).toBe(true);
  });

  it("scopes the root rule to the same non-canonical host", () => {
    const re = new RegExp(rootRule.has.find((h) => h.type === "host").value);
    expect(re.test("jeeneetards-nine.vercel.app")).toBe(true);
    expect(re.test("www.jeeneetard.com")).toBe(false);
    expect(re.test("jeeneetards-git-main-jeeneet.vercel.app")).toBe(false);
  });
});
