# Release notes — 26 July 2026

## Hyperbola Mathematics checkpoint

Hyperbola was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMaeaLAU22ViTSvk3T7AWxnT_`.
- 7 new Class 11/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused videos.
- Staging course/chapter: `1224` / `133`.
- Production course/chapter: `71` / `61`.

The source contained 7 unique, public, embeddable videos with complete
durations, direct `Mohit Tyagi` evidence on every video, no production video
overlap, and exact source/title order from `#1` through `#7`. The source title
was normalized from `Hyperbola IIT JEE Mains and Advanced` to `Hyperbola`
with exact playlist/title guards.

The importer emitted its known title-only teacher advisory because it does not
fetch video descriptions. The separate read-only source audit supplied 7/7
teacher evidence before either write.

Production now contains 64 courses and exactly 700 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 5 Mathematics courses, with 31
Class 11, 34 Class 12, and 59 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1 and 7 in staging and production. The expected
YouTube embeds and ordered lesson list rendered, and no console errors
appeared.

Validation after the batch:

- 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Statistics Mathematics checkpoint

Statistics was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMadco0ISV4gL7BEkzs7ki6lm`.
- 12 new Class 11/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused videos.
- Staging course/chapter: `1225` / `134`.
- Production course/chapter: `72` / `62`.

The source contained 12 unique, public, embeddable videos with complete
durations, direct `Mohit Tyagi` evidence on every video, and no production
video overlap. Core Statistics lessons `#1` through `#11` are contiguous. The
final source position is an unnumbered, explicitly Statistics-only JEE
Advanced supplement by the same teacher, so it was preserved as lesson 12
after independent and second-review scope checks. The automated importer
quality gate reported `OK` with no findings.

The source title was normalized from
`Statistics -IIT JEE Mains and CBSE,NCERT` to `Statistics` with exact
playlist/title guards.

Production now contains 65 courses and exactly 712 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 6 Mathematics courses, with 32
Class 11, 34 Class 12, and 60 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1 and 12 in staging and production. The
expected YouTube embeds and ordered lesson list rendered, and no console
errors appeared.

Matrices playlist `PL_A4M5IAkMafsNaawDfrQl6EhgdEiWVD6` was deferred before
any write. Its core `#1` through `#11` sequence is clean, but an appended
unnumbered Cayley-Hamilton lesson is credited to Rajat Jain Sir; importing it
as one Mohit Tyagi course would lose the mixed-teacher attribution.

Validation after the batch:

- 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Parabola Mathematics checkpoint

Parabola was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMaeT3qAAgcvUXiKnM044FO44`.
- 11 new Class 11/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused videos.
- Staging course/chapter: `1226` / `135`.
- Production course/chapter: `73` / `63`.

The source contained 11 unique, public, embeddable videos with complete
durations, direct `Mohit Tyagi` evidence on every video, no production video
overlap, and exact source/title order from `#1` through `#11`. The source title
was normalized from `Parabola - IIT JEE online video lectures` to `Parabola`
with exact playlist/title guards.

The importer emitted its known title-only teacher advisory because it does not
fetch video descriptions. The separate read-only source audit supplied 11/11
teacher evidence before either write.

Production now contains 66 courses and exactly 723 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 7 Mathematics courses, with 33
Class 11, 34 Class 12, and 61 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1 and 11 in staging and production. The
expected YouTube embeds and ordered lesson list rendered, and no console
errors appeared.

Validation after the batch:

- 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Circles Mathematics checkpoint

Circles was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMadiR6WFaUTQegpdKUJRD90D`.
- 18 new Class 11/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused videos.
- Staging course/chapter: `1227` / `136`.
- Production course/chapter: `74` / `64`.

The source contained 18 unique, public, embeddable videos with complete
durations, no production video overlap, exact source/title order from `#1`
through `#18`, and no material outside the Circles chapter. Every live video
description contains `#Mathematics #MohitTyagi`.

The importer emitted its known title-only teacher advisory because it does not
fetch video descriptions. The separate read-only source audit supplied 18/18
direct hashtag evidence before either write. The source title was normalized
from `CIRCLES - IIT JEE Mains and Advanced online lectures` to `Circles` with
exact playlist/title guards.

Production now contains 67 courses and exactly 741 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 8 Mathematics courses, with 34
Class 11, 34 Class 12, and 62 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1 and 18 in staging and production, plus the
production Browse search result. The expected YouTube embeds and ordered
lesson list rendered, and no console errors appeared.

Validation after the batch:

- A focused rerun passed all 6 tests in `phase1Truth.test.jsx` after an initial
  parallel-run loading timeout.
- The clean serial suite passed all 683 Vitest tests across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.
