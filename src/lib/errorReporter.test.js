// errorReporter: crash reporting that stays dormant until a DSN is set.
//
// The audit's #9: nothing that breaks in a student's browser reached the
// operator. These tests pin the two properties that keep the fix honest — it
// sends NOTHING without a configured DSN, and when configured it leaks no
// personal data — plus the envelope shape a Sentry project needs.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseDsn, buildEnvelope, reportError, initErrorReporter, __resetForTests,
} from "./errorReporter.js";

const DSN = "https://abc123@o42.ingest.sentry.io/5551212";

beforeEach(() => {
  __resetForTests();
  vi.restoreAllMocks();
});
afterEach(() => {
  __resetForTests();
});

describe("parseDsn", () => {
  it("builds the envelope endpoint from a valid DSN", () => {
    expect(parseDsn(DSN)).toEqual({
      endpoint: "https://o42.ingest.sentry.io/api/5551212/envelope/?sentry_key=abc123&sentry_version=7",
    });
  });
  it("rejects anything malformed, so a typo disables reporting rather than throwing", () => {
    for (const bad of ["", null, undefined, "not a url", "http://insecure@h/1", "https://nokey.host/1", "https://key@host/"]) {
      expect(parseDsn(bad)).toBeNull();
    }
  });
});

describe("dormant by default", () => {
  it("initErrorReporter installs nothing and returns false without a DSN", () => {
    const add = vi.spyOn(window, "addEventListener");
    expect(initErrorReporter(undefined)).toBe(false);
    expect(add).not.toHaveBeenCalledWith("error", expect.any(Function));
    expect(add).not.toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
  });

  it("reportError sends nothing when no DSN is configured", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({});
    reportError(new Error("boom"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("when a DSN is configured", () => {
  it("installs global handlers and reports a caught error to the endpoint", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({});
    expect(initErrorReporter(DSN)).toBe(true);

    reportError(new Error("kaboom"), { source: "react-error-boundary" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toContain("/api/5551212/envelope/");
    expect(opts.method).toBe("POST");
    expect(opts.keepalive).toBe(true);
  });

  it("caps the number of events per session", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({});
    initErrorReporter(DSN);
    for (let i = 0; i < 50; i += 1) reportError(new Error(`e${i}`));
    // A render loop must not flood the project / the operator's quota.
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it("never lets a failing sink surface — fetch rejection is swallowed", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("network"); });
    initErrorReporter(DSN);
    expect(() => reportError(new Error("boom"))).not.toThrow();
  });
});

describe("the envelope carries no personal data", () => {
  const parseEvent = (envelope) => JSON.parse(envelope.split("\n")[2]);

  it("sends the path only — never the query string, hash or any token", () => {
    const orig = window.location;
    // jsdom location is read-only; redefine for this assertion.
    delete window.location;
    window.location = new URL("https://jeeneetard.com/course/5/chapter/1?v=SECRET&next=%2Fadmin#tok=xyz");

    const event = parseEvent(buildEnvelope(new Error("x"), {}, 1_700_000_000_000, "abc"));
    expect(event.request.url).toBe("/course/5/chapter/1");
    expect(JSON.stringify(event)).not.toContain("SECRET");
    expect(JSON.stringify(event)).not.toContain("xyz");

    window.location = orig;
  });

  it("carries the message, stack, level and a valid 32-hex event id", () => {
    const err = new Error("something failed");
    const event = parseEvent(buildEnvelope(err, { source: "window.onerror" }, 1_700_000_000_000, "rel1"));
    expect(event.level).toBe("error");
    expect(event.exception.values[0].value).toContain("something failed");
    expect(event.extra.stack).toBeTruthy();
    expect(event.release).toBe("rel1");
    expect(event.event_id).toMatch(/^[0-9a-f]{32}$/);
    // No account identifier fields anywhere.
    const flat = JSON.stringify(event);
    expect(flat).not.toMatch(/user_id|email|"user"/i);
  });

  it("clamps a giant message and stack so a runaway error can't exfiltrate a blob", () => {
    const err = new Error("m".repeat(5000));
    err.stack = "s".repeat(20000);
    const event = parseEvent(buildEnvelope(err, {}, 1_700_000_000_000));
    expect(event.exception.values[0].value.length).toBeLessThanOrEqual(1001);
    expect(event.extra.stack.length).toBeLessThanOrEqual(4001);
  });
});

describe("no hardcoded DSN ships in the source", () => {
  it("errorReporter.js contains no literal sentry.io ingest URL", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/errorReporter.js", "utf8");
    // The DSN must come from the env var, never be baked in.
    expect(src).not.toMatch(/https:\/\/[a-z0-9]+@[^\s"']*ingest\.sentry\.io/i);
    expect(src).toContain("VITE_SENTRY_DSN");
  });
});
