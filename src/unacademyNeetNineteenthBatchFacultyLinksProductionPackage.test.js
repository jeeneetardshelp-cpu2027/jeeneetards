import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_nineteenth_batch_faculty_links_2026-08-07.sql";
const readinessPath = "docs/unacademy-neet-nineteenth-batch-faculty-links-readiness-2026-08-07.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "97d5d23937bb7b979aa989aa94e0cf9b3f661b0782a5f168b1a5fc40101825c1";

async function productionShapedDb() {
  const pg = new PGlite();
  await pg.exec(`
    create table public.app_environment (id bigint);
    create table public.playlists (
      id bigint primary key, title text, source_title text, teacher text,
      youtube_playlist_id text, category_id bigint, subject_id bigint,
      class_levels text[], audience_focus text, content_type text, language text,
      difficulty text, channel_id bigint, title_review_status text,
      faculty_credit_status text
    );
    create table public.videos (
      id bigint primary key, youtube_video_id text, chapter_id bigint
    );
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
    insert into public.subjects values (2, 'Chemistry', 'chemistry');
    insert into public.learning_goals values (1, 'jee'), (2, 'neet');
    insert into public.class_levels values
      (1, 'protected'), (2, 'class-11'), (3, 'class-12');
    insert into public.chapters select n from generate_series(1, 263) n;
    insert into public.chapter_class_levels select n, 1 from generate_series(1, 92) n;
    insert into public.videos
    select n, 'video-' || n, null from generate_series(1, 4723) n;
    insert into public.videos values
      (4814, '0BwLckcTdUA', 45), (4815, '3ZlCJ1keY6s', 45),
      (4816, 'MQ-3hQrodgU', 48), (4817, 'I91sc6HdzF0', 48),
      (4818, '5YTW3Cn198A', 48), (4819, 'xpTqTM1fk1c', 29),
      (4820, 'iQ-a7mYRBEk', 29), (4821, '7_lzRbhRJYA', 29);

    insert into public.playlists
    select n, 'Protected ' || n, null, 'Teacher ' || n, 'protected-' || n,
           1, 2, array['11th'], '11th', 'full-course', 'hinglish',
           'intermediate', 1, 'approved', 'identified'
    from generate_series(1, 82) n;
    insert into public.playlists
    select n, 'Filler ' || n, null, 'Teacher', 'filler-' || n,
           1, 2, null, null, 'full-course', 'hinglish',
           'intermediate', 1, 'approved', 'identified'
    from generate_series(500, 830) n;
    insert into public.playlists values
      (433, 'D and F Block Elements - Playlist | Class 12 | Unacademy NEET | NEET Live Daily | NEET Chemistry | Anoop Sir', null, 'Anoop Vashishtha', 'PLsgHooHkqhhNKfP8VeJvlmz5qO-RgNqzQ', 2, 2, array['12th'], '12th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
      (434, 'Amines | Playlist | Class 12 | Unacademy NEET | Live Daily | Chemistry | Anoop SIr', null, 'Anoop Vashishtha', 'PLsgHooHkqhhNPE4mZf-DoUlsANEdkP0ik', 2, 2, array['12th'], '12th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
      (435, 'Thermochemistry - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Tyagi', null, 'Ashwani Tyagi', 'PLsgHooHkqhhMSvDuuO5dL3-iba7hfWB6F', 2, 2, array['11th'], '11th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending');

    insert into public.playlist_learning_goals select n, 1 from generate_series(1, 82) n;
    insert into public.playlist_learning_goals values (433, 2), (434, 2), (435, 2);
    insert into public.playlist_class_levels values (433, 3), (434, 3), (435, 2);
    insert into public.playlist_videos
    select n, 1 + ((n - 1) % 82), 1 + ((n - 1) % 4723),
           1 + ((n - 1) / 82)::int
    from generate_series(1, 1304) n;
    insert into public.playlist_videos
    select n, 500, 1 + ((n - 1) % 4723), n - 1304
    from generate_series(1305, 4729) n;
    insert into public.playlist_videos values
      (5101, 433, 4814, 1), (5102, 433, 4815, 2),
      (5103, 434, 4816, 1), (5104, 434, 4817, 2), (5105, 434, 4818, 3),
      (5106, 435, 4819, 1), (5107, 435, 4820, 2), (5108, 435, 4821, 3);

    insert into public.teachers
    select n, 'Existing ' || n, 'existing ' || n, 'existing-' || n, true
    from generate_series(1, 31) n;
    insert into public.teachers values
      (32, 'Ashwani Tyagi', 'ashwani tyagi', 'ashwani-tyagi', true),
      (33, 'Existing 33', 'existing 33', 'existing-33', true),
      (36, 'Anoop Vashishtha', 'anoop vashishtha', 'anoop-vashishtha', true);
    insert into public.teacher_aliases select n from generate_series(1, 54) n;
    insert into public.teacher_institutes
    select n, n, false from generate_series(1, 31) n;
    insert into public.teacher_institutes values
      (1, 99, false), (2, 98, false), (32, 147, true), (36, 147, true);
    insert into public.teacher_subjects
    select n, 100 + n from generate_series(1, 31) n;
    insert into public.teacher_subjects values
      (1, 999), (2, 998), (32, 2), (36, 2);
    insert into public.teacher_learning_goals
    select n, 1 from generate_series(1, 31) n;
    insert into public.teacher_learning_goals values
      (1, 99), (32, 2), (36, 2);
    insert into public.playlist_teachers
    select 1 + ((n - 1) % 82), 1 + ((n - 1) / 82)::int, 'instructor', 1
    from generate_series(1, 168) n;
    insert into public.playlist_quality_reviews
    select n, 300 + n from generate_series(1, 39) n;
  `);
  return pg;
}

