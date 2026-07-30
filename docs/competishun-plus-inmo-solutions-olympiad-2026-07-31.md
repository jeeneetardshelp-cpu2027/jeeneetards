# Competishun+ INMO 2023 import evidence — 2026-07-31

## Scope

- Channel: Competishun+ (`UC6ieIswHA9WInRsa2r88hRw`)
- Playlist: `PLQsNiHo64JI-BEQ0OHiRCD7VB12grV7f9`
- Title: `INMO 2023`
- Category/goal: Olympiad / Olympiad
- Subject: Mathematics
- Chapter: `INMO Solutions`
- Classes: `11th`, `12th`, `Dropper`
- Content type: `pyq`
- Language: `hinglish`
- Difficulty: `advanced`
- Attribution decision: `1c06eb34-fbdc-4d3b-a239-39f256f889e8`

## Additive reference data

- Created chapter: `INMO Solutions`
- Chapter id: `296`
- Subject: Mathematics (`id 3`)
- Chapter-only count change:
  - playlists: `239 -> 239`
  - videos: `2564 -> 2564`
  - memberships: `2570 -> 2570`
  - chapters: `239 -> 240`

## Dry-run

Command:

```powershell
npm.cmd run import -- UC6ieIswHA9WInRsa2r88hRw --env=production --dry-run --expected-playlists=1 --max-playlists=5 --playlist-id=PLQsNiHo64JI-BEQ0OHiRCD7VB12grV7f9 --category=Olympiad --goal=Olympiad --subject=Mathematics --classes=11th,12th,Dropper --content-type=pyq --language=hinglish --difficulty=advanced --teacher="Competishun+" --audience-focus=Dropper --chapter="INMO Solutions" --confirm-teacher-evidence=1c06eb34-fbdc-4d3b-a239-39f256f889e8
```

Result:

- Quality gate: `1 ok / 0 review / 0 blocked`
- Supabase writes: none

## Import

Command:

```powershell
npm.cmd run import -- UC6ieIswHA9WInRsa2r88hRw --env=production --confirm-production --expected-playlists=1 --max-playlists=5 --playlist-id=PLQsNiHo64JI-BEQ0OHiRCD7VB12grV7f9 --category=Olympiad --goal=Olympiad --subject=Mathematics --classes=11th,12th,Dropper --content-type=pyq --language=hinglish --difficulty=advanced --teacher="Competishun+" --audience-focus=Dropper --chapter="INMO Solutions" --confirm-teacher-evidence=1c06eb34-fbdc-4d3b-a239-39f256f889e8
```

Result:

- Course created: `247`
- Videos added: `1`
- Videos reused: `0`
- Lessons/memberships added: `1`
- Chapters created by importer: `0`

Imported video:

| Position | YouTube id | Duration | Embedding | Chapter id | Title |
|---:|---|---:|---|---:|---|
| 1 | `mFBgYVq6H4k` | `2117` | `embeddable` | `296` | `INMO 2023 Problem 1 Solution \| Indian National Mathematics Olympiad \| Praveen Agrawal (PAL Sir)` |

## Post-import verification

- Catalogue totals: `240 playlists / 2565 videos / 2571 memberships / 240 chapters`
- Protected original JEE set: `83 courses / 1350 memberships`
- Protected fingerprint: `6829fcb6eae22479db7b82b7b3da654d`
- Protected fingerprint matched: yes
- Rolling JEE count: `157 courses / 1842 memberships`
- Rolling JEE fingerprint: `5994a847e37d4d5d3cd54bb95a80e8e4`
- Course goal: `olympiad`
- Course metadata: `Competishun+`, `pyq`, `hinglish`, `advanced`, `Dropper`, classes `11th`, `12th`, `Dropper`
