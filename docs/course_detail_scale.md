# Course detail scale gate

Status: paging implementation corrected and locally regression-tested on
2026-07-22. A seeded `>500`-row real-PostgREST staging run remains a release
gate. No database migration or production write is part of this change.

## Student experience

- A selected lesson is stored in `?v=<youtube_video_id>`, so refreshes and
  shared course links restore the same lesson.
- Previous and Next lesson controls sit beside the player.
- The course sequence can be searched by lecture title, position, or chapter.
- Students can filter the sequence by its real chapter metadata and by
  unwatched lessons.
- Only 50 lesson rows render at once. A resumed lesson automatically opens the
  page containing that lesson.
- Empty filtered results have a clear reset action.
- Watch progress is still recorded only after the YouTube player reports
  actual playback. Selecting a lesson does not mark it watched.

## Data integrity at scale

`usePlaylistVideos` requests an exact count with the first deterministic page,
ordered by `position` and then junction `id`. Every next range begins at the
number of rows actually received—not at an assumed 500-row boundary—so a
server cap smaller than 500 does not look like the end of the course. The known
count also prevents an unnecessary out-of-range request for courses containing
exactly 500, 1000, or another page multiple. Missing counts, empty intermediate
pages, duplicate junction ids, and later-page failures all fail closed behind
the retryable error instead of presenting a plausible partial sequence. Route
changes and retries abort the superseded requests.

## Evidence

- 1,201-row fixture: all rows loaded in ranges `0-499`, `500-999`, and
  `1000-1200`.
- Exact-boundary fixtures: 500 and 1000 rows complete without an extra range.
- Low-cap fixture: a simulated 100-row server cap still returns all 251 rows.
- Missing-count, empty-course, later-page failure, and route-abort cases are
  covered explicitly.
- 120-lesson UI fixture: at most 50 lesson buttons rendered; lesson 117 remains
  searchable and a resumed lesson 117 opens page 3.
- Live local course: lesson selection changed the URL to
  `/course/9?v=G_m3fXBgqJE`; Previous changed it to the preceding video.
- 360x800 live audit: zero document overflow and zero visible interactive
  targets smaller than 44px.
- Browser console: zero errors or warnings during the verified journey.
- Full automated suite: rerun after each paging change; see the current handoff
  rather than treating this number as permanent evidence.
- Production build: clean and route-split; the course route is about 31 kB
  minified (about 10 kB gzip).

## Truthfulness boundaries

- Chapter labels appear only when a lesson has a real chapter relation.
- Duration remains absent unless every lesson duration is known.
- No theory/practice/PYQ classification is inferred from a YouTube title.
- The displayed legacy faculty string remains plain text until the reviewed
  faculty registry is deployed and linked in production.
- The large-row paging cases above currently use a PostgREST-shaped test
  double. They are not a substitute for the pending seeded staging run.
