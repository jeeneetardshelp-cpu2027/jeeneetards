import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "../outputs/forum-ui");
const evidencePath = resolve(outputDir, "forum-moderation-browser.json");
mkdirSync(outputDir, { recursive: true });
const evidence = {
  version: 1, checked_at: new Date().toISOString(),
  viewport: { width: 360, height: 800 }, checks: [], console_errors: [], page_errors: [],
};
const check = (name, passed, detail) => {
  evidence.checks.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
};
const layoutSnapshot = () => {
  const controls = [...document.querySelectorAll("main button, main input, main textarea, main a[href], [role=dialog] button, [role=dialog] input, [role=dialog] textarea")];
  return {
    viewport_width: window.innerWidth,
    page_scroll_width: document.documentElement.scrollWidth,
    undersized_targets: controls.map((node) => ({
      label: node.getAttribute("aria-label") || node.textContent.trim().slice(0, 50),
      height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width,
    })).filter((item) => item.height < 44 || item.width < 44),
    reveal_nodes: document.querySelectorAll(".reveal").length,
  };
};
const contrastSnapshot = (locator) => locator.evaluate((node) => {
  const parse = (value) => {
    const parts = String(value).match(/[\d.]+/g)?.map(Number) ?? [];
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
  };
  const over = (top, bottom) => {
    const alpha = top[3] + bottom[3] * (1 - top[3]);
    return alpha ? [
      (top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / alpha,
      (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / alpha,
      (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / alpha,
      alpha,
    ] : [0, 0, 0, 0];
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
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (color) => 0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2]);
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return { foreground: getComputedStyle(node).color, background: background.slice(0, 3).map(Math.round), contrast_ratio: Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2)) };
});

