# Faculty identity (Phase 4) — release gate

## Current status

The React UI, corrected SQL model, import wrappers, admin proposal review, and
automated component/contract tests are implemented locally and verified on a
real disposable Supabase staging project.

**The faculty SQL has not been run on production. It is not approved for
production.** The normal bootstrap and production builders still exclude it;
the isolated `build:faculty-staging` builder is the only builder that includes
the faculty migrations.

## Staging evidence — passed

- Corrected consolidated delta SHA-256:
  `c46d4123aa94f6e7ffd3aae424b7b35880c871e43c3110b789d245beb7f83b89`
- Final verifier run: `e7c325`
- Result: **19 passed, 0 failed**
- Fatal error: none
- Environment guard: passed (`app_environment = staging`)
- Cleanup: ran and confirmed zero fixture residue
- Production writes: none

The first real run (`e92a38`) exposed two defects that mocks did not: the
`[:alnum:]` normalizer removed Indic combining vowel marks, and unqualified
`similarity()` was unreachable through a deliberately empty search path. The
normalizer now replaces punctuation/whitespace instead, and the migration
discovers the installed `pg_trgm` schema and compiles a schema-qualified
`catalog_similarity()` wrapper. The corrected consolidated delta was applied
and the complete verifier passed afterward.

The redacted machine-readable evidence is in
`docs/faculty-test-report.redacted.json`.

## What the corrected model guarantees

- A normalized name or alias suggests candidates; it never proves identity.
- Two different teachers may share a display name and the same alias.
- Public search returns every tied candidate and marks the result ambiguous.
- Only verified aliases are visible to students.
- Scanning old `playlists.teacher` text creates proposals only. A human must
  approve, split, defer, or reject each group.
- Faculty imports accept IDs only and have three explicit meanings:
  omitted preserves links, `[]` clears links, and `[id, ...]` replaces links in
  teaching order.

## Disposable staging procedure

Do not reuse production and do not paste credentials into chat.

1. Create a new empty Supabase project used only for this test.
2. From the project folder, run:

   ```powershell
   npm.cmd run build:bootstrap
   npm.cmd run build:faculty-staging
   ```

3. In the new staging project's SQL Editor, run `staging_bootstrap.sql` first.
4. After it succeeds, run `faculty_staging_delta.sql`.
5. Copy `.env.staging.example` to `.env.staging` and fill in only the new
   staging URL, service key, and anon/publishable key. Keep `TEST_ALLOW=1`.
6. Run:

   ```powershell
   npm.cmd run verify:faculty
   ```

7. Keep the complete terminal output and `faculty-test-report.json` for review.
   Do not edit a failing test or migration before recording the first real
   error.
8. Delete the disposable staging project after the evidence is reviewed.

## What the verifier must prove

The suite refuses an unmarked or production database, then tests:

- Unicode/Devanagari normalization;
- duplicate acknowledgement without forced merging;
- two people sharing one display name and verified alias;
- public ambiguity and refusal to auto-resolve;
- proposed-alias privacy versus admin candidate search;
- direct REST alias RLS;
- proposal-only legacy scanning;
- invalid-faculty transactional rollback;
- preserve, clear, and ordered-replace import semantics;
- anon and signed-in non-admin authorization boundaries;
- exact cleanup with zero fixture residue.

The test is successful only when it exits `0`, reports no failed assertions,
and confirms cleanup. Run `e7c325` met all three conditions. Local Vitest tests
remain necessary but are not a substitute for this database evidence.
