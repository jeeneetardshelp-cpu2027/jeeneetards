// The one allowlist behind every student-supplied picture.
//
// The forum's Markdown renderer used to accept an <img> from ANY host — the
// check was literally "is the protocol http or https" — on a page anonymous
// minors read and Google indexes. An <img> loads automatically for every
// reader, so that handed any invited poster the ability to show arbitrary
// third-party imagery to children and to collect every reader's IP and
// user-agent on a server of their choosing.
import { describe, expect, it } from "vitest";
import {
  APPROVED_IMAGE_HOSTS,
  APPROVED_IMAGE_SOURCES,
  isApprovedImageUrl,
} from "./imageHosts.js";

describe("isApprovedImageUrl", () => {
  it("accepts each approved host", () => {
    for (const host of Object.keys(APPROVED_IMAGE_HOSTS)) {
      expect(isApprovedImageUrl(`https://${host}/some/figure.png`), host).toBe(true);
    }
  });

  it("rejects an arbitrary host", () => {
    expect(isApprovedImageUrl("https://tracker.example.com/pixel.png")).toBe(false);
    expect(isApprovedImageUrl("https://evil.test/a.jpg")).toBe(false);
  });

  it("is not fooled by a host that merely contains an approved name", () => {
    // The three shapes a naive `includes()` check would wave through.
    expect(isApprovedImageUrl("https://ncert.nic.in.evil.test/x.png")).toBe(false);
    expect(isApprovedImageUrl("https://evil.test/?x=ncert.nic.in")).toBe(false);
    expect(isApprovedImageUrl("https://ncert.nic.in@evil.test/x.png")).toBe(false);
  });

  it("refuses commons.wikimedia.org while allowing upload.wikimedia.org", () => {
    // Commons is a user-upload surface carrying explicit material; its
    // Special:FilePath links redirect into upload, which stays allowed.
    expect(isApprovedImageUrl("https://commons.wikimedia.org/wiki/Special:FilePath/L.svg")).toBe(false);
    expect(isApprovedImageUrl("https://upload.wikimedia.org/w/x.png")).toBe(true);
  });

  it("refuses non-https and unparseable input without throwing", () => {
    expect(isApprovedImageUrl("http://ncert.nic.in/x.png")).toBe(false);
    expect(isApprovedImageUrl("javascript:alert(1)")).toBe(false);
    expect(isApprovedImageUrl("/relative/path.png")).toBe(false);
    expect(isApprovedImageUrl("")).toBe(false);
    expect(isApprovedImageUrl(null)).toBe(false);
    expect(isApprovedImageUrl(undefined)).toBe(false);
  });

  it("exposes de-duplicated source names for student-facing copy", () => {
    expect(APPROVED_IMAGE_SOURCES).toContain("NCERT");
    expect(APPROVED_IMAGE_SOURCES).toContain("YouTube");
    // Three YouTube hosts must read as one source, not three.
    expect(APPROVED_IMAGE_SOURCES.filter((s) => s === "YouTube")).toHaveLength(1);
  });
});
