import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_seventeenth_batch_faculty_link_2026-08-07.sql";
const readinessPath = "docs/unacademy-neet-seventeenth-batch-faculty-link-readiness-2026-08-07.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "ce929bae2520cdc379acef0d25dffa2199e285fa14ad233968783abd1533d895";

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
    insert into public.subjects values (4, 'Biology', 'biology');
    insert into public.learning_goals values (1, 'jee'), (2, 'neet');
    insert into public.class_levels values (1, 'protected'), (2, 'class-11');
    insert into public.chapters select n from generate_series(1, 263) n;
    insert into public.chapter_class_levels select n, 1 from generate_series(1, 92) n;
    insert into public.videos
    select n, 'video-' || n, null from generate_series(1, 4699) n;
    insert into public.videos values
      (4790, 'bmF2tmenuMI', 105),
      (4791, 'fG72ty2A2tg', 105),
      (4792, 'at_rKPlIXoo', 105),
      (4793, '5Jls9m-jDjM', 105),
      (4794, 'Ev3t9nip0PU', 105),
      (4795, 'zNpJSgVOR1M', 105);

    insert into public.playlists
    select n, 'Protected ' || n, null, 'Teacher ' || n, 'protected-' || n,
           1, 4, array['11th'], '11th', 'full-course', 'hinglish',
           'intermediate', 1, 'approved', 'identified'
    from generate_series(1, 82) n;
    insert into public.playlists
    select n, 'Filler ' || n, null, 'Teacher', 'filler-' || n,
           1, 4, null, null, 'full-course', 'hinglish',
           'intermediate', 1, 'approved', 'identified'
    from generate_series(500, 826) n;
    insert into public.playlists values
      (429, 'NEET: Breathing & Exchange of Gases - Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Dr Sachin Kapur', null, 'Dr. Sachin Kapur', 'PLsgHooHkqhhMpUzdl2c1YMGYdrTxCCXFe', 2, 4, array['11th'], '11th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending');

    insert into public.playlist_learning_goals select n, 1 from generate_series(1, 82) n;
    insert into public.playlist_learning_goals values (429, 2);
    insert into public.playlist_class_levels values (429, 2);
    insert into public.playlist_videos
    select n, 1 + ((n - 1) % 82), 1 + ((n - 1) % 4699),
           1 + ((n - 1) / 82)::int
    from generate_series(1, 1304) n;
    insert into public.playlist_videos values
      (4841, 429, 4790, 1), (4842, 429, 4791, 2),
      (4843, 429, 4792, 3), (4844, 429, 4793, 4),
      (4845, 429, 4794, 5), (4846, 429, 4795, 6);
    insert into public.playlist_videos
    select n, 500, 1 + ((n - 1) % 4699), n - 1304
    from generate_series(1305, 4705) n;

    insert into public.teachers
    select n, 'Existing ' || n, 'existing ' || n, 'existing-' || n, true
    from generate_series(1, 33) n;
    insert into public.teachers values
      (38, 'Dr. Sachin Kapur', 'sachin kapur', 'sachin-kapur', true);
    insert into public.teacher_aliases select n from generate_series(1, 54) n;
    insert into public.teacher_institutes
    select 1 + ((n - 1) % 33), n, false from generate_series(1, 34) n;
    insert into public.teacher_institutes values (38, 147, true);
    insert into public.teacher_subjects
    select 1 + ((n - 1) % 33), n from generate_series(1, 34) n;
    insert into public.teacher_subjects values (38, 4);
    insert into public.teacher_learning_goals
    select n, 1 from generate_series(1, 33) n;
    insert into public.teacher_learning_goals values (38, 2);
    insert into public.playlist_teachers
    select 1 + ((n - 1) % 82), 1 + ((n - 1) / 82)::int, 'instructor', 1
    from generate_series(1, 164) n;
    insert into public.playlist_quality_reviews
    select n, 300 + n from generate_series(1, 35) n;
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

describe("Unacademy NEET seventeenth-batch faculty-link production package", () => {
  it("pins the reviewed decision, exact source, teacher, and insert-only scope", () => {
    for (const fragment of [
      "ae4a8549-84d5-4784-91ed-2f56e4208d88",
      "PLsgHooHkqhhMpUzdl2c1YMGYdrTxCCXFe",
      "values (429, 38, 'instructor', 1)",
      "429:sachin-kapur:1",
      "bmF2tmenuMI",
      "zNpJSgVOR1M",
    ]) expect(sql).toContain(fragment);
    const executable = sql.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:update|delete|alter|drop|truncate)\b/i);
    expect(executable).not.toContain("review_playlist_quality");
    expect(sql.match(/insert into public\./g)).toHaveLength(1);
    expect(sql).toContain("begin;");
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("pins the exact baseline, expected delta, and protected JEE boundary", () => {
    for (const fragment of [
      "count(*) from public.playlists) <> 410",
      "count(*) from public.videos) <> 4705",
      "count(*) from public.playlist_videos) <> 4711",
      "count(*) from public.chapters) <> 263",
      "count(*) from public.chapter_class_levels) <> 92",
      "count(*) from public.teachers) <> 34",
      "count(*) from public.teacher_aliases) <> 54",
      "count(*) from public.teacher_institutes) <> 35",
      "count(*) from public.teacher_subjects) <> 35",
      "count(*) from public.teacher_learning_goals) <> 34",
      "count(*) from public.playlist_teachers) <> 164",
      "count(*) from public.playlist_teachers) <> 165",
      "count(*) from public.playlist_quality_reviews) <> 35",
    ]) expect(sql).toContain(fragment);
    expect(sql.match(/protected_courses <> 82/g)).toHaveLength(2);
    expect(sql.match(/protected_memberships <> 1304/g)).toHaveLength(2);
    expect(sql.match(/30eee4a4a6842e5beeb7c97083d7f812/g)).toHaveLength(2);
  });

  it("pins the immutable artifact hash and audited production handoff", () => {
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("Applied successfully to production");
    expect(readiness).toContain("2026-08-07 13:07:47 +05:30");
    expect(readiness).toContain("course `429` -> teacher `38`");
    expect(readiness).toContain("+1 `playlist_teachers` row only");
    expect(readiness).toContain("165 course links");
    expect(readiness).toContain("separate owner approval");
    expect(readiness).toContain("no `release` push occurred");
  });

  it("executes atomically and rolls back on baseline drift", async () => {
    const pg = await productionShapedDb();
    const fingerprint = await protectedFingerprint(pg);
    await pg.exec(sql.replaceAll("30eee4a4a6842e5beeb7c97083d7f812", fingerprint));
    expect((await pg.query(`
      select
        (select count(*)::int from public.playlist_teachers) as links,
        (select array_agg(t.slug order by pt.position)
          from public.playlist_teachers pt join public.teachers t on t.id=pt.teacher_id
          where pt.playlist_id = 429) as slugs,
        (select count(*)::int from public.playlist_quality_reviews) as reviews
    `)).rows[0]).toEqual({
      links: 165,
      slugs: ["sachin-kapur"],
      reviews: 35,
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
      "select count(*)::int as count from public.playlist_teachers where playlist_id = 429",
    )).rows[0].count).toBe(0);
    await drifted.close();
  });
});
