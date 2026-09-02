import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_fifteenth_batch_faculty_links_2026-08-06.sql";
const readinessPath = "docs/unacademy-neet-fifteenth-batch-faculty-links-readiness-2026-08-06.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "ff4e0f24415700351319dd61520d9c2bf086dd94f73727a985b9cfc8568cae25";

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
    create table public.videos (id bigint primary key, chapter_id bigint);
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
      (1, 'Physics', 'physics'), (2, 'Chemistry', 'chemistry');
    insert into public.learning_goals values (1, 'jee'), (2, 'neet');
    insert into public.class_levels values
      (1, 'protected'), (2, 'class-11'), (3, 'class-12');
    insert into public.chapters select n from generate_series(1, 263) n;
    insert into public.chapter_class_levels select n, 1 from generate_series(1, 92) n;
    insert into public.videos select n, null from generate_series(1, 4683) n;

    insert into public.playlists
    select n, 'Protected ' || n, null, 'Teacher ' || n, 'protected-' || n,
           1, 1, array['11th'], '11th', 'full-course', 'hinglish',
           'intermediate', 1, 'approved', 'identified'
    from generate_series(1, 82) n;
    insert into public.playlists
    select n, 'Filler ' || n, null, 'Teacher', 'filler-' || n,
           1, 1, null, null, 'full-course', 'hinglish',
           'intermediate', 1, 'approved', 'identified'
    from generate_series(500, 820) n;
    insert into public.playlists values
      (423, 'NEET: Alcohols, Phenols & Ethers | Class 12 | Unacademy NEET | Anoop V.', null, 'Anoop Vashishtha', 'PLsgHooHkqhhNnQ7F6-Wfril1wn1_JrWNP', 2, 2, array['12th'], '12th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
      (424, 'Fluid Mechanics -  Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh', null, 'Mahendra Singh', 'PLsgHooHkqhhMMPfEYr7m_ofP61K_YScyw', 2, 1, array['11th'], '11th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
      (425, 'Kinematics 1D -  Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh', null, 'Mahendra Singh', 'PLsgHooHkqhhM5m3xbTdZ2cDX8S_22jdSX', 2, 1, array['11th'], '11th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending');

    insert into public.playlist_learning_goals select n, 1 from generate_series(1, 82) n;
    insert into public.playlist_learning_goals values (423, 2), (424, 2), (425, 2);
    insert into public.playlist_class_levels values (423, 3), (424, 2), (425, 2);
    insert into public.playlist_videos
    select n, 1 + ((n - 1) % 82), 1 + ((n - 1) % 4630),
           1 + ((n - 1) / 82)::int
    from generate_series(1, 1304) n;
    update public.videos set chapter_id = 92 where id between 1305 and 1315;
    update public.videos set chapter_id = 26 where id between 1316 and 1326;
    update public.videos set chapter_id = 1 where id between 1327 and 1332;
    insert into public.playlist_videos
    select n, 423, n, n - 1304 from generate_series(1305, 1315) n;
    insert into public.playlist_videos
    select n, 424, n, n - 1315 from generate_series(1316, 1326) n;
    insert into public.playlist_videos
    select n, 425, n, n - 1326 from generate_series(1327, 1332) n;
    insert into public.playlist_videos
    select n, 500, 1 + ((n - 1) % 4683), n - 1332
    from generate_series(1333, 4689) n;

    insert into public.teachers
    select n, 'Existing ' || n, 'existing ' || n, 'existing-' || n, true
    from generate_series(1, 30) n;
    insert into public.teachers values
      (34, 'Mahendra Singh', 'mahendra singh', 'mahendra-singh', true),
      (36, 'Anoop Vashishtha', 'anoop vashishtha', 'anoop-vashishtha', true);
    insert into public.teacher_aliases select n from generate_series(1, 50) n;
    insert into public.teacher_institutes
    select 1 + ((n - 1) % 30), n, false from generate_series(1, 31) n;
    insert into public.teacher_institutes values (34, 147, true), (36, 147, true);
    insert into public.teacher_subjects
    select 1 + ((n - 1) % 30), n from generate_series(1, 31) n;
    insert into public.teacher_subjects values (34, 1), (36, 2);
    insert into public.teacher_learning_goals
    select n, 1 from generate_series(1, 30) n;
    insert into public.teacher_learning_goals values (34, 2), (36, 2);
    insert into public.playlist_teachers
    select 1 + ((n - 1) % 82), 1 + ((n - 1) / 82)::int, 'instructor', 1
    from generate_series(1, 158) n;
    insert into public.playlist_quality_reviews
    select n, 300 + n from generate_series(1, 29) n;
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

describe("Unacademy NEET fifteenth-batch faculty-link production package", () => {
  it("pins decisions, sources, teachers, and insert-only scope", () => {
    for (const fragment of [
      "5b4b1d41-b7dc-4f12-80cf-b490e72edd96",
      "1412ca96-56dc-47ef-8bc0-18ce97f7dfb6",
      "PLsgHooHkqhhNnQ7F6-Wfril1wn1_JrWNP",
      "PLsgHooHkqhhMMPfEYr7m_ofP61K_YScyw",
      "PLsgHooHkqhhM5m3xbTdZ2cDX8S_22jdSX",
      "(423, 36, 'instructor', 1)",
      "(424, 34, 'instructor', 1)",
      "(425, 34, 'instructor', 1)",
      "423:anoop-vashishtha:1",
      "424:mahendra-singh:1",
      "425:mahendra-singh:1",
    ]) expect(sql).toContain(fragment);
    const executable = sql.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:update|delete|alter|drop|truncate)\b/i);
    expect(executable).not.toContain("review_playlist_quality");
    expect(sql.match(/insert into public\./g)).toHaveLength(1);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("pins exact baseline, delta, and protected JEE boundary", () => {
    for (const fragment of [
      "count(*) from public.playlists) <> 406",
      "count(*) from public.videos) <> 4683",
      "count(*) from public.playlist_videos) <> 4689",
      "count(*) from public.chapters) <> 263",
      "count(*) from public.chapter_class_levels) <> 92",
      "count(*) from public.teachers) <> 32",
      "count(*) from public.teacher_aliases) <> 50",
      "count(*) from public.teacher_institutes) <> 33",
      "count(*) from public.teacher_subjects) <> 33",
      "count(*) from public.teacher_learning_goals) <> 32",
      "count(*) from public.playlist_teachers) <> 158",
      "count(*) from public.playlist_teachers) <> 161",
      "count(*) from public.playlist_quality_reviews) <> 29",
    ]) expect(sql).toContain(fragment);
    expect(sql.match(/protected_courses <> 82/g)).toHaveLength(2);
    expect(sql.match(/protected_memberships <> 1304/g)).toHaveLength(2);
    expect(sql.match(/30eee4a4a6842e5beeb7c97083d7f812/g)).toHaveLength(2);
  });

  it("pins the immutable hash and prepared-only handoff", () => {
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("Prepared and locally rehearsed only");
    expect(readiness).toContain("+3 `playlist_teachers` rows only");
    expect(readiness).toContain("161 course links");
    expect(readiness).toContain("separate owner approval");
    expect(readiness).toContain("no production SQL or `release` push occurred");
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
          where pt.playlist_id in (423,424,425)) as faculty,
        (select count(*)::int from public.playlist_quality_reviews) as reviews
    `)).rows[0]).toEqual({
      links: 161,
      faculty: ["423:anoop-vashishtha", "424:mahendra-singh", "425:mahendra-singh"],
      reviews: 29,
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
      "select count(*)::int as count from public.playlist_teachers where playlist_id in (423,424,425)",
    )).rows[0].count).toBe(0);
    await drifted.close();
  });
});
