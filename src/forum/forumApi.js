import { supabase } from "../supabaseClient.js";

export class ForumApiError extends Error {
  constructor(message, { code = null, cause = null } = {}) {
    super(message, { cause });
    this.name = "ForumApiError";
    this.code = code;
  }
}

function requireClient(client) {
  if (!client?.rpc) {
    throw new ForumApiError("The discussion service is not configured.", {
      code: "forum_not_configured",
    });
  }
  return client;
}

function unwrap(result, label) {
  if (result?.error) {
    throw new ForumApiError(`Could not ${label}.`, {
      code: result.error.code ?? null,
      cause: result.error,
    });
  }
  return result?.data;
}

export function createForumApi(client = supabase) {
  return Object.freeze({
    async getMode() {
      return unwrap(await requireClient(client).rpc("forum_mode"), "check forum availability");
    },

    async getTopics() {
      const data = unwrap(await requireClient(client).rpc("get_forum_topics"), "load forum topics");
      return Array.isArray(data) ? data : [];
    },

    async getFeed({ sort = "hot", topic = null, query = null, cursor = null, limit = 25 } = {}) {
      const data = unwrap(await requireClient(client).rpc("get_forum_feed", {
        p_sort: sort,
        p_topic_slug: topic,
        p_query: query,
        p_cursor_hot: cursor?.hot_rank ?? null,
        p_cursor_score: cursor?.score ?? null,
        p_cursor_created_at: cursor?.created_at ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_limit: limit,
      }), "load forum posts");
      return Array.isArray(data) ? data : [];
    },

    async getPost(postId) {
      const response = await requireClient(client)
        .rpc("get_forum_post", { p_post_id: postId })
        .maybeSingle();
      return unwrap(response, "load this forum post") ?? null;
    },

    async getComments(postId) {
      const data = unwrap(await requireClient(client).rpc("get_forum_comments", {
        p_post_id: postId,
      }), "load forum answers");
      return Array.isArray(data) ? data : [];
    },

    async getMyIdentity() {
      const response = await requireClient(client)
        .rpc("forum_get_my_identity")
        .single();
      return unwrap(response, "load your forum identity");
    },

    async getBetaMembership() {
      return unwrap(
        await requireClient(client).rpc("forum_is_beta_member"),
        "check your closed-beta access",
      ) === true;
    },

    async claimUsername(username) {
      return unwrap(await requireClient(client).rpc("forum_claim_username", {
        p_username: username,
      }), "claim that username");
    },

    async createPost({ topic, title, body }) {
      return unwrap(await requireClient(client).rpc("forum_create_post", {
        p_topic_slug: topic,
        p_title: title,
        p_body: body,
      }), "publish your discussion");
    },

    async createComment({ postId, parentId = null, body }) {
      return unwrap(await requireClient(client).rpc("forum_create_comment", {
        p_post_id: postId,
        p_parent_id: parentId,
        p_body: body,
      }), "publish your answer");
    },

    async castVote({ targetType, targetId, value }) {
      const response = await requireClient(client)
        .rpc("forum_cast_vote", {
          p_target_type: targetType,
          p_target_id: targetId,
          p_value: value,
        })
        .single();
      return unwrap(response, "record your vote");
    },

    async submitReport({ targetType, targetId, reason, note = null }) {
      return unwrap(await requireClient(client).rpc("forum_submit_report", {
        p_target_type: targetType,
        p_target_id: targetId,
        p_reason: reason,
        p_note: note?.trim() || null,
      }), "send your report");
    },

    async listReports({ limit = 100 } = {}) {
      const data = unwrap(await requireClient(client).rpc("forum_admin_list_reports", {
        p_limit: limit,
      }), "load forum reports");
      return Array.isArray(data) ? data : [];
    },

    async moderate({ targetType, targetId, action, reason = null, reportId = null }) {
      return unwrap(await requireClient(client).rpc("forum_admin_moderate", {
        p_target_type: targetType,
        p_target_id: targetId,
        p_action: action,
        p_reason: reason?.trim() || null,
        p_report_id: reportId,
      }), "apply that moderation action");
    },

    async dismissReport({ reportId }) {
      return unwrap(await requireClient(client).rpc("forum_admin_dismiss_report", {
        p_report_id: reportId,
      }), "dismiss that report");
    },

    async listBetaMembers() {
      const data = unwrap(
        await requireClient(client).rpc("forum_admin_list_beta_members"),
        "load closed-beta members",
      );
      return Array.isArray(data) ? data : [];
    },

    async setBetaMember({ username, enabled }) {
      return unwrap(await requireClient(client).rpc("forum_admin_set_beta_member", {
        p_username: username.trim(),
        p_enabled: enabled,
      }), enabled ? "add that beta member" : "remove that beta member");
    },

    async setMode(mode) {
      return unwrap(await requireClient(client).rpc("forum_admin_set_mode", {
        p_mode: mode,
      }), "change the forum mode");
    },
  });
}

export const forumApi = createForumApi();
