import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "../outputs/forum-ui");
const evidencePath = resolve(outputDir, "forum-auth-drafts-browser.json");
mkdirSync(outputDir, { recursive: true });
const evidence = {
  version: 1,
  checked_at: new Date().toISOString(),
  viewport: { width: 360, height: 800 },
  checks: [], console_errors: [], page_errors: [],
};

function check(name, passed, detail) {
  evidence.checks.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
}

const server = await createServer({
  root, appType: "custom", server: { host: "127.0.0.1", port: 0, strictPort: false },
});
server.middlewares.use(async (request, response, next) => {
  if (request.url?.split("?")[0] !== "/__forum-auth-draft-check") return next();
  const html = await server.transformIndexHtml(request.url, `<!doctype html>
    <html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body><div id="root"></div><script type="module" src="/src/forum/ForumAuthDraftBrowserFixture.jsx"></script></body></html>`);
  response.statusCode = 200;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(html);
});

function layoutSnapshot() {
  const controls = [...document.querySelectorAll("main button, main input, main select, main textarea, main a[href]")];
  return {
    viewport_width: window.innerWidth,
    page_scroll_width: document.documentElement.scrollWidth,
    undersized_targets: controls
      .map((node) => ({ label: node.getAttribute("aria-label") || node.textContent.trim().slice(0, 50), height: node.getBoundingClientRect().height }))
      .filter((item) => item.height < 44),
    reveal_nodes: document.querySelectorAll(".reveal").length,
  };
}

let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  const port = typeof address === "object" && address ? address.port : null;
  if (!port) throw new Error("Vite did not expose a browser-verification port.");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: evidence.viewport });
  page.on("console", (message) => { if (message.type() === "error") evidence.console_errors.push(message.text()); });
  page.on("pageerror", (error) => evidence.page_errors.push(error.message));

  const base = `http://127.0.0.1:${port}/__forum-auth-draft-check`;
  await page.goto(`${base}?screen=signed-out`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Ask a clear question" }).waitFor();
  await page.getByLabel("Topic").selectOption("physics");
  await page.getByLabel("Title").fill("Why does angular momentum remain constant?");
  const workedDraft = "I used $L=I\\omega$, but I am stuck after choosing the hinge as origin.";
  await page.getByLabel("Question and context").fill(workedDraft);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Ask a clear question" }).waitFor();
  const restored = await page.getByLabel("Question and context").inputValue();
  const signedOutLayout = await page.evaluate(layoutSnapshot);
  await page.screenshot({ path: resolve(outputDir, "forum-auth-signed-out-360.png"), fullPage: true });

  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("lecture-library-theme", "light"); });
  await page.goto(`${base}?screen=claim`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Choose your public forum username" }).waitFor();
  const claimLayout = await page.evaluate(layoutSnapshot);
  const claimCopy = await page.locator("main").textContent();
  await page.screenshot({ path: resolve(outputDir, "forum-username-claim-light-360.png"), fullPage: true });

  check("signed-out draft survives a real browser reload", restored === workedDraft, { restored_length: restored.length });
  check("signed-out composer has no page overflow", signedOutLayout.page_scroll_width <= signedOutLayout.viewport_width, signedOutLayout);
  check("username claim has no page overflow", claimLayout.page_scroll_width <= claimLayout.viewport_width, claimLayout);
  check("forum controls meet the 44px mobile target",
    signedOutLayout.undersized_targets.length === 0 && claimLayout.undersized_targets.length === 0,
    { signed_out: signedOutLayout.undersized_targets, claim: claimLayout.undersized_targets });
  check("claim copy distinguishes public username from private identity",
    claimCopy.includes("public posts and answers") && claimCopy.includes("email and real name are not shown"),
    { public_identity_copy: true });
  check("auth and claim pages mount no unowned Reveal blocks",
    signedOutLayout.reveal_nodes === 0 && claimLayout.reveal_nodes === 0,
    { signed_out: signedOutLayout.reveal_nodes, claim: claimLayout.reveal_nodes });
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
