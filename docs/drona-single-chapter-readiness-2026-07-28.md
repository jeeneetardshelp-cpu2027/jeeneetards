# Drona single-chapter readiness — 28 July 2026

This is preparation evidence only. Production remained read-only throughout
this pass. These sources use the legacy single-chapter importer; they must not
be wrapped in mapped-v12 manifests.

## Fresh anonymous production dry-runs

All 15 candidates resolved their selected production chapter, matched their
advertised public/usable count, and reported no duplicate YouTube video IDs,
embedding failure, duration failure, or existing-course collision.

| Candidate | Playlist ID | Teacher | Videos | Result |
| --- | --- | --- | ---: | --- |
| Electromagnetic Induction | `PLJyab0VQDBGXzCh7NwnQEnXYLRMV9wSla` | Tanuj Bansal | 6 | Review: external teacher evidence |
| Biotechnology: Principles and Processes | `PLJyab0VQDBGVqxcvq_VqtOHpoDfzfBoIB` | Dr. Roopali | 6 | Review: external teacher evidence |
| Molecular Basis of Inheritance | `PLJyab0VQDBGWCGQkb-8wrQJdh7EvXNdtM` | Agrim Jain | 10 | Review: external teacher evidence |
| Human Health and Disease | `PLJyab0VQDBGWN8QnBrfxPmaX7WWBvi22V` | Dr. Roopali | 13 | Review: external teacher evidence |
| Coordination Compounds | `PLJyab0VQDBGXflguPIC4vklng-7D_wtts` | Ashima Gupta | 12 | Review: external teacher evidence |
| Capacitance | `PLJyab0VQDBGXLJYAQRLedz4iJjRxw4qEi` | Tanuj Bansal | 6 | Review: external teacher evidence |
| Reproductive Health | `PLJyab0VQDBGXa_iYaCbI5yJ25Kfvwz_dk` | Dr. Roopali | 6 | Review: external teacher evidence |
| The d- and f-Block Elements | `PLJyab0VQDBGXhPpBCKHlCuR5qsWkZwCAT` | Ashima Gupta | 7 | Review: external teacher evidence |
| Principles of Inheritance and Variation | `PLJyab0VQDBGXGaYdcYBC8ZOQq-ZitUL-P` | Agrim Jain | 11 | Review: external teacher evidence |
| Current Electricity | `PLJyab0VQDBGVqDUpQ3xLlL2KFl0CZMYhA` | Tanuj Bansal | 11 | Review: external teacher evidence |
| Electrochemistry | `PLJyab0VQDBGXOmXNsC_H6Ii6nQJPIILSb` | Sudhanshu Kumar | 8 | Review: external teacher evidence |
| Electrostatic Potential and Capacitance | `PLJyab0VQDBGUFqZpshfgty11OX8WS0WvW` | Tanuj Bansal | 6 | Review: external teacher evidence |
| Sexual Reproduction in Flowering Plants | `PLJyab0VQDBGW5tFTk-eCnDsl1wyH2UO9q` | Agrim Jain | 8 | Review: external teacher evidence |
| Human Reproduction | `PLJyab0VQDBGWlXkQ5QiSwCLqtxUgZXx4M` | Dr. Roopali | 14 | Review: external teacher evidence |
| Electric Charges and Fields | `PLJyab0VQDBGX58f2BxRhi6yMSOVMqEro0` | Tanuj Bansal | 14 | OK: source teacher evidence accepted |

Expected additive delta if all 15 are later approved and imported:

```text
courses: +15
videos: +138
memberships: +138
chapters: +0
existing courses updated/deleted: 0
```

The 14 review results are not mechanical defects. Their YouTube metadata omits
the instructor name, so the importer correctly requires the already-completed
external faculty review to be accepted explicitly by the owner before writes.

## Validator regression fixed

The Coordination Compounds dry-run initially reported false duplicate lesson
numbers `1, 2`. Its authoritative sequence is the number before the first pipe,
for example:

```text
Coordination Compounds 04 | Valence Bond Theory (Part-1) | Class 12th/NEET
```

The parser had ignored `04` and treated the internal subseries `Part-1` as the
playlist lesson number. The classifier now reads the first pipe-delimited
sequence before falling back to an internal part label. The regression test
covers this exact title shape. After the fix, Coordination Compounds reports 12
usable videos, zero mechanical blockers, and only the teacher-evidence review.

## Remaining deferrals

- Haloalkanes and Haloarenes: the source comments identify `Harshita Ma'am`,
  but a canonical full identity is still unverified.
- Magnetism and Matter: duplicate/missing lesson source defect.
- Magnetic Effects of Current: reversed sequence and missing lecture 2.
- Chemical Kinetics and Solutions: shared combined source video.
- Reproduction in Organisms: canonical chapter remains unavailable.

No production import is authorized by this document. Before any write, rerun
each candidate's anonymous dry-run, record a fresh PITR restore point, obtain an
exact owner approval for this ordered set and its faculty decisions, then
import create-only one playlist at a time with the JEE fingerprint checked
after every course.
