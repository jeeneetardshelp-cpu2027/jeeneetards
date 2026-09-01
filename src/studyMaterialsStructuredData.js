import { breadcrumbListSchema, itemListSchema } from "./structuredData.js";
import { paperYearPath, paperYears } from "./studyMaterialLandings.js";

const MATERIALS_PATH = "/materials";

/** Shared by React and the edge renderer so crawler markup cannot drift. */
const publicMaterialUrl = (material) => material?.sourceUrl ?? material?.source_url;

const isPublicMaterial = (material) => Boolean(
  material?.title && /^https:\/\//i.test(publicMaterialUrl(material) ?? ""),
);

export function studyMaterialsPageSchemas(materials = []) {
  const directory = itemListSchema(
    materials.filter(isPublicMaterial).map((material, index) => ({
      title: material.title,
      url: publicMaterialUrl(material),
      position: index + 1,
    })),
  );
  return [
    breadcrumbListSchema([
      { label: "Home", url: "/" },
      { label: "Study material", url: MATERIALS_PATH },
    ]),
    directory,
  ].filter(Boolean);
}

/**
 * Schemas for one exam's paper landing (e.g. the JEE Main papers page).
 *
 * The ItemList names this site's own YEAR pages, not the source PDFs. The
 * landing used to list every PDF, so the one page on this site that ranks for
 * "JEE Main previous year papers" spent all of its outbound signal on files
 * hosted somewhere else and none on its own children. Each year page then
 * lists the PDFs for that year, which is the level where the PDF really is the
 * resource.
 */
export function studyMaterialLandingSchemas(materials = [], landing) {
  if (!landing) return [];
  const years = paperYears(materials.filter(isPublicMaterial));
  const directory = itemListSchema(
    years.map((year, index) => ({
      title: `${landing.examLabel} ${year} papers`,
      url: paperYearPath(landing, year),
      position: index + 1,
    })),
  );
  return [
    breadcrumbListSchema([
      { label: "Home", url: "/" },
      { label: "Study material", url: MATERIALS_PATH },
      { label: landing.crumbLabel, url: landing.path },
    ]),
    directory,
  ].filter(Boolean);
}

/** Schemas for ONE exam year — the leaf, where the PDF is the resource. */
export function paperYearSchemas(materials = [], { landing, year } = {}) {
  if (!landing || !year) return [];
  const directory = itemListSchema(
    materials.filter(isPublicMaterial).map((material, index) => ({
      title: material.title,
      url: publicMaterialUrl(material),
      position: index + 1,
    })),
  );
  return [
    breadcrumbListSchema([
      { label: "Home", url: "/" },
      { label: "Study material", url: MATERIALS_PATH },
      { label: landing.crumbLabel, url: landing.path },
      { label: String(year), url: paperYearPath(landing, year) },
    ]),
    directory,
  ].filter(Boolean);
}
