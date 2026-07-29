// uiAudit.js — responsive + accessibility audit with REAL screenshots.
//
// The in-app browser's screenshot action times out here, and DOM measurements
// alone cannot show whether a layout looks right. Playwright drives a real
// Chromium, so this produces actual PNGs alongside the numbers.
//
//   npm run ui:audit          (dev server must be running on :5173)
//
// Output: ui-audit/*.png  +  ui-audit/report.json
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { collectUiAuditFailures } from "./uiAuditPolicy.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(root, "ui-audit");
mkdirSync(OUT, { recursive: true });

const BASE = process.env.UI_BASE ?? "http://localhost:5173";
// Explicit heights: the previous version derived height from width, so the
// "360x800" in the filename was not what was actually rendered.
const VIEWPORTS = [
  { w: 360, h: 800 }, { w: 390, h: 844 }, { w: 768, h: 1024 },
  { w: 1440, h: 900 }, { w: 1920, h: 1080 }, { w: 2560, h: 1440 },
];
const JOURNEY = [
  ['home', '/'],
  ['find', '/explore'],
  ['goal', '/explore/jee'],
  ['class', '/explore/jee/class-11'],
  ['subject', '/explore/jee/class-11/physics'],
  ['results', '/explore/jee/class-11/physics/kinematics'],
  ['browse', '/browse'],
  ['reset', '/reset'],
  ['chapterhub', '/chapter/1'],
  ['player', null],
];
const RESTORATION_PATH = "/browse?q=kinematics";

// Long titles in both scripts — the catalogue really does carry keyword-stuffed
// YouTube titles, and an Indian platform will carry Devanagari.
const LONG_EN = "#7 Examples on motion under gravity with graph | Rectilinear motion | Kinematics | IIT advanced | JEE main | Physics | CBSE Class 11 complete one shot revision";
const LONG_HI = "गतिकी — सरल रेखीय गति के उदाहरण एवं गुरुत्व के अंतर्गत गति का सम्पूर्ण अध्याय पुनरावृत्ति कक्षा ११ भौतिक विज्ञान";

const results = [];
const browserCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : null,
  process.platform === "win32"
    ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    : null,
].filter(Boolean);
const systemBrowser = browserCandidates.find((candidate) => existsSync(candidate));
const browser = await chromium.launch(
  systemBrowser ? { executablePath: systemBrowser } : {},
);

// Never audit a guessed database id. Discover a real course through the same
// catalogue control a student uses, then reuse that route at every viewport.
const discoveryContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const discoveryPage = await discoveryContext.newPage();
await discoveryPage.goto(BASE + RESTORATION_PATH, { waitUntil: "networkidle" });
const firstCourse = discoveryPage.getByRole("link", { name: "View course" }).first();
try {
  await firstCourse.waitFor({ state: "visible", timeout: 15_000 });
} catch {
  const visibleText = await discoveryPage.locator("main").innerText().catch(() => "");
  await discoveryContext.close();
  await browser.close();
  throw new Error(
    `UI audit could not discover a course at ${RESTORATION_PATH}: ${visibleText.slice(0, 300)}`,
  );
}
await firstCourse.click();
await discoveryPage.waitForFunction(() => location.pathname.startsWith("/course/"));
const discoveredCoursePath = await discoveryPage.evaluate(
  () => location.pathname + location.search,
);
await discoveryContext.close();
const journey = JOURNEY.map(([name, path]) => [
  name,
  name === "player" ? discoveredCoursePath : path,
]);

