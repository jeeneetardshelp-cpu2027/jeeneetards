# PW NEET Wallah next-batch readiness — 2026-07-28

This is a read-only reconciliation of the next mapped NEET candidates. It does
**not** authorize a production import.

## Candidate batch

| Order | Manifest | YouTube playlist ID | Teacher | Videos | Canonical chapters |
| ---: | --- | --- | --- | ---: | ---: |
| 1 | `neet-mission-30-organic-chemistry` | `PLJyab0VQDBGUlZybgOULmNV1vbvWmUGxn` | Pankaj Sijariya | 8 | 5 |
| 2 | `neet-mission-30-physical-chemistry` | `PLJyab0VQDBGUUcdtuWiyx9PdkSUEu5zEi` | Amit Mahajan | 7 | 7 |
| 3 | `neet-mission-30-class-12-physics` | `PLJyab0VQDBGWvRw8liU4B8s-OB75jv-og` | Manish Raj | 11 | 9 |
| 4 | `neet-mission-30-class-11-physics` | `PLJyab0VQDBGWnC3N-wwV4Og_UB6FQk9f5` | Saleem Sir | 10 | 10 |
| 5 | `neet-skc-organic-chemistry-one-shot` | `PLJyab0VQDBGXKoJSUTVlNj37J5AZ3DS-m` | SKC Sir | 10 | 6 |
| 6 | `neet-pankaj-organic-chemistry-class-11` | `PLJyab0VQDBGXZ4w4AWoB_fLzoRRyXhBse` | Pankaj Sijariya | 8 | 3 |
| 7 | `neet-aayudh-mechanics-one-shot` | `PLJyab0VQDBGWjCjKZ0lslIfdINtObB3Dd` | Aayudh Sir | 14 | 8 |
| 8 | `neet-good-morning-physics-abhishek-verma` | `PLJyab0VQDBGUMa1ndqTTm2295o939H51g` | Abhishek Verma Sir | 25 | 21 |
| 9 | `neet-physical-chemistry-mindmap-sudhanshu` | `PLJyab0VQDBGWQ3XjCBXxvttq1McW4yQfi` | Sudhanshu Sir | 10 | 10 |
| 10 | `neet-physics-mindmap-siddharth` | `PLJyab0VQDBGXTDms0LZOP4VfBlGVkPd0S` | Siddharth Sir | 33 | 23 |

Combined expected delta if all ten are later approved and still pass fresh
dry-runs: **+10 courses, +136 videos, +136 memberships, and 0 chapters**.

## Reconciliation evidence

At `2026-07-28 00:25:05 +05:30`, anonymous production reads confirmed:

- None of the ten YouTube playlist IDs exists in the catalogue.
- None of the 136 mapped video IDs exists in the catalogue.
- The manifests contain 136 unique video IDs with no cross-candidate overlap.
- All 136 assignments reference canonical chapters that resolved during the
  recorded anonymous dry-runs.
- Production remains at 97 courses, 1,461 videos, 1,465 memberships, and 123
  chapters: 83 JEE courses and 14 NEET courses.
- JEE remains 83 courses and 1,307 memberships with fingerprint
  `d7aae3ce7635401ebeffe97e627048bc`.

The earlier audit records the source-count, ordering, duplicate, embedding,
teacher-evidence, and chapter-resolution results for each candidate. Those
results are readiness evidence, not a substitute for a fresh per-manifest
dry-run immediately before any approved write.

## Editorial limitation requiring explicit acceptance

Several MISSION 30 videos discuss more than one chapter. Import capability v12
records exactly one canonical chapter per video. The checked-in manifests use
the leading or principal chapter, preserve every source video, and do not
duplicate videos, but secondary chapters do not receive an additional browse
membership.

An owner approval for this batch must explicitly accept that limitation.
Otherwise, keep the MISSION 30 candidates deferred until multi-chapter video
taxonomy exists.

## Required write gate

If this batch is later authorized:

1. Name the approved manifest(s) and order explicitly.
2. Record a fresh PITR restore-point timestamp within retention.
3. Run `node src/scripts/verifyJeeIntegrityFingerprint.js`.
4. Run a fresh anonymous dry-run for one manifest.
5. Import that one manifest create-only, then stop and verify its exact delta,
   learning goal, anonymous browse visibility, first/last lesson playback, and
   unchanged JEE fingerprint before proceeding.

Stop on any playlist/video overlap, count change, unavailable or non-embeddable
video, teacher-evidence regression, unresolved chapter, duplicate, or JEE
fingerprint mismatch. No frontend release push is part of this gate.
