# Mass-ingestion preflight

Use this gate before adding catalogue content in batches. It prepares an
import; it does not authorize one.

## Baseline recorded on 25 July 2026

- 39 courses and 429 playlist memberships.
- Coverage: JEE Physics plus eight JEE Chemistry courses; 19 Class 11
  courses, 20 Class 12 courses, and 34 Dropper-compatible courses.
- Core metadata missing from 0 courses.
- Fully contained duplicate candidates: 0.
- Registered source channel: Mohit Tyagi.
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
- Nuclear Physics is intentionally excluded: its source playlist repeats a
  YouTube video ID and is blocked before any database write.
- X-rays is intentionally deferred because its playlist spans multiple
  curriculum concepts and needs an explicit chapter-placement decision.
- Gravitation and SHM are deferred because their usable video counts are lower
  than their published playlist counts. Circular Motion and KTG are deferred
  because their source lesson ordering is inconsistent.
- Fluid Mechanics is deferred because its source lesson ordering is also
  inconsistent.
- Viscosity is deferred because its first two source lessons are reversed.
  Sound Waves is deferred because its source sequence is inconsistent and it
  includes an existing Wave Optics video.
- Ray Optics is blocked because its source repeats one video, duplicates lesson
  number 36, and includes a Unit and Dimension lesson. Wave on String is
  deferred because lessons 6, 7, and 8 are out of source order.
- Mole Concept and IUPAC are deferred because each source playlist exposes one
  lesson out of sequence. Environmental Chemistry is deferred until the
  remaining teacher-attribution gap is reviewed.
- General Inorganic Chemistry is deferred because the quick video-metadata pass
  did not expose direct teacher-attribution evidence.

Regenerate the read-only baseline immediately before every batch:

```powershell
npm run audit:production-catalog
npm run audit:ingestion -- --env=production
```

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
