# NEET content readiness index — 2026-07-28

This index consolidates candidates that have passed their recorded mechanical,
taxonomy, and teacher-evidence review. It is **not** production-write
authorization.

The machine-checked source of truth is
`neet-content-readiness-registry-2026-07-28.json`.

## Imported under completed owner gates

| Group | Courses | Videos | Memberships | New chapters | Production course IDs |
| --- | ---: | ---: | ---: | ---: | --- |
| Mapped next batch | 10 | 136 | 136 | 0 | 108–117 |
| Vardaan multi-teacher | 2 | 10 | 10 | 0 | 118–119 |
| RAFTAAR Biology | 3 | 14 | 14 | 0 | 105–107 |
| Botany chapter follow-up | 2 | 25 | 25 | 0 | 120–121 |
| Reviewed-evidence Zoology | 1 | 10 | 10 | 0 | 122 |
| **Imported total** | **18** | **195** | **195** | **0** | **105–122** |

All 12 previously pending candidates were imported to production in registry
order on 28 July 2026. Each passed a fresh anonymous dry-run, create-only mapped
v12 import, and immediate JEE fingerprint verification.

Detailed evidence:

- `pw-neetwallah-next-batch-readiness-2026-07-28.md`
- `vardaan-multiteacher-readiness-2026-07-28.md`
- `raftaar-biology-import-readiness-2026-07-28.md`
- `neet-botany-import-evidence-2026-07-28.md`
- `reviewed-external-teacher-evidence-2026-07-28.md`

### RAFTAAR Biology detail

RAFTAAR Biology was imported to production in registry order on 28 July 2026:

| Course ID | Course | Videos | Memberships | Chapters |
| ---: | --- | ---: | ---: | ---: |
| 105 | Chemical Coordination & Integration - BIOLOGY RAFTAAR | 4 | 4 | 0 |
| 106 | Neural Control and Coordination - BIOLOGY RAFTAAR | 6 | 6 | 0 |
| 107 | Anatomy of Flowering Plants - BIOLOGY RAFTAAR | 4 | 4 | 0 |
| **Total** | | **14** | **14** | **0** |

All 18 entries are retained in the machine registry with `status: "imported"`,
their production course IDs, and exact actual deltas so none can be mistaken
for pending candidates.

## Still deferred

- MISSION 30 Zoology is no longer deferred. It was imported as course 122 under
  reviewed evidence decision `c8cf544a-bd1f-4a2c-9a7e-d8490185a86c`.
- MISSION 30 Inorganic Chemistry still lacks direct faculty attribution for all
  exact video IDs.
- MISSION 30 Botany and Botany Mindmap are no longer deferred. The guarded plan
  created chapter 128, and the courses were imported as IDs 120 and 121.
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

This gate applies only to future candidates that do not already have
`status: "imported"`. The current registry has no pending candidates.