async function protectedFingerprint(pg) {
  return (await pg.query(`
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
}

describe("Unacademy NEET nineteenth-batch faculty-link production package", () => {
  it("pins the exact reviewed sources, identities, and insert-only scope", () => {
    for (const fragment of [
      "e6539ac8-512b-4e76-8bd1-774c1a3c4bdc",
      "PLsgHooHkqhhNKfP8VeJvlmz5qO-RgNqzQ",
      "PLsgHooHkqhhNPE4mZf-DoUlsANEdkP0ik",
      "PLsgHooHkqhhMSvDuuO5dL3-iba7hfWB6F",
      "(433, 36, 'instructor', 1)",
      "(434, 36, 'instructor', 1)",
      "(435, 32, 'instructor', 1)",
      "433:anoop-vashishtha:1",
      "434:anoop-vashishtha:1",
      "435:ashwani-tyagi:1",
      "0BwLckcTdUA",
      "7_lzRbhRJYA",
    ]) expect(sql).toContain(fragment);
    const executable = sql.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:update|delete|alter|drop|truncate)\b/i);
    expect(executable).not.toContain("review_playlist_quality");
    expect(sql.match(/insert into public\./g)).toHaveLength(1);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("pins the exact baseline, expected delta, and protected boundary", () => {
    for (const fragment of [
      "count(*) from public.playlists) <> 416",
      "count(*) from public.videos) <> 4731",
      "count(*) from public.playlist_videos) <> 4737",
      "count(*) from public.chapters) <> 263",
      "count(*) from public.chapter_class_levels) <> 92",
      "count(*) from public.teachers) <> 34",
      "count(*) from public.teacher_aliases) <> 54",
      "count(*) from public.teacher_institutes) <> 35",
      "count(*) from public.teacher_subjects) <> 35",
      "count(*) from public.teacher_learning_goals) <> 34",
      "count(*) from public.playlist_teachers) <> 168",
      "count(*) from public.playlist_teachers) <> 171",
      "count(*) from public.playlist_quality_reviews) <> 39",
    ]) expect(sql).toContain(fragment);
    expect(sql.match(/protected_courses <> 82/g)).toHaveLength(2);
    expect(sql.match(/protected_memberships <> 1304/g)).toHaveLength(2);
    expect(sql.match(/30eee4a4a6842e5beeb7c97083d7f812/g)).toHaveLength(2);
  });

  it("pins the immutable hash and completed production evidence", () => {
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("APPLIED TO PRODUCTION ON 8 AUGUST 2026");
    expect(readiness).toContain("+3 `playlist_teachers` rows only");
    expect(readiness).toContain("from 168 to 171");
    expect(readiness).toContain("82 courses / 1,304 memberships");
    expect(readiness).toContain("2026-08-08T06:00:04.374319Z");
    expect(readiness).toContain("2026-08-08T06:01:24.838299Z");
    expect(readiness).toContain("no `release` push occurred");
    expect(readiness).toContain("Quality review remains a separate gate");
  });

  it("executes atomically and rolls back on baseline drift", async () => {
    const pg = await productionShapedDb();
    const fingerprint = await protectedFingerprint(pg);
    await pg.exec(sql.replaceAll("30eee4a4a6842e5beeb7c97083d7f812", fingerprint));
    expect((await pg.query(`
      select
        (select count(*)::int from public.playlist_teachers) as links,
        (select array_agg(format('%s:%s', pt.playlist_id, t.slug) order by pt.playlist_id)
          from public.playlist_teachers pt join public.teachers t on t.id=pt.teacher_id
          where pt.playlist_id in (433,434,435)) as faculty,
        (select count(*)::int from public.playlist_quality_reviews) as reviews
    `)).rows[0]).toEqual({
      links: 171,
      faculty: ["433:anoop-vashishtha", "434:anoop-vashishtha", "435:ashwani-tyagi"],
      reviews: 39,
    });
    await pg.close();

    const drifted = await productionShapedDb();
    const driftFingerprint = await protectedFingerprint(drifted);
    await drifted.exec("insert into public.chapters values (264)");
    await expect(drifted.exec(sql.replaceAll(
      "30eee4a4a6842e5beeb7c97083d7f812",
      driftFingerprint,
    ))).rejects.toThrow(/exact baseline differs/i);
    await drifted.exec("rollback");
    expect((await drifted.query(
      "select count(*)::int as count from public.playlist_teachers where playlist_id in (433,434,435)",
    )).rows[0].count).toBe(0);
    await drifted.close();
  });
});
