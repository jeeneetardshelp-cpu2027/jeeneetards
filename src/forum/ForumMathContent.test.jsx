import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import ForumMathContent from "./ForumMathContent.jsx";

const renderMath = (source) => render(
  <ThemeProvider><ForumMathContent>{source}</ForumMathContent></ThemeProvider>,
);

describe("ForumMathContent", () => {
  it("renders single-line display maths as a display block", () => {
    const { container } = renderMath("A result:\n\n$$\\int_0^1 x^2\\,dx$$");
    expect(container.querySelectorAll(".katex-display").length).toBe(1);
  });

  it("keeps raw script and event-handler HTML visible without creating executable nodes", () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const source = '<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">';
    const { container } = renderMath(source);

    expect(container.textContent).toContain("<script>alert(1)</script>");
    expect(container.textContent).toContain('<img src=x onerror="alert(2)">');
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it("adds safe external-link attributes and blocks dangerous URLs", () => {
    const { container } = renderMath("[notes](https://example.com) [bad](javascript:alert(1))");
    const links = [...container.querySelectorAll("a")];
    expect(links[0].getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links.some((link) => link.getAttribute("href")?.startsWith("javascript:"))).toBe(false);
  });

  it("keeps the source contract free of raw-HTML plugins and direct HTML injection", () => {
    const source = readFileSync("src/forum/ForumMathContent.jsx", "utf8");
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    expect(source).not.toMatch(/import\s+\w+\s+from\s+["']rehype-raw["']/);
    expect(packageJson.dependencies?.["rehype-raw"]).toBeUndefined();
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toContain("dark:");
  });
});

// A Markdown <img> loads automatically for every reader of a page that
// anonymous minors can read and Google indexes. The renderer used to accept any
// host whose protocol was http(s), so one invited poster could show arbitrary
// third-party imagery to children and harvest every reader's IP and user-agent.
describe("images may only come from approved hosts", () => {
  it("renders a picture from an approved host", () => {
    const { container } = renderMath("![diagram](https://upload.wikimedia.org/w/lens.png)");
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("https://upload.wikimedia.org/w/lens.png");
  });

  it("drops a picture from any other host", () => {
    const { container } = renderMath("![x](https://tracker.example.com/pixel.png)");
    expect(container.querySelector("img")).toBeNull();
    // Nothing is loaded from that origin at all.
    expect(container.innerHTML).not.toContain("tracker.example.com");
  });

  it("still leaves LINKS to any host alone", () => {
    // A link is a choice the reader makes, and carries noopener/nofollow — the
    // restriction is about what loads automatically, not about what may be cited.
    const { container } = renderMath("[a source](https://example.com/article)");
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://example.com/article");
    expect(a?.getAttribute("rel")).toContain("nofollow");
  });
});
