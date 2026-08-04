import { breadcrumbListSchema, itemListSchema } from "./structuredData.js";
import { TEST_SECTIONS, findTestSection } from "./testPlatforms.js";

const TESTS_PATH = "/tests";

/** Shared by React and the edge renderer so test-page JSON-LD cannot drift. */
export function testPageSchemas(pathname) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  if (path === TESTS_PATH) {
    return [
      breadcrumbListSchema([
        { label: "Home", url: "/" },
        { label: "Mock tests", url: TESTS_PATH },
      ]),
      itemListSchema(TEST_SECTIONS.map((section, index) => ({
        title: `${section.label} mock tests`,
        url: `${TESTS_PATH}/${section.id}`,
        position: index + 1,
      }))),
    ].filter(Boolean);
  }

  const match = path.match(/^\/tests\/([^/]+)$/);
  const section = match ? findTestSection(match[1]) : null;
  if (!section) return [];
  return [
    breadcrumbListSchema([
      { label: "Home", url: "/" },
      { label: "Mock tests", url: TESTS_PATH },
      { label: section.label, url: `${TESTS_PATH}/${section.id}` },
    ]),
  ].filter(Boolean);
}
