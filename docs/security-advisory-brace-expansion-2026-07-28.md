# Development dependency advisory — 2026-07-28

## Outcome

Production dependencies are clean:

```text
npm audit --omit=dev --audit-level=high
found 0 vulnerabilities
```

The full audit reports seven high-severity paths to
`GHSA-mh99-v99m-4gvg`. They all resolve through the development-only lint
toolchain:

```text
eslint / eslint-plugin-react / eslint-plugin-jsx-a11y
  -> minimatch 3.1.5
  -> brace-expansion 1.1.16
```

This does not place `brace-expansion` in the browser production bundle.

## Remediation investigation

- `npm audit fix --force` was rejected because it proposes breaking
  dependency changes.
- Overriding `brace-expansion` directly to patched version `5.0.8` cleared the
  audit but is API-incompatible with `minimatch` 3.1.5. ESLint failed with
  `TypeError: expand is not a function`. The override was fully reverted.
- ESLint 10.8.0 would move beyond the vulnerable dependency range, but the
  currently latest `eslint-plugin-react` 7.37.5 and
  `eslint-plugin-jsx-a11y` 6.10.2 declare peer support only through ESLint 9.

## Current validation

- 789 tests passed.
- ESLint 9.39.5 passed after the rejected override was reverted.
- The Vite production build passed.
- Production dependency audit: zero vulnerabilities.
- Full development audit: seven high-severity dependency paths remain.

## Safe follow-up

Monitor for either:

1. a patched `minimatch` 3 release that accepts a compatible patched
   `brace-expansion`, or
2. ESLint 10 support from both React lint plugins.

When one path is available, update the lint stack normally, regenerate the
lockfile, and repeat tests, lint, build, and both audit commands. Do not use
`npm audit fix --force` for this advisory.
