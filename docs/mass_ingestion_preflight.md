# Mass-ingestion preflight

Use this gate before adding catalogue content in batches. It prepares an
import; it does not authorize one.

## Baseline recorded on 26 July 2026

- 83 courses and 1,307 playlist memberships.
- Coverage: 33 JEE Physics, 27 JEE Chemistry, and 23 JEE Mathematics courses;
  43 Class 11 courses, 42 Class 12 courses, and 78 Dropper-compatible courses.
- Core metadata missing from 0 courses.
- Fully contained duplicate candidates: 0.
- Registered source channel: Mohit Tyagi.
- Production catalogue writes are paused. On 26 July 2026 the signed-in
  Supabase Backups page identified the `youtube` production project as Free
  Plan and explicitly reported that Free Plan does not include project
  backups. No qualifying backup timestamp or isolated restore rehearsal is
  recorded. Keep using staging until
  [backup and restore readiness](backup_restore_readiness.md) is complete.
- Chemistry expansion started with Thermochemistry, playlist
  `PL_A4M5IAkMaeghI_80Pllo-oJ_CfWSy59`, teacher attribution `ALK Sir`, 8
  ordered lessons, and 0 video reuse.
- The next Chemistry batch added Chemical Equilibrium, playlist
  `PL_A4M5IAkMaedwEboOyFHzyLrpVALNl_2`, and Nuclear Chemistry, playlist
  `PL_A4M5IAkMadFwfHLDsGFGynlaFhM7FJP`, both with `ALK Sir` attribution and
  0 video reuse.
- Surface Chemistry, playlist `PL_A4M5IAkMacJHCXkUt-73k--709WPvVs`, was added
  after all 9 videos showed `ALK Sir` evidence when the `#alksir` description
  form was included; it also had 0 video reuse.
- Solutions, source playlist `PL_A4M5IAkMaeFN4bIxWXLr-6FTbZqZNeO` titled
  `CHEMISTRY-LIQUID SOLUTION`, was added with `ALK Sir` attribution, 17
  ordered lessons, and 0 video reuse.
- Solid State, source playlist `PL_A4M5IAkMacfcfyAANNIQOuDqHUI5weL`, was
  added with `ALK Sir` attribution, 23 ordered lessons, and 0 video reuse.
- Chemical Kinetics, source playlist `PL_A4M5IAkMadkjXXk9EiOUrn1lGbBico_`,
  was added with `ALK Sir` attribution, 26 ordered lessons, and 0 video reuse.
- Thermodynamics, source playlist `PL_A4M5IAkMaeRvDnG59F_78rB1xnVGll9`, was
  added with `ALK Sir` attribution, 28 ordered lessons, and 0 video reuse.
- Atomic Structure, source playlist `PL_A4M5IAkMafCoVdcacbzrXlRy76fOTwJ`, was
  added with `ALK Sir` attribution, 34 ordered lessons, and 0 video reuse.
- Ionic Equilibrium, source playlist `PL_A4M5IAkMadJjUIVhfb3yy8k2OgmmvYK`, was
  added with `ALK Sir` attribution, 29 ordered lessons, and 0 video reuse.
- Qualitative Analysis, source playlist `PL_A4M5IAkMacB98GRxBk6Fs96_WwbyQdS`,
  was added with `ALK Sir` attribution, 16 ordered lessons, and 0 video reuse.
- Chemistry in Everyday Life, source playlist
  `PL_A4M5IAkMaeB-L4cgWx3Z_OMYBUKqOFP`, was added with `NS Sir`
  attribution, 2 ordered lessons, and 0 video reuse.
- Periodic Table, source playlist `PL_A4M5IAkMafTWeOy5tK5ZsfjY8BpuxS9`, was
  added with `ALK Sir` attribution, 15 ordered lessons, and 0 video reuse.
- Basic Inorganic Nomenclature, source playlist
  `PL_A4M5IAkMaeKDEe14ypLAzo6xPRBZF21`, was added with `ALK Sir`
  attribution, 2 ordered lessons, and 0 video reuse.
