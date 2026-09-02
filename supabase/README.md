# Supabase CLI migrations

This directory is the **ordered migration chain** for the production database
(`kezelafqhgqrprpadmlf`, project "youtube"). The baseline was pulled from the
live schema on 31 Aug 2026 and recorded in the remote migration history, so
`supabase db push` applies only what production does not already have.

## Current state (2 Sep 2026)

| File | Status |
| --- | --- |
| `20260831140005_production_baseline.sql` | **Applied** (it IS production — 66 tables, 181 functions, 98 RLS policies, recorded via `migration repair`). |
| `20260901120000_study_days.sql` | **Applied** 31 Aug 2026. Server copy of prep-streak study days (owner-only RLS, mirrors `video_progress`); the frontend sync woke up on its own when this landed. |
| `20260901160000_universal_search_materials.sql` | **Applied** 1 Sep 2026. `material` and `paper` groups in `universal_search`; notes, formula sheets and previous-year papers are findable from the main search box (verified live). |
| `20260902093000_study_material_paper_metadata.sql` | **Applied** 2 Sep 2026, verified live: all 183 paper rows classified (160 question papers / 14 answer keys / 9 with solutions), zero unclassified. The client column flip is the marked FOLLOW-UP in `src/useJeeMainPapers.js` / `src/studyMaterialLandings.js`. |
| `20260902122500_neet_ug_2025_papers.sql` | **Applied and recorded** 2 Sep 2026. Verified live: NEET UG 2025 went 0 → 4 papers (2024 stayed 2, 2026 stayed 4) and all four official NTA URLs are present. Data seed, no schema. The rows went in by hand from the `docs/sql` copy at 12:20 UTC, before this file existed, so for a while the data was live while the remote history did not record it. That gap is closed: `migration list` now shows local and remote both at `20260902122500`, and a `db push` at 13:11 UTC reported `Remote database is up to date` with nothing to apply. Body is the reviewed `docs/sql` package verbatim; `src/neetUg2025PapersSeed.test.js` fails if the copies drift. |
| `20260902170000_search_aliases.sql` | **Applied** 2 Sep 2026 via `db push`, first of the two. Verified live against the RPC, same query and limit before and after: `pnc` 0 → 25 (it returned nothing at all before, which is the failure this file was written for), `aod` 3 → 54, `rot mech` 13 → 50, `salt analysis` 42 → 59, `shm` 16 → 21. Teaches search the shorthand students say out loud (`shm`, `nlm`, `emi`, `ktg`, `moi`, `rot mech`, `pnc`, `aod`): ~39 seeded aliases in an admin-extendable table, plus `search_expand_aliases` / `search_rank_aliased`, and it re-emits `universal_search` to use them. Rehearsed on a real engine in `src/searchAliasesSqlRehearsal.test.js` (66 tests). Complementary to the client layer in `src/searchAliases.js`, whose 8 keys do not intersect these 32. |
| `20260902180000_universal_search_material_words.sql` | **Applied** 2 Sep 2026 via `db push`, second, in the same push as the alias file. Verified live: `notes` 24 → 74 and `pyq` 55 → 105, which is the deliberate behaviour change below landing as designed. Ordinary queries were re-checked in the same pass because both files re-emit `universal_search` itself — `physics` 83, `kinematics` 67, `class 12` 41, and the site answering 200. Refuses to run before the alias file — see the note below. Lets a student find a material by the word they call it: `pyq`, `notes`, `previous year paper` and `ncert notes` all returned nothing against 412 approved materials, because the pillars match on the title and the titles never say the kind. Adds two `IMMUTABLE` helpers, re-emits `universal_search` with the widened haystack in both pillars (rank **and** prefilter), and moves the two expression indexes onto the expression the prefilter now uses. Deliberate behaviour change: a bare `notes` now returns all 225 notes and sheets. |
| `20260902200000_link_verified_faculty_credits.sql` | **Applied** 2 Sep 2026 — confirmed by `migration list`, local and remote both at `20260902200000`. (This row said "staged, not applied, the ONLY pending file" for a while after it had in fact been pushed; that is the hazard the note under this table describes.) It touches no function the search migrations touch. Links 10 courses to faculty ALREADY in the registry, via `set_playlist_teachers`. It creates no teacher, alias or proposal, and leaves `faculty_credit_status` alone, because on production `identified` is a strict subset of linked (64 of 238) and so means a person confirmed the credit — which a name match has not. Deliberately NOT the other 158 unlinked courses: 132 of those have the CHANNEL name in `teacher` (linking them would file institutes as faculty) and 26 need an identity decision, several being more than one person. Rehearsed on a real engine in `src/facultySafeLinksSqlRehearsal.test.js` (11 tests, including a re-credited course, a de-verified teacher, a moved registry id, and a hand-curated link it must not overwrite). |
| `20260902210000_search_gap_log.sql` | **Applied** 2 Sep 2026 via `db push`, first of the two. Creates `search_gap_log` and the `log_search_gap` RPC. This is the push that switched the feature ON: there is no flag in `src/searchGapLog.js`, the caller was already deployed, and the only thing holding it back was the missing RPC. Verified live: the RPC returned PGRST202 before the push and succeeded after. The disclosure in `src/PrivacyPolicy.jsx` was already on `release` when it landed. |
| `20260902220000_repair_hindi_note_titles.sql` | **Applied** 2 Sep 2026 via `db push`, second. Verified live: approved rows containing a `?` went 33 → 1, and the one left is id 87, `How do Organisms Reproduce? - NCERT Science`, whose question mark is real punctuation. Spot-checked the two collision pairs, which are the rows a careless repair would have swapped — id 175 is `कबीर की साखी - NCERT स्पर्श` and id 204 is `माता का आँचल - NCERT कृतिका`, each matching its own chapter scope. Confirmed in a browser at code-point level: the search box now renders `तोप - NCERT स्पर्श` as U+0924 U+094B U+092A, not question marks. |
| `20260902230000_remove_search_gap_probe.sql` | **Staged, not applied.** Deletes one synthetic row, `___probe___`, written into `search_gap_log` by the RPC existence check run during the push above. `anon` can write to that table but not read it, so it could not be cleaned up the way it was made. Exact-match delete with a postflight that fails if the row survives. |