const server = await createServer({
  root, appType: "custom", server: { host: "127.0.0.1", port: 0, strictPort: false },
});
server.middlewares.use(async (request, response, next) => {
  if (request.url?.split("?")[0] !== "/__forum-moderation-check") return next();
  const html = await server.transformIndexHtml(request.url, `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/forum/ForumModerationBrowserFixture.jsx"></script></body></html>`);
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
  page.on("console", (message) => { if (message.type() === "error") evidence.console_errors.push(message.text()); });
  page.on("pageerror", (error) => evidence.page_errors.push(error.message));
  const base = `http://127.0.0.1:${port}/__forum-moderation-check`;

  await page.goto(`${base}?screen=student`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("lecture-library-theme", "light"));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Report this discussion" }).click();
  await page.getByLabel("Self-harm or suicide concern").check();
  const urgentExplanation = await page.getByText(/goes to urgent human review and is excluded from automatic hiding/i).isVisible();
  const emergencyBoundary = await page.getByRole("note").getByText(/not an emergency service/i).isVisible();
  const studentUrgentContrast = await contrastSnapshot(page.getByRole("note").getByText(/not an emergency service/i));
  await page.getByRole("dialog").screenshot({ path: resolve(outputDir, "forum-report-self-harm-selection-light-360.png"), animations: "disabled" });
  await page.getByRole("button", { name: "Send urgent concern" }).click();
  await page.getByText("Sent for urgent human review").waitFor();
  const selfHarmReason = await page.locator("html").getAttribute("data-submitted-report-reason");
  const urgentLayout = await page.evaluate(layoutSnapshot);
  await page.screenshot({ path: resolve(outputDir, "forum-report-self-harm-light-360.png"), fullPage: true });

  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; localStorage.setItem("lecture-library-theme", "dark"); });
  await page.getByRole("button", { name: "Report this discussion" }).click();
  await page.getByLabel("Spam or promotion").check();
  await page.getByRole("button", { name: "Submit report" }).click();
  await page.getByText("Report received").waitFor();
  const genericReason = await page.locator("html").getAttribute("data-submitted-report-reason");
  const genericHasUrgent = await page.getByText("Sent for urgent human review").count();
  const genericLayout = await page.evaluate(layoutSnapshot);
  await page.screenshot({ path: resolve(outputDir, "forum-report-generic-dark-360.png"), fullPage: true });

  await page.goto(`${base}?screen=admin`, { waitUntil: "networkidle" });
  await page.getByText("The exact reported answer preview.").waitFor();
  const adminContext = await page.getByText(/post #42/).isVisible();
  const adminUrgent = await page.getByText("Urgent human review").isVisible();
  const adminUrgentContrast = await contrastSnapshot(page.getByText(/Do not treat this as an ordinary takedown ticket/i));
  const adminLayout = await page.evaluate(layoutSnapshot);
  await page.screenshot({ path: resolve(outputDir, "forum-moderation-queue-context-360.png"), fullPage: true });
  await page.getByRole("button", { name: "Suspend author…" }).click();
  const suspensionDisabledWithoutReason = await page.getByRole("button", { name: "Confirm suspension" }).isDisabled();
  await page.getByLabel(/Moderation reason/).fill("Repeated unsafe conduct");
  const suspensionFormLayout = await page.evaluate(layoutSnapshot);
  await page.screenshot({ path: resolve(outputDir, "forum-moderation-suspension-form-360.png"), fullPage: true });
  await page.getByRole("button", { name: "Confirm suspension" }).click();
  await page.getByText("physics_helper is suspended for 7 days.").waitFor();
  const suspensionUsername = await page.locator("html").getAttribute("data-suspension-username");
  const suspensionDays = await page.locator("html").getAttribute("data-suspension-days");
  const suspensionReason = await page.locator("html").getAttribute("data-suspension-reason");
  await page.getByRole("button", { name: "Hide and resolve" }).click();
  await page.getByText("No open forum reports").waitFor();
  const moderationAction = await page.locator("html").getAttribute("data-moderation-action");
  await page.screenshot({ path: resolve(outputDir, "forum-moderation-queue-360.png"), fullPage: true });

  check("self-harm is a distinct urgent reporting path", urgentExplanation && emergencyBoundary && selfHarmReason === "self_harm", { urgent_explanation: urgentExplanation, emergency_boundary: emergencyBoundary, submitted_reason: selfHarmReason });
  check("self-harm success differs from generic confirmation", genericReason === "spam" && genericHasUrgent === 0, { generic_reason: genericReason, urgent_confirmation_count: genericHasUrgent });
  check("admin sees reported content and containing post context", adminContext && adminUrgent, { post_context: adminContext, urgent_badge: adminUrgent });
  check("admin suspension requires a reason and targets the public author username", suspensionDisabledWithoutReason && suspensionUsername === "physics_helper" && suspensionDays === "7" && suspensionReason === "Repeated unsafe conduct", { disabled_without_reason: suspensionDisabledWithoutReason, username: suspensionUsername, days: suspensionDays, reason: suspensionReason });
  check("admin moderation action is wired", moderationAction === "hide", { action: moderationAction });
  check("urgent safety copy passes AA contrast", studentUrgentContrast.contrast_ratio >= 4.5 && adminUrgentContrast.contrast_ratio >= 4.5, { student: studentUrgentContrast, admin: adminUrgentContrast });
  check("moderation layouts have no horizontal page overflow", [urgentLayout, genericLayout, adminLayout, suspensionFormLayout].every((item) => item.page_scroll_width <= item.viewport_width), { urgent: urgentLayout, generic: genericLayout, admin: adminLayout, suspension_form: suspensionFormLayout });
  check("moderation controls meet the 44px mobile target", [urgentLayout, genericLayout, adminLayout, suspensionFormLayout].every((item) => item.undersized_targets.length === 0), { urgent: urgentLayout.undersized_targets, generic: genericLayout.undersized_targets, admin: adminLayout.undersized_targets, suspension_form: suspensionFormLayout.undersized_targets });
  check("moderation surfaces mount no unowned Reveal blocks", [urgentLayout, genericLayout, adminLayout, suspensionFormLayout].every((item) => item.reveal_nodes === 0), { urgent: urgentLayout.reveal_nodes, generic: genericLayout.reveal_nodes, admin: adminLayout.reveal_nodes, suspension_form: suspensionFormLayout.reveal_nodes });
  check("browser emitted no console or page errors", evidence.console_errors.length === 0 && evidence.page_errors.length === 0, { console_errors: evidence.console_errors, page_errors: evidence.page_errors });
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
