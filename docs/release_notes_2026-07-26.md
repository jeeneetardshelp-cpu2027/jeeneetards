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

## Vectors and Three-Dimensional Geometry Mathematics checkpoint

Vector Algebra and Three-Dimensional Geometry was promoted through the
staging-first gate:

- Source playlist `PL_A4M5IAkMafmea0RnicbuLD6Ly2EIr0X`.
- 12 new Class 12/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused
  videos.
- Staging course/chapter: `1235` / `144`.
- Production course/chapter: `82` / `72`.

Independent source and taxonomy reviews found 12 unique, public, embeddable
videos with complete durations, no production video overlap, exact
source/title order from `#1` through `#12`, and direct
`#Mathematics #MohitTyagi` evidence in every live description.

Lessons 1 through 8 teach Vector Algebra and lessons 9 through 12 apply vectors
to Three-Dimensional Geometry. The source is one uninterrupted sequence, and
the official Class 12 curriculum groups them as the combined Vectors and
Three-Dimensional Geometry unit. The mapping is therefore `12th,Dropper` with
audience focus `12th`.

The importer emitted its known title-only teacher advisory because it does not
fetch video descriptions. The source title was normalized from
`VECTOR AND THREE DIMENSIONAL GEOMETRY - IIT JEE FREE ONLINE VIDEO LECTURES`
to `Vector Algebra and Three-Dimensional Geometry` with exact playlist/title
guards.

Production now contains 75 courses and exactly 901 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 16 Mathematics courses, with 38
Class 11, 39 Class 12, and 70 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1, 9, and 12 in staging and production, plus
the production Browse search result. Lesson 9 explicitly exercised the
transition from Vector Algebra into Three-Dimensional Geometry. The expected
YouTube embeds and ordered lesson list rendered, and no console errors
appeared.

Validation after the batch:

- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

Differentiability was reviewed but not imported. Lesson 16 lacks direct
teacher evidence, leaving 44 of 45 descriptions attributed on a multi-faculty
channel.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Definite Integration Mathematics checkpoint

Definite Integration was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMafGD8xJhm9IioyF_norREYN`.
- 86 new Class 12/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused
  videos.
- Staging course/chapter: `1236` / `145`.
- Production course/chapter: `83` / `73`.

Independent source and taxonomy reviews found 86 unique, public, embeddable
videos with complete durations, no production video overlap, and an exact
`Part 1` through `Part 86` sequence. The uninterrupted source runs for 52,474
seconds (14 hours, 34 minutes, 34 seconds). Every live description contains
direct `#Mathematics #MohitTyagi` evidence, with no appended PYQ or supplement,
teacher change, or competing faculty evidence.

The standalone canonical chapter and course title are `Definite Integration`;
the related Area Under Curves course remains under Application of Integrals.
The mapping is `12th,Dropper`, with audience focus `12th`, content type
`full-course`, language `hinglish`, and difficulty `advanced`. The 86-video
playlist was imported alone as one atomic transaction and remained well below
the importer's 500-video hard cap.

The importer emitted its known title-only teacher advisory because it does not
fetch video descriptions. The source title was already exactly
`Definite Integration`; an exact equality check passed, so no normalization
update was needed.

Production now contains 76 courses and exactly 987 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 17 Mathematics courses, with 38
Class 11, 40 Class 12, and 71 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1, 43, and 86 in staging and production, plus
the production Browse search result. The expected privacy-enhanced YouTube
embeds, course title, ordered lesson positions, and search result rendered,
and no console errors appeared.

Validation after the batch:

- Exact database validation confirmed 86 contiguous positions, 86 unique
  video IDs, complete durations totaling 52,474 seconds, correct taxonomy and
  metadata, and embeddable status for every lesson.
- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

Differentiability remains deferred: lesson 16 lacks direct teacher evidence,
leaving 44 of 45 descriptions attributed on a multi-faculty channel.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Logarithms Mathematics checkpoint

Logarithms was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMadF2rExT0C-TvtH2vn3dLGR`.
- 5 new Class 11/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused videos.
- Staging course/chapter: `1237` / `146`.
- Production course/chapter: `84` / `74`.

Independent source and taxonomy reviews found 5 unique, public, embeddable
videos with complete durations, no production video overlap, and direct
`#Mathematics #MohitTyagi` evidence in every live description. The 13,761
seconds (3 hours, 49 minutes, 21 seconds) cover introduction and formulae,
examples, logarithmic inequalities, characteristic and mantissa, and number
of digits without appended PYQ material, a teacher change, or scope drift.

