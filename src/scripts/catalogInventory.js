const text = (value) => typeof value === "string" ? value.trim() : "";

const relationRows = (value) => Array.isArray(value) ? value : [];

const relationValues = (rows, relation) => relationRows(rows)
  .map((row) => row?.[relation])
  .filter(Boolean);

const sortedUnique = (values) => [...new Set(values.filter(Boolean))].sort();

function countBy(values) {
  const counts = {};
  for (const value of values)
    counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function titleIssues(title) {
  const issues = [];
  if (!title) return issues;
  if (/^[a-z]/.test(title)) issues.push("title-capitalization");
  if (/\s{2,}/.test(title)) issues.push("title-spacing");
  return issues;
}

export function normalizeCatalogCourse(row) {
  const title = text(row.title);
  const teacher = text(row.teacher);
  const subject = text(row.subjects?.name);
  const institute = text(row.institutes_channels?.name);
  const goals = sortedUnique(
    relationValues(row.playlist_learning_goals, "learning_goals").map((goal) => text(goal.slug)),
  );
  const classLevels = sortedUnique(
    relationValues(row.playlist_class_levels, "class_levels").map((level) => text(level.slug)),
  );
  const missing = [];

  if (!title) missing.push("title");
  if (!text(row.youtube_playlist_id)) missing.push("source-playlist-id");
  if (!teacher) missing.push("teacher");
  if (!subject) missing.push("subject");
  if (!institute) missing.push("institute");
  if (!goals.length) missing.push("learning-goal");
  if (!classLevels.length) missing.push("class-level");
  if (!text(row.language)) missing.push("language");
  if (!text(row.content_type)) missing.push("content-type");
  if (!text(row.difficulty)) missing.push("difficulty");

  return {
    id: Number(row.id),
    youtubePlaylistId: text(row.youtube_playlist_id) || null,
    title: title || null,
    teacher: teacher || null,
    subject: subject || null,
    institute: institute || null,
    goals,
    classLevels,
    language: text(row.language) || null,
    contentType: text(row.content_type) || null,
    difficulty: text(row.difficulty) || null,
    lectures: Number(row.playlist_videos?.[0]?.count ?? 0),
    rating: Number(row.ratings_count ?? 0) > 0 ? Number(row.average_rating) : null,
    ratingCount: Number(row.ratings_count ?? 0),
    missing,
    issues: titleIssues(title),
  };
}

export function buildCatalogInventory(rows, generatedAt = new Date().toISOString()) {
  const courses = (rows ?? []).map(normalizeCatalogCourse);
  const titleGroups = new Map();

  for (const course of courses) {
    const key = course.title?.toLocaleLowerCase();
    if (!key) continue;
    titleGroups.set(key, [...(titleGroups.get(key) ?? []), course]);
  }
  for (const group of titleGroups.values()) {
    if (group.length < 2) continue;
    for (const course of group) course.issues.push("duplicate-title");
  }

  return {
    generatedAt,
    readOnly: true,
    summary: {
      totalCourses: courses.length,
      totalLectures: courses.reduce((sum, course) => sum + course.lectures, 0),
      coursesNeedingMetadata: courses.filter((course) => course.missing.length > 0).length,
      coursesNeedingTitleReview: courses.filter((course) => course.issues.length > 0).length,
      coursesWithoutTeacher: courses.filter((course) => !course.teacher).length,
      coursesWithoutRatings: courses.filter((course) => course.ratingCount === 0).length,
      classCoverage: countBy(courses.flatMap((course) => course.classLevels)),
      goalCoverage: countBy(courses.flatMap((course) => course.goals)),
      subjectCoverage: countBy(courses.map((course) => course.subject ?? "unclassified")),
    },
    courses,
  };
}
