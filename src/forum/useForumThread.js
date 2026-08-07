import { useCallback, useEffect, useRef, useState } from "react";
import { forumApi } from "./forumApi.js";

const initialState = {
  status: "loading",
  mode: null,
  post: null,
  comments: [],
  error: "",
};

export function useForumThread(postId, api = forumApi) {
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

        const [post, comments] = await Promise.all([
          api.getPost(postId),
          api.getComments(postId),
        ]);
        if (request !== generation.current) return;
        setState({
          status: post ? "ready" : "not_found",
          mode,
          post,
          comments: post ? comments : [],
          error: "",
        });
      } catch (error) {
        if (request !== generation.current) return;
        setState({ ...initialState, status: "error", error: error.message });
      }
    };

    load();
    return () => { generation.current += 1; };
  }, [api, postId, reloadKey]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);
  return { ...state, retry };
}
