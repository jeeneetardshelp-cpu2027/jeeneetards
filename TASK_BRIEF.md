# TASK BRIEF — remediation, in order

You are working on `edu-library`, a course-discovery site for Indian JEE/NEET students
(teenagers, cheap Android phones, patchy 4G). An independent audit found four launch-blockers.
This brief fixes them in dependency order.

Work **one phase at a time**. Do not start a phase until the previous phase's acceptance
criteria are met and reported. Do not batch phases together.

---

## GROUND RULES — these override any instinct to be helpful

1. **No production DDL.** You may WRITE migration SQL. You may NOT apply it to the production
   Supabase project. Applying SQL to production is the owner's decision, made by pasting it into
   the Supabase SQL editor himself. If a phase needs SQL applied, stop and say so.
   (This rule has been broken before: `browse_facet_counts` reached production despite its own
   file header reading "PREPARED, NOT APPLIED ... run nowhere". Do not repeat that.)

2. **Never create an archive containing `.env`.** `npm run pack:review` exists for this and must be
   the only way an archive is produced. A raw `.rar`/`.zip` of the folder leaks the service-role key.
   This has now happened twice.

3. **A green test suite is not evidence.** For every behavioural fix, you must prove the test is
   real: break the line the test guards, run the suite, show it goes RED, restore the line, show it
   goes GREEN. Paste both results. A test that stays green when you delete the code it covers is
   decoration and does not count as done.

4. **Never write a comment that asserts world-state.** Banned phrases in code and docs:
   "NOT APPLIED", "applied nowhere", "single source of truth", "production has not been changed",
   "verified". Every such claim currently in this repo is false. If a fact can go stale, put it in
   something a script checks, not in prose.

5. **Do not build anything whose backend is not deployed.** No new features. No new migrations
   beyond the ones named here. There are already 52 SQL files and no migration ledger.

6. **Report failures.** If something does not work, say so plainly with the error. Do not describe
   intended behaviour as achieved behaviour. Do not claim a step passed without pasting the output.

7. **Only one agent may write to this folder.** Do not run background processes that keep editing
   files after you report completion.

---

## PHASE 0 — OWNER ACTIONS (do NOT attempt these; just confirm they are done)

Ask the owner to confirm these before you begin. You cannot do them and must not pretend to.

- [ ] All other Codex/agent sessions writing to this folder are closed.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `YOUTUBE_API_KEY` rotated in Supabase / Google Cloud,
      and `.env` updated with the new values. (They leaked in `edu-library.rar`.)
- [ ] `C:\Users\hp\Documents\Codex\2026-07-21\explore-3\edu-library.rar` deleted, Recycle Bin emptied.
- [ ] A private remote repo exists (GitHub private) and you have the URL.

If any box is unchecked, stop and report which. Do not proceed.

---

## PHASE 1 — Safety net (nothing else is safe until this exists)

There is currently **no git repository**. There is no way to revert, diff, or review anything.

1. `git init` in this folder. Verify `.gitignore` already excludes `.env*`, `*.rar`, `*.zip`,
   `node_modules/`, `dist/` — it does; do not rewrite it.
2. **Before committing**, prove no secret is staged:
   `git add -A && git status --short` then
   `git diff --cached --name-only | grep -E '(^|/)\.env' ; echo "exit=$?"`
   Expect no `.env` match. Paste the output.
3. Commit. Add the private remote. Push.
4. Create `README-STALE.md` at `C:\Users\hp\Desktop\edu-library` saying that copy is abandoned and
   pointing here. (Verified: it has zero unique work — 43 shared files differ, none newer.)

**Acceptance:** `git log` shows one commit; `git ls-files | grep '\.env$'` returns nothing; push succeeded.

---

## PHASE 2 — Privilege escalation (the worst bug in the repo)

**The defect.** `community_schema.sql:202` is a whole-row self-UPDATE policy on `profiles`:
`for update using (auth.uid() = id) with check (auth.uid() = id)`.
`admin_policies.sql:18` adds `is_admin boolean` to that same self-writable row, and
`admin_policies.sql:24-35` makes `is_admin()` read it. Postgres RLS has **no column granularity**,
and Supabase grants `all on tables to authenticated` by default. There is no REVOKE, no column
grant, and no guarding trigger in any of the 52 SQL files.

So any account created from `StudentAuth.jsx` can run one PostgREST call with the public anon key:

```js
supabase.from('profiles').update({ is_admin: true }).eq('id', session.user.id)
```

