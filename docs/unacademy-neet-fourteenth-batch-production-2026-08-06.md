# Unacademy NEET fourteenth production batch - 6 August 2026

## Outcome

Completed under refreshed owner decision
`b98191cb-c0be-4d3c-9e15-95905da4fffc`. The three reviewed courses were
imported to production create-only, one at a time. No existing course or video
was reused, no chapter was created, and no `release` push was performed.

| Order | Course | Course ID | Videos | Memberships | Chapters created | Reused |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Friction | 420 | +4 | +4 | 0 | 0 |
| 2 | Cell: The Unit of Life | 421 | +4 | +4 | 0 | 0 |
| 3 | Anatomy of Flowering Plants | 422 | +6 | +6 | 0 | 0 |

Batch delta: **+3 playlists / +14 videos / +14 memberships / 0 chapters**.

## Gated execution evidence

The signed-in production dashboard confirmed active seven-day PITR before the
batch and before each later course. Recorded latest restore points were:

- Friction: `06 Aug 2026, 14:32:53 IST`;
- Cell: The Unit of Life: `06 Aug 2026, 15:22:54 IST`;
- Anatomy of Flowering Plants: `06 Aug 2026, 15:26:54 IST`.

Each fresh anonymous preflight matched the expected quiet-window catalogue,
reported zero collision for the not-yet-imported source and retained videos,
and preserved the protected JEE boundary. Each mapped dry-run returned one
`ok` playlist with zero review or blocked findings before its write.

The refreshed Friction manifest used request
`24c74a76-22fa-4bcc-8d31-5fbd688a9045`, retained L1-L4, and excluded only the
current Quiz 2 row. The disappeared private row was not asserted or imported.
The unchanged Cell and Plant Anatomy manifests retained their original reviewed
teacher-evidence decision `b19eaa58-7931-4c84-8cea-8b6622230b4d`.

## Post-import verification

Final production totals:

- 403 playlists;
- 4,655 videos;
- 4,661 playlist-video memberships;
- 263 chapters.

All three courses are anonymous-readable, carry only the `neet` learning goal,
carry Class 11, use the intended subject and single chapter, and contain only
embeddable lessons. Independent course verification passed 10/10 checks for
each course.

The protected original JEE boundary remained exactly **82 courses / 1,304
memberships / `30eee4a4a6842e5beeb7c97083d7f812`** after every write. The
rolling JEE catalogue remained exactly **212 courses / 2,848 memberships /
`9eea2b44f0b19c08cc0907c57e091342`**.

## Faculty-link transition

The separately approved faculty-link artifact was applied later on 6 August
2026. The normalized SQL editor content exactly matched SHA-256
`fed469e8036e346ccfb45cae8e8c01cd66f1c32addcbd40eae4c1a641f5d16c1`;
the editor's only byte-level difference was CRLF line-ending conversion.

Before the write, the signed-in production dashboard confirmed active seven-day
PITR with latest restore availability at `06 Aug 2026, 15:48:54 IST`. The fresh
production preflight matched exactly:

- 403 playlists / 4,655 videos / 4,661 memberships / 263 chapters;
- 92 chapter-class scopes / 32 teachers / 50 aliases / 33 institutes;
- 33 teacher-subject rows / 32 teacher-goal rows;
- 155 faculty links / 26 quality reviews;
- zero existing faculty links and zero quality reviews for courses 420-422;
- protected JEE boundary 82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`.

The guarded transaction inserted exactly three normalized links:

| Course ID | Teacher ID | Teacher | Position |
| ---: | ---: | --- | ---: |
| 420 | 34 | Mahendra Singh | 1 |
| 421 | 33 | Pradeep Singh | 1 |
| 422 | 33 | Pradeep Singh | 1 |

An independent read-only postflight confirmed 158 total faculty links, 26
quality reviews, exactly those three target links, zero target quality reviews,
unchanged catalogue totals, and the unchanged protected JEE boundary. All three
courses remain `pending` for title and faculty-credit review. No `release` push
was performed.

## Remaining gated work

The content-quality review transition for courses 420-422 remains a separate,
later hash-gated production step. This faculty-link gate did not authorize that
transition or a deployment.
