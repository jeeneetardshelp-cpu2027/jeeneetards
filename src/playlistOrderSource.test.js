import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("./src/migrations/playlist_order_v10.sql", "utf8");
const schema = readFileSync("./community_schema.sql", "utf8");

describe("playlist curriculum ordering source", () => {
  it("puts future uncurated courses after deliberately ordered courses", () => {
    expect(migration).toContain(
      "alter column display_order set default 1000000",
    );
    expect(migration).toMatch(
      /set display_order = 1000000\s+where display_order = 0/i,
    );
    expect(schema).toMatch(
      /display_order\s+int\s+not null default 1000000/i,
    );
  });
});
