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
| SKC Organic Chemistry one-shot | 10 | Manifest prepared; anonymous dry-run passed |
| Good Morning Physics | 25 | Manifest prepared; anonymous dry-run passed |
| Physical Chemistry Mindmap | 10 | Manifest prepared; anonymous dry-run passed |
| Botany Mindmap | 15 | Manifest prepared; needs canonical `Molecular Basis of Inheritance` chapter |
| Physics Mindmap | 33 | Manifest prepared; anonymous dry-run passed |
| Pankaj Organic Chemistry Class 11 | 8 | Manifest prepared; anonymous dry-run passed |
| Aayudh Mechanics | 14 | Manifest prepared; anonymous dry-run passed |
| Vardaan Physics | 5 | Manifest prepared; deferred because the playlist mixes teachers |
| Vardaan Chemistry | 5 | Manifest prepared; deferred because the playlist mixes teachers |

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

## Second candidate-batch evidence

All 125 usable source positions and video IDs across the remaining nine
high-confidence playlists are bound in checked-in manifests. There were no
duplicate source video IDs, duplicate lesson positions, or count shortfalls.

Six production anonymous dry-runs passed with quality `ok`:

- SKC Organic Chemistry: 10/10, teacher `SKC Sir`.
- Pankaj Organic Chemistry Class 11: 8/8, teacher `Pankaj Sijariya`.
- Aayudh Mechanics: 14/14, teacher `Aayudh Sir`.
- Good Morning Physics: 25/25, teacher `Abhishek Verma Sir`.
- Physical Chemistry Mindmap: 10/10, teacher `Sudhanshu Sir`.
- Physics Mindmap: 33/33, teacher `Siddharth Sir`.

Three are deferred:

- Botany Mindmap: 15/15 and teacher evidence for `Harshit Thakuria Sir`, but
  production lacks `Molecular Basis of Inheritance`.
- Vardaan Physics: 5/5, but positions 1–3 credit Aditya Sir and positions 4–5
  credit Rohit Sir. A single playlist-level teacher would be misleading.
- Vardaan Chemistry: 5/5, with source credits split across Sarvesh Sir, Pankaj
  Sir, and Amit Sir; position 4 has no accepted teacher tag. A single
  playlist-level teacher would be misleading.

## Combined-lecture limitation

Several MISSION 30 videos cover multiple chapters. Import capability v12 assigns
one canonical chapter to each video. The checked-in manifests use the leading or
principal chapter so no video is omitted, but secondary chapters will not gain
a separate browse membership. This limitation must be accepted explicitly or
the data model must be extended before import; it must not be worked around by
duplicating videos or inventing hybrid chapter names.

## Broader channel triage

The complete 218-playlist enumeration was reviewed after the two
high-confidence batches. It contains substantial additional curriculum families:
NEET Premier League, 2024 Crash Courses, older NEET Mind Maps, Maha Revision,
UMMEED crash courses, Class 12 chapter series, Selection Express, UMEED 2.0,
RAFTAAR, Prashnakal, long-form subject courses, and PACE. It also contains
podcasts, interviews, offers, results, strategy sessions, Shorts, and mixed
recent uploads; those are not course-import candidates merely because they are
on the channel.

The six NEET Premier League 2024 playlists were tested as the next bounded
batch: Physical Chemistry (4), Inorganic Chemistry (5), Organic Chemistry (2),
Botany (6), Zoology (6), and Physics (11), totalling 34 usable videos. All 34
source titles are generic `Day N / 20-20 Questions Practice` labels and provide
no reliable chapter identity. The rules-only mapper correctly returned 34
unmatched rows. No manifests were retained and the batch is deferred unless
reliable per-video topic evidence can be established.

The six 2024 NEET Crash Course playlists were then reviewed: Inorganic
Chemistry (6), Organic Chemistry (10), Physical Chemistry (9), Zoology (16),
Botany (16), and Physics (29), totalling 86 usable videos. All 86 source
positions and IDs have defensible curriculum mappings in checked-in manifests.
Anonymous dry-runs confirmed the counts, ordering, chapter resolution, duration,
and embedding evidence, but all six playlists are deferred because their
YouTube metadata contains no accepted teacher-attribution evidence. Botany has
the additional blocker that `Molecular Basis of Inheritance` is not yet a
canonical production chapter. Teacher names used during the dry-runs were
review hypotheses only, not import authorization.