- Gaseous State, source playlist `PL_A4M5IAkMaf71_7enQvAZ41ZdIKAFxf5`, was
  added with `ALK Sir` attribution, 27 ordered lessons, and 0 video reuse.
- Hydrogen, source playlist `PL_A4M5IAkMafrSGEfB92LgHNHcJD02O29`, was added
  with `ALK Sir` attribution, 4 ordered Class 11 lessons, and 0 video reuse.
- The d and f Block Elements, source playlist
  `PL_A4M5IAkMacxIWVbn6uUj1kTpdYo9nOa`, was added with `ALK Sir`
  attribution, 12 ordered Class 12 lessons, and 0 video reuse.
- The s-Block Elements, source playlist
  `PL_A4M5IAkMadIk5zPjnR2XgZi2n_7_Qwo`, was added with `ALK Sir`
  attribution, 8 ordered Class 11 lessons, and 0 video reuse. Its source title
  `s BLOCK ELEMENTS` was normalized through an exact, guarded staging-first
  metadata update after the catalog audit flagged it for title review.
- Carboxylic Acids and Derivatives, source playlist
  `PL_A4M5IAkMafYSOfKgyE8Wl_uWzR2M_FU`, was added with `NS Sir`
  attribution, 4 ordered Class 12 lessons, and 0 video reuse.
- Amines, source playlist `PL_A4M5IAkMafkw_Mr6VzCzK2RQZindA3H`, was added
  with `NS Sir` attribution, 5 ordered Class 12 lessons, and 0 video reuse.
- P-Block Elements: Groups 17 and 18, source playlist
  `PL_A4M5IAkMacBob5iqWgldry3gKHEUipf`, was added with `ALK Sir`
  attribution, 6 ordered Class 12 lessons, and 0 video reuse.
- P-Block Elements: Groups 15 and 16, source playlist
  `PL_A4M5IAkMadgDwH13M1jouR_8PEo24QG`, was added with `ALK Sir`
  attribution, 13 ordered Class 12 lessons, and 0 video reuse.
- Source-title capitalization for those four courses was normalized with exact
  playlist/title guards in staging first and then production; the final catalog
  audit contains 0 title-review items.
- P-Block Elements: Groups 13 and 14, source playlist
  `PL_A4M5IAkMad_XS2fNetEPTFguJBVrXwd`, was added with `ALK Sir`
  attribution, 11 ordered Class 11 lessons, and 0 video reuse.
- Qualitative Analysis: Cations, source playlist
  `PL_A4M5IAkMaf1tQ9MqxPgXstm1k0E934E`, was added separately from the
  existing preliminary/anion-analysis course, with `ALK Sir` attribution, 8
  ordered Class 12 lessons, and 0 video reuse.
- Both new source titles were normalized through exact playlist/title guards
  in staging first and then production; the final catalog audit contains 0
  title-review items.
- Structural Isomerism, source playlist
  `PL_A4M5IAkMac-tIcsX-GmJB6Jfv5wjVTp`, was added with `NS Sir`
  attribution, 11 Class 11 lessons, and 0 video reuse. The complete title
  numbering provided an exact 1–11 sequence, so the source order
  `1–5, 8–11, 6–7` was normalized with guarded membership updates in staging
  first and then production.
- Mole Concept, source playlist
  `PL_A4M5IAkMaccW6F0AgKT-mmrlAQksYCu`, was added with `ALK Sir`
  attribution, 12 Class 11 lessons, and 0 video reuse. The complete title
  numbering provided an exact 1–12 sequence, so lesson 6 was moved from the
  final source position into its guarded curriculum position in staging first
  and then production.
- Metallurgy, source playlist `PL_A4M5IAkMafI3Li4aCyQSa-HX6WMUlak`, was
  added with `ALK Sir` attribution, 21 Class 12 lessons, and 0 video reuse.
  The complete title numbering provided an exact 1–21 sequence, so lesson 16
  was moved from the final source position into its guarded curriculum
  position in staging first and then production.
