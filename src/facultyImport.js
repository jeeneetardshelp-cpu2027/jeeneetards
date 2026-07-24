// facultyImport.js — the browser-side half of the faculty write contract.
//
// The three states must remain distinct:
//   replace=false             -> omit teacher_ids; preserve existing links
//   replace=true, ids=[]      -> include []; clear links deliberately
//   replace=true, ids=[a,b]   -> replace with exactly [a,b], in that order
//
// These helpers are pure so a refactor cannot collapse "omitted" into "[]".

export function selectedTeacherIds(selected = []) {
  const ids = selected.map((row) => Number(row?.teacher_id));
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0))
    throw new Error("Every selected faculty record needs a valid id.");
  if (new Set(ids).size !== ids.length)
    throw new Error("The same faculty member was selected twice.");
  return ids;
}

export function withFacultySelection(payload, {
  capability = false, replace = false, selected = [],
} = {}) {
  if (!replace) return { ...payload };
  if (!capability)
    throw new Error("Faculty import support is not installed on this database.");
  return { ...payload, teacher_ids: selectedTeacherIds(selected) };
}

export function withSourceTitle(payload, sourceTitle, capability = false) {
  if (!capability) return { ...payload };
  const title = String(sourceTitle ?? "").trim();
  if (!title) throw new Error("The original YouTube playlist title is required.");
  if (title.length > 500) throw new Error("The original YouTube playlist title is too long.");
  return { ...payload, source_title: title };
}

export function playlistImportRpc(payload) {
  return Object.prototype.hasOwnProperty.call(payload, "teacher_ids")
    ? "import_playlist_with_teachers"
    : Object.prototype.hasOwnProperty.call(payload, "source_title")
      ? "import_playlist_with_quality"
      : "import_playlist";
}

export function courseImportRpc(payload) {
  return Object.prototype.hasOwnProperty.call(payload, "teacher_ids")
    ? "create_course_with_teachers"
    : "create_course";
}
