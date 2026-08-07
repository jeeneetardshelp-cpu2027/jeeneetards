import { useCallback, useEffect, useRef, useState } from "react";
import { forumApi } from "./forumApi.js";

export function useForumSubmitSetup(api = forumApi) {
  const [state, setState] = useState({ status: "loading", mode: null, topics: [], error: "" });
  const [reloadKey, setReloadKey] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    const request = ++generation.current;
    setState({ status: "loading", mode: null, topics: [], error: "" });
    Promise.all([api.getMode(), api.getTopics()]).then(([mode, topics]) => {
      if (request !== generation.current) return;
      setState({ status: mode === "off" ? "unavailable" : "ready", mode, topics, error: "" });
    }).catch((error) => {
      if (request !== generation.current) return;
      setState({ status: "error", mode: null, topics: [], error: error.message });
    });
    return () => { generation.current += 1; };
  }, [api, reloadKey]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);
  return { ...state, retry };
}