- Communication Systems, source playlist
  `PL_A4M5IAkMadLq0IUyZW8s44EHCj3xClG`, was added with `ABJ Sir`
  attribution, 3 ordered Class 12 lessons, and 0 video reuse.
- Differential Equations, source playlist
  `PL_A4M5IAkMaeukUFW7G-KjoL-K2T3B3Mg`, was added as the first Mathematics
  course with direct `Mohit Tyagi` attribution on all 5 ordered Class 12
  lessons and 0 video reuse.
- Inverse Trigonometric Functions, source playlist
  `PL_A4M5IAkMacqcUtkJPTPXSrvNm_5NK-v`, was added with direct `Mohit Tyagi`
  attribution on all 6 ordered Class 12 lessons and 0 video reuse.
- Trigonometric Equations, source playlist
  `PL_A4M5IAkMafsM4VwfCbZ8Oa4i_96R09n`, was added with direct `Mohit Tyagi`
  attribution on all 3 ordered Class 11 lessons and 0 video reuse.
- Ellipse, source playlist `PL_A4M5IAkMae6_gCoLFltXl3bmtZmOvjQ`, was
  added with direct `Mohit Tyagi` attribution on all 7 ordered Class 11
  lessons and 0 video reuse.
- Hyperbola, source playlist `PL_A4M5IAkMaeaLAU22ViTSvk3T7AWxnT_`, was
  added with direct `Mohit Tyagi` attribution on all 7 ordered Class 11
  lessons and 0 video reuse.
- Statistics, source playlist `PL_A4M5IAkMadco0ISV4gL7BEkzs7ki6lm`, was
  added with direct `Mohit Tyagi` attribution on all 12 Class 11 lessons and
  0 video reuse. Core lessons `#1` through `#11` remain contiguous; the final
  source position is an intentional same-teacher Statistics advanced
  supplement.
- Parabola, source playlist `PL_A4M5IAkMaeT3qAAgcvUXiKnM044FO44`, was
  added with direct `Mohit Tyagi` attribution on all 11 ordered Class 11
  lessons and 0 video reuse.
- Circles, source playlist `PL_A4M5IAkMadiR6WFaUTQegpdKUJRD90D`, was added
  with `#MohitTyagi` attribution in all 18 video descriptions, exact ordered
  Class 11 lessons, and 0 video reuse.
- Complex Numbers, source playlist `PL_A4M5IAkMaeLzehBWWVD_EZL7EuaVP-X`, was
  added with `#MohitTyagi` attribution in all 20 video descriptions, exact
  ordered Class 11 lessons, and 0 video reuse.
- Probability, source playlist `PL_A4M5IAkMaf-WePkSulK_zt0yfQUrZgE`, was
  added with `#MohitTyagi` attribution in all 16 video descriptions, exact
  ordered lessons, and 0 video reuse. Its Class 11 foundations and Class 12
  Bayes/distribution material require Class 11, Class 12, and Dropper tags.
- Permutations and Combinations, source playlist
  `PL_A4M5IAkMae1vVGOC3Ptr4qXYZOqXvJa`, was added with `#MohitTyagi`
  attribution in all 19 video descriptions, exact ordered Class 11 lessons,
  and 0 video reuse. Isolated Class 12 promotional tags in two source titles
  do not change the taught Class 11 curriculum scope.
- Straight Lines, source playlist `PL_A4M5IAkMaf3M7rSq9M4NmLACdYuCQ_7`,
  was added with direct `Mohit Tyagi` attribution in all 20 video
  descriptions, exact ordered Class 11 lessons, and 0 video reuse. Lessons
  17 through 20 retain Pair of Straight Lines as an intentional advanced
  extension of the same coordinate-geometry chapter.
- Determinants, source playlist `PL_A4M5IAkMaex9aIhynPtk3ZO-xO_G2kJ`, was
  added with `#MohitTyagi` attribution in all 25 video descriptions, exact
  ordered Class 12 lessons, and 0 video reuse. Lessons 17 through 19 retain
  differentiation and integration of determinants as advanced same-chapter
  applications.
