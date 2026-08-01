export const ACADEMIC_CLASS_SLUGS = ["class-10", "class-11", "class-12"];

export function buildChapterClassScopeReport(unfilteredRows, rowsByClass) {
  const classesByChapter = new Map();

  for (const classSlug of ACADEMIC_CLASS_SLUGS) {
    for (const row of rowsByClass[classSlug] ?? []) {
      const classes = classesByChapter.get(row.slug) ?? [];
      if (!classes.includes(classSlug)) classes.push(classSlug);
      classesByChapter.set(row.slug, classes);
    }
  }

  const chapters = (unfilteredRows ?? []).map((row) => ({
    id: row.entity_id,
    slug: row.slug,
    name: row.name,
    classes: (classesByChapter.get(row.slug) ?? []).sort(),
  }));

  return {
    totals: {
      chapters: chapters.length,
      class10: (rowsByClass["class-10"] ?? []).length,
      class11: (rowsByClass["class-11"] ?? []).length,
      class12: (rowsByClass["class-12"] ?? []).length,
      multiClass: chapters.filter((chapter) => chapter.classes.length > 1).length,
      unclassified: chapters.filter((chapter) => chapter.classes.length === 0).length,
    },
    multiClass: chapters.filter((chapter) => chapter.classes.length > 1),
    unclassified: chapters.filter((chapter) => chapter.classes.length === 0),
    chapters,
  };
}
