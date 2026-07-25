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

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { parseCanonical } from "./canonicalUrl.js";

const EMPTY = { goalId: null, subjectId: null, chapterId: null, boardId: null, names: {} };

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
      stage: c.stage, board: c.board, names: {},
    };

    // Nothing to look up: ids only, or no filters at all. Ready immediately,
    // so the common case costs no extra render and no extra request.
    if (!need.length) {
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

    Promise.all(
      need.map((n) =>
        supabase.from(n.table).select("id, slug, name").eq("slug", n.slug).maybeSingle()
          .then(({ data, error }) => ({ ...n, id: data?.id ?? null, name: data?.name ?? null, error }))
      )
    ).then((rows) => {
      if (!active) return;

      const failed = rows.find((r) => r.error);
      if (failed) {
        console.error("canonical filters:", failed.error);
        // A failed lookup is NOT "no such chapter". Staying un-ready keeps the
        // catalogue query from running broadly and telling the student their
        // chapter has no courses when the truth is that we could not find out.
        setState({
          ...base, loading: false, ready: false, unresolved: [],
          error: "Couldn’t load this selection.",
        });
        return;
      }

      const resolved = { ...base, names: {} };
      const unresolved = [];
      for (const r of rows) {
        if (r.id == null) { unresolved.push({ key: r.key, slug: r.slug }); continue; }
        resolved[r.as] = r.id;
        // key by the SLUG, because that is what the URL (and the chip) holds
        if (r.name) (resolved.names[r.as.replace(/Id$/, "")] ??= {})[r.slug] = r.name;
      }

      // A slug that matched nothing leaves us NOT ready. Querying without its
      // predicate would answer a different question than the URL asked.
      setState({
        ...resolved, loading: false, error: null,
        ready: unresolved.length === 0, unresolved,
      });
    });

    return () => { active = false; };
  }, [canonicalKey, nonce]);

  return { ...state, retry: () => setNonce((n) => n + 1) };
}
