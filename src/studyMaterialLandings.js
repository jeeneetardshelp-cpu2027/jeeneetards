export const JEE_MAIN_PAPERS_PATH = "/materials/jee-main/previous-year-papers";
export const JEE_MAIN_PAPERS_TITLE_PATTERN = "JEE Main%";

export const JEE_MAIN_PAPERS_META = Object.freeze({
  title: "Official JEE Main previous year question papers PDF | JEENEETARD",
  description:
    "Browse reviewed official JEE Main previous-year question papers by year, session and shift, with direct PDF links from CBSE and NTA sources.",
  heading: "Official JEE Main previous year question papers",
});

const SOLUTION_INCLUDED = /\bwith\s+(?:worked\s+)?solutions?\b|\b(?:worked\s+)?solutions?\s+(?:are\s+)?included\b/i;
const SOLUTION_EXCLUDED = /\bno\b[^.]{0,120}\bsolutions?\b|\bwithout\s+solutions?\b/i;

export function paperIncludesSolutions(material) {
  const text = `${material?.title ?? ""} ${material?.description ?? ""}`;
  return SOLUTION_INCLUDED.test(text) && !SOLUTION_EXCLUDED.test(text);
}

export function splitJeeMainPapers(materials = []) {
  return materials.reduce((groups, material) => {
    groups[paperIncludesSolutions(material) ? "withSolutions" : "questionOnly"].push(material);
    return groups;
  }, { questionOnly: [], withSolutions: [] });
}
