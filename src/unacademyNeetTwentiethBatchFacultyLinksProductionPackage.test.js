import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_twentieth_batch_faculty_links_2026-08-08.sql";
const readinessPath = "docs/unacademy-neet-twentieth-batch-faculty-links-readiness-2026-08-08.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "9ae58b0c2ebdb0cd276dfe36cf45e2daae67c7ac409ea4ec0c8857182f543852";

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
      id bigint generated always as identity primary key, display_name text,
      canonical_name text, slug text unique, verified boolean
    );
    create table public.teacher_aliases (
      id bigint generated always as identity primary key, teacher_id bigint,
      alias text, normalized_alias text, alias_type text, status text, source text,
      verified_at timestamptz, unique (teacher_id, normalized_alias)
    );
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

    create function public.normalize_person_name(p_name text) returns text
    language sql immutable as $$
      select nullif(trim(regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(coalesce(p_name, '')), '['']', '', 'g'),
            '[[:punct:][:space:]]+', ' ', 'g'),
          '\\y(sir|maam|mam|madam|mister|mr|mrs|ms|miss|dr|doctor|prof|professor|ji|bhaiya|bhaiyya|guruji)\\y',
          ' ', 'g'), '\\s+', ' ', 'g')), '')
    $$;
    create function public.set_teacher_canonical() returns trigger language plpgsql as $$
    begin new.canonical_name := public.normalize_person_name(new.display_name); return new; end $$;
    create trigger trg_teacher_canonical before insert on public.teachers
      for each row execute function public.set_teacher_canonical();
    create function public.set_alias_normalized() returns trigger language plpgsql as $$
    begin new.normalized_alias := public.normalize_person_name(new.alias); return new; end $$;
    create trigger trg_alias_normalized before insert on public.teacher_aliases
      for each row execute function public.set_alias_normalized();

    insert into public.institutes_channels values
      (147, 'Unacademy NEET', 'UCdQwYksctqqiRwqp3PiJMWA');
    insert into public.subjects values
      (1, 'Physics', 'physics'), (2, 'Chemistry', 'chemistry');
    insert into public.learning_goals values (1, 'jee'), (2, 'neet');
    insert into public.class_levels values
      (1, 'protected'), (2, 'class-11'), (3, 'class-12');
    insert into public.chapters select n from generate_series(1, 263) n;
    insert into public.chapter_class_levels select n, 1 from generate_series(1, 92) n;
    insert into public.videos
    select n, 'video-' || n, null from generate_series(1, 4731) n;
    insert into public.videos values
      (4822, 'tZWyg6ewJb8', 55), (4823, 'inlxrwae1Ys', 55),
      (4824, 'X24X5wXFUno', 55), (4825, 'CdCL4s9L4F8', 46),
      (4826, '4-LZNHTDJaE', 46), (4827, '1pEXZvaack4', 46),
      (4828, '6r2dj5wPfMk', 17), (4829, 'OLymGXjoLUQ', 17),
      (4830, 'q_Yji3EdXfg', 17);

    insert into public.playlists
    select n, 'Protected ' || n, null, 'Teacher ' || n, 'protected-' || n,
           1, 2, array['11th'], '11th', 'full-course', 'hinglish',
           'intermediate', 1, 'approved', 'identified'
    from generate_series(1, 82) n;
    insert into public.playlists
    select n, 'Filler ' || n, null, 'Teacher', 'filler-' || n,
           1, 2, null, null, 'full-course', 'hinglish',
           'intermediate', 1, 'approved', 'identified'
    from generate_series(500, 833) n;
    insert into public.playlists values
      (436, 'Metallurgy - Playlist | Class 12 | Unacademy NEET | NEET Live Daily | NEET Chemistry | Anoop Sir', null, 'Anoop Vashishtha', 'PLsgHooHkqhhMzQKgCZ2vyX2bh3ejb1eIQ', 2, 2, array['12th'], '12th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
      (437, 'S Block Elements - Playlist | Class 11 | Unacademy NEET | Chemistry | Anoop Sir', null, 'Anoop Vashishtha', 'PLsgHooHkqhhMRv85qlHflI5j8SoA8yZ0n', 2, 2, array['11th'], '11th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
      (438, 'Semiconductors - Playlist | Class 12 |  Unacademy NEET | LIVE DAILY | NEET Physics | Indrajeet Sir', null, 'Indrajeet Singh Sangtani', 'PLsgHooHkqhhNhMBc1PNiIav8Kv_O7NPIT', 2, 1, array['12th'], '12th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending');

    insert into public.playlist_learning_goals select n, 1 from generate_series(1, 82) n;
    insert into public.playlist_learning_goals values (436, 2), (437, 2), (438, 2);
    insert into public.playlist_class_levels values (436, 3), (437, 2), (438, 3);
    insert into public.playlist_videos
    select n, 1 + ((n - 1) % 82), 1 + ((n - 1) % 4731),
           1 + ((n - 1) / 82)::int
    from generate_series(1, 1304) n;
    insert into public.playlist_videos
    select n, 500, 1 + ((n - 1) % 4731), n - 1304
    from generate_series(1305, 4737) n;
    insert into public.playlist_videos values
      (4873, 436, 4822, 1), (4874, 436, 4823, 2), (4875, 436, 4824, 3),
      (4876, 437, 4825, 1), (4877, 437, 4826, 2), (4878, 437, 4827, 3),
      (4879, 438, 4828, 1), (4880, 438, 4829, 2), (4881, 438, 4830, 3);

    insert into public.teachers (display_name, canonical_name, slug, verified)
    select 'Existing Teacher ' || n, '', 'existing-' || n, true
    from generate_series(1, 33) n;
    insert into public.teachers (id, display_name, canonical_name, slug, verified)
    overriding system value
    values (36, 'Anoop Vashishtha', '', 'anoop-vashishtha', true);
    insert into public.teacher_aliases
      (teacher_id, alias, normalized_alias, alias_type, status, source, verified_at)
    select 1 + ((n - 1) % 33), 'Existing Alias ' || n, '', 'full-name',
           'verified', 'manual', now()
    from generate_series(1, 54) n;
    insert into public.teacher_institutes
    select 1 + ((n - 1) % 33), n, false from generate_series(1, 34) n;
    insert into public.teacher_institutes values (36, 147, true);
    insert into public.teacher_subjects
    select 1 + ((n - 1) % 33), 100 + n from generate_series(1, 34) n;
    insert into public.teacher_subjects values (36, 2);
    insert into public.teacher_learning_goals
    select n, 1 from generate_series(1, 33) n;
    insert into public.teacher_learning_goals values (36, 2);
    insert into public.playlist_teachers
    select 1 + ((n - 1) % 82), 1 + ((n - 1) / 82)::int, 'instructor', 1
    from generate_series(1, 171) n;
    insert into public.playlist_quality_reviews
    select n, 300 + n from generate_series(1, 42) n;
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

describe("Unacademy NEET twentieth-batch faculty-link production package", () => {
  it("pins the approved identities, sources, and additive-only scope", () => {
    for (const fragment of [
      "8de024c6-7317-4901-a91e-5006a5efcd7e",
      "'Indrajeet Singh Sangtani', '', 'indrajeet-singh-sangtani', true",
      "(436::bigint, 'anoop-vashishtha')",
      "(437::bigint, 'anoop-vashishtha')",
      "(438::bigint, 'indrajeet-singh-sangtani')",
      "436:anoop-vashishtha:1",
      "437:anoop-vashishtha:1",
      "438:indrajeet-singh-sangtani:1",
      "tZWyg6ewJb8",
      "q_Yji3EdXfg",
      "Semiconductors - Playlist | Class 12 |  Unacademy NEET | LIVE DAILY | NEET Physics | Indrajeet Sir",
    ]) expect(sql).toContain(fragment);
    const executable = sql.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:update|delete|alter|drop|truncate)\b/i);
    expect(executable).not.toContain("review_playlist_quality");
    expect(sql.match(/insert into public\./g)).toHaveLength(6);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("pins the exact baseline, postflight, protected boundary, and hash", () => {
    for (const fragment of [
      "count(*) from public.playlists) <> 419",
      "count(*) from public.videos) <> 4740",
      "count(*) from public.playlist_videos) <> 4746",
      "count(*) from public.chapters) <> 263",
      "count(*) from public.teachers) <> 34",
      "count(*) from public.teacher_aliases) <> 54",
      "count(*) from public.playlist_teachers) <> 171",
      "count(*) from public.teachers) <> 35",
      "count(*) from public.teacher_aliases) <> 56",
      "count(*) from public.playlist_teachers) <> 174",
      "count(*) from public.playlist_quality_reviews) <> 42",
    ]) expect(sql).toContain(fragment);
    expect(sql.match(/protected_courses <> 82/g)).toHaveLength(2);
    expect(sql.match(/protected_memberships <> 1304/g)).toHaveLength(2);
    expect(sql.match(/30eee4a4a6842e5beeb7c97083d7f812/g)).toHaveLength(2);
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("APPLIED SUCCESSFULLY TO PRODUCTION ON 8 AUGUST 2026");
    expect(readiness).toContain("47c61d0354124e33241cd17e3e4d8cffc1c57abbcd07b716b46a050c7520200c");
    expect(readiness).toContain("before any insert");
    expect(readiness).toContain("2026-08-08T10:28:34.391104Z");
    expect(readiness).toContain("438:indrajeet-singh-sangtani:1");
    expect(readiness).toContain("Quality review remains a separate later gate");
  });

  it("executes atomically and rolls back on baseline drift", async () => {
    const pg = await productionShapedDb();
    const fingerprint = await protectedFingerprint(pg);
    await pg.exec(sql.replaceAll("30eee4a4a6842e5beeb7c97083d7f812", fingerprint));
    expect((await pg.query(`
      select
        (select count(*)::int from public.teachers) as teachers,
        (select count(*)::int from public.teacher_aliases) as aliases,
        (select count(*)::int from public.playlist_teachers) as links,
        (select array_agg(format('%s:%s', pt.playlist_id, t.slug) order by pt.playlist_id)
          from public.playlist_teachers pt join public.teachers t on t.id=pt.teacher_id
          where pt.playlist_id in (436,437,438)) as faculty,
        (select count(*)::int from public.playlist_quality_reviews) as reviews
    `)).rows[0]).toEqual({
      teachers: 35,
      aliases: 56,
      links: 174,
      faculty: [
        "436:anoop-vashishtha",
        "437:anoop-vashishtha",
        "438:indrajeet-singh-sangtani",
      ],
      reviews: 42,
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
      "select count(*)::int as count from public.playlist_teachers where playlist_id in (436,437,438)",
    )).rows[0].count).toBe(0);
    await drifted.close();
  });
});