The visible source title prefixes run from `1` through `5` in exact playlist
order. Because each digit is followed by a space, the automated lesson-number
parser cannot assess the sequence; independent and staging reviews verified
all five positions manually before production. The mapping is the standalone
canonical chapter `Logarithms`, `11th,Dropper`, with audience focus `11th`,
content type `full-course`, language `hinglish`, and difficulty `advanced`.

The importer emitted its known title-only teacher advisory because it does not
fetch video descriptions. The source title `Logarithm` was normalized to
`Logarithms` with exact playlist, title, subject, and collision guards in
staging first and then production.

Production now contains 77 courses and exactly 992 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 18 Mathematics courses, with 39
Class 11, 40 Class 12, and 72 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1, 3, and 5 in staging and production, plus the
production Browse search result. The expected privacy-enhanced YouTube embeds,
canonical title, ordered lesson positions, and search result rendered, and no
console errors appeared.

Validation after the batch:

- Exact database validation confirmed 5 contiguous positions, 5 unique video
  IDs, complete durations totaling 13,761 seconds, correct taxonomy and
  metadata, and embeddable status for every lesson.
- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Differentiation Mathematics checkpoint

Differentiation was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMaeewzwCJPpL65y1HV0VAiC4`.
- 62 new Class 12/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused
  videos.
- Staging course/chapter: `1238` / `147`.
- Production course/chapter: `85` / `75`.

Independent source and taxonomy reviews found 62 unique, public, embeddable
videos with complete durations, no production video overlap, and an exact
contiguous `Part 1` through `Part 62` sequence. All 62 descriptions directly
attribute Mohit Tyagi. The uninterrupted source runs for 35,753 seconds
(9 hours, 55 minutes, 53 seconds). Parts 56 through 62 narrow to determination
of function but remain explicitly numbered Differentiation lessons, so there
is no appended PYQ material, teacher change, or scope drift.

The standalone canonical chapter and course title are `Differentiation`,
distinct from Continuity and the separately deferred Differentiability source.
The mapping is `12th,Dropper`, with audience focus `12th`, content type
`full-course`, language `hinglish`, and difficulty `advanced`.

The importer emitted its known title-only teacher advisory because it does not
fetch video descriptions. The source title
`Differentiation-JEE Mains and JEE Advanced` was normalized to
`Differentiation` with exact playlist, title, subject, and collision guards in
staging first and then production.

Production now contains 78 courses and exactly 1,054 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 19 Mathematics courses, with 39
Class 11, 41 Class 12, and 73 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1, 32, and 62 in staging and production, plus
the production Browse search result. The expected privacy-enhanced YouTube
embeds, canonical title, ordered lesson positions, and search result rendered,
and no console errors appeared.

Validation after the batch:

- Exact source-to-database validation confirmed 62 contiguous positions, 62
  unique video IDs, matching titles and durations totaling 35,753 seconds,
  correct taxonomy and metadata, and embeddable status for every lesson.
- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Quadratic Equations Mathematics checkpoint

Quadratic Equations and Expressions was promoted through the staging-first
gate:

- Source playlist `PL_A4M5IAkMaf5Ga3nQJe-gg-0zXG77YRB`.
- 66 new Class 11/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused
  videos.
- Staging course/chapter: `1239` / `148`.
- Production course/chapter: `86` / `76`.

Independent source and taxonomy reviews found 66 unique, public, embeddable
videos with complete durations, no production video overlap, and direct Mohit
Tyagi evidence in every live description. The uninterrupted source runs for
43,913 seconds (12 hours, 11 minutes, 53 seconds).

Source positions 0 through 65 exactly match visible leading title numbers `1`
through `66`, without gaps, duplicates, or inversions. Because every number is
followed by a space, the automated lesson-number parser cannot assess the
sequence; independent and staging reviews verified all 66 positions manually.
Lessons 61 through 66 are contiguous
`Quadratic Equation | Theory of Equations` lessons by the same teacher, with
no appended PYQ material or supplement, so they remain an intentional
same-chapter extension.

The canonical chapter is `Quadratic Equations`, while the precise course title
is `Quadratic Equations and Expressions`. The mapping is `11th,Dropper`, with
audience focus `11th`, content type `full-course`, language `hinglish`, and
difficulty `advanced`. The source title
`IIT-JEE-Mathematics-Quadratic Equation And Expressions` was normalized with
exact playlist, title, subject, and collision guards in staging first and then
production.

Production now contains 79 courses and exactly 1,120 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 20 Mathematics courses, with 40
Class 11, 41 Class 12, and 74 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1, 33, 61, and 66 in staging and production,
plus the production Browse search result. Lesson 61 explicitly exercised the
Theory of Equations transition. The expected privacy-enhanced YouTube embeds,
canonical title, ordered lesson positions, and search result rendered, and no
console errors appeared.

Validation after the batch:

- Exact source-to-database validation confirmed 66 contiguous positions, 66
  unique video IDs, matching titles and durations totaling 43,913 seconds,
  correct taxonomy and metadata, and embeddable status for every lesson.
- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Sequences and Series Mathematics checkpoint

Progressions and Series was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMaeu--QWWngkEI10RKOXf8TF`.
- 88 new Class 11/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused
  videos.
