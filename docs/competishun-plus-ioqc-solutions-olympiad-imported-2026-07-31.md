# Competishun+ IOQC Solutions import evidence — 2026-07-31

## Scope

- Channel: Competishun+ (`UC6ieIswHA9WInRsa2r88hRw`)
- Playlist: `PLQsNiHo64JI-8-GPMA_RVGhmRN2MVLueU`
- Title: `IOQC 2020-2021 PART-2 SOLUTIONS(INCHO)`
- Category/goal: Olympiad / Olympiad
- Subject: Chemistry
- Chapter: `IOQC Solutions` (`id 295`)
- Classes: `11th`, `12th`, `Dropper`
- Content type: `pyq`
- Attribution decision: `1c06eb34-fbdc-4d3b-a239-39f256f889e8`

## Resolved quality-gate blocker

The reviewed manifest already specified a complete natural lesson sequence `1..5`, but the quality checker re-parsed incidental problem numbers in titles and reported a duplicate `2`. The importer now gives explicit reviewed `lessonNumber` values precedence while preserving title-derived checks for unreviewed playlists. Duplicate reviewed lesson numbers still block.

Validation before the production write:

- Targeted importer tests: `55 passed`
- Full unit suite: `109 files / 1045 tests passed`
- ESLint: passed with zero warnings
- Production build: passed
- Dependency audit: `0 vulnerabilities`
- IOQC anonymous dry-run: `1 ok / 0 review / 0 blocked`

## Pre-import verification

- Catalogue totals: `286 playlists / 3040 videos / 3046 memberships / 241 chapters`
- Source playlist already present: no
- Candidate videos already present: `0 of 5`
- Protected original JEE set: `83 courses / 1350 memberships`
- Protected fingerprint: `6829fcb6eae22479db7b82b7b3da654d`
- Rolling JEE catalogue: `162 courses / 1851 memberships`
- Rolling fingerprint: `a7a4aa4c85027553e13ec54ea226d973`

## Import

Command:

```powershell
npm.cmd run import -- UC6ieIswHA9WInRsa2r88hRw --env=production --confirm-production --expected-playlists=1 --max-playlists=5 --playlist-id=PLQsNiHo64JI-8-GPMA_RVGhmRN2MVLueU --category=Olympiad --goal=Olympiad --subject=Chemistry --classes=11th,12th,Dropper --content-type=pyq --language=hinglish --difficulty=advanced --teacher="Competishun+" --audience-focus=Dropper --chapter-manifest=docs/manifests/competishun-plus-ioqc-solutions-olympiad-reviewed.json --confirm-teacher-evidence=1c06eb34-fbdc-4d3b-a239-39f256f889e8
```

- Course created: `297`
- Videos added: `5`
- Videos reused: `0`
- Lessons/memberships added: `5`
- Chapters created: `0`
- All five videos: `embeddable`
- Course goal: `olympiad`

## Post-import verification

- Catalogue totals: `287 playlists / 3045 videos / 3051 memberships / 241 chapters`
- Protected original JEE set: `83 courses / 1350 memberships`
- Protected fingerprint: `6829fcb6eae22479db7b82b7b3da654d`
- Protected fingerprint matched: yes
- Rolling JEE catalogue: `162 courses / 1851 memberships`
- Rolling fingerprint: `a7a4aa4c85027553e13ec54ea226d973`

The Olympiad import did not alter the JEE catalogue. The five lessons use the official YouTube source order and the reviewed `1..5` lesson sequence.
