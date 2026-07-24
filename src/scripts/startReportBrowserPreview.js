// Start a local Vite development server against disposable staging. The
// service-role key is required only for the static guard and is never exposed
// through a VITE_ variable or passed to browser code.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseEnvText, validateFixtureConfig, validateFixtureState,
} from "./reportBrowserFixtureUtils.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readEnv = (name) => {
  try { return parseEnvText(readFileSync(resolve(root, name), "utf8")); }
  catch { return {}; }
};
const production = readEnv(".env");
const staging = readEnv(".env.staging");
const cfg = (key) => process.env[key] ?? staging[key];
const url = cfg("TEST_SUPABASE_URL");
const anonKey = cfg("TEST_ANON_KEY");
const serviceKey = cfg("TEST_SERVICE_KEY");

try {
  validateFixtureConfig({
    allow: cfg("TEST_ALLOW"), url, serviceKey, anonKey,
    productionUrl: production.VITE_SUPABASE_URL,
  });
  const statePath = resolve(root, ".report-browser-fixture.json");
  if (!existsSync(statePath)) throw new Error("Prepare the browser fixture before starting this server.");
  const state = validateFixtureState(JSON.parse(readFileSync(statePath, "utf8")), url);
  // `prepare` wrote this state only after a live staging/test marker check.
  // Preview does not possess a service key and cannot mutate curated content;
  // binding the state to the exact statically non-production URL is sufficient
  // for this local server and lets restricted development shells run it.
  const childEnv = {
    ...process.env,
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_ANON_KEY: anonKey,
  };
  // These are unnecessary to Vite and should not be inherited by the child.
  delete childEnv.TEST_SERVICE_KEY;
  delete childEnv.SUPABASE_SERVICE_ROLE_KEY;
  delete childEnv.YOUTUBE_API_KEY;

  console.log("Starting local report preview against disposable staging.");
  console.log(`Open: http://127.0.0.1:5173/course/${state.playlistId}?previewReports=1`);
  const vite = resolve(root, "node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [
    vite, "--host", "127.0.0.1", "--port", "5173", "--strictPort",
  ], { cwd: root, env: childEnv, stdio: "inherit" });
  child.on("exit", (code, signal) => {
    if (signal) console.error(`Vite stopped by ${signal}.`);
    process.exitCode = code ?? (signal ? 1 : 0);
  });
} catch (error) {
  console.error(error.message.startsWith("Refusing:") ? error.message : `Refusing: ${error.message}`);
  process.exitCode = 2;
}
