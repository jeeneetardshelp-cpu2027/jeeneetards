// Rehearse the faculty-link package on a real Postgres engine.
//
// The file writes to production, so "it looks right" is not a standard. This
// boots an in-memory Postgres, builds the smallest world the package touches,
// runs the migration VERBATIM from disk, and then tries to break it: a course
// re-credited since the measurement, a teacher who lost verification, a
// registry id that moved, and a course somebody already curated by hand.
//
// The guards matter more than the happy path. Ten links is a small win; the
// cost of getting it wrong is a wrong person's name on somebody's course.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const SQL = readFileSync(
  join(import.meta.dirname, "../supabase/migrations/20260902200000_link_verified_faculty_credits.sql"),
  "utf8",
);

// The ten pairs the package claims, kept here independently so a silent edit
// to the migration shows up as a failure rather than as agreement.
const EXPECTED = [
  [146, 21, "Sudhanshu Kumar"],
  [391, 33, "Pradeep Singh"],
  [392, 33, "Pradeep Singh"],
  [393, 34, "Mahendra Singh"],
  [394, 37, "Seep Pahuja"],
  [395, 38, "Dr. Sachin Kapur"],
  [396, 32, "Ashwani Tyagi"],
  [397, 33, "Pradeep Singh"],
  [398, 34, "Mahendra Singh"],
  [399, 35, "Anu Gupta"],
];

// Only what the package reads or writes: the two tables, the junction, and
// the entry point it calls. set_playlist_teachers is copied from the
// production baseline so this rehearses the real invariants (it clears the
// course's links first, then numbers them instructor / co-instructor).
const WORLD = `
create schema if not exists auth;
create or replace function auth.role() returns text language sql stable as $fn$ select 'service_role'::text $fn$;
create or replace function public.is_admin() returns boolean language sql stable as $fn$ select true $fn$;

create table public.teachers (
  id bigint primary key,
  display_name text not null,
  verified boolean not null default false
);
create table public.playlists (
  id bigint primary key,
  title text not null,
  teacher text,
  faculty_credit_status text not null default 'pending'
    check (faculty_credit_status in ('pending','identified','team','unknown'))
);
create table public.playlist_teachers (
  playlist_id bigint not null references public.playlists(id),
  teacher_id  bigint not null references public.teachers(id),
  role text not null default 'instructor',
  position int not null default 1,
  primary key (playlist_id, teacher_id)
);

create or replace function public.set_playlist_teachers(p_playlist_id bigint, p_teacher_ids bigint[])
returns jsonb language plpgsql security definer as $fn$
declare v_id bigint; v_pos int := 0; v_bad bigint[];
begin
  if p_teacher_ids is null then
    raise exception 'set_playlist_teachers requires an array'; end if;
  if not exists (select 1 from public.playlists where id = p_playlist_id) then
    raise exception 'invalid playlist_id %', p_playlist_id; end if;
  select array_agg(x) into v_bad from unnest(p_teacher_ids) x
   where not exists (select 1 from public.teachers t where t.id = x);
  if v_bad is not null then
    raise exception 'unknown teacher_id(s) %', v_bad; end if;
  delete from public.playlist_teachers where playlist_id = p_playlist_id;
  foreach v_id in array p_teacher_ids loop
    v_pos := v_pos + 1;
    insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
    values (p_playlist_id, v_id, case when v_pos = 1 then 'instructor' else 'co-instructor' end, v_pos);
  end loop;
  return jsonb_build_object('playlist_id', p_playlist_id, 'teachers', v_pos);
end $fn$;
`;

const seed = async (pg) => {
  const teachers = [...new Map(EXPECTED.map(([, id, name]) => [id, name])).entries()];
  for (const [id, name] of teachers) {
    await pg.query("insert into public.teachers (id, display_name, verified) values ($1, $2, true)", [id, name]);
  }
  for (const [playlist, , name] of EXPECTED) {
    await pg.query(
      "insert into public.playlists (id, title, teacher) values ($1, $2, $3)",
      [playlist, `Course ${playlist}`, name],
    );
  }
  // A course outside the package, to prove it is not touched.
  await pg.query("insert into public.playlists (id, title, teacher) values (900, 'Untouched', 'Competishun+')");
};

