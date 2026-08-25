import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const calls = [];
const rpcCalls = [];
let response;
let rpcResponse;

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
  supabase: {
    from: (table) => builder(table),
    rpc: (name, args) => { rpcCalls.push({ name, args }); return Promise.resolve(rpcResponse); },
  },
}));

import { LECTURE_PAGE_SIZE, useVideos } from "./useBrowse.js";

let seen;
function Probe(props) {
  seen = useVideos(props);
  return null;
}

beforeEach(() => {
  calls.length = 0;
  rpcCalls.length = 0;
  seen = undefined;
  response = { data: [], error: null, count: 0 };
  rpcResponse = { data: [], error: null };
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
    expect(calls[0].cols).toContain("institutes_channels(id, name, logo_url)");
  });

  it("applies goal, subject, chapter in PostgREST and search through the id RPC", async () => {
    // Search no longer runs a single-column title ILIKE. The trimmed term goes
    // to search_video_ids (the homepage matcher), and its ids intersect the
    // filtered query via .in("id", ...).
    rpcResponse = { data: [{ id: 9 }, { id: 42 }], error: null };
    render(<Probe goalId={1} subjectId={2} chapterId={3} search="  vectors  " />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].cols).toContain("video_learning_goals!inner");
    expect(calls[0].eq).toEqual({
      "video_learning_goals.learning_goal_id": 1,
      subject_id: 2,
      chapter_id: 3,
    });
    expect(rpcCalls).toEqual([{ name: "search_video_ids", args: { p_query: "vectors" } }]);
    expect(calls[0].in.id).toEqual([9, 42]);
    expect(calls[0].ilike).toBeNull();
  });

  it("returns an empty page without a catalogue query when nothing matches", async () => {
    rpcResponse = { data: [], error: null };
    render(<Probe search="qwertyzxcv" />);
    await waitFor(() => expect(seen.loading).toBe(false));
    // The match RPC ran; the main videos query did not (an empty .in() or a
    // dropped filter would wrongly show the whole catalogue).
    expect(rpcCalls).toEqual([{ name: "search_video_ids", args: { p_query: "qwertyzxcv" } }]);
    expect(calls).toHaveLength(0);
    expect(seen.total).toBe(0);
    expect(seen.videos).toEqual([]);
  });

  it("does not call the search RPC when the box is empty", async () => {
    render(<Probe search="   " />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(rpcCalls).toHaveLength(0);
    expect(calls[0].ilike).toBeNull();
  });

  it("falls back to the old ILIKE when the match function is not deployed", async () => {
    // Deploy-order safety: if the frontend ships before the SQL, the RPC 404s
    // (PGRST202) and lecture search must still work via the single-column match.
    rpcResponse = { data: null, error: { code: "PGRST202", message: "Could not find the function public.search_video_ids" } };
    render(<Probe search="vectors" />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(rpcCalls).toEqual([{ name: "search_video_ids", args: { p_query: "vectors" } }]);
    expect(calls[0].ilike).toEqual(["title", "%vectors%"]);
    expect(calls[0].in.id).toBeUndefined();
    expect(seen.error).toBeNull();
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

  it("uses reviewed chapter scope instead of playlist audience tags", async () => {
    render(<Probe
      stage="class-12" chapterId={20} chapterClassSlugs={["class-12"]}
    />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].cols).not.toContain("playlist_class_levels!inner");
    expect(calls[0].in["membership.playlists.pcl.class_levels.slug"]).toBeUndefined();
    expect(calls[0].eq.chapter_id).toBe(20);
  });

  it("returns zero without querying for a reviewed cross-class mismatch", async () => {
    render(<Probe
      stage="class-11" chapterId={20} chapterClassSlugs={["class-12"]}
    />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(calls).toHaveLength(0);
    expect(seen.total).toBe(0);
    expect(seen.videos).toEqual([]);
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
        institutes_channels: {
          id: 8,
          name: "Institute",
          logo_url: "https://yt3.ggpht.com/institute=s88",
        },
        subjects: { name: "Physics" }, chapters: { name: "Vectors" },
      }],
      error: null,
      count: LECTURE_PAGE_SIZE + 1,
    };
    render(<Probe page={0} />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(seen.total).toBe(LECTURE_PAGE_SIZE + 1);
    expect(seen.hasMore).toBe(true);
    expect(seen.videos[0]).toMatchObject({
      id: 9,
      youtubeVideoId: "abc",
      chapter: "Vectors",
      instituteId: 8,
      instituteLogoUrl: "https://yt3.ggpht.com/institute=s88",
    });
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
