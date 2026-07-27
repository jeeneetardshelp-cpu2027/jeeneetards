# Vardaan multi-teacher readiness — 2026-07-28

This is a read-only readiness record. It does **not** authorize a production
import.

## Decision

No schema or importer change is required to represent these playlists
truthfully in the currently released student UI. The existing `playlists.teacher`
field is displayed as text and accepts an honest combined faculty credit:

- Physics: `Aditya Sir & Rohit Sir`
- Chemistry: `Sarvesh Sir, Pankaj Sir & Amit Sir`

Production already has the normalized `teachers`, `playlist_teachers`, and
`video_teachers` tables, but they are empty and the faculty-registry frontend
capability remains intentionally disabled. Creating unreviewed teacher
identities or adding a new v12 wrapper would add risk without improving the
current public representation. The combined legacy label preserves the source
truth now; normalized faculty links can be added later through their existing
review workflow.

## Fresh anonymous dry-runs

Both mapped v12 production dry-runs used the browser-safe anonymous key and
performed no writes.

| Playlist | YouTube playlist ID | Videos | Chapters | Teacher label | Result |
| --- | --- | ---: | ---: | --- | --- |
| Physics — NEET Vardaan | `PLJyab0VQDBGVD_EF-V55P2-Yx7mS5mete` | 5 | 5 reused | Aditya Sir & Rohit Sir | `ok` |
| Chemistry — NEET Vardaan | `PLJyab0VQDBGXJj0uK_7YRGQcvzyOMEW7_` | 5 | 5 reused | Sarvesh Sir, Pankaj Sir & Amit Sir | `ok` |

For both sources:

- advertised and usable counts matched at 5/5;
- no duplicate video IDs or lesson positions were found;
- every mapped chapter resolved;
- every video had positive duration and embeddable status;
- neither playlist nor any of its videos exists in production;
- quality returned `ok`, with zero review or blocking findings.

Evidence hashes:

| Playlist | Manifest SHA-256 | Source snapshot SHA-256 |
| --- | --- | --- |
| Physics | `d56ba53e3268646e36ef635d8c333da1dc1e44957d492dfc064c0a920ccca333` | `fe8e7c8c220014b0495c0ef6f0702413aaa7400049a9fc5a2087967090cd822a` |
| Chemistry | `08e80b56c98110757ae86c660e3ba90368c8a4ab98761b053cc69aa0d4aec037` | `192777666df802cc004a71949f9a5716fd0de509723a317ad85ac406fa83c769` |

Combined expected delta if both are later approved and still pass fresh
dry-runs: **+2 courses, +10 videos, +10 memberships, and 0 chapters**.

The post-dry-run JEE check remained 83 courses and 1,307 memberships with
fingerprint `d7aae3ce7635401ebeffe97e627048bc`.

## Required write gate

For a later production import:

1. Owner approval must name one playlist ID and its exact combined teacher
   label.
2. Record a fresh PITR restore-point timestamp within retention.
3. Run `node src/scripts/verifyJeeIntegrityFingerprint.js`.
4. Repeat that playlist's anonymous dry-run using the same reviewed metadata.
5. Import one playlist create-only, then stop for exact delta, anonymous browse,
   first/last lesson, teacher-label, learning-goal, and JEE-integrity checks.

Do not populate normalized teacher tables as part of this content gate, and do
not replace a combined credit with a single teacher.