async function probe(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    // An element extending past the viewport is only intended when it sits
    // inside a scroller that has DECLARED itself intentional:
    //
    //     data-allow-horizontal-scroll="true"
    //
    // The previous version exempted anything with any `overflow-x: auto`
    // ancestor. That is far too broad — a stray `overflow-x-auto` anywhere up
    // the tree silently excused every real overflow beneath it, so the audit
    // could report zero problems while the page was visibly broken.
    //
    // Allowlisted (and nothing else): the breadcrumb rail and the comparison
    // table. Both scroll sideways on purpose and both carry the attribute.
    const inAllowedScroller = (el) => {
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        if (n.dataset?.allowHorizontalScroll === "true") return true;
      }
      return false;
    };
    const overflowing = [...document.querySelectorAll("*")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.right > window.innerWidth + 1;
    });
    // Reported separately so an unmarked scroller cannot hide in the total.
    const rects = overflowing.filter((e) => !inAllowedScroller(e));
    const offenders = rects.slice(0, 12).map((e) => ({
      tag: e.tagName.toLowerCase(),
      cls: (typeof e.className === "string" ? e.className : "").slice(0, 60),
      text: (e.textContent || "").trim().slice(0, 40),
      overhangPx: Math.round(e.getBoundingClientRect().right - window.innerWidth),
    }));
    // 44px is the WCAG 2.5.5 / iOS HIG minimum. Only check what a finger hits.
    //
    // A visually-hidden input (sr-only, ~1px) is NOT the tap target — the
    // label wrapping it is, and that is what the finger lands on. Counting the
    // input reported seven "failures" for controls that are actually 44px.
    // The exemption is deliberately narrow: the element must be ~invisible AND
    // have a labelling ancestor that itself meets the minimum. A genuinely
    // small control with no such label still fails.
    const coveredByLabel = (e) => {
      const r = e.getBoundingClientRect();
      if (r.height > 2 || r.width > 2) return false;      // not visually hidden
      const lab = e.closest("label");
      return !!lab && lab.getBoundingClientRect().height >= 44;
    };
    const tappable = [...document.querySelectorAll("button, a, input, select")]
      .filter((e) => e.getBoundingClientRect().width > 0 && !coveredByLabel(e));
    const small = tappable
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { t: (e.textContent || e.getAttribute("aria-label") || e.tagName).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((x) => x.h < 44);
    const header = document.querySelector("header");
    const crumbs = [...document.querySelectorAll('header nav[aria-label="Breadcrumb"] a, header nav[aria-label="Breadcrumb"] button')].map((b) => b.textContent.trim());
    const nav = [...document.querySelectorAll("header nav a, header nav button")]
      .map((b) => ({ t: b.textContent.trim(), cur: b.getAttribute("aria-current") }))
      .filter((x) => ["Home", "Find a course", "Browse courses"].includes(x.t));
    return {
      overflowPx: d.scrollWidth - window.innerWidth,
      overflowingEls: rects.length,
      allowedScrollerEls: overflowing.length - rects.length,
      offenders,
      overflowingSample: rects.slice(0, 3).map((e) => (e.className || e.tagName).toString().slice(0, 60)),
      headers: document.querySelectorAll("header").length,
      headerSticky: header ? getComputedStyle(header).position : null,
      crumbs,
      nav,
      tapTargetsUnder44: small.length,
      tapTargetsSample: small.slice(0, 4),
    };
  });
}

for (const { w: width, h: height } of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const [name, path] of journey) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    const m = await probe(page);
    results.push({ width, height, step: name, path, ...m });
    // full-page shot only for the two most informative steps, to keep it quick
    if (["results","browse","reset","home","chapterhub","player"].includes(name)) {
      await page.screenshot({ path: resolve(OUT, `${width}-${name}.png`), fullPage: false });
    }
  }
  await ctx.close();
}

// ---- long-title stress: ONE SCREENSHOT PER SCRIPT ----
// A single shared capture could only ever show one of the two, so English and
// Hindi get their own page state and their own PNG.
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
const page = await ctx.newPage();
const titleStress = {};
for (const [label, text] of [['english', LONG_EN], ['hindi', LONG_HI]]) {
  await page.goto(BASE + '/browse', { waitUntil: 'networkidle' });
  titleStress[label] = await page.evaluate((t) => {
    const h = document.querySelector('main h3');
    if (!h) return 'no title element found';
    h.textContent = t;
    const cs = getComputedStyle(h);
    return {
      overflowPx: document.documentElement.scrollWidth - window.innerWidth,
      clipped: cs.overflow !== 'visible' || h.className.includes('line-clamp'),
      renderedHeight: Math.round(h.getBoundingClientRect().height),
    };
  }, text);
  await page.screenshot({ path: resolve(OUT, "360-long-title-" + label + ".png") });
}

// ---- 200% REFLOW EMULATION (WCAG 1.4.10) ----
// Not real browser zoom: this emulates the reflow a 200% zoom produces by
// halving the CSS viewport and doubling DPR. It exercises layout and media
// queries, which is the part that breaks; it does not reproduce browser text
// rasterisation or min-font-size behaviour.
//
// It replaced `document.body.style.zoom`, which is non-standard and scales
// painting without changing the CSS viewport — media queries never fire, so it
// could not detect a reflow failure at all.
const reflow200 = {};
for (const [label, vw, dsr] of [["zoom100", 1280, 1], ["zoom200", 640, 2]]) {
  const zctx = await browser.newContext({ viewport: { width: vw, height: 800 }, deviceScaleFactor: dsr });
  const zp = await zctx.newPage();
  await zp.goto(BASE + "/explore/jee/class-11/physics/kinematics", { waitUntil: "networkidle" });
  reflow200[label] = await zp.evaluate(() => ({
    cssViewport: window.innerWidth,
    dpr: window.devicePixelRatio,
    overflowPx: document.documentElement.scrollWidth - window.innerWidth,
    overflowingEls: [...document.querySelectorAll("*")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.right > window.innerWidth + 1;
    }).length,
    headerVisible: !!document.querySelector("header")?.getBoundingClientRect().height,
  }));
  if (label === "zoom200") await zp.screenshot({ path: resolve(OUT, "1280-reflow200.png") });
  await zctx.close();
}

