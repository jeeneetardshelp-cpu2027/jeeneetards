export const V12_STAGING_CONFIRMATION =
  "--confirm-disposable-v12-staging";

const RUN_ID_PATTERN = /^[0-9a-f]{6}$/;
const SUPABASE_HOST_PATTERN = /^[a-z0-9-]+\.supabase\.co$/;
const REDACTED = "[REDACTED]";

export function normalizeSupabaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("Supabase URL is required.");

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Supabase URL is invalid.");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !SUPABASE_HOST_PATTERN.test(parsed.hostname) ||
    (parsed.pathname !== "/" && parsed.pathname !== "") ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "Supabase URL must be a root https://<project-ref>.supabase.co URL.",
    );
  }

  return `https://${parsed.hostname.toLowerCase()}`;
}

export function sameSupabaseUrl(left, right) {
  return normalizeSupabaseUrl(left) === normalizeSupabaseUrl(right);
}

export function validateV12StagingConfig({
  allow,
  v12Allow,
  url,
  productionUrls = [],
  serviceKey,
  anonKey,
  argv = [],
} = {}) {
  if (String(allow ?? "").trim() !== "1") {
    throw new Error("Refusing: set TEST_ALLOW=1.");
  }
  if (String(v12Allow ?? "").trim() !== "1") {
    throw new Error("Refusing: set V12_TEST_ALLOW=1.");
  }
  if (!Array.isArray(argv) || !argv.includes(V12_STAGING_CONFIRMATION)) {
    throw new Error(
      `Refusing: pass the exact ${V12_STAGING_CONFIRMATION} argument.`,
    );
  }

  const normalizedUrl = normalizeSupabaseUrl(url);
  if (!Array.isArray(productionUrls) || productionUrls.length === 0) {
    throw new Error(
      "Refusing: at least one known production Supabase URL is required.",
    );
  }
  const normalizedProductionUrls = [
    ...new Set(productionUrls.map(normalizeSupabaseUrl)),
  ];
  const normalizedServiceKey = String(serviceKey ?? "").trim();
  const normalizedAnonKey = String(anonKey ?? "").trim();
  if (!normalizedServiceKey || !normalizedAnonKey) {
    throw new Error(
      "Refusing: nonempty TEST_SERVICE_KEY and TEST_ANON_KEY are required.",
    );
  }
  if (normalizedProductionUrls.includes(normalizedUrl)) {
    throw new Error("Refusing: the test URL matches a known production URL.");
  }

  return {
    allow: "1",
    v12Allow: "1",
    url: normalizedUrl,
    productionUrls: normalizedProductionUrls,
    serviceKey: normalizedServiceKey,
    anonKey: normalizedAnonKey,
    confirmation: V12_STAGING_CONFIRMATION,
  };
}

export function validateV12RunId(value) {
  const runId = String(value ?? "");
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error("runId must be exactly six lowercase hexadecimal characters.");
  }
  return runId;
}

function requestUuid(runId, discriminator) {
  const digits = runId.repeat(6).slice(0, 32).split("");
  const suffix = discriminator.toString(16).padStart(2, "0");
  digits[12] = "4";
  digits[16] = ["8", "9", "a", "b"][discriminator % 4];
  digits[30] = suffix[0];
  digits[31] = suffix[1];
  const hex = digits.join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export function v12FixtureTokens(value) {
  const runId = validateV12RunId(value);
  return {
    runId,
    channels: {
      success: `TESTV12${runId}CHSUCCESS`,
      concurrency: `TESTV12${runId}CHCONCURRENCY`,
      failure: `TESTV12${runId}CHFAILURE`,
    },
    playlists: {
      success: `TESTV12${runId}PLSUCCESS`,
      anonymousDenied: `TESTV12${runId}PLANONDENIED`,
      userDenied: `TESTV12${runId}PLUSERDENIED`,
      concurrencyA: `TESTV12${runId}PLCONCURRENCYA`,
      concurrencyB: `TESTV12${runId}PLCONCURRENCYB`,
      conflictA: `TESTV12${runId}PLCONFLICTA`,
      conflictB: `TESTV12${runId}PLCONFLICTB`,
      failure: `TESTV12${runId}PLFAILURE`,
    },
    videos: {
      success: [`V12S0${runId}`, `V12S1${runId}`],
      anonymousDenied: [`V12A0${runId}`, `V12A1${runId}`],
      userDenied: [`V12U0${runId}`, `V12U1${runId}`],
      concurrency: {
        shared: `V12C0${runId}`,
        first: `V12C1${runId}`,
        second: `V12C2${runId}`,
      },
      conflict: {
        shared: `V12X0${runId}`,
        first: `V12X1${runId}`,
        second: `V12X2${runId}`,
      },
      failure: {
        safe: `V12F0${runId}`,
        trigger: `V12FX${runId}`,
      },
    },
    chapterSlugs: [
      `testv12-${runId}-chapter-a`,
      `testv12-${runId}-chapter-b`,
    ],
    requestIds: {
      success: requestUuid(runId, 1),
      newSource: requestUuid(runId, 2),
      anonymousDenied: requestUuid(runId, 3),
      userDenied: requestUuid(runId, 4),
      concurrencyA: requestUuid(runId, 5),
      concurrencyB: requestUuid(runId, 6),
      conflictA: requestUuid(runId, 7),
      conflictB: requestUuid(runId, 8),
      failure: requestUuid(runId, 9),
    },
  };
}

function redactedSupabaseUrl(value) {
  try {
    normalizeSupabaseUrl(value);
    return "https://<redacted-project-ref>.supabase.co";
  } catch {
    return value ? "[INVALID REDACTED URL]" : "";
  }
}

export function redactV12StagingConfig({
  allow,
  v12Allow,
  url,
  productionUrls = [],
  serviceKey,
  anonKey,
  argv = [],
} = {}) {
  let targetsDiffer = null;
  try {
    targetsDiffer =
      Array.isArray(productionUrls) &&
      productionUrls.length > 0 &&
      productionUrls.every((productionUrl) =>
        !sameSupabaseUrl(url, productionUrl));
  } catch {
    // An invalid configuration is still safe to redact for a refusal report.
  }

  return {
    allow: String(allow ?? "").trim(),
    v12Allow: String(v12Allow ?? "").trim(),
    url: redactedSupabaseUrl(url),
    productionUrls: Array.isArray(productionUrls)
      ? productionUrls.map(redactedSupabaseUrl)
      : [],
    productionTargetCount: Array.isArray(productionUrls)
      ? productionUrls.length
      : 0,
    serviceKey: serviceKey ? REDACTED : "",
    anonKey: anonKey ? REDACTED : "",
    confirmationPresent:
      Array.isArray(argv) && argv.includes(V12_STAGING_CONFIRMATION),
    targetsDiffer,
  };
}