let pg;
beforeEach(async () => {
  pg = new PGlite();
  await pg.exec(WORLD);
  await seed(pg);
});

describe("the package applies", () => {
  it("links exactly the ten courses to exactly the named teachers", async () => {
    await pg.exec(SQL);
    const { rows } = await pg.query(
      "select playlist_id, teacher_id from public.playlist_teachers order by playlist_id",
    );
    expect(rows.map((r) => [Number(r.playlist_id), Number(r.teacher_id)]))
      .toEqual(EXPECTED.map(([p, t]) => [p, t]));
  });

  it("credits each as the instructor, through the real entry point", async () => {
    await pg.exec(SQL);
    const { rows } = await pg.query("select distinct role, position from public.playlist_teachers");
    expect(rows).toEqual([{ role: "instructor", position: 1 }]);
  });

  it("leaves faculty_credit_status alone — an automatic match is not a human review", async () => {
    await pg.exec(SQL);
    const { rows } = await pg.query(
      "select count(*)::int as n from public.playlists where faculty_credit_status <> 'pending'",
    );
    expect(rows[0].n).toBe(0);
  });

  it("touches no course outside the ten", async () => {
    await pg.exec(SQL);
    const { rows } = await pg.query(
      "select count(*)::int as n from public.playlist_teachers where playlist_id = 900",
    );
    expect(rows[0].n).toBe(0);
  });

  it("is rerunnable", async () => {
    await pg.exec(SQL);
    await pg.exec(SQL);
    const { rows } = await pg.query("select count(*)::int as n from public.playlist_teachers");
    expect(rows[0].n).toBe(EXPECTED.length);
  });
});

describe("the package refuses to guess", () => {
  it("stops if a course has been re-credited since the measurement", async () => {
    await pg.query("update public.playlists set teacher = 'Somebody Else' where id = 391");
    await expect(pg.exec(SQL)).rejects.toThrow(/now credits/i);
    // The raise aborts the transaction but never reaches the file's own
    // COMMIT, so the block is still open and every later statement is refused
    // until it is ended. Ending it is what proves nothing was kept: 146 was
    // linked before the loop reached the re-credited 391.
    await pg.exec("rollback");
    const { rows } = await pg.query("select count(*)::int as n from public.playlist_teachers");
    expect(rows[0].n).toBe(0);
  });

  it("stops if a teacher lost verification", async () => {
    await pg.query("update public.teachers set verified = false where id = 33");
    await expect(pg.exec(SQL)).rejects.toThrow(/no longer verified/i);
  });

  it("stops if a registry id no longer carries that name", async () => {
    await pg.query("update public.teachers set display_name = 'Renamed Person' where id = 34");
    await expect(pg.exec(SQL)).rejects.toThrow(/no longer id/i);
  });

  it("stops if a course has vanished", async () => {
    await pg.query("delete from public.playlists where id = 399");
    await expect(pg.exec(SQL)).rejects.toThrow(/no teacher text|does not exist/i);
  });

  it("tolerates a difference in spacing, which is not a re-credit", async () => {
    await pg.query("update public.playlists set teacher = '  Pradeep   Singh ' where id = 392");
    await pg.exec(SQL);
    const { rows } = await pg.query(
      "select teacher_id from public.playlist_teachers where playlist_id = 392",
    );
    expect(Number(rows[0].teacher_id)).toBe(33);
  });
});

describe("a credit somebody already curated is left alone", () => {
  it("does not overwrite a hand-made link, and still commits the rest", async () => {
    // The case the skip exists for: a human credited 395 to two people.
    await pg.query("insert into public.teachers (id, display_name, verified) values (77, 'Pushpendu Sir', true)");
    await pg.query(
      "insert into public.playlist_teachers (playlist_id, teacher_id, role, position) values (395, 38, 'instructor', 1), (395, 77, 'co-instructor', 2)",
    );

    await pg.exec(SQL);

    const { rows } = await pg.query(
      "select teacher_id from public.playlist_teachers where playlist_id = 395 order by position",
    );
    expect(rows.map((r) => Number(r.teacher_id))).toEqual([38, 77]);
    const { rows: all } = await pg.query("select count(*)::int as n from public.playlist_teachers");
    expect(all[0].n).toBe(EXPECTED.length + 1);
  });
});
