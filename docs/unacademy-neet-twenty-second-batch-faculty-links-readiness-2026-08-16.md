# Unacademy NEET twenty-second-batch faculty-link readiness - 16 August 2026

## Status

**PREPARED LOCALLY - OWNER APPROVAL REQUIRED FOR PRODUCTION.** No database
write, migration, deployment, or `release` push occurred while preparing this
artifact.

## Exact artifact

- SQL: `docs/sql/unacademy_neet_twenty_second_batch_faculty_links_2026-08-16.sql`
- SHA-256: `ab462555ee235f591abeac364811f835b35e3a87b31784366bd0b110569a4422`
- Evidence decision: `fbf7b3a1-0a19-4dae-b5fe-d967b94f3a7c`

Approval wording:

> Approve applying Unacademy NEET twenty-second-batch faculty-link artifact
> SHA-256 `ab462555ee235f591abeac364811f835b35e3a87b31784366bd0b110569a4422`
> to production, after a fresh PITR and exact-baseline check; stop on any
> mismatch; no release push.

## Fresh read-only baseline

At `2026-08-16T06:57:52.808Z`, production contained:

- catalogue 424 playlists / 4,768 videos / 4,774 memberships / 263 chapters;
- 92 chapter-class rows;
- faculty registry 37 teachers / 60 aliases / 38 institute links / 38 subject
  links / 37 learning-goal links / 176 course-teacher links;
- 47 quality reviews; and
- an empty `app_environment` table, as expected for production.

Courses 441-443 exactly match the approved titles, source playlist IDs,
ordered video IDs, chapter IDs 21/33/41, NEET-only goal, class scope, metadata,
and pending review state. None currently has a normalized faculty link or
quality-review row.

Protected original JEE remained 82 courses / 1,304 memberships /
`30eee4a4a6842e5beeb7c97083d7f812`.

## Existing identities reused

- teacher 34: verified `Mahendra Singh` / `mahendra-singh`, already linked to
  Unacademy NEET, Physics, and the NEET learning goal;
- teacher 36: verified `Anoop Vashishtha` / `anoop-vashishtha`, already linked
  to Unacademy NEET, Chemistry, and the NEET learning goal.

The transaction creates no teacher, alias, institute, subject, or goal row. It
inserts only:

- course 441 -> teacher 34 at instructor position 1;
- course 442 -> teacher 36 at instructor position 1; and
- course 443 -> teacher 36 at instructor position 1.

Expected post-state is 179 course-teacher links, with all other registry,
catalogue, and quality-review totals unchanged. The transaction aborts on any
baseline, course, lesson, chapter, scope, identity, review-state, or protected
JEE mismatch. Quality transition remains a later, separately approved gate.
