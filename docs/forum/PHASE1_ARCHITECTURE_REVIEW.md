# Forum Phase 1 architecture review

Status: **step 7 release-candidate verification passed; forum flag remains off pending release approval**
Target: the existing `edu-library` React/Vite/Supabase application
Reference prototype: sibling `jeeneetard-forum` project (reference only; not deployable)

## Outcome

The forum will be implemented inside `edu-library`. It will reuse Supabase Auth,
`public.profiles`, the student authentication surface, theme tokens, AppShell,
admin authorization, and the existing release/staging discipline.

The Next.js/Prisma prototype must not be deployed or connected to production.
Its product behaviour and pure helpers may be ported selectively; its Prisma
schema, Next routes, server auth, shadcn components, TypeScript, and Tailwind 3
styles must not be copied.

## Accepted decisions

1. Public reading requires no account. Posting, commenting, voting, editing,
   deleting, and reporting require a signed-in Supabase user.
2. Forum authors use `public.profiles.id` (`uuid`). There is no second user or
   authentication table.
3. New tables use the `forum_` prefix and additive migrations.
4. Launch topics are Physics, Chemistry, Mathematics, Biology, Strategy, and
   Exam & Admissions. `Motivation` remains inactive until a verified crisis
   response path and named human owner exist. A catch-all General board is also
   deferred until the first moderation load is understood.
5. Launch includes New, Top, and Hot. Hot uses the reviewed Reddit-style rank,
   stored on each post and recomputed transactionally when the score changes.
6. Store `upvote_count`, `downvote_count`, and net `score` from day one. This
   preserves the option of a controversial sort without exposing voter identity.
7. Launch uses Solved at the post level, not an accepted-answer pointer.
8. Comment depth is structurally capped at 10; visual indentation is capped at
   6. Deleting a parent produces a tombstone instead of deleting its replies.
9. Author foreign keys use `on delete set null`. Account deletion anonymizes
   authorship without erasing other students' thread context. A separate content
   erasure path can tombstone or purge the requesting student's bodies.
10. No arbitrary remote image URLs at launch. They create tracking, privacy,
    availability, and unsafe-content risks. A later version can use a bounded,
    moderated Supabase Storage upload flow.
11. Moderation ships before public writing: report, hide, restore, lock, unlock,
    narrowly-scoped permanent removal, suspension, and an append-only audit log.
12. All score/counter changes and moderation actions happen in database
    transactions through narrowly granted RPCs. The client cannot directly set
    author, score, rank, counter, moderation state, or timestamps.

## Corrections to the Claude handoff

### Release shutdown

`RELEASE_FEATURES` is a JavaScript constant bundled at build time. Changing it
requires a deployment, so it is not an emergency remote kill switch.

The forum needs two controls:

- A build-time `RELEASE_FEATURES.forum` flag, initially `false`, preventing
  unfinished UI links from shipping.
- A database-backed forum mode with `off`, `read_only`, and `open`, defaulting
  to `off` on lookup failure. Forum write RPCs enforce the mode themselves.
  Public feed/thread reads must also pass through policies or RPCs that respect
  it, so a student cannot bypass the disabled UI with direct REST calls.

This supplies a genuine no-deploy emergency control while retaining the
repository's explicit release contract.

### Signup state

The project owner directly verified production project `kezelafqhgqrprpadmlf`
in the Supabase dashboard on 2026-08-06. New-user signup is on; anonymous
sign-in and manual linking are off; Confirm email is on and persisted after a
dashboard reload. The dated evidence is
`docs/browse_only_auth_evidence_2026-08-06.json`, which supersedes the stale
2026-07-23 signup snapshot for current-state decisions.

The production email-confirmation launch gate is therefore closed. This record
is owner-reported; Codex did not change any production Auth setting.

### Vote uniqueness

Partial unique indexes are the clearest implementation:

- unique `(voter_id, post_id)` where `post_id is not null`
- unique `(voter_id, comment_id)` where `comment_id is not null`
- a check requiring exactly one target

The handoff overstates the weakness of two ordinary unique constraints when an
exactly-one-target check is also present; together they can enforce uniqueness.
The partial form is still preferred because it directly expresses each target
and keeps each index smaller.

### Reports

The existing `content_reports` table has narrow checks limited to videos and
playlists. Expanding it would couple two different moderation lifecycles and
complicate its already-deployed trigger. Phase 1 will use `forum_reports` with
the same proven RLS, advisory-lock, deduplication, and rate-limit pattern, while
the admin UI may present both sources in one queue.

## Planned database package

The owner subsequently authorized a local SQL design package, but no staging or
production application. That package proposes:

- `forum_settings`
- `forum_topics`
- `forum_posts`
- `forum_comments`
- `forum_votes`
- `forum_user_stats`
- `forum_reports`
- `forum_moderation_log`
- `forum_suspensions`
- RPCs for feed/thread reads, post/comment writes, voting, reporting, author
  tombstones, moderation, recounting, and rank backfill
- RLS, grants, triggers, constraints, indexes, preflight, postflight, rollback,
  and disposable-staging verification

Base tables will not receive broad client update privileges. Public reads will
return only the public author handle required by the forum and never email or
moderation-only fields.

## UI package after database staging passes

- `/forum`
- `/forum/post/:postId`
- `/forum/submit`
- App router, edge middleware, metadata, navigation, footer, sitemap, and route
  contract updates in the same change
- existing `StudentAuth`, `useSession`, AppShell, Footer, and theme tokens
- JavaScript ports of `normalizeDisplayMath`, the flat-row comment-tree helper,
  and their tests
- one safe Markdown/KaTeX renderer shared by published content and preview
- local draft preservation, accessible vote/collapse states, and 360 px checks
- no `.reveal` use unless the page owns and tests a reveal root

## Launch gates

1. Live signup and email-confirmation settings verified on 2026-08-06. Signup
   is on; Confirm email is on and persisted after reload. — resolved by the
   project owner; no production setting was changed by Codex
2. `alecc.daddy` owns the moderation queue with a twice-daily review
   commitment. — resolved
3. Non-admin and anonymous adversarial RLS tests pass. — resolved in genuine
   staging Auth/PostgREST verification
4. Concurrent vote, rate-limit, recount, hidden-thread, lock, tombstone, and
   remote-kill-switch tests pass in disposable staging. — resolved across the
   reviewed SQL rehearsals and genuine staging JWT runs
5. Both themes, keyboard use, screen-reader states, formulas, XSS strings, and
   360 px layout are browser-verified. — resolved; see
   `FORUM_RELEASE_CANDIDATE_V1_REVIEW.md`
6. Privacy Policy and forum rules explain that posts are public and may be
   indexed before the composer is enabled. — resolved in the release candidate
7. The build-time flag remains off until the database, moderation queue, and
   live capability checks all pass. — verification passed; flag intentionally
   remains off pending a separate owner-approved release change

## Owner decisions approved on 2026-08-06

1. Six launch topics approved; Motivation and General are deferred.
2. A 30-minute edit window is approved. Deletion/tombstoning remains available
   afterward.
3. Public handles only are approved. `username` must be present before a student
   can post; `full_name` is not displayed in the forum.
4. The report-queue owner is `alecc.daddy`, with a twice-daily review
   commitment.
5. A small closed beta is approved before public launch.

The resulting local SQL design is documented in `FORUM_V1_SQL_REVIEW.md`.
