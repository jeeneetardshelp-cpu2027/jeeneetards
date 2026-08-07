import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { RELEASE_FEATURES } from "../releaseCapabilities.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "../outputs/forum-rc");
const evidencePath = resolve(outputDir, "forum-release-candidate-browser.json");
mkdirSync(outputDir, { recursive: true });
const evidence = {
  version: 1,
  checked_at: new Date().toISOString(),
  release_flag_forum: RELEASE_FEATURES.forum,
  viewport: { width: 360, height: 800 },
  checks: [],
  screens: {},
  keyboard: {},
  screen_reader: {},
  console_errors: [],
  page_errors: [],
  fatal_error: null,
};
const check = (name, passed, detail) => {
  evidence.checks.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
};

function layoutSnapshot() {
  const direct = [...document.querySelectorAll("main button, main input:not([type=radio]), main select, main textarea, main a[href]")];
  const radioLabels = [...document.querySelectorAll("main input[type=radio]")]
    .map((input) => input.closest("label")).filter(Boolean);
  const controls = [...new Set([...direct, ...radioLabels])];
  const formula = document.querySelector(".katex-display");
  return {
    viewport_width: window.innerWidth,
    page_scroll_width: document.documentElement.scrollWidth,
    theme: document.documentElement.dataset.theme,
    body_background: getComputedStyle(document.body).backgroundColor,
    body_color: getComputedStyle(document.body).color,
    formula_client_width: formula?.clientWidth ?? null,
    formula_scroll_width: formula?.scrollWidth ?? null,
    formula_overflow_x: formula ? getComputedStyle(formula).overflowX : null,
    reveal_nodes: document.querySelectorAll(".reveal").length,
    undersized_targets: controls.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        label: node.getAttribute("aria-label") || node.textContent.trim().slice(0, 60),
        height: Math.round(rect.height), width: Math.round(rect.width),
      };
    }).filter((item) => item.height < 44 || item.width < 44),
  };
}

async function activeElement(page) {
  return page.evaluate(() => {
    const node = document.activeElement;
    const label = node?.getAttribute?.("aria-label")
      || node?.labels?.[0]?.textContent?.trim()
      || node?.textContent?.trim()
      || node?.getAttribute?.("name") || "";
    const style = node ? getComputedStyle(node) : null;
    return {
      tag: node?.tagName ?? null,
      label: label.slice(0, 100),
      outline_style: style?.outlineStyle ?? null,
      outline_width: style?.outlineWidth ?? null,
    };
  });
}

async function tabTo(page, matcher, { max = 45, reset = true } = {}) {
  if (reset) await page.evaluate(() => {
    document.activeElement?.blur();
    document.body.tabIndex = -1;
    document.body.focus();
  });
  const path = [];
  for (let index = 0; index < max; index += 1) {
    await page.keyboard.press("Tab");
    const active = await activeElement(page);
    path.push(active.label);
    if (matcher.test(active.label)) return { found: true, steps: index + 1, active, path };
  }
  return { found: false, steps: max, active: await activeElement(page), path };
}

const server = await createServer({
  root, appType: "custom", server: { host: "127.0.0.1", port: 0, strictPort: false },
});
server.middlewares.use(async (request, response, next) => {
  if (request.url?.split("?")[0] !== "/__forum-release-candidate-check") return next();
  const html = await server.transformIndexHtml(request.url, `<!doctype html>
    <html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body><div id="root"></div><script type="module" src="/src/forum/ForumReleaseCandidateBrowserFixture.jsx"></script></body></html>`);
  response.statusCode = 200;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(html);
});

