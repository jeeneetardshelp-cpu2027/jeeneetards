export function forumContributionError(error, action = "save this contribution") {
  const code = String(error?.code ?? "");
  const detail = String(error?.cause?.message ?? "").toLowerCase();
  if (code === "23505") {
    return action.includes("username")
      ? "That username is already taken. Try another one."
      : "This looks like a duplicate of something you submitted recently.";
  }
  if (/new accounts can contribute after 10 minutes/.test(detail))
    return "New accounts can contribute after 10 minutes. Your draft is saved on this device.";
  if (/temporarily suspended/.test(detail))
    return "Forum posting is temporarily suspended for this account. Your draft has not been removed.";
  if (/not open|unavailable|locked/.test(detail) || code === "55000")
    return "Contributions are paused right now. Your draft is saved on this device.";
  if (/session|sign in|jwt|permission/.test(detail) || code === "42501")
    return "Your session may have expired. Sign in again; your draft will stay here.";
  if (code === "22023" && action.includes("username"))
    return "Use 3–30 letters, numbers, underscores or hyphens. Staff-like, abusive and misleading names are reserved.";
  if (code === "22023") return "Check the selected topic and the length of your contribution, then try again.";
  if (/fetch|network|timeout/.test(detail))
    return "Could not reach the server. Check your connection and try again; your draft is saved.";
  return `Could not ${action}. Your draft is still saved on this device.`;
}
