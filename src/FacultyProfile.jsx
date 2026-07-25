// FacultyProfile.jsx — /faculty/:slug
//
// One RPC (get_faculty_profile) returns the teacher, their aliases and their
// courses. Aliases are shown because they are how students actually refer to
// faculty — seeing "also known as ABJ Sir" is what confirms you found the right
// person.

import { Link, useParams } from "react-router";
import { BadgeCheck, Star } from "lucide-react";
import { useFacultyProfile } from "./useFaculty.js";
import { GlobalHeader, Container } from "./AppShell.jsx";
import { ratingDisplay } from "./ratingConfidence.js";
import { useTheme } from "./theme.jsx";

export default function FacultyProfile() {
  const { slug } = useParams();
  const { profile, loading, error } = useFacultyProfile(slug);
  const { t, dark } = useTheme();
  const verifiedAliases = (profile?.aliases ?? [])
    .map((item) => typeof item === "string" ? { alias: item, status: "verified" } : item)
    .filter((item) => item?.status === "verified")
    .map((item) => item.alias)
    .filter((alias) => alias && alias !== profile?.display_name);

  // Breadcrumb instead of a bare Back link: it says WHERE you are, and every
  // crumb is a real destination rather than a guess about history.
  const crumbs = [
    { label: "Browse courses", to: "/browse" },
    { label: profile?.display_name ?? "Faculty" },
  ];

  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      {/* The site header, not a local one. This page used to render its own
          header element carrying only a Back link, so arriving here from search
          dropped the student out of the app navigation entirely — no Home, no
          Browse, no breadcrumb. Student-facing routes all share GlobalHeader;
          only the admin shell is allowed its own. */}
      <GlobalHeader crumbs={crumbs} />

      <main className="py-8">
        <Container width="reading">
        {error ? (
          <p className={`text-sm ${t.muted}`}>{error}</p>
        ) : loading ? (
          <div className="space-y-3">
            <div className={`h-8 w-56 animate-pulse rounded ${t.input}`} />
            <div className={`h-4 w-40 animate-pulse rounded ${t.input}`} />
          </div>
        ) : !profile ? (
          <div className={`rounded-xl border border-dashed ${t.border} ${t.card} p-8 text-center`}>
            <p className={`text-sm font-semibold ${t.text}`}>No faculty page for “{slug}”.</p>
            <p className={`mt-1 text-sm ${t.muted}`}>
              The link may be out of date, or this teacher hasn't been added yet.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-4">
              {profile.photo_url ? (
                <img
                  src={profile.photo_url}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className={`flex h-16 w-16 items-center justify-center rounded-full ${t.input} text-xl font-semibold ${t.muted}`}>
                  {profile.display_name?.[0] ?? "?"}
                </div>
              )}
              <div>
                <h1 className={`flex items-center gap-2 text-2xl font-semibold ${t.text}`}>
                  {profile.display_name}
                  {profile.verified && (
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${dark ? "bg-emerald-950 text-emerald-300" : "bg-emerald-50 text-emerald-700"}`}>
                      <BadgeCheck className="h-3.5 w-3.5" /> Verified
                    </span>
                  )}
                </h1>
                <p className={`mt-1 text-sm ${t.muted}`}>
                  {profile.course_count} course{profile.course_count === 1 ? "" : "s"}
                </p>
                {verifiedAliases.length > 0 && (
                  <p className={`mt-1 text-xs ${t.muted}`}>
                    Also known as {verifiedAliases.join(", ")}
                  </p>
                )}
              </div>
            </div>

            {profile.bio && <p className={`mt-6 text-sm leading-relaxed ${t.faint}`}>{profile.bio}</p>}

            <h2 className={`mt-8 text-sm font-semibold ${t.text}`}>Courses</h2>
            {(profile.courses ?? []).length === 0 ? (
              <p className={`mt-2 text-sm ${t.muted}`}>No courses linked yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {profile.courses.map((c) => {
                  const rating = ratingDisplay(c.average_rating, c.ratings_count);
                  return (
                  <li key={c.playlist_id}>
                    <Link
                      to={`/course/${c.playlist_id}`}
                      className={`flex min-h-14 items-center justify-between gap-4 rounded-xl border ${t.border} ${t.card} ${t.cardHover} px-4 py-3 transition`}
                    >
                      <div>
                        <p className={`text-sm font-medium ${t.text}`}>{c.title}</p>
                        {(c.subject || (c.role && c.role !== "instructor")) && (
                          <p className={`text-xs ${t.muted}`}>
                            {c.subject ?? ""}
                            {c.subject && c.role && c.role !== "instructor" ? " · " : ""}
                            {c.role && c.role !== "instructor" ? c.role : ""}
                          </p>
                        )}
                      </div>
                      {rating?.kind === "scored" ? (
                        <span className={`flex items-center gap-1 text-xs ${t.faint}`}>
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {rating.score.toFixed(1)}
                          <span className={t.muted}>({rating.count})</span>
                        </span>
                      ) : rating?.kind === "low" ? (
                        <span className={`text-xs ${t.muted}`}>{rating.text}</span>
                      ) : (
                        <span className={`text-xs ${t.muted}`}>Not yet rated</span>
                      )}
                    </Link>
                  </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
        </Container>
      </main>
    </div>
  );
}
