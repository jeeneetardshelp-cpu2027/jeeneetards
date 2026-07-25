# Release checkpoint — 25 July 2026

This note records the frontend and catalogue-management checkpoint ending at
commit `b5d0c6f63bc533bde8b5748a21d42ba4b7a8a2a9`.

## Student experience

- Course discovery supports Home, guided Explore, and the canonical Browse
  catalogue.
- JEE Class 11 Physics navigation resolves to bounded course results.
- Search covers chapters, playlists, and individual lectures.
- Course pages provide lesson navigation and YouTube privacy-enhanced embeds.
- Light and dark themes work across desktop and mobile layouts.
- School-board data is requested only inside the School journey; JEE and NEET
  Explore routes do not query board tables.

## Catalogue management

- The Admin Manage tab supports paginated catalogue lookup.
- Guarded operations cover playlist metadata, class levels, language, video
  taxonomy, lecture chapter reassignment, shared-video acknowledgement, and
  playlist deletion.
- The disposable-staging management journey passed language, class-level, and
  chapter corrections.
- The staging integration suite passed 88 checks covering validation,
  create/merge/replace behavior, rollback, taxonomy, authorization, and the
  profile privilege guard.

## Quality evidence

- GitHub Actions run
  [#22](https://github.com/jeeneetardshelp-cpu2027/jeeneetards/actions/runs/30148109421)
  completed successfully for the checkpoint commit.
- The frontend suite passed 612 tests at that commit.
- The request and delayed-response subset passed 150 tests.
- The responsive audit recorded 60 route/viewport checks across widths from
  360 to 2560 pixels with no objective overflow or duplicate-header failure.
- Production bundle sizes recorded during the pass:
  - main application: 87.43 KB gzip;
  - Supabase client: 52.89 KB gzip;
  - CSS: 8.12 KB gzip.

## Catalogue rollout update

- Production now contains 18 courses and 197 ordered playlist memberships,
  all under JEE Physics.
- The reviewed Class 12 additions include Magnetism, Electromagnetic
  Induction, Alternating Current, Electromagnetic Waves, Wave Optics, and
  Semiconductor Electronics.
- Wave Optics added 11 lessons (10 new videos and one reviewed reuse from
  Electromagnetic Waves). Semiconductor Electronics added 10 new lessons.
- The catalogue audit reports zero missing core metadata, zero title-review
  flags, zero missing teacher attributions, and zero fully contained duplicate
  course candidates.
- Nuclear Physics was not promoted. Its YouTube playlist repeats video ID
  `sk0AndvKmfE`, so it remains a dry-run blocker.
- The importer now detects repeated playlist video IDs before chapter lookup,
  chapter creation, or the import RPC. This closes the staging issue where a
  rejected playlist could leave an empty chapter row.
- The empty staging-only Nuclear Physics chapter created by the earlier failed
  attempt was identity-checked, confirmed to have zero video references, and
  removed. Production was never affected by that failure.
- No database migrations or schema changes were run for this rollout.

Validation after the update:

- 619 frontend and script tests passed across 66 files.
- ESLint passed with zero warnings.
- The production Vite build passed.
- Frontend release and anonymous production capability gates passed.
- The production dependency audit found zero vulnerabilities.

### Subsequent reviewed content batch

The next staging-first batch added three Class 12/Dropper courses:

- Photoelectric Effect: 7 new lessons under Dual Nature of Radiation and
  Matter.
- Bohr's Model: 9 new lessons under Atoms.
- Optical Instruments: 7 new lessons under Ray Optics and Optical
  Instruments.

Production now contains 21 courses and 220 ordered playlist memberships.
Anonymous post-import checks confirmed contiguous lesson positions, complete
video metadata, zero blocked embeds, zero new overlaps, and zero fully
contained duplicate-course candidates. The production capability contract also
passed.

Nuclear Physics remains blocked by its repeated source video ID. The X-rays
playlist was deferred because its lessons span X-ray production, atomic
experiments, Bragg diffraction, and electron diffraction; assigning all four
to one chapter needs a separate taxonomy decision. No migrations, schema
changes, or application-code changes were made for this batch.

## Operational boundary

Future catalogue batches still require the ingestion preflight, a recent
restorable production backup, a staging sample, reviewed taxonomy and overlap
results, and numerical stop/rollback thresholds. A previously completed batch
does not authorize the next one.
