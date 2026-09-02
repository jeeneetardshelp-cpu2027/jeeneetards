import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_sixth_seventh_batch_faculty_links_2026-08-04.sql";
const readinessPath = "docs/unacademy-neet-sixth-seventh-batch-faculty-links-readiness-2026-08-04.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "895cecede28139d452181e5b92172bec41344a5062a0b84ee912c8a60fb91e53";

describe("Unacademy NEET sixth/seventh-batch faculty-link production package", () => {
  it("pins both owner decisions and all five reviewed links", () => {
    expect(sql).toContain("1d0ea7b9-8cac-4f3b-968d-82b4307f264a");
    expect(sql).toContain("cf45d7d5-43ef-4311-abd7-5297ec2ea3b6");
    for (const fragment of [
      "(400, 36, 'instructor', 1)",
      "(401, 35, 'instructor', 1)",
      "(402, 33, 'instructor', 1)",
      "(403, 33, 'instructor', 1)",
      "(404, 33, 'instructor', 1)",
      "PLsgHooHkqhhP65sAqtkbWpVVSrK7FlTWA",
      "PLsgHooHkqhhMeV7vEcqRc91GnmR15_eHw",
    ]) expect(sql).toContain(fragment);
  });

  it("is insert-only and keeps quality review separate", () => {
    const executable = sql.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:update|delete|alter|drop|truncate)\b/i);
    expect(executable).not.toContain("review_playlist_quality");
    expect(sql.match(/insert into public\./g)).toHaveLength(1);
    expect(sql).toContain("title_review_status <> 'pending'");
    expect(sql).toContain("faculty_credit_status <> 'pending'");
  });

  it("pins the exact baseline, postflight, and protected JEE boundary", () => {
    for (const fragment of [
      "count(*) from public.playlists) <> 385",
      "count(*) from public.videos) <> 4514",
      "count(*) from public.playlist_videos) <> 4520",
      "count(*) from public.chapters) <> 247",
      "count(*) from public.teachers) <> 32",
      "count(*) from public.teacher_aliases) <> 50",
      "count(*) from public.playlist_teachers) <> 135",
      "count(*) from public.playlist_teachers) <> 140",
    ]) expect(sql).toContain(fragment);
    expect(sql.match(/protected_courses <> 82/g)).toHaveLength(2);
    expect(sql.match(/protected_memberships <> 1304/g)).toHaveLength(2);
    expect(sql.match(/30eee4a4a6842e5beeb7c97083d7f812/g)).toHaveLength(2);
  });

  it("pins the immutable artifact hash and prepared-only handoff", () => {
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("Applied successfully to production");
    expect(readiness).toContain("+5 course-teacher links only");
    expect(readiness).toContain("140 course links");
    expect(readiness).toContain("04 Aug 2026, 18:52:29 IST");
    expect(readiness).toContain("400 → Anoop Vashishtha");
    expect(readiness).toContain("402 / 403 / 404 → Pradeep Singh");
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

      insert into public.institutes_channels values
        (147, 'Unacademy NEET', 'UCdQwYksctqqiRwqp3PiJMWA');
      insert into public.subjects values
        (1, 'Physics', 'physics'), (2, 'Chemistry', 'chemistry'),
        (4, 'Biology', 'biology');
      insert into public.learning_goals values (1, 'jee'), (2, 'neet');
      insert into public.class_levels values
        (1, 'protected'), (2, 'class-11'), (3, 'class-12');
      insert into public.chapters select n from generate_series(1, 247) n;
      insert into public.chapter_class_levels select n, 1 from generate_series(1, 92) n;
      insert into public.videos select n from generate_series(1, 4514) n;

      insert into public.playlists
      select n, 'Protected ' || n, 'Teacher ' || n, 'protected-' || n,
             1, 1, array['11th'], '11th', 'full-course', 'hinglish',
             'intermediate', 1, 'approved', 'identified'
      from generate_series(1, 82) n;
      insert into public.playlists
      select n, 'Filler ' || n, 'Teacher', 'filler-' || n,
             1, 1, null, null, 'full-course', 'hinglish',
             'intermediate', 1, 'approved', 'identified'
      from generate_series(500, 797) n;
      insert into public.playlists values
        (400, 'NEET: Hydrogen | Class 11 | Unacademy NEET | Anoop V.', 'Anoop Vashishtha', 'PLsgHooHkqhhP65sAqtkbWpVVSrK7FlTWA', 2, 2, array['11th'], '11th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
        (401, 'NEET: Modern Physics | Class 12 | Live Daily 2.0 | Unacademy NEET | Anu Gupta', 'Anu Gupta', 'PLsgHooHkqhhMQWo55rneDci-gmYynS9Za', 2, 1, array['12th'], '12th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
        (402, 'NEET: Biodiversity & Conservation | LIVE Daily 2.0 | Unacademy NEET | Pradeep Singh', 'Pradeep Singh', 'PLsgHooHkqhhOLWySbDetaU3Z-KiEBLE63', 2, 4, array['12th'], '12th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
        (403, 'NEET: Cell Cycle & Cell Division | Class 11 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir', 'Pradeep Singh', 'PLsgHooHkqhhMbUvz0HhRZwLrpa4--2M1F', 2, 4, array['11th'], '11th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
        (404, 'NEET: Microbes in Human Welfare | Class 12 | Unacademy NEET | Pradeep Singh', 'Pradeep Singh', 'PLsgHooHkqhhMeV7vEcqRc91GnmR15_eHw', 2, 4, array['12th'], '12th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending');

      insert into public.playlist_learning_goals select n, 1 from generate_series(1, 82) n;
      insert into public.playlist_learning_goals values
        (400, 2), (401, 2), (402, 2), (403, 2), (404, 2);
      insert into public.playlist_class_levels values
        (400, 2), (401, 3), (402, 3), (403, 2), (404, 3);
      insert into public.playlist_videos
      select n, 1 + ((n - 1) % 82), 1 + ((n - 1) % 4514),
             1 + ((n - 1) / 82)::int
      from generate_series(1, 1304) n;
      insert into public.playlist_videos
      select n, 400, n, n - 1304 from generate_series(1305, 1310) n;
      insert into public.playlist_videos
      select n, 401, n, n - 1310 from generate_series(1311, 1321) n;
      insert into public.playlist_videos
      select n, 402, n, n - 1321 from generate_series(1322, 1326) n;
      insert into public.playlist_videos
      select n, 403, n, n - 1326 from generate_series(1327, 1333) n;
      insert into public.playlist_videos
      select n, 404, n, n - 1333 from generate_series(1334, 1337) n;
      insert into public.playlist_videos
      select n, 500, 1 + ((n - 1) % 4514), n - 1337
      from generate_series(1338, 4520) n;

      insert into public.teachers
      select n, 'Existing ' || n, 'existing ' || n, 'existing-' || n, true
      from generate_series(1, 29) n;
      insert into public.teachers values
        (33, 'Pradeep Singh', 'pradeep singh', 'pradeep-singh', true),
        (35, 'Anu Gupta', 'anu gupta', 'anu-gupta', true),
        (36, 'Anoop Vashishtha', 'anoop vashishtha', 'anoop-vashishtha', true);
      insert into public.teacher_aliases select n from generate_series(1, 50) n;
      insert into public.teacher_institutes
      select 1 + ((n - 1) % 29), n, false from generate_series(1, 30) n;
      insert into public.teacher_institutes values
        (33, 147, true), (35, 147, true), (36, 147, true);
      insert into public.teacher_subjects
      select 1 + ((n - 1) % 29), n from generate_series(1, 30) n;
      insert into public.teacher_subjects values (33, 4), (35, 1), (36, 2);
      insert into public.teacher_learning_goals
      select n, 1 from generate_series(1, 29) n;
      insert into public.teacher_learning_goals values (33, 2), (35, 2), (36, 2);
      insert into public.playlist_teachers
      select 1 + ((n - 1) % 82), 1 + ((n - 1) / 82)::int,
             'instructor', 1
      from generate_series(1, 135) n;
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
          where pt.playlist_id in (400, 401, 402, 403, 404)) as linked_slugs,
        (select count(*)::int from public.playlists) as playlists,
        (select count(*)::int from public.playlist_videos) as memberships
    `)).rows[0];
    expect(result).toEqual({
      course_links: 140,
      linked_slugs: [
        "anoop-vashishtha",
        "anu-gupta",
        "pradeep-singh",
        "pradeep-singh",
        "pradeep-singh",
      ],
      playlists: 385,
      memberships: 4520,
    });
    await pg.close();
  });
});
