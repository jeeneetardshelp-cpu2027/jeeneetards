# CBSE Class 10 Hindi B — Gate 1 evidence (2026-07-29)

## Scope

Gate 1 only: create the `Hindi B` subject and its 16 reviewed CBSE Class 10
chapters. No course/content import and no release push were performed.

## Source and preflight

- Pulled and verified `main` / `origin/main` at
  `46a0686cc917da4570a59776c794684969a119d0`, which contains the
  Unicode/Devanagari-capable manifest mapper.
- Production baseline immediately before the write:
  - playlists: 152
  - videos: 1,941
  - memberships: 1,945
  - chapters: 185
- `Hindi B` did not exist and none of the 16 exact chapter names collided.
- CBSE board id 1 and the `school` learning goal id 4 were present.
- JEE baseline: 83 courses, 1,307 memberships, fingerprint
  `d7aae3ce7635401ebeffe97e627048bc`.

## Applied artifact

- Artifact: `docs/sql/add_cbse_class10_hindi_b_reference_2026-07-29.sql`
- SHA-256:
  `716d116557d459a6a134f30bd10ea5d6dd90780179f26dae04aa5b1a6bdad474`
- The artifact is additive and guarded by the exact catalogue baseline and JEE
  fingerprint.
- The SQL editor submitted the transaction successfully once. A subsequent
  duplicate submission was rejected by the baseline guard; postflight confirms
  there is exactly one subject and one copy of each chapter.

## Result

- Subject created: `Hindi B` (id 12, slug `hindi-b`).
- Chapters created: 16 (ids 242–257), in reviewed order:
  1. कबीर की साखी
  2. मीरा के पद
  3. मनुष्यता
  4. पर्वत प्रदेश में पावस
  5. तोप
  6. कर चले हम फ़िदा
  7. आत्मत्राण
  8. बड़े भाई साहब
  9. डायरी का एक पन्ना
  10. तताँरा वामीरो कथा
  11. अब कहाँ दूसरे के दुख से दुखी होने वाले
  12. पतझर में टूटी पत्तियाँ
  13. कारतूस
  14. हरिहर काका
  15. सपनों के से दिन
  16. टोपी शुक्ला

Post-run catalogue:

- playlists: 152 (unchanged)
- videos: 1,941 (unchanged)
- memberships: 1,945 (unchanged)
- chapters: 201 (185 + 16)
- JEE: 83 courses / 1,307 memberships
- JEE fingerprint:
  `d7aae3ce7635401ebeffe97e627048bc` (unchanged)

## Validation

- `src/addCbseClass10HindiBReferencePlan.test.js`: 3 tests passed.
- SQL artifact checksum verified before application.
- Exact subject/chapter rows verified through a fresh read-only production
  query.
- JEE integrity verification passed.

Gate 2 was not started.