// ---- keyboard focus order + visible focus ring ----
await page.goto(BASE + RESTORATION_PATH, { waitUntil: "networkidle" });
const focus = [];
for (let i = 0; i < 8; i++) {
  await page.keyboard.press("Tab");
  focus.push(await page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return { el: "BODY", label: null, ring: false };
    const cs = getComputedStyle(a);
    return {
      el: a.tagName,
      label: (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 26),
      // Tailwind focus rings are box-shadow, not outline; checking only
      // outline under-reports and produced a false "1 of 8 has no ring".
      ring: (cs.outlineStyle !== "none" && cs.outlineWidth !== "0px") || (cs.boxShadow !== "none" && cs.boxShadow !== ""),
    };
  }));
}

// ---- scroll + filter restoration through REAL SPA navigation ----
//
// The previous version used page.goto() both ways, which are full document
// loads — it tested the browser, not the app. A student clicks a course link
// (React Router, no reload) and presses Back, so that is what this does.
await page.setViewportSize({ width: 390, height: 800 });
await page.goto(BASE + RESTORATION_PATH, { waitUntil: "networkidle" });
// scroll as far as this page allows, then record where we actually are
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(150);
const beforeNav = await page.evaluate(() => ({
  y: Math.round(window.scrollY), url: location.pathname + location.search,
  scrollable: document.documentElement.scrollHeight > window.innerHeight,
}));

// Click the real catalogue action ("View course" is a crawlable link now).
// Selecting an arbitrary control previously clicked "Try again" whenever a
// request failed, which was not a course journey.
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll("main a")]
    .find((x) => x.textContent.trim() === "View course");
  if (!b) return null;
  b.click();
  return b.textContent.trim().slice(0, 30);
});
await page.waitForTimeout(600);
const afterClick = await page.evaluate(() => ({ url: location.pathname, y: Math.round(window.scrollY) }));

await page.goBack();                 // SPA POP — no reload
await page.waitForTimeout(900);      // allow async content + restore retries
const afterBack = await page.evaluate(() => ({
  y: Math.round(window.scrollY), url: location.pathname + location.search,
}));

await ctx.close();
await browser.close();

const report = {
  base: BASE, when: new Date().toISOString(), viewports: VIEWPORTS,
  matrix: results, titleStress, reflow200, focusOrder: focus,
  restoration: { beforeNav, afterClick, clicked, afterBack,
    filtersRestored: beforeNav.url === afterBack.url,
    scrollRestored: beforeNav.scrollable ? Math.abs(beforeNav.y - afterBack.y) < 100 : null },
};
writeFileSync(resolve(OUT, "report.json"), JSON.stringify(report, null, 2));

const bad = results.filter((r) => r.overflowingEls > 0 || r.headers !== 1);
console.log(`viewports: ${VIEWPORTS.map(v=>v.w+"x"+v.h).join(", ")}`);
console.log(`checks: ${results.length}   with overflow or duplicate header: ${bad.length}`);
for (const b of bad) console.log(`  ✗ ${b.width}px ${b.step}: overflow=${b.overflowingEls} headers=${b.headers} ${JSON.stringify(b.overflowingSample)}`);
const tap = results.filter((r) => r.width <= 414 && r.tapTargetsUnder44 > 0);
console.log(`mobile steps with sub-44px tap targets: ${tap.length}`);
for (const t of tap.slice(0, 3)) console.log(`  · ${t.width}px ${t.step}: ${t.tapTargetsUnder44} → ${JSON.stringify(t.tapTargetsSample.slice(0, 2))}`);
console.log(`200% reflow emulation: ${JSON.stringify(reflow200)}`);
console.log(`focus ring present on first 8 tabs: ${focus.filter((f) => f.ring).length}/8`);
console.log(`restoration (real SPA back): url=${report.restoration.filtersRestored} scroll=${report.restoration.scrollRestored} (${beforeNav.y} → ${afterBack.y}, scrollable=${beforeNav.scrollable}, clicked="${clicked}" → ${afterClick.url})`);
console.log(`screenshots + report -> ui-audit/`);

const failures = collectUiAuditFailures(report);
if (failures.length > 0) {
  console.error(`\nUI audit failed with ${failures.length} objective regression(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log("UI audit objective gates passed");
}
