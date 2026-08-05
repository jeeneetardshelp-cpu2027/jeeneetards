# Unacademy NEET eighth-batch quality-review readiness - 5 August 2026

## Status

Applied successfully to production once under the owner's exact-hash approval.
The guarded transaction and an independent read-only postflight both passed.
No content import, faculty-registry change, schema migration, restore, clone,
frontend deployment, or `release` push was included.

## Reviewed scope

The package completes the separate quality gate for the three courses imported
under owner evidence decision `809b153c-b5ff-48e0-a869-02faa49b0e8f` after
their normalized faculty links were applied successfully:

| Course | Canonical title | Preserved source title | Instructor |
| ---: | --- | --- | --- |
| 405 | Redox Reactions | Redox Reactions \| Class 11 \| Unacademy NEET \| Anoop Vashishtha | Anoop Vashishtha (36) |
| 406 | Cell Organelles | NEET: Cell Organelles Playlist \| Class 11 \| Unacademy NEET \| Live Daily 2.0 \| Pradeep Singh | Pradeep Singh (33) |
| 407 | Molecular Basis of Inheritance | NEET: Molecular Basis of Inheritance - Playlist \| Class 12 \| Unacademy NEET \| Live Daily 2.0 \| NEET Biology \| Pradeep Singh | Pradeep Singh (33) |

The canonical title `Cell Organelles` describes the source course; its lessons
remain mapped to the already-reviewed chapter `Cell: The Unit of Life`. The
quality transition does not change chapters, lessons, memberships, goals, class
scope, or teacher links.

## Fresh read-only production snapshot

- catalogue: 388 playlists / 4,539 videos / 4,545 memberships / 247 chapters;
- chapter-class scopes: 92;
- faculty registry: 32 teachers / 50 aliases / 33 institute links / 33 subject
  links / 32 learning-goal links / 143 course links;
- quality reviews: 11, with zero reviews for courses 405-407;
- course lesson counts: 7 / 9 / 9, with no retained video reuse;
- all three courses still have a null `source_title`, `pending` title review,
  `pending` faculty credit, and their exact `full-course` / `hinglish` /
  `intermediate` metadata;
- exact instructor links are present: course 405 -> teacher 36 and courses
  406-407 -> teacher 33, all at instructor position 1;
- all three carry only the `neet` learning goal and the reviewed class scope;
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

The API role correctly cannot execute the privileged
`playlist_quality_missing` helper. The artifact checks that helper and the
canonical v10 review capability inside the guarded postgres transaction; no
permission was weakened for preparation.

## Immutable applied artifact

- SQL: `docs/sql/unacademy_neet_eighth_batch_quality_review_2026-08-05.sql`;
- SHA-256: `1f3e6d902eea43660977777b4b2843e4d737cfd5b0a9374d10ad7ee79555806e`;
- production target: `kezelafqhgqrprpadmlf`;
- expected transition: preserve three raw source titles, approve three
  canonical titles, identify the already-linked faculty, and append three
  immutable quality-review rows;
- expected quality-review count: 11 -> 14;
- expected catalogue, taxonomy, registry, teacher-link, and protected-JEE
  delta: zero.

The SQL is a single transaction. It aborts on any catalogue, taxonomy, faculty,
target-course, source-ID, membership, class, learning-goal, review-state,
teacher-link, capability, or protected-fingerprint mismatch. Its only direct
table update captures the three null source titles; canonical title and status
changes use `review_playlist_quality`. Postflight verifies every before/after
audit field and rejects duplicate quality-review rows before commit.

## Local validation

- production-shaped PGlite rehearsal: the transaction completed atomically,
  preserved all catalogue and teacher-link totals, and changed quality reviews
  from 11 to 14;
- target result: three canonical titles, three exact preserved source titles,
  approved/identified statuses, exact instructor IDs, and empty missing-field
  arrays;
- rollback rehearsal: an exact-baseline mismatch rejected the transaction and
  left all three courses unreviewed;
- static checks pin the owner decision, exact courses/source IDs, guarded write
  scope, preflight/postflight totals, protected fingerprint, and immutable hash;
- full regression suite: 174 files / 1,638 tests passed after application;
- ESLint and the production build passed; the production dependency audit
  reported zero vulnerabilities;
- no production write or `release` push occurred while preparing this package.

## Production application evidence

- owner approval matched the immutable SHA-256 above;
- fresh PITR verification: seven-day retention active, with the latest restore
  point available at `2026-08-05 14:33:28 +05:30` before the write;
- fresh privileged preflight passed at 388 playlists / 4,539 videos / 4,545
  memberships / 247 chapters / 92 chapter-class scopes / 32 teachers / 11
  quality reviews;
- the single transaction preserved the three exact source titles, set the
  canonical titles to `Redox Reactions`, `Cell Organelles`, and `Molecular Basis
  of Inheritance`, set title/faculty statuses to approved/identified, and added
  exactly three immutable quality-review rows;
- independent postflight passed at 388 playlists / 4,539 videos / 4,545
  memberships / 247 chapters / 92 chapter-class scopes / 32 teachers / 14
  quality reviews;
- protected JEE remained exactly 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`;
- the artifact must not be rerun; no `release` push was made.
