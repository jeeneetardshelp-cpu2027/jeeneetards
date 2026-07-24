import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const calls = [];
let response;

function builder(table) {
  const rec = { table, cols: null, opts: null, eq: {}, in: {}, range: null, ilike: null };
  calls.push(rec);
  const b = {
    select(cols, opts) { rec.cols = cols; rec.opts = opts; return b; },
    order() { return b; },
    range(a, z) { rec.range = [a, z]; return b; },
    eq(k, v) { rec.eq[k] = v; return b; },
    in(k, v) { rec.in[k] = v; return b; },
    ilike(k, v) { rec.ilike = [k, v]; return b; },
    then(resolve) { return Promise.resolve(response).then(resolve); },
  };
  return b;
}

vi.mock("./supabaseClient.js", () => ({
  isSupabaseConfigured: true,
  supabase: { from: (table) => builder(table) },
}));

import { LECTURE_PAGE_SIZE, useVideos } from "./useBrowse.js";

let seen;
function Probe(props) {
  seen = useVideos(props);
  return null;
}

beforeEach(() => {
  calls.length = 0;
  seen = undefined;
  response = { data: [], error: null, count: 0 };
});

describe("paged lecture discovery", () => {
  it("issues no request while disabled", async () => {
    render(<Probe enabled={false} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toHaveLength(0);
    expect(seen.loading).toBe(true);
  });

  it("requests exactly one stable page with an exact count", async () => {
    render(<Probe page={7} />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].opts).toEqual({ count: "exact" });
    expect(calls[0].range).toEqual([
      7 * LECTURE_PAGE_SIZE,
      8 * LECTURE_PAGE_SIZE - 1,
    ]);
    expect(calls[0].cols).toContain("youtube_video_id");
  });

  it("applies goal, subject, chapter, and search in PostgREST", async () => {
    render(<Probe goalId={1} subjectId={2} chapterId={3} search="  vectors  " />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].cols).toContain("video_learning_goals!inner");
    expect(calls[0].eq).toEqual({
      "video_learning_goals.learning_goal_id": 1,
      subject_id: 2,
      chapter_id: 3,
    });
    expect(calls[0].ilike).toEqual(["title", "%vectors%"]);
  });

  it("does not display URL filters that the lecture query ignores", async () => {
    render(<Probe
      stage="dropper" channelId="8"
      language={["hindi"]} contentType={["revision"]} difficulty={["advanced"]}
    />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].cols).toContain("playlist_class_levels!inner");
    expect(calls[0].cols).toContain("playlist_videos!inner");
    expect(calls[0].eq.channel_id).toBe("8");
    expect(calls[0].in).toEqual({
      "membership.playlists.pcl.class_levels.slug": ["dropper", "class-11", "class-12"],
      "membership.playlists.language": ["hindi"],
      "membership.playlists.content_type": ["revision"],
      "membership.playlists.difficulty": ["advanced"],
    });
  });

  it("filters lectures through faculty-linked playlists before paging", async () => {
    render(<Probe teacherId="7" />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].cols).toContain("playlist_teachers!inner");
    expect(calls[0].eq["membership.playlists.pt.teacher_id"]).toBe("7");
    expect(calls[0].range).toEqual([0, LECTURE_PAGE_SIZE - 1]);
  });

  it("reports totals and whether another page exists", async () => {
    response = {
      data: [{
        id: 9, youtube_video_id: "abc", title: "Vectors",
        institutes_channels: { name: "Institute" },
        subjects: { name: "Physics" }, chapters: { name: "Vectors" },
      }],
      error: null,
      count: LECTURE_PAGE_SIZE + 1,
    };
    render(<Probe page={0} />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(seen.total).toBe(LECTURE_PAGE_SIZE + 1);
    expect(seen.hasMore).toBe(true);
    expect(seen.videos[0]).toMatchObject({ id: 9, youtubeVideoId: "abc", chapter: "Vectors" });
  });

  it("treats a stale out-of-range URL as an empty page, not an outage", async () => {
    response = {
      data: null, count: 5,
      error: { code: "PGRST103", message: "Requested range not satisfiable" },
    };
    render(<Probe page={99} />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(seen.error).toBeNull();
    expect(seen.videos).toEqual([]);
    expect(seen.hasMore).toBe(false);
  });
});
