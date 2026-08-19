// Testing Library's async utilities keep their OWN timeout, separate from
// Vitest's `testTimeout`. Raising testTimeout to 15s in vite.config.js covered
// tests that are simply slow, but every `findBy*` / `waitFor` still gave up
// after Testing Library's 1000ms default — so under 130+ files sharing 12
// cores they failed with "Unable to find role=..." long before the 15s test
// budget was anywhere near spent. That is why the suite still failed a
// different handful of files each run (ManageCatalogPanel, CourseSequence,
// Home.structuredData, Dashboard.goal, phase1Truth, shellSafety) while every
// one of them passed in isolation.
//
// 5s restores the margin testTimeout was meant to give, and stays well under
// the 15s per-test budget so a genuine hang still surfaces as a test timeout
// rather than a confusing element-not-found. It does not hide real breakage:
// an element that never appears still fails, just 5s later instead of 1s.
import { configure } from "@testing-library/react";

configure({ asyncUtilTimeout: 5000 });