> **Why these two are one push, and in this order.** Both re-emit
> `universal_search` whole — Postgres cannot patch one expression inside a
> function body — so each is last-writer-wins, and `db push` orders them by
> timestamp. `180000` was parked because it had been re-emitted from the
> pre-alias `20260901160000` ancestor and would have silently reverted every
> curated shorthand on the next push, with no error anywhere.
>
> It is back because it has been rebuilt the way the parking note prescribed:
> **on top of** the alias body, widening that body's 12 title sites rather than
> the ancestor's 8. Three things now hold it there. Its preflight refuses to run
> unless `search_expand_aliases` and `search_rank_aliased` exist, so the pair
> cannot be applied out of order. Its self-verification aborts if the function it
> just wrote no longer calls `search_rank_aliased`. And
> `src/universalSearchMaterialWordsSqlRehearsal.test.js` now executes the real
> chain — baseline, `0901`, `170000`, then this — asserting all 31 seeded
> shorthands still resolve; putting the old body back fails 24 of its 49 tests.
>
> The lesson generalises: a per-file rehearsal cannot see this class of bug,
> because each file's own ancestor is not the chain production gets. A THIRD
> migration replacing this function must be re-emitted from the newest body,
> carry a preflight that refuses without its predecessor, and extend the chain
> rehearsal.
>
> `src/searchFeatureCarryOverSqlContract.test.js` is the standing guard for
> exactly this, and it covers **three** replaceable functions, not one:
> `universal_search` (the search box) plus `search_video_ids` and
> `search_playlist_ids` (the two /browse tabs), all of which the alias
> migration re-emits. Re-emit any of them and you must add your feature's
> marker to its `features` list, or the next author silently deletes your work.
> Note the second `search_video_ids` entry: its `order by
> search_rank_aliased(...)` is guarded on its own, because `src/useBrowse.js`
> reconstructs lecture relevance purely from the POSITION of each id in the
> returned array. Drop that ORDER BY and nothing errors — /browse just quietly
> serves database-id order under a control that says "Best match".
>
> This is now history rather than a plan: both were applied in one `db push` on
> 2 Sep 2026, in this order, and the safeguards were never tested in anger —
> nothing refused, nothing aborted, because the order was right. What was checked
> afterwards is the thing those safeguards exist to protect: the curated
> shorthands still resolve in production (`pnc` 0 → 25, `aod` 3 → 54) *and* the
> widened material words work (`notes` 24 → 74), so the second file composed with
> the first instead of reverting it.

