# Unacademy NEET seventeenth-batch quality-review readiness - 7 August 2026

## Status

Applied successfully to production project `kezelafqhgqrprpadmlf` after exact
SHA-256 approval, a fresh PITR check, and an exact-baseline preflight. The
guarded transaction and independent postflight both passed. No deployment or
`release` push was run.

## Reviewed scope

This package completes the separate quality gate for course `429`, imported in
the Unacademy NEET seventeenth batch and now linked to the verified instructor:

| Course ID | Canonical title | Instructor |
| ---: | --- | --- |
| 429 | Breathing and Exchange of Gases | Dr. Sachin Kapur (`sachin-kapur`, teacher 38) |

The package first preserves the current YouTube source title, then approves the
concise canonical title and identifies the already-normalized faculty. It does
not add or remove catalogue, taxonomy, registry, membership, video, chapter, or
faculty-link rows.

## Fresh read-only production snapshot

Evidence was captured at `2026-08-07T08:23:28.026Z`, after the approved faculty
link application:

- 410 playlists / 4,705 videos / 4,711 memberships / 263 chapters;
- 92 chapter-class scopes;
- 34 teachers / 54 aliases / 35 teacher-institute links / 35 teacher-subject
  links / 34 teacher-goal links / 165 course-teacher links;
- 35 quality reviews;
- course 429 retains source `PLsgHooHkqhhMpUzdl2c1YMGYdrTxCCXFe`, has exactly
  six distinct lessons in positions 1-6, and all six remain mapped to Breathing
  and Exchange of Gases chapter 105;
- exact video order remains `bmF2tmenuMI`, `fG72ty2A2tg`, `at_rKPlIXoo`,
  `5Jls9m-jDjM`, `Ev3t9nip0PU`, `zNpJSgVOR1M`;
- the only normalized instructor link is `429 -> sachin-kapur`, role
  `instructor`, position 1;
- the course has no quality-review row and is missing exactly `title-review`,
  `source-title`, and `faculty-credit`;
- the canonical v10 review RPC and capability contract are present;
- protected JEE remains 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

## Immutable prepared artifact

- SQL: `docs/sql/unacademy_neet_seventeenth_batch_quality_review_2026-08-07.sql`;
- SHA-256: `deadb3d8acadc0f12ccceda29296dff43ba961de18da81255b0b4478da81cfb3`;
- target after separate approval: production project `kezelafqhgqrprpadmlf`;
- expected transition: capture one source title, approve the canonical title,
  identify the linked faculty, and append one immutable quality-review row;
- expected quality-review count: 35 -> 36;
- expected catalogue, taxonomy, registry, faculty-link, and protected-JEE delta:
  zero.

The SQL is one guarded transaction. It aborts on any capability, count,
course/source, lesson order, video ID, chapter, class, goal, teacher-link,
review-state, reference-data, or protected-fingerprint mismatch. Its only direct
table update captures the null source title; the canonical transition uses
`review_playlist_quality`. Postflight checks the exact audit before/after state
and every unchanged boundary before commit.

## Local validation

- production-shaped PGlite rehearsal passed and produced the exact canonical
  transition plus one immutable audit row;
- rollback-on-drift rehearsal passed and left course 429 untouched;
- focused package tests: 5 passed;
- full controlled-concurrency regression: 275 files / 2,102 tests passed;
- ESLint passed with zero warnings;
- production build passed; the isolated worktree preserved the last known
  complete sitemap because Supabase variables were intentionally absent;
- frontend release safeguards passed with process-scoped public browser values;
- production dependency audit reported zero vulnerabilities;
- preparation CI passed: [GitHub Actions run 31162157183](https://github.com/jeeneetardshelp-cpu2027/jeeneetards/actions/runs/31162157183);
- no production SQL or `release` push occurred during preparation.

## Production application evidence

- owner approved exact SHA-256
  `deadb3d8acadc0f12ccceda29296dff43ba961de18da81255b0b4478da81cfb3`;
- refreshed PITR page confirmed active seven-day retention; the latest restore
  point displayed was `2026-08-07 13:37:48 IST`;
- fresh preflight at `2026-08-07T08:46:50.523112Z` matched the pinned baseline:
  410 playlists / 4,705 videos / 4,711 memberships / 263 chapters / 92
  chapter-class scopes / 165 course-teacher links / 35 quality reviews;
- course 429 still had the expected source, six ordered videos, chapter 105,
  teacher 38, pending title/faculty states, and no existing review row;
- the guarded transaction committed once with no mismatch;
- independent postflight at `2026-08-07T08:49:47.316584Z` confirmed:
  - course 429 title is `Breathing and Exchange of Gases`;
  - source title is preserved and `source_title_changed` remains false;
  - title status is `approved`, faculty status is `identified`, and missing
    fields are empty;
  - the single immutable audit row records pending -> approved and pending ->
    identified, with teacher 38 unchanged;
  - quality reviews increased exactly 35 -> 36;
  - all catalogue, taxonomy, registry, and faculty-link totals remained
    unchanged;
  - protected JEE remained exactly 82 courses / 1,304 memberships / fingerprint
    `30eee4a4a6842e5beeb7c97083d7f812`.

The artifact must not be rerun after this success. No `release` push occurred.
