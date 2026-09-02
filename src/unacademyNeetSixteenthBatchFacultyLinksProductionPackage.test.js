import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_sixteenth_batch_faculty_links_2026-08-07.sql";
const readinessPath = "docs/unacademy-neet-sixteenth-batch-faculty-links-readiness-2026-08-07.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "d53ac966b5db06f6653403ef053a8b4dd85e49326ddbbe6a69fdf89d8cb66214";

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
    insert into public.subjects values (4, 'Biology', 'biology');
    insert into public.learning_goals values (1, 'jee'), (2, 'neet');
    insert into public.class_levels values
      (1, 'protected'), (2, 'class-11'), (3, 'class-12');
    insert into public.chapters select n from generate_series(1, 263) n;
    insert into public.chapter_class_levels select n, 1 from generate_series(1, 92) n;
    insert into public.videos select n, null from generate_series(1, 4699) n;

    insert into public.playlists
    select n, 'Protected ' || n, null, 'Teacher ' || n, 'protected-' || n,
           1, 4, array['11th'], '11th', 'full-course', 'hinglish',
           'intermediate', 1, 'approved', 'identified'
    from generate_series(1, 82) n;
    insert into public.playlists
    select n, 'Filler ' || n, null, 'Teacher', 'filler-' || n,
           1, 4, null, null, 'full-course', 'hinglish',
           'intermediate', 1, 'approved', 'identified'
    from generate_series(500, 823) n;
    insert into public.playlists values
      (426, 'NEET: Applications Of Biotechnology | Live Daily 2.0 | Unacademy NEET | Seep Pahuja', null, 'Seep Pahuja', 'PLsgHooHkqhhP1V_qdWDRNO0MczNtM6Q1m', 2, 4, array['12th'], '12th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
      (427, 'NEET: The Living World - Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Dr Sachin Kapur | Pradeep Singh', null, 'Dr. Sachin Kapur', 'PLsgHooHkqhhNWiiYtSlpdjPEVYhHqtCkR', 2, 4, array['11th'], '11th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
      (428, 'NEET: Reproductive Health - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Dr Sachin Kapur', null, 'Dr. Sachin Kapur', 'PLsgHooHkqhhPZfPFIHshnh3J0Nsod2uDw', 2, 4, array['12th'], '12th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending');

    insert into public.playlist_learning_goals select n, 1 from generate_series(1, 82) n;
    insert into public.playlist_learning_goals values (426, 2), (427, 2), (428, 2);
    insert into public.playlist_class_levels values (426, 3), (427, 2), (428, 3);
    insert into public.playlist_videos
    select n, 1 + ((n - 1) % 82), 1 + ((n - 1) % 4699),
           1 + ((n - 1) / 82)::int
    from generate_series(1, 1304) n;
    update public.videos set chapter_id = 102 where id between 1305 and 1308;
    update public.videos set chapter_id = 127 where id between 1309 and 1313;
    update public.videos set chapter_id = 123 where id between 1314 and 1320;
    insert into public.playlist_videos
    select n, 426, n, n - 1304 from generate_series(1305, 1308) n;
    insert into public.playlist_videos
    select n, 427, n, n - 1308 from generate_series(1309, 1313) n;
    insert into public.playlist_videos
    select n, 428, n, n - 1313 from generate_series(1314, 1320) n;
    insert into public.playlist_videos
    select n, 500, 1 + ((n - 1) % 4699), n - 1320
    from generate_series(1321, 4705) n;

    insert into public.teachers (display_name, canonical_name, slug, verified)
    select 'Existing Teacher ' || n, '', 'existing-' || n, true
    from generate_series(1, 32) n;
    insert into public.teacher_aliases
      (teacher_id, alias, normalized_alias, alias_type, status, source, verified_at)
    select 1 + ((n - 1) % 32), 'Existing Alias ' || n, '', 'full-name',
           'verified', 'manual', now()
    from generate_series(1, 50) n;
    insert into public.teacher_institutes
    select 1 + ((n - 1) % 32), n, false from generate_series(1, 33) n;
    insert into public.teacher_subjects
    select 1 + ((n - 1) % 32), n from generate_series(1, 33) n;
    insert into public.teacher_learning_goals
    select n, 1 from generate_series(1, 32) n;
    insert into public.playlist_teachers
    select 1 + ((n - 1) % 82), 1 + ((n - 1) / 82)::int, 'instructor', 1
    from generate_series(1, 161) n;
    insert into public.playlist_quality_reviews
    select n, 300 + n from generate_series(1, 32) n;
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

describe("Unacademy NEET sixteenth-batch faculty-link production package", () => {
  it("pins the approved identities, courses, and additive-only scope", () => {
    for (const fragment of [
      "f7992243-3b5b-4c39-bac9-433dd766a70a",
      "'Seep Pahuja', '', 'seep-pahuja', true",
      "'Dr. Sachin Kapur', '', 'sachin-kapur', true",
      "(426::bigint, 'seep-pahuja')",
      "(427::bigint, 'sachin-kapur')",
      "(428::bigint, 'sachin-kapur')",
      "426:seep-pahuja:1",
      "427:sachin-kapur:1",
      "428:sachin-kapur:1",
    ]) expect(sql).toContain(fragment);
    const executable = sql.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:update|delete|alter|drop|truncate)\b/i);
    expect(executable).not.toContain("review_playlist_quality");
    expect(sql.match(/insert into public\./g)).toHaveLength(6);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("pins exact baseline, postflight, and protected JEE boundary", () => {
    for (const fragment of [
      "count(*) from public.playlists) <> 409",
      "count(*) from public.videos) <> 4699",
      "count(*) from public.playlist_videos) <> 4705",
      "count(*) from public.chapters) <> 263",
      "count(*) from public.teachers) <> 32",
      "count(*) from public.teacher_aliases) <> 50",
      "count(*) from public.playlist_teachers) <> 161",
      "count(*) from public.teachers) <> 34",
      "count(*) from public.teacher_aliases) <> 54",
      "count(*) from public.playlist_teachers) <> 164",
      "sachin-kapur:sachin kapur",
      "seep-pahuja:seep pahuja",
    ]) expect(sql).toContain(fragment);
    expect(sql.match(/protected_courses <> 82/g)).toHaveLength(2);
    expect(sql.match(/protected_memberships <> 1304/g)).toHaveLength(2);
    expect(sql.match(/30eee4a4a6842e5beeb7c97083d7f812/g)).toHaveLength(2);
  });

  it("pins the immutable hash and prepared-only handoff", () => {
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("APPLIED SUCCESSFULLY TO PRODUCTION");
    expect(readiness).toContain("teachers `32 -> 34`");
    expect(readiness).toContain("course-teacher links `161 -> 164`");
    expect(readiness).toContain("82 / 1,304 / 30eee4a4a6842e5beeb7c97083d7f812");
    expect(readiness).toContain("No `release` push occurred");
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
          where pt.playlist_id in (426,427,428)) as faculty,
        (select count(*)::int from public.playlist_quality_reviews) as reviews
    `)).rows[0]).toEqual({
      teachers: 34,
      aliases: 54,
      links: 164,
      faculty: ["426:seep-pahuja", "427:sachin-kapur", "428:sachin-kapur"],
      reviews: 32,
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
      "select count(*)::int as count from public.playlist_teachers where playlist_id in (426,427,428)",
    )).rows[0].count).toBe(0);
    await drifted.close();
  });
});
