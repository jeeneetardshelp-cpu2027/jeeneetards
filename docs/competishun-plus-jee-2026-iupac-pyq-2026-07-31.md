# Competishun+ JEE 2026 IUPAC PYQ import evidence — 2026-07-31

## Scope

- Channel: Competishun+ (`UC6ieIswHA9WInRsa2r88hRw`)
- Playlist: `PLQsNiHo64JI9ID8qNxB0yOEd0x8HbzkIq`
- Source title: `JEE 2026`
- Category/goal: JEE / JEE
- Subject: Chemistry
- Chapter: `Some Basic Principles of Organic Chemistry` (`id 96`)
- Classes: `11th`, `12th`, `Dropper`
- Content type: `pyq`
- Attribution decision: `1c06eb34-fbdc-4d3b-a239-39f256f889e8`

## Reviewed source selection

The official playlist contains 12 usable videos. The reviewed manifest retains only source position 6, the 63-minute IUPAC PYQ lecture, as lesson 1. The JoSAA/counselling, strategy, batch, test-series and revision-guidance videos are excluded. Source position 8 is an already-catalogued Physics X-ray lecture and is explicitly excluded to preserve zero reuse.

Manifest: `docs/manifests/competishun-plus-jee-2026-iupac-pyq-reviewed.json`

## Pre-import verification

- Catalogue totals: `285 playlists / 3039 videos / 3045 memberships / 241 chapters`
- Candidate video `TbAYRp5R_BM` already present: no
- Source playlist already present: no
- Protected original JEE set: `83 courses / 1350 memberships`
- Protected fingerprint: `6829fcb6eae22479db7b82b7b3da654d`
- Rolling JEE catalogue: `161 courses / 1850 memberships`
- Rolling fingerprint: `b3a66357ba3800d8c7adc25ae7547b70`

## Dry-run

Command:

```powershell
npm.cmd run import -- UC6ieIswHA9WInRsa2r88hRw --env=production --dry-run --expected-playlists=1 --max-playlists=5 --playlist-id=PLQsNiHo64JI9ID8qNxB0yOEd0x8HbzkIq --category=JEE --goal=JEE --subject=Chemistry --classes=11th,12th,Dropper --content-type=pyq --language=hinglish --difficulty=advanced --teacher="Competishun+" --audience-focus=Dropper --chapter-manifest=docs/manifests/competishun-plus-jee-2026-iupac-pyq-reviewed.json --confirm-teacher-evidence=1c06eb34-fbdc-4d3b-a239-39f256f889e8
```

Result:

- Quality gate: `1 ok / 0 review / 0 blocked`
- Supabase writes: none

## Import and postflight

The same command was run with `--confirm-production` in place of `--dry-run`.

- Course created: `296`
- Videos added: `1`
- Videos reused: `0`
- Lessons/memberships added: `1`
- Chapters created: `0`
- Imported video: `TbAYRp5R_BM` — `JEE Advanced Chemistry PYQs | IUPAC | Must Know Every PYQ Pattern!`
- Duration: `3780s`
- Embedding status: `embeddable`
- Course goal: `jee`

Post-import catalogue:

- Totals: `286 playlists / 3040 videos / 3046 memberships / 241 chapters`
- Protected original JEE set: `83 courses / 1350 memberships`
- Protected fingerprint: `6829fcb6eae22479db7b82b7b3da654d`
- Protected fingerprint matched: yes
- Rolling JEE catalogue: `162 courses / 1851 memberships`
- Rolling fingerprint: `a7a4aa4c85027553e13ec54ea226d973`

No existing video was reused and the protected original JEE catalogue remained unchanged.