let browser;
try {
  if (RELEASE_FEATURES.forum !== false) throw new Error("RC verifier refuses to run after the forum release flag is enabled.");
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
  const base = `http://127.0.0.1:${port}/__forum-release-candidate-check`;
  const visit = async (screen, theme) => {
    await page.goto(`${base}?screen=${screen}`, { waitUntil: "networkidle" });
    await page.evaluate((nextTheme) => localStorage.setItem("lecture-library-theme", nextTheme), theme);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction((expected) => (
      document.documentElement.dataset.forumReleaseCandidateMounted === expected
    ), screen);
    const layout = await page.evaluate(layoutSnapshot);
    const aria = await page.locator("main").ariaSnapshot();
    await page.screenshot({
      path: resolve(outputDir, `forum-rc-${screen}-${theme}-360.png`), fullPage: true, animations: "disabled",
    });
    evidence.screens[`${screen}_${theme}`] = layout;
    if (theme === "light") evidence.screen_reader[screen] = aria;
    return { layout, aria };
  };

  const screenNames = ["feed", "thread", "submit", "admin"];
  for (const screen of screenNames) {
    await visit(screen, "light");
    await visit(screen, "dark");
  }
  const layouts = Object.values(evidence.screens);
  check("forum flag stays false during release-candidate verification",
    RELEASE_FEATURES.forum === false, { value: RELEASE_FEATURES.forum });
  check("all RC screens render in both themes",
    screenNames.every((screen) => evidence.screens[`${screen}_light`]?.theme === "light"
      && evidence.screens[`${screen}_dark`]?.theme === "dark"),
    Object.fromEntries(screenNames.map((screen) => [screen, {
      light: evidence.screens[`${screen}_light`]?.theme,
      dark: evidence.screens[`${screen}_dark`]?.theme,
    }])));
  check("light and dark palettes are visibly distinct",
    screenNames.every((screen) => (
      evidence.screens[`${screen}_light`]?.body_background
      !== evidence.screens[`${screen}_dark`]?.body_background
    )), Object.fromEntries(screenNames.map((screen) => [screen, {
      light: evidence.screens[`${screen}_light`]?.body_background,
      dark: evidence.screens[`${screen}_dark`]?.body_background,
    }])));
  check("all RC screens avoid page-level horizontal overflow",
    layouts.every((item) => item.page_scroll_width <= item.viewport_width),
    Object.fromEntries(Object.entries(evidence.screens).map(([name, item]) => [name, {
      viewport_width: item.viewport_width, page_scroll_width: item.page_scroll_width,
    }])));
  check("all RC controls meet the 44px target",
    layouts.every((item) => item.undersized_targets.length === 0),
    Object.fromEntries(Object.entries(evidence.screens).map(([name, item]) => [name, item.undersized_targets])));
  check("RC screens mount no unowned Reveal blocks",
    layouts.every((item) => item.reveal_nodes === 0),
    Object.fromEntries(Object.entries(evidence.screens).map(([name, item]) => [name, item.reveal_nodes])));

  await visit("thread", "light");
  const unsafe = await page.evaluate(() => ({
    script_nodes: document.querySelectorAll("main script").length,
    hostile_image_nodes: document.querySelectorAll('main img[src="x"]').length,
    script_executed: window.__forumRcXss === true,
    image_executed: window.__forumRcImg === true,
    literal_script_visible: document.querySelector("main")?.textContent?.includes("<script>window.__forumRcXss = true</script>") ?? false,
  }));
  const threadLayout = evidence.screens.thread_light;
  check("hostile Markdown remains visible text and never executes",
    unsafe.literal_script_visible && unsafe.script_nodes === 0 && unsafe.hostile_image_nodes === 0
      && !unsafe.script_executed && !unsafe.image_executed, unsafe);
  check("long formulas scroll inside their own block",
    threadLayout.formula_overflow_x === "auto"
      && threadLayout.formula_scroll_width > threadLayout.formula_client_width,
    { overflow_x: threadLayout.formula_overflow_x, client_width: threadLayout.formula_client_width, scroll_width: threadLayout.formula_scroll_width });

  await visit("feed", "light");
  const searchPath = await tabTo(page, /Search discussions/i);
  await page.keyboard.type("rotation");
  await page.keyboard.press("Enter");
  await page.getByText("Results for “rotation”").waitFor();
  const searchResultVisible = await page.getByText("Results for “rotation”").isVisible();
  const clearPath = await tabTo(page, /Clear discussion search/i);
  await page.keyboard.press("Space");
  await page.waitForFunction(() => !document.querySelector("main")?.textContent?.includes("Results for “rotation”"));
  const clearResultGone = await page.getByText("Results for “rotation”").count() === 0;
  const newPath = await tabTo(page, /^New$/i);
  await page.keyboard.press("Space");
  await page.waitForFunction(() => [...document.querySelectorAll("button")]
    .some((button) => button.textContent?.trim() === "New" && button.getAttribute("aria-pressed") === "true"));
  const newPressed = await page.getByRole("button", { name: "New", exact: true }).getAttribute("aria-pressed");
  evidence.keyboard.feed = {
    searchPath, clearPath, newPath, searchResultVisible, clearResultGone, newPressed,
  };
  check("feed search, clear, and sorting work by keyboard",
    searchPath.found && clearPath.found && newPath.found
      && searchResultVisible && clearResultGone && newPressed === "true", evidence.keyboard.feed);
  const focusWidth = Number.parseFloat(searchPath.active.outline_width || "0");
  check("keyboard focus has a visible global focus ring",
    searchPath.active.outline_style !== "none" && focusWidth >= 2, searchPath.active);

  await visit("thread", "dark");
  const collapsePath = await tabTo(page, /Collapse replies/i);
  await page.keyboard.press("Enter");
  const collapsed = await page.getByRole("button", { name: /Show 2 hidden replies/i }).getAttribute("aria-expanded");
  const reportPath = await tabTo(page, /Report this discussion/i);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const dialogAria = await dialog.ariaSnapshot();
  const dialogInitialFocus = await activeElement(page);
  await page.keyboard.press("Tab");
  const firstReasonFocus = await activeElement(page);
  await page.keyboard.press("ArrowUp");
  const selfHarmFocus = await activeElement(page);
  const selfHarmPath = {
    found: /Self-harm or suicide concern/i.test(selfHarmFocus.label),
    firstReasonFocus,
    active: selfHarmFocus,
  };
  await page.keyboard.press("Space");
  const selfHarmRadio = page.locator('input[name="forum-report-reason"][value="self_harm"]');
  const selfHarmRadioCount = await selfHarmRadio.count();
  const selfHarmChecked = selfHarmRadioCount === 1 && await selfHarmRadio.isChecked();
  const urgentButtonVisible = selfHarmChecked
    ? await page.getByRole("button", { name: "Send urgent concern" }).isVisible()
    : false;
  const emergencyNoteVisible = await page.getByRole("note").isVisible();
  await page.keyboard.press("Escape");
  const dialogClosed = await dialog.count() === 0;
  const returnedFocus = await activeElement(page);
  evidence.keyboard.thread = {
    collapsePath, collapsed, reportPath, dialogInitialFocus, selfHarmPath,
    selfHarmRadioCount, selfHarmChecked,
    urgentButtonVisible, emergencyNoteVisible, dialogClosed, returnedFocus,
  };
  evidence.screen_reader.report_dialog = dialogAria;
  check("thread collapse state is exposed and keyboard-operable",
    collapsePath.found && collapsed === "false", { path: collapsePath, aria_expanded: collapsed });
  check("report dialog is keyboard-operable and restores trigger focus",
    reportPath.found && selfHarmPath.found && urgentButtonVisible && emergencyNoteVisible
      && dialogClosed && /Report this discussion/i.test(returnedFocus.label), evidence.keyboard.thread);

  await visit("submit", "light");
  const topicPath = await tabTo(page, /^Topic$/i);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  const titlePath = await tabTo(page, /^Title$/i);
  await page.keyboard.type("Why is angular momentum conserved here?");
  const bodyPath = await tabTo(page, /^Question and context$/i);
  await page.keyboard.type("I tried $L=I\\omega$ but need help choosing the origin.");
  const previewPath = await tabTo(page, /^Preview$/i);
  await page.keyboard.press("Space");
  const previewVisible = await page.locator('[data-forum-markdown="true"]').isVisible();
  const publicNoticeVisible = await page.getByText(/posts and answers can be read by anyone/i).isVisible();
  evidence.keyboard.submit = { topicPath, titlePath, bodyPath, previewPath, previewVisible, publicNoticeVisible };
  check("composer fields and safe preview are keyboard-operable",
    topicPath.found && titlePath.found && bodyPath.found && previewPath.found
      && previewVisible && publicNoticeVisible, evidence.keyboard.submit);

  await visit("admin", "dark");
  const dismissPath = await tabTo(page, /Dismiss report without changing content/i);
  await page.keyboard.press("Enter");
  await page.getByText("No open forum reports").waitFor();
  const dismissedId = await page.locator("html").getAttribute("data-forum-rc-dismissed-report");
  evidence.keyboard.admin = { dismissPath, dismissedId };
  check("missing-target report dismissal is keyboard-operable",
    dismissPath.found && dismissedId === "8", evidence.keyboard.admin);

  const ariaChecks = {
    feed: /heading "Ask, explain and prepare together"/.test(evidence.screen_reader.feed)
      && /search/.test(evidence.screen_reader.feed)
      && /group "Sort discussions"/.test(evidence.screen_reader.feed)
      && /group "Filter discussions by topic"/.test(evidence.screen_reader.feed),
    thread: /heading "How should I approach this rotational mechanics doubt\?"/.test(evidence.screen_reader.thread)
      && /button "Collapse replies"/.test(evidence.screen_reader.thread),
    submit: /heading "Ask a clear question"/.test(evidence.screen_reader.submit)
      && /combobox "Topic"/.test(evidence.screen_reader.submit)
      && /textbox "Title"/.test(evidence.screen_reader.submit)
      && /textbox "Question and context"/.test(evidence.screen_reader.submit),
    admin: /heading "Forum moderation release check"/.test(evidence.screen_reader.admin)
      && /Urgent human review/.test(evidence.screen_reader.admin)
      && /button "Dismiss report without changing content"/.test(evidence.screen_reader.admin),
    report_dialog: /dialog "Report this discussion"/.test(evidence.screen_reader.report_dialog)
      && /radio "Self-harm or suicide concern"/.test(evidence.screen_reader.report_dialog),
  };
  check("screen-reader snapshots expose landmarks, names, groups, and states",
    Object.values(ariaChecks).every(Boolean), ariaChecks);
  check("browser emitted no console or page errors",
    evidence.console_errors.length === 0 && evidence.page_errors.length === 0,
    { console_errors: evidence.console_errors, page_errors: evidence.page_errors });
} catch (error) {
  evidence.fatal_error = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await browser?.close();
  await server.close();
  console.log(`Evidence: ${evidencePath}`);
}

if (evidence.checks.some((item) => !item.passed)) process.exitCode = 1;