- Staging course/chapter: `1240` / `149`.
- Production course/chapter: `87` / `77`.

Independent source and taxonomy reviews found 88 unique, public, embeddable
videos with complete durations, no production video overlap, and an exact
parser-confirmed contiguous `Part 1` through `Part 88` sequence. All 88 live
descriptions directly contain `#MohitTyagi`. The uninterrupted source runs for
54,171 seconds (15 hours, 2 minutes, 51 seconds).

Every title remains `Progression and Series Part N`. The source description
defines one complete basic-to-advanced Sequences and Series course covering
arithmetic, geometric, and harmonic progressions, sigma properties and
applications, difference and `Vn` methods, and progression-derived
inequalities. The advanced material remains a coherent same-chapter extension,
with no appended PYQ course, supplement, or teacher change.

The canonical chapter is `Sequences and Series`, while the precise course
title is `Progressions and Series`. The mapping is `11th,Dropper`, with
audience focus `11th`, content type `full-course`, language `hinglish`, and
difficulty `advanced`. The source title `Progression and Series` was
normalized with exact playlist, title, subject, and collision guards in
staging first and then production. The importer emitted its known title-only
teacher advisory because it does not fetch video descriptions.

Production now contains 80 courses and exactly 1,208 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 21 Mathematics courses, with 41
Class 11, 41 Class 12, and 75 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1, 44, and 88 in staging and production, plus
the production Browse search result. The expected privacy-enhanced YouTube
embeds, canonical title, ordered lesson positions, and search result rendered,
and no console errors appeared.

Validation after the batch:

- Exact source-to-database validation confirmed 88 contiguous positions, 88
  unique video IDs, matching titles and durations totaling 54,171 seconds,
  correct taxonomy and metadata, and embeddable status for every lesson.
- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Binomial Theorem Mathematics checkpoint

Binomial Theorem was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMacSgRRlEkUB9v-gE1yxw_rG`.
- 92 new Class 11/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused
  videos.
- Staging course/chapter: `1241` / `150`.
- Production course/chapter: `88` / `78`.

Independent source and taxonomy reviews found 92 unique, public, embeddable
videos with complete durations, no production video overlap, and an exact
parser-confirmed contiguous `Part 1` through `Part 92` sequence. All 92 live
descriptions directly contain `#MohitTyagi`. The uninterrupted source runs for
53,965 seconds (14 hours, 59 minutes, 25 seconds).

Every lesson title remains Binomial Theorem, and the source description
presents the playlist as complete JEE Main/Advanced topic coverage. Advanced
coefficient identities remain coherent same-chapter enrichment; there is no
appended PYQ course, supplement, teacher change, or scope break. Authoritative
playlist positions and title parts agree exactly even though the historical
upload dates are not monotonic.

The canonical chapter and course title are both `Binomial Theorem`. The
mapping is `11th,Dropper`, with audience focus `11th`, content type
`full-course`, language `hinglish`, and difficulty `advanced`. The source
title already exactly matched `Binomial Theorem`; an exact equality check
passed, so no normalization update was needed. The importer emitted its known
title-only teacher advisory because it does not fetch video descriptions.

