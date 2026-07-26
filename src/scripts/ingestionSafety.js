const METADATA_OPTIONS = {
  contentType: ["full-course", "one-shot", "revision", "pyq", "practice"],
  language: ["hindi", "english", "hinglish"],
  difficulty: ["beginner", "intermediate", "advanced"],
};

async function promptOption(ask, label, options, onInvalid) {
  while (true) {
    const answer = (await ask(`  ${label} (${options.join(" / ")}): `)).trim().toLowerCase();
    if (options.includes(answer)) return answer;
    onInvalid?.(label, options);
  }
}

export async function promptCourseMetadata(ask, onInvalid) {
  return {
    contentType: await promptOption(
      ask, "Content type", METADATA_OPTIONS.contentType, onInvalid,
    ),
    language: await promptOption(
      ask, "Language", METADATA_OPTIONS.language, onInvalid,
    ),
    difficulty: await promptOption(
      ask, "Difficulty", METADATA_OPTIONS.difficulty, onInvalid,
    ),
  };
}

export function validateCourseMetadata(metadata) {
  for (const [key, options] of Object.entries(METADATA_OPTIONS)) {
    if (!options.includes(metadata[key])) {
      throw new Error(`${key} must be one of: ${options.join(", ")}.`);
    }
  }
  return metadata;
}

export function validateCourseAttribution({ teacher, audienceFocus, classLabels }) {
  if (!teacher?.trim()) throw new Error("teacher is required.");
  if (!classLabels.includes(audienceFocus)) {
    throw new Error("audienceFocus must be one of the applicable classes.");
  }
  return { teacher: teacher.trim(), audienceFocus };
}

export function findDuplicateVideoIds(videos = []) {
  const seen = new Set();
  const duplicates = new Set();
  for (const video of videos) {
    const videoId = String(video?.videoId ?? "").trim();
    if (!videoId) continue;
    if (seen.has(videoId)) duplicates.add(videoId);
    else seen.add(videoId);
  }
  return [...duplicates];
}

export function validateMappedVideoDetails(videos = []) {
  const missingDurationVideoIds = [];
  const nonEmbeddableVideoIds = [];
  for (const video of videos) {
    const duration = Number(video.durationSeconds);
    if (!Number.isFinite(duration) || duration <= 0) {
      missingDurationVideoIds.push(video.videoId);
    }
    if (!["allowed", "embeddable"].includes(video.embeddingStatus)) {
      nonEmbeddableVideoIds.push(video.videoId);
    }
  }
  return {
    ok: missingDurationVideoIds.length === 0 && nonEmbeddableVideoIds.length === 0,
    missingDurationVideoIds,
    nonEmbeddableVideoIds,
  };
}

export function validateMappedSourcePositions(videos = []) {
  const positions = [];
  const seen = new Set();
  let previous = -1;
  for (const video of videos) {
    const position = video?.sourcePosition;
    if (!Number.isSafeInteger(position) || position < 0) {
      throw new Error(
        `Mapped source video ${video?.videoId ?? "(unknown)"} has no valid YouTube position.`,
      );
    }
    if (seen.has(position) || position <= previous) {
      throw new Error(
        "Mapped source positions must be unique and strictly increasing.",
      );
    }
    seen.add(position);
    previous = position;
    positions.push(position + 1);
  }
  return positions;
}

export function mappedSourceSnapshotEvidence(videos = []) {
  const positions = validateMappedSourcePositions(videos);
  return `${videos
    .map((video, index) => `${positions[index]}\t${video.videoId}`)
    .join("\n")}\n`;
}

