# Competishun+ GSM definite-integration import evidence — 2026-07-31

## Scope

- Channel: Competishun+ (`UC6ieIswHA9WInRsa2r88hRw`)
- Playlist: `PLQsNiHo64JI9D3U4IWsqm73Yiu_usUdk1`
- Title: `GSM`
- Category/goal: JEE / JEE
- Subject: Mathematics
- Chapter: `Definite Integration` (`id 73`)
- Classes: `12th`, `Dropper`
- Content type: `practice`
- Language: `hinglish`
- Difficulty: `advanced`
- Attribution decision: `1c06eb34-fbdc-4d3b-a239-39f256f889e8`

## Pre-import verification

- Catalogue totals: `283 playlists / 3037 videos / 3043 memberships / 241 chapters`
- Candidate playlist already present: no
- Candidate video `GjIuI399YSE` already present: no
- Protected original JEE set: `83 courses / 1350 memberships`
- Protected fingerprint: `6829fcb6eae22479db7b82b7b3da654d`
- Rolling JEE catalogue: `159 courses / 1848 memberships`
- Rolling fingerprint: `a2cc26928e4a5866a62b4ba3db1cad12`

## Dry-run

Command:

```powershell
npm.cmd run import -- UC6ieIswHA9WInRsa2r88hRw --env=production --dry-run --expected-playlists=1 --max-playlists=5 --playlist-id=PLQsNiHo64JI9D3U4IWsqm73Yiu_usUdk1 --category=JEE --goal=JEE --subject=Mathematics --classes=12th,Dropper --content-type=practice --language=hinglish --difficulty=advanced --teacher="Competishun+" --audience-focus=Dropper --chapter="Definite Integration" --confirm-teacher-evidence=1c06eb34-fbdc-4d3b-a239-39f256f889e8
```

Result:

- Quality gate: `1 ok / 0 review / 0 blocked`
- Usable videos: `1`
- Supabase writes: none

## Import

The same command was run with `--confirm-production` in place of `--dry-run`.

- Course created: `294`
- Videos added: `1`
- Videos reused: `0`
- Lessons/memberships added: `1`
- Chapters created by importer: `0`

Imported lesson:

| Position | YouTube id | Duration | Embedding | Chapter | Title |
|---:|---|---:|---|---|---|
| 1 | `GjIuI399YSE` | `1024s` | `embeddable` | `Definite Integration` (`id 73`) | `Galti Se Mistake 😧\| Definite int from zero to infinity \| Frullani integral` |

## Post-import verification

- Catalogue totals: `284 playlists / 3038 videos / 3044 memberships / 241 chapters`
- Course goal: `jee`
- Course metadata: `Competishun+`, `practice`, `hinglish`, `advanced`, `Dropper`, classes `12th`, `Dropper`
- Protected original JEE set: `83 courses / 1350 memberships`
- Protected fingerprint: `6829fcb6eae22479db7b82b7b3da654d`
- Protected fingerprint matched: yes
- Rolling JEE catalogue: `160 courses / 1849 memberships`
- Rolling fingerprint: `6e95dfff7c5ba9f97c8d954d9218d43c`

No existing video was reused, no chapter was added, and the protected original JEE catalogue remained unchanged.
