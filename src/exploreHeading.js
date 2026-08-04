const STEP_LABELS = Object.freeze({
  board: "Choose a school board",
  class: "Choose a stage",
  subject: "Choose a subject",
  chapter: "Choose a chapter",
});

/** Build the same descriptive Explore H1 for the client and edge response. */
export function exploreStepHeading(step, scopeLabels = []) {
  const action = STEP_LABELS[step] ?? "Choose the next step";
  if (step === "board") return action;

  const scope = scopeLabels
    .map((label) => String(label ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return scope ? `${action} for ${scope}` : action;
}
