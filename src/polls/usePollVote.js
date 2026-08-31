// usePollVote.js — casting, changing and clearing a vote.
//
// Shared by the feed card and the poll page so that voting behaves the same
// in both places: a student can vote straight from the feed without opening
// the poll first, which is the whole reason the feed is worth scrolling.
//
// The optimistic update is deliberately partial. Marking the chosen option
// immediately makes the tap feel instant; the percentages are NOT guessed,
// they are re-read from the server, because inventing a share and then
// correcting it half a second later is worse than a brief spinner.

import { useCallback, useEffect, useState } from "react";
import { pollApi } from "./pollApi.js";
import { pollActionError } from "./pollErrorMessages.js";

export function usePollVote(initialPoll, { api = pollApi, signedIn = false } = {}) {
  const [poll, setPoll] = useState(initialPoll);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => { setPoll(initialPoll); }, [initialPoll]);

  const reload = useCallback(async (slug) => {
    const fresh = await api.getPoll(slug);
    if (fresh) setPoll(fresh);
    return fresh;
  }, [api]);

  const choose = useCallback(async (option) => {
    if (!poll || busy) return;
    setError("");
    if (!signedIn) {
      setNeedsAuth(true);
      return;
    }
    setNeedsAuth(false);
    setBusy(true);
    // Move the tick straight away; the numbers arrive with the reload.
    setPoll((current) => ({
      ...current,
      options: (current.options ?? []).map((item) => ({
        ...item,
        viewer_choice: item.id === option.id,
      })),
    }));
    // Separate the mutation from the reload. A vote that SUCCEEDS but whose
    // follow-up reload throws must NOT be reported as a failed vote — otherwise
    // the student sees "could not record your vote" over a vote that landed.
    try {
      await api.castVote(poll.id, option.id);
    } catch (caught) {
      setError(pollActionError(caught, "record your vote"));
      await reload(poll.slug).catch(() => {}); // undo the optimistic tick
      setBusy(false);
      return;
    }
    // Mutation landed. The reload is best-effort; on failure keep the
    // optimistic tick rather than raising a misleading error.
    await reload(poll.slug).catch(() => {});
    setBusy(false);
  }, [api, busy, poll, reload, signedIn]);

  const clear = useCallback(async () => {
    if (!poll || busy) return;
    setError("");
    setBusy(true);
    try {
      await api.clearVote(poll.id);
    } catch (caught) {
      setError(pollActionError(caught, "remove your vote"));
      setBusy(false);
      return;
    }
    await reload(poll.slug).catch(() => {});
    setBusy(false);
  }, [api, busy, poll, reload]);

  return { poll, busy, error, needsAuth, choose, clear, dismissAuthPrompt: () => setNeedsAuth(false) };
}
