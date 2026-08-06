import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "../outputs/forum-ui");
const evidencePath = resolve(outputDir, "forum-read-only-browser.json");
const evidence = {
  version: 1,
  checked_at: new Date().toISOString(),
  viewport: { width: 360, height: 800 },
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
  if (request.url?.split("?")[0] !== "/__forum-read-only-check") return next();
  const html = await server.transformIndexHtml(request.url, `<!doctype html>
    <html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body><div id="root"></div><script type="module" src="/src/forum/ForumReadOnlyBrowserFixture.jsx"></script></body></html>`);
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
  const page = await browser.newPage({ viewport: evidence.viewport });
  page.on("console", (message) => {
    if (message.type() === "error") evidence.console_errors.push(message.text());
  });
  page.on("pageerror", (error) => evidence.page_errors.push(error.message));

  const visit = async (screen) => {
    await page.goto(`http://127.0.0.1:${port}/__forum-read-only-check?screen=${screen}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.forumReadOnlyMounted === "true");
    await page.waitForSelector(screen === "feed" ? "article h2" : "article h1");
    await page.screenshot({ path: resolve(outputDir, `forum-read-only-${screen}-360.png`), fullPage: true });
    return page.evaluate(() => {
      const scroller = document.querySelector('[data-allow-horizontal-scroll="true"]');
      const formula = document.querySelector(".katex-display");
      const forumControls = [...document.querySelectorAll('main button, main input, main a[href^="/forum"]')];
      return {
        viewport_width: window.innerWidth,
        page_scroll_width: document.documentElement.scrollWidth,
        topic_client_width: scroller?.clientWidth ?? null,
        topic_scroll_width: scroller?.scrollWidth ?? null,
        formula_client_width: formula?.clientWidth ?? null,
        formula_scroll_width: formula?.scrollWidth ?? null,
        formula_overflow_x: formula ? getComputedStyle(formula).overflowX : null,
        undersized_targets: forumControls
          .map((node) => ({ label: node.getAttribute("aria-label") || node.textContent.trim().slice(0, 50), height: node.getBoundingClientRect().height }))
          .filter((item) => item.height < 44),
      };
    });
  };

  mkdirSync(outputDir, { recursive: true });
  const feed = await visit("feed");
  const thread = await visit("thread");
  check("feed has no page-level horizontal overflow", feed.page_scroll_width <= feed.viewport_width, feed);
  check("topic chips scroll inside their own row", feed.topic_scroll_width > feed.topic_client_width, {
    client_width: feed.topic_client_width, scroll_width: feed.topic_scroll_width,
  });
  check("thread has no page-level horizontal overflow", thread.page_scroll_width <= thread.viewport_width, thread);
  check("long formula scrolls inside its display block",
    thread.formula_overflow_x === "auto" && thread.formula_scroll_width > thread.formula_client_width,
    { overflow_x: thread.formula_overflow_x, client_width: thread.formula_client_width, scroll_width: thread.formula_scroll_width });
  check("forum controls meet the 44px mobile target", feed.undersized_targets.length === 0 && thread.undersized_targets.length === 0, {
    feed: feed.undersized_targets, thread: thread.undersized_targets,
  });
  check("browser emitted no console or page errors",
    evidence.console_errors.length === 0 && evidence.page_errors.length === 0,
    { console_errors: evidence.console_errors, page_errors: evidence.page_errors });
} finally {
  if (browser) await browser.close();
  await server.close();
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

console.log(`Evidence: ${evidencePath}`);
if (evidence.checks.some((item) => !item.passed)) process.exitCode = 1;