export function validateChapterManifest({ manifest, playlistId, videos }) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Chapter manifest must be a JSON object.");
  }
  if (manifest.version !== 1) {
    throw new Error("Chapter manifest version must be 1.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(manifest.request_id ?? "")) {
    throw new Error("Chapter manifest request_id must be a UUID.");
  }
  if (manifest.youtube_playlist_id !== playlistId) {
    throw new Error("Chapter manifest playlist ID does not match the selected playlist.");
  }
  if (!Array.isArray(manifest.assignments)) {
    throw new Error("Chapter manifest assignments must be an array.");
  }
  if (manifest.assignments.length !== videos.length) {
    throw new Error(
      `Chapter manifest must map all ${videos.length} source videos exactly once.`,
    );
  }

  const seenIds = new Set();
  const chapters = new Set();
  const sourcePositions = validateMappedSourcePositions(videos);
  const mapped = videos.map((video, index) => {
    const assignment = manifest.assignments[index];
    const expectedPosition = sourcePositions[index];
    if (!assignment || assignment.position !== expectedPosition) {
      throw new Error(
        `Chapter manifest position ${expectedPosition} is missing or out of order.`,
      );
    }
    if (assignment.youtube_video_id !== video.videoId) {
      throw new Error(
        `Chapter manifest video at position ${expectedPosition} does not match the source.`,
      );
    }
    if (seenIds.has(assignment.youtube_video_id)) {
      throw new Error(
        `Chapter manifest repeats video ${assignment.youtube_video_id}.`,
      );
    }
    const chapterName = String(assignment.chapter ?? "").trim();
    if (!chapterName) {
      throw new Error(
        `Chapter manifest position ${expectedPosition} has no chapter.`,
      );
    }
    seenIds.add(assignment.youtube_video_id);
    chapters.add(chapterName);
    return { ...video, chapterName };
  });

  if (chapters.size < 2) {
    throw new Error(
      "A chapter manifest must map the source to at least two chapters; use --chapter for a single chapter.",
    );
  }
  return {
    videos: mapped,
    chapterNames: [...chapters],
    requestId: manifest.request_id,
  };
}

export function buildImportPayload({
  plan,
  channel,
  channelId,
  chapterId,
  videos,
}) {
  const mappedCount = videos.filter(
    (video) => Number.isSafeInteger(video.chapterId) && video.chapterId > 0,
  ).length;
  if (mappedCount > 0 && mappedCount !== videos.length) {
    throw new Error("Every video must have a chapterId when chapter mapping is used.");
  }
  if (mappedCount > 0 && chapterId != null) {
    throw new Error("Use either a playlist chapterId or per-video chapterIds, not both.");
  }
  const payload = {
    channel: { name: channel.title, youtube_channel_id: channelId },
    category_id: plan.categoryId,
    learning_goal_id: plan.learningGoalId,
    board_ids: plan.boardIds ?? [],
    subject_id: plan.subjectId,
    chapter_id: chapterId,
    class_labels: plan.classLabels,
    youtube_playlist_id: plan.playlist.id,
    title: plan.playlist.title,
    teacher: plan.teacher,
    content_type: plan.contentType,
    language: plan.language,
    difficulty: plan.difficulty,
    audience_focus: plan.audienceFocus,
    videos: videos.map((video) => {
      const row = {
        youtube_video_id: video.videoId,
        title: video.title,
        duration_seconds: video.durationSeconds ?? null,
        caption_status: video.captionStatus ?? null,
        embedding_status: video.embeddingStatus ?? null,
      };
      if (mappedCount > 0) row.chapter_id = video.chapterId;
      return row;
    }),
  };
  if (mappedCount > 0) {
    if (!plan.requestId) {
      throw new Error("Mapped imports require a durable requestId.");
    }
    if (!/^[0-9a-f]{64}$/.test(plan.manifestSha256 ?? "") ||
        !/^[0-9a-f]{64}$/.test(plan.sourceSnapshotSha256 ?? "")) {
      throw new Error("Mapped imports require manifest and source SHA-256 evidence.");
    }
    payload.request_id = plan.requestId;
    payload.manifest_sha256 = plan.manifestSha256;
    payload.source_snapshot_sha256 = plan.sourceSnapshotSha256;
    payload.manifest_assignment_count = videos.length;
  }
  return payload;
}

