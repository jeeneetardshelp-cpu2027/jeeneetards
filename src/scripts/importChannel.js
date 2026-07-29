// =====================================================================
//  importChannel.js  —  LOCAL bulk importer.  Run with:
//      npm run import -- [channelId] --env=staging --dry-run
//        --expected-playlists=1 --max-playlists=5
//
//  Write mode uses the SERVICE ROLE key, which bypasses row-level security.
//  Dry runs use the browser-safe anonymous key. Run both modes only locally:
//    • the key lives in .env under SUPABASE_SERVICE_ROLE_KEY (no VITE_)
//    • Vite never bundles it, so it can't reach the browser
//    • never commit it, never deploy it, never paste it anywhere
//
//  What it does:
//    1. reads your channel's playlists + videos from YouTube
//    2. shows a preview
//    3. for each playlist, asks you: category, subject, chapter name
//    4. inserts channels/chapters/videos/playlists, skipping duplicates
// =====================================================================

import { createClient } from "@supabase/supabase-js";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  mkdirSync, readFileSync, realpathSync, writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import {
  getChannel, getAllPlaylists, getPlaylistOwner, getPlaylistVideos,
} from "./youtubeNode.js";
import {
  assertImportSelection,
  assertProductionWriteAllowed,
  buildImportPayload,
  findDuplicateVideoIds,
  mappedSourceSnapshotEvidence,
  parseImporterArgs,
  playlistFromOwner,
  promptCourseMetadata,
  validateChapterManifest,
  validateCourseAttribution,
  validateMappedVideoDetails,
} from "./ingestionSafety.js";
import {
  mappedImportBlockingFindings,
  validatePlaylistQuality,
} from "./classify/validatePlaylistQuality.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// --- tiny .env reader (no dependency; Vite isn't running here) --------
function loadEnv(environment) {
  const envPath = resolve(root, environment === "staging" ? ".env.staging" : ".env");
  const env = {};
  try {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch {
    fail(`Couldn't read .env at ${envPath}`);
  }
  return { ...env, ...process.env };
}

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  teal: "\x1b[36m", green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m",
};
const say = (s = "") => console.log(s);
const fail = (msg) => {
  console.error(`${C.red}✗ ${msg}${C.reset}`);
  process.exit(1);
};