…and become an administrator. That opens every admin RLS policy and every
`is_admin()`-guarded RPC — including `import_playlist`, `create_course`, `set_video_taxonomy`,
which `v6_2_grant_tightening.sql:24-27` deliberately grants to `authenticated` on the reasoning
that "their bodies enforce `is_admin()`".

**Write** `src/migrations/fix_profile_privilege_escalation.sql` containing:

- `revoke update (is_admin), insert (is_admin) on public.profiles from anon, authenticated;`
- a `before update` trigger on `public.profiles` that raises `42501` when
  `new.is_admin is distinct from old.is_admin` and `auth.role() <> 'service_role'`
  (mirror the style of `enforce_content_report_submission()` in `content_reports_hardening_v10.sql`)
- the same protection for INSERT
- a rollback file alongside it

Then **stop**. Do not apply it. Tell the owner to paste it into the Supabase SQL editor, and give
him a one-line verification query to run there.

**Write the test that proves it** — add to `src/scripts/verifyImport.js` as `AU6`:
create a normal (non-admin) user client, have it attempt
`.from('profiles').update({ is_admin: true })`, then **re-read the row with the service client and
assert the stored value is still `false`**.

> This detail matters: PostgREST returns HTTP 200 with zero rows when RLS filters an UPDATE.
> Asserting on `error` being non-null will pass even while the attack succeeds. Assert on the
> **stored value**, not the response.

**Acceptance:** migration + rollback written but NOT applied; AU6 written; you have shown AU6 fails
against the current (unfixed) staging database and would pass after the fix.

---

## PHASE 3 — The Class filter silently returns wrong results

**The defect.** `src/useCanonicalFilters.js:30`:

```js
const key = [c.goal.raw, c.subject.raw, c.chapter.raw, c.board].join("|");
```

Class is not in the key, and that key is the only dependency of the effect at line 108 that writes
`stage`. Because class is (correctly) orthogonal, clicking a class changes nothing else in the URL,
so the key never changes, the effect never re-runs, and `state.stage` keeps its mount-time value.
`Dashboard.jsx:314,353,544` feed that stale value into both the query and the facet counts.

Proof — these three URLs produce an identical key:

```
goal=jee&subject=physics            => stage=null      key="jee|physics||"
goal=jee&subject=physics&class=11   => stage=class-11  key="jee|physics||"
goal=jee&subject=physics&class=12   => stage=class-12  key="jee|physics||"
```

Result: a student clicks Class 12, sees Class 11 results, under a Class 12 chip, with counts that
agree. It behaves correctly on a fresh page load, so it is near-undiagnosable from a bug report.

**Fix.** Add `c.classSlug` to the key. Preferred alternative if it is clean: stop storing
`stage`/`board` in state at all — neither needs a database round trip, so both can be derived
directly from `params` on every render.

**Test.** The existing `classFilter.test.jsx` misses this because it passes `stage` in as a prop.
Add a test that drives the hook through a **URL change** (`rerender` with new search params) and
asserts the issued query predicate changes from `class-11` to `class-12`.

**Acceptance:** new URL-driven test; and per Ground Rule 3, show it going RED against the current
`key` line and GREEN after the fix.

---

## PHASE 4 — Stop shipping a doomed request on every page load

**The defect.** `releaseCapabilities.js` declares `facultyRegistry: false` and its header comment
describes this exact bug. `Dashboard.jsx:542` correctly gates comparison with
`RELEASE_CAPABILITIES.comparison`. But `Dashboard.jsx:509` renders `<FacultyFilter>`
**unconditionally**, so every `/browse` load in production fires `get_faculty_facets` and gets a
**404** — confirmed against the live production build.

**Fix.** Gate `<FacultyFilter>` on `RELEASE_CAPABILITIES.facultyRegistry`, the same way comparison
is gated. Then audit every other `supabase.rpc(...)` call site in `src/` and confirm each one is
either deployed in production or gated. List what you checked.

**Also fix (small, verified):**
- `src/Compare.jsx` contains a raw NUL byte at offset **13806**. It makes `grep`/`rg` treat the file
  as binary and silently skip it. Strip it.
- `#13919B` under white text is **3.78:1** — every primary CTA fails WCAG AA. `MinimalUI.jsx:336`
  already uses a passing teal. Pick one accessible value and use it everywhere.

**Acceptance:** `/browse` in a production build issues **zero** failing requests — prove it by
listing network responses with status >= 400 and showing the list is empty.

---

## PHASE 5 — Legal and accounts

**Placeholders.** `LegalPage.jsx` and `PrivacyPolicy.jsx` still contain `[Lecture Library]`,
`[date]`, `[your hosting provider]`, `[hello@yourdomain.com]`.

