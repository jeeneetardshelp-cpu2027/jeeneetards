// rules.js — Phase 1 deterministic tag proposers for the import pipeline.
//
// Design rule (see docs / DESIGN_auto_tagging.md): PROPOSE, NEVER INVENT.
// Every proposer returns { value, confidence, evidence } and never writes
// anything. A caller auto-accepts only high-confidence proposals; everything
// else becomes a human review item. Nothing here talks to a network or a DB —
// pure functions over YouTube metadata strings, so it is fully unit-testable.
//
// The controlled vocabularies below MUST stay in sync with
// ingestionSafety.js METADATA_OPTIONS and classLevels.js CLASS_LEVELS.

// Confidence bands. Keep these explicit and human-readable — a wrong tag has
// to be debuggable, and a disputed tag has to be defensible.
export const CONFIDENCE = Object.freeze({
  HIGH: 0.9, // unambiguous single-category match -> safe to auto-accept
  MEDIUM: 0.6, // one weak signal, or a best-of-several -> prefill + review
  LOW: 0.4, // defaulted with no real signal -> review, no trust
  NONE: 0, // no match -> review, no prefill
});

// --- signal dictionaries -------------------------------------------------

const LANGUAGE_SIGNALS = {
  hinglish: [/\bhinglish\b/i],
  english: [/\bin english\b/i, /\benglish medium\b/i, /\(english\)/i],
  hindi: [/\bin hindi\b/i, /\bhindi medium\b/i, /\(hindi\)/i],
};
// Devanagari script anywhere is a strong hindi signal on its own.
const DEVANAGARI = /[ऀ-ॿ]/;

