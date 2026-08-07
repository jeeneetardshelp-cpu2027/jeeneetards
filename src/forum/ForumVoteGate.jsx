import ForumSignInPanel from "./ForumSignInPanel.jsx";
import { ForumLoadError, ForumLoading } from "./ForumStates.jsx";
import ForumUsernameClaim from "./ForumUsernameClaim.jsx";

export default function ForumVoteGate({ access, api }) {
  if (!access.requested || access.canVote) return null;
  if (access.authLoading || (access.userId && access.identity.status === "loading")) {
    return <ForumLoading kind="thread" />;
  }
  if (!access.userId) {
    return (
      <ForumSignInPanel
        action="vote on discussions"
        detail="Votes are private. Other students see only the updated totals."
      />
    );
  }
  if (access.identity.status === "needs_username") {
    return <ForumUsernameClaim api={api} onClaimed={access.identity.claimed} />;
  }
  if (access.identity.status === "error") {
    return <ForumLoadError detail={access.identity.error} onRetry={access.identity.retry} />;
  }
  return null;
}
