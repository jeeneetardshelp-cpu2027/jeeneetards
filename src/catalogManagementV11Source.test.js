import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath = "./src/migrations/catalog_management_v11.sql";
const rollbackPath = "./src/migrations/catalog_management_v11_rollback.sql";
const preflightPath = "./src/migrations/catalog_management_v11_preflight.sql";
const postflightPath = "./src/migrations/catalog_management_v11_postflight.sql";
const SQL = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const ROLLBACK = existsSync(rollbackPath) ? readFileSync(rollbackPath, "utf8") : "";
const PREFLIGHT = existsSync(preflightPath) ? readFileSync(preflightPath, "utf8") : "";
const POSTFLIGHT = existsSync(postflightPath) ? readFileSync(postflightPath, "utf8") : "";

const functionBody = (name) => {
  const start = SQL.indexOf(`function public.${name}`);
  const next = SQL.indexOf("create or replace function", start + 1);
  return start < 0 ? "" : SQL.slice(start, next < 0 ? SQL.length : next);
};

describe("catalog management v11 source contract", () => {
  it("ships a migration and a data-preserving rollback", () => {
    expect(SQL.length).toBeGreaterThan(1000);
    expect(ROLLBACK.length).toBeGreaterThan(200);
    expect(ROLLBACK).not.toMatch(/\b(?:delete\s+from|truncate)\b/i);
    expect(ROLLBACK).not.toMatch(/drop\s+table\s+(?:if\s+exists\s+)?public\.catalog_management_audit/i);
  });

  it("keeps the preflight read-only and checks the required schema", () => {
    expect(PREFLIGHT).toContain("to_regclass('public.playlists')");
    expect(PREFLIGHT).toContain("to_regprocedure('public.is_admin()')");
    expect(PREFLIGHT).not.toMatch(
      /\b(?:insert|update|delete|alter|create|drop|truncate|grant|revoke)\b/i,
    );
  });

  it("checks every management entry point after the owner-run migration", () => {
    for (const name of [
      "catalog_manage_capability",
      "get_manage_playlists",
      "update_managed_playlist",
      "set_managed_video_taxonomy",
      "clear_managed_video_taxonomy",
      "reassign_video_chapter",
      "delete_managed_playlist",
    ]) {
      expect(POSTFLIGHT).toContain(name);
    }
    expect(POSTFLIGHT).toContain("anon_cannot_call_capability");
    expect(POSTFLIGHT).toContain("audit_rls_enabled");
  });

  it("keeps the list bounded and returns an exact total", () => {
    const body = functionBody("get_manage_playlists");
    expect(body).toContain("p_limit int default 20");
    expect(body).toContain("p_offset int default 0");
    expect(body).toContain("p_limit > 100");
    expect(body).toContain("count(*) over()");
    expect(body).toContain("order by p.display_order, p.id");
  });

  it("replaces playlist metadata and taxonomy inside one guarded function", () => {
    const body = functionBody("update_managed_playlist");
    expect(body).toContain("for update");
    expect(body).toContain("expected title does not match");
    expect(body).toContain("delete from public.playlist_learning_goals");
    expect(body).toContain("delete from public.playlist_class_levels");
    expect(body).toContain("insert into public.catalog_management_audit");
    expect(body).toContain("'update-playlist'");
  });

  it("guards chapter reassignment against subject drift and shared-video surprises", () => {
    const body = functionBody("reassign_video_chapter");
    expect(body).toContain("chapter subject does not match video subject");
    expect(body).toContain("video is shared by");
    expect(body).toContain("p_allow_shared boolean default false");
    expect(body).toContain("'reassign-video-chapter'");
  });

  it("makes per-video taxonomy replacement explicit and recoverable", () => {
    const setBody = functionBody("set_managed_video_taxonomy");
    const clearBody = functionBody("clear_managed_video_taxonomy");
    expect(setBody).toContain("delete from public.video_learning_goals");
    expect(setBody).toContain("delete from public.video_class_levels");
    expect(setBody).toContain("'set-video-taxonomy'");
    expect(setBody).toContain("video is shared by");
    expect(clearBody).toContain("'clear-video-taxonomy'");
  });

  it("deletes only the requested playlist after recording its recoverable state", () => {
    const body = functionBody("delete_managed_playlist");
    expect(body).toContain("expected title does not match");
    expect(body).toContain("'delete-playlist'");
    expect(body).toContain("delete from public.playlists");
    expect(body).not.toContain("delete from public.videos");
  });

  it("makes every browser entry point admin-only", () => {
    for (const name of [
      "catalog_manage_capability",
      "get_manage_playlists",
      "update_managed_playlist",
      "set_managed_video_taxonomy",
      "clear_managed_video_taxonomy",
      "reassign_video_chapter",
      "delete_managed_playlist",
    ]) {
      const body = functionBody(name);
      expect(body).toContain("public.is_admin()");
      expect(body).toContain("raise exception 'not authorized'");
      expect(SQL).toContain(`revoke all on function public.${name}`);
      expect(SQL).toContain(`grant execute on function public.${name}`);
    }
  });
});