### Parking, and why nothing is parked now (2 Sep 2026)

Nothing sits in `docs/sql/` waiting any more. Both files that were pulled out of
the chain are back in it, so this section is history — kept because the move is
worth reaching for again.

### Apply seeds through the chain, not by hand (2 Sep 2026)

Every paper and note seed before 2 Sep 2026 was applied by hand from
`docs/sql/`. For ASCII content that only cost the migration history its record
of what ran. For the two Hindi packages it cost the data: whatever client ran
them was not talking UTF-8, so all 32 titles and descriptions arrived with each
Devanagari character replaced by one `?`. The files were never wrong; the copy
in the database is.

Nobody noticed for four weeks, because those notes were unreachable from search
until `20260902180000` made them findable by the word "notes". Then they became
some of the first rows a Hindi-medium student sees.

**So: anything carrying non-ASCII text goes through `npx supabase db push`,**
which is UTF-8 end to end. The SQL Editor and ad-hoc clients are how this
happened.

A migration that carries non-ASCII text should also prove the encoding survived
the trip, the way `20260902210000` does — the check is one line, because a
Devanagari string takes more **bytes** than it has **characters**:

```sql
if length('तोप') = octet_length('तोप') then
  raise exception 'REFUSING: this connection is not UTF-8';
end if;
```

Without it, a repair run over a bad connection writes question marks over
question marks and reports success.

### Parked in `docs/sql/`, deliberately out of the chain (2 Sep 2026)

Two files were moved OUT of `supabase/migrations/` so that `search_aliases`
could be pushed on its own. `db push` has no per-file selection, so **a file
that must not run yet blocks every file behind it**. Parking the blocker, rather
than renumbering around it or reaching for `--include-all`, is what let the
finished work ship.

Both came back for their own reasons. `universal_search_material_words` was
rebuilt on top of the alias body, as its parking note prescribed, so it composes
instead of colliding. `search_gap_log` returned as `20260902210000` once the
condition its banner named was met: the owner decided the log should exist, and
the Privacy Policy now names the table. Its remaining gate is a deploy rather
than a merge — see its row above.


**Held deliberately OUTSIDE this directory:**
`docs/sql/awaiting-owner-decision/20260902164500_search_gap_log.sql` logs the
text of searches that return nothing. It is complete and tested, but it stores
free text typed by an audience that is largely under 18 and the Privacy Policy
does not mention it, so it needs the owner’s yes first. Because `db push`
applies everything pending at once, leaving it in `supabase/migrations/` would
have blocked every unrelated migration on that one decision. The banner inside
the file says how to ship it; `src/searchGapPrivacyContract.test.js` enforces
the order.

`npx supabase migration list` shows this local-vs-remote state at any time, and
it — not this table — is the authority. Several sessions add migrations on the
same day, so a file can land in `supabase/migrations/` before it has a row
here: on 2 Sep the table described one pending file while `migration list`
reported three. **Run `migration list` immediately before any push and read
what it returns**, rather than trusting a status written earlier — this table
told a reader that the NEET 2025 seed was still unpushed for some hours after
it had been recorded.

