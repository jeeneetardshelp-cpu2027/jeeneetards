# Reviewed external teacher evidence — 28 July 2026

This change prepares, but does not authorize, an additional teacher-attribution
evidence path for mapped imports.

## Boundary

YouTube title, description, and tag evidence remains the default. A mapped
manifest may now carry `teacher_evidence` only when a reviewer has verified an
external public source that directly links the named teacher to every exact
source video.

The validator fails closed unless the evidence contains:

- schema version and `reviewed_external_source` kind;
- a durable UUID decision ID;
- the exact selected playlist ID and import teacher;
- an HTTPS source URL and source label;
- reviewer identity and ISO review date;
- every current source YouTube video ID exactly once.

This evidence resolves only `no_teacher_evidence`. It cannot resolve duplicate
IDs, duplicate lesson numbers, source-order findings, count shortfalls,
duration or embedding failures, chapter mismatches, or catalogue overlap.
Manifest and source SHA-256 evidence remain part of the mapped-v12 payload and
audit row.

Any staging or production write that relies on this evidence must also provide
`--confirm-teacher-evidence=<decision UUID>`. The importer compares it to the
validated manifest decision and fails before the RPC on a missing or different
value. Anonymous dry-runs do not require the write confirmation.

## Zoology evidence

The teacher-owned public channel
`https://t.me/s/SamaptiMamZoology?before=463` was reviewed on 28 July 2026.
It is labelled `Samapti Mam Zoology` and individually links all ten exact
YouTube video IDs in `neet-mission-30-zoology.json`.

The checked-in manifest binds that evidence to:

```text
playlist: PLJyab0VQDBGX7SDzL7XuurETg0FY9NWXs
teacher: Samapti Ma'am
videos: 10
decision: c8cf544a-bd1f-4a2c-9a7e-d8490185a86c
```

A fresh anonymous production dry-run returned:

```text
published: 10
usable: 10
quality: ok
review: 0
blocked: 0
Supabase writes: 0
```

## Production result

The owner explicitly approved decision
`c8cf544a-bd1f-4a2c-9a7e-d8490185a86c` and the exact Zoology playlist.
Immediately before the write, the production PITR dashboard showed 7-day
retention and a latest restore point of 28 Jul 2026 09:41:19 UTC+05:30.

The final anonymous dry-run remained 10/10 and `ok`. The create-only mapped-v12
import created course 122, 10 videos, and 10 memberships; it reused all mapped
chapters and created none.

Postflight:

```text
courses: 115
memberships: 1,660
JEE courses: 83
NEET courses: 32
Biology courses: 13
JEE fingerprint: d7aae3ce7635401ebeffe97e627048bc
metadata gaps: 0
teacher gaps: 0
duplicate candidates: 0
```

Anonymous browser QA found the course under NEET Class 11 Biology and Animal
Kingdom, loaded the first and last YouTube embeds (lessons 1 and 10), and
reported no console warnings or errors.

MISSION 30 Inorganic Chemistry remains deferred: its external material does not
directly attribute all five exact videos, so no evidence block was added to
that manifest.
