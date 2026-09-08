// useCanonicalFilters.js — turn the canonical URL into database ids.
//
//     /browse?goal=jee&class=11&subject=physics&chapter=kinematics
//
// The guided journey emits slugs; older links carry ids. Both must select the
// SAME results, so this hook accepts either and returns ids. Anything already
// numeric is passed straight through and costs no query.
//
// THIS HOOK GATES THE CATALOGUE QUERY.
//
// `ready` is false until every slug in the URL has become an id. Until then no
// catalogue request may be issued. Firing one early does not merely waste a
// round trip — the early request carries NO chapter predicate, so it returns
// the whole catalogue, and for a moment the student sees every course in the
// library under a heading that says "Kinematics". Silently widening an
// unresolved filter is a correctness defect, not a performance one.
//
// `unresolved` names slugs that resolved to nothing. Those are neither an
// error nor a reason to query broadly: the URL asked for something specific
// that does not exist, so the UI must say so and offer to remove it.
//
// ---------------------------------------------------------------------------
// ONE WAVE, NOT THREE.
//
// 204 of the 205 /browse URLs in public/sitemap.xml carry a chapter=, so the
// chapter link is the arrival path Google hands students, not an edge case.
// This resolver used to spend three DEPENDENT round trips on it: goal+subject,
// then the chapter (narrowed by the subject ID it had just learned), then the
// chapter's class levels (narrowed by the chapter ID it had just learned).
// Measured against production on 7 Sep 2026 for the real arrival shape
// /browse?goal=jee&class=11&subject=physics&chapter=kinematics — the wall clock
// from the first request to the moment the catalogue could be asked:
//
//                      round trips  requests  warmed median
//     before                     3         4         756 ms
//     after                      1         3         281 ms
//
// So about 475 ms at the median, on top of whatever the catalogue query itself
// then costs. The request COUNT barely moves (4 -> 3); what changes is that
// none of them wait for each other.
//
// Those figures are the SECOND measurement, and they replace a first pass that
// read 1237 -> 521 ms. That run was taken while other work was loading the same
// database and both of its columns came out roughly 1.5x high; the wave and
// request counts were right, the milliseconds were not. The numbers above were
// reproduced two independent ways — replaying both builder shapes straight at
// production through supabase-js (662 -> 235 ms median, 12 interleaved warm
// runs), and timing two real production builds end to end from first request to
// catalogue query (756 -> 281 ms, 4 runs each). Prefer them.
//
// THE HONEST FRACTION, because "twice as fast" would be the easy thing to say
// and is not true: roughly 1500 + 756 + 360 = 2.6 s before, 1500 + 281 + 340 =
// 2.1 s after. About 18% off the wait, and the catalogue query itself is
// unchanged at ~350 ms.
//
// Cold-cache runs are far noisier (one before-run reached 2816 ms) and are left
// out deliberately: they measure the database's cache state, not this change.
//
// The subject dependency was real — Chemistry and Physics both have a
// "thermodynamics" chapter, and an unscoped lookup sees two rows — but the
// DISAMBIGUATOR did not have to be the subject ID. The subject SLUG is already
// in the URL, and PostgREST can filter on it through an inner embed, so the
// chapter needs nothing from wave 1 and joins it:
//
//     chapters?select=id,slug,name,subjects!inner(slug),<scope embed>
//             &slug=eq.thermodynamics&subjects.slug=eq.physics
//
// Measured: physics -> id 23, chemistry -> id 36. Same disambiguation, no
// prerequisite. The class levels ride along on the same row, collapsing wave 3
// too — see resolveChapter below for the one hazard that creates (embedding an
// OPTIONAL table makes the whole query fail where the table is absent) and how
// it is contained.
//
// The honest limit: the page still does not send its FIRST request until
// roughly 1.5 s in, because the bundle has to download and start on a cheap
// Android. That is a bigger number than the one fixed here, and this change
// does not touch it.

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { parseCanonical } from "./canonicalUrl.js";

