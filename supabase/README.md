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
| `20260902180000_universal_search_material_words.sql` | **Staged, not applied.** Lets a student find a material by the word they call it: `pyq`, `notes`, `previous year paper`, `ncert notes` all returned nothing against 412 approved materials, because the pillars match on the title and the titles never say the kind. Adds two `IMMUTABLE` helpers, re-emits `universal_search` with the widened haystack in both pillars (rank **and** prefilter), and moves the two expression indexes onto the expression the prefilter now uses. Deliberate behaviour change: a bare `notes` now returns all 225 notes and sheets. Rehearsed on a real engine in `src/universalSearchMaterialWordsSqlRehearsal.test.js` (17 tests); the file's own `DO` block aborts the push if the wiring or either index is missing. |

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
