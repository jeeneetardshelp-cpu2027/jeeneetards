# Chapter/class scope readiness — 2026-08-01

Status: **preparation only; no Supabase write and no release deployment**.

## Reproduced production defect

The anonymous `get_browse_curriculum` RPC currently exposes 31 JEE Physics
chapters: 17 under Class 11 and 18 under Class 12. Four appear under both:

- Kinematics
- Newton's Laws of Motion (NLM)
- Work, Energy and Power
- Ray Optics and Optical Instruments

`Modern Physics` appears only under Class 11. This is also academically wrong.
The current RPC determines chapter class from the containing playlist, creating
a cross-product whenever a playlist carries more than one class.

Changing the RPC to `video_class_levels` is not a safe fix. Production evidence:

| Chapter | Videos | Videos with class rows | Class rows observed |
|---|---:|---:|---|
| Ray Optics and Optical Instruments | 14 | 12 | class-11, class-12, dropper |
| Modern Physics | 10 | 7 | class-11, class-12, dropper |

The video junction currently mixes academic class with course audience and is
incomplete, so it cannot be treated as canonical.

## Proposed model

`chapter_class_levels(chapter_id, class_level_id)` becomes the canonical
academic scope. It is independent of:

- the classes covered by a multi-class playlist;
- whether a course is marketed to droppers;
- the class tags inherited by an individual imported video.

The first reviewed slice contains five JEE Physics corrections:

| Chapter | Canonical class |
|---|---|
| Kinematics | Class 11 |
| Newton's Laws of Motion (NLM) | Class 11 |
| Work, Energy and Power | Class 11 |
| Ray Optics and Optical Instruments | Class 12 |
| Modern Physics | Class 12 |

Evidence: the official CBSE 2025–26 Class XI–XII Physics syllabus places
motion, laws of motion, and work/energy in Class XI, and ray optics in Class
XII. NCERT Physics Part II for Class XII contains the modern-physics units.

## Prepared artifacts

- `src/migrations/chapter_class_scopes_v13_draft.sql` — additive table and five
  provenance-bearing rows. It contains a deliberate abort before all DDL.
- `npm run audit:chapter-classes` — anonymous, read-only repeatable evidence.

## Required gates before any production change

1. Owner reviews the five canonical mappings and the model.
2. Remove the deliberate abort only in a separate approved artifact.
3. Rehearse table creation and row insertion on an isolated current-data clone.
4. Build a second, separately reviewed query delta that makes curriculum and
   facet RPCs prefer canonical rows and fall back only for unreviewed chapters.
5. Verify Class 11 no longer exposes Ray Optics/Modern Physics, Class 12 no
   longer exposes Kinematics/NLM/Work-Energy, counts remain internally
   consistent, and JEE/NEET/School remain isolated.
6. Record a fresh PITR restore point before any independently approved
   production application.