Production now contains 81 courses and exactly 1,300 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 22 Mathematics courses, with 42
Class 11, 41 Class 12, and 76 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1, 46, and 92 in staging and production, plus
the production Browse search result. The expected privacy-enhanced YouTube
embeds, canonical title, ordered lesson positions, and search result rendered,
and no console errors appeared.

Validation after the batch:

- Exact source-to-database validation confirmed 92 contiguous positions, 92
  unique video IDs, matching titles and durations totaling 53,965 seconds,
  correct taxonomy and metadata, and embeddable status for every lesson.
- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Heights and Distances JEE Main 2019 PYQ checkpoint

Heights and Distances was promoted through the staging-first gate as a small,
strictly bounded PYQ course:

- Source playlist `PL_A4M5IAkMaedGbnmLZVKTkd6RS0X3XZB`.
- 3 new Class 11/Dropper lessons, teacher `Mohit Tyagi`, with 0 reused videos.
- Staging course/chapter: `1242` / `151`.
- Production course/chapter: `89` / `79`.

Independent source review found 3 unique, public, embeddable videos with
complete durations, no production video overlap, and an exact `#1` through
`#3` playlist sequence. Every title directly identifies Mohit Tyagi. The
source runs for 3,246 seconds (54 minutes, 6 seconds) and is explicitly a JEE
Main 2019 Heights and Distances question set.

The canonical chapter is `Trigonometry`, matching the current JEE Main
Mathematics unit, while the precise course title is
`Heights and Distances: JEE Main 2019 PYQs`. The mapping is
`11th,Dropper`, with audience focus `11th`, content type `pyq`, language
`hinglish`, and difficulty `advanced`. The source title was normalized with
exact playlist, title, subject, and collision guards in staging first and then
production.

Production now contains 82 courses and exactly 1,303 ordered playlist
memberships: 32 Physics, 27 Chemistry, and 23 Mathematics courses, with 43
Class 11, 41 Class 12, and 77 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1, 2, and 3 in staging and production, plus the
production global search result. The expected privacy-enhanced YouTube embeds,
canonical title, ordered lesson positions, and search result rendered, and no
console errors appeared.

Validation after the batch:

- Exact source-to-database validation confirmed 3 contiguous positions, 3
  unique video IDs, matching titles and durations totaling 3,246 seconds,
  correct taxonomy and metadata, and embeddable status for every lesson.
- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this batch.

## Conductors Physics checkpoint

Conductors was promoted through the staging-first gate:

- Source playlist `PL_A4M5IAkMafRbbj8o0zvHGHrJV8FsxgZ`.
- 4 new Class 12/Dropper lessons, teacher `ABJ Sir`, with 0 reused videos.
- Staging course/chapter: `1243` / `79`.
- Production course/chapter: `90` / `8`.

Independent source review found 4 unique, public, embeddable videos with
complete durations, no production video overlap, and direct `ABJ Sir`
attribution in every description. The source runs for 22,288 seconds
(6 hours, 11 minutes, 28 seconds).

The visible source order was `2, 1, 3, 4`. Exact video-ID, title, membership,
position, taxonomy, and collision guards were checked before an atomic
four-row membership upsert normalized the order to `1, 2, 3, 4` in staging
first and then production. The source title was also normalized to the
canonical `Conductors` title through exact guards.

The mapping is JEE Physics, chapter `Electrostatics`, classes
`12th,Dropper`, audience focus `12th`, content type `full-course`, language
`hinglish`, and difficulty `advanced`.

Production now contains 83 courses and exactly 1,307 ordered playlist
memberships: 33 Physics, 27 Chemistry, and 23 Mathematics courses, with 43
Class 11, 42 Class 12, and 78 Dropper-compatible courses. Core metadata,
titles, and teacher attribution remain complete, and fully contained
duplicate-course candidates remain 0. The anonymous production capability
contract passed.

Browser checks covered lessons 1, 3, and 4 in staging and production, plus the
production global search result. Each lesson loaded its expected
privacy-enhanced YouTube embed, the ordered lesson list and canonical title
rendered, search opened production course `90`, and no console errors
appeared.

Validation after the checkpoint:

