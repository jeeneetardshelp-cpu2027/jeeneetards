# Competishun+ Rank Boosters production import evidence — 2026-07-31

## Scope and source

Owner-approved split of the mixed Competishun+ `Rank Boosters` source into
three subject-scoped, create-only courses. The real YouTube playlist ID remains
unclaimed because the database enforces a unique playlist source ID; each split
course therefore uses the established `youtube_playlist_id = null` convention
while preserving the source title and reviewed Competishun+ attribution.

The guarded SQL artifacts were committed before execution and copied back from
the authenticated production SQL editor for an exact SHA-256 comparison before
each write:

1. Mathematics — `afc28bd060d630daf817ff77d6fba4373d8ec41976d183ec22ee5114a4b740f5`
2. Physics — `ecabdd6b3cd413a2d084c6cafb14f13edd6aab3c24bc03b631bd0ca0e9494c9f`
3. Chemistry — `6e9426c5520ccd3c0fa33a4ed8058027e7389bb396b2d06c62b4b90192b90a81`

All three transactions completed with `Success. No rows returned`.

## Baseline

- Catalogue: 288 playlists / 3,071 videos / 3,077 memberships / 241 chapters
- Protected original JEE set: 83 courses / 1,350 memberships
- Protected fingerprint: `6829fcb6eae22479db7b82b7b3da654d`
- Rolling JEE set: 163 courses / 1,877 memberships
- Rolling fingerprint: `e01c1ccb77087528656871f9f32fa030`
- All 12 selected source videos were absent.
- All three target titles were absent.
- The real source playlist ID was unclaimed.

## Import results

### 1. Mathematics

- Course ID: 299
- Title: `Rank Boosters — Mathematics`
- Source ID: null
- Delta: +1 course / +3 videos / +3 memberships / +0 chapters
- All 3 videos have one membership and `embedding_status = allowed`.
- Catalogue: 289 / 3,074 / 3,080 / 241
- Protected JEE: 83 / 1,350 / `6829fcb6eae22479db7b82b7b3da654d`
- Rolling JEE: 164 / 1,880 / `84d374b03b18ec43fc7c04dff0346dcd`

### 2. Physics

- Course ID: 300
- Title: `Rank Boosters — Physics`
- Source ID: null
- Delta: +1 course / +4 videos / +4 memberships / +0 chapters
- All 4 videos have one membership and `embedding_status = allowed`.
- Catalogue: 290 / 3,078 / 3,084 / 241
- Protected JEE: 83 / 1,350 / `6829fcb6eae22479db7b82b7b3da654d`
- Rolling JEE: 165 / 1,884 / `e99cca3b83eb2fe0e0a472e8ecb3fd2a`

### 3. Chemistry

- Course ID: 301
- Title: `Rank Boosters — Chemistry`
- Source ID: null
- Delta: +1 course / +5 videos / +5 memberships / +0 chapters
- All 5 videos have one membership and `embedding_status = allowed`.
- Catalogue: 291 / 3,083 / 3,089 / 241
- Protected JEE: 83 / 1,350 / `6829fcb6eae22479db7b82b7b3da654d`
- Rolling JEE: 166 / 1,889 / `7b1e9be740b8f68f092ead95f19120ec`

## Final integrity result

- Exact total delta: +3 courses / +12 videos / +12 memberships / +0 chapters
- Video reuse: 0 (every imported video has exactly one membership)
- Source-ID reuse: 0 (all three courses have null source IDs; the real source
  playlist ID remains unclaimed)
- Protected original-83 fingerprint: unchanged after every transaction
- No update, delete, schema migration, or `release` push was performed.