const CONTENT_TYPE_SIGNALS = {
  "one-shot": [/\bone[\s-]?shot\b/i],
  pyq: [/\bpyq'?s?\b/i, /\bprevious year\b/i, /\bpast (?:year|paper)s?\b/i],
  revision: [/\brevision\b/i, /\brapid revision\b/i, /\bcrash course\b/i, /\blast minute\b/i],
  practice: [/\bpractice\b/i, /\bproblem solving\b/i, /\bnumericals?\b/i, /\bquestion practice\b/i],
  "full-course": [/\bcomplete\b/i, /\bfull course\b/i, /\bfull chapter\b/i, /\blectures?\b/i, /\bchapter\b/i],
};

// Values MUST match classLevels.js CLASS_LEVELS exactly.
const CLASS_SIGNALS = {
  Dropper: [/\bdroppers?\b/i, /\brepeaters?\b/i, /\byear drop\b/i],
  "12th": [/\bclass\s*-?\s*12\b/i, /\b12th\b/i, /\bxii\b/i],
  "11th": [/\bclass\s*-?\s*11\b/i, /\b11th\b/i, /\bxi\b/i],
  "10th": [/\bclass\s*-?\s*10\b/i, /\b10th\b/i, /\bx\b/i],
};

const LEARNING_GOAL_SIGNALS = {
  neet: [/\bneet\b/i, /\baiims\b/i],
  jee: [/\bjee\b/i, /\biit\b/i, /\bjee\s*(?:main|advanced|mains|adv)\b/i],
};

// Subject synonyms keyed by the subject slug the DB actually uses. The real
// subject rows are passed in at call time (live taxonomy) — this only adds
// alternate spellings the plain name would miss.
const SUBJECT_SYNONYMS = {
  physics: [/\bphysics\b/i, /\bphy\b/i, /भौतिक/, /फिजिक्स/],
  chemistry: [/\bchemistry\b/i, /\bchemical\b/i, /\bchem\b/i, /\borganic\b/i, /\binorganic\b/i, /\bphysical chem/i, /रसायन/, /केमिस्ट्री/],
  mathematics: [/\bmath(?:s|ematics)?\b/i, /गणित/, /मैथ्स/],
  biology: [
    /\bbiology\b/i,
    /\bbio\b/i,
    /\bbotany\b/i,
    /\bzoology\b/i,
    /\bphysiology\b/i,
    /जीव\s*विज्ञान/,
    /बायोलॉजी/,
  ],
};

// --- generic matcher -----------------------------------------------------

// Returns categories that matched, each with how many distinct signals hit,
// sorted strongest-first. Pure and deterministic.
function rankCategories(text, signalMap) {
  const ranked = [];
  for (const [category, patterns] of Object.entries(signalMap)) {
    const matched = patterns.filter((re) => re.test(text));
    if (matched.length > 0) {
      ranked.push({ category, hits: matched.length, matched });
    }
  }
  return ranked.sort((a, b) => b.hits - a.hits);
}

// Turn a ranked list into a single { value, confidence, evidence } proposal.
function bestProposal(ranked, { evidenceLabel }) {
  if (ranked.length === 0) {
    return { value: null, confidence: CONFIDENCE.NONE, evidence: `no ${evidenceLabel} signal` };
  }
  const [top] = ranked;
  const contested = ranked.length > 1 && ranked[1].hits === top.hits;
  const confidence = ranked.length === 1 || !contested ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM;
  const evidence = contested
    ? `ambiguous: ${ranked.map((r) => r.category).join(" vs ")}`
    : `matched ${describe(top.matched)}`;
  return { value: top.category, confidence, evidence };
}

function describe(patterns) {
  return patterns.map((re) => re.source).join(", ");
}

// --- field proposers -----------------------------------------------------

export function proposeLanguage(text) {
  if (DEVANAGARI.test(text)) {
    return { value: "hindi", confidence: CONFIDENCE.HIGH, evidence: "Devanagari script present" };
  }
  const ranked = rankCategories(text, LANGUAGE_SIGNALS);
  if (ranked.length > 0) return bestProposal(ranked, { evidenceLabel: "language" });
  // Hinglish is the JEE/NEET default but is rarely stated. Prefill it, but at
  // LOW confidence so it always goes to review rather than being trusted.
  return {
    value: "hinglish",
    confidence: CONFIDENCE.LOW,
    evidence: "no explicit language signal — defaulted to hinglish for review",
  };
}

export function proposeContentType(text) {
  return bestProposal(rankCategories(text, CONTENT_TYPE_SIGNALS), { evidenceLabel: "content-type" });
}

// class_labels is multi-valued (a Dropper batch may be tagged 11th + 12th too).
// Returns { value: string[], confidence, evidence }. Empty array -> review,
// because classLevels.js treats an untagged playlist as matching NOTHING.
export function proposeClassLabels(text) {
  const ranked = rankCategories(text, CLASS_SIGNALS);
  if (ranked.length === 0) {
    return { value: [], confidence: CONFIDENCE.NONE, evidence: "no class-level signal" };
  }
  const labels = ranked.map((r) => r.category);
  // A single clear class, or an explicit Dropper, is high-confidence.
  const confidence = labels.length === 1 || labels.includes("Dropper")
    ? CONFIDENCE.HIGH
    : CONFIDENCE.MEDIUM;
  return { value: labels, confidence, evidence: `matched ${labels.join(", ")}` };
}

export function proposeLearningGoal(text) {
  return bestProposal(rankCategories(text, LEARNING_GOAL_SIGNALS), { evidenceLabel: "exam/goal" });
}

// subjects: the LIVE rows from the DB, e.g. [{ id, name, slug }]. The proposer
// may ONLY return one of these ids — it can never invent a subject. Falls back
// to { value: null } when nothing matches, which becomes a review item.
export function proposeSubject(text, subjects = []) {
  const matched = [];
  for (const subject of subjects) {
    const slug = String(subject.slug ?? "").toLowerCase();
    const patterns = SUBJECT_SYNONYMS[slug] ?? [nameRegex(subject.name)];
    const hits = patterns.filter((re) => re.test(text)).length;
    if (hits > 0) matched.push({ subject, hits });
  }
  if (matched.length === 0) {
    return { value: null, confidence: CONFIDENCE.NONE, evidence: "no subject match in live taxonomy" };
  }
  matched.sort((a, b) => b.hits - a.hits);
  const [top] = matched;
  // Any cross-subject signal is unsafe to auto-accept. Generic channel or
  // description text can mention another subject, and terms such as
  // "Chemical Coordination" belong to Biology despite containing a strong
  // Chemistry keyword. Keep the best prefill, but require human review.
  const contested = matched.length > 1;
  return {
    value: top.subject.id,
    subjectName: top.subject.name,
    confidence: contested ? CONFIDENCE.MEDIUM : CONFIDENCE.HIGH,
    evidence: contested
      ? `ambiguous: ${matched.map((m) => m.subject.name).join(" vs ")}`
      : `matched subject ${top.subject.name}`,
  };
}

function nameRegex(name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

// audience_focus is the single dominant class the course is really for. Derive
// it from the proposed class labels rather than asking for it separately.
export function deriveAudienceFocus(classLabels = []) {
  if (classLabels.length === 0) {
    return { value: null, confidence: CONFIDENCE.NONE, evidence: "no class labels to derive from" };
  }
  if (classLabels.includes("Dropper")) {
    return { value: "Dropper", confidence: CONFIDENCE.HIGH, evidence: "Dropper present" };
  }
  if (classLabels.length === 1) {
    return { value: classLabels[0], confidence: CONFIDENCE.HIGH, evidence: "single class label" };
  }
  // Multiple non-Dropper classes: pick the higher class as the focus, flag it.
  const ordered = ["12th", "11th", "10th"].find((c) => classLabels.includes(c));
  return { value: ordered, confidence: CONFIDENCE.MEDIUM, evidence: `multiple classes, chose ${ordered}` };
}

// --- orchestrator --------------------------------------------------------

// Combine playlist + channel + video signals into one proposal per field.
// Weighting: the playlist title and channel are the strongest signals, so they
// are repeated to bias the match; video titles add breadth for subject/class.
export function proposePlaylistTags({
  playlistTitle = "",
  playlistDescription = "",
  channelTitle = "",
  videoTitles = [],
  subjects = [],
} = {}) {
  const strong = [playlistTitle, channelTitle].join(" \n ");
  const full = [strong, strong, playlistDescription, ...videoTitles].join(" \n ");

  const language = proposeLanguage(full);
  const contentType = proposeContentType(strong || full);
  const classLabels = proposeClassLabels(full);
  const learningGoal = proposeLearningGoal(strong || full);
  const subject = proposeSubject(full, subjects);
  const audienceFocus = deriveAudienceFocus(classLabels.value);

  return {
    language,
    contentType,
    classLabels,
    learningGoal,
    subject,
    audienceFocus,
    // difficulty is intentionally NOT auto-detected — no reliable title signal.
    // Default it and force review rather than guess. (See DESIGN §9.)
    difficulty: {
      value: "advanced",
      confidence: CONFIDENCE.LOW,
      evidence: "not inferable from metadata — defaulted, needs review",
    },
  };
}

// A field is safe to auto-accept only at HIGH confidence. Callers use this to
// split a proposal set into { auto, review } for the human queue.
export function isAutoAcceptable(proposal) {
  return Boolean(proposal) && proposal.confidence >= CONFIDENCE.HIGH;
}
