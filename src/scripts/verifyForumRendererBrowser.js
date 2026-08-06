import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "../outputs/forum-ui");
const evidencePath = resolve(outputDir, "forum-renderer-browser.json");
const screenshotPath = resolve(outputDir, "forum-renderer-browser.png");

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
  if (request.url?.split("?")[0] !== "/__forum-renderer-check") return next();
  const html = await server.transformIndexHtml(request.url, `<!doctype html>
    <html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body><div id="root"></div><script type="module" src="/src/forum/ForumRendererBrowserFixture.jsx"></script></body></html>`);
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
  await page.goto(`http://127.0.0.1:${port}/__forum-renderer-check`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__forumRendererSecurity?.ready === true);

  const result = await page.evaluate(() => {
    const malicious = document.querySelector("#malicious-content");
    const display = document.querySelector("#long-formula .katex-display");
    return {
      alerts: window.__forumRendererSecurity.alerts,
      malicious_text: malicious?.textContent ?? "",
      script_nodes: malicious?.querySelectorAll("script").length ?? 0,
      raw_attack_images: malicious?.querySelectorAll('img[src="x"]').length ?? 0,
      display_blocks: document.querySelectorAll(".katex-display").length,
      display_overflow_x: display ? getComputedStyle(display).overflowX : null,
      display_client_width: display?.clientWidth ?? null,
      display_scroll_width: display?.scrollWidth ?? null,
      viewport_width: window.innerWidth,
      page_scroll_width: document.documentElement.scrollWidth,
    };
  });

  check("script source remains visible text",
    result.malicious_text.includes("<script>alert(1)</script>"),
    { visible: result.malicious_text.includes("<script>alert(1)</script>") });
  check("event-handler image source remains visible text",
    result.malicious_text.includes('<img src=x onerror="alert(2)">'),
    { visible: result.malicious_text.includes('<img src=x onerror="alert(2)">') });
  check("raw HTML creates no executable nodes",
    result.script_nodes === 0 && result.raw_attack_images === 0 && result.alerts.length === 0,
    { script_nodes: result.script_nodes, raw_attack_images: result.raw_attack_images, alerts: result.alerts });
  check("single-line display maths reaches KaTeX display output",
    result.display_blocks >= 1, { display_blocks: result.display_blocks });
  check("long formula scrolls inside its own display block",
    result.display_overflow_x === "auto"
      && result.display_scroll_width > result.display_client_width,
    {
      overflow_x: result.display_overflow_x,
      client_width: result.display_client_width,
      scroll_width: result.display_scroll_width,
    });
  check("360px viewport has no page-level horizontal overflow",
    result.page_scroll_width <= result.viewport_width,
    { page_scroll_width: result.page_scroll_width, viewport_width: result.viewport_width });
  check("browser emitted no console or page errors",
    evidence.console_errors.length === 0 && evidence.page_errors.length === 0,
    { console_errors: evidence.console_errors, page_errors: evidence.page_errors });

  await page.screenshot({ path: screenshotPath, fullPage: true });
} finally {
  if (browser) await browser.close();
  await server.close();
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

console.log(`Evidence: ${evidencePath}`);
console.log(`Screenshot: ${screenshotPath}`);
if (evidence.checks.some((item) => !item.passed)) process.exitCode = 1;
