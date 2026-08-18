import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_eighteenth_batch_faculty_links_2026-08-07.sql";
const readinessPath = "docs/unacademy-neet-eighteenth-batch-faculty-links-readiness-2026-08-07.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "19ca7904e2816364992a5be9c3a67ec88e2f241048ede9d95a4f230b00d96355";

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
    insert into public.subjects values
      (2, 'Chemistry', 'chemistry'), (4, 'Biology', 'biology');
    insert into public.learning_goals values (1, 'jee'), (2, 'neet');
    insert into public.class_levels values (1, 'protected'), (2, 'class-11');
    insert into public.chapters select n from generate_series(1, 263) n;
    insert into public.chapter_class_levels select n, 1 from generate_series(1, 92) n;
    insert into public.videos
    select n, 'video-' || n, null from generate_series(1, 4705) n;
    insert into public.videos values
      (4796, '5jycoZ1eYKE', 119), (4797, 'XI1FNUWIDvs', 119),
      (4798, 'EhVOh2x8KRU', 119), (4799, 'cmkw7yEt9aM', 38),
      (4800, 'RNOT5OZRsto', 38), (4801, 'rz7hyHgXRng', 38),
      (4802, 'Ef0E436QV_g', 38), (4803, 'P1iYtGppf7w', 38),
      (4804, 'P4XHbcrBsyQ', 38), (4805, 'O_4qhTPCLcI', 38),
      (4806, 'EbAahd3ecJc', 38), (4807, '1u3F_NiQ7WY', 111),
      (4808, 'bzI9ss05Rms', 111), (4809, 'FD-DbUnla_o', 111),
      (4810, 'M_BaySNiTfY', 111), (4811, 'TjuciK33QmU', 111),
      (4812, 'm7KXt6x_-PM', 111), (4813, 'gTlmFUV9mhA', 111);

    insert into public.playlists
    select n, 'Protected ' || n, null, 'Teacher ' || n, 'protected-' || n,
           1, 4, array['11th'], '11th', 'full-course', 'hinglish',
           'intermediate', 1, 'approved', 'identified'
    from generate_series(1, 82) n;
    insert into public.playlists
    select n, 'Filler ' || n, null, 'Teacher', 'filler-' || n,
           1, 4, null, null, 'full-course', 'hinglish',
           'intermediate', 1, 'approved', 'identified'
    from generate_series(500, 827) n;
    insert into public.playlists values
      (430, 'Photosynthesis - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Pradeep Singh', null, 'Pradeep Singh', 'PLsgHooHkqhhOnifSHdglxvopt3ZmRFQ5-', 2, 4, array['11th'], '11th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
      (431, 'Ionic Equilibrium - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Tyagi', null, 'Ashwani Tyagi', 'PLsgHooHkqhhN29ebCtU31NQc4RSZQDJ0z', 2, 2, array['11th'], '11th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
      (432, 'Excretory Products And Their Elimination | Human Physiology - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Dr. Sachin Kapur', null, 'Dr. Sachin Kapur', 'PLsgHooHkqhhPG_PVhW2TE7Ll_Rw2QUdu5', 2, 4, array['11th'], '11th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending');

    insert into public.playlist_learning_goals select n, 1 from generate_series(1, 82) n;
    insert into public.playlist_learning_goals values (430, 2), (431, 2), (432, 2);
    insert into public.playlist_class_levels values (430, 2), (431, 2), (432, 2);
    insert into public.playlist_videos
    select n, 1 + ((n - 1) % 82), 1 + ((n - 1) % 4705),
           1 + ((n - 1) / 82)::int
    from generate_series(1, 1304) n;
    insert into public.playlist_videos
    select n, 500, 1 + ((n - 1) % 4705), n - 1304
    from generate_series(1305, 4711) n;
    insert into public.playlist_videos values
      (5001, 430, 4796, 1), (5002, 430, 4797, 2), (5003, 430, 4798, 3),
      (5004, 431, 4799, 1), (5005, 431, 4800, 2), (5006, 431, 4801, 3),
      (5007, 431, 4802, 4), (5008, 431, 4803, 5), (5009, 431, 4804, 6),
      (5010, 431, 4805, 7), (5011, 431, 4806, 8),
      (5012, 432, 4807, 1), (5013, 432, 4808, 2), (5014, 432, 4809, 3),
      (5015, 432, 4810, 4), (5016, 432, 4811, 5), (5017, 432, 4812, 6),
      (5018, 432, 4813, 7);

    insert into public.teachers
    select n, 'Existing ' || n, 'existing ' || n, 'existing-' || n, true
    from generate_series(1, 31) n;
    insert into public.teachers values
      (32, 'Ashwani Tyagi', 'ashwani tyagi', 'ashwani-tyagi', true),
      (33, 'Pradeep Singh', 'pradeep singh', 'pradeep-singh', true),
      (38, 'Dr. Sachin Kapur', 'sachin kapur', 'sachin-kapur', true);
    insert into public.teacher_aliases select n from generate_series(1, 54) n;
    insert into public.teacher_institutes
    select n, n, false from generate_series(1, 31) n;
    insert into public.teacher_institutes values
      (1, 99, false), (32, 147, true), (33, 147, true), (38, 147, true);
    insert into public.teacher_subjects
    select n, 100 + n from generate_series(1, 31) n;
    insert into public.teacher_subjects values
      (1, 999), (32, 2), (33, 4), (38, 4);
    insert into public.teacher_learning_goals
    select n, 1 from generate_series(1, 31) n;
    insert into public.teacher_learning_goals values (32, 2), (33, 2), (38, 2);
    insert into public.playlist_teachers
    select 1 + ((n - 1) % 82), 1 + ((n - 1) / 82)::int, 'instructor', 1
    from generate_series(1, 165) n;
    insert into public.playlist_quality_reviews
    select n, 300 + n from generate_series(1, 36) n;
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

describe("Unacademy NEET eighteenth-batch faculty-link production package", () => {
  it("pins the reviewed decision, exact sources, teachers, and insert-only scope", () => {
    for (const fragment of [
      "8f19ac66-a1b4-4304-8a6f-468131f63732",
      "PLsgHooHkqhhOnifSHdglxvopt3ZmRFQ5-",
      "PLsgHooHkqhhN29ebCtU31NQc4RSZQDJ0z",
      "PLsgHooHkqhhPG_PVhW2TE7Ll_Rw2QUdu5",
      "(430, 33, 'instructor', 1)",
      "(431, 32, 'instructor', 1)",
      "(432, 38, 'instructor', 1)",
      "430:pradeep-singh:1",
      "431:ashwani-tyagi:1",
      "432:sachin-kapur:1",
      "5jycoZ1eYKE",
      "gTlmFUV9mhA",
    ]) expect(sql).toContain(fragment);
    const executable = sql.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:update|delete|alter|drop|truncate)\b/i);
    expect(executable).not.toContain("review_playlist_quality");
    expect(sql.match(/insert into public\./g)).toHaveLength(1);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("pins the exact baseline, expected delta, and protected JEE boundary", () => {
    for (const fragment of [
      "count(*) from public.playlists) <> 413",
      "count(*) from public.videos) <> 4723",
      "count(*) from public.playlist_videos) <> 4729",
      "count(*) from public.chapters) <> 263",
      "count(*) from public.chapter_class_levels) <> 92",
      "count(*) from public.teachers) <> 34",
      "count(*) from public.teacher_aliases) <> 54",
      "count(*) from public.teacher_institutes) <> 35",
      "count(*) from public.teacher_subjects) <> 35",
      "count(*) from public.teacher_learning_goals) <> 34",
      "count(*) from public.playlist_teachers) <> 165",
      "count(*) from public.playlist_teachers) <> 168",
      "count(*) from public.playlist_quality_reviews) <> 36",
    ]) expect(sql).toContain(fragment);
    expect(sql.match(/protected_courses <> 82/g)).toHaveLength(2);
    expect(sql.match(/protected_memberships <> 1304/g)).toHaveLength(2);
    expect(sql.match(/30eee4a4a6842e5beeb7c97083d7f812/g)).toHaveLength(2);
  });

  it("pins the immutable artifact hash and prepared-only handoff", () => {
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("Applied successfully to production");
    expect(readiness).toContain("+3 `playlist_teachers` rows only");
    expect(readiness).toContain("from 165 to 168");
    expect(readiness).toContain("82 courses / 1,304 memberships");
    expect(readiness).toContain("separate owner approval");
    expect(readiness).toContain("2026-08-07 15:47:52 +05:30");
    expect(readiness).toContain("no `release` push occurred");
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
          where pt.playlist_id in (430,431,432)) as faculty,
        (select count(*)::int from public.playlist_quality_reviews) as reviews
    `)).rows[0]).toEqual({
      links: 168,
      faculty: ["430:pradeep-singh", "431:ashwani-tyagi", "432:sachin-kapur"],
      reviews: 36,
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
      "select count(*)::int as count from public.playlist_teachers where playlist_id in (430,431,432)",
    )).rows[0].count).toBe(0);
    await drifted.close();
  }, 30_000);
});
