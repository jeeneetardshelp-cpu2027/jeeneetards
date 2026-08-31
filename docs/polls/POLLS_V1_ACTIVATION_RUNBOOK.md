# Polls v1 — activation runbook

Written for the site owner, in plain language. Nothing in this document has
been run yet. The code is merged and tested; the database module is **not**
installed anywhere, and the feature flag is **off**.

There are **two separate switches**, and both must be on before a student sees
a poll:

| Switch | Where | What it controls |
| --- | --- | --- |
| `RELEASE_FEATURES.polls` | `src/releaseCapabilities.js` (a code change + deploy) | Whether `/polls` is a real page and whether "Polls" appears in the top navigation |
| `poll_mode()` | Admin panel → **Polls** tab → *Poll mode* | Whether the database will actually serve or accept anything |

They are deliberately independent. The flag alone changes nothing except
routing; the database is the real boundary. This is the same arrangement the
forum uses, and it is why the forum being switched off did not require
deleting any code.

---

## What a student can do once it is on

- **Read and vote** — voting needs an account, reading does not.
- **See results only after voting.** Before you vote, the server does not send
  the numbers at all. This is enforced in SQL (`poll_results_visible`), not in
  the browser.
- **Comment** — needs an account and a chosen public username, same rule as
  the forum.
- **Share** — native share sheet on a phone, a WhatsApp link, or copy link.
- **Suggest a poll** — it goes into your review queue as `pending`. Nothing a
  student submits can publish itself; that is a database CHECK constraint, not
  just an application rule.

## What you have to do

Approve or reject submitted polls. A rejection **requires** a short reason,
which the student can then see on their own submissions — a rejection they
cannot learn from is just a silent deletion.

---

## Step 1 — Install the database module (staging first)

Run these in the Supabase SQL editor, **in this order**, and stop at the first
error:

1. `src/migrations/polls_v1_preflight.sql` — read-only. Changes nothing.
   Refuses if anything is already installed or if `forum_v1` is missing.
2. `src/migrations/polls_v1.sql` — the module itself. One transaction; if any
   statement fails the whole thing rolls back.
3. `src/migrations/polls_v1_postflight.sql` — read-only. Proves four things:
   the mode is `off`, browser roles have no direct table access, row-level
   security is on for every table, and no content exists.

If you need to undo it on staging: `src/migrations/polls_v1_rollback.sql`. It
**refuses to run on production** by design, and it only drops its own tables —
no forum row, profile or catalogue row is touched.

> **Prerequisite:** `forum_v1` must already be installed. Polls read
> `forum_topics` (so there is one subject list, not two) and
> `forum_suspensions` (so a student suspended from the forum is silenced in
> polls too). Production already has both.

## Step 2 — Turn the pages on

In `src/releaseCapabilities.js`, change:

```js
polls: false,
```

to `polls: true`, then deploy. Update the matching entry in
`src/releaseCapabilities.test.jsx` in the same change — that test exists
specifically to stop a flag moving without anyone noticing.

Turning this on also adds `/polls` to the sitemap and makes the page
indexable. Do **not** do this before step 1, or Google gets pointed at a page
that cannot load.

## Step 3 — Open the database

Admin panel → **Polls** tab → *Poll mode*:

- **Off** — nothing is readable. Shared links explain themselves.
- **Read only** — polls are readable, but no voting, commenting or submitting.
  A sensible place to sit for a day while you seed the first few polls.
- **Open** — everything is live.

## Step 4 — Seed a few polls

An empty poll page is a dead page. Because every poll needs an author, the
simplest way to seed is to submit two or three yourself from `/polls/new`
while signed in, then approve them in the Polls tab.

---

## The limits that are already in place

| Rule | Value | Where |
| --- | --- | --- |
| Poll submissions | 2 per student per day | `poll_submit` |
| Comments | 10/hour, 40/day | `poll_add_comment` |
| Votes | 60/hour, 300/day | `poll_cast_vote` |
| Reports | 10/hour, 30/day | `poll_submit_report` |
| Account age before contributing | 10 minutes | `poll_require_writer` |
| Votes per student per poll | 1, changeable while live | `poll_votes` primary key |
| Reports per student per item | 1 | partial unique indexes on `poll_reports` |

A refused submission does **not** spend a student's daily budget — the failed
statement rolls its own rate-limit record back with it.

## Pictures

Students may only link pictures from an approved host list, stored in
`poll_image_hosts` and seeded with:

- `i.ytimg.com`, `img.youtube.com` (YouTube thumbnails)
- `yt3.ggpht.com` (YouTube channel avatars)
- `upload.wikimedia.org` (the image host behind Wikipedia and Commons)
- `commons.wikimedia.org` (`Special:FilePath` links, which redirect to the above)
- `assets.openstax.org`, `openstax.org` (CC-BY textbook figures — physics,
  chemistry and biology diagrams, the closest free match to what these polls
  actually ask about)
- `cdn.kastatic.org` (Khan Academy article and exercise images)
- `ncert.nic.in` (the official syllabus authority these courses follow)
- `www.jeeneetard.com`, `jeeneetard.com` (this site — anything an admin puts in
  `public/` is reviewed by definition)

