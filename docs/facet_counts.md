# Facet counts — verified semantics and rollout status

**Status: implemented in v9 and verified on disposable staging. The React UI
uses it when available and safely omits counts until v9 is deployed to the
target database. Production has not been changed by this work.**

The filter panel shows contextual course counts beside each option when the v9
RPC exists. Counts come from one database call; the browser never downloads the
catalogue or issues one request per option.

## Why this is database-side

An accurate contextual count cannot be produced from the current schema without
doing the one thing this phase forbids: fetching the catalogue.

The naive version — load every matching playlist and tally in JavaScript —
gives correct numbers on a 7-row database and collapses at 10,000. It also
breaks *before* it gets slow: results are paginated, so the browser only ever
holds one page, and a tally over one page is simply wrong.

The alternative — one `count: "exact"` request per option — is an N+1 pattern.
With 4 exams × 4 classes × 4 subjects × 5 course types that is dozens of round
trips per keystroke.

v9 provides that database-side aggregate.

## Required semantics

Any implementation must satisfy all three rules. They are not obvious, and
getting them wrong produces numbers that look plausible and mislead.

### 1. Each option's count applies every *other* active filter

With `goal=jee&class=11` active, the count beside **Chemistry** must be "JEE,
Class 11, Chemistry" — not the number of Chemistry courses in the whole
library. A count that ignores context tells a student there are 200 Chemistry
courses and then shows them three.

### 2. The option's own facet is excluded when counting its alternatives

With `subject=physics` active, the counts beside *all* subjects must be
computed with the subject filter **removed**. Otherwise every subject except
Physics reads `0`, and the panel becomes a dead end — you can never switch
subject because every alternative looks empty.

This is the rule most often missed. The filter being counted is excluded from
its own denominator; every other active filter still applies.

### 3. One playlist counts once, however many junction rows match

A playlist tagged both `class-11` and `class-12` matches a Dropper query
through two `playlist_class_levels` rows. A `count(*)` over the join returns 2.
It must contribute **1**.

This requires `count(distinct playlists.id)`, not `count(*)`.

This was verified with a run-scoped staging fixture tagged for both Class 11
and Class 12. It appeared once under Dropper.

## Migration and evidence

The authoritative migration is
`src/migrations/catalog_navigation_v9.sql`. The older
`src/migrations/facet_counts.sql` is retained only as superseded review history
and must not be applied.

v9 defines both `public.get_browse_curriculum(...)` and
`public.browse_facet_counts(...)`. The latter returns `(facet, value, n)` rows
in one round trip, with each facet computed against the other filters and
`count(distinct)` throughout.

Staging verification run `50bee2` passed 10/10, including non-vacuous JEE/NEET
isolation, class pruning, distinct chapter course counts, own-facet exclusion,
other-filter application, Dropper superset semantics, multi-tag deduplication,
and an honest search miss. Exact output is preserved in
`catalog-navigation-test-report.json`.

Production rollout remains a separate, explicit step. Until then the Guided
journey falls back to its legacy lecture-labelled read path and Catalogue keeps
all filters usable while omitting contextual counts.
