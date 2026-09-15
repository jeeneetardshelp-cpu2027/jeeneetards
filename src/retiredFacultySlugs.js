// retiredFacultySlugs.js — faculty profile addresses that were published for a
// week and then removed, and the real profile each one duplicated.
//
// On 2026-09-08 a faculty-review batch approved 40 names "as new" that were
// already verified teachers credited on the same courses
// (approve_proposal_as_new passes p_duplicate_acknowledged := true, so
// create_teacher's duplicate check never ran). That made 40 unverified copies —
// alakh-pandey-2 beside alakh-pandey, abj beside amit-bijarnia — each with its
// own indexable /faculty page, and the sitemap listed all 40. The copies
// (teacher ids 98-137) were deleted on 2026-09-15, after which these addresses
// answered 404.
//
// A 308 to the real profile is the honest answer for an address we published:
// a crawler or a shared link that found the copy reaches the person it named.
//
// The middleware consults this map ONLY after get_faculty_profile has confirmed
// that no teacher holds the slug. A slug is not reserved forever: the slug
// trigger would give a genuine second "Vikas Gupta" vikas-gupta-2, and a real
// single-name "Siddharth" would get siddharth. When that happens the live
// profile is served and its entry here is simply never reached. A lookup that
// fails or times out never redirects either — no permanent redirect is built on
// an answer we could not read.
//
// Targets are verified slugs and never keys, so there are no chains;
// retiredFacultySlugs.test.js pins that.

export const RETIRED_FACULTY_SLUGS = Object.freeze({
  // Initials and first names of a teacher already on the registry.
  abj: "amit-bijarnia",
  alk: "alok-kumar",
  ns: "neeraj-saini",
  skc: "shubh-karan-choudhary",
  saleem: "saleem-ahmad",
  samapti: "samapti-sinha",
  siddharth: "siddharth-sharma",
  sudhanshu: "sudhanshu-kumar",
  aayudh: "aayudh-yashlaha",
  // The same name again, numbered by the slug trigger.
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

/**
 * The slug a removed duplicate profile should send its visitors to, or null.
 * Own entries only: /faculty/constructor must not find Object.prototype. The
 * long-standing hasOwnProperty.call spelling, not Object.hasOwn, so this edge
 * path does not depend on how new the Edge Runtime's JavaScript is.
 */
export function retiredFacultyTarget(slug) {
  return Object.prototype.hasOwnProperty.call(RETIRED_FACULTY_SLUGS, slug) ? RETIRED_FACULTY_SLUGS[slug] : null;
}
