# Faculty identity review — NEET batch 4 — 28 July 2026

## Status

Source-verified identity review for one mixed-teacher course. An additive SQL
artifact is prepared but unexecuted; no database or release write occurred.

## Reviewed course

| Course ID | Legacy value | Reviewed teachers | Subject |
| ---: | --- | --- | --- |
| 91 | `Tarun Sir & Samapti Ma'am` | Tarun Kumar; Samapti Sinha | Biology |

Verified aliases:

- Tarun Kumar: `Tarun Kumar Sir`, `Tarun Sir`
- Samapti Sinha: `Samapti Sinha Ma'am`, `Samapti Ma'am`

## Evidence

The official PW Umeed 2.0 page lists Tarun Kumar Sir and Samapti Sinha Ma'am
together in its Biology schedule and teacher roster:

`https://www.pw.live/neet/dropper/batches/umeed-2-0-960155`

The official PW Pi educator page independently prints the short forms
`Tarun Sir` and `Samapti Ma'am`:

`https://www.pw.live/pi-ott`

PW's official Arjuna NEET course product description also names Tarun Kumar Sir
for Botany and Samapti Ma'am for Zoology:

`https://store.pw.live/products/arjuna-neet-pen-drive-course-for-11th`

These first-party sources establish both full identities and the exact short
aliases used by course 91. Existing import evidence records the official
Competition Wallah source attribution and six mapped Biology lectures.

## Still deferred

- Course 118 — `Aditya Sir & Rohit Sir`
- Course 119 — `Sarvesh Sir, Pankaj Sir & Amit Sir`

Direct inspection of the official Competition Wallah Vardaan playlists confirms
the five-video source sets and per-video short-name credits, but their public
titles and descriptions do not publish the teachers' full names. Possible full
names elsewhere in PW's catalogue are not enough to prove that they are the
people in these historical videos. No identity mapping is authorized for
courses 118–119.

## Boundaries

- A future course-91 package must add two ordered `playlist_teachers` links,
  never collapse the combined credit to one person.
- Do not rewrite `playlists.teacher`.
- Any package must be additive, idempotent, exact-ID scoped, and protect the
  JEE fingerprint `d7aae3ce7635401ebeffe97e627048bc`.
- The existing restore clone predates production course 91 and cannot rehearse
  this mapping.

Prepared artifact:

`src/migrations/faculty_registry_neet_batch4_course91_prepared.sql`

It is exact-ID scoped, refuses a changed 45-course NEET baseline or conflicting
course-91 faculty link, preserves the two-teacher order, and verifies the
protected JEE fingerprint.

With this decision, 43 of 45 NEET courses have source-reviewed faculty
identities. Only courses 118 and 119 remain unresolved.
