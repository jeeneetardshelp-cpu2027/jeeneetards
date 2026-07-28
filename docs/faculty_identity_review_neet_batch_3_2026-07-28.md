# Faculty identity review — NEET batch 3 — 28 July 2026

## Status

Source-verified identity review only. No SQL artifact was created or executed,
and no database or release write occurred.

## Reviewed mappings

| Legacy value | Canonical display name | Verified aliases | Subject | Course IDs |
| --- | --- | --- | --- | --- |
| `Pawan Kumar Pandey` | Pawan Kumar Pandey | `Pawan Kumar Pandey Sir` | Physics | 93 |
| `Mohit Dadheech Sir`, `Mohit Dadheech` | Mohit Dadheech | `Mohit Dadheech Sir` | Inorganic Chemistry | 94, 97 |
| `Nikhil Saini Sir` | Nikhil Saini | `Nikhil Saini Sir` | Chemistry | 98 |
| `Pratham Nahata Sir` | Pratham Nahata | `Pratham Nahata Sir` | Botany | 100 |
| `Swagata Mukherjee Ma'am` | Swagata Mukherjee | `Swagata Mukherjee Ma'am` | Zoology | 103 |
| `Tulika Jha Ma'am` | Tulika Jha | `Tulika Jha Ma'am` | Zoology | 104 |
| `Saleem Sir` | Saleem Ahmad | `Saleem Sir`, `Saleem Ahmad Sir` | Physics | 111 |
| `SKC Sir` | Shubh Karan Choudhary | `SKC Sir`, `Skc Sir`, `Shubh Karan Choudhary Sir` | Organic Chemistry | 112 |
| `Aayudh Sir` | Aayudh Yashlaha | `Aayudh Sir`, `Aayudh Yashlaha Sir` | Physics | 114 |
| `Abhishek Verma Sir` | Abhishek Verma | `Abhishek Verma Sir` | Physics | 115 |
| `Sudhanshu Sir` | Sudhanshu Kumar | `Sudhanshu Sir`, `Sudhanshu Kumar Sir` | Physical Chemistry | 116 |
| `Siddharth Sir` | Siddharth Sharma | `Siddharth Sir`, `Siddharth Sharma Sir` | Physics | 117 |
| `Harshit Thakuria Sir` | Harshit Thakuria | `Harshit Thakuria Sir` | Botany | 121 |
| `Samapti Ma'am` | Samapti Sinha | `Samapti Ma'am`, `Samapti Sinha Ma'am` | Zoology | 122 |

The two Mohit Dadheech values are an honorific-only difference, and official PW
pages consistently identify the Inorganic Chemistry faculty as Mohit Dadheech
Sir. The short-name expansions above are not guesses: PW's batch schedules,
teacher lists, and demo-lecture labels print the short and full forms in the
same official context.

## Primary PW sources

- PW NEET faculty listing:
  `https://www.pw.live/neet`
- MISSION 30 NEET 2026:
  `https://www.pw.live/neet/dropper/batches/mission-30-neet-2026-774080`
- NEET Coaching Plus 2026:
  `https://www.pw.live/neet/dropper/batches/neet-coaching-plus-2026-598763`
- Ummeed NEET 2025:
  `https://www.pw.live/neet/dropper/batches/ummeed-neet-2025-659540`
- Arjuna NEET Weekend Express 2026:
  `https://www.pw.live/neet/class-11/batches/arjuna-neet-weekend-express-2026-157910`
- NCERT Line by Line 2025:
  `https://www.pw.live/neet/dropper/batches/ncert-line-by-line-2025-262577`
- Garuna NEET Series 2025:
  `https://www.pw.live/neet/dropper/batches/%E0%A4%97%E0%A4%B0%E0%A5%81%E0%A4%A1%E0%A4%BC--garuna--neet-series-2025-559004`
- Yakeen NEET 2.0 2027 chemistry faculty:
  `https://www.pw.live/neet/exams/the-reveal-pw-yakeen-neet-2-0-2027-chemistry-powerhouse`

Together these first-party pages print every canonical name and subject above.
They also directly connect `Saleem Sir` with Saleem Ahmad, `Siddharth Sir` with
Siddharth Sharma, and the other reviewed short labels with their full names.

## Deferred multi-teacher courses

These three courses remain deliberately outside the reviewed batches:

- Course 91 — `Tarun Sir & Samapti Ma'am`
- Course 118 — `Aditya Sir & Rohit Sir`
- Course 119 — `Sarvesh Sir, Pankaj Sir & Amit Sir`

Although Samapti Sinha and Pankaj Sijariya are independently reviewed
identities, a mixed credit must be normalized only after every named teacher in
that course is resolved. No partial or inferred link is authorized.

## Boundaries

- Do not rewrite the legacy `playlists.teacher` values.
- Do not infer identities from faces, thumbnails, or shared subjects.
- Any future SQL package must be additive, idempotent, exact-ID scoped, and
  protect the JEE fingerprint
  `d7aae3ce7635401ebeffe97e627048bc`.
- The existing restore clone predates these production course IDs and cannot
  validly rehearse this batch.

This review covers 15 courses. Together, NEET batches 1–3 source-review 42 of
45 courses; the remaining three are exactly the deferred mixed-teacher rows.
