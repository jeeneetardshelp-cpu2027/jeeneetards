import { breadcrumbListSchema } from "./structuredData.js";

const MATERIALS_PATH = "/materials";

/** Shared by React and the edge renderer so crawler markup cannot drift. */
export function studyMaterialsPageSchemas() {
  return [
    breadcrumbListSchema([
      { label: "Home", url: "/" },
      { label: "Study material", url: MATERIALS_PATH },
    ]),
  ].filter(Boolean);
}
