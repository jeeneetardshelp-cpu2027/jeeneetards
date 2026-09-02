// FacultyProfile.jsx — /faculty/:slug
//
// One RPC (get_faculty_profile) returns the teacher, their aliases and their
// courses. Aliases are shown because they are how students actually refer to
// faculty — seeing "also known as ABJ Sir" is what confirms you found the right
// person.

import { useEffect } from "react";
import { Link, useParams } from "react-router";
import { BadgeCheck, ExternalLink, Star } from "lucide-react";
import { useFacultyProfile } from "./useFaculty.js";
import { GlobalHeader, Container, MAIN_CONTENT_ID } from "./AppShell.jsx";
import { ratingDisplay } from "./ratingConfidence.js";
// A teacher's name, their aliases and their course titles are catalogue text,
// and some of it is written in Devanagari under a document that declares
// lang="en". See lang.js.
import { hasDevanagari, langAttrs } from "./lang.js";
// Course links here carry the title as keywords (/course/9/complete-kinematics)
// through the one function that decides that shape. A Devanagari course title
// has no ASCII to slugify, so it keeps the bare id — which is its canonical
// address, not a fallback.
import { canonicalCoursePath } from "./canonicalUrl.js";
import { useTheme } from "./theme.jsx";
import { applyPageMetadata, useStructuredData } from "./PageMetadata.jsx";
import { breadcrumbListSchema, personSchema } from "./structuredData.js";
import { getFacultyGuide } from "./facultyGuides.js";

export default function FacultyProfile() {
  const { slug } = useParams();
  const { profile, loading, error } = useFacultyProfile(slug);
  const { t, dark } = useTheme();
  const guide = getFacultyGuide(profile?.slug ?? slug);
  const verifiedAliases = (profile?.aliases ?? [])
    .map((item) => typeof item === "string" ? { alias: item, status: "verified" } : item)
    .filter((item) => item?.status === "verified")
    .map((item) => item.alias)
    .filter((alias) => alias && alias !== profile?.display_name);
  const aliasLine = verifiedAliases.join(", ");

  // Breadcrumb instead of a bare Back link: it says WHERE you are, and every
  // crumb is a real destination rather than a guess about history.
  const crumbs = [
    { label: "Faculty", to: "/faculty" },
    { label: profile?.display_name ?? "Faculty" },
  ];
  const schemaUrl = `/faculty/${profile?.slug ?? slug}`;
  const structuredDescription = guide?.summary || profile?.bio || (profile
    ? `Browse verified aliases and free courses taught by ${profile.display_name}.`
    : null);
  const metaDescription = guide?.metaDescription || structuredDescription;

  useEffect(() => {
    if (!profile || !metaDescription) return;
    applyPageMetadata({
      title: `${profile.display_name} faculty profile | JEENEETARD`,
      description: metaDescription,
      canonicalPath: schemaUrl,
      type: "profile",
    });
  }, [profile, metaDescription, schemaUrl]);

  useStructuredData(profile ? [
    personSchema({
      name: profile.display_name,
      url: schemaUrl,
      description: structuredDescription,
      image: profile.photo_url,
      aliases: verifiedAliases,
      institutes: profile.institutes,
      sameAs: guide?.sameAs,
    }),
    breadcrumbListSchema([
      { label: "Home", url: "/" },
      { label: "Faculty", url: "/faculty" },
      { label: profile.display_name, url: schemaUrl },
    ]),
  ] : [], [
    profile?.id,
    profile?.display_name,
    profile?.slug,
    profile?.bio,
    profile?.photo_url,
    structuredDescription,
    verifiedAliases.join("|"),
    (profile?.institutes ?? []).join("|"),
    (guide?.sameAs ?? []).join("|"),
  ]);

  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      {/* The site header, not a local one. This page used to render its own
          header element carrying only a Back link, so arriving here from search
          dropped the student out of the app navigation entirely — no Home, no
          Browse, no breadcrumb. Student-facing routes all share GlobalHeader;
          only the admin shell is allowed its own. */}
      <GlobalHeader crumbs={crumbs} />

      <main id={MAIN_CONTENT_ID} className="py-8">
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
                  {/* The "Verified" badge shares this heading, so the name gets
                      its own element rather than the whole h1 being tagged —
                      and only when the name actually needs one. */}
                  {hasDevanagari(profile.display_name)
                    ? <span lang="hi">{profile.display_name}</span>
                    : profile.display_name}
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
                    {/* "Also known as" is interface English; the aliases are
                        names. Same split, same guard. */}
                    Also known as{" "}
                    {hasDevanagari(aliasLine)
                      ? <span lang="hi">{aliasLine}</span>
                      : aliasLine}
                  </p>
                )}
              </div>
            </div>

            {guide ? (
              <section
                id="source-backed-profile"
                className={`mt-6 rounded-xl border ${t.border} ${t.card} p-5`}
              >
                <h2 className={`text-sm font-semibold ${t.text}`}>Source-backed profile</h2>
                <p className={`mt-2 text-sm leading-relaxed ${t.faint}`}>{guide.summary}</p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                  {guide.facts.map((fact) => (
                    <div key={fact.label}>
                      <dt className={`text-xs ${t.muted}`}>{fact.label}</dt>
                      <dd className={`mt-0.5 text-sm font-medium ${t.text}`}>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
                <h3 className={`mt-5 text-xs font-semibold ${t.text}`}>Primary sources</h3>
                <ul className="mt-2 space-y-1.5">
                  {guide.sources.map((source) => (
                    <li key={source.href}>
                      <a
                        href={source.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
                        style={{ color: dark ? "#5EEAD4" : "#0F6F78" }}
                      >
                        {source.label}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
                <p className={`mt-3 text-xs ${t.muted}`}>Sources checked {guide.sourceChecked}.</p>
              </section>
            ) : profile.bio ? (
              <p className={`mt-6 text-sm leading-relaxed ${t.faint}`}>{profile.bio}</p>
            ) : null}

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
                      to={canonicalCoursePath(c.playlist_id, c.title)}
                      className={`flex min-h-14 items-center justify-between gap-4 rounded-xl border ${t.border} ${t.card} ${t.cardHover} px-4 py-3 transition`}
                    >
                      <div>
                        <p {...langAttrs(c.title)} className={`text-sm font-medium ${t.text}`}>{c.title}</p>
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
