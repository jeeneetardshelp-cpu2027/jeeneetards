# Unacademy NEET twenty-second-batch quality readiness - 16 August 2026

## Status

**PREPARED LOCALLY - OWNER APPROVAL REQUIRED FOR PRODUCTION.** This artifact is
not executable until the separately gated faculty-link artifact has applied
successfully. No database write, migration, deployment, or `release` push
occurred while preparing it.

## Exact artifact

- SQL: `docs/sql/unacademy_neet_twenty_second_batch_quality_review_2026-08-16.sql`
- SHA-256: `ea8c707a5a1c7ae4899bb0bd1617a0d04369e1748582197afa05cd1bf22cf39d`
- Evidence decision: `fbf7b3a1-0a19-4dae-b5fe-d967b94f3a7c`
- Required predecessor SHA-256:
  `ab462555ee235f591abeac364811f835b35e3a87b31784366bd0b110569a4422`

Approval wording, only after the faculty-link postflight passes:

> Approve applying Unacademy NEET twenty-second-batch quality-review artifact
> SHA-256 `ea8c707a5a1c7ae4899bb0bd1617a0d04369e1748582197afa05cd1bf22cf39d`
> to production, after a fresh PITR and exact-baseline check; stop on any
> mismatch; no release push.

## Guarded prerequisite state

The transaction requires:

- catalogue 424 playlists / 4,768 videos / 4,774 memberships / 263 chapters /
  92 chapter-class rows;
- registry 37 teachers / 60 aliases / 38 institute links / 38 subject links /
  37 goal links / 179 course-teacher links;
- exactly 47 existing quality reviews;
- catalogue management capability v11;
- exactly one reviewed normalized teacher link on each target course;
- pending title and faculty review state, null source titles, and no target
  quality-review row; and
- protected JEE exactly 82 / 1,304 /
  `30eee4a4a6842e5beeb7c97083d7f812`.

## Reviewed transition

The transaction preserves both the approved short display titles and the exact
official YouTube source titles:

- course 441: `Work, Energy and Power` / source
  `NEET: Work Energy & Power | Unacademy NEET | Mahendra Singh`;
- course 442: `Solutions` / source
  `NEET: Solutions - Playlist | Class 12 | Unacademy NEET | Live Daily | NEET Chemistry | Anoop Vashishtha`;
- course 443: `Periodic Table` / source
  `NEET: Periodic Table | Class 11 | Unacademy NEET | Anoop V.`.

It then invokes `public.review_playlist_quality` once per course with the
approved display title, exact teacher ID, and existing content metadata. The
postflight requires all three courses to be quality-ready, approved/identified,
to retain the exact source title, and to have exactly one immutable review row.
Expected quality-review total is 50; catalogue, faculty registry, and protected
JEE totals must remain unchanged.