**Worse than placeholders:** the privacy policy is factually false. It says nothing is required to
use the site, while the app runs `supabase.auth.signUp` (`StudentAuth.jsx:24`), collects free-text
reviews (`CourseRating.jsx`), writes free text plus `reporter_id` to `content_reports`
(3 real production rows), and stores watch history in `localStorage`.

**Do:**
1. Produce `docs/legal_release_inputs.md` — a numbered list of the exact facts only the owner can
   supply (legal entity name, contact email, postal jurisdiction, hosting provider, effective date).
   **Do not invent any of these.**
2. Rewrite the privacy policy body to describe what the code actually does. Enumerate the real data:
   Supabase Auth accounts, ratings tied to a user id, report free-text + `reporter_id`,
   `localStorage` progress key, sessionStorage scroll keys, YouTube embeds, Vercel/Supabase logs.
3. Add **sign-out** to the student surface (currently `signOut` appears only in `AdminPanel.jsx`)
   and `resetPasswordForEmail` + a `/reset` route. Users share family and school computers.

**Acceptance:** `npm run verify:frontend-release` passes for everything except the owner-supplied
facts, which are listed as outstanding.

---

## PHASE 6 — The actual unlock: a Manage tab

This is why the catalogue cannot grow. There are 7 playlists, and **no way to correct a mistake**:

- the admin panel cannot edit or delete anything (the only `.update()` in admin code is report status)
- re-importing compounds errors: merge is `coalesce(existing, new)` so a wrong non-null value wins;
  junction inserts are `on conflict do nothing` so a corrected class level is *added alongside* the
  wrong one; `import_playlist_v4.sql:360` never updates `chapter_id`, so a wrong chapter is
  unfixable through any shipped interface

Build an admin **Manage** tab: paginated playlist list, edit taxonomy + metadata, delete, and
per-video chapter reassignment.

Most of the backend already exists and the UI never calls it — `set_video_taxonomy()` and
`clear_video_taxonomy()` have **zero references in `src/`**, and `import_playlist(payload, mode)`
has a `replace` branch. Check what is deployed in production before building UI against it; if a
needed RPC is not deployed, write the migration and stop (Ground Rule 1).

**Acceptance:** you can correct a wrong chapter, a wrong class level and a wrong language on an
existing playlist entirely through the UI, against staging. Demonstrate one of each.

---

## PHASE 7 — Ingestion

`importChannel.js` omits `content_type`, `language` and `difficulty` entirely. Import 500 playlists
today and you get 500 courses invisible to three of your eight filters — including language, the
single most important axis for an Indian student.

1. Add those three fields to the importer's prompts and payload.
2. Register the ingestion scripts in `package.json` (`import`, `backfill`) — currently none of the
   28 scripts ingest content, so they are not discoverable via `npm run`.
3. Run the importer end-to-end against **one real channel** and replace the seed placeholder
   `UC_PASTE_YOUR_CHANNEL_ID` in `institutes_channels`.

**Also:** `applyMetadata.js:25-28`, `applyClassification.js:27-35` and `classifyExisting.js:40-50`
each rewrite **every** playlist unconditionally, and `applyClassification.js` prints a success
banner even when it errors. Run any of them at 200 playlists and the whole catalogue becomes
`advanced`/`hinglish`. Either delete them or gate them behind `--confirm` plus a row-count assertion.

**Acceptance:** one real channel imported with all three metadata fields populated; blanket scripts
gated or deleted.

---

## REPORTING PROTOCOL

After each phase, report in this shape. Keep it short and factual.

```
PHASE <n> — <done | blocked>

Changed:      <files, with line numbers>
Command:      <exact command run>
Output:       <pasted, not summarised>
Mutation test: <line broken> -> RED (<n> failed) -> restored -> GREEN (<n> passed)
Not done:     <anything you could not finish, and why>
Needs owner:  <anything requiring the SQL editor, a key, or a real-world fact>
```

Do not write "verified", "complete" or "production-ready" anywhere. State what you ran and what it
printed, and let the owner draw the conclusion.

---

## OUT OF SCOPE — do not touch

- Teacher aliases / `teachers_v7` — not deployed, not needed
- Universal search — its RPC is absent from production and nothing links to `/search`
- Comparison — capability is correctly `false`
- Board classification — the `playlist_boards` junction does not exist
- Facet-count changes — `browse_facet_counts` is already (wrongly) in production; leave it alone
- Any new migration not named in this brief
