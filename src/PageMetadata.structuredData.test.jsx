// PageMetadata's structured-data DOM layer: applyStructuredData + the
// useStructuredData hook. These consume plain schema.org objects (built
// elsewhere, by src/structuredData.js) and only manage the <script
// type="application/ld+json"> tags in document.head — upsert-by-@type,
// remove-when-stale, no-op on null/undefined entries.
//
// The serializer (safeStructuredDataJson) is imported from the real
// src/structuredData.js rather than hand-rolled here on purpose: the bug
// this suite exists to catch is drift between "what PageMetadata writes to
// the DOM" and "what the serializer actually escapes", so a fixture that
// reimplements escaping would hide exactly the class of bug we care about.
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { applyStructuredData, useStructuredData } from "./PageMetadata.jsx";
import { safeStructuredDataJson } from "./structuredData.js";

function schemaScripts() {
  return Array.from(
    document.head.querySelectorAll('script[type="application/ld+json"][data-schema-key]'),
  );
}

function keysOf(scripts) {
  return scripts.map((el) => el.getAttribute("data-schema-key")).sort();
}

afterEach(() => {
  cleanup();
  schemaScripts().forEach((el) => el.remove());
});

describe("applyStructuredData", () => {
  it("writes one script[type=application/ld+json] per schema, keyed by @type", () => {
    const course = { "@type": "Course", name: "Kinematics" };
    applyStructuredData([course]);

    const scripts = schemaScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute("type")).toBe("application/ld+json");
    expect(scripts[0].getAttribute("data-schema-key")).toBe("Course");
  });

  it("matches safeStructuredDataJson exactly (no re-escaping, no double-encoding)", () => {
    const course = { "@type": "Course", name: 'Kinematics "basics" & beyond' };
    applyStructuredData([course]);
    expect(schemaScripts()[0].textContent).toBe(safeStructuredDataJson(course));
  });

  it("escapes </script> so an untrusted title cannot close the tag early", () => {
    const hostile = {
      "@type": "Course",
      name: "</script><script>alert(1)</script>",
    };
    applyStructuredData([hostile]);

    const text = schemaScripts()[0].textContent;
    expect(text.toLowerCase()).not.toContain("</script");
    expect(text).toBe(safeStructuredDataJson(hostile));
  });

  it("silently skips null and undefined entries", () => {
    applyStructuredData([null, undefined, { "@type": "WebSite", name: "JEENEETARD" }]);
    const scripts = schemaScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute("data-schema-key")).toBe("WebSite");
  });

  it("adds new keys and removes keys absent from a later call", () => {
    applyStructuredData([
      { "@type": "Course", name: "Kinematics" },
      { "@type": "VideoObject", name: "Lesson 1" },
    ]);
    expect(keysOf(schemaScripts())).toEqual(["Course", "VideoObject"]);

    // BreadcrumbList replaces VideoObject; Course is carried over.
    applyStructuredData([
      { "@type": "Course", name: "Kinematics" },
      { "@type": "BreadcrumbList", itemListElement: [] },
    ]);
    expect(keysOf(schemaScripts())).toEqual(["BreadcrumbList", "Course"]);
  });

  it("replaces textContent in place for a repeated @type instead of duplicating the tag", () => {
    applyStructuredData([{ "@type": "Course", name: "Kinematics" }]);
    const firstElement = schemaScripts()[0];

    const updated = { "@type": "Course", name: "Advanced Kinematics" };
    applyStructuredData([updated]);

    const scripts = schemaScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toBe(firstElement); // same node, updated in place
    expect(scripts[0].textContent).toBe(safeStructuredDataJson(updated));
  });

  it("clears every schema script when called with an empty array", () => {
    applyStructuredData([{ "@type": "Course", name: "Kinematics" }]);
    expect(schemaScripts()).toHaveLength(1);

    applyStructuredData([]);
    expect(schemaScripts()).toHaveLength(0);
  });
});

describe("useStructuredData", () => {
  it("writes schemas to document.head when the hook runs", () => {
    const { unmount } = renderHook(() =>
      useStructuredData([{ "@type": "Course", name: "Kinematics" }], ["course-1"]),
    );
    expect(keysOf(schemaScripts())).toEqual(["Course"]);
    unmount();
  });

  it("drops keys no longer present and adopts new ones when deps change", () => {
    const { rerender, unmount } = renderHook(
      ({ schemas, deps }) => useStructuredData(schemas, deps),
      {
        initialProps: {
          schemas: [
            { "@type": "Course", name: "Kinematics" },
            { "@type": "VideoObject", name: "Lesson 1" },
          ],
          deps: ["v1"],
        },
      },
    );
    expect(keysOf(schemaScripts())).toEqual(["Course", "VideoObject"]);

    const nextCourse = { "@type": "Course", name: "Advanced Mechanics" };
    rerender({ schemas: [nextCourse], deps: ["v2"] });

    const scripts = schemaScripts();
    expect(keysOf(scripts)).toEqual(["Course"]);
    expect(scripts[0].textContent).toBe(safeStructuredDataJson(nextCourse));

    unmount();
  });

  it("does not re-run when deps are unchanged, and does write nothing for an all-null array", () => {
    const { unmount } = renderHook(() => useStructuredData([null, undefined], []));
    expect(schemaScripts()).toHaveLength(0);
    unmount();
    expect(schemaScripts()).toHaveLength(0);
  });

  it("removes every schema script it wrote on unmount, leaving nothing for the next route", () => {
    const { unmount } = renderHook(() =>
      useStructuredData(
        [
          { "@type": "Course", name: "Kinematics" },
          { "@type": "BreadcrumbList", itemListElement: [] },
        ],
        ["course-1"],
      ),
    );
    expect(schemaScripts()).toHaveLength(2);

    unmount();
    expect(schemaScripts()).toHaveLength(0);
  });
});
