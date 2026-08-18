# Unacademy NEET twenty-second-batch production import - 16 August 2026

## Outcome

Owner decision `fbf7b3a1-0a19-4dae-b5fe-d967b94f3a7c` was executed against
production project `kezelafqhgqrprpadmlf`. The three reviewed courses were
imported create-only, one at a time, after adding validated manifest-level
`course_title` support to the local importer. No chapter, normalized faculty,
quality-review, schema, deployment, or `release` change was made.

## Recovery and initial baseline

- Signed-in Supabase PITR advertised changes logged every two minutes with
  seven-day retention.
- Recoverable window began at `10 Aug 2026, 00:02:50` IST.
- The rollback point recorded before the import sequence was
  `16 Aug 2026, 10:31:34` IST. The signed-in page was refreshed during the
  sequence and advanced through `12:19:39` and `12:21:39` IST.
- Fresh initial catalogue at `2026-08-16T06:48:50.382Z`: 421 playlists / 4,746
  videos / 4,752 memberships / 263 chapters / 92 chapter-class rows.
- All three source-playlist collisions were empty.
- Protected original JEE: 82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`.

## Reviewed title support

- Local importer commit: `fc079d8` (`main` only).
- Optional `course_title` values are trimmed, required to be non-empty, limited
  to 160 characters, and rejected if they contain control characters.
- The reviewed title affects only the new playlist display title. YouTube
  playlist ownership, source snapshots, video IDs, chapter assignments,
  exclusions, and teacher evidence continue to be verified against the official
  source playlist.
- Targeted importer/readiness tests: 49 passed.
- The full suite had 2,424 passing tests and one unrelated existing failure in
  `src/SignInPage.test.jsx`, reproduced independently: the test expects an email
  form while the current release intentionally renders the accounts-unavailable
  state.

## Course 1 - Work, Energy and Power

- Source: `PLsgHooHkqhhOHzoncmAMTU9UgJiN1gtcp`.
- Source SHA-256:
  `98de0d309f7a62c295239e01315ff8d13e50fed5bb3f7327a8f4d76bf23fc908`.
- Manifest SHA-256:
  `5359ca045ea084d6d53c058aee2a849c353b9f8a632eedc0835247955c85f896`.
- Immediate anonymous dry-run: 13 published / 13 usable / 11 retained / 2
  reviewed quiz exclusions; 1 ok / 0 review / 0 blocked; source absent; chapter
  reused; v12 available.
- Result: course 441, +1 playlist / +11 videos / +11 memberships / +0 chapters,
  zero reuse.
- Scope: NEET only, Physics, Class 11, teacher `Mahendra Singh`, existing chapter
  21 (`Work, Energy and Power`).
- Post-import catalogue: 422 / 4,757 / 4,763 / 263. Protected JEE remained exact.

## Course 2 - Solutions

- Source: `PLsgHooHkqhhOkrbz6-7e8cnZ5bvtre4pk`.
- Fresh pre-run baseline: 422 playlists / 4,757 videos / 4,763 memberships / 263
  chapters / 92 chapter-class rows; source absent; protected JEE exact.
- Source SHA-256:
  `f99e2fe3494ca581b987d1d2310dc696686eb3a74e2872c5d4b22645cf4e6948`.
- Manifest SHA-256:
  `168b1c1b67e09dff873df557d981e0e48525fd2ed4ffdc48d0b34b52eb0620a2`.
- Immediate anonymous dry-run: 10 published / 10 usable / 6 retained / 4
  reviewed exclusions; 1 ok / 0 review / 0 blocked; source absent; chapter
  reused; v12 available.
- Result: course 442, +1 playlist / +6 videos / +6 memberships / +0 chapters,
  zero reuse.
- Scope: NEET only, Chemistry, Class 12, teacher `Anoop Vashishtha`, existing
  chapter 33 (`Solutions`).
- Post-import catalogue: 423 / 4,763 / 4,769 / 263. Protected JEE remained exact.

## Course 3 - Periodic Table

- Source: `PLsgHooHkqhhO9QF6HRyQYvV20hrDtCdKL`.
- Fresh pre-run baseline: 423 playlists / 4,763 videos / 4,769 memberships / 263
  chapters / 92 chapter-class rows; source absent; protected JEE exact.
- Source SHA-256:
  `94e242c2e5c4c876568cfdeec12cabc06831331e757538ef749e3e7a224a0431`.
- Manifest SHA-256:
  `38b76f705d97406203d7c722fda9cc230875e98ea645af55950be787fc537da0`.
- Immediate anonymous dry-run: 5 published / 5 usable / 5 retained / 0
  exclusions; 1 ok / 0 review / 0 blocked; source absent; chapter reused; v12
  available.
- Result: course 443, +1 playlist / +5 videos / +5 memberships / +0 chapters,
  zero reuse.
- Scope: NEET only, Chemistry, Class 11, teacher `Anoop Vashishtha`, existing
  chapter 41 (`Periodic Table`). Lesson positions render in reviewed natural
  L1-L5 order.

## Final postflight

- Final catalogue: **424 playlists / 4,768 videos / 4,774 memberships / 263
  chapters / 92 chapter-class rows**.
- Batch delta: **+3 playlists / +22 videos / +22 memberships / +0 chapters**.
- All 22 new video IDs have exactly one membership, in their corresponding new
  course. No video was reused.
- NEET catalogue: 270 courses. All three new courses carry only the `neet`
  learning goal and their reviewed class scope.
- Protected original JEE remained **82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`** after every write.
- Rolling JEE remained **212 courses / 2,848 memberships /
  `9eea2b44f0b19c08cc0907c57e091342`**.
- Normalized faculty links and quality-review transitions remain separate,
  unexecuted gates. No `release` push occurred.

## Deferred sources unchanged

`Solid State` remains excluded from the current canonical NEET/CBSE syllabus,
and the recorded incomplete or Phoenix-contaminated sources remain deferred.
No deferred source was imported or modified.
