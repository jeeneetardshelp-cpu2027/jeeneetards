# NEET content readiness index — 2026-07-28

This index consolidates candidates that have passed their recorded mechanical,
taxonomy, and teacher-evidence review. It is **not** production-write
authorization.

The machine-checked source of truth is
`neet-content-readiness-registry-2026-07-28.json`.

## Cleared for a later owner gate

| Group | Courses | Videos | Memberships | New chapters | Additional approval wording |
| --- | ---: | ---: | ---: | ---: | --- |
| Mapped next batch | 10 | 136 | 136 | 0 | Accept principal-chapter mapping for four MISSION 30 manifests |
| Vardaan multi-teacher | 2 | 10 | 10 | 0 | Preserve each exact combined faculty label |
| **Pending total** | **12** | **146** | **146** | **0** | |

These groups are deliberately separate. Approval for one group does not
authorize another, and every actual write remains one playlist at a time with a
fresh anonymous dry-run and post-import stop.

Detailed evidence:

- `pw-neetwallah-next-batch-readiness-2026-07-28.md`
- `vardaan-multiteacher-readiness-2026-07-28.md`
- `raftaar-biology-import-readiness-2026-07-28.md`

## Imported under a completed owner gate

RAFTAAR Biology was imported to production in registry order on 28 July 2026:

| Course ID | Course | Videos | Memberships | Chapters |
| ---: | --- | ---: | ---: | ---: |
| 105 | Chemical Coordination & Integration - BIOLOGY RAFTAAR | 4 | 4 | 0 |
| 106 | Neural Control and Coordination - BIOLOGY RAFTAAR | 6 | 6 | 0 |
| 107 | Anatomy of Flowering Plants - BIOLOGY RAFTAAR | 4 | 4 | 0 |
| **Total** | | **14** | **14** | **0** |

These three entries are retained in the machine registry with
`status: "imported"` and their production course IDs so they cannot be mistaken
for pending candidates.

## Still deferred

- MISSION 30 Zoology has strong external Samapti Ma'am attribution, but the
  importer has no audited external-evidence input.
- MISSION 30 Inorganic Chemistry still lacks direct faculty attribution for all
  exact video IDs.
- MISSION 30 Botany and Botany Mindmap require the separately prepared
  `Molecular Basis of Inheritance` chapter insert before fresh dry-runs.
- Other checked-in manifests retain the blockers recorded in
  `pw-neetwallah-coverage-audit-2026-07-27.md`; presence in `docs/manifests`
  alone does not mean ready.

## Universal pre-write stop

Before any candidate is imported:

1. Obtain explicit owner approval for that exact playlist ID and any
   group-specific wording above.
2. Record a fresh PITR restore-point timestamp within retention.
3. Verify the JEE fingerprint with
   `node src/scripts/verifyJeeIntegrityFingerprint.js`.
4. Repeat its anonymous production dry-run.
5. Import create-only, verify, and stop before the next playlist.

This gate applies only to candidates that do not already have
`status: "imported"`. No approval has been recorded for the remaining 12
candidates.