The older `Complete NEET ... - NEET Mind Map` family was reviewed next.
Zoology (16), Botany (16), and Physics (31) have complete checked-in mappings
for all 63 usable videos. Their anonymous dry-runs are deferred because the
source metadata contains no accepted teacher-attribution evidence; Botany also
requires `Molecular Basis of Inheritance`.

The Chemistry Mind Map playlist was not retained as a manifest. It advertises
28 videos but exposes only 26 usable entries, with source-position gaps, and
one surviving entry is a Physics `Motion in a Plane` lecture. A Chemistry-only
mapped course cannot represent that source truthfully, so the full playlist is
deferred rather than misclassifying or silently dropping the contaminated row.

The four `NEET Selection Express` playlists were also reviewed: Zoology (11),
Physics (28), Chemistry (31), and Botany (11), totalling 81 usable videos.
They are not safe v12 import candidates. Many source videos intentionally
combine multiple chapters; others cover an entire class or subject syllabus,
paper analysis, or post-exam result proof. The current importer permits exactly
one chapter per video, so retaining a manifest would hide substantial content
behind an arbitrary primary chapter. All four drafts were discarded and the
family is deferred pending multi-chapter video taxonomy or a narrower editorial
selection.

The subject-specific `NEET Maha Revision 2023` family was reviewed next:
Chemistry (18), Zoology (20), Physics (21), and Botany (1), totalling 60
videos. These are also deferred without manifests. Chemistry and Zoology
deliberately combine chapters within many two-hour videos, and the nominal
Zoology playlist includes Botany revision. Physics contains several composite
chapter lectures. The lone Botany entry is `Molecular Basis of Inheritance`,
which is not a canonical production chapter and cannot satisfy the mapped
manifest's multi-chapter contract by itself. Importing this family through v12
would produce materially incomplete or misleading browse taxonomy.

The four older `Mind Map Revision: ... | Class 12th/NEET` playlists were
reviewed next. Physics advertises 31 videos but exposes 30 usable entries; all
30 are mapped in a retained manifest, preserving the source-position gap. Its
anonymous dry-run is blocked by both the one-video count shortfall and missing
teacher evidence.

No manifests were retained for Zoology (16), Botany (21), or Chemistry (32
advertised / 31 usable). Those sources require canonical chapters that
production does not currently provide: Zoology includes Digestion and
Absorption and Animal Husbandry; Botany includes Food Production, Transport in
Plants, Mineral Nutrition, Environmental Issues, and Molecular Basis of
Inheritance; Chemistry includes Polymers and Environmental Chemistry. Mapping
those lectures to nearby chapters would be false taxonomy.

The next 21 chapter-specific Class 12/NEET playlists were checked with the
legacy single-chapter anonymous dry-run, totalling 184 usable videos. This was
discovery QA only: no v12 manifests were created and no production writes were
made.

