import { describe, expect, it } from "vitest";
import {
  CONFIDENCE,
  deriveAudienceFocus,
  isAutoAcceptable,
  proposeClassLabels,
  proposeContentType,
  proposeLanguage,
  proposeLearningGoal,
  proposePlaylistTags,
  proposeSubject,
} from "./rules.js";

// The live subject taxonomy the proposer is allowed to choose from.
const SUBJECTS = [
  { id: 1, name: "Physics", slug: "physics" },
  { id: 2, name: "Chemistry", slug: "chemistry" },
  { id: 3, name: "Mathematics", slug: "mathematics" },
  { id: 4, name: "Biology", slug: "biology" },
];

describe("proposeLanguage", () => {
  it("detects hindi from Devanagari script with high confidence", () => {
    const r = proposeLanguage("गति के नियम | Class 11 Physics");
    expect(r.value).toBe("hindi");
    expect(r.confidence).toBe(CONFIDENCE.HIGH);
  });

  it("detects an explicit english-medium tag", () => {
    const r = proposeLanguage("Kinematics (English) | JEE Physics");
    expect(r.value).toBe("english");
    expect(r.confidence).toBe(CONFIDENCE.HIGH);
  });

  it("defaults to hinglish at LOW confidence when no signal is present", () => {
    const r = proposeLanguage("Rotational Motion Complete Lecture");
    expect(r.value).toBe("hinglish");
    expect(r.confidence).toBe(CONFIDENCE.LOW);
    expect(isAutoAcceptable(r)).toBe(false); // must go to review, not be trusted
  });
});

describe("proposeContentType", () => {
  it("recognises a one-shot", () => {
    expect(proposeContentType("Thermodynamics ONE SHOT | JEE 2025").value).toBe("one-shot");
  });

  it("recognises PYQ playlists", () => {
    expect(proposeContentType("Previous Year Questions - Optics").value).toBe("pyq");
  });

  it("recognises revision / crash courses", () => {
    expect(proposeContentType("Rapid Revision - Electrostatics").value).toBe("revision");
  });

  it("returns null with no prefill when nothing matches", () => {
    const r = proposeContentType("Electrostatics");
    expect(r.value).toBeNull();
    expect(r.confidence).toBe(CONFIDENCE.NONE);
  });
});

describe("proposeClassLabels", () => {
  it("returns a single high-confidence class", () => {
    const r = proposeClassLabels("Class 11 Physics - Units and Measurements");
    expect(r.value).toEqual(["11th"]);
    expect(r.confidence).toBe(CONFIDENCE.HIGH);
  });

  it("treats an explicit Dropper batch as high confidence", () => {
    const r = proposeClassLabels("Dropper Batch 2025 - Full Physics");
    expect(r.value).toContain("Dropper");
    expect(r.confidence).toBe(CONFIDENCE.HIGH);
  });

  it("returns an EMPTY array (not a guess) when unclassifiable", () => {
    const r = proposeClassLabels("Physics Wallah - Best Lectures");
    expect(r.value).toEqual([]);
    expect(r.confidence).toBe(CONFIDENCE.NONE);
  });
});

describe("proposeLearningGoal", () => {
  it("detects JEE", () => {
    expect(proposeLearningGoal("JEE Advanced Physics").value).toBe("jee");
  });

  it("detects NEET", () => {
    expect(proposeLearningGoal("NEET Biology Full Course").value).toBe("neet");
  });
});

describe("proposeSubject", () => {
  it("only ever returns an id from the live taxonomy", () => {
    const r = proposeSubject("Organic Chemistry - Hydrocarbons", SUBJECTS);
    expect(r.value).toBe(2); // Chemistry id
    expect(SUBJECTS.some((s) => s.id === r.value)).toBe(true);
  });

  it("matches Mathematics via the 'maths' synonym", () => {
    expect(proposeSubject("Maths - Integration by Parts", SUBJECTS).value).toBe(3);
  });

  it("never invents a subject that is not in the taxonomy", () => {
    const r = proposeSubject("General Studies overview", SUBJECTS);
    expect(r.value).toBeNull();
    expect(r.confidence).toBe(CONFIDENCE.NONE);
  });

  it("requires review whenever metadata carries cross-subject signals", () => {
    const r = proposeSubject(
      "NEET Human Physiology | Chemical Coordination | Chemistry courses also available",
      SUBJECTS,
    );
    expect(r.confidence).toBe(CONFIDENCE.MEDIUM);
    expect(r.evidence).toContain("ambiguous");
  });
});

describe("deriveAudienceFocus", () => {
  it("prefers Dropper when present", () => {
    expect(deriveAudienceFocus(["11th", "12th", "Dropper"]).value).toBe("Dropper");
  });

  it("uses the single class directly", () => {
    const r = deriveAudienceFocus(["12th"]);
    expect(r.value).toBe("12th");
    expect(r.confidence).toBe(CONFIDENCE.HIGH);
  });

  it("flags multi-class focus for review", () => {
    const r = deriveAudienceFocus(["11th", "12th"]);
    expect(r.value).toBe("12th");
    expect(r.confidence).toBe(CONFIDENCE.MEDIUM);
  });
});

describe("proposePlaylistTags — end to end on realistic playlists", () => {
  it("tags a clear JEE Class 11 Physics one-shot mostly auto-acceptably", () => {
    const tags = proposePlaylistTags({
      playlistTitle: "Kinematics ONE SHOT | Class 11 Physics | JEE Main + Advanced",
      channelTitle: "Physics Wallah",
      videoTitles: ["Displacement & Velocity", "Projectile Motion", "Relative Motion"],
      subjects: SUBJECTS,
    });
    expect(tags.subject.value).toBe(1);
    expect(tags.classLabels.value).toEqual(["11th"]);
    expect(tags.learningGoal.value).toBe("jee");
    expect(tags.contentType.value).toBe("one-shot");
    expect(tags.audienceFocus.value).toBe("11th");
    // difficulty is deliberately never auto-accepted
    expect(isAutoAcceptable(tags.difficulty)).toBe(false);
  });

  it("routes an under-specified playlist to review instead of guessing", () => {
    const tags = proposePlaylistTags({
      playlistTitle: "Best Lectures Collection",
      channelTitle: "Study Hub",
      subjects: SUBJECTS,
    });
    expect(tags.subject.value).toBeNull();
    expect(tags.classLabels.value).toEqual([]);
    expect(isAutoAcceptable(tags.subject)).toBe(false);
    expect(isAutoAcceptable(tags.classLabels)).toBe(false);
  });

  it("detects a NEET Biology dropper full course in Hindi", () => {
    const tags = proposePlaylistTags({
      playlistTitle: "जीव विज्ञान Complete Course | NEET Dropper Batch",
      channelTitle: "NEET Wallah",
      subjects: SUBJECTS,
    });
    expect(tags.subject.value).toBe(4); // Biology
    expect(tags.learningGoal.value).toBe("neet");
    expect(tags.classLabels.value).toContain("Dropper");
    expect(tags.language.value).toBe("hindi"); // Devanagari present
    expect(tags.contentType.value).toBe("full-course");
  });
});
