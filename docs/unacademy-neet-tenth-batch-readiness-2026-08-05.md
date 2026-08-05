# Unacademy NEET tenth-batch readiness — 2026-08-05

## Outcome and safety boundary

A fresh read-only scan of all 736 public playlists on the official Unacademy
NEET channel found three complete, unused lecture sequences suitable for the
next gated batch. No production write, schema change, restore, clone, deployment,
or `release` push occurred. The proposed owner decision is
`0fab6ecf-934f-46ae-bb8a-05cbd6b9cea1`.

The scan compared the current YouTube source against production, not the older
candidate snapshot. This caught a material change in the deferred Breathing and
Gas Exchange playlist: it now contains an unrelated Phoenix 2.0 row followed by
Lectures 2–7, with Lecture 1 absent. It remains deferred.

## Fresh read-only production baseline

Captured at `2026-08-05T12:50:58.099Z`:

- catalogue: 391 playlists / 4,566 videos / 4,572 memberships / 263 chapters;
- taxonomy: 92 chapter-class scopes;
- normalized faculty: 32 teachers;
- proposed source-playlist collisions: 0;
- retained production-video collisions: 0;
- cross-candidate retained-video collisions: 0;
- protected original JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`;
- rolling JEE: 212 courses / 2,848 memberships / fingerprint
  `9eea2b44f0b19c08cc0907c57e091342`.

All 12 proposed videos are currently embeddable, have known positive durations,
and map to existing chapters with one exact class scope. Teachers Pradeep Singh
(`33`), Mahendra Singh (`34`), and Anu Gupta (`35`) are verified production
records.

## Proposed lecture-only courses

| Order | Course | Source playlist | Chapter / class | Teacher | Videos | Source snapshot SHA-256 |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | Thermal Properties of Matter | `PLsgHooHkqhhNB7vXo5H5J-QsBotPAPYUR` | 25 / class-11 | Mahendra Singh | 4 | `6aeec2289a3e4d81ba70db1bfbbb9ae93c5183dc6fe63f4d889dc85e9bdd429d` |
| 2 | Electromagnetic Induction | `PLsgHooHkqhhNvpnnFH79_2cZGiXgI3zlt` | 13 / class-12 | Anu Gupta | 3 | `35ba7a705b77a522cf71aac4481b430171bb7aa42762fbeea8d7d6f0e111d5b9` |
| 3 | Plant Growth and Development | `PLsgHooHkqhhOn3bqr2nMVYEGq3Zh5bMDF` | 120 / class-11 | Pradeep Singh | 5 | `d4115cf7c6d4bdc5660dbed3f82300bdd09d3449fab581b5233389c86f9d76bd` |

Every source row is retained in official order. Thermal Properties is a clean
L1–L4 sequence; Electromagnetic Induction is L1–L3; Plant Growth and Development
is L1–L5. There are no quiz, DPP, recap, strategy, or promotional rows in these
three playlists. The first source uses the channel label `Mahendra S.`; the
proposed evidence explicitly normalizes it to verified teacher Mahendra Singh.

## Guarded future execution

This readiness package does not authorize a write. After explicit owner approval,
process the courses one at a time. Before each course: verify active PITR, take a
fresh quiet-window baseline, refresh the official source snapshot, and run the
anonymous mapped dry-run. Import create-only only when source ID reuse, video
reuse, taxonomy review, teacher evidence review, and count shortfall are all
zero. After each import, require the protected original-JEE fingerprint above to
remain exact. Stop on any drift, reuse, source mutation, or other blocker.

## Exact evidence package

- `docs/reviews/unacademy-neet-tenth-candidate-batch-2026-08-05.json`
- `docs/manifests/unacademy-neet-thermal-properties-of-matter-class-11-reviewed.json`
- `docs/manifests/unacademy-neet-electromagnetic-induction-class-12-reviewed.json`
- `docs/manifests/unacademy-neet-plant-growth-and-development-class-11-reviewed.json`

## Proposed approval record

`Approve the reviewed Unacademy NEET tenth batch — Thermal Properties of Matter
(Mahendra Singh, source label Mahendra S.), Electromagnetic Induction (Anu
Gupta), and Plant Growth and Development (Pradeep Singh) — under decision
0fab6ecf-934f-46ae-bb8a-05cbd6b9cea1. Bind the exact playlist-specific teacher
evidence, then import create-only, one at a time, with a fresh PITR/baseline
check and anonymous dry-run before each, and protected original-82 JEE
fingerprint verification after each. Stop on reuse, drift, source mutation, or
any blocker; no release push.`