// ---------------------------------------------------------------------
async function main() {
  const args = parseImporterArgs(process.argv.slice(2));
  const chapterManifestFile = args.chapterManifest
    ? loadChapterManifest(args.chapterManifest)
    : null;
  try {
    assertProductionWriteAllowed(args);
  } catch (error) {
    fail(error.message);
  }
  const env = loadEnv(args.environment);
  const productionEnv = args.environment === "staging" ? loadEnv("production") : env;
  const url = env.TEST_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const serviceKey = env.TEST_SERVICE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = env.TEST_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  // Node-side key, NOT the VITE_ one. Anything prefixed VITE_ is inlined into
  // the public browser bundle, so it must be referrer-restricted and is not the
  // right credential for a server-side script that can burn quota in bulk.
  const ytKey = env.YOUTUBE_API_KEY ?? productionEnv.YOUTUBE_API_KEY;

  if (!url) fail("VITE_SUPABASE_URL missing from .env");
  if (!ytKey)
    fail("YOUTUBE_API_KEY missing from .env (server-side key — do NOT use VITE_YOUTUBE_API_KEY, that one is public).");
  if (!args.dryRun && (!serviceKey || serviceKey.includes("paste-your")))
    fail(
      "SUPABASE_SERVICE_ROLE_KEY not set in .env.\n" +
        "  Get it from Supabase -> Project Settings -> API -> service_role."
    );
  if (args.dryRun && !publicKey)
    fail("A browser-safe anonymous key is required for --dry-run.");

  // Auth persistence is disabled because each run is a one-shot local process.
  const db = createClient(url, args.dryRun ? publicKey : serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (args.environment === "staging") {
    const { data: marker, error: markerError } = await db
      .from("app_environment")
      .select("name")
      .maybeSingle();
    if (markerError || !["staging", "test"].includes(marker?.name)) {
      fail("The selected database does not carry a staging/test environment marker.");
    }
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const ask = (q) => rl.question(q);

  // --- channel id: from argv, or ask --------------------------------
  let channelId = args.channelId;
  if (!channelId) {
    channelId = (await ask("YouTube channel ID (UC...): ")).trim();
  }
  if (!channelId) fail("No channel ID given.");

  // --- 1. fetch from YouTube ----------------------------------------
  say(`\n${C.dim}Fetching channel…${C.reset}`);
  const channel = await getChannel(ytKey, channelId);
  say(`${C.dim}Fetching playlist${args.nonInteractive ? "" : "s"}…${C.reset}`);
  const playlists = args.nonInteractive
    ? [playlistFromOwner(await getPlaylistOwner(ytKey, args.playlistId), channelId)]
    : await getAllPlaylists(ytKey, channelId);

  if (playlists.length === 0) fail("This channel has no public playlists.");

  const totalVideos = playlists.reduce((n, p) => n + Number(p.videoCount), 0);

  // --- preview ------------------------------------------------------
  say(`\n${C.bold}${C.teal}${channel.title}${C.reset}`);
  say(`  ${playlists.length} playlists · ~${totalVideos} videos total\n`);
  playlists.forEach((p, i) => {
    say(`  ${String(i + 1).padStart(2)}. ${p.title} ${C.dim}(${p.videoCount})${C.reset}`);
  });

  // --- reference data for the prompts -------------------------------
  const referenceResults = await Promise.all([
    db.from("categories").select("id, name"),
    db.from("subjects").select("id, name"),
    db.from("learning_goals").select("id, name, slug").order("display_order"),
  ]);
  const referenceError = referenceResults.find((result) => result.error)?.error;
  if (referenceError) throw referenceError;
  const [categories, subjects, goals] =
    referenceResults.map((result) => result.data);
  const catByName = nameMap(categories);
  const subjByName = nameMap(subjects);
  const goalByName = nameMap(goals);

  say(`\n${C.dim}Categories: ${categories.map((c) => c.name).join(", ")}${C.reset}`);
  say(`${C.dim}Goals:      ${goals.map((g) => g.name).join(", ")}${C.reset}`);
  say(`${C.dim}Subjects:   ${subjects.map((s) => s.name).join(", ")}${C.reset}`);

  const chosen = args.nonInteractive
    ? playlists.filter((playlist) => playlist.id === args.playlistId)
    : pickPlaylists(playlists, (
      await ask(
        `\nImport which playlists? ${C.dim}(all / 1,3,5 / 1-4)${C.reset} `
      )
    ).trim());
  if (chosen.length === 0) fail("Nothing selected.");
  if (chosen.length > args.maxPlaylists) {
    fail(`Selected ${chosen.length} playlists; batch cap is ${args.maxPlaylists}.`);
  }

  // --- 3. map each chosen playlist ----------------------------------
  const plans = [];
  for (const p of chosen) {
    say(`\n${C.bold}${p.title}${C.reset} ${C.dim}(${p.videoCount} videos)${C.reset}`);
    const skip = args.nonInteractive
      ? "n"
      : (await ask(`  Skip this one? (y/N) `)).trim().toLowerCase();
    if (skip === "y") continue;

    const categoryId = args.nonInteractive
      ? namedId(catByName, "category", args.category)
      : await pickOne(ask, "  Category", catByName);
    // Asked for explicitly: the goal is no longer inferred from the category.
    const learningGoalId = args.nonInteractive
      ? namedId(goalByName, "learning goal", args.goal)
      : await pickOne(ask, "  Learning goal", goalByName);
    const goalSlug = goals.find((g) => g.id === learningGoalId)?.slug;
    let boardIds = [];
    if (goalSlug === "school") {
      const { data: boards, error: boardsError } = await db
        .from("boards")
        .select("id, name, slug")
        .order("display_order");
      if (boardsError) throw boardsError;
      const boardByName = nameMap(boards);
      const answer = args.nonInteractive
        ? (args.board ?? "")
        : (await ask(`  Board(s) ${C.dim}(e.g. CBSE)${C.reset}: `)).trim();
      boardIds = answer
        .split(",")
        .map((s) => boardByName.get(s.trim().toLowerCase())?.id)
        .filter(Boolean);
      if (boardIds.length === 0) {
        say(`  ${C.yellow}skipped — school-board content needs at least one board${C.reset}`);
        continue;
      }
    }
    const subjectId = args.nonInteractive
      ? namedId(subjByName, "subject", args.subject)
      : await pickOne(ask, "  Subject", subjByName);
    const chapterName = args.nonInteractive
      ? args.chapter
      : (await ask(`  Chapter name: `)).trim();
    const classLabels = parseClasses(
      args.nonInteractive
        ? args.classes
        : await ask(`  Applicable classes ${C.dim}(e.g. 11th, Dropper)${C.reset}: `)
    );
    if (classLabels.length === 0) {
      say(`  ${C.yellow}skipped — no classes given${C.reset}`);
      continue;
    }

    const metadata = args.nonInteractive
      ? {
        contentType: args.contentType,
        language: args.language,
        difficulty: args.difficulty,
      }
      : await promptCourseMetadata(ask, (_label, options) => {
        say(`  ${C.yellow}Type one of: ${options.join(", ")}${C.reset}`);
      });
    const attribution = args.nonInteractive
      ? validateCourseAttribution({
        teacher: args.teacher,
        audienceFocus: args.audienceFocus,
        classLabels,
      })
      : await promptAttribution(ask, classLabels);
    plans.push({
      playlist: p, categoryId, learningGoalId, boardIds, subjectId,
      chapterName,
      chapterManifest: chapterManifestFile?.manifest ?? null,
      chapterManifestPath: chapterManifestFile?.path ?? null,
      chapterManifestSha256: chapterManifestFile?.sha256 ?? null,
      classLabels,
      ...metadata,
      ...attribution,
    });
  }
  rl.close();

  if (plans.length === 0) fail("No playlists to import after mapping.");
  try {
    assertImportSelection({
      selected: plans.length,
      expected: args.expectedPlaylists,
      max: args.maxPlaylists,
    });
  } catch (error) {
    fail(error.message);
  }

  // --- 4. import — ONE transactional RPC call per playlist ----------
  if (args.dryRun) {
    const entries = [];
    const hasMappedPlan = plans.some((plan) => Boolean(plan.chapterManifest));
    const mappedCapability = hasMappedPlan
      ? await readMappedImportCapability(db)
      : null;
    // The quality gate needs two catalogue-wide inputs, both public-read:
    // every existing video id (to detect cross-chapter reuse) and the known
    // teacher roster (to confirm attribution evidence).
    const existingVideoIds = await fetchCatalogueVideoIds(db, {
      strict: hasMappedPlan,
    });
    const { data: teacherRows, error: teacherError } =
      await db.from("playlists").select("teacher");
    if (hasMappedPlan && teacherError) throw teacherError;
    const knownTeachers = [...new Set((teacherRows ?? []).map((r) => r.teacher).filter(Boolean))];
    let blockedCount = 0;
    let reviewCount = 0;
    for (const plan of plans) {
      const [{ data: existingPlaylist, error: playlistError }, ytVideos] =
        await Promise.all([
          db.from("playlists")
            .select("id,title")
            .eq("youtube_playlist_id", plan.playlist.id)
            .maybeSingle(),
          getPlaylistVideos(ytKey, plan.playlist.id),
        ]);
      if (playlistError) throw playlistError;
      const mapped = plan.chapterManifest
        ? validateChapterManifest({
          manifest: plan.chapterManifest,
          playlistId: plan.playlist.id,
          teacher: plan.teacher,
          videos: ytVideos,
        })
        : null;
      const chapterNames = mapped?.chapterNames ?? [plan.chapterName];
      const chapterRows = await Promise.all(
        chapterNames.map(async (name) => ({
          name,
          chapter: await findChapter(db, name, plan.subjectId),
        })),
      );
      const qualityVideos = mapped?.videos ?? ytVideos;
      const duplicateVideoIds = findDuplicateVideoIds(qualityVideos);
      const detailValidation = mapped
        ? validateMappedVideoDetails(qualityVideos)
        : null;
      // Automated quality gate — the mechanical checks a reviewer used to run by
      // hand (duplicate ids/lesson numbers, order, cross-chapter reuse, teacher
      // evidence, usable-count shortfall). Legacy findings remain advisory;
      // mapped mode applies the same blocking policy here and in write mode.
      const quality = validatePlaylistQuality({
        playlist: { title: plan.playlist.title, videos: qualityVideos },
        existingVideoIds,
        expectedVideoCount: mapped
          ? qualityVideos.length
          : Number(plan.playlist.videoCount),
        knownTeachers: [plan.teacher, ...knownTeachers],
        reviewedTeacherEvidence: Boolean(mapped?.teacherEvidence),
      });
      const missingChapters = chapterRows
        .filter(({ chapter }) => !chapter)
        .map(({ name }) => name);
      const mappedQualityBlockers = mapped && !existingPlaylist
        ? mappedImportBlockingFindings(quality.findings)
        : [];
      const mappedAtomicVerificationFindings = mapped && !existingPlaylist
        ? quality.findings.filter(
          (finding) => finding.code === "cross_chapter_overlap",
        )
        : [];
      const readinessFindings = mapped
        ? [
          ...(!mappedCapability?.supported
            ? [{
              code: "mapped_capability_missing",
              severity: "block",
              message: "The selected database has no verified v12 mapped-import capability.",
            }]
            : []),
          ...(existingPlaylist
            ? [{
              code: "source_playlist_replay_unverified",
              severity: "review",
              message:
                "The source already exists. Anonymous dry-run cannot read the " +
                "audit row; write mode will allow only an exact, drift-free replay.",
            }]
            : []),
          ...(missingChapters.length
            ? [{
              code: "mapped_chapters_missing",
              severity: "block",
              message: `Reviewed chapters are missing: ${missingChapters.join(", ")}.`,
            }]
            : []),
          ...(!detailValidation.ok
            ? [{
              code: "mapped_video_details_incomplete",
              severity: "block",
              message:
                `${detailValidation.missingDurationVideoIds.length} duration and ` +
                `${detailValidation.nonEmbeddableVideoIds.length} embedding check(s) failed.`,
            }]
            : []),
        ]
        : [];
      let effectiveStatus = quality.status;
      if (mapped) {
        const hasBlocker =
          readinessFindings.some(({ severity }) => severity === "block") ||
          mappedQualityBlockers.length > 0;
        const needsReview =
          readinessFindings.some(({ severity }) => severity === "review") ||
          mappedAtomicVerificationFindings.length > 0;
        effectiveStatus = hasBlocker ? "blocked" : needsReview ? "review" : "ok";
      }
      if (effectiveStatus === "blocked") blockedCount += 1;
      else if (effectiveStatus === "review") reviewCount += 1;
      entries.push({
        youtube_playlist_id: plan.playlist.id,
        title: plan.playlist.title,
        published_video_count: Number(plan.playlist.videoCount),
        usable_video_count: ytVideos.length,
        video_validation: {
          duplicate_youtube_video_ids: duplicateVideoIds,
          missing_duration_youtube_video_ids:
            detailValidation?.missingDurationVideoIds ?? [],
          non_embeddable_youtube_video_ids:
            detailValidation?.nonEmbeddableVideoIds ?? [],
          production_blocker:
            duplicateVideoIds.length > 0 || detailValidation?.ok === false,
        },
        quality: {
          status: quality.status,
          effective_status: effectiveStatus,
          findings: quality.findings,
          mapped_write_blocking_findings: mappedQualityBlockers,
          mapped_atomic_verification_findings: mappedAtomicVerificationFindings,
          readiness_findings: readinessFindings,
        },
        existing_playlist: existingPlaylist
          ? { id: existingPlaylist.id, title: existingPlaylist.title }
          : null,
        ...(mapped
          ? {
            chapter_manifest: {
              version: plan.chapterManifest.version,
              request_id: mapped.requestId,
              exact_source_mapping: true,
              path: plan.chapterManifestPath,
              manifest_sha256: plan.chapterManifestSha256,
              source_snapshot_sha256: sourceSnapshotSha256(ytVideos),
              assignment_count: plan.chapterManifest.assignments.length,
              excluded_count: mapped.excludedVideos.length,
              exclusions: mapped.excludedVideos.map((video) => ({
                position: video.sourcePosition + 1,
                youtube_video_id: video.videoId,
                reason: video.exclusionReason,
              })),
              teacher_evidence: mapped.teacherEvidence,
            },
            capability: mappedCapability,
            chapters: chapterRows.map(({ name, chapter }) => ({
              name,
              action: chapter ? "reuse" : "missing",
              write_blocker: !chapter,
              production_blocker: args.environment === "production" && !chapter,
            })),
          }
          : {
            chapter: {
              name: plan.chapterName,
              action: chapterRows[0].chapter ? "reuse" : "create",
              production_blocker:
                args.environment === "production" && !chapterRows[0].chapter,
            },
          }),
        class_labels: plan.classLabels,
        content_type: plan.contentType,
        language: plan.language,
        difficulty: plan.difficulty,
        teacher: plan.teacher,
        audience_focus: plan.audienceFocus,
      });

      const badge = effectiveStatus === "blocked" ? `${C.red}BLOCKED${C.reset}`
        : effectiveStatus === "review" ? `${C.yellow}REVIEW ${C.reset}`
          : `${C.green}OK     ${C.reset}`;
      say(`  ${badge} ${plan.playlist.title} ${C.dim}(${ytVideos.length} usable)${C.reset}`);
      for (const f of quality.findings) {
        const mark = f.severity === "block" ? `${C.red}✗${C.reset}` : `${C.yellow}!${C.reset}`;
        say(`    ${mark} ${f.message}`);
      }
      for (const finding of readinessFindings) {
        const color = finding.severity === "block" ? C.red : C.yellow;
        say(`    ${color}!${C.reset} ${finding.message}`);
      }
    }
    const outputDirectory = resolve(root, "../outputs");
    const outputPath = resolve(outputDirectory, "ingestion-dry-run.json");
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify({
      environment: args.environment,
      channel: { id: channelId, title: channel.title },
      expected_playlists: args.expectedPlaylists,
      batch_cap: args.maxPlaylists,
      entries,
    }, null, 2)}\n`, "utf8");
    say(`\n${C.green}${C.bold}Dry run complete — no Supabase writes${C.reset}`);
    say(`  ${entries.length} playlist plan(s) saved to ${outputPath}`);
    say(
      `  quality gate: ${C.green}${entries.length - blockedCount - reviewCount} ok${C.reset}, ` +
      `${C.yellow}${reviewCount} review${C.reset}, ${C.red}${blockedCount} blocked${C.reset}\n`
    );
    return;
  }

  const summary = { added: 0, reused: 0, courses: 0, coursesReused: 0, chapters: 0 };

  for (const plan of plans) {
    say(`\n${C.teal}▶ ${plan.playlist.title}${C.reset}`);

    const ytVideos = await getPlaylistVideos(ytKey, plan.playlist.id);
    const duplicateVideoIds = findDuplicateVideoIds(ytVideos);
    if (duplicateVideoIds.length > 0) {
      fail(
        `Playlist "${plan.playlist.title}" repeats YouTube video ID(s): ` +
        `${duplicateVideoIds.join(", ")}. No database writes were attempted.`,
      );
    }
    if (ytVideos.length === 0) {
      if (plan.chapterManifest) {
        fail(
          `Mapped import "${plan.playlist.title}" returned no usable source ` +
          "videos; refusing to treat an empty response as a successful skip.",
        );
      }
      say(`  ${C.yellow}no usable videos, skipping${C.reset}`);
      continue;
    }

    let chapterId = null;
    let importVideos = ytVideos;
    let rpc = "import_playlist";
    let importPlan = plan;
    let importPayload = null;
    if (plan.chapterManifest) {
      const mapped = validateChapterManifest({
        manifest: plan.chapterManifest,
        playlistId: plan.playlist.id,
        teacher: plan.teacher,
        videos: ytVideos,
      });
      if (
        mapped.teacherEvidence
        && args.reviewedTeacherEvidenceDecision !== mapped.teacherEvidence.decisionId
      ) {
        fail(
          "A write using reviewed external teacher evidence requires " +
          `--confirm-teacher-evidence=${mapped.teacherEvidence.decisionId}.`,
        );
      }
      await assertMappedImportCapability(db);
      const chapterRows = await Promise.all(
        mapped.chapterNames.map(async (name) => ({
          name,
          chapter: await findChapter(db, name, plan.subjectId),
        })),
      );
      const missing = chapterRows.filter(({ chapter }) => !chapter).map(({ name }) => name);
      if (missing.length > 0) {
        fail(
          `Mapped import requires every reviewed chapter to exist first. Missing: ` +
          `${missing.join(", ")}.`,
        );
      }
      const chapterByName = new Map(
        chapterRows.map(({ name, chapter }) => [name, chapter.id]),
      );
      importVideos = mapped.videos.map((video) => ({
        ...video,
        chapterId: chapterByName.get(video.chapterName),
      }));
      importPlan = {
        ...plan,
        requestId: mapped.requestId,
        manifestSha256: plan.chapterManifestSha256,
        sourceSnapshotSha256: sourceSnapshotSha256(ytVideos),
      };
      rpc = "import_playlist_with_chapters";
      importPayload = buildImportPayload({
        plan: importPlan,
        channel,
        channelId,
        chapterId,
        videos: importVideos,
      });

      // A committed mapped import may be retried after a lost response. Check
      // only for the durable request ID, then let the RPC compare the complete
      // payload and live after-state. Skipping the new-import quality scan is
      // what makes a truthful, write-free replay reachable.
      const { data: priorAudit, error: auditError } = await db
        .from("playlist_import_audit")
        .select("request_id")
        .eq("request_id", mapped.requestId)
        .maybeSingle();
      if (auditError) {
        fail(`checking mapped import request: ${auditError.message}`);
      }

      if (!priorAudit) {
        const detailValidation = validateMappedVideoDetails(mapped.videos);
        if (!detailValidation.ok) {
          fail(
            "Mapped import requires complete duration metadata and embeddable videos.",
          );
        }
        const [existingVideoIds, teacherResult] = await Promise.all([
          fetchCatalogueVideoIds(db, { strict: true }),
          db.from("playlists").select("teacher"),
        ]);
        if (teacherResult.error) {
          fail(`reading teacher evidence roster: ${teacherResult.error.message}`);
        }
        const knownTeachers = [
          ...new Set(
            (teacherResult.data ?? []).map((row) => row.teacher).filter(Boolean),
          ),
        ];
        const quality = validatePlaylistQuality({
          playlist: { title: plan.playlist.title, videos: mapped.videos },
          existingVideoIds,
          expectedVideoCount: mapped.videos.length,
          knownTeachers: [plan.teacher, ...knownTeachers],
          reviewedTeacherEvidence: Boolean(mapped.teacherEvidence),
        });
        // Exact subject/chapter equality for reused videos is enforced inside
        // the atomic RPC. That resolves only the generic overlap warning; every
        // other mechanical finding remains a write blocker.
        const unresolvedFindings = mappedImportBlockingFindings(quality.findings);
        if (unresolvedFindings.length > 0) {
          fail(
            `Mapped import has ${unresolvedFindings.length} unresolved quality ` +
            "finding(s). Run the dry-run and resolve each one first.",
          );
        }
      }
    } else {
      const existingChapter = await findChapter(db, plan.chapterName, plan.subjectId);
      if (args.environment === "production" && !existingChapter) {
        fail(
          `Chapter "${plan.chapterName}" does not exist in production. ` +
          "Create and review reference data separately before importing.",
        );
      }
      chapterId = existingChapter?.id
        ?? await ensureChapter(db, plan.chapterName, plan.subjectId, summary);
    }

    // The whole playlist import is ONE transaction inside Postgres.
    importPayload ??= buildImportPayload({
      plan: importPlan, channel, channelId, chapterId, videos: importVideos,
    });
    const { data, error } = await db.rpc(rpc, {
      payload: importPayload,
    });
    if (error) fail(`import "${plan.playlist.title}": ${error.message}`);
    if (data.idempotent_replay) {
      say(
        `  verified replay: request ${data.request_id} already matches live ` +
        "catalogue state; no rows changed",
      );
      continue;
    }

    summary.added += data.videos_added;
    summary.reused += data.videos_reused;
    if (data.reused_playlist) summary.coursesReused += 1;
    else summary.courses += 1;
    say(
      `  ${data.reused_playlist ? "re-imported" : "imported"}: ${C.green}${data.videos_added} new${C.reset}, ${data.videos_reused} reused, ${data.lessons} lessons — ${plan.classLabels.join(", ")}`
    );
  }

  // --- done ---------------------------------------------------------
  say(`\n${C.green}${C.bold}✓ Import finished${C.reset}`);
  say(`  ${summary.added} videos added, ${summary.reused} reused`);
  say(`  ${summary.chapters} chapters created`);
  say(
    `  ${summary.courses} courses created` +
      (summary.coursesReused ? `, ${summary.coursesReused} reused` : "") + "\n"
  );
  process.exit(0);
}

// ---------------------------------------------------------------------
//  helpers
// ---------------------------------------------------------------------
function nameMap(rows) {
  const m = new Map();
  for (const r of rows ?? []) m.set(r.name.toLowerCase(), r);
  return m;
}

// Every YouTube video id already in the catalogue, for the cross-chapter reuse
// check. Paged in 1000s so a large catalogue is not silently truncated at
// PostgREST's default row cap. Read-only; failures degrade to an empty set
// (the overlap check simply reports nothing) rather than aborting a legacy dry
// run. Guarded mapped runs pass strict:true and fail closed instead.
async function fetchCatalogueVideoIds(db, { strict = false } = {}) {
  const ids = new Set();
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await db
      .from("videos")
      .select("youtube_video_id")
      .range(from, from + step - 1);
    if (error) {
      if (strict) throw error;
      break;
    }
    for (const r of data ?? []) ids.add(r.youtube_video_id);
    if (!data || data.length < step) break;
  }
  return ids;
}

// Accepts "all", "1,3,5", "1-4", or a mix.
function pickPlaylists(playlists, input) {
  const s = input.trim().toLowerCase();
  if (!s || s === "all") return [...playlists];
  const idx = new Set();
  for (const part of s.split(",")) {
    const range = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      for (let i = Number(range[1]); i <= Number(range[2]); i++) idx.add(i - 1);
    } else if (/^\d+$/.test(part.trim())) {
      idx.add(Number(part.trim()) - 1);
    }
  }
  return [...idx].sort((a, b) => a - b).map((i) => playlists[i]).filter(Boolean);
}

async function pickOne(ask, label, byName) {
  while (true) {
    const answer = (await ask(`${label}: `)).trim().toLowerCase();
    const hit = byName.get(answer);
    if (hit) return hit.id;
    console.log(
      `    ${C.yellow}Type one of: ${[...byName.values()].map((v) => v.name).join(", ")}${C.reset}`
    );
  }
}

function namedId(byName, label, value) {
  const hit = byName.get(value.trim().toLowerCase());
  if (!hit) fail(`Unknown ${label} "${value}".`);
  return hit.id;
}

// "11th, Dropper" -> ["11th","Dropper"]; validates against known labels.
function parseClasses(input) {
  const valid = { "10th": "10th", "11th": "11th", "12th": "12th", dropper: "Dropper" };
  return (input ?? "")
    .split(",")
    .map((s) => valid[s.trim().toLowerCase()])
    .filter(Boolean);
}

async function promptAttribution(ask, classLabels) {
  let teacher = "";
  while (!teacher) teacher = (await ask("  Teacher: ")).trim();
  let audienceFocus = "";
  while (!classLabels.includes(audienceFocus)) {
    audienceFocus = (await ask(
      `  Primary audience (${classLabels.join(" / ")}): `,
    )).trim();
  }
  return validateCourseAttribution({ teacher, audienceFocus, classLabels });
}

async function ensureChapter(db, name, subjectId, summary) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const existing = await findChapter(db, name, subjectId);
  if (existing) return existing.id;

  const { data, error } = await db
    .from("chapters")
    .insert({ name, slug, subject_id: subjectId })
    .select("id")
    .single();
  if (error) fail(`inserting chapter "${name}": ${error.message}`);
  summary.chapters += 1;
  return data.id;
}

async function findChapter(db, name, subjectId) {
  const { data, error } = await db
    .from("chapters")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function loadChapterManifest(inputPath) {
  const manifestPath = resolve(root, inputPath);
  if (!manifestPath.toLowerCase().endsWith(".json")) {
    throw new Error("Chapter manifest must be a .json file.");
  }
  try {
    const realRoot = realpathSync(root);
    const realManifestPath = realpathSync(manifestPath);
    const relativePath = relative(realRoot, realManifestPath);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error("Chapter manifests must be stored inside this repository.");
    }
    const raw = readFileSync(realManifestPath, "utf8");
    return {
      manifest: JSON.parse(raw),
      path: relativePath.replaceAll("\\", "/"),
      sha256: createHash("sha256").update(raw).digest("hex"),
    };
  } catch (error) {
    throw new Error(`Couldn't read chapter manifest "${inputPath}": ${error.message}`);
  }
}

function sourceSnapshotSha256(videos) {
  return createHash("sha256")
    .update(mappedSourceSnapshotEvidence(videos))
    .digest("hex");
}

async function readMappedImportCapability(db) {
  const { data, error } = await db.rpc("per_video_chapter_import_capability");
  const supported = !error && data?.version === 12 &&
    data?.per_video_chapter_id === true &&
    data?.all_or_none_mapping === true &&
    data?.create_only === true &&
    data?.request_replay === true &&
    data?.audit_snapshot === true;
  return {
    supported,
    version: supported ? data.version : null,
    error: supported ? null : (error?.message ?? "Capability contract mismatch."),
  };
}

async function assertMappedImportCapability(db) {
  const capability = await readMappedImportCapability(db);
  if (!capability.supported) {
    fail(
      "The selected database does not support guarded per-video chapter imports. " +
      "Apply and verify the v12 staging migration first.",
    );
  }
  return capability;
}

main().catch((err) => fail(err.message ?? String(err)));