- Exact source-to-database validation confirmed 4 contiguous positions, 4
  unique video IDs, matching titles and durations totaling 22,288 seconds,
  correct taxonomy and metadata, embeddable status for every lesson, and 0
  external memberships.
- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the forced breaking fix remains
  deferred.

No migrations, schema changes, application-code changes, or manual CI reruns
were made for this checkpoint.

## General Organic Chemistry Part 2 staging checkpoint

General Organic Chemistry: Part 2 cleared the content and staging gates:

- Source playlist `PL_A4M5IAkMafc2p-SO0X7dPJGHp7kqO22`.
- 22 new Class 11/Dropper staging lessons, teacher `NS Sir`, with 0 reused
  videos.
- Staging course/chapter: `1244` / `152`.
- Production course/chapter: not created.

The source has 22 published, usable, unique, public, processed, embeddable,
and duration-complete videos. Every title directly identifies NS Sir, there is
no competing teacher evidence, and the automated importer quality gate
reported `ok` with 0 findings. The source runs for 40,501 seconds
(11 hours, 15 minutes, 1 second) and has no production video overlap.

The visible source order was `1–17, 19–22, 18`; every integer from 1 through
22 appears exactly once in the titles. After exact playlist, video-ID, title,
duration, chapter, membership-count, uniqueness, and current-position guards,
one atomic five-membership upsert normalized the staging order to `1–22`.
The source title was separately collision-guarded and normalized to
`General Organic Chemistry: Part 2`.

All lessons coherently cover reaction intermediates and rearrangements,
acidity/basicity, acid-base reaction conditions, and tautomerism. The
canonical staging chapter `Some Basic Principles of Organic Chemistry`
matches Unit 14 of the
[official JEE Main 2026 syllabus](https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/10/202510311323551056.pdf).

Staging browser checks covered lessons 1, 18, and 22 plus global search. Each
expected privacy-enhanced YouTube embed loaded, the repaired 17–18–19
transition rendered in order, search opened course `1244`, and no console
errors appeared. The anonymous `/admin` route correctly required an
administrator sign-in.

Production was intentionally not changed. Its dry run reported the missing
canonical chapter as a production blocker. The signed-in Supabase Backups page
also reported that the `youtube` project is on Free Plan and that Free Plan
does not include project backups. With no qualifying backup or isolated
restore rehearsal recorded, the repository's backup gate blocks all
production writes. Production remains at 83 courses and 1,307 memberships.

Validation after the staging checkpoint:

- Independent and local source-to-staging checks confirmed 22 contiguous
  positions, exact source IDs/titles/durations, correct taxonomy and metadata,
  40,501 seconds total, complete video goal/class links, and 0 reuse.
- All 683 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build and frontend release safeguards passed.
- The anonymous production capability contract passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings.

No production data, migrations, schema, or application code were changed, and
no manual CI rerun was started.

## Indefinite Integration staging checkpoint and discovery hardening

Indefinite Integration cleared the content and staging gates:

- Source playlist `PL_A4M5IAkMacK7OyqPwHe0rvG4KqxFIum`.
- 87 new Class 12/Dropper staging lessons, teacher `Mohit Tyagi`, with 0 reused
  videos.
- Staging course/chapter: `1245` / `153`.
- Production course/chapter: not created.

The source has 87 published, usable, unique, public, processed, embeddable, and
duration-complete videos totaling 51,760 seconds (14 hours, 22 minutes,
40 seconds), with no production video overlap. All 87 descriptions and 86 of
87 titles directly identify Mohit Tyagi; lesson 42 supplies the attribution in
its description, and no alternate teacher appears.

The leading title numbers and source positions are exactly `1` through `87`.
The initial dry run nevertheless returned `blocked` with duplicate lesson
number `2`: the parser ignored plain-space leading numbers and instead read
internal `(Part 2)` labels in lessons 5, 8, and 40. The parser now treats a
plain-space leading number as authoritative over an internal `(Part N)` label,
and regression coverage preserves that rule. The post-fix write-free production
dry run reports quality `ok`, 0 findings, 87 usable videos, no duplicate video
IDs, and the expected missing-chapter production blocker. Staging retained
exact source order, so no membership normalization write was needed.

