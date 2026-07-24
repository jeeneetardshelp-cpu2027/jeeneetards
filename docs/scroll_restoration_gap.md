# Known gap: scroll is not restored after a full page reload

**Status:** open, deliberately deferred behind class filtering and accessibility.
**Severity:** low — the primary journey passes.

## What works

In-app (SPA) navigation restores both the URL and the scroll offset. Measured:

| step | URL | scrollY |
|---|---|---|
| before | `/browse?goal=jee&class=11&subject=physics&chapter=kinematics` | 250 |
| after Back | same | **250** |

## What fails

When the intermediate navigation is a **full document load** rather than a
client-side route change, the offset comes back as 0:

| step | URL | scrollY |
|---|---|---|
| before | `/browse?goal=jee&class=11&subject=physics&chapter=kinematics` | 276 |
| after Back | same (URL restored correctly) | **0** |

Only the scroll offset is lost. The URL, and therefore every filter, is
restored correctly in both cases.

## Exact reproduction

Requires the dev server on :5173 and Playwright (already a devDependency).

```bash
node -e "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();await p.goto('http://localhost:5173/browse?goal=jee&class=11&subject=physics&chapter=kinematics',{waitUntil:'networkidle'});await p.waitForTimeout(1200);await p.evaluate(()=>window.scrollTo(0,420));await p.waitForTimeout(300);const before=await p.evaluate(()=>({url:location.pathname+location.search,y:Math.round(window.scrollY)}));await p.goto('http://localhost:5173/compare?chapter=1&ids=1,8',{waitUntil:'networkidle'});await p.waitForTimeout(800);await p.goBack({waitUntil:'networkidle'});await p.waitForTimeout(1500);const after=await p.evaluate(()=>({url:location.pathname+location.search,y:Math.round(window.scrollY)}));console.log(JSON.stringify({before,after,scrollRestored:Math.abs(before.y-after.y)<=5}));await b.close();})();"
```

Expected today: `"scrollRestored": false`, with `after.y === 0`.

The `p.goto(...)` is what makes this a reload rather than a route change —
replacing it with a click on a `View course` button makes the same script pass.

## Where the code is

`ScrollToTop` in [src/App.jsx](../src/App.jsx). It saves `window.scrollY` into
`sessionStorage` under `scroll:<pathname+search>` on both `pagehide` and effect
cleanup, and restores when `useNavigationType() === "POP"`, retrying up to 12
times at 60ms while the async content grows the page.

## Leading hypotheses (not yet confirmed)

1. **Navigation type.** After a real document load, React Router may report the
   first navigation as something other than `POP`, so the restore branch never
   runs and the `else` branch scrolls to 0.
2. **Retry budget.** 12 × 60ms = 720ms. If the playlist query has not resolved
   within that window the document is still short, every `scrollTo` clamps to
   0, and the retries are exhausted before the content arrives. A reload pays
   full bundle-parse plus query latency, which an SPA transition does not.

Hypothesis 2 is the more likely of the two and is cheap to test by raising the
budget, but neither has been verified — do not treat either as diagnosed.

## Why it is deferred

Reload-then-Back is a rare path: the common journeys (card → Back, compare →
Back) are client-side and already pass. The URL — and therefore every filter —
survives in both cases, so nothing is silently mis-filtered; only the reading
position is lost.
