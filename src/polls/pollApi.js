// pollApi.js — the ONLY path from the poll UI to the database.
//
// Same shape as forumApi.js on purpose: every call is an RPC, because
// polls_v1.sql grants browser roles no direct table access. If a component
// ever needs something this file does not expose, the answer is a new
// reviewed RPC, not a `supabase.from("polls")`.

import { supabase } from "../supabaseClient.js";

export class PollApiError extends Error {
  constructor(message, { code = null, cause = null } = {}) {
    super(message, { cause });
    this.name = "PollApiError";
    this.code = code;
  }
}

function requireClient(client) {
  if (!client?.rpc) {
    throw new PollApiError("The poll service is not configured.", {
      code: "polls_not_configured",
    });
  }
  return client;
}

function unwrap(result, label) {
  if (result?.error) {
    throw new PollApiError(`Could not ${label}.`, {
      code: result.error.code ?? null,
      cause: result.error,
    });
  }
  return result?.data;
}

const asArray = (value) => (Array.isArray(value) ? value : []);

export function createPollApi(client = supabase) {
  return Object.freeze({
    async getMode() {
      return unwrap(await requireClient(client).rpc("poll_mode"), "check whether polls are open");
    },

    async getTopics() {
      return asArray(unwrap(await requireClient(client).rpc("get_poll_topics"), "load poll subjects"));
    },

    async getFeed({ sort = "new", topic = null, limit = 20, offset = 0 } = {}) {
      return asArray(unwrap(await requireClient(client).rpc("get_polls_feed", {
        p_sort: sort,
        p_topic_slug: topic,
        p_limit: limit,
        p_offset: offset,
      }), "load polls"));
    },

    async getPoll(slug) {
      const response = await requireClient(client)
        .rpc("get_poll", { p_slug: slug })
        .maybeSingle();
      return unwrap(response, "load this poll") ?? null;
    },

    async getComments(pollId, { limit = 100, offset = 0 } = {}) {
      return asArray(unwrap(await requireClient(client).rpc("get_poll_comments", {
        p_poll_id: pollId,
        p_limit: limit,
        p_offset: offset,
      }), "load the comments"));
    },

    async castVote(pollId, optionId) {
      unwrap(await requireClient(client).rpc("poll_cast_vote", {
        p_poll_id: pollId,
        p_option_id: optionId,
      }), "record your vote");
    },

    async clearVote(pollId) {
      unwrap(await requireClient(client).rpc("poll_clear_vote", { p_poll_id: pollId }), "remove your vote");
    },

    async addComment(pollId, body) {
      return unwrap(await requireClient(client).rpc("poll_add_comment", {
        p_poll_id: pollId,
        p_body: body,
      }), "post your comment");
    },

    async deleteComment(commentId) {
      unwrap(await requireClient(client).rpc("poll_delete_comment", {
        p_comment_id: commentId,
      }), "delete your comment");
    },

    async submitPoll({ topic, question, detail = null, options = [] }) {
      return unwrap(await requireClient(client).rpc("poll_submit", {
        p_topic_slug: topic,
        p_question: question,
        p_detail: detail,
        p_options: options,
      }), "send your poll for review");
    },

    async getMySubmissions() {
      return asArray(unwrap(
        await requireClient(client).rpc("get_my_poll_submissions"),
        "load your submitted polls",
      ));
    },

    async report(targetType, targetId, reason, detail = null) {
      unwrap(await requireClient(client).rpc("poll_submit_report", {
        p_target_type: targetType,
        p_target_id: targetId,
        p_reason: reason,
        p_detail: detail,
      }), "send your report");
    },

    /* ------------------------------------------------------------ admin */

    async adminListPending(limit = 50) {
      return asArray(unwrap(
        await requireClient(client).rpc("poll_admin_list_pending", { p_limit: limit }),
        "load the review queue",
      ));
    },

    async adminReview(pollId, decision, note = null, closesAt = null) {
      return unwrap(await requireClient(client).rpc("poll_admin_review", {
        p_poll_id: pollId,
        p_decision: decision,
        p_note: note,
        p_closes_at: closesAt,
      }), "save your review decision");
    },

    async adminSetStatus(pollId, status) {
      return unwrap(await requireClient(client).rpc("poll_admin_set_status", {
        p_poll_id: pollId,
        p_status: status,
      }), "change the poll status");
    },

    async adminSetOptionImage(optionId, imageUrl) {
      unwrap(await requireClient(client).rpc("poll_admin_set_option_image", {
        p_option_id: optionId,
        p_image_url: imageUrl,
      }), "update the option picture");
    },

    async adminListReports(limit = 100) {
      return asArray(unwrap(
        await requireClient(client).rpc("poll_admin_list_reports", { p_limit: limit }),
        "load reported poll content",
      ));
    },

    async adminResolveReport(reportId, status) {
      unwrap(await requireClient(client).rpc("poll_admin_resolve_report", {
        p_report_id: reportId,
        p_status: status,
      }), "resolve this report");
    },

    async adminSetCommentRemoved(commentId, removed) {
      unwrap(await requireClient(client).rpc("poll_admin_set_comment_removed", {
        p_comment_id: commentId,
        p_removed: removed,
      }), "hide this comment");
    },

    async adminSetMode(mode) {
      return unwrap(await requireClient(client).rpc("poll_admin_set_mode", { p_mode: mode }),
        "change the poll mode");
    },
  });
}

export const pollApi = createPollApi();
