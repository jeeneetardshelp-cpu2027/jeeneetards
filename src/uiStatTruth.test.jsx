import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import { Stat } from "./ui.jsx";

afterEach(cleanup);

describe("Stat measurement truth", () => {
  it("renders a known count immediately instead of an observer-dependent zero", () => {
    render(
      <MemoryRouter>
        <Stat
          value={522}
          label="Free courses"
          note="Curriculum-tagged"
          to="/browse"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("522")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByRole("link", { name: "522 Free courses. Curriculum-tagged" })).toBeTruthy();
  });

  it("fails closed instead of turning an invalid measurement into zero", () => {
    render(<Stat value="unknown" label="Courses" />);

    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });
});
