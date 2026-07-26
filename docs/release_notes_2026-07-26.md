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
