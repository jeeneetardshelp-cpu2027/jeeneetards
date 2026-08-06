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
  });
}

export const forumApi = createForumApi();
