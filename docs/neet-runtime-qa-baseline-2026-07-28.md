# NEET runtime QA baseline — 2026-07-28

## Scope

Read-only local browser QA against `http://127.0.0.1:4176`. No Supabase
writes, migrations, content imports, or release pushes were performed.

## Environment note

The pre-existing browser tab initially showed the application recovery screen
because its Vite server was no longer listening. A fresh Vite session was
started on the same port and the QA pass was repeated in a new tab. The fresh
session produced no console warnings or errors.

## Results

| Area | Evidence | Result |
| --- | --- | --- |
| NEET entry | `/explore/neet` showed Class 11, Class 12, and Dropper choices | Pass |
| Discovery drill-down | Class 11 showed Physics (1), Chemistry (2), and Biology (5) course counts | Pass |
| Chapter discovery | Class 11 Biology showed populated chapter choices; Biological Classification reported 3 courses | Pass |
| Filter handoff | Selecting Biological Classification opened `/browse?goal=neet&class=11&subject=biology&chapter=biological-classification` with NEET, class, subject, and chapter filters applied | Pass |
| Course results | Three matching courses rendered with teacher, channel, lesson count, language, course type, and difficulty metadata | Pass |
| Course page | Opened course 91, chapter 100; course metadata and two-lesson list rendered | Pass |
| First lesson | Privacy-enhanced YouTube iframe loaded video `LyvqUtWgtZ0` with the expected title | Pass |
| Last lesson | Next-lesson navigation changed the route to `?v=E-b27S3eJgY`, displayed “Lesson 2 of 2,” and updated the iframe title/source | Pass |
| Scoped search | Searching NEET for “biological classification” returned 5 relevant lecture results | Pass |
| Theme | Theme control changed text contrast and its accessible label from “Use light theme” to “Use dark theme”; original theme was restored | Pass |
| Mobile | At 390×844, the discovery and course pages had no horizontal overflow; the player iframe fit at 343×193 | Pass |
| Console | Zero fresh warnings or errors after the clean-server pass | Pass |

## Outcome

No reproducible frontend defect was found in this pass, so no application code
was changed. The local NEET discovery and representative playback path is ready
for the next separately approved content gate.
