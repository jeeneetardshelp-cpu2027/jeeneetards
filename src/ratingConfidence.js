// One rating-confidence rule for every student-facing surface.
//
// A raw average based on one or two votes looks precise but is not reliable
// enough to compare courses. Until the minimum is reached we show only the
// number of student ratings; zero ratings remains "Not yet rated" in the UI.

export const RATING_CONFIDENCE_MIN = 5;

export function ratingDisplay(rating, count) {
  const ratingCount = Number(count);
  if (!Number.isFinite(ratingCount) || ratingCount <= 0) return null;

  const countText = `${ratingCount} student rating${ratingCount === 1 ? "" : "s"}`;
  const score = rating == null ? NaN : Number(rating);
  if (ratingCount < RATING_CONFIDENCE_MIN || !Number.isFinite(score)) {
    return { kind: "low", count: ratingCount, text: countText };
  }

  return { kind: "scored", count: ratingCount, score };
}
