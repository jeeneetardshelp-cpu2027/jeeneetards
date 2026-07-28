# CBSE Class 10 Social Science — Gate 1 evidence

Gate 1 was owner-approved and applied to production on 28 July 2026. Gate 2
content drafting/imports and the public Boards launch were not started.

## Recovery and artifact

- PITR active with a seven-day retention period.
- Pre-write latest restore point shown by Supabase:
  `28 Jul 2026, 18:06:30 UTC+05:30`.
- Applied artifact:
  `docs/sql/add_cbse_class10_social_science_reference_2026-07-28.sql`.
- SHA-256:
  `9a3f52f164306791be3d7f7aa0b775f188c17361ad07c58ad2ed5cdc79b675b9`.
- The transaction contained one subject insert and 22 chapter inserts. It
  contained no update, delete, schema migration, content import, or deployment.

## Preflight

- CBSE board: ID `1`, slug `cbse`.
- School learning goal: present, ID `4`, slug `school`.
- `Social Science` subject: absent.
- Exact-name collisions across the 22 reviewed chapters: zero.
- Catalogue baseline: 143 playlists, 1,855 videos, 1,859 memberships, and
  124 chapters.
- Protected JEE fingerprint:
  `d7aae3ce7635401ebeffe97e627048bc`.

## Postflight

- Created subject: `Social Science`, ID `5`, slug `social-science`.
- Created chapters: exactly 22, IDs `129` through `150`.
- Total chapters: 146.
- Content rows remained unchanged: 143 playlists, 1,855 videos, and 1,859
  memberships.
- JEE remained exactly 83 courses and 1,307 memberships.
- Protected JEE fingerprint remained
  `d7aae3ce7635401ebeffe97e627048bc`.

Gate 1 passed. Stop here for owner verification before drafting or importing
the four Gate 2 courses.
