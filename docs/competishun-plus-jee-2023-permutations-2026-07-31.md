# Competishun+ JEE 2023 permutations import evidence — 2026-07-31

## Scope

- Channel: Competishun+ (`UC6ieIswHA9WInRsa2r88hRw`)
- Playlist: `PLQsNiHo64JI8Lc2MuxUNTAmzEBsL01_wl`
- Source title: `JEE 2023`
- Category/goal: JEE / JEE
- Subject: Mathematics
- Chapter: `Permutations and Combinations` (`id 67`)
- Classes: `11th`, `12th`, `Dropper`
- Content type: `practice`
- Attribution decision: `1c06eb34-fbdc-4d3b-a239-39f256f889e8`

## Reviewed source selection

The official playlist contains three videos. The reviewed manifest keeps only the curriculum lecture at source position 3 and preserves it as lesson 1:

- Kept: `SzQML9dBVck` — `Jee Advanced Practice 2023| Total Permutation of 8 digit numbers using 0,2,3,4,20,34`
- Excluded: `sNYVy-g-YGU` — open-test announcement
- Excluded: `MRlqf2COE_g` — batch promotion and preparation guidance

Manifest: `docs/manifests/competishun-plus-jee-2023-permutations-reviewed.json`

## Pre-import verification

- Catalogue totals: `284 playlists / 3038 videos / 3044 memberships / 241 chapters`
- Source playlist already present: no
- All three source video IDs already present: no
- Protected original JEE set: `83 courses / 1350 memberships`
- Protected fingerprint: `6829fcb6eae22479db7b82b7b3da654d`
- Rolling JEE catalogue: `160 courses / 1849 memberships`
- Rolling fingerprint: `6e95dfff7c5ba9f97c8d954d9218d43c`

## Dry-run

Command:

```powershell
npm.cmd run import -- UC6ieIswHA9WInRsa2r88hRw --env=production --dry-run --expected-playlists=1 --max-playlists=5 --playlist-id=PLQsNiHo64JI8Lc2MuxUNTAmzEBsL01_wl --category=JEE --goal=JEE --subject=Mathematics --classes=11th,12th,Dropper --content-type=practice --language=hinglish --difficulty=advanced --teacher="Competishun+" --audience-focus=Dropper --chapter-manifest=docs/manifests/competishun-plus-jee-2023-permutations-reviewed.json --confirm-teacher-evidence=1c06eb34-fbdc-4d3b-a239-39f256f889e8
```

Result:

- Quality gate: `1 ok / 0 review / 0 blocked`
- Supabase writes: none

## Import and postflight

The same command was run with `--confirm-production` in place of `--dry-run`.

- Course created: `295`
- Videos added: `1`
- Videos reused: `0`
- Lessons/memberships added: `1`
- Chapters created: `0`
- Imported video duration: `752s`
- Embedding status: `embeddable`
- Course goal: `jee`

Post-import catalogue:

- Totals: `285 playlists / 3039 videos / 3045 memberships / 241 chapters`
- Protected original JEE set: `83 courses / 1350 memberships`
- Protected fingerprint: `6829fcb6eae22479db7b82b7b3da654d`
- Protected fingerprint matched: yes
- Rolling JEE catalogue: `161 courses / 1850 memberships`
- Rolling fingerprint: `b3a66357ba3800d8c7adc25ae7547b70`

No existing video was reused and the protected original JEE catalogue remained unchanged.
