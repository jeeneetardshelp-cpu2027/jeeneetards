// structuredData.test.js — locks the schema.org JSON-LD contract: what gets
// emitted, what gets omitted (never as a null-valued key), and the
// script-breakout escaping every DOM caller depends on.

import { describe, expect, it } from "vitest";
import { RATING_CONFIDENCE_MIN, ratingDisplay } from "./ratingConfidence.js";
import {
  breadcrumbListSchema,
  courseSchema,
  durationToIso8601,
  itemListSchema,
  learningResourceSchema,
  organizationSchema,
  personSchema,
  safeStructuredDataJson,
  videoObjectSchema,
  websiteSchema,
} from "./structuredData.js";

describe("learningResourceSchema", () => {
  const guide = {
    scope: { goal: "jee", cls: "class-11", subject: "physics" },
    label: "Study guide",
    title: "A practical order for JEE Class 11 Physics",
    introduction: ["Use this page as a route through the free-video catalogue."],
    sources: [
      {
        label: "Official JEE Main syllabus (NTA)",
        href: "https://jeemain.nta.nic.in/document/syllabus-2026/",
      },
    ],
  };

  it("describes only the visible reviewed guide and its visible citation", () => {
    expect(learningResourceSchema({
      guide,
      url: "/explore/jee/class-11/physics",
    })).toEqual({
      "@context": "https://schema.org",
      "@type": "LearningResource",
      "@id": "https://www.jeeneetard.com/explore/jee/class-11/physics#subject-guide",
      url: "https://www.jeeneetard.com/explore/jee/class-11/physics#subject-guide",
      name: "A practical order for JEE Class 11 Physics",
      learningResourceType: "Study guide",
      inLanguage: "en-IN",
      isAccessibleForFree: true,
      audience: { "@type": "EducationalAudience", educationalRole: "student" },
      isPartOf: {
        "@type": "WebPage",
        "@id": "https://www.jeeneetard.com/explore/jee/class-11/physics",
      },
      publisher: {
        "@type": "Organization",
        name: "JEENEETARD",
        url: "https://www.jeeneetard.com/",
      },
      description: "Use this page as a route through the free-video catalogue.",
      educationalLevel: "Class 11",
      citation: [{
        "@type": "CreativeWork",
        name: "Official JEE Main syllabus (NTA)",
        url: "https://jeemain.nta.nic.in/document/syllabus-2026/",
      }],
    });
  });

  it("does not invent a learning resource for an ordinary Explore page", () => {
    expect(learningResourceSchema({ guide: null, url: "/explore/jee" })).toBeNull();
    expect(learningResourceSchema({ guide, url: null })).toBeNull();
  });
});

describe("personSchema", () => {
  it("describes only verified public faculty facts", () => {
    expect(personSchema({
      name: "Amit Bijarnia",
      url: "/faculty/amit-bijarnia",
      description: "Physics faculty profile.",
      image: "https://example.com/amit.jpg",
      aliases: ["ABJ Sir"],
      institutes: ["Competishun"],
      sameAs: ["https://www.youtube.com/@example", "javascript:alert(1)"],
    })).toEqual({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Amit Bijarnia",
      url: "https://www.jeeneetard.com/faculty/amit-bijarnia",
      description: "Physics faculty profile.",
      image: "https://example.com/amit.jpg",
      alternateName: ["ABJ Sir"],
      affiliation: [{ "@type": "Organization", name: "Competishun" }],
      sameAs: ["https://www.youtube.com/@example"],
    });
  });

  it("omits unavailable optional profile fields instead of inventing them", () => {
    const schema = personSchema({ name: "Amit Bijarnia" });
    expect(schema).toEqual({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Amit Bijarnia",
    });
    expect(personSchema({})).toBeNull();
  });
});