- Continuity, source playlist `PL_A4M5IAkMads1bsxLYBoJOLA3bWsY7mK`, was
  added with direct `Mohit Tyagi` attribution in all 46 video descriptions,
  exact ordered Class 12 lessons, and 0 video reuse. The source remains
  Continuity-only; separate Differentiability content is not mixed into it.
- Area Under Curves, source playlist `PL_A4M5IAkMaf8TqINqRXRlWeuFgl6fBgf`,
  was added under the canonical Application of Integrals chapter with direct
  `#MohitTyagi` attribution in both video descriptions and 0 video reuse.
  Manual review confirmed the unparseable digit-plus-space source order
  `1` then `2`.
- Vector Algebra and Three-Dimensional Geometry, source playlist
  `PL_A4M5IAkMafmea0RnicbuLD6Ly2EIr0X`, was added under the official combined
  Vectors and Three-Dimensional Geometry unit with `#MohitTyagi` attribution
  in all 12 video descriptions, exact ordered lessons, and 0 video reuse.
- Definite Integration, source playlist
  `PL_A4M5IAkMafGD8xJhm9IioyF_norREYN`, was added with direct
  `#MohitTyagi` attribution in all 86 video descriptions, exact ordered
  Class 12 lessons, and 0 video reuse. The uninterrupted `Part 1` through
  `Part 86` source was preserved in one atomic course.
- Logarithms, source playlist `PL_A4M5IAkMadF2rExT0C-TvtH2vn3dLGR`, was
  added with direct `#MohitTyagi` attribution in all 5 video descriptions,
  5 Class 11/Dropper lessons, and 0 video reuse. Manual review confirmed the
  digit-plus-space source order `1` through `5`, which the automated
  lesson-number parser cannot assess.
- Differentiation, source playlist `PL_A4M5IAkMaeewzwCJPpL65y1HV0VAiC4`,
  was added as the standalone canonical Differentiation course with direct
  Mohit Tyagi attribution in all 62 descriptions, exact ordered `Part 1`
  through `Part 62` Class 12/Dropper lessons, and 0 video reuse. Its source
  title was normalized through exact guards. This course is distinct from
  the deferred Differentiability source.
- Quadratic Equations, source playlist
  `PL_A4M5IAkMaf5Ga3nQJe-gg-0zXG77YRB`, was added with direct Mohit Tyagi
  attribution in all 66 descriptions, 66 Class 11/Dropper lessons, and 0
  video reuse. Manual review confirmed the digit-plus-space title order `1`
  through `66`, which the automated lesson-number parser cannot assess.
  Lessons 61 through 66 retain Theory of Equations as an intentional
  same-chapter extension. The source title was normalized to the canonical
  course title `Quadratic Equations and Expressions` through exact guards.
- Progressions and Series, source playlist
  `PL_A4M5IAkMaeu--QWWngkEI10RKOXf8TF`, was added under the canonical
  Sequences and Series chapter with direct `#MohitTyagi` attribution in all
  88 descriptions, exact ordered `Part 1` through `Part 88` Class 11/Dropper
  lessons, and 0 video reuse. The source title `Progression and Series` was
  normalized to `Progressions and Series` through exact guards.
- Binomial Theorem, source playlist
  `PL_A4M5IAkMacSgRRlEkUB9v-gE1yxw_rG`, was added with direct
  `#MohitTyagi` attribution in all 92 descriptions, exact ordered `Part 1`
  through `Part 92` Class 11/Dropper lessons, and 0 video reuse. The source
  title already exactly matched the canonical chapter and course title, so
  no normalization update was needed.
- Heights and Distances: JEE Main 2019 PYQs, source playlist
  `PL_A4M5IAkMaedGbnmLZVKTkd6RS0X3XZB`, was added as a `pyq` course under
  the canonical Trigonometry chapter with direct `Mohit Tyagi` attribution
  in all 3 titles, an exact ordered `#1` through `#3` Class 11/Dropper
  sequence, and 0 video reuse. The source title was normalized through exact
  playlist, title, subject, and collision guards in staging first and then
  production.
