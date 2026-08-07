import { useCallback, useEffect, useRef, useState } from "react";
import { forumApi } from "./forumApi.js";
import { cursorFromForumPost, FORUM_PAGE_SIZE } from "./forumCursor.js";

const initialState = {
  status: "loading",
  mode: null,
  topics: [],
  posts: [],
  hasMore: false,
  loadingMore: false,
  pageError: "",
  error: "",
};

export function useForumFeed({ sort, topic, query, api = forumApi }) {
  const [state, setState] = useState(initialState);
  const [reloadKey, setReloadKey] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    const request = ++generation.current;
    setState(initialState);

    const load = async () => {
      try {
        const mode = await api.getMode();
        if (request !== generation.current) return;
        if (mode === "off") {
          setState({ ...initialState, status: "unavailable", mode, error: "" });
          return;
        }

        const [topics, posts] = await Promise.all([
          api.getTopics(),
          api.getFeed({ sort, topic, query, limit: FORUM_PAGE_SIZE }),
        ]);
        if (request !== generation.current) return;
        setState({
          status: "ready",
          mode,
          topics,
          posts,
          hasMore: posts.length === FORUM_PAGE_SIZE,
          loadingMore: false,
          pageError: "",
          error: "",
        });
      } catch (error) {
        if (request !== generation.current) return;
        setState({ ...initialState, status: "error", error: error.message });
      }
    };

    load();
    return () => { generation.current += 1; };
  }, [api, query, reloadKey, sort, topic]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);

  const loadMore = useCallback(async () => {
    if (state.status !== "ready" || state.loadingMore || !state.hasMore) return;
    const request = generation.current;
    const cursor = cursorFromForumPost(state.posts.at(-1), sort, query);
    if (!cursor) {
      setState((current) => ({ ...current, hasMore: false }));
      return;
    }

    setState((current) => ({ ...current, loadingMore: true, pageError: "" }));
    try {
      const next = await api.getFeed({
        sort, topic, query, cursor, limit: FORUM_PAGE_SIZE,
      });
      if (request !== generation.current) return;
      setState((current) => {
        const known = new Set(current.posts.map((post) => post.id));
        const unique = next.filter((post) => !known.has(post.id));
        return {
          ...current,
          posts: [...current.posts, ...unique],
          hasMore: next.length === FORUM_PAGE_SIZE,
          loadingMore: false,
          pageError: "",
        };
      });
    } catch (error) {
      if (request !== generation.current) return;
      setState((current) => ({
        ...current,
        loadingMore: false,
        pageError: error.message,
      }));
    }
  }, [api, query, sort, state.hasMore, state.loadingMore, state.posts, state.status, topic]);

  return { ...state, retry, loadMore };
}
