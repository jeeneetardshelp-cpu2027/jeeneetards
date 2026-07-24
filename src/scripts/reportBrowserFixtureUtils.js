export const REPORT_BROWSER_STATE_VERSION = 1;

export function parseEnvText(text = "") {
  const values = {};
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  return values;
}

export function validateFixtureConfig({
  allow,
  url,
  serviceKey,
  anonKey,
  productionUrl,
}) {
  if (String(allow ?? "").trim() !== "1")
    throw new Error("Refusing: set TEST_ALLOW=1 in .env.staging.");
  if (!url || !serviceKey || !anonKey)
    throw new Error(
      "Refusing: TEST_SUPABASE_URL, TEST_SERVICE_KEY and TEST_ANON_KEY are required.",
    );
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url))
    throw new Error("Refusing: TEST_SUPABASE_URL is not a Supabase project URL.");
  if (productionUrl && normalizeUrl(url) === normalizeUrl(productionUrl))
    throw new Error("Refusing: TEST_SUPABASE_URL is the production URL.");
}

export function normalizeUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/, "").toLowerCase();
}

export function validateFixtureState(state, expectedUrl, { requireComplete = true } = {}) {
  if (!state || state.version !== REPORT_BROWSER_STATE_VERSION)
    throw new Error("Fixture state is missing or has an unsupported version.");
  const integerFields = ["playlistId", "videoId", "channelId"];
  for (const field of integerFields) {
    if ((!requireComplete && state[field] == null)) continue;
    if (!Number.isSafeInteger(state[field]) || state[field] <= 0)
      throw new Error(`Fixture state has an invalid ${field}.`);
  }
  if ((requireComplete || state.userId != null) && !/^[0-9a-f-]{36}$/i.test(state.userId ?? ""))
    throw new Error("Fixture state has an invalid userId.");
  if (!state.email || !state.password || !state.runId)
    throw new Error("Fixture state is missing browser credentials.");
  if (expectedUrl && normalizeUrl(state.supabaseUrl) !== normalizeUrl(expectedUrl))
    throw new Error("Fixture state belongs to a different Supabase project.");
  return state;
}

export function fixtureTokens(runId) {
  const run = String(runId).toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(run)) throw new Error("runId must be six hexadecimal characters.");
  return {
    channelYoutubeId: `REPORTUI${run}`,
    playlistYoutubeId: `PLREPORTUI${run}`,
    videoYoutubeId: `R${run}0000`,
    email: `report-ui-${run}@example.invalid`,
    expectedReason: "broken",
    expectedNote: `Browser verification ${run}`,
  };
}

export function isMissingAuthUser(error) {
  return error?.status === 404 || /user not found/i.test(error?.message ?? "");
}
