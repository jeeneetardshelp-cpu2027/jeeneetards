# Competishun+ JEE Advanced Practice Series Mathematics import evidence — 2026-07-31

## Scope

- Channel: Competishun+ (`UC6ieIswHA9WInRsa2r88hRw`)
- Playlist: `PLQsNiHo64JI92nFYMSfOhGrq7bct9haT3`
- Title: `JEE Advanced Practice Series`
- Category/goal: JEE / JEE
- Subject: Mathematics
- Classes: `11th`, `12th`, `Dropper`
- Content type: `practice`
- Language: `hinglish`
- Difficulty: `advanced`
- Attribution decision: `1c06eb34-fbdc-4d3b-a239-39f256f889e8`

## Review decision

The source playlist is mixed subject content. The import was scoped to the first five Mathematics lectures only. The five Chemistry lectures were explicitly excluded from this Mathematics course and should be handled separately if needed.

Manifest:

- `docs/manifests/competishun-plus-jee-advanced-practice-series-math-reviewed.json`

## Dry-run

Command:

```powershell
npm.cmd run import -- UC6ieIswHA9WInRsa2r88hRw --env=production --dry-run --expected-playlists=1 --max-playlists=5 --playlist-id=PLQsNiHo64JI92nFYMSfOhGrq7bct9haT3 --category=JEE --goal=JEE --subject=Mathematics --classes=11th,12th,Dropper --content-type=practice --language=hinglish --difficulty=advanced --teacher="Competishun+" --audience-focus=Dropper --chapter-manifest=docs/manifests/competishun-plus-jee-advanced-practice-series-math-reviewed.json --confirm-teacher-evidence=1c06eb34-fbdc-4d3b-a239-39f256f889e8
```

Result:

- Quality gate: `1 ok / 0 review / 0 blocked`
- Supabase writes: none

## Import

Command:

```powershell
npm.cmd run import -- UC6ieIswHA9WInRsa2r88hRw --env=production --confirm-production --expected-playlists=1 --max-playlists=5 --playlist-id=PLQsNiHo64JI92nFYMSfOhGrq7bct9haT3 --category=JEE --goal=JEE --subject=Mathematics --classes=11th,12th,Dropper --content-type=practice --language=hinglish --difficulty=advanced --teacher="Competishun+" --audience-focus=Dropper --chapter-manifest=docs/manifests/competishun-plus-jee-advanced-practice-series-math-reviewed.json --confirm-teacher-evidence=1c06eb34-fbdc-4d3b-a239-39f256f889e8
```

Result:

- Course created: `248`
- Videos added: `5`
- Videos reused: `0`
- Lessons/memberships added: `5`
- Chapters created: `0`

Imported videos:

| Position | YouTube id | Duration | Embedding | Chapter | Title |
|---:|---|---:|---|---|---|
| 1 | `bBilbxPk6xc` | `777` | `embeddable` | Permutations and Combinations | `JEE Advanced Practice Series \| Permutation and Combination \| Multinomial Theorem \| Multiple Correct` |
| 2 | `JwOZdiIQYxU` | `1119` | `embeddable` | Differential Equations | `JEE Advanced Practice Series\|Differential Equation\|Function added with its derivative\|Comprehension` |
| 3 | `Ygtka3DN0dI` | `604` | `embeddable` | Application of Integrals | `JEE Advanced Practice Series Area Under Curve Find Parameter to Minimize Area` |
| 4 | `eELR9jtUijE` | `1473` | `embeddable` | Complex Numbers | `JEE Advanced Practice Series \| Geometry of Complex Number \| Rohit Soni Sir` |
| 5 | `YTSVd8z5Muo` | `1096` | `embeddable` | Probability | `JEE Advanced Practice Series \| Conditional Probability \| Comprehension` |

Excluded videos:

| Source position | YouTube id | Reason |
|---:|---|---|
| 6 | `g-Fa0TIitRc` | Chemistry practice lecture; excluded from the Mathematics course. |
| 7 | `oWxR8SdYllY` | Chemistry practice lecture; excluded from the Mathematics course. |
| 8 | `L4dnuL2EAfY` | Chemistry practice lecture; excluded from the Mathematics course. |
| 9 | `25WiaWXrh_A` | Chemistry practice lecture; excluded from the Mathematics course. |
| 10 | `1yIPYj0vEdk` | Chemistry practice lecture; excluded from the Mathematics course. |

## Post-import verification

- Catalogue totals: `241 playlists / 2570 videos / 2576 memberships / 240 chapters`
- Protected original JEE set: `83 courses / 1350 memberships`
- Protected fingerprint: `6829fcb6eae22479db7b82b7b3da654d`
- Protected fingerprint matched: yes
- Rolling JEE count: `158 courses / 1847 memberships`
- Rolling JEE fingerprint: `4e3e6211d1c8844facc38543768b4fb8`
- Course goal: `jee`
- Course metadata: `Competishun+`, `practice`, `hinglish`, `advanced`, `Dropper`, classes `11th`, `12th`, `Dropper`
