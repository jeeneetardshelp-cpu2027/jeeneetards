import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "../outputs/forum-ui");
const evidencePath = resolve(outputDir, "forum-voting-browser.json");
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
  if (request.url?.split("?")[0] !== "/__forum-voting-check") return next();
  const html = await server.transformIndexHtml(request.url, `<!doctype html>
    <html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body><div id="root"></div><script type="module" src="/src/forum/ForumVotingBrowserFixture.jsx"></script></body></html>`);
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
      .map((node) => ({
        label: node.getAttribute("aria-label") || node.textContent.trim().slice(0, 50),
        height: node.getBoundingClientRect().height,
        width: node.getBoundingClientRect().width,
      }))
      .filter((item) => item.height < 44 || item.width < 44),
    reveal_nodes: document.querySelectorAll(".reveal").length,
  };
}

async function contrastSnapshot(locator) {
  return locator.evaluate((node) => {
    const parse = (value) => {
      const parts = String(value).match(/[\d.]+/g)?.map(Number) ?? [];
      if (parts.length < 3) return [0, 0, 0, 0];
      return [parts[0], parts[1], parts[2], parts[3] ?? 1];
    };
    const over = (top, bottom) => {
      const alpha = top[3] + bottom[3] * (1 - top[3]);
      if (!alpha) return [0, 0, 0, 0];
      return [
        (top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / alpha,
        (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / alpha,
        (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / alpha,
        alpha,
      ];
    };
    let background = [0, 0, 0, 0];
    for (let current = node; current; current = current.parentElement) {
      background = over(background, parse(getComputedStyle(current).backgroundColor));
      if (background[3] >= 0.999) break;
    }
    background = over(background, [255, 255, 255, 1]);
    const foreground = parse(getComputedStyle(node).color);
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (color) => 0.2126 * channel(color[0])
      + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2]);
    const lighter = Math.max(luminance(foreground), luminance(background));
    const darker = Math.min(luminance(foreground), luminance(background));
    return {
      foreground: getComputedStyle(node).color,
      background: background.slice(0, 3).map((value) => Math.round(value)),
      contrast_ratio: Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2)),
    };
  });
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
  const base = `http://127.0.0.1:${port}/__forum-voting-check`;

  await page.goto(`${base}?screen=signed-out`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("lecture-library-theme", "dark"));
  await page.reload({ waitUntil: "networkidle" });
  const signedOutVote = page.getByRole("button", { name: "Upvote this discussion" });
  await signedOutVote.waitFor();
  await signedOutVote.click();
  await page.getByRole("heading", { name: "Sign in to vote on discussions" }).waitFor();
  const signedOutLayout = await page.evaluate(layoutSnapshot);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("main").screenshot({ path: resolve(outputDir, "forum-voting-signed-out-dark-360.png") });

  await page.evaluate(() => localStorage.setItem("lecture-library-theme", "light"));
  await page.goto(`${base}?screen=signed-in`, { waitUntil: "networkidle" });
  const postUp = page.getByRole("button", { name: "Upvote this discussion" });
  await postUp.click();
  await page.locator('[aria-label="19 score"]').waitFor();
  const pressedFill = await postUp.locator("svg").getAttribute("fill");
  const pressed = await postUp.getAttribute("aria-pressed");
  await postUp.click();
  await page.locator('[aria-label="18 score"]').waitFor();
  const cleared = await postUp.getAttribute("aria-pressed");
  const firstAnswerDown = page.getByRole("button", { name: "Downvote this answer" }).first();
  await firstAnswerDown.click();
  await page.locator('[aria-label="6 score"]').waitFor();
  const answerPressed = await firstAnswerDown.getAttribute("aria-pressed");
  await page.waitForTimeout(350);
  const lightContrast = await contrastSnapshot(firstAnswerDown);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
    localStorage.setItem("lecture-library-theme", "dark");
  });
  await page.waitForTimeout(350);
  const darkContrast = await contrastSnapshot(firstAnswerDown);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
    localStorage.setItem("lecture-library-theme", "light");
  });
  const signedInLayout = await page.evaluate(layoutSnapshot);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("main").screenshot({ path: resolve(outputDir, "forum-voting-thread-light-360.png") });

  await page.goto(`${base}?screen=claim`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Upvote this discussion" }).click();
  await page.getByRole("heading", { name: "Choose your public forum username" }).waitFor();
  const claimLayout = await page.evaluate(layoutSnapshot);

  check("signed-out vote opens the existing auth surface", true, { heading_found: true });
  check("pressed vote differs by fill and aria state", pressed === "true" && pressedFill === "currentColor", { pressed, pressed_fill: pressedFill });
  check("selecting the same vote clears it", cleared === "false", { cleared });
  check("answer voting updates independently", answerPressed === "true", { answer_pressed: answerPressed });
  check("active vote contrast passes AA in both themes", lightContrast.contrast_ratio >= 4.5 && darkContrast.contrast_ratio >= 4.5, {
    light: lightContrast, dark: darkContrast,
  });
  check("missing username opens the claim gate", true, { heading_found: true });
  check("voting layouts have no horizontal page overflow", [signedOutLayout, signedInLayout, claimLayout].every((item) => item.page_scroll_width <= item.viewport_width), {
    signed_out: signedOutLayout, signed_in: signedInLayout, claim: claimLayout,
  });
  check("voting controls meet the 44px mobile target", [signedOutLayout, signedInLayout, claimLayout].every((item) => item.undersized_targets.length === 0), {
    signed_out: signedOutLayout.undersized_targets,
    signed_in: signedInLayout.undersized_targets,
    claim: claimLayout.undersized_targets,
  });
  check("voting pages mount no unowned Reveal blocks", [signedOutLayout, signedInLayout, claimLayout].every((item) => item.reveal_nodes === 0), {
    signed_out: signedOutLayout.reveal_nodes,
    signed_in: signedInLayout.reveal_nodes,
    claim: claimLayout.reveal_nodes,
  });
  check("browser emitted no console or page errors", evidence.console_errors.length === 0 && evidence.page_errors.length === 0, {
    console_errors: evidence.console_errors, page_errors: evidence.page_errors,
  });
} catch (error) {
  evidence.fatal_error = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  await browser?.close();
  await server.close();
  console.log(`Evidence: ${evidencePath}`);
}

if (evidence.checks.some((item) => !item.passed)) process.exitCode = 1;