| Playlist | Subject | Usable | Audit result |
| --- | --- | ---: | --- |
| Electromagnetic Induction | Physics | 6 | Review: no accepted teacher evidence |
| Haloalkanes and Haloarenes | Chemistry | 12 | Review: no accepted teacher evidence |
| Biotechnology Principles and Processes | Biology | 6 | Review: no accepted teacher evidence |
| Magnetism and Matter | Physics | 5 | Blocked: one duplicate video ID and no accepted teacher evidence |
| Molecular Basis of Inheritance | Biology | 10 | Blocked: canonical production chapter absent and no accepted teacher evidence |
| Magnetic Effects of Current | Physics | 8 | Review: no accepted teacher evidence |
| Human Health and Disease | Biology | 13 | Review: no accepted teacher evidence |
| Coordination Compounds | Chemistry | 12 | Blocked: duplicate lesson numbers 1 and 2 and no accepted teacher evidence |
| Capacitors | Physics | 6 | Review: no accepted teacher evidence |
| Reproductive Health | Biology | 6 | Review: no accepted teacher evidence |
| The d and f Block Elements | Chemistry | 7 | Review: no accepted teacher evidence |
| Principles of Inheritance and Variation | Biology | 11 | Review: no accepted teacher evidence |
| Current Electricity | Physics | 11 | Review: no accepted teacher evidence |
| Electro Chemistry | Chemistry | 8 | Review: no accepted teacher evidence |
| Electrostatic Potential | Physics | 6 | Review: no accepted teacher evidence |
| Chemical Kinetics | Chemistry | 7 | Review: no accepted teacher evidence |
| Sexual Reproduction in Flowering Plants | Biology | 8 | Review: no accepted teacher evidence |
| Human Reproduction | Biology | 14 | Review: no accepted teacher evidence |
| Solutions | Chemistry | 10 | Review: no accepted teacher evidence |
| Reproduction in Organisms | Biology | 4 | Blocked: canonical production chapter absent and no accepted teacher evidence |
| Electric Charges & Fields | Physics | 14 | Mechanical quality gate passed; exact faculty attribution still requires review |

Twenty playlists lack accepted teacher attribution. Two of those also need
additive canonical chapters, and two others have independent duplicate-data
blockers. Electric Charges & Fields is the
only mechanically clean result, but the audit used a placeholder teacher name:
its pass means the source supplies accepted teacher evidence, not that the
faculty identity has been verified for an import. Every candidate therefore
remains non-importable until its stated review is completed.

The four `UMEED 2.0 | NEET 2022` subject playlists were reviewed next:
Zoology (21), Chemistry (36), Botany (23), and Physics (30), totalling 110
usable videos with no source count shortfall. The rules-only mapping pass
produced 61 automatic mappings, 19 review-required mappings, and 30 unmatched
rows.

No manifests were retained. The playlists mix chapter lectures with post-exam
proof/reaction and paper-analysis videos, which are not chapter courses.
Several real lectures also require canonical chapters absent from production,
including Digestion and Absorption, Animal Tissues, Animal Husbandry, Transport
in Plants, Mineral Nutrition, Molecular Basis of Inheritance, Environmental
Issues, Polymers, and Environmental Chemistry. Other unmatched rows use legacy
Physics/Chemistry chapter names that require explicit editorial mapping.
Silently omitting the non-lecture rows or forcing missing chapters into nearby
taxonomy would misrepresent the source. This family is deferred pending a
deliberate editorial subset and any required additive chapter work.

The Chemistry portion of `RAFTAAR` was then reviewed as a bounded batch:
Environmental Chemistry, Equilibrium, Hydrocarbons, Thermodynamics and
Thermochemistry, State of Matter, p-Block, s-Block, Hydrogen, Redox Reactions,
Chemical Bonding, Periodic Classification, Atomic Structure, Mole Concept, and
General Organic Chemistry. All 112 advertised videos across the 14 playlists
were public and usable.

The rules-only pass produced 25 automatic mappings, 75 review-required
mappings, and 12 unmatched rows. No manifests were retained. The family
contains shared live-practice videos that intentionally span adjacent chapters,
while several source names do not align one-to-one with the current canonical
catalogue. The pass also demonstrated why automatic acceptance is unsafe:
`Environmental Chemistry` was falsely proposed as `Hydrocarbons`, and individual
Periodic Classification, Chemical Bonding, and GOC rows were proposed under
unrelated chapters based on incidental title words. The Chemistry RAFTAAR
batch is deferred pending per-video editorial mapping, a decision for
multi-chapter practice sessions, canonical Environmental Chemistry coverage,
and later teacher-evidence verification.

The Physics portion of `RAFTAAR` was reviewed next: Wave Motion, Oscillations,
Thermodynamics, Kinetic Theory of Gases, Thermal Properties of Matter,
Mechanical Properties of Fluids, Mechanical Properties of Solids, Gravitation,
Rotational Motion, Centre of Mass, Work/Energy/Power, Laws of Motion, Motion in
a Plane, Motion in a Straight Line, and Units and Measurements. All 102
advertised videos across the 15 playlists were public and usable.

