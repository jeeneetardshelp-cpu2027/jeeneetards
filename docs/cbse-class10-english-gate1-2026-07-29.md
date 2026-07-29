# CBSE Class 10 English - Gate 1 evidence

Gate 1 was owner-approved and applied to production on 29 July 2026. Gate 2
content drafting and import were not started.

## Artifact and safety

- Applied artifact:
  `docs/sql/add_cbse_class10_english_reference_2026-07-29.sql`.
- SHA-256:
  `778a72cfe1be40bb0dced9fb9def21e8d2aee0fa4dfd83b317afbad0687ee295`.
- The guarded transaction inserted exactly one subject and 16 chapters.
- It contained no update, delete, alter, drop, truncate, content import, schema
  migration, or deployment.
- The artifact test passed all 3 checks before the production write.

## Fresh preflight

- Catalogue: 151 playlists, 1,923 videos, 1,927 memberships, 169 chapters.
- CBSE board: ID 1, slug `cbse`.
- School learning goal: present, ID 4, slug `school`.
- Production `app_environment`: empty, as required.
- `English` subject name/slug collisions: zero.
- Exact-name collisions across the 16 reviewed chapters: zero.
- Protected JEE catalogue: 83 courses and 1,307 memberships.
- Protected JEE fingerprint:
  `d7aae3ce7635401ebeffe97e627048bc`.

## Postflight

- Created subject: `English`, ID 11, slug `english`, display order 7.
- Created chapters: exactly 16, IDs 226 through 241, in the reviewed order.
- Total chapters: 185.
- Content rows remained unchanged: 151 playlists, 1,923 videos, and 1,927
  memberships.
- JEE remained exactly 83 courses and 1,307 memberships.
- Protected JEE fingerprint remained
  `d7aae3ce7635401ebeffe97e627048bc`.

Gate 1 passed. Stop here for owner verification before drafting or importing
the Gate 2 English course.
