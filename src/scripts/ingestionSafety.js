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

export function buildImportPayload({
  plan,
  channel,
  channelId,
  chapterId,
  videos,
}) {
  return {
    channel: { name: channel.title, youtube_channel_id: channelId },
    category_id: plan.categoryId,
    learning_goal_id: plan.learningGoalId,
    board_ids: plan.boardIds ?? [],
    subject_id: plan.subjectId,
    chapter_id: chapterId,
    class_labels: plan.classLabels,
    youtube_playlist_id: plan.playlist.id,
    title: plan.playlist.title,
    teacher: null,
    content_type: plan.contentType,
    language: plan.language,
    difficulty: plan.difficulty,
    videos: videos.map((video) => ({
      youtube_video_id: video.videoId,
      title: video.title,
      duration_seconds: video.durationSeconds ?? null,
      caption_status: video.captionStatus ?? null,
      embedding_status: video.embeddingStatus ?? null,
    })),
  };
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

export function parseImporterArgs(argv) {
  const environmentArg = argv.find((arg) => arg.startsWith("--env="));
  const environment = environmentArg?.slice("--env=".length) || "production";
  if (!["production", "staging"].includes(environment)) {
    throw new Error("--env must be production or staging.");
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
  };
  const nonInteractive = Object.values(mapping).some(Boolean);
  if (nonInteractive) {
    const required = [
      "playlistId", "category", "goal", "subject", "chapter", "classes",
      "contentType", "language", "difficulty",
    ];
    const missing = required.filter((key) => !mapping[key]);
    if (missing.length) {
      throw new Error(`Non-interactive import is missing: ${missing.join(", ")}.`);
    }
    validateCourseMetadata(mapping);
  }
  return {
    environment,
    confirmProduction: argv.includes("--confirm-production"),
    channelId: argv.find((arg) => !arg.startsWith("--")) ?? null,
    nonInteractive,
    ...mapping,
  };
}
