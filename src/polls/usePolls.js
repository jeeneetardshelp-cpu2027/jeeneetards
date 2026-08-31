// usePolls.js — the two data hooks the poll screens need.
//
// Both follow useForumFeed/useForumThread: a generation counter so a slow
// response from an abandoned request can never overwrite a newer one, and an
// explicit `mode` check first, so "polls are switched off" is a distinct
// state from "polls failed to load".

import { useCallback, useEffect, useRef, useState } from "react";
import { pollApi } from "./pollApi.js";

const initialFeed = {
  status: "loading",
  mode: null,
  polls: [],
  topics: [],
  error: "",
};

export function usePollFeed({ sort = "new", topic = null } = {}, api = pollApi) {
  const [state, setState] = useState(initialFeed);
  const [reloadKey, setReloadKey] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    const request = ++generation.current;
    setState((current) => ({ ...current, status: "loading" }));

    const load = async () => {
      try {
        const mode = await api.getMode();
        if (request !== generation.current) return;
        if (mode === "off") {
          setState({ ...initialFeed, status: "unavailable", mode });
          return;
        }
        const [polls, topics] = await Promise.all([
          api.getFeed({ sort, topic }),
          api.getTopics(),
        ]);
        if (request !== generation.current) return;
        setState({ status: "ready", mode, polls, topics, error: "" });
      } catch (error) {
        if (request !== generation.current) return;
        setState({ ...initialFeed, status: "error", error: error.message });
      }
    };

    load();
    return () => { generation.current += 1; };
  }, [api, sort, topic, reloadKey]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);
  return { ...state, retry };
}

const initialPoll = {
  status: "loading",
  mode: null,
  poll: null,
  comments: [],
  error: "",
};

export function usePoll(slug, api = pollApi) {
  const [state, setState] = useState(initialPoll);
  const [reloadKey, setReloadKey] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    const request = ++generation.current;
    setState(initialPoll);

    const load = async () => {
      try {
        const mode = await api.getMode();
        if (request !== generation.current) return;
        if (mode === "off") {
          setState({ ...initialPoll, status: "unavailable", mode });
          return;
        }
        const poll = await api.getPoll(slug);
        if (request !== generation.current) return;
        if (!poll) {
          setState({ ...initialPoll, status: "not_found", mode });
          return;
        }
        const comments = await api.getComments(poll.id);
        if (request !== generation.current) return;
        setState({ status: "ready", mode, poll, comments, error: "" });
      } catch (error) {
        if (request !== generation.current) return;
        setState({ ...initialPoll, status: "error", error: error.message });
      }
    };

    load();
    return () => { generation.current += 1; };
  }, [api, slug, reloadKey]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);

  // Monotonic ids so overlapping refreshes (vote, then quickly change vote)
  // apply in order: a slow earlier response can otherwise land after a newer
  // one and show stale counts. Separate counters per slice, because PollPage
  // calls refreshComments and refreshPoll in sequence and they must not cancel
  // each other — they update disjoint state.
  const pollGen = useRef(0);
  const commentsGen = useRef(0);

  // Refresh only the poll row after a vote, so the comment list does not
  // flash back to a skeleton every time somebody changes their mind.
  const refreshPoll = useCallback(async () => {
    const id = ++pollGen.current;
    try {
      const poll = await api.getPoll(slug);
      if (poll && id === pollGen.current) setState((current) => ({ ...current, poll }));
    } catch {
      // A failed refresh leaves the last good numbers on screen; the vote
      // itself already succeeded, so an error banner here would only confuse.
    }
  }, [api, slug]);

  const refreshComments = useCallback(async (pollId) => {
    const id = ++commentsGen.current;
    try {
      const comments = await api.getComments(pollId);
      if (id === commentsGen.current) setState((current) => ({ ...current, comments }));
    } catch {
      // Same reasoning as refreshPoll.
    }
  }, [api]);

  return { ...state, retry, refreshPoll, refreshComments };
}
