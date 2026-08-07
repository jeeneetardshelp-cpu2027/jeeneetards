# Forum closed-beta v1 real-staging notes

Project reference: `essmxonestbrgmgrtywn`
Environment marker: `public.app_environment(id=true, name='staging')`

## 2026-08-07 — prerequisite drift repaired

An aggregate-only read-only audit found the persistent forum in mode `off`,
with no accounts, profiles, posts, comments, or reports. Moderation context and
report dismissal were installed, but the complete username-claim package was
absent. No beta SQL was run against that incomplete baseline.

After explicit staging authorization, the reviewed username package was run in
this order:

1. preflight — passed;
2. existing-profile audit — `0 / 0 / 0 / 0`;
3. migration — committed successfully after the editor buffer SHA-256 matched
   `6a943438cb3b047ca24d2301d74771e5f1699c4df4d7bc58905af9782f200b72`;
4. postflight — passed after its editor buffer SHA-256 matched
   `3acb1db1efdd01154224f91c2a640bc9b9b77da9ed0978ec2a8950beb917bbda`.

The repeated aggregate audit then returned true for staging environment, forum
mode off, beta delta absent, username claim present, moderation context
present, dismissal present, and zero Auth users.

## 2026-08-07 — fixture compatibility guard exposed a package defect

The earlier Forum v1 fixture setup was copied into the editor and verified at
SHA-256
`b6bb2ccec48faf221f5d4b64a974a8c9e4654def8356e9f8636e05d81f4c0bdd`.
It refused before any insert with:

`REFUSING: remove the forum schema before provisioning fixtures`

That guard is correct for the original pre-install Forum v1 rehearsal but is
incompatible with this beta rehearsal, which deliberately requires the
persistent forum baseline. The beta migration was not run and the assertion
was not bypassed.

The immediate read-only residue check returned all true:

- environment is staging;
- forum mode is off;
- username claim is present;
- beta delta is absent;
- no Auth users;
- no profiles;
- no posts;
- no reports.

The package now includes a dedicated guarded three-account beta fixture setup
and teardown. These must pass independent diff review before the remote
sequence resumes.
