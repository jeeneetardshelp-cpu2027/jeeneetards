# Competishun+ Irodov Kinematics import evidence — 2026-07-31

## Scope

- Channel: Competishun+ (`UC6ieIswHA9WInRsa2r88hRw`)
- Playlist: `PLQsNiHo64JI-IvP2tSpRwOx518UTl71B0`
- Title: `Irodov Solutions`
- Category/goal: JEE / JEE
- Subject/chapter: Physics / `Kinematics` (`id 1`)
- Classes: `11th`, `12th`, `Dropper`
- Content type: `practice`
- Attribution decision: `1c06eb34-fbdc-4d3b-a239-39f256f889e8`

## Reviewed selection

The playlist advertises 71 entries and currently exposes 70 usable videos.

- Selected: 26 unused solutions for Irodov problems `1.2–1.27`
- Natural lesson order: `1.2, 1.3, ... 1.27`
- Excluded: 43 videos already present in the live catalogue
- Excluded: one second upload for problem `1.55`, because that problem is already represented by another catalogued video
- Planned reuse: `0`

Problem `1.27` is indexed under Irodov Kinematics, and the problem sequence through `1.27` belongs to that section. The separate problem `1.55` concerns rotating bodies and was not imported in this Kinematics subset.

Mapping references:

- `https://solveirodov.com/problems/1-27`
- `https://irodovsolutionsmechanics.blogspot.com/2007/08/problem-155.html`

Reviewed manifest: `docs/manifests/competishun-plus-irodov-kinematics-reviewed.json`

## Pre-import gates

- Catalogue totals: `287 playlists / 3045 videos / 3051 memberships / 241 chapters`
- Source playlist already present: no
- Selected video IDs already present: `0 of 26`
- Protected original JEE set: `83 courses / 1350 memberships`
- Protected fingerprint: `6829fcb6eae22479db7b82b7b3da654d`
- Rolling JEE catalogue: `162 courses / 1851 memberships`
- Rolling fingerprint: `a7a4aa4c85027553e13ec54ea226d973`

Anonymous dry-run:

- Quality gate: `1 ok / 0 review / 0 blocked`
- Usable source videos accounted for: `70`
- Supabase writes: none

## Import

Command:

```powershell
npm.cmd run import -- UC6ieIswHA9WInRsa2r88hRw --env=production --confirm-production --expected-playlists=1 --max-playlists=5 --playlist-id=PLQsNiHo64JI-IvP2tSpRwOx518UTl71B0 --category=JEE --goal=JEE --subject=Physics --classes=11th,12th,Dropper --content-type=practice --language=hinglish --difficulty=advanced --teacher="Competishun+" --audience-focus=Dropper --chapter-manifest=docs/manifests/competishun-plus-irodov-kinematics-reviewed.json --confirm-teacher-evidence=1c06eb34-fbdc-4d3b-a239-39f256f889e8
```

- Course created: `298`
- Videos added: `26`
- Videos reused: `0`
- Lessons/memberships added: `26`
- Chapters created: `0`

## Post-import verification

- Catalogue totals: `288 playlists / 3071 videos / 3077 memberships / 241 chapters`
- Course goal: `jee`
- Lesson count: `26`
- Natural problem order `1.2–1.27`: verified
- All lessons mapped to `Kinematics`: yes
- All lessons embeddable: yes
- First lesson: `EFvBf862VVU`, problem `1.2`, `284s`
- Last lesson: `YACz6TX8_Vs`, problem `1.27`, `133s`
- Protected original JEE set: `83 courses / 1350 memberships`
- Protected fingerprint: `6829fcb6eae22479db7b82b7b3da654d`
- Protected fingerprint matched: yes
- Rolling JEE catalogue: `163 courses / 1877 memberships`
- Rolling fingerprint: `e01c1ccb77087528656871f9f32fa030`

No existing video was reused and the protected original JEE catalogue remained unchanged.
