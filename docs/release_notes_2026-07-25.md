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

### Class 11 mechanics and thermal batch

A further staging-first batch added:

- Work, Power and Energy: 11 new lessons.
- Centre of Mass: 12 new lessons.
- Thermodynamics: 8 new lessons.

Production now contains 24 courses and 251 ordered playlist memberships.
Anonymous post-import checks confirmed exact course counts, contiguous lesson
positions, complete video metadata, correct Class 11/Dropper attribution, zero
blocked embeds, zero new overlap pairs, and zero fully contained duplicate
course candidates. The anonymous production capability contract passed.

Four other Class 11 candidates were rejected rather than normalized silently:
Gravitation exposed only 6 of 9 published entries, SHM exposed 12 of 13 plus
one existing-video overlap, and Circular Motion and KTG had inconsistent
source lesson ordering. No migrations, schema changes, or application-code
changes were made for this batch.

### Properties of matter and thermal batch

The next staging-first batch added:

- Elasticity: 4 new lessons under Mechanical Properties of Solids.
- Thermal Expansion: 4 new lessons under Thermal Properties of Matter.
- Calorimetry: 4 new lessons under Thermal Properties of Matter.
- Heat Transfer: 7 new lessons under Thermal Properties of Matter.

Production now contains 28 courses and 270 ordered playlist memberships.
Anonymous checks confirmed exact course counts, contiguous lesson positions,
complete metadata, correct Class 11/Dropper attribution, zero blocked embeds,
zero new overlap pairs, and zero fully contained duplicate-course candidates.
The production capability contract passed.

Fluid Mechanics was deferred because its source playlist order is inconsistent.
After the Elasticity import, a syntax error in a local read-only audit wrapper
stopped the batch before another import started. The exact 25/255 state was
verified with a corrected audit before the remaining three imports continued.
No production data needed correction. No migrations, schema changes, or
application-code changes were made.

### Fluids and rotational-motion batch

The next staging-first batch added:

- Surface Tension: 5 new lessons under Mechanical Properties of Fluids.
- Rotational Dynamics: 20 new lessons under Rotational Motion.

Production now contains 30 courses and 295 ordered playlist memberships.
Anonymous checks confirmed exact course counts, contiguous positions, complete
metadata, correct Class 11/Dropper attribution, zero blocked embeds, zero new
overlap pairs, and zero fully contained duplicate-course candidates. The
production capability contract passed.

Viscosity was deferred because its first two source lessons are reversed.
Sound Waves was deferred because its lesson sequence is inconsistent and it
contains a video already used by Wave Optics. No migrations, schema changes,
or application-code changes were made.

### Units and Measurements checkpoint

Error and Measurement added 5 new Class 11/Dropper lessons under Units and
Measurements. Production now contains 31 courses and exactly 300 ordered
playlist memberships.

The catalog and anonymous capability checks passed with zero missing metadata,
zero title-review flags, zero missing teacher attributions, zero blocked embeds
in the new course, zero new overlap pairs, and zero fully contained duplicate
course candidates.

Five read-only production timing samples recorded:

- curriculum navigation: 215 ms average, 222 ms maximum;
- first catalog page: 193 ms average, 202 ms maximum.

The 70-entry Ray Optics source was blocked before staging because it repeats
one YouTube video, duplicates lesson 36, and includes a Unit and Dimension
lesson. Wave on String was deferred because lessons 6, 7, and 8 are out of
source order. The remaining explicitly Physics-labelled chapter sources now
require source correction, taxonomy review, or overlap approval before another
batch. Expanding to Chemistry or Mathematics also requires a separate,
verified teacher-attribution pass. No migrations, schema changes, or
application-code changes were made.

## Operational boundary

Future catalogue batches still require the ingestion preflight, a recent
restorable production backup, a staging sample, reviewed taxonomy and overlap
results, and numerical stop/rollback thresholds. A previously completed batch
does not authorize the next one.

### First Chemistry checkpoint

The first Chemistry course was promoted after a read-only discovery and
teacher-attribution pass:

- Thermochemistry: 8 new Class 11/Dropper lessons from Mohit Tyagi playlist
  `PL_A4M5IAkMaeghI_80Pllo-oJ_CfWSy59`.