const EMPTY = {
  goalId: null, subjectId: null, chapterId: null, boardId: null,
  chapterClassSlugs: null, names: {},
};

// The v13 chapter-scope junction is OPTIONAL: older databases do not have it,
// and the page must still work there. Remembered for the session so a database
// without it pays the discovery cost once rather than on every navigation.
let chapterScopeTableAvailable;

// Both shapes of "that table is not there" name the table in the message, and
// that is what this matches on — NOT the bare error code.
//
//   standalone   404 PGRST205  "Could not find the table
//                               'public.chapter_class_levels' in the schema cache"
//   embedded     400 PGRST200  "Could not find a relationship between 'chapters'
//                               and 'chapter_class_levels' in the schema cache"
//
// PGRST200 is deliberately NOT in the code list. It is the generic "no such
// relationship" code, so trusting it alone would let a broken subjects!inner
// embed be read as "the scope table is missing" — and the response to that is
// to retry WITHOUT the subject constraint, which is exactly the silent
// broadening this file exists to prevent. Requiring the table's own name in
// the message keeps the fallback pointed at the one thing it is for.
const isMissingChapterScopeTable = (error) =>
  ["42P01", "PGRST205"].includes(error?.code) ||
  /chapter_class_levels[\s\S]*?(?:not find|does not exist|schema cache)/i.test(
    `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`,
  );

// A LEFT join, never `!inner`. Measured: `chapter_class_levels(...)` returns
// `[]` for a chapter nobody has reviewed yet, while `chapter_class_levels!inner`
// drops that chapter from the result entirely — which would turn "this chapter
// has no reviewed class scope" into "this chapter does not exist".
const CHAPTER_SCOPE_EMBED = "chapter_class_levels(class_levels(slug))";

const chapterScopeSlugs = (rows) =>
  [...new Set((rows ?? []).map((row) => row.class_levels?.slug).filter(Boolean))];

// Wave 3 standalone. Still needed for the legacy id URL (/browse?ch=7), where
// there is no chapter slug to hang the embed on, and as the fallback when the
// embedded form reports the junction missing.
async function resolveChapterClassSlugs(chapterId) {
  if (chapterId == null || chapterScopeTableAvailable === false) return null;
  const { data, error } = await supabase
    .from("chapter_class_levels")
    .select("class_levels!inner(slug)")
    .eq("chapter_id", chapterId);
  if (error) {
    if (isMissingChapterScopeTable(error)) {
      chapterScopeTableAvailable = false;
      return null;
    }
    throw error;
  }
  chapterScopeTableAvailable = true;
  return chapterScopeSlugs(data);
}

/**
 * One request that resolves the chapter slug AND its reviewed class levels.
 *
 * `scope` is read straight from the URL, so this query has no prerequisite and
 * can be fired in the same wave as the goal and subject lookups:
 *
 *   subjectSlug   /browse?subject=physics&chapter=thermodynamics
 *                 -> subjects!inner(slug) + subjects.slug=eq.physics
 *   subjectId     /browse?sub=1&chapter=thermodynamics  (legacy id link)
 *                 -> subject_id=eq.1
 *   neither       /browse?chapter=thermodynamics
 *                 -> unscoped, and so possibly ambiguous; see below.
 *
 * `limit(2)` rather than `maybeSingle()`: two chapters really can share a slug
 * across subjects, and maybeSingle() turns that into a database ERROR — which
 * the caller would have to report as "Couldn't load this selection", offering
 * a Retry that can never succeed. Two rows is not a failure, it is an answer,
 * and the caller can act on it.
 */
function queryChapter(need, { subjectSlug, subjectId }) {
  const withScope = chapterScopeTableAvailable !== false;
  const columns = [
    "id, slug, name",
    subjectSlug ? "subjects!inner(slug)" : null,
    withScope ? CHAPTER_SCOPE_EMBED : null,
  ].filter(Boolean).join(", ");

  let query = supabase.from("chapters").select(columns).eq("slug", need.slug);
  // Chapter slugs are only unique inside a subject. The canonical URL already
  // carries the subject, so preserve that scope while resolving the chapter
  // rather than letting the lookup range over every subject.
  if (subjectSlug) query = query.eq("subjects.slug", subjectSlug);
  else if (subjectId != null) query = query.eq("subject_id", subjectId);
  return query.limit(2).then((res) => ({ ...res, withScope }));
}