The mapping pass produced 46 automatic mappings, 44 review-required mappings,
and 12 unmatched rows. No manifests were retained. Many review flags are unsafe
false positives caused by generic words such as `motion`, while shared practice
videos intentionally combine adjacent chapters. The source also has a concrete
cross-subject contamination: the same p-Block Chemistry quiz appears in both
the Rotational Motion and Centre of Mass playlists. Even otherwise clean
chapter runs cannot be approved until those shared/contaminated rows are
handled explicitly and teacher evidence is verified. The Physics RAFTAAR batch
therefore remains deferred rather than silently dropping or misclassifying
source videos.

The Biology portion of `RAFTAAR` completed the family review. It covers 22
chapter playlists from Plant Kingdom through Structural Organisation in
Animals; all 101 advertised videos were public and usable. The mapping pass
produced 75 automatic mappings, 23 review-required mappings, and 3 unmatched
rows.

Sixteen playlists mapped completely without a review flag. Morphology of
Flowering Plants, Excretory Products and Their Elimination, and Structural
Organisation in Animals need straightforward editorial confirmation of
source-versus-canonical naming. Digestion and Absorption, Mineral Nutrition,
and Transport in Plants cannot proceed because those canonical chapters are
absent; the mapper's nearby alternatives are false and must not be accepted.
No manifests were retained at this discovery gate. The clean Biology subset is
a strong follow-up candidate for teacher-evidence dry-runs, while the three
missing-chapter playlists remain deferred pending additive taxonomy work.

Anonymous production dry-runs were then completed for all 16 automatically
mapped Biology RAFTAAR playlists, using a deliberately non-matching placeholder
teacher so the quality gate had to rely on source evidence. All 75 videos
matched their advertised counts and passed duplicate-ID, duration, embedding,
and existing-chapter checks.

Three playlists, totalling 14 videos, passed the automated source-evidence
gate: Chemical Coordination and Integration (4), Neural Control and
Coordination (6), and Anatomy of Flowering Plants (4). The other 13 playlists,
totalling 61 videos, returned `review` solely because no accepted teacher
attribution was found. None was blocked mechanically. No manifest was retained:
even the three automated passes still need exact faculty identity confirmed
before an honest course record can be prepared.

That faculty review is now complete for the three passing playlists. All four
Chemical Coordination lessons and the first three Neural Control lessons
explicitly credit `Diksha Sharma ma'am` in their YouTube descriptions, with no
conflicting attribution in the continuation lessons. All four Anatomy lessons
credit `Yashika ma'am`; the official PW NEET faculty listing identifies her as
`Yashika Singh Ma'am`.

Fresh anonymous single-chapter dry-runs using `Diksha Sharma Ma'am` and
`Yashika Singh Ma'am` returned `ok` for all three playlists: 4/4 Chemical
Coordination, 6/6 Neural Control, and 4/4 Anatomy. Counts, ordering, chapters,
durations, embedding, and teacher evidence passed with no review or blocking
finding. These are single-chapter sources, so the importer correctly rejects a
multi-chapter manifest; no manifest is required or retained. Production remains
unchanged pending a separate import authorization.

The six subject-specific `Prashnakal Series` playlists were reviewed next:
Inorganic Chemistry (6), Zoology (11), Organic Chemistry (12), Physical
Chemistry (9), Physics (27), and Botany (15), totalling 80 public and usable
videos. The mapping pass produced 28 automatic mappings, 16 review-required
mappings, and 36 unmatched rows.

No manifests were retained. These are question-practice compilations in which
many individual videos intentionally combine two or more chapters; later rows
expand to complete-class or full-syllabus mock tests. Every subject playlist
also contains the same general NEET 2021 paper discussion, which has no honest
single-chapter placement. Assigning only the first recognized chapter would
hide most of each video's scope. Prashnakal is therefore deferred pending
multi-chapter video taxonomy or an explicitly approved narrower editorial
selection.

