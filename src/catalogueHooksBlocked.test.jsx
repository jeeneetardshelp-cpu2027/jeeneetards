// useVideos and usePlaylistBrowse — the `blocked` contract, at the hook.
//
// browseGateHeldBack.test.jsx pins what /browse RENDERS when the lookup that
// gates the catalogue fails. That is not enough on its own: BrowsePage also
// guards its lecture view on the same flag, so a hook that went back to
// answering every closed gate with loading:true would still pass there, and
// any other consumer (PlaylistBrowse's count line, the mobile Show button,
// useChapterMetadata) would be back to waiting for an answer that is never
// coming. Measured, not assumed: reverting useVideos' closed-gate branch to
// loading:true left every lectures-tab case in that file green.
//
// So the contract is pinned here, directly:
//
//   enabled:false                 a prerequisite is still resolving — loading
//   enabled:false, blocked:true   a prerequisite FAILED — not loading, no count,
//                                 no error of its own, and no request
//   gate reopens                  the database is asked again

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const calls = [];
const ok = () => Promise.resolve({ data: [], error: null, count: 0 });

function builder() {
  const b = {
    select: () => b, order: () => b, limit: () => b, range: () => b,
    eq: () => b, in: () => b, ilike: () => b, or: () => b, not: () => b,
    then: (resolve, reject) => ok().then(resolve, reject),
  };
  return b;
}

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table) => { calls.push(table); return builder(); },
    rpc: (name) => { calls.push(name); return ok(); },
  },
}));

import { useVideos } from "./useBrowse.js";
import { usePlaylistBrowse } from "./usePlaylistBrowse.js";

// Long enough for a mount effect and any request it might wrongly issue.
const settle = () => new Promise((r) => setTimeout(r, 30));

beforeEach(() => { calls.length = 0; });

describe.each([
  ["useVideos", (props) => useVideos(props), "videos"],
  ["usePlaylistBrowse", (props) => usePlaylistBrowse(props), "playlists"],
])("%s tells a pending gate from a blocked one", (_name, useCatalogue, table) => {
  it("keeps loading while a prerequisite is still resolving, and asks nothing", async () => {
    const { result } = renderHook(() => useCatalogue({ enabled: false }));
    await settle();

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("stops loading once a prerequisite has failed, inventing no count and no error", async () => {
    const { result } = renderHook(() => useCatalogue({ enabled: false, blocked: true }));
    await settle();

    expect(result.current.loading).toBe(false);
    // null, not 0: nothing was counted
    expect(result.current.total).toBeNull();
    // the failure belongs to the caller's prerequisite, which already shows it
    expect(result.current.error).toBeNull();
    // being blocked is not a reason to ask
    expect(calls).toHaveLength(0);
  });

  it("asks the database again as soon as the gate opens", async () => {
    const { result, rerender } = renderHook(
      (props) => useCatalogue(props),
      { initialProps: { enabled: false, blocked: true } },
    );
    await settle();
    expect(result.current.loading).toBe(false);
    expect(calls).toHaveLength(0);

    rerender({ enabled: true, blocked: false });

    await waitFor(() => expect(calls).toContain(table));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.total).toBe(0);
  });
});