/**
 * Resolve the chapter, returning the same row shape the other lookups use plus
 * `classSlugs` and `ambiguous`.
 *
 * HAZARD 1, the reason this is not simply one query: embedding an OPTIONAL
 * table makes the whole request fail when that table is absent, so a naive
 * embed would convert today's graceful degradation ("no reviewed class scope,
 * carry on") into a hard failure of chapter resolution itself — a slow page
 * traded for a broken one. So the embed is kept, and the missing-junction
 * error signature is caught and RETRIED without it. The degraded database
 * pays two round trips once, then `chapterScopeTableAvailable` is false and
 * every later navigation goes straight to the unembedded single wave. It is
 * never worse than the three-wave version it replaces.
 */
async function resolveChapter(need, scope) {
  let res = await queryChapter(need, scope);
  if (res.error && res.withScope && isMissingChapterScopeTable(res.error)) {
    chapterScopeTableAvailable = false;
    res = await queryChapter(need, scope);
  }

  const blank = { ...need, id: null, name: null, classSlugs: null, ambiguous: false };
  if (res.error) return { ...blank, error: res.error };
  // The query answering at all proves the relationship resolves.
  if (res.withScope) chapterScopeTableAvailable = true;

  const rows = res.data ?? [];
  // More than one row means the URL named a chapter that exists twice and gave
  // us no way to choose. Picking either would show a student Chemistry courses
  // under a Physics heading, so this stays unresolved and the UI says why.
  if (rows.length > 1) return { ...blank, error: null, ambiguous: true };

  const row = rows[0] ?? null;
  return {
    ...blank,
    error: null,
    id: row?.id ?? null,
    name: row?.name ?? null,
    classSlugs: row && res.withScope ? chapterScopeSlugs(row.chapter_class_levels) : null,
  };
}

