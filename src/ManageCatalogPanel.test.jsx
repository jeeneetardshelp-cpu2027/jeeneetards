import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "./theme.jsx";

const rpc = vi.fn();

vi.mock("./supabaseClient.js", () => ({
  supabase: { rpc: (...args) => rpc(...args) },
}));

import ManageCatalogPanel from "./ManageCatalogPanel.jsx";

const PLAYLIST = {
  total_count: 21,
  playlist_id: 8,
  title: "Newton's Laws of Motion",
  teacher: "ABJ Sir",
  youtube_playlist_id: "PL-example",
  channel_id: 3,
  channel_name: "Competishun",
  category_id: 1,
  category_name: "JEE",
  subject_id: 1,
  subject_name: "Physics",
  content_type: "full-course",
  language: "hinglish",
  difficulty: "advanced",
  audience_focus: "11th",
  display_order: 40,
  learning_goal_ids: [1],
  class_level_ids: [11],
  videos: [{
    membership_id: 66,
    position: 1,
    video_id: 31,
    title: "1 Laws of Motion",
    youtube_video_id: "Ay16fKvzP1Q",
    chapter_id: 6,
    chapter_name: "Newton's Laws of Motion",
    shared_playlist_count: 1,
    learning_goal_ids: [1],
    class_level_ids: [11],
  }],
};

const props = {
  channels: [{ id: 3, name: "Competishun" }],
  learningGoals: [{ id: 1, name: "JEE", slug: "jee" }],
  classLevelRows: [
    { id: 11, slug: "class-11" },
    { id: 12, slug: "class-12" },
  ],
  chapters: [
    { id: 6, name: "Newton's Laws of Motion", subject_id: 1 },
    { id: 22, name: "Friction", subject_id: 1 },
  ],
};

const renderPanel = () => render(
  <ThemeProvider>
    <ManageCatalogPanel {...props} />
  </ThemeProvider>,
);

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockImplementation(async (name) => {
    if (name === "catalog_manage_capability") {
      return { data: { version: 11 }, error: null };
    }
    if (name === "get_manage_playlists") {
      return { data: [PLAYLIST], error: null };
    }
    return { data: {}, error: null };
  });
});

describe("ManageCatalogPanel", () => {
  it("corrects playlist language through the guarded RPC", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", {
      name: /Edit Newton's Laws of Motion/i,
    }));

    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "english" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save playlist changes" }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith(
      "update_managed_playlist",
      {
        p_playlist_id: 8,
        p_expected_title: "Newton's Laws of Motion",
        p_title: "Newton's Laws of Motion",
        p_teacher: "ABJ Sir",
        p_channel_id: 3,
        p_learning_goal_ids: [1],
        p_class_level_ids: [11],
        p_content_type: "full-course",
        p_language: "english",
        p_difficulty: "advanced",
        p_audience_focus: "11th",
      },
    ));
  });

  it("corrects playlist class levels through the guarded RPC", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", {
      name: /Edit Newton's Laws of Motion/i,
    }));

    fireEvent.click(screen.getByRole("checkbox", {
      name: "Class levels: Class 12",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Save playlist changes" }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith(
      "update_managed_playlist",
      expect.objectContaining({
        p_playlist_id: 8,
        p_class_level_ids: [11, 12],
      }),
    ));
  });

  it("reassigns one video chapter with its current chapter as a guard", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", {
      name: /Edit Newton's Laws of Motion/i,
    }));

    fireEvent.change(screen.getByLabelText("Chapter for 1 Laws of Motion"), {
      target: { value: "22" },
    });
    fireEvent.click(screen.getByRole("button", {
      name: "Save chapter for 1 Laws of Motion",
    }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith(
      "reassign_video_chapter",
      {
        p_playlist_id: 8,
        p_video_id: 31,
        p_chapter_id: 22,
        p_expected_current_chapter_id: 6,
        p_allow_shared: false,
      },
    ));
  });

  it("uses bounded pagination from the database result count", async () => {
    renderPanel();
    await screen.findByText("21 playlists");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith(
      "get_manage_playlists",
      { p_search: "", p_limit: 10, p_offset: 10 },
    ));
  });

  it("requires an explicit acknowledgement before changing a shared video", async () => {
    const shared = {
      ...PLAYLIST,
      videos: [{ ...PLAYLIST.videos[0], shared_playlist_count: 2 }],
    };
    rpc.mockImplementation(async (name) => {
      if (name === "catalog_manage_capability") {
        return { data: { version: 11 }, error: null };
      }
      if (name === "get_manage_playlists") {
        return { data: [shared], error: null };
      }
      return { data: {}, error: null };
    });

    renderPanel();
    fireEvent.click(await screen.findByRole("button", {
      name: /Edit Newton's Laws of Motion/i,
    }));

    const save = screen.getByRole("button", {
      name: "Save chapter for 1 Laws of Motion",
    });
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", {
      name: /I understand this changes 2 playlists/i,
    }));
    expect(save.disabled).toBe(false);
  });

  it("updates one video's taxonomy through the guarded RPC", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", {
      name: /Edit Newton's Laws of Motion/i,
    }));

    fireEvent.click(screen.getByRole("checkbox", {
      name: "Video class levels: Class 12",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Save video taxonomy" }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith(
      "set_managed_video_taxonomy",
      {
        p_playlist_id: 8,
        p_video_id: 31,
        p_learning_goal_ids: [1],
        p_class_level_ids: [11, 12],
        p_allow_shared: false,
      },
    ));
  });

  it("keeps deletion disabled until the exact current title is entered", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", {
      name: /Edit Newton's Laws of Motion/i,
    }));

    const remove = screen.getByRole("button", { name: "Delete playlist" });
    expect(remove.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Type the exact playlist title"), {
      target: { value: "Newton's Laws of Motion" },
    });
    expect(remove.disabled).toBe(false);
    fireEvent.click(remove);

    await waitFor(() => expect(rpc).toHaveBeenCalledWith(
      "delete_managed_playlist",
      {
        p_playlist_id: 8,
        p_expected_title: "Newton's Laws of Motion",
      },
    ));
  });
});