- Teacher attribution: `ALK Sir`, supported by the source playlist metadata
  and video metadata.
- Production reference data: Chemistry chapter `Thermochemistry` was inserted
  separately as chapter `29` after production confirmed Chemistry existed as
  subject `2` and had 0 Chemistry chapters.
- Production course: `39`, title `CHEMISTRY THERMOCHEMISTRY`, 8 ordered
  lesson memberships, 0 reused videos.

Production now contains 32 courses and exactly 308 ordered playlist
memberships. Anonymous checks confirmed the new course appears through
`get_chapter_courses(29)`, all 8 lessons map to Chemistry/Thermochemistry,
metadata is complete, duplicate-course candidates remain 0, and the production
capability contract passed.

Validation after the update:

- 619 Vitest tests passed across 66 files.
- ESLint passed with zero warnings.
- The production Vite build passed.
- `npm audit --audit-level=high` still reports 7 high-severity findings in
  the dev-only ESLint/minimatch/brace-expansion chain. `npm audit fix
  --dry-run` produced no non-breaking fix, and `npm audit fix --force
  --dry-run` proposed major/breaking ESLint changes plus peer conflicts, so no
  dependency mutation was made in this content batch.

No migrations, schema changes, or application-code changes were made.

### Chemistry equilibrium and nuclear checkpoint

A follow-up staging-first Chemistry batch added two more `ALK Sir` courses:

- Chemical Equilibrium: 10 new Class 11/Dropper lessons from playlist
  `PL_A4M5IAkMaedwEboOyFHzyLrpVALNl_2`, under production chapter `30`.
- Nuclear Chemistry: 8 new Class 12/Dropper lessons from playlist
  `PL_A4M5IAkMadFwfHLDsGFGynlaFhM7FJP`, under production chapter `31`.

Both playlists passed source-order, duplicate-video, zero-overlap, staging
import, production dry-run, and production import gates. Chemical Equilibrium
was also title-corrected from the source typo `CHEMISTRY-CHEMICAL EQUIIBRIUM`
to the curated title `Chemical Equilibrium` on the exact staging and production
playlist rows.

Production now contains 34 courses and exactly 326 ordered playlist
memberships. Anonymous checks confirmed both new courses appear through their
chapter course RPCs, all 18 new lessons are embeddable with duration metadata,
duplicate-course candidates remain 0, and the production capability contract
passed.

Validation after the update:

- 640 Vitest tests passed across 67 files.
- ESLint passed with zero warnings.
- The production Vite build passed.
- Frontend release gates passed.
- `npm audit --audit-level=high` still reports the same 7 high-severity
  dev-only ESLint/minimatch/brace-expansion findings. The non-breaking audit
  fix path remains unavailable, so dependency changes are still deferred.

General Inorganic Chemistry was not imported because the quick video-metadata
pass did not expose direct teacher-attribution evidence. Surface Chemistry was
deferred at this point pending review of the `#alksir` description evidence and
was handled in the following checkpoint. No migrations, schema changes, or
application-code changes were made.

### Surface Chemistry checkpoint

Surface Chemistry was promoted after the teacher-attribution review was
completed with the `#alksir` description signal included:

- Surface Chemistry: 9 new Class 12/Dropper lessons from playlist
  `PL_A4M5IAkMacJHCXkUt-73k--709WPvVs`, under production chapter `32`.
- Production course: `42`, title `SURFACE CHEMISTRY`, teacher `ALK Sir`.

The playlist passed source-order, duplicate-video, zero-overlap, staging
import, production dry-run, and production import gates. Production now
contains 35 courses and exactly 335 ordered playlist memberships. Anonymous
checks confirmed the course appears through its chapter course RPC, all 9
lessons are embeddable with duration metadata, duplicate-course candidates
remain 0, and the production capability contract passed.

Validation after the update:

- 664 Vitest tests passed across 68 files in the current local workspace.
- ESLint passed with zero warnings.
- The production Vite build passed.
- `npm audit --audit-level=high` still reports the same 7 high-severity
  dev-only ESLint/minimatch/brace-expansion findings.

General Inorganic Chemistry remains deferred because the quick video-metadata
pass did not expose direct teacher-attribution evidence. No migrations, schema
changes, or application-code changes were made for the Surface Chemistry import.
