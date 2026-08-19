// renderIngestionReviewPacket.js — offline Markdown packet for human review.
//
// Reads a verified review bundle and its exact decision worksheet, then writes
// a plain-language evidence packet outside the repository. It never recommends
// or records a decision and has no network, database, or importer path.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { METADATA_OPTIONS } from "./ingestionSafety.js";
import { sha256Json } from "./reviewIngestion.js";
import { verifyDecisionWorksheet } from "./verifyIngestionDecisions.js";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(here, "../..");

export function parseReviewPacketArgs(argv = []) {
  const args = { overwrite: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--bundle") args.bundle = argv[++index];
    else if (arg.startsWith("--bundle=")) args.bundle = arg.slice("--bundle=".length);
    else if (arg === "--decisions") args.decisions = argv[++index];
    else if (arg.startsWith("--decisions=")) {
      args.decisions = arg.slice("--decisions=".length);
    } else if (arg === "--out") args.out = argv[++index];
    else if (arg.startsWith("--out=")) args.out = arg.slice("--out=".length);
    else if (arg === "--overwrite") args.overwrite = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const name of ["bundle", "decisions"]) {
    if (!args[name] || !args[name].toLowerCase().endsWith(".json")) {
      throw new Error(`--${name} must name a JSON file.`);
    }
  }
  return args;
}

