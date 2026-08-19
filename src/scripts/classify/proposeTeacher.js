// proposeTeacher.js — Phase 3 teacher-evidence candidate proposer.
//
// This module mirrors the faculty registry's central safety rule: normalized
// name equality suggests a candidate; it never proves identity. It scans only
// explicit attribution signals (for example "ALK Sir", "Faculty: X", or a
// reviewed alias hashtag), returns candidates from the supplied live registry,
// and always requires a human decision. It performs no I/O and creates no
// teacher, alias, or playlist link.

import { CONFIDENCE } from "./rules.js";

const HONORIFICS = new Set([
  "sir", "maam", "mam", "madam", "mister", "mr", "mrs", "ms", "miss",
  "dr", "doctor", "prof", "professor", "ji", "bhaiya", "bhaiyya", "guruji",
]);

const ATTRIBUTION_LABELS = ["teacher", "faculty", "educator", "instructor"];

function toText(value) {
  return typeof value === "string" ? value : "";
}

function normalizeSpacing(value) {
  return String(value ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/['’`´]/gu, "")
    .replace(/[\p{P}\p{S}\p{Z}\s]+/gu, " ")
    .trim();
}

// JS counterpart of public.normalize_person_name(). This is a comparison key,
// not an identity key. Unicode letters and combining marks are preserved.
export function normalizePersonName(value) {
  return normalizeSpacing(value)
    .split(" ")
    .filter((token) => token && !HONORIFICS.has(token))
    .join(" ") || null;
}

function compact(value) {
  return String(value ?? "").replace(/\s+/gu, "");
}

function sourcesFrom(metadata = {}) {
  const sources = [];
  const add = (label, value) => {
    const text = toText(value).trim();
    if (text) sources.push({ label, text });
  };

  add("playlist title", metadata.playlistTitle);
  add("playlist description", metadata.playlistDescription);
  add("channel title", metadata.channelTitle);

  for (const [index, title] of (metadata.videoTitles ?? []).entries()) {
    add(`video ${index + 1} title`, title);
  }
  for (const [index, description] of (metadata.videoDescriptions ?? []).entries()) {
    add(`video ${index + 1} description`, description);
  }
  for (const [index, tags] of (metadata.videoTags ?? []).entries()) {
    for (const tag of Array.isArray(tags) ? tags : [tags]) {
      add(`video ${index + 1} tag`, tag);
    }
  }
  for (const [index, video] of (metadata.videos ?? []).entries()) {
    add(`video ${index + 1} title`, video?.title);
    add(`video ${index + 1} description`, video?.description);
    for (const tag of Array.isArray(video?.tags) ? video.tags : []) {
      add(`video ${index + 1} tag`, tag);
    }
  }

  return sources;
}

function hashtagKeys(text) {
  const keys = new Set();
  const hashtags = String(text ?? "").matchAll(/#([\p{L}\p{M}\p{N}_.'’`´-]+)/gu);
  for (const match of hashtags) {
    let key = compact(normalizeSpacing(match[1]));
    for (const honorific of ["professor", "doctor", "guruji", "bhaiyya", "bhaiya", "maam", "madam", "miss", "sir", "mam", "prof", "mrs", "mister", "dr", "mr", "ms", "ji"]) {
      if (key.endsWith(honorific) && key.length > honorific.length + 1) {
        key = key.slice(0, -honorific.length);
        break;
      }
    }
    if (key) keys.add(key);
  }
  return keys;
}

function findExplicitEvidence(source, variant) {
  const normalized = ` ${normalizeSpacing(source.text)} `;
  const name = normalizePersonName(variant);
  if (!name) return null;

  const honorificMatch = [...HONORIFICS].some(
    (honorific) => normalized.includes(` ${name} ${honorific} `),
  );
  if (honorificMatch) return { kind: "honorific", source: source.label };

  const labelledMatch = ATTRIBUTION_LABELS.some(
    (label) => normalized.includes(` ${label} ${name} `),
  );
  if (labelledMatch) return { kind: "label", source: source.label };

  if (hashtagKeys(source.text).has(compact(name))) {
    return { kind: "hashtag", source: source.label };
  }

  return null;
}

function teacherName(teacher) {
  return teacher?.display_name ?? teacher?.displayName ?? teacher?.name ?? "";
}

function teacherAliases(teacher) {
  return (teacher?.aliases ?? []).map((alias) => {
    if (typeof alias === "string") {
      return { alias, status: "proposed" };
    }
    return {
      alias: alias?.alias ?? alias?.name ?? "",
      status: alias?.status ?? "proposed",
    };
  });
}

function candidateFor(teacher, sources) {
  const variants = [
    { text: teacherName(teacher), kind: "display-name", status: null },
    ...teacherAliases(teacher).map((alias) => ({
      text: alias.alias,
      kind: "alias",
      status: alias.status,
    })),
  ];
  const matches = [];

  for (const variant of variants) {
    if (!normalizePersonName(variant.text)) continue;
    for (const source of sources) {
      const evidence = findExplicitEvidence(source, variant.text);
      if (evidence) matches.push({ ...evidence, variant: variant.text, variantKind: variant.kind, aliasStatus: variant.status });
    }
  }

  if (!matches.length) return null;
  const trustedMatch = matches.some(
    (match) => match.variantKind === "display-name" || match.aliasStatus === "verified",
  );
  return {
    teacher_id: teacher.id,
    display_name: teacherName(teacher),
    verified: teacher.verified === true,
    trusted_match: trustedMatch,
    matches,
  };
}

/**
 * Propose teacher candidates from explicit metadata evidence.
 *
 * `teachers` must be the caller-supplied live registry. The function can only
 * return IDs present in that list. `requiresReview` is intentionally always
 * true: even one exact verified candidate is not proof of human identity.
 */
export function proposeTeacher(metadata = {}, teachers = []) {
  const sources = sourcesFrom(metadata);
  const candidates = teachers
    .map((teacher) => candidateFor(teacher, sources))
    .filter(Boolean);

  if (!candidates.length) {
    return {
      value: null,
      confidence: CONFIDENCE.NONE,
      evidence: "no explicit teacher attribution matched the live faculty registry",
      candidates: [],
      requiresReview: true,
    };
  }

  if (candidates.length > 1) {
    return {
      value: null,
      confidence: CONFIDENCE.MEDIUM,
      evidence: `ambiguous faculty evidence matched ${candidates.length} registry candidates`,
      candidates,
      requiresReview: true,
    };
  }

  const [candidate] = candidates;
  const isVerifiedCandidate = candidate.verified && candidate.trusted_match;
  return {
    value: isVerifiedCandidate ? candidate.teacher_id : null,
    confidence: isVerifiedCandidate ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM,
    evidence: isVerifiedCandidate
      ? `explicit attribution matched verified faculty candidate ${candidate.display_name}; human identity confirmation required`
      : `explicit attribution matched only an unverified faculty candidate for ${candidate.display_name}`,
    candidates,
    requiresReview: true,
  };
}
