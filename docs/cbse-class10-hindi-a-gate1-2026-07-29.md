# CBSE Class 10 Hindi A — Gate 1 evidence (2026-07-29)

## Scope

Gate 1 only: create the `Hindi A` subject and its 17 reviewed CBSE Class 10
literature chapters. No course/content import and no release push were
performed.

## Source and preflight

- Pulled and verified `main` / `origin/main` at
  `cf1ee70b72266f4051407b4ff6fda554214ccd50`, which includes the
  Unicode/Devanagari-capable mapper.
- Production baseline from a fresh read-only connection and confirmed again in
  a fresh SQL editor:
  - playlists: 153
  - videos: 1,957
  - memberships: 1,961
  - chapters: 201
- `Hindi A` did not exist and none of the 17 exact chapter names collided.
- CBSE board id 1 and the `school` learning goal id 4 were present.
- JEE baseline: 83 courses, 1,307 memberships, fingerprint
  `d7aae3ce7635401ebeffe97e627048bc`.
- A stale SQL editor buffer was rejected with a syntax error before execution
  of the artifact. It made no write. The editor was cleared and the exact
  baseline was reconfirmed before applying the guarded transaction.

## Applied artifact

- Artifact: `docs/sql/add_cbse_class10_hindi_a_reference_2026-07-29.sql`
- SHA-256:
  `ab5d5c752ef624d90d7697a4673d882bada2efb97b95a58257a5bc74d439254b`
- The artifact is create-only and guarded by the exact catalogue baseline and
  JEE fingerprint.

## Result

- Subject created: `Hindi A` (id 13, slug `hindi-a`).
- Chapters created: 17 (ids 258–274), in reviewed order:
  1. सूरदास के पद
  2. राम-लक्ष्मण-परशुराम संवाद
  3. आत्मकथ्य
  4. उत्साह
  5. अट नहीं रही है
  6. यह दंतुरित मुसकान
  7. फसल
  8. संगतकार
  9. नेताजी का चश्मा
  10. बालगोबिन भगत
  11. लखनवी अंदाज़
  12. एक कहानी यह भी
  13. नौबतखाने में इबादत
  14. संस्कृति
  15. माता का आँचल
  16. साना-साना हाथ जोड़ि
  17. मैं क्यों लिखता हूँ

Post-run catalogue:

- playlists: 153 (unchanged)
- videos: 1,957 (unchanged)
- memberships: 1,961 (unchanged)
- chapters: 218 (201 + 17)
- JEE: 83 courses / 1,307 memberships
- JEE fingerprint:
  `d7aae3ce7635401ebeffe97e627048bc` (unchanged)

## Validation

- `src/addCbseClass10HindiAReferencePlan.test.js`: 3 tests passed.
- Exact subject/chapter rows verified through an independent read-only
  production query.
- JEE integrity verification passed.

Gate 2 was not started.