- Conductors, source playlist `PL_A4M5IAkMafRbbj8o0zvHGHrJV8FsxgZ`, was
  added under Electrostatics with direct `ABJ Sir` attribution in all 4
  descriptions, 4 Class 12/Dropper lessons, and 0 video reuse. Its visible
  source order `2, 1, 3, 4` was normalized to the exact title-number order
  `1, 2, 3, 4` with an atomic, guarded membership upsert in staging first and
  then production. The source title was also normalized to `Conductors`
  through exact guards.
- General Organic Chemistry: Part 2, source playlist
  `PL_A4M5IAkMafc2p-SO0X7dPJGHp7kqO22`, is staging-qualified but not
  production-approved. Staging course/chapter `1244` / `152` contains 22 new
  Class 11/Dropper lessons by `NS Sir` with 0 reuse. All 22 titles directly
  identify NS Sir; the source has 22 published, usable, unique, public,
  embeddable, duration-complete videos and passed the automated quality gate
  with 0 findings. Its source order `1–17, 19–22, 18` was normalized through
  an exact guarded five-membership update to `1–22`. The canonical chapter
  `Some Basic Principles of Organic Chemistry` follows Unit 14 of the
  [official JEE Main 2026 syllabus](https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/10/202510311323551056.pdf).
  Production remains blocked by the missing chapter reference and, more
  importantly, the incomplete backup/restore gate.