Every paper seed before this one — NEET UG 2024/2026 and the JEE sets — was
applied by hand straight from `docs/sql`, so nothing in the repository records
whether they ran; the answer still has to be fetched from production each time.
NEET UG 2025 is the first one staged in the chain, and it is now recorded, so
`migration list` can answer for it. Seeds staged the same way from here start
out answerable. Note what staging alone did **not** do: the 2025 rows were
already live by the time the file existed, so the file did not put them there —
it made their status checkable.

## How to apply what is pending

```
npx supabase db push
```

Push applies **every** pending migration in timestamp order — there is no
per-file selection. Review `migration list` first so you know exactly what
will run.

### When a held file is in the way

Sooner or later a file that must not run yet will sit in front of one you want.
**Do not reach for `--include-all`, and do not renumber a file to jump the
queue.** The ordering is not what is stopping you — whatever made that file
unsafe is, and it is just as unsafe applied out of order. Renumbering only
hides the hold from the next person to read `migration list`.

The supported move is to take the held file **out of the chain**: park it in
`docs/sql/` with a note saying what it is waiting on, and rename it back with a
fresh timestamp once that condition is met. That is the opposite of jumping the
queue — it makes the held file harder to apply, not easier — and it is what was
done on 2 Sep with `search_gap_log`.

Before parking anything, check what else re-emits the same objects. On 2 Sep
two pending files both re-emitted `public.universal_search`, and the later one
knew nothing of the earlier one's helpers: pushing the pair would have created
the alias table and then silently stopped calling it. Parking the first blocker
alone would have left exactly that pair pending and made a push *look* fine
while undoing the feature it was run for.

## How new schema changes work from now on

1. Write the change as `supabase/migrations/<UTC timestamp>_<name>.sql`
   (one migration = one concern, header comment saying what and why).
2. Apply it with `npx supabase db push`.
3. The SQL Editor is for **reading** (audits, verification) — not for schema
   writes. Anything applied outside this chain recreates the drift problem
   this directory exists to end.
4. `npx supabase db diff` is the standing drift detector (needs Docker; the
   dockerless fallback is comparing a fresh `db pull` against the chain).

## Notes from the baseline pull

- Machine prerequisites: the CLI's own `db pull`/`db dump` need Docker, which
  this machine does not have. The baseline was produced by running the CLI's
  exact dump recipe (`supabase db dump --dry-run`) through the portable
  PostgreSQL 17.6 `pg_dump` in `C:\Users\itiso\tools\pgsql-17` (kept for
  future pulls; safe to delete otherwise).
- The **polls backend was already live in production** (all `poll_*` tables
  are in the baseline), so no polls migration is staged here. Polls have
  since been switched on: `poll_mode()` is open and `RELEASE_FEATURES.polls`
  is `true` (see `docs/polls/POLLS_V1_ACTIVATION_RUNBOOK.md`). The database
  mode remains the real switch — the flag only decides which pages route.
- The long-mysterious `rls_auto_enable` production RPC is captured in the
  baseline and is benign: an event-trigger function that auto-enables row
  level security on any new table created in `public` (SECURITY DEFINER,
  pinned search_path, logs what it does). Note the CLI's dump format comments
  out `CREATE EVENT TRIGGER` statements themselves, so a from-scratch replay
  of the baseline would recreate the function but not re-bind the trigger —
  a known property of Supabase CLI baselines, recorded here so a future
  restore knows to re-create the event trigger by hand.

## Deliberately NOT in this chain

Two reviewed 2-Aug packages remain in `docs/sql/` because
`docs/codex_task_safety_checklist.md` requires a fresh gate + explicit owner
approval before they run:

- `docs/sql/complete_institute_guard_2026-08-02.sql` — closes the remaining
  institute-misattribution mutation paths.
- `docs/sql/search_lecture_subtitle_2026-08-02.sql` — de-duplicates 206
  byte-identical search result rows.

When approved, rename each with a fresh timestamp into `supabase/migrations/`
and apply through `db push`, so they join the ordered chain.
