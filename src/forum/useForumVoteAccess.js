import { useCallback, useState } from "react";
import { useSession } from "../useSession.js";
import { useForumIdentity } from "./useForumIdentity.js";

export function useForumVoteAccess({ api, authState = null }) {
  const liveAuth = useSession();
  const { session, loading: authLoading } = authState ?? liveAuth;
  const userId = session?.user?.id ?? null;
  const identity = useForumIdentity(userId, api);
  const [requested, setRequested] = useState(false);
  const requestAccess = useCallback(() => setRequested(true), []);

  return {
    userId,
    authLoading,
    identity,
    requested,
    requestAccess,
    canVote: Boolean(userId) && !authLoading && identity.status === "ready",
  };
}
