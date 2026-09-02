import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = dirname(fileURLToPath(import.meta.url));

function relativeSourceFiles() {
  return [
    "adminUI.jsx",
    "AppShell.jsx",
    "BrowsePage.jsx",
    "CourseOverview.jsx",
    "CourseRating.jsx",
    "CourseVideoPage.jsx",
    "Explore.jsx",
    "FilterPanel.jsx",
    "Home.jsx",
    "LegalPage.jsx",
    "MinimalUI.jsx",
    "PlaylistBrowse.jsx",
    "PlaylistCard.jsx",
    "PrivacyPolicy.jsx",
    "StudentAuth.jsx",
    "UniversalSearch.jsx",
    "VideoReport.jsx",
  ];
}

function relativeLuminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => (
    value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

describe("frontend release-file integrity", () => {
  it("keeps Compare.jsx free of raw NUL bytes", () => {
    const source = readFileSync(resolve(sourceRoot, "Compare.jsx"));
    expect(source.includes(0)).toBe(false);
  });

  it("uses a teal that passes WCAG AA under white button text everywhere", async () => {
    const { BRAND_TEAL } = await import("./brandColors.js");
    const contrast = 1.05 / (relativeLuminance(BRAND_TEAL) + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(4.5);

    for (const file of relativeSourceFiles()) {
      const source = readFileSync(resolve(sourceRoot, file), "utf8");
      expect(source, `${file} still contains the inaccessible legacy teal`)
        .not.toContain("#13919B");
    }
  });

  it("keeps release documentation aligned with durable repository facts", () => {
    const repositoryRoot = resolve(sourceRoot, "..");
    const readme = readFileSync(resolve(repositoryRoot, "README.md"), "utf8");
    const deploymentGuide = readFileSync(
      resolve(repositoryRoot, "docs", "frontend_deployment.md"),
      "utf8",
    );

    expect(readme).toContain("#0F6F78");
    expect(readme).not.toContain("#13919B");
    expect(deploymentGuide).not.toContain(
      "no hosting account or public site has been created",
    );
    expect(deploymentGuide).not.toContain(
      "This project copy is not currently a Git repository",
    );
    expect(deploymentGuide).not.toContain("Verified on 23 July 2026");
  });
});

// =====================================================================
//  THE BRIDGE GUARD
//
//  src/index.css used to carry a "LEGACY BRIDGE": rules scoped to
//  [data-student-surface] that re-coloured literal Tailwind slate/white
//  utilities so the dark default did not look broken. It was retired on
//  2026-09-02. The failure mode it existed for is silent — a literal
//  colour class looks fine in whichever theme the author had open and
//  wrong in the other — and jsdom applies no CSS, so no rendering test can
//  catch it. This scan is the guard instead: it reads source text.
//
//  Scope: originally only files that render inside
//  <Layout data-student-surface> in App.jsx. /admin is routed OUTSIDE that
//  layout, so the admin components were never covered by the bridge — and,
//  having no bridge, they were never dark-correct at all. The core admin
//  cluster (AdminPanel, adminUI, TeacherPicker, FacultyReviewPanel,
//  ContentQualityPanel, ManageCatalogPanel, ImportPlaylistForm,
//  EditorialTitleField) was moved to palette tokens on 2026-09-02 and is
//  scanned here now, so it cannot regress. The last three exclusions —
//  forum/ForumBetaAdminPanel.jsx, forum/ForumReportsPanel.jsx and
//  polls/PollReviewPanel.jsx — were removed the same day, so every .jsx in
//  src/, src/forum/ and src/polls/ is scanned. The exclusion list is empty.
// =====================================================================

// Deliberately empty. It used to hold the forum and polls admin panels,
// on the belief that they were "still full of literal slate". They were
// not: all three colour themselves through useTheme().t, and t has pointed
// at palette tokens since theme.jsx was rewritten, so they came over with
// it. The only literals left in them are `text-white` on a BRAND_TEAL
// button, which this scan deliberately does not flag (see BRIDGED_LITERAL)
// and which is commented at each call site.
//
// The mechanism is kept, not deleted, so a genuinely unmigrated admin file
// has a documented place to wait. Adding a name here hides that file from
// the colour guard, so it is a last resort with a dated reason — do not use
// it to silence a failure in a file that should simply be fixed.
const ADMIN_ONLY = new Set([]);

// A literal that must NOT follow the theme, with the reason it must not.
// Every entry is painted on something whose colour is fixed in both themes,
// so a token here would be the bug. Each one is also explained at the point
// it is written. Entries may be removed freely; an entry for a class that no
// longer exists is harmless.
const THEME_FIXED = {
  "YouTubePlayer.jsx": {
    classes: ["bg-slate-900", "bg-slate-950", "text-slate-200", "text-slate-300"],
    reason:
      "the video stage is a black rectangle in both themes, so its overlays are fixed light-on-dark",
  },
  "FilterPanel.jsx": {
    classes: ["bg-white"],
    reason:
      "the checkbox tick sits on BRAND.teal, which is the same colour in both themes",
  },
  "Compare.jsx": {
    classes: ["text-slate-800"],
    reason:
      "light-only branch of an explicit `dark ? … : …`; Compare picks both colours itself and has not been moved to tokens yet",
  },
};

// The vocabulary the bridge actually rewrote: surface whites and the whole
// slate scale (plus its gray twin), in any utility position and under any
// variant. Deliberately NOT included: text-white / border-white /
// outline-white / fill-white and bg-black. Those are the product's standing
// "fixed ink on a coloured fill" idiom — a teal button, a play glyph over a
// thumbnail — they were never bridged, and flagging them would bury this
// check under twenty exceptions that all say the same thing.
const BRIDGED_LITERAL =
  /(?<![\w-])(?:[a-z-]+:)*(bg-white(?:\/\d{1,3})?|(?:bg|text|border|ring|divide|outline|from|via|to|placeholder|decoration|caret|accent|fill|stroke)-(?:slate|gray)-\d{2,3}(?:\/\d{1,3})?)(?![\w-])/g;

// Prose is not code. Block comments go entirely; line comments go only when
// the line STARTS with them, so a URL containing "//" inside a className can
// never swallow the rest of its own line. Both blank the text and keep the
// newlines, so the line numbers this suite reports are the real ones.
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .split("\n")
    .map((line) => (/^\s*(\/\/|\*)/.test(line) ? "" : line))
    .join("\n");
}

function studentSurfaceFiles() {
  const found = [];
  for (const dir of ["", "forum", "polls"]) {
    const absolute = dir ? resolve(sourceRoot, dir) : sourceRoot;
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".jsx")) continue;
      if (entry.name.endsWith(".test.jsx")) continue;
      // Standalone browser fixtures are demo pages, not shipped routes.
      if (entry.name.endsWith("BrowserFixture.jsx")) continue;
      const relativePath = dir ? `${dir}/${entry.name}` : entry.name;
      if (ADMIN_ONLY.has(relativePath)) continue;
      found.push(relativePath);
    }
  }
  return found.sort();
}

