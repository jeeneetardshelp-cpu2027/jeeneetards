export function collectUiAuditFailures(report) {
  const failures = [];
  const matrix = Array.isArray(report?.matrix) ? report.matrix : [];

  for (const result of matrix) {
    const context = `${result.width ?? "unknown"}px ${result.step ?? "unknown route"}`;

    if ((result.overflowingEls ?? 0) > 0) {
      failures.push(`${context} has ${result.overflowingEls} overflowing element(s)`);
    }

    if (result.headers !== 1) {
      failures.push(`${context} renders ${result.headers ?? 0} visible headers`);
    }

    if (
      (result.width ?? Number.POSITIVE_INFINITY) <= 414
      && (result.tapTargetsUnder44 ?? 0) > 0
    ) {
      failures.push(
        `${context} has ${result.tapTargetsUnder44} mobile tap target(s) below 44px`,
      );
    }
  }

  for (const [language, label] of [["english", "English"], ["hindi", "Hindi"]]) {
    if ((report?.titleStress?.[language]?.overflowPx ?? 0) > 0) {
      failures.push(`${label} title stress overflows the viewport`);
    }
  }

  for (const [key, label] of [["zoom100", "100% reflow"], ["zoom200", "200% reflow"]]) {
    const result = report?.reflow200?.[key];
    if (
      !result
      || (result.overflowPx ?? 0) > 0
      || (result.overflowingEls ?? 0) > 0
      || result.headerVisible !== true
    ) {
      failures.push(`${label} has overflow or a missing header`);
    }
  }

  const focusOrder = Array.isArray(report?.focusOrder) ? report.focusOrder : [];
  if (focusOrder.length < 8) {
    failures.push(`focus audit reached only ${focusOrder.length} of 8 controls`);
  }
  for (const [index, item] of focusOrder.entries()) {
    if (item?.ring !== true) {
      failures.push(
        `focus ring is missing on tab ${index + 1}${item?.label ? ` (${item.label})` : ""}`,
      );
    }
  }

  const restoration = report?.restoration;
  if (
    restoration?.clicked !== "View course"
    || !restoration?.afterClick?.url?.startsWith("/course/")
  ) {
    failures.push("course navigation did not reach a course route");
  }
  if (restoration?.filtersRestored !== true) {
    failures.push("filter state was not restored after browser Back");
  }
  if (restoration?.scrollRestored === false) {
    failures.push("scroll position was not restored after browser Back");
  }

  return failures;
}
