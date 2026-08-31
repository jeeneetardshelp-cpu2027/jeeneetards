# Supabase CLI migrations

This directory is the start of the **ordered migration chain** the Phase-0/Phase-1
plan calls for. Nothing in here has been applied to any database — these are
staged files waiting on the owner's gate.

## One-time setup (owner, ~15 minutes)

`supabase init` has already been run (config.toml is committed). The remaining
steps need the owner's credentials, from the repo root (the CLI is available
as `npx supabase` — no install needed, and no Docker: this CLI version ships
its own diff engine):

```
npx supabase login                                    # opens the browser to approve
npx supabase link --project-ref kezelafqhgqrprpadmlf  # asks for the DATABASE password
npx supabase db pull                                  # snapshots the LIVE schema as the baseline
```

The database password is in Dashboard → Project Settings → Database (reset it
there if forgotten). When `db pull` asks to update the remote migration
history table, answer Yes — that records the baseline so `db push` never
tries to re-apply what production already has.

`db pull` writes a timestamped baseline file into `supabase/migrations/` that is
**dated before** the staged files below, so the chain replays in the right order.
Commit the baseline. From then on, **every** schema change lands here as a
numbered migration — never as ad-hoc SQL pasted into the dashboard.

After the baseline exists, `supabase db push` applies **every** staged
migration production does not have yet — there is no per-file selection. For
the two currently staged files that is safe by design: polls_v1 installs
fail-closed (`poll_mode()` stays `'off'`, nothing student-visible changes
until the activation runbook's later steps), and study_days only enables the
streak sync the frontend already ships dormant. Push deliberately, knowing
both will land together. `supabase db diff` is the standing drift detector.

## Staged migrations (in order)

| File | What it is | Gate |
| --- | --- | --- |
| `20260901110000_polls_v1.sql` | Student polls backend (verbatim copy of `src/migrations/polls_v1.sql`). Fail-closed: installs with `poll_mode()` = `'off'`. | Follow `docs/polls/POLLS_V1_ACTIVATION_RUNBOOK.md` end-to-end. `src/scripts/verifyPollsStagingReadiness.js` is the read-only preflight. After the SQL is live and `poll_mode()` is switched to `'open'` from the admin panel, flip `polls: true` in `src/releaseCapabilities.js` and deploy. |
| `20260901120000_study_days.sql` | Server copy of prep-streak study days (owner-only RLS, mirrors `video_progress`). The frontend already degrades to local-only streaks until this is applied. | Apply via `db push` once the baseline exists. |

## Deliberately NOT staged here

Two reviewed 2-Aug packages remain in `docs/sql/` because
`docs/codex_task_safety_checklist.md` requires a fresh gate + explicit owner
approval before they run:

- `docs/sql/complete_institute_guard_2026-08-02.sql` — closes the remaining
  institute-misattribution mutation paths.
- `docs/sql/search_lecture_subtitle_2026-08-02.sql` — de-duplicates 206
  byte-identical search result rows.

When approved, rename each with a fresh timestamp into `supabase/migrations/`
and apply through `db push`, so they join the ordered chain instead of being
hand-pasted.

## Rules

- The SQL Editor is for **reading** (audits, verification) — not for schema writes.
- `src/migrations/` and `docs/sql/` stay as the historical record; new work goes here.
- One migration = one concern, with a header comment saying what and why.
