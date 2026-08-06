import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "../outputs/forum-username-claim");
const expectedProjectRef = "essmxonestbrgmgrtywn";
const requiredFlag = "--confirm-forum-username-jwt-staging";

const parseEnv = (text = "") => Object.fromEntries(String(text).split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  return match ? [[match[1], match[2].replace(/^["']|["']$/g, "").trim()]] : [];
}));
const readEnv = (name) => {
  try { return parseEnv(readFileSync(resolve(root, name), "utf8")); } catch { return {}; }
};
const production = readEnv(".env");
const staging = readEnv(".env.staging");
const setting = (name) => process.env[name] ?? staging[name];
const url = setting("TEST_SUPABASE_URL");
const serviceKey = setting("TEST_SERVICE_KEY");
const anonKey = setting("TEST_ANON_KEY");
const authOptions = { persistSession: false, autoRefreshToken: false };

if (setting("TEST_ALLOW") !== "1") throw new Error("Refusing: TEST_ALLOW must be 1.");
if (!process.argv.includes(requiredFlag)) throw new Error(`Refusing: pass ${requiredFlag}.`);
if (!url || !serviceKey || !anonKey) throw new Error("Refusing: staging URL and both API keys are required.");
const target = new URL(url);
if (target.hostname.split(".")[0] !== expectedProjectRef)
  throw new Error("Refusing: unexpected staging project reference.");
if (production.VITE_SUPABASE_URL && new URL(production.VITE_SUPABASE_URL).hostname === target.hostname)
  throw new Error("Refusing: staging URL matches production.");

const service = createClient(url, serviceKey, { auth: authOptions });
const runId = randomBytes(4).toString("hex");
const fixtures = ["first", "second", "missing-profile"].map((role) => ({
  role,
  email: `forum-claim-${runId}-${role}@staging.invalid`,
  password: `Claim-${randomBytes(24).toString("base64url")}`,
  id: null,
  client: createClient(url, anonKey, { auth: authOptions }),
}));
const report = {
  version: 1,
  run_id: runId,
  started_at: new Date().toISOString(),
  project_ref: expectedProjectRef,
  tests: [],
  cleanup: { attempted: false, completed: false, errors: [], residue: null },
  fatal: null,
};

const safeMessage = (value) => {
  let output = String(value ?? "");
  for (const secret of [serviceKey, anonKey, ...fixtures.flatMap((item) => [item.password, item.email])])
    if (secret) output = output.split(secret).join("[REDACTED]");
  return output.slice(0, 1000);
};
const responseShape = (value, depth = 0) => {
  if (value === null) return { type: "null" };
  if (value === undefined) return { type: "undefined" };
  if (Array.isArray(value)) return {
    type: "array", length: value.length,
    item: value.length && depth < 3 ? responseShape(value[0], depth + 1) : null,
  };
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return {
      type: "object", keys,
      fields: depth < 3 ? Object.fromEntries(keys.map((key) => [key, responseShape(value[key], depth + 1)])) : null,
    };
  }
  return { type: typeof value };
};
const evidence = (response, facts = {}) => ({ raw_response_shape: responseShape(response), ...facts });
const record = (name, passed, detail) => {
  report.tests.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) throw new Error(`verification failed: ${name}`);
};

const cleanup = async () => {
  report.cleanup.attempted = true;
  for (const fixture of fixtures) {
    if (!fixture.id) continue;
    const { error } = await service.auth.admin.deleteUser(fixture.id);
    if (error) report.cleanup.errors.push(safeMessage(error.message));
  }
  const ids = fixtures.map((item) => item.id).filter(Boolean);
  const residue = ids.length
    ? await service.from("profiles").select("id", { count: "exact", head: true }).in("id", ids)
    : { count: 0, error: null };
  report.cleanup.residue = { profile_count: residue.count ?? null, query_error: safeMessage(residue.error?.message) || null };
  report.cleanup.completed = report.cleanup.errors.length === 0 && residue.error === null && residue.count === 0;
};