export function useCanonicalFilters(params) {
  const parsed = parseCanonical(params);
  const canonicalKey = JSON.stringify(parsed);

  const [state, setState] = useState({
    ...EMPTY, stage: parsed.stage, board: parsed.board,
    loading: false, error: null, ready: false, unresolved: [],
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    const c = JSON.parse(canonicalKey);
    const need = [
      c.goal.slug    && { table: "learning_goals", slug: c.goal.slug,    as: "goalId",    key: "goal" },
      c.subject.slug && { table: "subjects",       slug: c.subject.slug, as: "subjectId", key: "subject" },
      c.chapter.slug && { table: "chapters",       slug: c.chapter.slug, as: "chapterId", key: "chapter" },
      c.board        && { table: "boards",         slug: c.board,        as: "boardId",   key: "board" },
    ].filter(Boolean);

    const base = {
      goalId: c.goal.id, subjectId: c.subject.id, chapterId: c.chapter.id, boardId: null,
      chapterClassSlugs: null, stage: c.stage, board: c.board, names: {},
    };

    // Nothing to look up: ids only, or no filters at all. Ready immediately,
    // so the common case costs no extra render and no extra request.
    if (!need.length && c.chapter.id == null) {
      setState({ ...base, loading: false, error: null, ready: true, unresolved: [] });
      return;
    }
    if (!isSupabaseConfigured) {
      setState({
        ...base, loading: false, ready: false, unresolved: [],
        error: "This selection can’t be loaded right now.",
      });
      return;
    }

    // NOT ready while resolving — the catalogue query must wait.
    setState((s) => ({ ...s, ...base, loading: true, error: null, ready: false, unresolved: [] }));

    const resolveLookup = (n) =>
      supabase.from(n.table).select("id, slug, name").eq("slug", n.slug).maybeSingle()
        .then(({ data, error }) => ({
          ...n, id: data?.id ?? null, name: data?.name ?? null, error,
        }));

    // A failed lookup is NOT "no such chapter". Staying un-ready keeps the
    // catalogue query from running broadly and telling the student their
    // chapter has no courses when the truth is that we could not find out.
    const reportFailure = (error) => {
      console.error("canonical filters:", error);
      setState({
        ...base, loading: false, ready: false, unresolved: [],
        error: "Couldn’t load this selection.",
      });
    };

    const resolve = async () => {
      const chapterNeed = need.find((n) => n.key === "chapter") ?? null;

      // ONE WAVE. The chapter is scoped by the subject SLUG (or, for a legacy
      // link, the subject id) — both already in the URL — so it no longer
      // waits on the subject lookup beside it.
      const [rows, chapterRow] = await Promise.all([
        Promise.all(need.filter((n) => n.key !== "chapter").map(resolveLookup)),
        chapterNeed
          ? resolveChapter(chapterNeed, { subjectSlug: c.subject.slug, subjectId: c.subject.id })
          : null,
      ]);
      if (!active) return;

      const failed = [...rows, chapterRow].find((r) => r?.error);
      if (failed) return reportFailure(failed.error);

      const resolved = { ...base, names: {} };
      const unresolved = [];
      const applyRow = (r) => {
        if (r.id == null) {
          unresolved.push({ key: r.key, slug: r.slug });
          return;
        }
        resolved[r.as] = r.id;
        // key by the SLUG, because that is what the URL (and the chip) holds
        if (r.name) (resolved.names[r.as.replace(/Id$/, "")] ??= {})[r.slug] = r.name;
      };
      for (const r of rows) {
        applyRow(r);
      }

      if (chapterRow) {
        // HAZARD 2. An unresolved subject must never broaden the chapter
        // lookup. It no longer can: the constraint lives INSIDE the query, so
        // a subject slug that matches nothing returns no chapter rows at all
        // (measured against production: subjects.slug=eq.<nonsense> -> []).
        // That is a stronger guarantee than the guard it replaces, which had
        // to skip the query to get the same effect.
        //
        // What the guard also did was keep the MESSAGE precise, and that is
        // worth keeping: when the subject is the thing we could not find, name
        // only the subject. Reporting the chapter as unknown too would accuse
        // a chapter that may well exist under a subject the student can reach
        // by fixing the one filter that is actually wrong.
        const subjectUnresolved = unresolved.some((u) => u.key === "subject");
        if (!subjectUnresolved) {
          if (chapterRow.ambiguous) {
            // HAZARD 4. /browse?chapter=thermodynamics with no subject: two
            // real chapters, no way to choose. Not an error (the database
            // answered, and answered truthfully), and emphatically not "no
            // courses" — un-ready, named, and explained.
            unresolved.push({ key: "chapter", slug: chapterRow.slug, reason: "ambiguous" });
          } else {
            applyRow(chapterRow);
            resolved.chapterClassSlugs = chapterRow.classSlugs;
          }
        }
      }

      // The legacy id link (/browse?ch=7) carries no chapter slug to hang the
      // embed on, so its scope lookup is still a separate request. It is the
      // only request that URL makes, so it is one wave, not three.
      if (resolved.chapterId != null && resolved.chapterClassSlugs == null) {
        try {
          resolved.chapterClassSlugs = await resolveChapterClassSlugs(resolved.chapterId);
        } catch (scopeError) {
          if (!active) return;
          return reportFailure(scopeError);
        }
      }
      if (!active) return;

      // A slug that matched nothing leaves us NOT ready. Querying without its
      // predicate would answer a different question than the URL asked.
      setState({
        ...resolved, loading: false, error: null,
        ready: unresolved.length === 0, unresolved,
      });
    };
    resolve();

    return () => { active = false; };
  }, [canonicalKey, nonce]);

  return { ...state, retry: () => setNonce((n) => n + 1) };
}
