export const JEE_MAIN_PAPERS_PATH = "/materials/jee-main/previous-year-papers";
export const JEE_MAIN_PAPERS_TITLE_PATTERN = "JEE Main%";

export const JEE_MAIN_PAPERS_META = Object.freeze({
  title: "JEE Main papers, official answer keys and solutions | JEENEETARD",
  description:
    "Browse JEE Main question papers, official answer keys and reviewed worked solutions by year, session and shift.",
  heading: "JEE Main papers, answer keys and solutions",
});

const ANSWER_KEY_INCLUDED = /\b(?:final\s+)?answer\s+keys?\b/i;
const ANSWER_KEY_EXCLUDED = /\b(?:no|without)\b[^.]{0,80}\banswer\s+keys?\b/i;
const SOLUTION_INCLUDED = /\bwith\s+(?:worked\s+)?solutions?\b|\b(?:worked\s+)?solutions?\s+(?:are\s+)?included\b/i;
const SOLUTION_EXCLUDED = /\bno\b[^.]{0,120}\bsolutions?\b|\bwithout\s+solutions?\b/i;

export function paperIncludesAnswerKey(material) {
  const text = `${material?.title ?? ""} ${material?.description ?? ""}`;
  return ANSWER_KEY_INCLUDED.test(text) && !ANSWER_KEY_EXCLUDED.test(text);
}

export function paperIncludesSolutions(material) {
  const text = `${material?.title ?? ""} ${material?.description ?? ""}`;
  return SOLUTION_INCLUDED.test(text) && !SOLUTION_EXCLUDED.test(text);
}

export function splitJeeMainPapers(materials = []) {
  return materials.reduce((groups, material) => {
    if (paperIncludesSolutions(material)) groups.withSolutions.push(material);
    else if (paperIncludesAnswerKey(material)) groups.answerKeys.push(material);
    else groups.questionOnly.push(material);
    return groups;
  }, { questionOnly: [], answerKeys: [], withSolutions: [] });
}
