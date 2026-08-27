// ChapterChampions: the pure champion pick, the hook's degrade-to-silence
// contract (missing RPC = the board does not exist), and the board's honesty
// rules — server-gated NULL averages can never produce a champion, and no
// confident dimension means NOTHING renders, not an empty panel.
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args) => rpc(...args) },
}));

import { ThemeProvider } from "./theme.jsx";
import { pickChampion } from "./useChapterChampions.js";
import ChapterChampions from "./ChapterChampions.jsx";

const ROWS = [
  {
    playlist_id: 1, title: "Rotational Motion A", teacher: "Mahendra Singh",
    institute: "Unacademy NEET", clarity_avg: "4.50", clarity_n: 6,
    question_avg: null, question_n: 2,
  },
  {
    playlist_id: 2, title: "Rotational Motion B", teacher: "Mohit Tyagi",
    institute: "Competishun", clarity_avg: null, clarity_n: 2,
    question_avg: "3.80", question_n: 5,
  },
];

const renderBoard = (chapterId = 27) => render(
  <ThemeProvider>
    <MemoryRouter>
      <ChapterChampions chapterId={chapterId} chapterName="Rotational Motion" />
    </MemoryRouter>
  </ThemeProvider>,
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("pickChampion", () => {
  it("picks the highest confident average per dimension", () => {
    expect(pickChampion(ROWS, "clarity")).toMatchObject({ playlist_id: 1, score: 4.5, count: 6 });
    expect(pickChampion(ROWS, "question")).toMatchObject({ playlist_id: 2, score: 3.8, count: 5 });
  });

  it("never crowns a below-floor (NULL-average) dimension", () => {
    expect(pickChampion([ROWS[1]], "clarity")).toBeNull();
    expect(pickChampion([], "clarity")).toBeNull();
    expect(pickChampion(null, "question")).toBeNull();
  });

  it("breaks ties by vote count, then stable id", () => {
    const tied = [
      { playlist_id: 9, clarity_avg: "4.50", clarity_n: 5 },
      { playlist_id: 3, clarity_avg: "4.50", clarity_n: 8 },
    ];
    expect(pickChampion(tied, "clarity").playlist_id).toBe(3);
    const fullyTied = [
      { playlist_id: 9, clarity_avg: "4.50", clarity_n: 5 },
      { playlist_id: 3, clarity_avg: "4.50", clarity_n: 5 },
    ];
    expect(pickChampion(fullyTied, "clarity").playlist_id).toBe(3);
  });
});

describe("ChapterChampions board", () => {
  it("names both champions with confidence-gated scores and deep links", async () => {
    rpc.mockResolvedValue({ data: ROWS, error: null });
    renderBoard();

    expect(await screen.findByText("Chapter champions")).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith("get_chapter_champions", { p_chapter: 27 });
    expect(screen.getByText("Clearest explanations")).toBeTruthy();
    expect(screen.getByText("Rotational Motion A")).toBeTruthy();
    expect(screen.getByText(/4\.5\/5 clarity \(6 ratings\)/)).toBeTruthy();
    expect(screen.getByText("Best question practice")).toBeTruthy();
    expect(screen.getByText(/3\.8\/5 question quality \(5 ratings\)/)).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links[0].getAttribute("href")).toBe("/course/1/chapter/27");
    expect(links[1].getAttribute("href")).toBe("/course/2/chapter/27");
  });

  it("renders nothing while the RPC is not deployed (graceful degrade)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } });
    const { container } = renderBoard();
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(container.querySelector("section")).toBeNull();
  });

  it("renders nothing when no course clears the confidence floor", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const { container } = renderBoard();
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(container.querySelector("section")).toBeNull();
  });

  it("does not call the RPC at all without a real chapter id", async () => {
    const { container } = renderBoard(null);
    expect(rpc).not.toHaveBeenCalled();
    expect(container.querySelector("section")).toBeNull();
  });
});