- Indefinite Integration, source playlist
  `PL_A4M5IAkMacK7OyqPwHe0rvG4KqxFIum`, is staging-qualified but not
  production-approved. Staging course/chapter `1245` / `153` contains 87 new
  Class 12/Dropper lessons by `Mohit Tyagi` with 0 reuse. The source has 87
  published, usable, unique, public, embeddable, duration-complete videos
  totaling 51,760 seconds. All 87 descriptions and 86 of 87 titles directly
  identify Mohit Tyagi; lesson 42 is attributed in its description, and no
  alternate teacher appears. Source positions and leading title numbers are
  exactly `1` through `87`, so no membership repair was needed.

  The first dry run incorrectly reported duplicate lesson number `2` because
  the parser ignored plain-space leading numbers and read internal `(Part 2)`
  labels in lessons 5, 8, and 40. The parser now treats a plain-space leading
  number as authoritative over an internal `(Part N)` label, regression tests
  cover this exact pattern, and a post-fix production dry run reports quality
  `ok` with 0 findings. The new canonical
  chapter matches the indefinite-integration scope in the
  [official JEE Main 2026 syllabus](https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/10/202510311323551056.pdf)
  and
  [official JEE Advanced 2026 syllabus](https://jeeadv.ac.in/documents/jee-advanced-2026-syllabus.pdf).
  Production still reports `chapter.production_blocker: true` and remains
  blocked by the backup/restore gate.
- Limits, source playlist `PL_A4M5IAkMaexM2nxZt512ESPt83EshJq`, is
  staging-qualified but not production-approved. Staging course/chapter
  `1251` / `158` contains 99 new Class 11/Dropper lessons by `Mohit Tyagi`
  with 0 reuse. The source has 99 published, usable, unique, public,
  embeddable, duration-complete videos totaling 60,387 seconds. All 99 live
  descriptions directly identify Mohit Tyagi, positions and visible leading
  lesson numbers are exactly `1` through `99`, and the automated quality gate
  passed with 0 findings. The source title was normalized from
  `IIT-JEE-Mathematics-Limits` to `Limits` through the guarded management RPC
  after the staging import.

  Limits is part of JEE Main Unit 7 and JEE Advanced Differential Calculus.
  The Class 11 mapping follows the current CBSE senior-secondary Mathematics
  curriculum's Limits and Derivatives unit. Production still has neither the
  playlist nor the chapter; the write-free production plan correctly reports
  `chapter.production_blocker: true`, and the backup/restore gate independently
  blocks promotion.
- Solution/Properties of Triangle, source playlist
  `PL_A4M5IAkMaerL1K-p5sRRdzjNrqn72Rg`, remains deferred despite 9 clean,
  fully attributed, overlap-free lessons. Lessons 1–6 are trigonometric
  solution-of-triangle material, while lessons 7–9 cover centroid,
  circumcenter, and orthocenter concepts grouped under analytical/coordinate
  geometry in the current JEE syllabi. Do not force the whole playlist into
  the existing Trigonometry chapter. A reviewed per-video manifest and a
  production-capable mapped-import path are required before promotion.
- Differentiability remains deferred even though its 45 lessons are ordered
  and overlap-free: lesson 16 has no direct teacher evidence, leaving the
  source at 44/45 attributed descriptions on a multi-faculty channel.
- Nuclear Physics is intentionally excluded: its source playlist repeats a
  YouTube video ID and is blocked before any database write.
- X-rays is intentionally deferred because its playlist spans multiple
  curriculum concepts and needs an explicit chapter-placement decision.
- Gravitation and SHM are deferred because their usable video counts are lower
  than their published playlist counts. Circular Motion and KTG are deferred
  because their source lesson ordering is inconsistent.
- Fluid Mechanics is deferred because its source lesson ordering is also
  inconsistent.
- Viscosity is deferred because its first two source lessons are reversed and
  its final unnumbered lesson lacks direct teacher evidence while mixing Fluid
  Mechanics, KTG, and Thermodynamics. Sound Waves is deferred because its
  source sequence is inconsistent and it includes an existing Wave Optics
  video.
- Ray Optics is blocked because its source repeats one video, duplicates lesson
  number 36, and includes a Unit and Dimension lesson. Wave on String is
  deferred because lessons 6, 7, and 8 are out of source order.
- IUPAC is deferred because its source exposes 44 published videos but only 43
  usable videos, and direct teacher evidence is incomplete. Environmental
  Chemistry is deferred until the remaining teacher-attribution gap is
  reviewed.
- Coordination Compounds is deferred despite its exact 32-lesson sequence:
  lesson 31 has no direct `ALK Sir` evidence, leaving attribution at 31/32 on
  the multi-faculty channel. Electrochemistry is deferred because its final
  unnumbered lesson mixes Carbonyl and Electrochemistry questions and leaves
  direct `ALK Sir` attribution at 30/31.
- General Inorganic Chemistry is deferred because the quick video-metadata pass
  did not expose direct teacher-attribution evidence.
- Redox Reaction and Equivalent Concept is deferred because production dry-run
  found 16 published videos but only 15 usable videos, so the batch stops before
  any database write.
- Hydrocarbons, Aromatic Hydrocarbons, ORM-3, ORM-4, Polymers, Biomolecules,
  Carbonyl Compounds, and Reduction/Oxidation/Hydrolysis remain deferred
  because teacher evidence is incomplete and/or appended PYQ videos make the
  source scope ambiguous.
- ORM-2 is blocked because its source repeats a YouTube video ID. GOC-1 is
  deferred because its final two unnumbered appendages lack direct teacher
  evidence. ORM-1 is deferred because it crosses multiple canonical units and
  ends with an unnumbered mixed-channel supplement. Stereoisomerism is deferred
  because lesson 40 is mistitled `4O`, the source order needs extensive repair,
  and the final unnumbered PYQ lacks direct teacher evidence.
- Matrices is deferred because its otherwise-contiguous `#1` through `#11`
  source ends with an unnumbered Cayley-Hamilton lesson credited to Rajat Jain
  Sir. Importing it as one Mohit Tyagi course would lose the mixed-teacher
  attribution; no write was made.
- Mixed-chapter ingestion v12 is implemented and rehearsal-passed only on the
  disposable staging database. Its 25-assertion verifier passed, the temporary
  staging helper was rolled back, and zero fixture or audit residue remained.
  Production intentionally does not advertise the v12 capability. Its exact
  manifest contract, staging evidence, and current Functions blocker are
  documented in `docs/per_video_chapter_ingestion.md`. Do not split a source,
  invent a mapping, deploy v12 to production, or rerun an older cumulative
  production migration as a substitute for the required editorial and release
  review. Functions is additionally blocked by the deterministic repeated
  lesson `57` finding and 39 unresolved mappings; there is no quality waiver.

Regenerate the read-only baseline immediately before every batch:

```powershell
npm run audit:production-catalog
npm run audit:ingestion -- --env=production
```

Do not replace the catalogue audit with an ad hoc single Supabase query. The
checked-in auditor pages playlists and memberships with an exact count and
stable total order, then refuses to report overlap evidence unless the fetched
membership count equals the summed course counts. This matters now that the
production catalogue contains more than 1,000 memberships.

## Read-only human-review bundle

Before supplying academic decisions to the importer, run the classifier against
the real source metadata and current public taxonomy:

```powershell
npm.cmd run review:ingestion -- --playlist=<PLAYLIST_ID> --env=production --expected-project-ref=<PROJECT_REF>
```

The runner uses only `YOUTUBE_API_KEY` and the Supabase anonymous key. It reads
the playlist owner, description, ordered usable videos, categories, subjects,
learning goals, legal category-goal mappings, boards, chapters, verified
teachers, and verified aliases. It then calls
`proposeTaxonomy()`, runs the rules-only per-video chapter mapper when the
subject is safely resolved, and writes a snapshot-hashed review bundle under
`../outputs/ingestion-review/` by default.

`--expected-project-ref` is mandatory. Before making any network read, the
runner compares it with the project ref embedded in the Supabase URL. Staging
also requires the live `app_environment` marker to equal `staging`; production
rejects a staging marker. A mismatch stops the run without producing a bundle.

The bundle is deliberately not an import manifest. It records
`writes_attempted: false`, `importable: false`, every non-automatic decision,
source/taxonomy SHA-256 values, and metadata warnings. Even one verified faculty
candidate remains a human-review item; ambiguity is never broken automatically.
Chapter candidates are restricted to IDs from the resolved subject's live
chapter list. If the subject needs review, every per-video chapter stays manual;
ambiguous and unmatched chapter rows are surfaced instead of guessed.
The proposal deliberately has no singular top-level `chapter_id`: the v12
mapped importer forbids it and requires one reviewed chapter ID per video.
`category_id` is automatic only when the resolved learning goal has exactly one
legal category in `category_learning_goals`; zero or multiple matches stay in
review. `board_ids` is automatically empty for non-School goals because the
database forbids boards there. School goals always keep board selection under
human review using the embedded live board list.
Metadata-derived class labels are checked against `class_levels` and
`learning_goal_class_levels`. An incompatible label is discarded and returned
to review; an absent signal stays in review with only the live-compatible class
candidates. `audience_focus` is recomputed from that validated label set.
The runner refuses repository-local output and refuses to overwrite an existing
bundle unless `--overwrite` is supplied.

Verify a bundle again before asking a human to review it or using it as evidence:

```powershell
npm.cmd run verify:ingestion-review -- --bundle=<REVIEW_JSON_PATH>
```

This verifier is offline: it reads one local file and writes nothing. It
recomputes the embedded source and taxonomy hashes, checks project identity and
the read-only safety flags, confirms every proposed ID exists in the embedded
taxonomy, and requires one chapter row for every source video. It exits nonzero
if the bundle was altered or its internal review coverage is inconsistent.

Use `--env=staging` only when the staging environment file points to the
intended read-only comparison target. This command performs no database write,
RPC, migration, fixture creation, import, or deployment. A reviewed bundle does
not authorize any later write.

## Importer controls

The channel importer:

- targets staging when `--env` is omitted;
- requires exact `--expected-playlists` and explicit `--max-playlists`;
- refuses a batch cap above 25;
- supports `--dry-run` with the anonymous Supabase key;
- checks that a named playlist belongs to the named channel;
- requires `--confirm-production` for production writes;
- refuses production imports whose chapter reference does not already exist;
- reports repeated YouTube video IDs as a dry-run blocker;
- refuses a playlist with repeated YouTube video IDs before chapter lookup,
  chapter creation, or the import RPC;
- sends one transactional playlist RPC after YouTube metadata is collected.

These controls limit the size of a mistake. They do not decide whether
taxonomy or course selection is academically correct.

## Owner inputs

Before a sample import, supply:

1. YouTube channel ID.
2. Exact playlist ID.
3. Category and learning goal.
4. Subject and existing chapter name.
5. Applicable class levels.
6. Content type, language, and difficulty.
7. Teacher attribution review.
8. Reason the playlist belongs in the directory.

Do not infer missing academic metadata from a title alone.

## Required sequence

### 1. Write-free production plan

Run one playlist at a time:

```powershell
npm run import -- <CHANNEL_ID> `
  --env=production `
  --dry-run `
  --expected-playlists=1 `
  --max-playlists=5 `
  --playlist-id=<PLAYLIST_ID> `
  --category=<CATEGORY> `
  --goal=<GOAL> `
  --subject=<SUBJECT> `
  --chapter=<EXISTING_CHAPTER> `
  --classes=<CLASSES> `
  --content-type=<TYPE> `
  --language=<LANGUAGE> `
  --difficulty=<DIFFICULTY> `
  --teacher=<TEACHER> `
  --audience-focus=<ONE_APPLICABLE_CLASS>
```

Review `../outputs/ingestion-dry-run.json`. Stop if the playlist already
exists, the channel differs, usable video count is unexpected, metadata is
uncertain, `chapter.production_blocker` is true, or
`video_validation.production_blocker` is true.

### 2. Disposable-staging sample

Run the same single playlist with `--env=staging` and without `--dry-run`.
Record created and reused counts. Inspect the course through Browse, open the
first and last lessons, check embedded playback, and review taxonomy in the
Manage tab.

Delete or retain the sample according to the staging fixture plan. Never use a
production identifier as an assumed cleanup selector.

### 3. Production readiness

Before a production write:

- complete [backup and restore readiness](backup_restore_readiness.md);
- obtain owner approval for the exact playlist and mapping;
- confirm the dry-run report matches the reviewed mapping;
- confirm the chapter reference already exists;
- record expected course, video, and membership changes;
- choose rollback and stop thresholds.

The first production batch is one playlist. Increase later batches only after
the previous batch passes post-import checks. Keep `--max-playlists=5` during
the initial rollout even though the importer’s absolute cap is 25.

### 4. Production command

Only after the preceding gates:

```powershell
npm run import -- <CHANNEL_ID> `
  --env=production `
  --confirm-production `
  --expected-playlists=1 `
  --max-playlists=5 `
  <THE SAME REVIEWED MAPPING ARGUMENTS>
```

### 5. Post-import checks

Immediately rerun the two read-only audits and compare them with the baseline.
Then check:

- course and lecture count deltas;
- missing metadata;
- duplicate and overlap candidates;
- class, goal, subject, and chapter placement;
- first and last lesson playback;
- anonymous Browse and search;
- Manage tab lookup;
- frontend error responses.

## Stop criteria

Stop the batch without starting another when any of these occurs:

- actual selected playlist count differs from the approved count;
- source ownership differs;
- a production chapter would need creation without a separately reviewed,
  exact reference-data insert;
- usable video count differs materially from the reviewed plan;
- `video_validation.duplicate_youtube_video_ids` is non-empty;
- any RPC, authorization, or YouTube quota error occurs;
- missing required metadata appears;
- unexpected duplicate containment appears;
- Browse, search, course pages, or playback regress;
- the backup or rollback record is incomplete.

Do not repair a failed batch with blanket metadata scripts. Diagnose the exact
rows and use guarded management operations.
