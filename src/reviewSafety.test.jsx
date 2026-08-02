// Safety guarantees for the one place students publish text to other students.
//
// Guards for the reviews items in the 31 July audit (docs/audit_2026-07-31.md
// section 3.1). Reviews are the only student-written content shown publicly to
// other minors, and before this they had: no notice that they were public, no
// length limit anywhere, and raw Postgres error text surfaced on failure.
//
// The database side (hidden reviews genuinely unreadable, anon cannot read
// user_id, server-owned timestamps) lives in
// docs/sql/reviews_hardening_2026-07-31.sql and is asserted by that file's own
// self-verification block, since RLS cannot be exercised from jsdom.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { reviewRows } = vi.hoisted(() => ({ reviewRows: { current: [] } }));

vi.mock("./useSession.js", () => ({
  useSession: () => ({ session: { user: { id: "student-1" } }, loading: false }),
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => {
      const b = {
        select() { return b; },
        eq() { return b; },
        not() { return b; },
        order() { return b; },
        limit() { return Promise.resolve({ data: reviewRows.current, error: null }); },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        upsert() { return Promise.resolve({ error: null }); },
      };
      return b;
    },
  },
}));

import CourseRating, { ratingErrorMessage } from "./CourseRating.jsx";
import { ThemeProvider } from "./theme.jsx";

const show = () => render(
  <ThemeProvider>
    <CourseRating playlistId={1} initialAverage={0} initialCount={0} />
  </ThemeProvider>,
);

describe("students are told a review is public, before they type it", () => {
  it("labels the review box as shown publicly", async () => {
    reviewRows.current = [];
    show();
    expect(await screen.findByText(/Review \(optional\) — shown publicly/)).toBeTruthy();
  });

  it("spells out who can read it and what not to include", async () => {
    reviewRows.current = [];
    show();
    const note = await screen.findByText(/Anyone can read this on the course page/);
    expect(note.textContent).toMatch(/name and email are never shown/i);
    expect(note.textContent).toMatch(/don't include your name, school, coaching batch/i);
    // The unpublish route existed but was undiscoverable.
    expect(note.textContent).toMatch(/clear this box and submit again/i);
  });

  it("caps review length in the form, matching the database constraint", async () => {
    reviewRows.current = [];
    show();
    const box = await screen.findByPlaceholderText("What worked, what didn't…");
    expect(box.maxLength).toBe(1000);
    expect(screen.getByText("0/1000")).toBeTruthy();
  });
});

describe("rating failures never show a student raw database text", () => {
  it("maps the real length-constraint violation", () => {
    expect(ratingErrorMessage({
      message: 'new row for relation "playlist_ratings" violates check constraint "plr_review_length"',
    })).toMatch(/under 1000 characters/i);
  });

  it("maps an expired session", () => {
    expect(ratingErrorMessage({ message: "JWT expired" })).toMatch(/session expired/i);
    expect(ratingErrorMessage({ message: "permission denied for table playlist_ratings" }))
      .toMatch(/session expired/i);
  });

  it("maps a rating-range violation", () => {
    expect(ratingErrorMessage({
      message: 'violates check constraint "plr_clarity_range"',
    })).toMatch(/1 to 5 stars/i);
  });

  it("maps a network failure", () => {
    expect(ratingErrorMessage({ message: "TypeError: Failed to fetch" }))
      .toMatch(/couldn't reach the server/i);
  });

  it("falls back to a safe message and never leaks the raw text", () => {
    const raw = 'duplicate key value violates unique constraint "playlist_ratings_pkey" DETAIL: Key (id)=(7)';
    const shown = ratingErrorMessage({ message: raw });
    expect(shown).not.toMatch(/constraint|DETAIL|pkey|relation/i);
    const unknown = ratingErrorMessage({ message: "PGRST301 something internal" });
    expect(unknown).toBe("Couldn't save your rating. Please try again.");
  });
});
