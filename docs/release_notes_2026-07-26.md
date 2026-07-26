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

## Complex Numbers Mathematics checkpoint

Complex Numbers was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMaeLzehBWWVD_EZL7EuaVP-X`.
- 20 new Class 11/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused videos.
- Staging course/chapter: `1228` / `137`.
- Production course/chapter: `75` / `65`.

The source contained 20 unique, public, embeddable videos with complete
durations, no production video overlap, exact source/title order from `#1`
through `#20`, and no material outside the Complex Numbers chapter. Every
live video description contains `#MohitTyagi`, with no competing faculty
attribution.

The importer emitted its known title-only teacher advisory because it does not
fetch video descriptions. The separate read-only source audit supplied 20/20
direct hashtag evidence before either write. The source title was normalized
from `Complex Number - IIT JEE Mains and Advanced Lecture Series` to
`Complex Numbers` with exact playlist/title guards.

Production now contains 68 courses and exactly 761 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 9 Mathematics courses, with 35
Class 11, 34 Class 12, and 63 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1 and 20 in staging and production, plus the
production Browse search result. The expected YouTube embeds and ordered
lesson list rendered, and no console errors appeared.

Validation after the batch:

- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Probability Mathematics checkpoint

Probability was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMaf-WePkSulK_zt0yfQUrZgE`.
- 16 new Class 11/Class 12/Dropper lessons, teacher `Mohit Tyagi`, with 0
  reused videos.
- Staging course/chapter: `1229` / `138`.
- Production course/chapter: `76` / `66`.

The source contained 16 unique, public, embeddable videos with complete
durations, no production video overlap, exact source/title order from `#1`
through `#16`, and no material outside Probability. Every live video
description contains `#MohitTyagi`, and the automated importer quality gate
reported `OK`.

An independent taxonomy arbitration confirmed the three class tags. Lessons
1 through 12 cover Class 11 foundations, while lessons 13 through 16 cover
Class 12 total probability, Bayes' theorem, probability distributions, mean,
and variance. In this catalog, class tags record curriculum coverage while
`audience_focus` records the dominant audience, so the course uses
`11th,12th,Dropper` with audience focus `12th`.

The source title was normalized from
`Probability -IIT JEE MAINS AND ADVANCED` to `Probability` with exact
playlist/title guards.

Production now contains 69 courses and exactly 777 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 10 Mathematics courses, with 36
Class 11, 35 Class 12, and 64 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1 and 16 in staging and production, plus the
production Browse search result. The expected YouTube embeds and ordered
lesson list rendered, and no console errors appeared.

Validation after the batch:

- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Permutations and Combinations Mathematics checkpoint

Permutations and Combinations was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMae1vVGOC3Ptr4qXYZOqXvJa`.
- 19 new Class 11/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused
  videos.
- Staging course/chapter: `1230` / `139`.
- Production course/chapter: `77` / `67`.

Three independent read-only reviews found 19 unique, public, embeddable videos
with complete durations, no production video overlap, exact source/title
order from `#1` through `#19`, and no material outside the Permutations and
Combinations chapter. All 19 live video descriptions contain
`#Mathematics #MohitTyagi`, with no competing faculty attribution.

The importer emitted its known title-only teacher advisory because it does not
fetch video descriptions. The separate source audits supplied 19/19 direct
hashtag evidence before either write. The canonical Class 11 mapping uses
`11th,Dropper` with audience focus `11th`; isolated Class 12 promotional tags
in two source titles do not represent Class 12 curriculum coverage.

The source title was normalized from
`Permutation And Combination - IIT-JEE maths video lecture` to
`Permutations and Combinations` with exact playlist/title guards.

Production now contains 70 courses and exactly 796 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 11 Mathematics courses, with 37
Class 11, 35 Class 12, and 65 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1 and 19 in staging and production, plus the
production Browse search result. The expected YouTube embeds and ordered
lesson list rendered, and no console errors appeared.

Validation after the batch:

- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Straight Lines Mathematics checkpoint

Straight Lines was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMaf3M7rSq9M4NmLACdYuCQ_7`.
- 20 new Class 11/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused
  videos.
- Staging course/chapter: `1231` / `140`.
- Production course/chapter: `78` / `68`.

Three independent read-only reviews found 20 unique, public, embeddable videos
with complete durations, no production video overlap, exact source/title
order from `#1` through `#20`, and one uninterrupted teacher/source series.
All 20 live video descriptions directly attribute Mohit Tyagi, with no
competing faculty evidence.

Lessons 17 through 20 introduce Pair of Straight Lines as an intentional
advanced tail of the same coordinate-geometry progression. The numbering does
not reset, the teacher and source do not change, and the current JEE taxonomy
does not require a separate Pair of Straight Lines node. The course therefore
uses the canonical Class 11 mapping `11th,Dropper` with audience focus `11th`.