export function parseBulkConfirmation(argv) {
  if (!argv.includes("--confirm")) {
    throw new Error("Refusing bulk update without --confirm.");
  }
  const countArg = argv.find((arg) => arg.startsWith("--expected-count="));
  if (!countArg) {
    throw new Error("Refusing bulk update without --expected-count=<positive integer>.");
  }
  const expected = Number(countArg.slice("--expected-count=".length));
  if (!Number.isSafeInteger(expected) || expected <= 0) {
    throw new Error("--expected-count must be a positive integer.");
  }
  return expected;
}

export function assertExpectedRowCount(expected, actual) {
  if (actual !== expected) {
    throw new Error(`Bulk update stopped: expected ${expected} rows but found ${actual}.`);
  }
}

function positiveIntegerArg(argv, name, { max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = argv.find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
  if (!raw) throw new Error(`--${name}=<positive integer> is required.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0 || value > max) {
    throw new Error(`--${name} must be a positive integer no greater than ${max}.`);
  }
  return value;
}

export function assertImportSelection({ selected, expected, max }) {
  if (selected > max) {
    throw new Error(`Import stopped: selected ${selected} playlists; batch cap is ${max}.`);
  }
  if (selected !== expected) {
    throw new Error(`Import stopped: expected ${expected} playlists but mapped ${selected}.`);
  }
}

export function playlistFromOwner(owner, expectedChannelId) {
  if (owner.channelId !== expectedChannelId) {
    throw new Error(
      `Playlist ${owner.playlistId} does not belong to channel ${expectedChannelId}.`,
    );
  }
  return {
    id: owner.playlistId,
    title: owner.playlistTitle,
    videoCount: owner.videoCount,
  };
}

export function assertProductionWriteAllowed({
  environment,
  dryRun,
  confirmProduction,
}) {
  if (environment === "production" && !dryRun && !confirmProduction) {
    throw new Error(
      "Production import requires --confirm-production. Use --env=staging for staging.",
    );
  }
}

export function parseImporterArgs(argv) {
  const environmentArg = argv.find((arg) => arg.startsWith("--env="));
  const environment = environmentArg?.slice("--env=".length) || "staging";
  if (!["production", "staging"].includes(environment)) {
    throw new Error("--env must be production or staging.");
  }
  const expectedPlaylists = positiveIntegerArg(argv, "expected-playlists");
  const maxPlaylists = positiveIntegerArg(argv, "max-playlists", { max: 25 });
  if (expectedPlaylists > maxPlaylists) {
    throw new Error("--expected-playlists cannot exceed --max-playlists.");
  }
  const value = (name) => argv.find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? null;
  const mapping = {
    playlistId: value("playlist-id"),
    category: value("category"),
    goal: value("goal"),
    board: value("board"),
    subject: value("subject"),
    chapter: value("chapter"),
    classes: value("classes"),
    contentType: value("content-type"),
    language: value("language"),
    difficulty: value("difficulty"),
    teacher: value("teacher"),
    audienceFocus: value("audience-focus"),
    chapterManifest: value("chapter-manifest"),
  };
  const nonInteractive = Object.values(mapping).some(Boolean);
  if (nonInteractive) {
    if (mapping.chapter && mapping.chapterManifest) {
      throw new Error("Use either --chapter or --chapter-manifest, not both.");
    }
    const required = [
      "playlistId", "category", "goal", "subject", "classes",
      "contentType", "language", "difficulty",
      "teacher", "audienceFocus",
    ];
    if (!mapping.chapter && !mapping.chapterManifest) {
      required.push("chapter or chapterManifest");
    }
    const missing = required.filter((key) => !mapping[key]);
    if (missing.length) {
      throw new Error(`Non-interactive import is missing: ${missing.join(", ")}.`);
    }
    validateCourseMetadata(mapping);
    validateCourseAttribution({
      teacher: mapping.teacher,
      audienceFocus: mapping.audienceFocus,
      classLabels: mapping.classes.split(",").map((value) => value.trim()),
    });
  }
  return {
    environment,
    dryRun: argv.includes("--dry-run"),
    confirmProduction: argv.includes("--confirm-production"),
    expectedPlaylists,
    maxPlaylists,
    channelId: argv.find((arg) => !arg.startsWith("--")) ?? null,
    nonInteractive,
    ...mapping,
  };
}
