# NEET next-gate readiness — 28 July 2026

This is preparation evidence only. It authorizes no production write.

## Fresh anonymous production dry-runs

| Candidate | Published | Usable | Existing course | Current result | Exact blocker |
| --- | ---: | ---: | --- | --- | --- |
| MISSION 30 Botany | 10 | 10 | No | Blocked | Missing canonical `Molecular Basis of Inheritance` chapter |
| Botany Mindmap | 15 | 15 | No | Blocked | Missing canonical `Molecular Basis of Inheritance` chapter |
| MISSION 30 Zoology | 10 | 10 | No | Blocked | No importer-accepted teacher attribution |
| MISSION 30 Inorganic Chemistry | 5 | 5 | No | Blocked | No importer-accepted teacher attribution |

All four source counts still match their reviewed manifests. No production write
was attempted.

## Smallest next batch

The two Botany manifests form the smallest mechanically complete next batch:

- 2 courses
- 25 videos
- 25 memberships
- 1 prerequisite canonical chapter

The chapter prerequisite has a create-only, fail-closed SQL plan at
`docs/sql/add_molecular_basis_chapter_production_2026-07-28.sql`. After course
119, its baseline was rebased to:

```text
112 courses
1,621 videos
1,625 memberships
123 chapters
83 JEE courses
JEE fingerprint d7aae3ce7635401ebeffe97e627048bc
```

The plan remains **prepared only**. Before it can run:

1. record a fresh post-course-119 PITR restore point;
2. obtain a separate owner gate for the one-row chapter insert;
3. execute the guarded create-only plan and verify 124 chapters;
4. rerun both anonymous Botany dry-runs;
5. import one course at a time with immediate JEE fingerprint checks.

Zoology and Inorganic Chemistry remain deferred. Their faculty hypotheses are
not a substitute for evidence accepted by the importer, and the quality gate
must not be bypassed.
