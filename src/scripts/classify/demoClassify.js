// demoClassify.js — runnable demo of the Phase 1 auto-tagging classifier.
//
//   node src/scripts/classify/demoClassify.js
//
// Runs a set of realistic JEE/NEET playlists through proposeTaxonomy and prints
// the per-field decision (auto / review / manual) with confidence and evidence.
// Offline by design — no API keys, no network. To point it at a REAL playlist,
// replace SAMPLE_PLAYLISTS with the output of the existing YouTube fetch
// (src/scripts/youtubeNode.js) and pass your live subjects/goals rows in place
// of DEMO_TAXONOMY.

import { proposeTaxonomy } from "./proposeTaxonomy.js";

// Stand-in for the live DB taxonomy. In real use these come from Supabase.
const DEMO_TAXONOMY = {
  subjects: [
    { id: 1, name: "Physics", slug: "physics" },
    { id: 2, name: "Chemistry", slug: "chemistry" },
    { id: 3, name: "Mathematics", slug: "mathematics" },
    { id: 4, name: "Biology", slug: "biology" },
  ],
  learningGoals: [
    { id: 10, slug: "jee" },
    { id: 20, slug: "neet" },
  ],
};

const SAMPLE_PLAYLISTS = [
  {
    playlistTitle: "Kinematics ONE SHOT | Class 11 Physics | JEE Main + Advanced",
    channelTitle: "Physics Wallah",
    videoTitles: ["Displacement & Velocity", "Projectile Motion", "Relative Motion"],
  },
  {
    playlistTitle: "जीव विज्ञान Complete Course | NEET Dropper Batch",
    channelTitle: "NEET Wallah",
    videoTitles: ["कोशिका", "जैव अणु"],
  },
  {
    playlistTitle: "Organic Chemistry PYQ (English) | JEE Advanced",
    channelTitle: "Chemistry Guru",
    videoTitles: ["Hydrocarbons past papers", "Isomerism problems"],
  },
  {
    // Deliberately under-specified: should route almost everything to review.
    playlistTitle: "Best Lectures Collection",
    channelTitle: "Study Hub",
    videoTitles: [],
  },
];

const ICON = { auto: "OK  ", review: "??  ", manual: "--  " };

function pct(confidence) {
  return `${Math.round(confidence * 100)}%`.padStart(4);
}

function render(name, metadata) {
  const { decisions, summary } = proposeTaxonomy(metadata, DEMO_TAXONOMY);
  console.log(`\n${"=".repeat(78)}`);
  console.log(`PLAYLIST: ${metadata.playlistTitle}`);
  console.log(`CHANNEL:  ${metadata.channelTitle}`);
  console.log(
    `SUMMARY:  ${summary.auto} auto-accepted · ${summary.review} to review · ${summary.manual} manual`,
  );
  console.log("-".repeat(78));
  for (const [field, d] of Object.entries(decisions)) {
    const value = Array.isArray(d.value) ? `[${d.value.join(", ")}]` : String(d.value);
    console.log(
      `  ${ICON[d.status]} ${field.padEnd(17)} ${pct(d.confidence)}  ${value.padEnd(14)} ${d.evidence}`,
    );
  }
}

console.log("Phase 1 auto-tagging — decision preview");
console.log("Legend:  OK = auto-accept (high confidence)   ?? = human review   -- = manual (Phase 2-4)");
for (const playlist of SAMPLE_PLAYLISTS) render(playlist.playlistTitle, playlist);
console.log("");
