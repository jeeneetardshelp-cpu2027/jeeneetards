import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_eighth_batch_faculty_links_2026-08-05.sql";
const readinessPath = "docs/unacademy-neet-eighth-batch-faculty-links-readiness-2026-08-05.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "e886e190f0adaa2cc9779551de383b972b20616ab170f21fe0a16b7496964a3f";

describe("Unacademy NEET eighth-batch faculty-link production package", () => {
  it("pins the owner decision and exact three reviewed links", () => {
    expect(sql).toContain("809b153c-b5ff-48e0-a869-02faa49b0e8f");
    for (const fragment of [
      "(405, 36, 'instructor', 1)",
      "(406, 33, 'instructor', 1)",
      "(407, 33, 'instructor', 1)",
      "PLsgHooHkqhhPnLRiFEOjuIGraO0odfi1I",
      "PLsgHooHkqhhNW-QJ3H58FESiVXdxHYoqw",
      "PLsgHooHkqhhOO8a8vMQLe_CVVzttQd_Dh",
    ]) expect(sql).toContain(fragment);
  });

  it("is insert-only and keeps quality review separate", () => {
    const executable = sql.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:update|delete|alter|drop|truncate)\b/i);
    expect(executable).not.toContain("review_playlist_quality");
    expect(sql.match(/insert into public\./g)).toHaveLength(1);
    expect(sql).toContain("quality review appeared");
    expect(sql).toContain("changed quality review state");
  });

  it("pins the exact baseline, postflight, and protected JEE boundary", () => {
    for (const fragment of [
      "count(*) from public.playlists) <> 388",
      "count(*) from public.videos) <> 4539",
      "count(*) from public.playlist_videos) <> 4545",
      "count(*) from public.chapters) <> 247",
      "count(*) from public.teachers) <> 32",
      "count(*) from public.teacher_aliases) <> 50",
      "count(*) from public.playlist_teachers) <> 140",
      "count(*) from public.playlist_teachers) <> 143",
      "count(*) from public.playlist_quality_reviews) <> 11",
    ]) expect(sql).toContain(fragment);
    expect(sql.match(/protected_courses <> 82/g)).toHaveLength(2);
    expect(sql.match(/protected_memberships <> 1304/g)).toHaveLength(2);
    expect(sql.match(/30eee4a4a6842e5beeb7c97083d7f812/g)).toHaveLength(2);
  });

  it("pins the immutable hash and completed production handoff", () => {
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("Applied successfully to production project");
    expect(readiness).toContain("05 Aug 2026, 02:17:04");
    expect(readiness).toContain("140 course links / 11 quality reviews");
    expect(readiness).toContain("+3 `playlist_teachers` rows only");
    expect(readiness).toContain("143 course links");
    expect(readiness).toContain("30eee4a4a6842e5beeb7c97083d7f812");
  });

  it("executes atomically against a production-shaped local rehearsal", async () => {
    const pg = new PGlite();
    await pg.exec(`
      create table public.app_environment (id bigint);
      create table public.playlists (
        id bigint primary key, title text, teacher text, youtube_playlist_id text,
        category_id bigint, subject_id bigint, class_levels text[], audience_focus text,
        content_type text, language text, difficulty text, channel_id bigint,
        title_review_status text, faculty_credit_status text
      );
      create table public.videos (id bigint primary key);
      create table public.playlist_videos (
        id bigint primary key, playlist_id bigint, video_id bigint, position int
      );
      create table public.chapters (id bigint primary key);
      create table public.chapter_class_levels (chapter_id bigint, class_level_id bigint);
      create table public.institutes_channels (
        id bigint primary key, name text, youtube_channel_id text
      );
      create table public.subjects (id bigint primary key, name text, slug text);
      create table public.learning_goals (id bigint primary key, slug text);
      create table public.class_levels (id bigint primary key, slug text);
      create table public.playlist_learning_goals (playlist_id bigint, learning_goal_id bigint);
      create table public.playlist_class_levels (playlist_id bigint, class_level_id bigint);
      create table public.teachers (
        id bigint primary key, display_name text, canonical_name text,
        slug text unique, verified boolean
      );
      create table public.teacher_aliases (id bigint primary key);
      create table public.teacher_institutes (
        teacher_id bigint, institute_id bigint, is_primary boolean,
        primary key (teacher_id, institute_id)
      );
      create table public.teacher_subjects (
        teacher_id bigint, subject_id bigint, primary key (teacher_id, subject_id)
      );
      create table public.teacher_learning_goals (
        teacher_id bigint, learning_goal_id bigint,
        primary key (teacher_id, learning_goal_id)
      );
      create table public.playlist_teachers (
        playlist_id bigint, teacher_id bigint, role text, position int,
        primary key (playlist_id, teacher_id)
      );
      create table public.playlist_quality_reviews (id bigint, playlist_id bigint);

      insert into public.institutes_channels values
        (147, 'Unacademy NEET', 'UCdQwYksctqqiRwqp3PiJMWA');
      insert into public.subjects values
        (2, 'Chemistry', 'chemistry'), (4, 'Biology', 'biology');
      insert into public.learning_goals values (1, 'jee'), (2, 'neet');
      insert into public.class_levels values
        (1, 'protected'), (2, 'class-11'), (3, 'class-12');
      insert into public.chapters select n from generate_series(1, 247) n;
      insert into public.chapter_class_levels select n, 1 from generate_series(1, 92) n;
      insert into public.videos select n from generate_series(1, 4539) n;

      insert into public.playlists
      select n, 'Protected ' || n, 'Teacher ' || n, 'protected-' || n,
             1, 2, array['11th'], '11th', 'full-course', 'hinglish',
             'intermediate', 1, 'approved', 'identified'
      from generate_series(1, 82) n;
      insert into public.playlists
      select n, 'Filler ' || n, 'Teacher', 'filler-' || n,
             1, 2, null, null, 'full-course', 'hinglish',
             'intermediate', 1, 'approved', 'identified'
      from generate_series(500, 802) n;
      insert into public.playlists values
        (405, 'Redox Reactions | Class 11 | Unacademy NEET | Anoop Vashishtha', 'Anoop Vashishtha', 'PLsgHooHkqhhPnLRiFEOjuIGraO0odfi1I', 2, 2, array['11th'], '11th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
        (406, 'NEET: Cell Organelles Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | Pradeep Singh', 'Pradeep Singh', 'PLsgHooHkqhhNW-QJ3H58FESiVXdxHYoqw', 2, 4, array['11th'], '11th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
        (407, 'NEET: Molecular Basis of Inheritance - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh', 'Pradeep Singh', 'PLsgHooHkqhhOO8a8vMQLe_CVVzttQd_Dh', 2, 4, array['12th'], '12th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending');

      insert into public.playlist_learning_goals select n, 1 from generate_series(1, 82) n;
      insert into public.playlist_learning_goals values (405, 2), (406, 2), (407, 2);
      insert into public.playlist_class_levels values (405, 2), (406, 2), (407, 3);
      insert into public.playlist_videos
      select n, 1 + ((n - 1) % 82), 1 + ((n - 1) % 4539),
             1 + ((n - 1) / 82)::int
      from generate_series(1, 1304) n;
      insert into public.playlist_videos
      select n, 405, n, n - 1304 from generate_series(1305, 1311) n;
      insert into public.playlist_videos
      select n, 406, n, n - 1311 from generate_series(1312, 1320) n;
      insert into public.playlist_videos
      select n, 407, n, n - 1320 from generate_series(1321, 1329) n;
      insert into public.playlist_videos
      select n, 500, 1 + ((n - 1) % 4539), n - 1329
      from generate_series(1330, 4545) n;

      insert into public.teachers
      select n, 'Existing ' || n, 'existing ' || n, 'existing-' || n, true
      from generate_series(1, 30) n;
      insert into public.teachers values
        (33, 'Pradeep Singh', 'pradeep singh', 'pradeep-singh', true),
        (36, 'Anoop Vashishtha', 'anoop vashishtha', 'anoop-vashishtha', true);
      insert into public.teacher_aliases select n from generate_series(1, 50) n;
      insert into public.teacher_institutes
      select 1 + ((n - 1) % 30), n, false from generate_series(1, 31) n;
      insert into public.teacher_institutes values (33, 147, true), (36, 147, true);
      insert into public.teacher_subjects
      select 1 + ((n - 1) % 30), n from generate_series(1, 31) n;
      insert into public.teacher_subjects values (33, 4), (36, 2);
      insert into public.teacher_learning_goals select n, 1 from generate_series(1, 30) n;
      insert into public.teacher_learning_goals values (33, 2), (36, 2);
      insert into public.playlist_teachers
      select 1 + ((n - 1) % 82), 1 + ((n - 1) / 82)::int,
             'instructor', 1
      from generate_series(1, 140) n;
      insert into public.playlist_quality_reviews
      select n, 300 + n from generate_series(1, 11) n;
    `);

    const fingerprint = (await pg.query(`
      select md5(
        coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
          select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
                 p.subject_id, p.class_levels, p.audience_focus, p.content_type,
                 p.language, p.difficulty
          from public.playlists p
          join public.playlist_learning_goals plg on plg.playlist_id = p.id
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where lg.slug = 'jee' and p.id < 167
        ) x), '') || '|' ||
        coalesce((select string_agg(row_to_json(y)::text, '|'
                                    order by y.playlist_id, y.position, y.id) from (
          select pv.id, pv.playlist_id, pv.video_id, pv.position
          from public.playlist_videos pv
          join public.playlists p on p.id = pv.playlist_id
          where p.id < 167 and exists (
            select 1 from public.playlist_learning_goals plg
            join public.learning_goals lg on lg.id = plg.learning_goal_id
            where plg.playlist_id = p.id and lg.slug = 'jee'
          )
        ) y), '')
      ) as fingerprint
    `)).rows[0].fingerprint;

    await pg.exec(sql.replaceAll("30eee4a4a6842e5beeb7c97083d7f812", fingerprint));

    const result = (await pg.query(`
      select
        (select count(*)::int from public.playlist_teachers) as course_links,
        (select array_agg(t.slug order by pt.playlist_id)
           from public.playlist_teachers pt
           join public.teachers t on t.id = pt.teacher_id
          where pt.playlist_id in (405, 406, 407)) as linked_slugs,
        (select count(*)::int from public.playlists) as playlists,
        (select count(*)::int from public.playlist_videos) as memberships,
        (select count(*)::int from public.playlist_quality_reviews) as reviews
    `)).rows[0];
    expect(result).toEqual({
      course_links: 143,
      linked_slugs: ["anoop-vashishtha", "pradeep-singh", "pradeep-singh"],
      playlists: 388,
      memberships: 4545,
      reviews: 11,
    });
    await pg.close();
  });
});