describe("student-surface colour tokens", () => {
  it("finds the student components it is meant to be scanning", () => {
    // A typo in a path would make this suite pass by reading nothing.
    const files = studentSurfaceFiles();
    expect(files.length).toBeGreaterThan(40);
    // AdminPanel and TeacherPicker are the canary that the migrated admin
    // cluster stays scanned — re-adding them to ADMIN_ONLY fails here.
    for (const expected of [
      "AdminPanel.jsx", "BrowsePage.jsx", "FilterPanel.jsx", "TeacherPicker.jsx",
      "YouTubePlayer.jsx", "forum/ForumFeedPage.jsx",
      // The last three files to leave ADMIN_ONLY (2026-09-02). Naming them here
      // means quietly re-excluding one fails this test instead of silently
      // dropping it from the scan.
      "forum/ForumBetaAdminPanel.jsx", "forum/ForumReportsPanel.jsx",
      "polls/PollReviewPanel.jsx",
    ]) {
      expect(files, `${expected} is not being scanned`).toContain(expected);
    }
  });

  it("uses palette tokens, not literal slate/white utilities", () => {
    const offences = [];

    for (const file of studentSurfaceFiles()) {
      const source = stripComments(readFileSync(resolve(sourceRoot, file), "utf8"));
      const allowed = new Set(THEME_FIXED[file]?.classes ?? []);
      const lines = source.split("\n");

      lines.forEach((line, index) => {
        for (const match of line.matchAll(BRIDGED_LITERAL)) {
          if (allowed.has(match[1])) continue;
          offences.push(`${file}:${index + 1}  ${match[1]}`);
        }
      });
    }

    expect(
      offences,
      [
        "Literal slate/white utilities found on the student surface.",
        "These do not follow html[data-theme], and the index.css bridge that used to",
        "cover for them is gone. Use a palette token instead — bg-surface, bg-canvas,",
        "bg-surface-2, text-ink, text-ink-2, text-ink-3, border-hairline,",
        "border-hairline-strong, bg-accent-soft/text-accent — or the matching",
        "useTheme().t entry in a file that still uses those.",
        "If the colour genuinely must NOT follow the theme (it sits on a video frame,",
        "a brand fill or a coloured badge), say so in a comment where it is written",
        "and add it to THEME_FIXED above with that reason.",
        "",
        ...offences,
      ].join("\n"),
    ).toEqual([]);
  });

  it("keeps the retired slate/white bridge out of index.css", () => {
    const css = readFileSync(resolve(sourceRoot, "index.css"), "utf8");
    const revived = [...css.matchAll(/\[data-student-surface\][^{]*/g)]
      .map((match) => match[0])
      .filter((selector) => /\.(?:bg-white|(?:bg|text|border|ring|divide|hover\\?:[a-z-]*)-slate-)/.test(selector));

    expect(
      revived,
      "index.css re-colours literal slate/white utilities again. Fix the component instead.",
    ).toEqual([]);
  });
});
