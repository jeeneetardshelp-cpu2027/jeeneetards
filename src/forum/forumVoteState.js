function voteValue(value) {
  const number = Number(value);
  return number === 1 || number === -1 ? number : 0;
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function forumVoteState(row = {}) {
  return {
    viewerVote: voteValue(row.viewer_vote ?? row.viewerVote),
    score: Number(row.score) || 0,
    upvoteCount: count(row.upvote_count ?? row.upvoteCount),
    downvoteCount: count(row.downvote_count ?? row.downvoteCount),
  };
}

export function optimisticForumVote(current, requestedValue) {
  const before = forumVoteState(current);
  const requested = voteValue(requestedValue);
  const nextVote = before.viewerVote === requested ? 0 : requested;
  return {
    viewerVote: nextVote,
    score: before.score + nextVote - before.viewerVote,
    upvoteCount: before.upvoteCount
      + Number(nextVote === 1) - Number(before.viewerVote === 1),
    downvoteCount: before.downvoteCount
      + Number(nextVote === -1) - Number(before.viewerVote === -1),
  };
}
