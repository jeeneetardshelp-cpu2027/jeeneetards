// Conservative editorial helpers for student-facing course titles.
//
// These functions never write to the database and never decide what a course
// is about. They only clean spacing/case and surface suspicious source-title
// patterns for a human curator to review.

const ACRONYMS = new Map([
  ["jee", "JEE"], ["neet", "NEET"], ["cbse", "CBSE"], ["iit", "IIT"],
  ["pyq", "PYQ"], ["nlm", "NLM"], ["ncert", "NCERT"], ["ioqm", "IOQM"],
  ["kvpy", "KVPY"], ["ntse", "NTSE"], ["bitsat", "BITSAT"],
]);

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);

function titleCaseWord(word, index) {
  const edge = word.match(/^(?<before>[^\p{L}\p{N}]*)(?<core>[\p{L}\p{N}'’.-]+)(?<after>[^\p{L}\p{N}]*)$/u);
  if (!edge?.groups?.core) return word;
  const { before, core, after } = edge.groups;
  const lower = core.toLocaleLowerCase("en-IN");
  if (ACRONYMS.has(lower)) return `${before}${ACRONYMS.get(lower)}${after}`;
  if (index > 0 && SMALL_WORDS.has(lower)) return `${before}${lower}${after}`;
  return `${before}${lower.charAt(0).toLocaleUpperCase("en-IN")}${lower.slice(1)}${after}`;
}

export function normalizeTitleWhitespace(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u00a0\t\r\n]+/gu, " ")
    .replace(/\s{2,}/gu, " ")
    .trim();
}

export function suggestEditorialTitle(value) {
  const clean = normalizeTitleWhitespace(value);
  if (!clean || !/[A-Za-z]/u.test(clean)) return clean;

  // Preserve the wording and punctuation. Only case Latin words; Devanagari
  // and other scripts pass through unchanged.
  return clean
    .split(" ")
    .map((word, index) => /[A-Za-z]/u.test(word) ? titleCaseWord(word, index) : word)
    .join(" ");
}

export function titleQualityIssues(value) {
  const title = normalizeTitleWhitespace(value);
  const issues = [];
  if (!title) return [{ code: "blank", severity: "blocking", message: "A display title is required." }];
  if (title.length < 3)
    issues.push({ code: "too-short", severity: "blocking", message: "The title is too short to identify a course." });
  if (title.length > 90)
    issues.push({ code: "too-long", severity: "blocking", message: "Keep the course title under 90 characters; move exam and chapter details into filters." });
  if (/\|/u.test(title))
    issues.push({ code: "pipe-list", severity: "warning", message: "This looks like a keyword list. Use one concise course name." });
  // A bare leading number ("1- Rectilinear motion", "22 Questions on ...") is
  // the same defect as "#1" or "Lecture 1": the lesson list already shows the
  // position. Excludes a number that is part of the subject ("12th Chemistry",
  // "3D Geometry", "2 Variables") — only a number followed by a separator or
  // by a capitalised/Devanagari word counts as numbering.
  if (
    /^\s*(?:#\s*\d+|(?:lecture|lesson|part|episode|l)\s*[-:#.]?\s*\d+)/iu.test(title) ||
    /^\s*\d{1,3}\s*[-–—.):]\s*(?=\S)/u.test(title) ||
    /^\s*\d{1,3}\s+(?=\p{Lu}|\p{Script=Devanagari})/u.test(title)
  )
    issues.push({ code: "episode-prefix", severity: "warning", message: "Remove lecture or episode numbering from a course title." });
  if (/\b(?:complete playlist|must watch|best ever|100% guaranteed)\b/iu.test(title))
    issues.push({ code: "promotional", severity: "warning", message: "Remove promotional claims that the directory cannot verify." });
  const letters = title.match(/[A-Za-z]/gu) ?? [];
  if (letters.length >= 8 && letters.every((letter) => letter === letter.toLocaleUpperCase("en-IN")))
    issues.push({ code: "all-caps", severity: "warning", message: "Avoid an all-caps display title." });
  if (/\s{2,}|^\s|\s$/u.test(String(value ?? "")))
    issues.push({ code: "spacing", severity: "warning", message: "Collapse repeated whitespace." });
  return issues;
}

export function titleCanBeApproved(value) {
  return !titleQualityIssues(value).some((issue) => issue.severity === "blocking");
}

