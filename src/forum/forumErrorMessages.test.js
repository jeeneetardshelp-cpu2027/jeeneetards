import { describe, expect, it } from "vitest";
import { forumContributionError } from "./forumErrorMessages.js";

describe("forum contribution errors", () => {
  it("maps claim collisions and reserved names without exposing database detail", () => {
    expect(forumContributionError({ code: "23505" }, "claim this username")).toMatch(/already taken/i);
    expect(forumContributionError({ code: "22023" }, "claim this username")).toMatch(/3–30/);
  });

  it("states that drafts survive cooldown, mode and network failures", () => {
    for (const error of [
      { code: "P0001", cause: { message: "new accounts can contribute after 10 minutes" } },
      { code: "55000", cause: { message: "forum is not open" } },
      { cause: { message: "Failed to fetch" } },
    ]) expect(forumContributionError(error)).toMatch(/draft/i);
  });
});
