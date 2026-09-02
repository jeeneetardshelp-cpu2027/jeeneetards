// courseCredit.js — who to credit for a course, without saying it twice.
//
// A course carries a free-text `teacher` and a linked `institutes_channels`
// row. For 132 of 484 courses (production, 2026-09-02) they are the same
// string, because the importer filled `teacher` with the YouTube channel's
// name. Every surface that shows both then says it twice:
//
//   card / watch page   "C  Competishun+ · Competishun+"   (two avatars, too)
//   meta description    "2 Chemistry lectures by Competishun+ from Competishun+."
//   crawler body        Teacher: Competishun+ / Channel: Competishun+
//
// Two shapes sit behind that one bug, and the fix is the same for both:
//
//   93  the channel is an institute   — Competishun+ 76, Magnet Brains 10,
//                                       NEEV Competishun 4, and two others.
//                                       Crediting it as a "teacher" is also
//                                       wrong: it is not a person.
//   39  the channel is a person       — Mohit Tyagi 32, Digraj Singh Rajput 5,
//                                       Shobhit Nirwan 1, Vinay Uppal 1. The
//                                       data is right, just said twice.
//
// The DUPLICATE TEACHER is dropped and the institute kept, not the other way
// round: the institute is the linked entity — it has an id, a logo and a
// /browse?channel= destination — so keeping it preserves the link, and
// "from Competishun+" reads correctly where "by Competishun+" would imply a
// person. This is presentation only. `playlists.teacher` is untouched, and
// 131 of the 132 rows carry faculty_credit_status 'pending' for whoever
// reviews the credits properly later.

const normalise = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The teacher and institute to display for one course.
 *
 * Only an EXACT match (after trimming, lowercasing and collapsing whitespace)
 * counts as a duplicate. Names where one merely contains the other are left
 * alone — "Alakh Pandey" beside "Alakh Pandey - Class 9th & 10th", or
 * "Chaitanya Rastogi" beside "DexterChem - Chemistry by Chaitanya Rastogi",
 * carry information the other does not, and 25 courses look like that.
 * Collapsing them would delete a real name, which is worse than repeating one.
 *
 * @returns {{ teacher: string|null, institute: string|null, duplicated: boolean }}
 */
export function courseCredit({ teacher, institute } = {}) {
  const teacherText = typeof teacher === "string" && teacher.trim() ? teacher : null;
  const instituteText = typeof institute === "string" && institute.trim() ? institute : null;
  const duplicated = Boolean(
    teacherText && instituteText && normalise(teacherText) === normalise(instituteText),
  );
  return {
    teacher: duplicated ? null : teacherText,
    institute: instituteText,
    duplicated,
  };
}
