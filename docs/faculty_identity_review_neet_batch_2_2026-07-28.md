# Faculty identity review — NEET batch 2 — 28 July 2026

## Status

Source-verified identity review only. No SQL artifact has been authorized or
executed.

## Reviewed mappings

| Legacy value | Canonical display name | Verified aliases | Subject | Courses |
| --- | --- | --- | --- | ---: |
| `Vipin Sharma Sir` | Vipin Sharma | `Vipin Sharma Sir`, `Vipin Sir` | Biology / Botany | 4 |
| `Pankaj Sijariya` | Pankaj Sijariya | `Pankaj Sijariya Sir`, `Pankaj Sir` | Chemistry / Organic Chemistry | 3 |
| `Amit Mahajan` | Amit Mahajan | `Amit Mahajan Sir` | Chemistry / Physical Chemistry | 2 |
| `Manish Raj` | Manish Raj | `Manish Raj Sir`, `MR Sir` | Physics | 2 |

The proposed aliases are limited to forms explicitly printed by official PW
pages. In particular, this review does **not** map the ambiguous `Amit Sir`
token from a multi-teacher course to Amit Mahajan.

## Primary PW sources

- PW NEET faculty listing:
  `https://www.pw.live/neet`
- Yakeen 2.0 2026 faculty:
  `https://www.pw.live/neet/exams/why-choose-yakeen-2-0-2026-batch`
- Yakeen NEET 2.0 2027 chemistry faculty:
  `https://www.pw.live/neet/exams/the-reveal-pw-yakeen-neet-2-0-2027-chemistry-powerhouse`
- Re-launched Yakeen NEET 2.0 2027 faculty:
  `https://www.pw.live/neet/exams/re-launch-pw-yakeen-neet-20-2027`

Together these official pages print the full names, subjects, and the `MR Sir`,
`Vipin Sir`, and `Pankaj Sir` aliases used above.

## Exact production coverage

| Teacher | Course IDs |
| --- | --- |
| Manish Raj | 92, 110 |
| Pankaj Sijariya | 95, 108, 113 |
| Amit Mahajan | 96, 109 |
| Vipin Sharma | 99, 101, 102, 120 |

All 11 are Competition Wallah NEET courses. Their subject assignments match
the official PW faculty evidence.

## Boundaries

- Do not merge another short-name record merely because a first name matches.
- Do not infer identity from a face, thumbnail, subject, or shared playlist.
- Do not rewrite the legacy `playlists.teacher` values.
- Any future package must be additive, idempotent, exact-ID scoped, and protect
  the JEE fingerprint
  `d7aae3ce7635401ebeffe97e627048bc`.
- The existing restore clone predates these production course IDs and cannot
  serve as a valid rehearsal target without reproducing the missing courses.

This batch and NEET batch 1 together would cover 27 of the 45 NEET courses, but
neither batch is authorized for execution.
