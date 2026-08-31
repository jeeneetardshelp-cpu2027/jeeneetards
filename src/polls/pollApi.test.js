// pollApi.test.js — the UI-to-database translation layer.
//
// Every poll component test injects a hand-rolled `api` object, so without this
// file pollApi.js itself — the ONLY real path to the database — was never
// executed: its RPC names, its camelCase -> p_* parameter mapping, its
// unwrap/maybeSingle/asArray handling, and its PollApiError shaping were all
// unverified. A rename or a wrong p_* key would ship green.

import { describe, expect, it } from "vitest";
import { createPollApi, PollApiError } from "./pollApi.js";

// A fake Supabase client. rpc() records the call and returns a value that is
// BOTH awaitable (resolves to {data,error}) AND chainable with .maybeSingle()/
// .single(), because pollApi uses `.rpc(...).maybeSingle()` for get_poll.
function fakeClient(handler = () => ({ data: null, error: null })) {
  const calls = [];
  const client = {
    calls,
    rpc(name, args) {
      calls.push({ name, args: args ?? null });
      const result = handler(name, args) ?? { data: null, error: null };
      const promise = Promise.resolve(result);
      promise.maybeSingle = () => Promise.resolve(result);
      promise.single = () => Promise.resolve(result);
      return promise;
    },
  };
  return client;
}

describe("pollApi request shaping", () => {
  it("sends the exact RPC name and p_* params for each method", async () => {
    const client = fakeClient((name) => {
      if (name === "get_poll") return { data: { id: 1 }, error: null };
      return { data: [], error: null };
    });
    const api = createPollApi(client);

    await api.getMode();
    await api.getTopics();
    await api.getFeed({ sort: "top", topic: "physics", limit: 10, offset: 20 });
    await api.getPoll("a-slug-7");
    await api.getComments(7, { limit: 50, offset: 5 });
    await api.castVote(7, 11);
    await api.clearVote(7);
    await api.addComment(7, "hello");
    await api.deleteComment(9);
    await api.submitPoll({ topic: "physics", question: "Q?", detail: "d", options: [{ label: "a" }] });
    await api.getMySubmissions();
    await api.report("comment", 3, "spam", "note");
    await api.adminReview(7, "approve", null, "2026-09-01T00:00:00.000Z");
    await api.adminSetStatus(7, "closed");
    await api.adminSetMode("open");

    const byName = Object.fromEntries(client.calls.map((c) => [c.name, c.args]));
    expect(byName.poll_mode).toBeNull();
    expect(byName.get_poll_topics).toBeNull();
    expect(byName.get_polls_feed).toEqual({ p_sort: "top", p_topic_slug: "physics", p_limit: 10, p_offset: 20 });
    expect(byName.get_poll).toEqual({ p_slug: "a-slug-7" });
    expect(byName.get_poll_comments).toEqual({ p_poll_id: 7, p_limit: 50, p_offset: 5 });
    expect(byName.poll_cast_vote).toEqual({ p_poll_id: 7, p_option_id: 11 });
    expect(byName.poll_clear_vote).toEqual({ p_poll_id: 7 });
    expect(byName.poll_add_comment).toEqual({ p_poll_id: 7, p_body: "hello" });
    expect(byName.poll_delete_comment).toEqual({ p_comment_id: 9 });
    expect(byName.poll_submit).toEqual({
      p_topic_slug: "physics", p_question: "Q?", p_detail: "d", p_options: [{ label: "a" }],
    });
    expect(byName.get_my_poll_submissions).toBeNull();
    expect(byName.poll_submit_report).toEqual({
      p_target_type: "comment", p_target_id: 3, p_reason: "spam", p_detail: "note",
    });
    expect(byName.poll_admin_review).toEqual({
      p_poll_id: 7, p_decision: "approve", p_note: null, p_closes_at: "2026-09-01T00:00:00.000Z",
    });
    expect(byName.poll_admin_set_status).toEqual({ p_poll_id: 7, p_status: "closed" });
    expect(byName.poll_admin_set_mode).toEqual({ p_mode: "open" });
  });

  it("uses default sort/limit for getFeed when called with no args", async () => {
    const client = fakeClient(() => ({ data: [], error: null }));
    await createPollApi(client).getFeed();
    expect(client.calls[0].args).toEqual({ p_sort: "new", p_topic_slug: null, p_limit: 20, p_offset: 0 });
  });
});

describe("pollApi response handling", () => {
  it("returns get_poll's single row, and null when it is absent", async () => {
    const withRow = createPollApi(fakeClient(() => ({ data: { id: 5 }, error: null })));
    expect(await withRow.getPoll("s")).toEqual({ id: 5 });
    const noRow = createPollApi(fakeClient(() => ({ data: null, error: null })));
    expect(await noRow.getPoll("s")).toBeNull();
  });

  it("coerces a non-array feed/topics response to an empty array", async () => {
    const api = createPollApi(fakeClient(() => ({ data: null, error: null })));
    expect(await api.getFeed()).toEqual([]);
    expect(await api.getTopics()).toEqual([]);
    expect(await api.getComments(1)).toEqual([]);
  });

  it("raises a PollApiError carrying the code when the RPC errors", async () => {
    const api = createPollApi(fakeClient(() => ({
      data: null, error: { code: "42501", message: "sign in to vote" },
    })));
    await expect(api.castVote(1, 2)).rejects.toBeInstanceOf(PollApiError);
    await api.castVote(1, 2).catch((error) => {
      expect(error.code).toBe("42501");
      expect(error.cause).toEqual({ code: "42501", message: "sign in to vote" });
    });
  });

  it("raises a configuration error when no client is wired", async () => {
    const api = createPollApi(null);
    await expect(api.getMode()).rejects.toMatchObject({ code: "polls_not_configured" });
  });
});
