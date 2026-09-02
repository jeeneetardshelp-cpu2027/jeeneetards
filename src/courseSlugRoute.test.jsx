// courseSlugRoute.test.jsx — /course/:id/:slug? is ONE route, not two.
//
// Course URLs carry a keyword slug now (/course/398/rectilinear-motion), and
// the edge 308s the bare id to it. That redirect lands on the SAME screen, so
// the router must treat the two shapes as one route: two <Route> declarations
// sharing an element would look identical in a diff and remount
// CourseVideoPage on arrival — throwing away the loaded lessons, the player and
// the student's position in it. The optional segment is what prevents that, and
// nothing in a component test would notice if someone "simplified" it back.
//
// The other half of the contract: the id resolves the course and the slug is
// never read, so a wrong or stale slug still opens the right page.

import { useState } from "react";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, useNavigate, useParams } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";

// A stand-in for CourseVideoPage: it reports the params it was given and, more
// importantly, whether it is the same mounted instance as a moment ago.
const probe = vi.hoisted(() => ({ mounts: 0 }));

vi.mock("./CourseVideoPage.jsx", () => ({
  default: function CourseProbe() {
    const { playlistId, slug, chapterId } = useParams();
    const [instance] = useState(() => (probe.mounts += 1));
    return (
      <div>
        <p data-testid="playlist-id">{playlistId ?? "(none)"}</p>
        <p data-testid="slug">{slug ?? "(none)"}</p>
        <p data-testid="chapter-id">{chapterId ?? "(none)"}</p>
        <p data-testid="instance">{String(instance)}</p>
      </div>
    );
  },
}));

let navigate;

function NavigationHandle() {
  navigate = useNavigate();
  return null;
}

async function openCourse(entry) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
      <NavigationHandle />
    </MemoryRouter>,
  );
  return screen.findByTestId("playlist-id");
}

const text = (id) => screen.getByTestId(id).textContent;

beforeEach(() => {
  probe.mounts = 0;
  window.scrollTo = vi.fn();
});

describe("the course route", () => {
  it("opens the course from the id alone, with no slug", async () => {
    expect((await openCourse("/course/398")).textContent).toBe("398");
    expect(text("slug")).toBe("(none)");
  });

  it("opens the same course from the slugged canonical URL", async () => {
    expect((await openCourse("/course/398/rectilinear-motion-kinematics")).textContent)
      .toBe("398");
    expect(text("slug")).toBe("rectilinear-motion-kinematics");
  });

  // The id decides. A course renamed after a link was shared, or a slug someone
  // typed by hand, must still open the right course rather than 404.
  it.each([
    "/course/398/an-old-title-nobody-uses",
    "/course/398/Rectilinear-Motion-Kinematics",
    "/course/398/x",
  ])("opens the right course from the wrong slug (%s)", async (entry) => {
    expect((await openCourse(entry)).textContent).toBe("398");
  });

  // The reason the route is written with "?" and not as two <Route>s.
  it("keeps the same mounted screen as the slug appears, changes and goes away", async () => {
    await openCourse("/course/398");
    const instance = text("instance");
    expect(probe.mounts).toBe(1);

    for (const path of [
      "/course/398/rectilinear-motion-kinematics", // the edge's 308 target
      "/course/398/an-old-title-nobody-uses", // a stale shared link
      "/course/398", // back to the bare id
    ]) {
      await act(async () => {
        navigate(path);
      });
      expect(text("playlist-id")).toBe("398");
      expect(text("instance")).toBe(instance);
      expect(probe.mounts).toBe(1);
    }
  });

  it("still routes the chapter sub-URL, which keeps the id-only shape", async () => {
    expect((await openCourse("/course/398/chapter/8")).textContent).toBe("398");
    expect(text("chapter-id")).toBe("8");
    expect(text("slug")).toBe("(none)");
  });
});
