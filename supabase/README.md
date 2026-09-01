# Supabase CLI migrations

This directory is the **ordered migration chain** for the production database
(`kezelafqhgqrprpadmlf`, project "youtube"). The baseline was pulled from the
live schema on 31 Aug 2026 and recorded in the remote migration history, so
`supabase db push` applies only what production does not already have.

## Current state (1 Sep 2026)

| File | Status |
| --- | --- |
| `20260831140005_production_baseline.sql` | **Applied** (it IS production — 66 tables, 181 functions, 98 RLS policies, recorded via `migration repair`). |
| `20260901120000_study_days.sql` | **Applied** 31 Aug 2026. Server copy of prep-streak study days (owner-only RLS, mirrors `video_progress`); the frontend sync woke up on its own when this landed. |
| `20260901160000_universal_search_materials.sql` | **Pending.** Adds `material` and `paper` groups to `universal_search`, so study notes, formula sheets and previous-year papers become findable from the main search box. The client half already ships and degrades to today's behaviour until this is pushed. |

`npx supabase migration list` shows this local-vs-remote state at any time.

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
- The **polls backend is already live in production** (all `poll_*` tables are
  in the baseline), so no polls migration is staged here. Activating polls is
  now only the runbook's remaining steps: switch `poll_mode()` to `'open'`
  from the admin panel, then flip `polls: true` in
  `src/releaseCapabilities.js` and deploy
  (see `docs/polls/POLLS_V1_ACTIVATION_RUNBOOK.md`).
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