The importer emitted its known title-only teacher advisory because it does not
fetch video descriptions. The source title was normalized from
`Straight Lines -IIT JEE Maths video Lectures` to `Straight Lines` with exact
playlist/title guards.

Production now contains 71 courses and exactly 816 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 12 Mathematics courses, with 38
Class 11, 35 Class 12, and 66 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1 and 20 in staging and production, plus the
production Browse search result. The expected YouTube embeds and ordered
lesson list rendered, and no console errors appeared.

Validation after the batch:

- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Determinants Mathematics checkpoint

Determinants was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMaex9aIhynPtk3ZO-xO_G2kJ`.
- 25 new Class 12/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused
  videos.
- Staging course/chapter: `1232` / `141`.
- Production course/chapter: `79` / `69`.

Independent source and taxonomy reviews found 25 unique, public, embeddable
videos with complete durations, no production video overlap, exact
source/title order from `#1` through `#25`, and one uninterrupted
teacher/source series. Every live video description contains
`#Mathematics #MohitTyagi`, with no competing faculty evidence.

Lessons 17 through 19 apply differentiation and integration to determinant
expressions; they are not standalone calculus lessons. They remain explicitly
determinant-titled inside the same sequence and are retained as advanced
same-chapter applications. The canonical mapping is therefore
`12th,Dropper` with audience focus `12th`.

The importer emitted its known title-only teacher advisory because it does not
fetch video descriptions. The source title was normalized from
`Determinants-IIT JEE mains and advanced maths videos` to `Determinants` with
exact playlist/title guards.

Production now contains 72 courses and exactly 841 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 13 Mathematics courses, with 38
Class 11, 36 Class 12, and 67 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1 and 25 in staging and production, plus the
production Browse search result. The expected YouTube embeds and ordered
lesson list rendered, and no console errors appeared.

Validation after the batch:

- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Continuity Mathematics checkpoint

Continuity was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMads1bsxLYBoJOLA3bWsY7mK`.
- 46 new Class 12/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused
  videos.
- Staging course/chapter: `1233` / `142`.
- Production course/chapter: `80` / `70`.

Independent source and taxonomy reviews found 46 unique, public, embeddable
videos with complete durations, no production video overlap, exact
source/title order from `#1` through `#46`, and approximately 8 hours 10
minutes of one uninterrupted teacher/source series. Every live video
description directly attributes Mohit Tyagi, with no competing faculty
evidence.

Every lesson remains Continuity-specific: continuity at a point, algebra and
checking, continuity theorems and the intermediate value theorem,
discontinuity types, composite-function continuity, and determination of
constants. The channel maintains separate Differentiability material, so the
canonical standalone mapping is `Continuity`, `12th,Dropper`, with audience
focus `12th`.

The automated importer quality gate reported `OK`. The source title was
normalized from `IIT JEE MATHEMATICS-CONTINUITY` to `Continuity` with exact
playlist/title guards.

Production now contains 73 courses and exactly 887 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 14 Mathematics courses, with 38
Class 11, 37 Class 12, and 68 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1, 35, and 46 in staging and production, plus
the production Browse search result. The interior check explicitly covered
the discontinuity section. The expected YouTube embeds and ordered lesson
list rendered, and no console errors appeared.

Validation after the batch:

- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Area Under Curves Mathematics checkpoint

Area Under Curves was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMaf8TqINqRXRlWeuFgl6fBgf`.
- 2 new Class 12/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused videos.
- Staging course/chapter: `1234` / `143`.
- Production course/chapter: `81` / `71`.

Independent source and taxonomy reviews found 2 unique, public, embeddable
videos with complete durations, no production video overlap, and 94 minutes
9 seconds of one bounded two-part series. Both live video descriptions contain
`#Mathematics #MohitTyagi`, with no competing faculty evidence.

The official Class 12 chapter name is `Application of Integrals`, while the
source proves the narrower course scope `Area Under Curves`. The canonical
chapter therefore supports strict curriculum filtering without overstating
the course title. The mapping is `12th,Dropper` with audience focus `12th`.

The source titles begin with a digit followed by a space, which the automated
lesson-number parser does not recognize. Independent validation confirmed
that playlist positions 1 and 2 match the visible title prefixes `1` and `2`;
both orders were preserved. The importer emitted its known title-only teacher
advisory because it does not fetch video descriptions.

The source title was normalized from
`Area Under The Curves - IIT JEE MAINS AND ADVANCED ONLINE FREE VIDEO LECTURES`
to `Area Under Curves` with exact playlist/title guards.

Production now contains 74 courses and exactly 889 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 15 Mathematics courses, with 38
Class 11, 38 Class 12, and 69 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered both lessons in staging and production, plus the
production Browse search result. The expected YouTube embeds and canonical
chapter scope rendered, and no console errors appeared.

Validation after the batch:

- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.
