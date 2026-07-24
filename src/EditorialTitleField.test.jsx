import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EditorialTitleField from "./EditorialTitleField.jsx";
import { ThemeProvider } from "./theme.jsx";

function renderField(overrides = {}) {
  const props = {
    sourceTitle: "newton's laws of motion",
    value: "newton's laws of motion",
    onChange: vi.fn(),
    reviewed: false,
    onReviewedChange: vi.fn(),
    ...overrides,
  };
  render(<ThemeProvider><EditorialTitleField {...props} /></ThemeProvider>);
  return props;
}

describe("EditorialTitleField", () => {
  it("keeps the original title visible and offers a non-destructive suggestion", () => {
    const props = renderField();
    expect(screen.getByText("newton's laws of motion")).toBeTruthy();
    expect(screen.getByText("Newton's Laws of Motion")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use suggestion" }));
    expect(props.onChange).toHaveBeenCalledWith("Newton's Laws of Motion");
    expect(props.onReviewedChange).toHaveBeenCalledWith(false);
  });

  it("invalidates approval whenever the curator edits the title", () => {
    const props = renderField({ reviewed: true });
    fireEvent.change(screen.getByPlaceholderText("Complete Kinematics"), {
      target: { value: "Kinematics" },
    });
    expect(props.onChange).toHaveBeenCalledWith("Kinematics");
    expect(props.onReviewedChange).toHaveBeenCalledWith(false);
  });

  it("blocks approval for a title longer than the editorial limit", () => {
    renderField({ sourceTitle: "", value: "x".repeat(91) });
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.disabled).toBe(true);
    expect(screen.getByText(/under 90 characters/i)).toBeTruthy();
  });
});

