import { describe, expect, it } from "vitest";
import { RETIRED_FACULTY_SLUGS, retiredFacultyTarget } from "./retiredFacultySlugs.js";

// The same shape the slug trigger produces: lowercase words joined by hyphens.
const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("retired faculty slugs", () => {
  const entries = Object.entries(RETIRED_FACULTY_SLUGS);

  it("lists exactly the 40 duplicate profiles removed on 2026-09-15", () => {
    expect(entries).toHaveLength(40);
    expect(entries.filter(([from]) => from.endsWith("-2"))).toHaveLength(31);
  });

  it("uses real slug shapes on both sides", () => {
    for (const [from, to] of entries) {
      expect(from).toMatch(SLUG_SHAPE);
      expect(to).toMatch(SLUG_SHAPE);
    }
  });

  it("never points a slug at itself or at another retired slug", () => {
    for (const [from, to] of entries) {
      expect(to).not.toBe(from);
      expect(Object.hasOwn(RETIRED_FACULTY_SLUGS, to)).toBe(false);
    }
  });

  it("sends each numbered copy to the slug it was numbered after", () => {
    for (const [from, to] of entries.filter(([slug]) => slug.endsWith("-2"))) {
      expect(to).toBe(from.slice(0, -"-2".length));
    }
  });

  it("cannot be changed at runtime", () => {
    expect(Object.isFrozen(RETIRED_FACULTY_SLUGS)).toBe(true);
  });

  // The map records what the site published and then removed. It is history,
  // not a rule, so it is pinned whole: a mistyped key would send a published
  // address back to 404, and a swapped target would permanently credit the
  // wrong teacher. Every pair was checked against production on 2026-09-15:
  // no teacher holds the source, and the target is a verified teacher carrying
  // the source's spelling (the -2 copies by name, the rest as a verified alias
  // such as "ALK Sir").
  it("pins every removed address to the teacher it duplicated", () => {
    expect(RETIRED_FACULTY_SLUGS).toEqual({
      abj: "amit-bijarnia",
      alk: "alok-kumar",
      ns: "neeraj-saini",
      skc: "shubh-karan-choudhary",
      saleem: "saleem-ahmad",
      samapti: "samapti-sinha",
      siddharth: "siddharth-sharma",
      sudhanshu: "sudhanshu-kumar",
      aayudh: "aayudh-yashlaha",
      "yashika-singh-2": "yashika-singh",
      "diksha-sharma-2": "diksha-sharma",
      "vipin-sharma-2": "vipin-sharma",
      "mohit-dadheech-2": "mohit-dadheech",
      "swagata-mukherjee-2": "swagata-mukherjee",
      "tulika-jha-2": "tulika-jha",
      "abhishek-verma-2": "abhishek-verma",
      "harshit-thakuria-2": "harshit-thakuria",
      "janardhan-2": "janardhan",
      "nikhil-saini-2": "nikhil-saini",
      "om-sharma-2": "om-sharma",
      "pratham-nahata-2": "pratham-nahata",
      "alakh-pandey-2": "alakh-pandey",
      "shobhit-nirwan-2": "shobhit-nirwan",
      "anmol-sharma-2": "anmol-sharma",
      "rakshita-singh-2": "rakshita-singh",
      "ritu-rattewal-2": "ritu-rattewal",
      "rohit-mishra-2": "rohit-mishra",
      "sachin-rana-2": "sachin-rana",
      "vikas-gupta-2": "vikas-gupta",
      "vishal-singh-2": "vishal-singh",
      "akash-goyal-2": "akash-goyal",
      "anand-mani-2": "anand-mani",
      "anjulika-gupta-2": "anjulika-gupta",
      "ankit-gaur-2": "ankit-gaur",
      "ankit-singhvi-2": "ankit-singhvi",
      "chaitanya-rastogi-2": "chaitanya-rastogi",
      "manoj-chauhan-2": "manoj-chauhan",
      "mohit-goenka-2": "mohit-goenka",
      "neela-bakore-2": "neela-bakore",
      "neha-agrawal-2": "neha-agrawal",
    });
  });

  it("answers only its own entries", () => {
    expect(retiredFacultyTarget("abj")).toBe("amit-bijarnia");
    expect(retiredFacultyTarget("alakh-pandey-2")).toBe("alakh-pandey");
    expect(retiredFacultyTarget("amit-bijarnia")).toBeNull();
    expect(retiredFacultyTarget("constructor")).toBeNull();
    expect(retiredFacultyTarget("toString")).toBeNull();
    // Not a numbering rule: an unlisted numbered slug is nobody's old address.
    expect(retiredFacultyTarget("mohit-tyagi-2")).toBeNull();
    expect(retiredFacultyTarget("vikas-gupta-3")).toBeNull();
  });
});