describe("durationToIso8601", () => {
  it("omits the hours component when it's zero", () => {
    expect(durationToIso8601(32 * 60)).toBe("PT32M");
  });

  it("omits the minutes component when it's zero", () => {
    expect(durationToIso8601(3600 + 5)).toBe("PT1H5S");
  });

  it("includes every non-zero component together", () => {
    expect(durationToIso8601(3661)).toBe("PT1H1M1S");
  });

  it("floors fractional seconds", () => {
    expect(durationToIso8601(125.9)).toBe("PT2M5S");
  });

  it("returns null, not PT0S, for an all-zero duration", () => {
    expect(durationToIso8601(0)).toBeNull();
  });

  it("returns null for a positive value that floors to all-zero components", () => {
    expect(durationToIso8601(0.4)).toBeNull();
  });

  it("returns null for negative input", () => {
    expect(durationToIso8601(-45)).toBeNull();
  });

  it("returns null for non-finite or missing input", () => {
    expect(durationToIso8601(null)).toBeNull();
    expect(durationToIso8601(undefined)).toBeNull();
    expect(durationToIso8601(NaN)).toBeNull();
    expect(durationToIso8601(Infinity)).toBeNull();
  });
});

const REAL_COURSE = {
  title: "Rectilinear Motion (Kinematics)",
  description: "Free physics kinematics course for JEE and NEET.",
  institute: "Mohit Tyagi",
  teacher: "ABJ Sir",
  averageRating: 0,
  ratingsCount: 0,
  url: "https://www.jeeneetard.com/course/5",
};

describe("courseSchema", () => {
  it("builds the full node when every field is present but ratings are absent", () => {
    const schema = courseSchema(REAL_COURSE);
    expect(schema).toEqual({
      "@context": "https://schema.org",
      "@type": "Course",
      name: "Rectilinear Motion (Kinematics)",
      description: "Free physics kinematics course for JEE and NEET.",
      provider: { "@type": "Organization", name: "Mohit Tyagi" },
      hasCourseInstance: {
        "@type": "CourseInstance",
        courseMode: "online",
        instructor: { "@type": "Person", name: "ABJ Sir" },
      },
      url: "https://www.jeeneetard.com/course/5",
    });
  });

  it("never emits aggregateRating when ratingsCount is 0 (today's real site state)", () => {
    const schema = courseSchema({ ...REAL_COURSE, ratingsCount: 0 });
    expect(schema).not.toHaveProperty("aggregateRating");
  });

  // Was previously "emits aggregateRating once ratingsCount is at least 1",
  // which pinned a real defect: a single 5-star vote was published to Google as
  // a 5.0 average while the page itself refused to show that score, because the
  // on-page rule (ratingConfidence.js) needs RATING_CONFIDENCE_MIN ratings
  // first. Search results must not claim more confidence than the site will.
  it("withholds aggregateRating below the confidence minimum the UI itself uses", () => {
    for (let count = 1; count < RATING_CONFIDENCE_MIN; count += 1) {
      const schema = courseSchema({ ...REAL_COURSE, averageRating: 5, ratingsCount: count });
      expect(schema).not.toHaveProperty("aggregateRating");
    }
  });

  it("emits aggregateRating once the confidence minimum is reached", () => {
    const schema = courseSchema({
      ...REAL_COURSE, averageRating: 4.5, ratingsCount: RATING_CONFIDENCE_MIN,
    });
    expect(schema.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.5,
      ratingCount: RATING_CONFIDENCE_MIN,
      bestRating: 5,
      worstRating: 1,
    });
  });

  it("agrees with what the page shows the student, at every count", () => {
    // The invariant that matters: structured data may only carry a score when
    // ratingDisplay would render one.
    for (const count of [0, 1, 4, 5, 12]) {
      const schema = courseSchema({ ...REAL_COURSE, averageRating: 4.2, ratingsCount: count });
      const onPage = ratingDisplay(4.2, count);
      expect(Boolean(schema.aggregateRating)).toBe(onPage?.kind === "scored");
    }
  });

  it("omits description as a missing key, never as description: null", () => {
    const schema = courseSchema({ ...REAL_COURSE, description: null });
    expect(schema).not.toHaveProperty("description");
  });

  it("omits provider entirely when institute is falsy, and never invents JEENEETARD", () => {
    for (const institute of [null, undefined, ""]) {
      const schema = courseSchema({ ...REAL_COURSE, institute });
      expect(schema).not.toHaveProperty("provider");
    }
  });

  it("uses the real institute as provider, never the site name", () => {
    const schema = courseSchema(REAL_COURSE);
    expect(schema.provider.name).toBe("Mohit Tyagi");
    expect(schema.provider.name).not.toBe("JEENEETARD");
  });

  it("always emits hasCourseInstance, omitting instructor when there's no teacher", () => {
    const schema = courseSchema({ ...REAL_COURSE, teacher: null });
    expect(schema.hasCourseInstance).toEqual({
      "@type": "CourseInstance",
      courseMode: "online",
    });
  });

  it("omits url when falsy", () => {
    const schema = courseSchema({ ...REAL_COURSE, url: null });
    expect(schema).not.toHaveProperty("url");
  });

  it("accepts (and ignores) lessonCount/subjectName/totalDurationSeconds — no correct schema.org Course field exists for them today", () => {
    const schema = courseSchema({
      ...REAL_COURSE,
      subjectName: "Physics",
      lessonCount: 12,
      totalDurationSeconds: 5978,
    });
    expect(schema.name).toBe("Rectilinear Motion (Kinematics)");
    expect(JSON.stringify(schema)).not.toContain("Physics");
  });
});

