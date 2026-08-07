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
and teardown. The remote sequence remained paused until that focused diff
passed local full-suite validation and GitHub CI.

## 2026-08-07 — corrected rollback rehearsal passed

After the dedicated fixture correction passed local and GitHub validation, the
complete sequence was retried on the same disposable staging project. Every
SQL editor buffer was copied back and SHA-256 verified before execution.

Fixture setup SHA-256:
`0387b4a1f3421acfc2234c055664f1399994311cfb650e9299bc16abd007aa66`

Fixture setup terminal row — all true:

- environment is staging;
- three fixture users created;
- three fixture profiles created;
- exactly one fixture admin.

Rollback rehearsal SHA-256:
`aea4a176436d0ec63ed8aece3fb00fde909953bd0ee22cc06412b6f82a6bbde2`

Rollback rehearsal terminal row — all true:

- environment is staging;
- beta table removed;
- beta membership-check RPC removed;
- beta admin RPC removed;
- forum mode restored to off;
- no posts created;
- no reports created.

Fixture teardown SHA-256:
`c696fe43f6387834178e36b0a160fd41174286820b9f9afc798483f67cfaefa8`

Fixture teardown terminal row — all true:

- environment is staging;
- fixture users removed;
- fixture profiles removed.

The final aggregate-only read-only residue object returned true for all eleven
fields: staging environment, forum mode off, username claim present, beta delta
absent, no Auth users, no profiles, no posts, no comments, no votes, no
reports, and no beta membership audit actions.

No assertion was bypassed. The beta schema and all beta rehearsal data rolled
back, the three exact fixture accounts were removed, and production was not
contacted.