function isInside(root, target) {
  const pathFromRoot = relative(resolve(root), resolve(target));
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

export function resolveReviewPacketPaths({
  bundle,
  decisions,
  out,
  cwd = process.cwd(),
  repoRoot = defaultRepoRoot,
} = {}) {
  const bundlePath = resolve(cwd, bundle);
  const decisionsPath = resolve(cwd, decisions);
  const defaultName = basename(decisionsPath).replace(/(?:\.decisions)?\.json$/iu, ".review.md");
  const outputPath = out ? resolve(cwd, out) : resolve(dirname(decisionsPath), defaultName);
  if (!outputPath.toLowerCase().endsWith(".md")) {
    throw new Error("review packet output must use a .md filename.");
  }
  if (isInside(repoRoot, outputPath)) {
    throw new Error("review packet must stay outside the repository.");
  }
  return { bundlePath, decisionsPath, outputPath };
}

export function assertReviewPacketOutputAvailable(
  outputPath,
  overwrite = false,
  pathExists = existsSync,
) {
  if (!overwrite && pathExists(outputPath)) {
    throw new Error(
      `refusing to overwrite existing review packet: ${outputPath}. `
      + "Choose another --out path or pass --overwrite explicitly.",
    );
  }
}

function code(value) {
  const rendered = JSON.stringify(value);
  return `\`${String(rendered ?? "null").replaceAll("`", "\\`")}\``;
}

function text(value) {
  return String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim()
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function candidateLabel(candidate, teacherById) {
  if (candidate?.teacher_id != null) {
    return `${text(candidate.display_name ?? teacherById.get(candidate.teacher_id) ?? "Teacher")} `
      + `(teacher ID ${code(candidate.teacher_id)})`;
  }
  const id = candidate?.id;
  const label = candidate?.name ?? candidate?.label ?? candidate?.display_name ?? candidate?.slug;
  if (id != null) return `${text(label ?? "Taxonomy value")} (ID ${code(id)})`;
  if (label != null) return `${text(label)}`;
  return code(candidate);
}

function decisionStatus(decision) {
  return decision.reviewer_action == null ? "Pending" : text(decision.reviewer_action);
}

function durationLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "unknown";
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = String(whole % 60).padStart(2, "0");
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`;
  return `${minutes}:${remainder}`;
}

function youtubePlaylistUrl(playlistId) {
  return `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
}

function youtubeVideoUrl(videoId) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function controlledValues(field, bundle) {
  if (field === "content_type") return METADATA_OPTIONS.contentType;
  if (field === "language") return METADATA_OPTIONS.language;
  if (field === "difficulty") return METADATA_OPTIONS.difficulty;
  if (field === "audience_focus") {
    return (bundle.proposal.decisions.class_labels?.candidates ?? [])
      .map((candidate) => candidate.label)
      .filter(Boolean);
  }
  return [];
}

export function renderReviewPacket(
  bundle,
  worksheet,
  { generatedAt = new Date().toISOString() } = {},
) {
  const verification = verifyDecisionWorksheet(bundle, worksheet);
  if (!verification.valid) {
    throw new Error(`decision worksheet failed verification: ${verification.errors.join(" ")}`);
  }
  const teacherById = new Map(
    bundle.taxonomy.teachers.map((teacher) => [teacher.id, teacher.display_name]),
  );
  const sourceTags = [...new Set(bundle.source.videos.flatMap(
    (video) => (Array.isArray(video.tags) ? video.tags : []),
  ))];
  const lines = [
    "# Ingestion human-review packet",
    "",
    "> Evidence only. This packet does not recommend, approve, or record decisions. ",
    "> It cannot be imported and does not authorize a database write.",
    "",
    "## Binding and safety",
    "",
    `- Generated: ${code(generatedAt)}`,
    `- Playlist: ${code(bundle.source.owner.playlistId)}`,
    `- Playlist title: ${text(bundle.source.owner.playlistTitle)}`,
    `- Channel: ${text(bundle.source.owner.channelTitle)}`,
    `- Source videos: ${bundle.source.videos.length}`,
    `- Supabase project ref: ${code(bundle.database.project_ref)}`,
    `- Review bundle SHA-256: ${code(worksheet.binding.review_bundle_sha256)}`,
    `- Decision worksheet SHA-256: ${code(sha256Json(worksheet))}`,
    "- Database writes allowed: **No**",
    "- Importable: **No**",
    "",
    "## Review status",
    "",
    `- Structurally valid: **Yes**`,
    `- Human review complete: **${verification.complete ? "Yes" : "No"}**`,
    `- Required decisions: ${verification.summary.required_decisions}`,
    `- Completed decisions: ${verification.summary.completed_decisions}`,
    `- Pending checklist items: ${verification.summary.pending_items}`,
    "",
    "## Source metadata",
    "",
    `- [Open the official YouTube playlist](${youtubePlaylistUrl(bundle.source.owner.playlistId)})`,
    `- Channel ID: ${code(bundle.source.owner.channelId)}`,
    `- Playlist description: ${text(bundle.source.owner.playlistDescription) || "None"}`,
    `- Observed source tags: ${sourceTags.length
      ? sourceTags.map((tag) => code(tag)).join(", ")
      : "None"}`,
    "",
    "### Ordered source videos",
    "",
  ];
  for (const video of bundle.source.videos) {
    lines.push(
      `${video.position}. [${text(video.title)}](${youtubeVideoUrl(video.youtube_video_id)})`,
      `   - YouTube video ID: ${code(video.youtube_video_id)}`,
      `   - Duration: ${durationLabel(video.duration_seconds)}`,
      `   - Captions: ${code(video.caption_status)}`,
      `   - Embedding: ${code(video.embedding_status)}`,
      "",
    );
  }
  lines.push(
    "## Automatic context",
    "",
  );
  const automatic = worksheet.automatic_context.proposal_fields;
  if (!automatic.length) lines.push("No proposal fields were accepted automatically.");
  for (const item of automatic) {
    lines.push(`- **${text(item.field)}:** ${code(item.value)} — ${text(item.evidence)}`);
  }
  lines.push(
    "",
    "## Proposal decisions requiring a human",
    "",
    "Allowed actions are `accept`, `replace`, or `reject`. Replacements and rejections require notes.",
    "",
  );
  if (!worksheet.proposal_decisions.length) lines.push("No proposal decisions are pending.", "");
  for (const decision of worksheet.proposal_decisions) {
    lines.push(
      `### ${code(decision.field)}`,
      "",
      `- Status: **${decisionStatus(decision)}**`,
      `- Proposed value: ${code(decision.proposed_value)}`,
      `- Confidence: ${code(decision.confidence)}`,
      `- Evidence: ${text(decision.evidence)}`,
    );
    if (decision.candidates.length) {
      lines.push("- Live candidates:");
      for (const candidate of decision.candidates) {
        lines.push(`  - ${candidateLabel(candidate, teacherById)}`);
      }
    } else if (controlledValues(decision.field, bundle).length) {
      lines.push(
        `- Allowed controlled values: ${controlledValues(decision.field, bundle)
          .map((value) => code(value)).join(", ")}`,
      );
    } else {
      lines.push("- Live candidates: none embedded.");
    }
    if (decision.reviewer_action != null) {
      lines.push(
        `- Recorded reviewer value: ${code(decision.reviewer_value)}`,
        `- Reviewer notes: ${text(decision.reviewer_notes) || "None"}`,
      );
    }
    lines.push("");
  }
  lines.push("## Per-video scope decisions", "");
  if (!worksheet.video_scope_decisions.length) lines.push("No videos carry scope-review signals.", "");
  for (const decision of worksheet.video_scope_decisions) {
    lines.push(
      `### Position ${decision.position}: ${text(decision.title)}`,
      "",
      `- YouTube video ID: ${code(decision.youtube_video_id)}`,
      `- Status: **${decisionStatus(decision)}**`,
      `- Evidence: ${text(decision.evidence)}`,
      `- Signals: ${decision.signals.map((signal) => code(signal.code)).join(", ")}`,
      `- Per-video teacher candidates: ${decision.teacher_candidate_ids.length
        ? decision.teacher_candidate_ids
          .map((id) => `${text(teacherById.get(id) ?? "Unknown")} (${code(id)})`).join(", ")
        : "None"}`,
      "- Required human choice: `include` or `exclude`.",
      "- Exclusion requires a written rationale.",
    );
    if (decision.reviewer_action != null) {
      lines.push(`- Reviewer notes: ${text(decision.reviewer_notes) || "None"}`);
    }
    lines.push("");
  }
  lines.push("## Per-video chapter decisions", "");
  if (!worksheet.chapter_decisions.length) {
    lines.push("All source videos have automatic live-taxonomy chapter mappings.", "");
  }
  for (const decision of worksheet.chapter_decisions) {
    lines.push(
      `### Position ${decision.position}: ${text(decision.title)}`,
      "",
      `- YouTube video ID: ${code(decision.youtube_video_id)}`,
      `- Status: **${decisionStatus(decision)}**`,
      `- Proposed chapter: ${text(decision.proposed_chapter_name)} (${code(decision.proposed_chapter_id)})`,
      `- Evidence: ${text(decision.evidence)}`,
      "",
    );
  }
  lines.push(
    "## Reviewer identity",
    "",
    `- Name: ${worksheet.reviewer.name ? text(worksheet.reviewer.name) : "Pending"}`,
    `- Reviewed at: ${worksheet.reviewer.reviewed_at ? code(worksheet.reviewer.reviewed_at) : "Pending"}`,
    `- Notes: ${worksheet.reviewer.notes ? text(worksheet.reviewer.notes) : "None"}`,
    "",
    "After recording decisions in the JSON worksheet, regenerate this packet and run the offline decision verifier again.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

export function writeReviewPacket(outputPath, markdown) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, markdown, "utf8");
}

export function main(argv = process.argv.slice(2)) {
  const args = parseReviewPacketArgs(argv);
  const { bundlePath, decisionsPath, outputPath } = resolveReviewPacketPaths(args);
  assertReviewPacketOutputAvailable(outputPath, args.overwrite);
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  const worksheet = JSON.parse(readFileSync(decisionsPath, "utf8"));
  const markdown = renderReviewPacket(bundle, worksheet);
  writeReviewPacket(outputPath, markdown);
  console.log(JSON.stringify({
    output: outputPath,
    playlist: worksheet.binding.playlist_id,
    required_decisions: worksheet.completion.required_proposal_decisions
      + worksheet.completion.required_chapter_decisions
      + worksheet.completion.required_scope_decisions,
    completed_decisions: worksheet.completion.completed_decisions,
    database_writes_allowed: false,
    importable: false,
  }, null, 2));
  return markdown;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(`ingestion review-packet rendering failed: ${error.message}`);
    process.exitCode = 1;
  }
}