The lessons coherently cover basic antiderivatives, substitution, integration
by parts, trigonometric and algebraic forms, partial fractions, and exact
derivatives. This matches the indefinite-integral scope in the
[official JEE Main 2026 syllabus](https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/10/202510311323551056.pdf)
and
[official JEE Advanced 2026 syllabus](https://jeeadv.ac.in/documents/jee-advanced-2026-syllabus.pdf).
The canonical chapter is `Indefinite Integration`, not the existing
`Definite Integration` or `Application of Integrals` chapters.

Runtime QA uncovered one staging discovery defect: the disposable staging
schema predates optional video-popularity rollup columns, so Browse requested
`view_count_total` and failed before rendering courses. The browse hook now
retries once without optional popularity fields only when Postgres explicitly
reports one of those columns missing. Normal production success remains one
request; unrelated schema errors do not retry, stale requests cannot launch a
fallback, and fallback ordering remains deterministic.

After the fix, staging Browse rendered its 86 fixture/content courses, search
returned only Indefinite Integration, and opening the result loaded course
`1245`. Direct course checks covered lessons 1, 8, 44, and 87, including the
parser-edge `(Part 2)` lesson and the disabled final Next control. Each expected
privacy-enhanced YouTube embed loaded, lesson search worked, and light/dark
theme switching succeeded. Production Browse still rendered all 83 courses.

Production was intentionally not changed and contains neither this course nor
its canonical chapter. The signed-in Supabase Backups page reports that the
`youtube` project is on Free Plan and that Free Plan does not include project
backups. With no qualifying backup or isolated restore rehearsal recorded, the
repository's backup gate continues to block every production write. Production
remains at 83 courses and 1,307 memberships.

Validation after the checkpoint:

- Independent and local source-to-staging checks confirmed 87 contiguous
  positions, 87 unique IDs, exact source IDs/titles/durations/embed status,
  correct taxonomy and metadata, 51,760 seconds total, complete goal/class
  links, and 0 reuse.
- All 688 Vitest tests passed across 69 files.
- ESLint passed with zero warnings.
- The production Vite build completed with 1,945 modules transformed.
- All 20 frontend release gates and all 5 production capability checks passed.
- The production-only dependency audit found 0 vulnerabilities. The general
  audit retains the known 7 high-severity dev-only
  ESLint/minimatch/brace-expansion findings; the breaking forced fix remains
  deferred.

No production data, migration, or schema change was made, and no manual CI run
was started.

## Mixed-chapter ingestion prerequisite

The approved whole-playlist backlog was exhausted without forcing incomplete
sources, mixed faculty, or ambiguous chapter mappings. A guarded v12
prerequisite is now implemented in source but intentionally not deployed:

- Exact checked-in manifests bind every source position and YouTube video ID to
  one canonical chapter, require real strictly increasing YouTube positions,
  and use a durable request UUID plus manifest/source SHA-256 evidence.
- The additive mapped RPC keeps one source playlist as one course, validates
  every chapter and reused video before writing, performs the import and
  chapter assignments atomically, and records an RLS-protected audit snapshot.
- Identical request retries are read-only replays; conflicting retries,
  existing source courses, partial mappings, and cross-subject/chapter reuse
  are rejected.
- Replay checks import-owned structural state without being invalidated by
  unrelated ratings, popularity, or verification refreshes. The public
  capability endpoint exposes fixed read-only flags; audit state stays guarded.
- Chapter-qualified course routes now constrain playback, navigation, counts,
  duration, and resume selection to the requested chapter. The chapterless
  route remains full-course mode.

Functions playlist `PL_A4M5IAkMad5zB0Dh6gUw1eYK8dN7hP7` was not imported.
Its 187-item source snapshot contains 141 clear Functions lessons, 7 clear
Inverse Trigonometric Functions lessons, and 39 lessons requiring an explicit
editorial taxonomy decision. The ordered position/video-ID snapshot SHA-256 is
`214db3c5b0c42fadc9c88bc49e6958bf94ae2214f65ba3466c25f6b81afc540d`.
The quality gate also reports repeated lesson number `57` across positions
57–61, and no waiver was added. No manifest is checked in.

No v12 migration was applied, no staging or production data was changed, and
no production package was regenerated. The SQL is covered by static source
contracts but was not compiled or runtime-tested against Supabase. See
`docs/per_video_chapter_ingestion.md` for the future deployment checklist.
