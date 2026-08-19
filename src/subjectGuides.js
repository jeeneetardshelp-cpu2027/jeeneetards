// Two deliberately small editorial pilots. These guides are not generated
// from catalogue rows and must not be expanded mechanically: each new entry
// needs source checking and a student-usefulness review before publication.

const SOURCE_CHECKED = "19 August 2026";

const guides = {
  "jee/class-11/physics": {
    scope: { goal: "jee", cls: "class-11", subject: "physics" },
    label: "Study guide",
    title: "A practical order for JEE Class 11 Physics",
    introduction: [
      "Use this page as a route through the free-video catalogue, not as an official class-wise syllabus. NTA publishes JEE Main Physics as one exam syllabus; JEENEETARD's Class 11 label is a navigation aid for planning school-stage study.",
      "For a first pass, dependencies matter more than chasing the shortest playlist. Build the mathematical tools first, then move from motion to forces and energy before rotation, gravitation, thermal physics, and oscillations.",
    ],
    sections: [
      {
        title: "Suggested learning sequence",
        items: [
          "Units, dimensions, vectors, graphs, and the algebra or trigonometry used in Physics",
          "Kinematics, followed by laws of motion and friction",
          "Work, energy and power, then centre of mass and rotational motion",
          "Gravitation, properties of matter, thermal physics, and oscillations or waves",
        ],
      },
      {
        title: "How to choose from the courses",
        paragraphs: [
          "Choose a structured multi-lesson course when the chapter is new or your prerequisites are weak. A one-shot is better treated as revision after you can already solve standard problems. Before committing, compare the teacher, language, lesson count, and chapter coverage shown on the course page.",
          "Do not treat a high rating with only a few votes as proof that a course will suit you. Try one lesson, solve questions without the video open, and change course if the explanation level is a poor match.",
        ],
      },
    ],
    sources: [
      {
        label: "Official JEE Main 2026 syllabus (NTA)",
        href: "https://jeemain.nta.nic.in/document/syllabus-2026/",
      },
      {
        label: "NCERT Class 11 Physics textbooks",
        href: "https://ncert.nic.in/textbook.php?keph1=0-8",
      },
    ],
    sourceChecked: SOURCE_CHECKED,
  },
  "neet/class-11/biology": {
    scope: { goal: "neet", cls: "class-11", subject: "biology" },
    label: "Study guide",
    title: "A practical way to study NEET Class 11 Biology",
    introduction: [
      "Use NCERT as the anchor and this page as a route to supporting free lectures. The official NEET syllabus is published for the examination as a whole; JEENEETARD's Class 11 label is a navigation aid, not a replacement for the current NTA and NMC syllabus.",
      "Biology improves when a lecture leads back to active reading. Read the relevant NCERT section, watch a lecture for the parts you cannot explain, then close both and retrieve the definitions, diagrams, examples, and exceptions from memory.",
    ],
    sections: [
      {
        title: "Suggested learning sequence",
        items: [
          "The living world and biological classification before detailed plant and animal diversity",
          "Morphology and anatomy before using those structures in physiology",
          "Cell structure, biomolecules, and cell division as the base for later Biology",
          "Plant physiology and human physiology, revisited through diagrams and mixed questions",
        ],
      },
      {
        title: "How to choose from the courses",
        paragraphs: [
          "For an unfamiliar unit, prefer a course that follows the chapter in a stable sequence and leaves time for NCERT reading. Use a one-shot to reconnect ideas during revision, not as the only source for a chapter you have never studied.",
          "After each lesson, write a short recall sheet without copying the screen. Check it against NCERT, correct missing lines or labels, and then practise questions. This exposes weak recall earlier than repeatedly rewatching the same explanation.",
        ],
      },
    ],
    sources: [
      {
        label: "Official NEET UG 2026 syllabus (NMC via NTA)",
        href: "https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/01/202601081066816297.pdf",
      },
      {
        label: "NCERT Class 11 Biology textbook",
        href: "https://www.ncert.nic.in/textbook/pdf/kebo1ps.pdf",
      },
    ],
    sourceChecked: SOURCE_CHECKED,
  },
};

export function subjectGuideKey({ goal, cls, subject } = {}) {
  return [goal, cls, subject].filter(Boolean).join("/");
}

export function getSubjectGuide(scope) {
  return guides[subjectGuideKey(scope)] ?? null;
}

export const SUBJECT_GUIDE_PATHS = Object.freeze(
  Object.keys(guides).map((key) => `/explore/${key}`),
);