The older long-form crash-course block was reviewed next: Physics (46),
Zoology (21), Botany (35), Physical Chemistry (16), Inorganic Chemistry (12),
and Organic Chemistry (19). All 149 advertised videos were public and usable.
The mapping pass produced 88 automatic mappings, 20 review-required mappings,
and 41 unmatched rows.

No manifests were retained for the complete playlists. Most rows are genuine
chapter lectures, but the sources also append broad `Last Time Revision`
sessions and the same general NEET 2021 paper discussion. Other blockers are
legacy chapters absent from the current catalogue, including Digestion and
Absorption, Mineral Nutrition, Transport in Plants, Molecular Basis of
Inheritance, Environmental Issues, Environmental Chemistry, and Polymers.
Several Physics and Organic Chemistry titles also need explicit canonical-name
review. This family is a candidate for a carefully documented lecture-only
subset, not a whole-playlist import that silently assigns or drops the broad
closing videos.

The Chemistry portion of the older `PACE SERIES` was checked next: Redox
Reaction (5 advertised), Mole Concept (13), Isomerism (5), IUPAC (5), Atomic
Structure (18), General Organic Chemistry (9), and Periodic Properties (11).
Although the seven playlist records still advertise 66 videos in total,
YouTube returned zero public and usable entries for every playlist. No
manifests can be prepared from unavailable source videos, and none were
retained. These playlists are deferred unless their visibility changes; the
advertised counts must not be mistaken for importable lectures.

The nine Physics `PACE SERIES` playlists have the same availability failure:
Mechanical Properties of Solids (1 advertised), Gravitation (3), Rotational
Motion (8), Centre of Mass (5), Work/Energy/Power (5), Newton's Laws of Motion
(10), Motion in a Plane (6), Basic Mathematics (2), and Motion in a Straight
Line (5). Their records advertise 45 videos in total, but every playlist
returned zero public and usable entries. No manifests were retained; the
Physics PACE sources are deferred unless visibility changes.

The 13 Biology `PACE SERIES` playlists complete the same pattern: Neural
Control (3 advertised), Morphology (4), Biological Classification (5), Plant
Growth (4), Respiration (3), Photosynthesis (4), Plant Kingdom (5), Transport
in Plants (4), Locomotion (4), Excretion (4), Circulation (5), Breathing (4),
and Cell Cycle (3). All 52 advertised entries are currently unavailable; every
playlist returned zero public and usable videos.

Across Chemistry, Physics, and Biology, the 29 NEET-relevant PACE playlists
advertise 163 videos but expose zero usable source entries. The JEE-only
Mathematics PACE playlists were intentionally excluded from this NEET audit.
No PACE manifest was retained and no import should be attempted from metadata
counts alone.

## Enumeration reconciliation

The remaining named curriculum residuals were reconciled before closing this
pass. `Biology | NEET - Vardaan Series` is not missing: its reviewed six-video
manifest is already checked in, and the current read-only production catalogue
reports it as course `91` with all six lectures and complete metadata. A fresh
automatic pass left three generic titles unmatched, confirming why the
existing manual mappings must be preserved rather than redrafted.

`Most Important Concepts and PYQs | NEET 2022` exposes four usable videos but
mixes Physics, Botany, and Organic Chemistry in one playlist; it cannot be one
truthful subject course. `NEET Test Series: Video Solution` exposes three
full-test solution videos with no chapter identity. Neither source received a
manifest.

The other residual collections are intentionally non-course sources: the
dynamic `Recent Uploads` aggregation, NEET results, one-minute concept clips,
Shorts, and JEE-only Vardaan/PACE Mathematics playlists. This completes the
structured triage of the 218-playlist enumeration without treating every
channel collection as a missing NEET course.

## Safe next gates

1. Review the four clean manifests and import only with a separate owner gate.
2. Add/verify teacher evidence for Inorganic Chemistry and Zoology without
   weakening the global quality gate.
3. Create the missing Botany chapter only through the established additive
   chapter workflow, then repeat its anonymous dry-run.
4. Decide whether multi-teacher playlists need a data-model extension or should
   remain deferred; do not flatten the Vardaan faculty attribution.
5. Continue triaging the remaining unaudited public playlists; do not equate
   all channel uploads with curriculum lectures.