try {
  const environment = await service.from("app_environment").select("name").eq("id", true).single();
  record("target is marked staging", environment.error === null && environment.data?.name === "staging",
    evidence(environment, { is_staging: environment.data?.name === "staging" }));

  for (const fixture of fixtures) {
    const created = await service.auth.admin.createUser({
      email: fixture.email, password: fixture.password, email_confirm: true,
    });
    fixture.id = created.data?.user?.id ?? null;
    record(`provision ${fixture.role} fixture`, !created.error && Boolean(fixture.id),
      evidence(created, { created: Boolean(fixture.id) }));
    const signedIn = await fixture.client.auth.signInWithPassword({ email: fixture.email, password: fixture.password });
    record(`authenticate ${fixture.role} through real JWT`, !signedIn.error && Boolean(signedIn.data?.session),
      evidence(signedIn, { session_present: Boolean(signedIn.data?.session) }));
  }

  const missing = fixtures[2];
  const removedProfile = await service.from("profiles").delete().eq("id", missing.id);
  record("remove one profile to exercise legacy backfill", removedProfile.error === null,
    evidence(removedProfile, { removed: removedProfile.error === null }));

  for (const fixture of fixtures) {
    const identity = await fixture.client.rpc("forum_get_my_identity").single();
    record(`${fixture.role} starts behind username gate`,
      identity.error === null && identity.data?.needs_username === true && identity.data?.username === null,
      evidence(identity, { needs_username: identity.data?.needs_username === true }));
  }

  const shared = `fs-claim-${runId}`;
  const concurrent = await Promise.all([
    fixtures[0].client.rpc("forum_claim_username", { p_username: shared }),
    fixtures[1].client.rpc("forum_claim_username", { p_username: shared.toUpperCase() }),
  ]);
  const winnerIndex = concurrent.findIndex((response) => response.error === null);
  const loserIndex = concurrent.findIndex((response) => response.error?.code === "23505");
  record("concurrent case-insensitive claims produce one winner", winnerIndex >= 0 && loserIndex >= 0 && winnerIndex !== loserIndex,
    evidence(concurrent, { winner_count: concurrent.filter((item) => item.error === null).length, collision_count: concurrent.filter((item) => item.error?.code === "23505").length }));

  const retry = await fixtures[winnerIndex].client.rpc("forum_claim_username", {
    p_username: winnerIndex === 0 ? shared.toUpperCase() : shared,
  });
  record("winning account claim retry is idempotent", retry.error === null && retry.data === concurrent[winnerIndex].data,
    evidence(retry, { idempotent: retry.error === null }));

  const reserved = await fixtures[loserIndex].client.rpc("forum_claim_username", { p_username: "moderator1" });
  record("reserved staff-like username is rejected", reserved.error?.code === "22023",
    evidence(reserved, { error_code: reserved.error?.code ?? null }));

  const secondClaim = await fixtures[loserIndex].client.rpc("forum_claim_username", { p_username: `fs-second-${runId}` });
  record("losing account can choose another username", secondClaim.error === null,
    evidence(secondClaim, { claimed: secondClaim.error === null }));

  const backfill = await missing.client.rpc("forum_claim_username", { p_username: `fs-backfill-${runId}` });
  const backfilledProfile = await service.from("profiles").select("id,username").eq("id", missing.id).single();
  record("claim safely creates a missing legacy profile", backfill.error === null && backfilledProfile.error === null,
    evidence({ backfill, backfilledProfile }, { profile_created: backfilledProfile.error === null }));

  const bypass = await fixtures[0].client.from("profiles").update({ username: `bypass-${runId}` }).eq("id", fixtures[0].id);
  record("direct browser username update is denied", Boolean(bypass.error),
    evidence(bypass, { denied: Boolean(bypass.error), error_code: bypass.error?.code ?? null }));
} catch (error) {
  report.fatal = safeMessage(error?.stack || error);
} finally {
  await cleanup();
  report.finished_at = new Date().toISOString();
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, `forum-username-jwt-${runId}.json`);
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Evidence: ${outputPath}`);
  if (report.fatal || !report.cleanup.completed || report.tests.some((test) => !test.passed)) process.exitCode = 1;
}
