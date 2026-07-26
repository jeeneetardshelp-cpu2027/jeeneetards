// demoQualityGate.js — offline dry-run of the pre-import quality gate.
//
//   node src/scripts/classify/demoQualityGate.js
//
// Runs validatePlaylistQuality against playlists modeled on REAL cases from
// docs/mass_ingestion_preflight.md — the ones Codex accepted and the ones it
// deferred/blocked by hand — so you can see the report the gate produces.
// Offline by design: no API keys, no network. To gate a real playlist, feed
// the output of youtubeNode.getPlaylistVideos() plus the live set of catalogue
// video IDs in place of these fixtures.

import { validatePlaylistQuality } from "./validatePlaylistQuality.js";

// A known teacher roster (seed from the current catalogue) and a pretend set of
// video IDs already in the catalogue, for the overlap check.
const KNOWN_TEACHERS = ["ALK Sir", "NS Sir", "Mohit Tyagi"];
const EXISTING = new Set(["sk0AndvKmfE", "waveOptics_07"]);

const v = (videoId, title, position) => ({ videoId, title, position });

const CASES = [
  {
    name: "Periodic Table (Codex ACCEPTED)",
    playlist: {
      title: "CHEMISTRY-PERIODIC TABLE",
      videos: [
        v("pt1", "CHEMISTRY-PERIODIC TABLE #1 #alksir", 0),
        v("pt2", "CHEMISTRY-PERIODIC TABLE #2", 1),
        v("pt3", "CHEMISTRY-PERIODIC TABLE #3", 2),
      ],
    },
    expectedVideoCount: 3,
  },
  {
    name: "Nuclear Physics (Codex BLOCKED — repeats a video ID)",
    playlist: {
      title: "PHYSICS-NUCLEAR",
      videos: [
        v("sk0AndvKmfE", "#1 Radioactivity #alksir", 0),
        v("nuc2", "#2 Half Life", 1),
        v("sk0AndvKmfE", "#3 Decay (repeat)", 2),
      ],
    },
    expectedVideoCount: 3,
  },
  {
    name: "Ray Optics (Codex BLOCKED — duplicate lesson 36 + foreign lesson)",
    playlist: {
      title: "PHYSICS-RAY OPTICS",
      videos: [
        v("ro35", "#35 Mirrors #alksir", 0),
        v("ro36a", "#36 Lenses", 1),
        v("ro36b", "#36 Lens Formula", 2),
        v("ro37", "#37 Prism", 3),
      ],
    },
    expectedVideoCount: 4,
  },
  {
    name: "Wave on String (Codex DEFERRED — lessons out of order)",
    playlist: {
      title: "PHYSICS-WAVE ON STRING",
      videos: [
        v("ws5", "#5 Reflection #alksir", 0),
        v("ws8", "#8 Beats", 1),
        v("ws6", "#6 Standing Waves", 2),
        v("ws7", "#7 Harmonics", 3),
      ],
    },
    expectedVideoCount: 4,
  },
  {
    name: "Sound Waves (Codex DEFERRED — includes an existing Wave Optics video)",
    playlist: {
      title: "PHYSICS-SOUND WAVES",
      videos: [
        v("sw1", "#1 Sound Basics #alksir", 0),
        v("waveOptics_07", "#2 (reused Wave Optics lesson)", 1),
        v("sw3", "#3 Doppler Effect", 2),
      ],
    },
    expectedVideoCount: 3,
  },
  {
    name: "General Inorganic (Codex DEFERRED — no teacher evidence)",
    playlist: {
      title: "CHEMISTRY-GENERAL INORGANIC",
      videos: [
        v("gi1", "#1 Bonding Overview", 0),
        v("gi2", "#2 Lattice Energy", 1),
      ],
    },
    expectedVideoCount: 2,
  },
  {
    name: "Gravitation (Codex DEFERRED — usable count below advertised)",
    playlist: {
      title: "PHYSICS-GRAVITATION",
      videos: [
        v("gr1", "#1 Newton's Law #alksir", 0),
        v("gr2", "#2 Field & Potential", 1),
      ],
    },
    expectedVideoCount: 6, // source advertises 6; 4 were deleted/private
  },
];

const BADGE = { ok: "\x1b[32mOK\x1b[0m     ", review: "\x1b[33mREVIEW\x1b[0m ", blocked: "\x1b[31mBLOCKED\x1b[0m" };
const MARK = { block: "\x1b[31m✗\x1b[0m", warn: "\x1b[33m!\x1b[0m" };

console.log("Pre-import quality gate — dry run over real-modeled playlists\n");
let blocked = 0, review = 0, ok = 0;

for (const c of CASES) {
  const report = validatePlaylistQuality({
    playlist: c.playlist,
    existingVideoIds: EXISTING,
    expectedVideoCount: c.expectedVideoCount,
    knownTeachers: KNOWN_TEACHERS,
  });
  if (report.status === "blocked") blocked += 1;
  else if (report.status === "review") review += 1;
  else ok += 1;

  console.log(`${BADGE[report.status]}  ${c.name}`);
  console.log(`         ${report.summary.videoCount} usable video(s)`);
  for (const f of report.findings) {
    console.log(`         ${MARK[f.severity]} [${f.code}] ${f.message}`);
  }
  console.log("");
}

console.log("-".repeat(66));
console.log(`${CASES.length} playlists — \x1b[32m${ok} ok\x1b[0m, \x1b[33m${review} need review\x1b[0m, \x1b[31m${blocked} blocked\x1b[0m.`);
console.log("Blocked = do not import as-is. Review = a human decides. OK = clean.\n");