This is not about tidiness. An arbitrary link lets the submitter **swap the
image after you approve the poll**, and the audience is 14–18. The allowlist
means a student can only point at hosts where that is not practical.

### The rule for adding a host

Ask one question, and it is **not** "is this site reputable":

> Can the student who submitted the poll replace the bytes at that URL after I
> have approved it?

If yes, it does not belong on the list however respectable the site looks. That
single test rules out every general-purpose image host — imgur, postimg, ibb,
Google Drive, Dropbox, Discord CDN — because anyone can upload there and swap
the file afterwards.

To add one, insert a row — no migration needed:

```sql
insert into public.poll_image_hosts (host, note)
values ('example.org', 'why this host cannot be swapped by a submitter');
```

Two places mirror this list and must stay in step: the seed in
`src/migrations/polls_v1.sql` and `APPROVED_HOSTS` in
`src/polls/PollSubmitPage.jsx` (used only to warn the student earlier — the
database is still the boundary). A test reads the SQL seed and asserts the
client accepts every host in it, so drift fails the suite rather than silently
rejecting a legitimate link.

**If the module is already installed**, editing the seed changes nothing on its
own — run the `insert` above against the database as well.

### Known gap

A student can upload their own YouTube video, use its thumbnail, get the poll
approved, then change the thumbnail. `i.ytimg.com` is therefore the one seeded
host where the submitter *can* influence the bytes. It is kept because the
catalogue already renders YouTube thumbnails everywhere, but it is the reason
the report button and "Take poll down" exist rather than the allowlist being
treated as sufficient on its own.

As an admin you are **not** restricted to that list
(`poll_admin_set_option_image`), because you choosing the URL *is* the review.

**The review queue renders every submitted picture**, so "check the image"
means looking at it. A URL that reads like a diagram can serve anything.

## Moderation

- **Report** buttons on every poll and comment feed the Polls tab.
- **Hide comment** / **Take poll down** resolve the report in one action.
- Suspensions are shared with the forum — use the existing forum suspension
  control; it silences the student in both places.
- A suspended student can still **report** content. Reporting is a safety
  action, not a contribution.

## Turning it off in a hurry

Set poll mode to **Off** in the admin panel. That is one click and takes
effect immediately for everyone — no deploy, no migration. Every page then
renders "Polls are temporarily unavailable" instead of failing.

---

## What is tested, and what is not

**Tested:**

- `src/pollsV1Sql.test.js` — runs the real migration inside a real Postgres
  (pglite) and exercises approval, hidden results, one-vote-per-student,
  vote changing, the picture allowlist (incl. an end-to-end hostile-URL
  battery and the userinfo/port spoof), rate limits, shared suspensions,
  comment counting, the slug edge case, time-based expiry revealing results,
  the approval CHECK against a raw UPDATE, admin authorization on every
  mutating RPC, the double-review race, and the full preflight → install →
  postflight → rollback lifecycle. 35 checks.
- `src/polls/*.test.jsx` and `src/polls/pollApi.test.js` — component and
  API-layer checks, including the UI→DB parameter mapping.
- `npm run verify:polls-browser` — renders the real feed in Chromium at 360px
  and 1280px: no horizontal overflow, 44px finger targets, picture grid, and
  that results genuinely are absent from the DOM before voting.

**Audited:** a 2026-08-27 adversarial multi-agent review (6 dimensions, each
finding independently verified) plus execution-based probing surfaced 17
confirmed defects; all were fixed and are now covered by the tests above. See
the git history for the fix set.

**Not yet done, because it needs a running database:**

- Nothing has been executed against staging or production.
- No anonymous production check of the RPCs (the equivalent of
  `npm run verify:production-capabilities`) — that can only run after step 1.
## Polls that close on a timer

If you approve a poll with a closing date, **nothing is required of you when
that time passes.** One function, `poll_is_effectively_closed`, defines what
"closed" means, and every read path uses it, so the moment `closes_at` passes
the poll stops taking votes, shows its results to everyone, and reports its
status as `closed` to the site.

The only thing that does *not* update on its own is the stored `status` column,
which stays `'live'` because no job writes to it. That is cosmetic — it affects
someone querying the table directly, not students — but it can be tidied two
ways:

**By hand:** Admin → Polls → *Close expired polls*. It reports exactly what it
closed, or says nothing needed closing. Running it twice is harmless.

**Automatically**, if you would rather not think about it. Supabase ships
`pg_cron`; enable it under Database → Extensions and schedule the same RPC —
it is idempotent, so a frequent schedule costs nothing:

```sql
select cron.schedule(
  'close-expired-polls',
  '*/15 * * * *',
  $$select public.poll_admin_close_expired()$$
);
```

Note `poll_admin_close_expired()` checks `is_admin()`, so a cron job must run
as a role whose profile has `is_admin = true`, or be wrapped in a small
`security definer` function that skips that check. Neither is required for
correctness — reads are already right without any of this.