describe("videoObjectSchema", () => {
  const REAL_VIDEO = {
    title: "Rectilinear Motion",
    description: null,
    youtubeVideoId: "CBvaO-uDvs8",
    durationSeconds: 2616,
  };

  it("builds the full node from real lesson-1 data", () => {
    const schema = videoObjectSchema(REAL_VIDEO);
    expect(schema).toEqual({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: "Rectilinear Motion",
      thumbnailUrl: "https://img.youtube.com/vi/CBvaO-uDvs8/hqdefault.jpg",
      embedUrl: "https://www.youtube-nocookie.com/embed/CBvaO-uDvs8",
      duration: "PT43M36S",
    });
  });

  it("returns null when there is no YouTube id to describe", () => {
    expect(videoObjectSchema({ ...REAL_VIDEO, youtubeVideoId: null })).toBeNull();
    expect(videoObjectSchema({ ...REAL_VIDEO, youtubeVideoId: "" })).toBeNull();
    expect(videoObjectSchema()).toBeNull();
  });

  it("omits description as a missing key when falsy", () => {
    const schema = videoObjectSchema(REAL_VIDEO);
    expect(schema).not.toHaveProperty("description");
  });

  it("includes description when present", () => {
    const schema = videoObjectSchema({ ...REAL_VIDEO, description: "Part 1 of kinematics." });
    expect(schema.description).toBe("Part 1 of kinematics.");
  });

  it("defaults thumbnailUrl to the hqdefault YouTube thumbnail", () => {
    const schema = videoObjectSchema(REAL_VIDEO);
    expect(schema.thumbnailUrl).toBe(
      "https://img.youtube.com/vi/CBvaO-uDvs8/hqdefault.jpg",
    );
  });

  it("uses an explicit thumbnailUrl when one is passed", () => {
    const schema = videoObjectSchema({
      ...REAL_VIDEO,
      thumbnailUrl: "https://img.youtube.com/vi/CBvaO-uDvs8/maxresdefault.jpg",
    });
    expect(schema.thumbnailUrl).toBe(
      "https://img.youtube.com/vi/CBvaO-uDvs8/maxresdefault.jpg",
    );
  });

  it("omits duration when durationSeconds doesn't produce one", () => {
    const schema = videoObjectSchema({ ...REAL_VIDEO, durationSeconds: 0 });
    expect(schema).not.toHaveProperty("duration");
  });

  it("never includes uploadDate — no real upload-date column exists in the schema", () => {
    const schema = videoObjectSchema({
      ...REAL_VIDEO,
      // Even if a caller mistakenly passes one through, this function must
      // not surface it: it isn't destructured, so it can't leak.
      uploadDate: "2024-01-01",
      lastVerifiedAt: "2026-07-30T00:00:00Z",
      createdAt: "2024-05-01T00:00:00Z",
    });
    expect(schema).not.toHaveProperty("uploadDate");
    expect(JSON.stringify(schema)).not.toContain("2024");
  });
});

