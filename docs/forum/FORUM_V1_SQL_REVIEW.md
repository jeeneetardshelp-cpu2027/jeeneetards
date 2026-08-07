# Forum v1 SQL review package

Status: **independent SQL review approved; rollback-only staging package ready**
Authorization: **not authorized for persistent staging or production application**

## Files

1. `src/migrations/forum_v1_preflight.sql` — read-only dependency and drift
   check. It refuses any partial forum installation.
2. `src/migrations/forum_v1.sql` — transactional additive schema and RPC
   candidate. It always starts with the forum `off`.
3. `src/migrations/forum_v1_postflight.sql` — read-only structural, grant,
   seed, and fail-closed checks.
4. `src/migrations/forum_v1_rollback.sql` — destructive rollback that refuses
   any database not explicitly marked `staging` or `test`.
5. `src/forumV1Source.test.js` — source and release-isolation contract.
6. `src/forumV1SqlRehearsal.test.js` — ephemeral PGlite execution and behavior
   rehearsal. It makes no network or Supabase connection.
7. `src/scripts/buildForumV1StagingRehearsal.js` — deterministic, offline
   staging-package builder.
8. `src/forumV1StagingPackage.test.js` — verifies the generated hashes,
   rollback boundary, genuine database roles, and full state restoration.
9. `staging/forum_v1_rehearsal/rollback_rehearsal.sql` — guarded, single-run,
   rollback-always rehearsal for a disposable staging clone.
10. `docs/forum/FORUM_USERNAME_LAUNCH_BLOCKER.md` — required application claim
    flow and existing-profile strategy for the later UI phase.

## What the schema creates

- `forum_settings`: remote `off / read_only / open` mode.
- `forum_topics`: the six approved launch topics.
- `forum_posts` and `forum_comments`: tombstones, moderation state, locks,
  solved state, bounded content, and bounded thread depth.
- `forum_votes`: exactly one post/comment target, one vote per student per
  target, private voter identity, and retained target-author attribution for
  reliable karma cleanup.
- `forum_user_stats`: rebuildable karma and contribution counts.
- `forum_reports`: forum-specific reasons, priority, deduplication, and a
  three-distinct-reporter auto-hide threshold. Self-harm reports are urgent and
  explicitly excluded from auto-hide.
- `forum_moderation_log`: append-only browser-facing audit boundary.
- `forum_suspensions`: temporary publishing suspensions.
- `forum_rate_events`: append-only evidence for database-enforced throttling;
  vote toggles and repeated edits cannot erase their own rate-limit history.

## Security model

Browser roles receive no direct table privileges. Anonymous and authenticated
students use bounded `SECURITY DEFINER` read RPCs. Authenticated write RPCs
derive `auth.uid()` themselves and enforce ownership, account age, username,
mode, suspension, rate limits, target visibility, locks, and edit windows.

Admin RPCs still call `public.is_admin()` internally. Granting EXECUTE only lets
an authenticated request reach that check; it does not confer admin status.

The database mode is enforced inside reads and writes:

- `off`: feed, topics, posts, and comments return no public rows; writes and
  reports are refused.
- `read_only`: public reading and safety reports remain available; publishing,
  editing, voting, and new comments are refused.
- `open`: reviewed forum operations are enabled.

The build-time frontend flag remains a separate release gate. Neither flag is
enabled by this package.

## Integrity decisions

- Vote triggers update upvotes, downvotes, net score, Hot rank, and karma in the
  same transaction.
- `forum_recount_metrics(false)` and `forum_recount_karma(false)` report drift;
  admin/service maintenance may explicitly request repair.
- Comment parents are constrained to the same post. A trigger calculates depth
  and rejects depth 11.
- Account deletion tombstones authored text before the profile is removed.
  Reply structure survives, vote attribution is cleared safely, and the deleted
  user's stats disappear.
- Permanent moderator removal cascades target votes and transactionally removes
  their karma contribution.
- The 10-minute account cooldown uses `auth.users.created_at`, not the editable
  public profile timestamp.

## Feed contracts

- Search treats backslash, percent, and underscore as literal characters. They
  cannot turn a student query into an `ILIKE` wildcard expression.
- `hot`, `top`, and `new` use separate, concrete `ORDER BY` clauses so their
  matching indexes remain usable. The stored Hot rank is not hidden behind a
  `CASE` expression.
- `p_cursor_id` is the cursor-presence marker. When it is supplied,
  `p_cursor_created_at` is required; `hot` also requires `p_cursor_hot`, and
  `top` also requires `p_cursor_score`. An incomplete cursor raises an explicit
  error instead of silently returning zero rows. `new` does not use a rank or
  score cursor field.

## Required next gate

Do not apply this package to the live Supabase project. The independent SQL
review is complete. The next safe step is to execute the generated
rollback-always package on a disposable staging clone, review its terminal
result, and confirm that the transaction restored the original state.

The rollback-only run uses genuine `authenticated` and `anon` PostgreSQL roles
as well as JWT claims. It cannot exercise a real PostgREST HTTP JWT because its
uncommitted schema is invisible to another connection. That API test remains a
separate gate after an explicitly approved persistent staging installation.
