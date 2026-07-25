# Phase 7 mutation evidence

## Import metadata propagation

Mutation: replaced `content_type: plan.contentType` with `content_type: null` in
`src/scripts/ingestionSafety.js`.

Command:

```text
npm test -- --run src/scripts/ingestionSafety.test.js
```

RED result:

```text
Test Files  1 failed (1)
Tests       1 failed | 6 passed (7)
Expected content_type "full-course"; received null.
```

The original implementation was restored.

## Blanket-update confirmation

Mutation: bypassed the `--confirm` check in `parseBulkConfirmation`.

Command:

```text
npm test -- --run src/scripts/ingestionSafety.test.js
```

RED result:

```text
Test Files  1 failed (1)
Tests       1 failed | 6 passed (7)
The empty argument list no longer raised the required --confirm error.
```

The original implementation was restored.

## Restored result

```text
Test Files  1 passed (1)
Tests       7 passed (7)
eslint . --max-warnings=0
```