describe("breadcrumbListSchema", () => {
  it("returns null for an empty trail", () => {
    expect(breadcrumbListSchema([])).toBeNull();
  });

  it("returns null for a single-crumb trail (not a breadcrumb)", () => {
    expect(breadcrumbListSchema([{ label: "Home", url: "/" }])).toBeNull();
  });

  it("returns null for non-array input", () => {
    expect(breadcrumbListSchema(null)).toBeNull();
    expect(breadcrumbListSchema(undefined)).toBeNull();
  });

  it("builds an absolute, 1-indexed trail and omits item for a null terminal url", () => {
    const schema = breadcrumbListSchema([
      { label: "Home", url: "/" },
      { label: "Physics", url: "/explore/jee/physics" },
      { label: "Rectilinear Motion (Kinematics)", url: null },
    ]);
    expect(schema).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.jeeneetard.com/" },
        {
          "@type": "ListItem",
          position: 2,
          name: "Physics",
          item: "https://www.jeeneetard.com/explore/jee/physics",
        },
        { "@type": "ListItem", position: 3, name: "Rectilinear Motion (Kinematics)" },
      ],
    });
  });

  it("leaves an already-absolute url untouched instead of double-prefixing it", () => {
    const schema = breadcrumbListSchema([
      { label: "Home", url: "https://www.jeeneetard.com/" },
      { label: "Course", url: "https://www.jeeneetard.com/course/5" },
    ]);
    expect(schema.itemListElement[1].item).toBe("https://www.jeeneetard.com/course/5");
  });
});

describe("itemListSchema", () => {
  it("returns null for an empty list", () => {
    expect(itemListSchema([])).toBeNull();
    expect(itemListSchema(null)).toBeNull();
  });

  it("trusts the caller's position (already accounting for pagination offset)", () => {
    const schema = itemListSchema([
      { title: "Rectilinear Motion (Kinematics)", url: "/course/5", position: 21 },
      { title: "Chemical Bonding", url: "/course/9", position: 22 },
    ]);
    expect(schema).toEqual({
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 21,
          name: "Rectilinear Motion (Kinematics)",
          url: "https://www.jeeneetard.com/course/5",
        },
        {
          "@type": "ListItem",
          position: 22,
          name: "Chemical Bonding",
          url: "https://www.jeeneetard.com/course/9",
        },
      ],
    });
  });
});

describe("websiteSchema", () => {
  it("points the search action at / with ?q=, not at /search", () => {
    const schema = websiteSchema();
    expect(schema).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      url: "https://www.jeeneetard.com/",
      name: "JEENEETARD",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://www.jeeneetard.com/?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    });
  });
});

describe("organizationSchema", () => {
  it("describes the site, with no logo and no course-provider claims", () => {
    const schema = organizationSchema();
    expect(schema).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "JEENEETARD",
      url: "https://www.jeeneetard.com/",
      publishingPrinciples: "https://www.jeeneetard.com/methodology",
      description:
        "Browse free educational YouTube courses by exam, class, subject and chapter.",
    });
    expect(schema).not.toHaveProperty("logo");
  });
});

describe("safeStructuredDataJson", () => {
  it("matches the documented safe-serialize pattern exactly", () => {
    const schema = { "@type": "Thing", name: "A < B" };
    expect(safeStructuredDataJson(schema)).toBe(
      JSON.stringify(schema, null, 0).replace(/</g, "\\u003c"),
    );
  });

  it("escapes a literal </script> breakout payload in a title", () => {
    const hostile = videoObjectSchema({
      title: '</script><script>alert(1)</script>',
      youtubeVideoId: "CBvaO-uDvs8",
    });
    const json = safeStructuredDataJson(hostile);
    expect(json).not.toContain("</script");
    // Only "<" needs escaping — the tokenizer's script-close match keys off
    // "<", so ">" staying literal is fine and still breaks the sequence.
    expect(json).toContain("\\u003c/script>\\u003cscript>alert(1)\\u003c/script>");
  });

  it("round-trips losslessly — escaping never changes the decoded value", () => {
    const hostile = { name: '</script><script>alert(1)</script>' };
    const json = safeStructuredDataJson(hostile);
    expect(JSON.parse(json)).toEqual(hostile);
  });

  it("would actually break out of a script tag without the escape (regression guard)", () => {
    const hostile = { name: '</script><script>alert(1)</script>' };
    const unsafe = JSON.stringify(hostile);
    expect(unsafe).toContain("</script>");
    expect(safeStructuredDataJson(hostile)).not.toContain("</script>");
  });
});
