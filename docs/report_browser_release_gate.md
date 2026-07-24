# Signed-in report browser release gate

Status: **passed on 23 July 2026**, disposable staging run `536891`. The browser
showed the success status with zero console errors, database evidence passed
7/7, cleanup returned zero for every fixture type, and the local credential
state was deleted. The evidence is retained, but the public feature is disabled
for the browse-only MVP pending an under-18 consent/age-assurance design.

This journey uses only the disposable staging project. It creates one confirmed
temporary student, one course and one lecture, then proves that the browser sent
the expected signed-in report before removing every fixture row and the auth
user.

1. Run `npm.cmd run prepare:report-browser`.
2. Run `npm.cmd run preview:reports-staging` and leave that terminal open.
3. Open the printed local course URL. Use the credentials from the ignored
   `.report-browser-fixture.json` file; never paste them into chat or a commit.
4. Report the lecture as **Video won't play**. Enter the exact `expectedNote`
   from the state file and submit.
5. Run `npm.cmd run verify:report-browser`. All seven checks must pass.
6. Sign out or clear the local staging session, stop Vite, then run
   `npm.cmd run cleanup:report-browser`. Cleanup must show zero reports,
   playlists, videos, channels and auth users, and delete the state file.

Safety rules:

- All four commands require explicit consent, all three staging credentials and
  a non-production URL. Prepare, evidence verification and cleanup additionally
  require a live `app_environment` marker of `staging` or `test`. The preview
  launcher accepts only the exact marker-checked state written by prepare and
  exposes only the staging anon key to browser code.
- The generated password is never printed. The local state file is ignored by
  Git, Vercel and the review packer.
- If cleanup is incomplete, the state file is retained so the exact fixture can
  be cleaned again. Never delete it manually before database cleanup succeeds.
- Keep `RELEASE_FEATURES.contentReporting` false during any future rerun; enable
  it only after browser evidence and zero-residue cleanup both pass.
