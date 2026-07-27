# PW NEET Wallah coverage audit — 2026-07-27

Source channel: Competition Wallah / `@PW-NEETWallah`
(`UCD16eo98AXl-9T61Xd711kQ`).

This is a read-only discovery record. It does not authorize an import.

## Channel coverage snapshot

- 7,642 channel uploads were enumerated; 7,639 were public and usable.
- 218 public playlists were enumerated, containing 2,818 playlist memberships.
- Production already represented 14 channel playlists and 158 channel videos.
- 204 public playlists and 7,481 public uploads were not represented in
  production at audit time.
- The upload gap is not an import queue: it includes Shorts, announcements,
  promotional clips, interviews, strategy videos, and other non-curriculum
  material. Every playlist still requires a source snapshot, curriculum review,
  teacher evidence, and an anonymous dry-run.

## High-confidence missing lecture playlists

The first curriculum-focused triage found 16 strong candidates (186 videos).
All 186 video IDs were new to production at audit time and had positive duration
and embedding evidence.

| Candidate | Videos | Status |
| --- | ---: | --- |
| MISSION 30 Inorganic Chemistry | 5 | Manifest prepared; dry-run blocked on source teacher evidence |
| MISSION 30 Organic Chemistry | 8 | Manifest prepared; anonymous dry-run passed |
| MISSION 30 Physical Chemistry | 7 | Manifest prepared; anonymous dry-run passed |
| MISSION 30 Zoology | 10 | Manifest prepared; dry-run blocked on source teacher evidence |
| MISSION 30 Botany | 10 | Manifest prepared; needs canonical `Molecular Basis of Inheritance` chapter |
| MISSION 30 Class 12 Physics | 11 | Manifest prepared; anonymous dry-run passed |
| MISSION 30 Class 11 Physics | 10 | Manifest prepared; anonymous dry-run passed |
| SKC Organic Chemistry one-shot | 10 | Later review batch |
| Good Morning Physics | 25 | Later review batch |
| Physical Chemistry Mindmap | 10 | Later review batch |
| Botany Mindmap | 15 | Later review batch |
| Physics Mindmap | 33 | Later review batch |
| Pankaj Organic Chemistry Class 11 | 8 | Later review batch |
| Aayudh Mechanics | 14 | Later review batch |
| Vardaan Physics | 5 | Later review batch |
| Vardaan Chemistry | 5 | Later review batch |

## MISSION 30 review evidence

The seven manifests bind all 61 usable source positions and video IDs. There
were no duplicate source video IDs or lesson positions and no count shortfalls.

Four production anonymous dry-runs passed with quality `ok`:

- Organic Chemistry: 8/8 usable, teacher `Pankaj Sijariya`.
- Physical Chemistry: 7/7 usable, teacher `Amit Mahajan`.
- Class 12 Physics: 11/11 usable, teacher `Manish Raj`.
- Class 11 Physics: 10/10 usable, teacher `Saleem Sir`.

Three remain deferred:

- Inorganic Chemistry: 5/5 usable, visually attributable to Mohit Dadheech Sir,
  but source metadata contains no teacher evidence. The importer correctly
  blocks the write.
- Zoology: 10/10 usable, source tags suggest Samapti Ma'am, but the current
  source-evidence classifier did not accept the metadata. The importer correctly
  blocks the write.
- Botany: 10/10 usable and visually/source-channel attributable to Vipin Sharma
  Sir, but production lacks the canonical chapter `Molecular Basis of
  Inheritance`. Do not mis-map that lecture to another chapter.

## Combined-lecture limitation

Several MISSION 30 videos cover multiple chapters. Import capability v12 assigns
one canonical chapter to each video. The checked-in manifests use the leading or
principal chapter so no video is omitted, but secondary chapters will not gain
a separate browse membership. This limitation must be accepted explicitly or
the data model must be extended before import; it must not be worked around by
duplicating videos or inventing hybrid chapter names.

## Safe next gates

1. Review the four clean manifests and import only with a separate owner gate.
2. Add/verify teacher evidence for Inorganic Chemistry and Zoology without
   weakening the global quality gate.
3. Create the missing Botany chapter only through the established additive
   chapter workflow, then repeat its anonymous dry-run.
4. Review the remaining nine high-confidence playlists one at a time.
5. Continue triaging the other 188 public playlists; do not equate all channel
   uploads with curriculum lectures.
