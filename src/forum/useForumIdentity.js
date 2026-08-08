import { useCallback, useEffect, useRef, useState } from "react";
import { forumApi } from "./forumApi.js";

export function useForumIdentity(userId, api = forumApi) {
  const [state, setState] = useState({
    status: userId ? "loading" : "signed_out",
    username: null,
    betaMember: false,
    error: "",
  });
  const [reloadKey, setReloadKey] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    const request = ++generation.current;
    if (!userId) {
      setState({ status: "signed_out", username: null, betaMember: false, error: "" });
      return () => { generation.current += 1; };
    }
    setState({ status: "loading", username: null, betaMember: false, error: "" });
    Promise.all([
      api.getMyIdentity(),
      typeof api.getBetaMembership === "function" ? api.getBetaMembership() : false,
    ]).then(([identity, betaMember]) => {
      if (request !== generation.current) return;
      setState({
        status: identity?.needs_username ? "needs_username" : "ready",
        username: identity?.username ?? null,
        betaMember: betaMember === true,
        error: "",
      });
    }).catch((error) => {
      if (request !== generation.current) return;
      setState({ status: "error", username: null, betaMember: false, error: error.message });
    });
    return () => { generation.current += 1; };
  }, [api, reloadKey, userId]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);
  const claimed = useCallback((username) => {
    setState((current) => ({ ...current, status: "ready", username, error: "" }));
  }, []);
  return { ...state, retry, claimed };
}
