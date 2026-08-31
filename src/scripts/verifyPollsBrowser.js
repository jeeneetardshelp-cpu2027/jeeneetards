// Browser verification for the poll UI, in the shape the forum ones already
// use: boot a Vite dev server, mount the fixture, assert against the REAL
// rendered page, screenshot it, and write machine-readable evidence.
//
// It checks the things jsdom cannot: that results really are invisible before
// voting, that the picture grid lays out, that a 360px phone has no
// horizontal overflow, and that every control clears the 44px hit target the
// responsive audit requires.
//
// Run: npm run verify:polls-browser

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "outputs/polls-ui");
const evidencePath = resolve(outputDir, "polls-browser.json");

const evidence = {
  version: 1,
  checked_at: new Date().toISOString(),
  viewports: {},
  checks: [],
  console_errors: [],
  page_errors: [],
};

function check(name, passed, detail) {
  evidence.checks.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
}

const server = await createServer({
  root,
  appType: "custom",
  server: { host: "127.0.0.1", port: 0, strictPort: false },
});

server.middlewares.use(async (request, response, next) => {
  if (request.url?.split("?")[0] !== "/__polls-check") return next();
  const html = await server.transformIndexHtml(request.url, `<!doctype html>
    <html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body><div id="root"></div><script type="module" src="/src/polls/PollsBrowserFixture.jsx"></script></body></html>`);
  response.statusCode = 200;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(html);
});

let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  const port = typeof address === "object" && address ? address.port : null;
  if (!port) throw new Error("Vite did not expose a browser-verification port.");

  browser = await chromium.launch({ headless: true });

  for (const [label, viewport] of Object.entries({
    phone: { width: 360, height: 900 },
    desktop: { width: 1280, height: 1000 },
  })) {
    const page = await browser.newPage({ viewport });
    page.on("console", (message) => {
      if (message.type() === "error") evidence.console_errors.push(`${label}: ${message.text()}`);
    });
    page.on("pageerror", (error) => evidence.page_errors.push(`${label}: ${error.message}`));

    await page.goto(`http://127.0.0.1:${port}/__polls-check`, { waitUntil: "load", timeout: 180_000 });
    await page.waitForSelector("h1", { timeout: 60_000 });

    const measured = await page.evaluate(() => {
      const small = [...document.querySelectorAll("button, a, input, select, textarea")]
        .filter((element) => element.getClientRects().length > 0)
        .filter((element) => element.getBoundingClientRect().height < 44)
        .map((element) => `${element.tagName}:${(element.textContent || "").trim().slice(0, 30)}`);
      return {
        page_scroll_width: document.documentElement.scrollWidth,
        viewport_width: window.innerWidth,
        percent_labels: [...document.querySelectorAll("span")]
          .map((node) => node.textContent.trim())
          .filter((text) => /^\d{1,3}%$/.test(text)),
        images: document.querySelectorAll("li img").length,
        headings: [...document.querySelectorAll("h3 a")].map((node) => node.textContent.trim()),
        small_targets: small,
      };
    });
    evidence.viewports[label] = measured;

    check(`${label}: no page-level horizontal overflow`,
      measured.page_scroll_width <= measured.viewport_width,
      { page_scroll_width: measured.page_scroll_width, viewport_width: measured.viewport_width });

    // 44px is a FINGER-target rule, so it is asserted only at phone widths --
    // the same boundary uiAudit.js uses (`r.width <= 414`). On desktop a poll
    // question is a text link inside a heading; padding it out to 44px would
    // put a dead band around every title to satisfy a rule about thumbs. The
    // desktop measurement is still recorded, just not failed on.
    check(`${label}: every interactive control clears 44px`,
      viewport.width > 414 || measured.small_targets.length === 0,
      { enforced: viewport.width <= 414, small_targets: measured.small_targets });

    check(`${label}: all three fixture polls rendered`,
      measured.headings.length === 3, { headings: measured.headings });

    check(`${label}: picture options render as images`,
      measured.images === 3, { images: measured.images });

    if (label === "phone") {
      // The unvoted poll is first. Its options must carry NO percentage until
      // this browser casts a vote -- the whole point of hiding results.
      const beforeVote = await page.evaluate(() => {
        const card = document.querySelectorAll("article")[0];
        return [...card.querySelectorAll("span")]
          .map((node) => node.textContent.trim())
          .filter((text) => /^\d{1,3}%$/.test(text));
      });
      check("results are hidden before voting", beforeVote.length === 0, { shares: beforeVote });

      await page.getByRole("button", { name: /2 to 4 hours/ }).click();
      await page.waitForFunction(() => {
        const card = document.querySelectorAll("article")[0];
        return [...card.querySelectorAll("span")].some((node) => /^\d{1,3}%$/.test(node.textContent.trim()));
      }, { timeout: 5000 });

      const afterVote = await page.evaluate(() => {
        const card = document.querySelectorAll("article")[0];
        const shares = [...card.querySelectorAll("span")]
          .map((node) => node.textContent.trim())
          .filter((text) => /^\d{1,3}%$/.test(text));
        const chosen = card.querySelector('button[aria-pressed="true"]');
        return { shares, chosen: chosen?.textContent?.trim() ?? null };
      });
      check("voting reveals a share for every option",
        afterVote.shares.length === 4, { shares: afterVote.shares });
      check("the chosen option is marked",
        /2 to 4 hours/.test(afterVote.chosen ?? ""), { chosen: afterVote.chosen });

      await page.screenshot({ path: resolve(outputDir, "polls-phone.png"), fullPage: true });
    } else {
      await page.screenshot({ path: resolve(outputDir, "polls-desktop.png"), fullPage: true });
    }

    await page.close();
  }

  check("browser emitted no console or page errors",
    evidence.console_errors.length === 0 && evidence.page_errors.length === 0,
    { console_errors: evidence.console_errors, page_errors: evidence.page_errors });
} finally {
  mkdirSync(outputDir, { recursive: true });
  if (browser) await browser.close();
  await server.close();
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

console.log(`Evidence: ${evidencePath}`);
if (evidence.checks.some((item) => !item.passed)) process.exitCode = 1;
