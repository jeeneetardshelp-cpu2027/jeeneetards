import { breadcrumbListSchema, itemListSchema } from "./structuredData.js";

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
