import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_sixth_seventh_batch_quality_review_2026-08-05.sql";
const readinessPath = "docs/unacademy-neet-sixth-seventh-batch-quality-readiness-2026-08-05.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "60973382abb0743c676bb41318a7c33df967d69447bde98cf9dacfbff4a1ade4";

const seedProductionShape = async () => {
  const pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

    create table public.app_environment (id bigint);
    create table public.playlists (
      id bigint primary key, title text, source_title text,
      source_title_changed boolean, title_review_status text,
      faculty_credit_status text, content_type text, language text,
      difficulty text, teacher text, youtube_playlist_id text,
      channel_id bigint, category_id bigint, subject_id bigint,
      class_levels text[], audience_focus text
    );
    create table public.videos (id bigint primary key, chapter_id bigint);
    create table public.playlist_videos (
      id bigint primary key, playlist_id bigint, video_id bigint, position int
    );
    create table public.chapters (id bigint primary key);
    create table public.chapter_class_levels (id bigint primary key);
    create table public.learning_goals (id bigint primary key, name text, slug text unique);
    create table public.playlist_learning_goals (
      playlist_id bigint, learning_goal_id bigint,
      primary key (playlist_id, learning_goal_id)
    );
    create table public.class_levels (id bigint primary key, slug text unique);
    create table public.playlist_class_levels (
      playlist_id bigint, class_level_id bigint,
      primary key (playlist_id, class_level_id)
    );
    create table public.institutes_channels (
      id bigint primary key, name text, youtube_channel_id text
    );
    create table public.subjects (id bigint primary key, name text, slug text);
    create table public.teachers (
      id bigint primary key, display_name text, canonical_name text,
      slug text unique, verified boolean
    );
    create table public.teacher_aliases (id bigint primary key);
    create table public.teacher_institutes (id bigint primary key);
    create table public.teacher_subjects (id bigint primary key);
    create table public.teacher_learning_goals (id bigint primary key);
    create table public.playlist_teachers (
      playlist_id bigint, teacher_id bigint, role text, position int,
      primary key (playlist_id, teacher_id)
    );
    create table public.playlist_quality_reviews (
      id bigint generated always as identity primary key,
      playlist_id bigint not null, before_state jsonb not null,
      after_state jsonb not null, note text, reviewed_by uuid,
      reviewed_at timestamptz not null default now()
    );

    create function public.content_quality_capability()
    returns jsonb language sql stable as $$
      select jsonb_build_object(
        'quality_review_supported', true,
        'source_title_supported', true,
        'faculty_identity_required_for_identified', true,
        'automatic_identity_resolution', false
      )
    $$;

    create function public.playlist_quality_missing(p_playlist_id bigint)
    returns text[] language sql stable as $$
      select array_remove(array[
        case when p.title_review_status <> 'approved' then 'title-review' end,
        case when p.source_title is null or btrim(p.source_title) = '' then 'source-title' end,
        case when p.source_title_changed then 'source-title-changed' end,
        case when p.faculty_credit_status not in ('identified','team') then 'faculty-credit' end,
        case when p.faculty_credit_status = 'identified' and not exists (
          select 1 from public.playlist_teachers pt where pt.playlist_id = p.id
        ) then 'faculty-link' end,
        case when p.content_type is null then 'course-type' end,
        case when p.language is null then 'language' end,
        case when p.difficulty is null then 'difficulty' end,
        case when p.subject_id is null then 'subject' end,
        case when not exists (
          select 1 from public.playlist_learning_goals plg where plg.playlist_id = p.id
        ) then 'learning-goal' end,
        case when not exists (
          select 1 from public.playlist_class_levels pcl where pcl.playlist_id = p.id
        ) then 'class-level' end,
        case when not exists (
          select 1 from public.playlist_videos pv where pv.playlist_id = p.id
        ) then 'lessons' end,
        case when exists (
          select 1 from public.playlist_videos pv
          join public.videos v on v.id = pv.video_id
          where pv.playlist_id = p.id and v.chapter_id is null
        ) then 'lesson-chapter' end
      ]::text[], null::text)
      from public.playlists p where p.id = p_playlist_id
    $$;

    create function public.review_playlist_quality(
      p_playlist_id bigint, p_display_title text, p_teacher_ids bigint[],
      p_faculty_status text, p_content_type text, p_language text,
      p_difficulty text, p_note text default null
    ) returns jsonb language plpgsql as $$
    declare
      p public.playlists%rowtype;
      v_before jsonb;
      v_after jsonb;
      v_missing text[];
      v_id bigint;
      v_position int := 0;
    begin
      select * into p from public.playlists where id = p_playlist_id for update;
      if not found then raise exception 'unknown playlist'; end if;
      if p_faculty_status <> 'identified' or cardinality(p_teacher_ids) = 0 then
        raise exception 'invalid identified faculty';
      end if;
      v_before := jsonb_build_object(
        'title', p.title,
        'title_review_status', p.title_review_status,
        'faculty_credit_status', p.faculty_credit_status,
        'content_type', p.content_type,
        'language', p.language,
        'difficulty', p.difficulty,
        'teacher_ids', coalesce((
          select jsonb_agg(pt.teacher_id order by pt.position)
          from public.playlist_teachers pt where pt.playlist_id = p.id
        ), '[]'::jsonb)
      );
      delete from public.playlist_teachers where playlist_id = p.id;
      foreach v_id in array p_teacher_ids loop
        v_position := v_position + 1;
        insert into public.playlist_teachers values (
          p.id, v_id,
          case when v_position = 1 then 'instructor' else 'co-instructor' end,
          v_position
        );
      end loop;
      update public.playlists set
        title = p_display_title,
        title_review_status = 'approved',
        faculty_credit_status = p_faculty_status,
        content_type = p_content_type,
        language = p_language,
        difficulty = p_difficulty,
        source_title_changed = false
      where id = p.id;
      v_after := jsonb_build_object(
        'title', p_display_title,
        'title_review_status', 'approved',
        'faculty_credit_status', p_faculty_status,
        'content_type', p_content_type,
        'language', p_language,
        'difficulty', p_difficulty,
        'teacher_ids', to_jsonb(p_teacher_ids)
      );
      insert into public.playlist_quality_reviews
        (playlist_id, before_state, after_state, note, reviewed_by)
      values (p.id, v_before, v_after, p_note, auth.uid());
      v_missing := public.playlist_quality_missing(p.id);
      return jsonb_build_object(
        'playlist_id', p.id,
        'missing_fields', v_missing,
        'quality_ready', cardinality(v_missing) = 0
      );
    end $$;

    insert into public.learning_goals values (1, 'JEE', 'jee'), (2, 'NEET', 'neet');
    insert into public.class_levels values (2, 'class-11'), (3, 'class-12');
    insert into public.institutes_channels
      values (147, 'Unacademy NEET', 'UCdQwYksctqqiRwqp3PiJMWA');
    insert into public.subjects values
      (1, 'Physics', 'physics'), (2, 'Chemistry', 'chemistry'),
      (3, 'Mathematics', 'mathematics'), (4, 'Biology', 'biology');

    insert into public.playlists
    select n, 'Protected JEE ' || n, 'Protected source ' || n, false,
           'approved', 'identified', 'full-course', 'hinglish', 'intermediate',
           'Teacher ' || n, 'protected-' || n, 1, 1, 1,
           array['11th'], '11th'
    from generate_series(1, 82) n;
    insert into public.playlists
    select n, 'Filler ' || n, 'Filler source ' || n, false,
           'approved', 'identified', 'full-course', 'hinglish', 'intermediate',
           'Filler teacher', 'filler-' || n, 1, 1, 1,
           array['11th'], '11th'
    from generate_series(500, 797) n;
    insert into public.playlists values
      (400, 'NEET: Hydrogen | Class 11 | Unacademy NEET | Anoop V.', null,
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Anoop Vashishtha', 'PLsgHooHkqhhP65sAqtkbWpVVSrK7FlTWA', 147, 2, 2,
       array['11th'], '11th'),
      (401, 'NEET: Modern Physics | Class 12 | Live Daily 2.0 | Unacademy NEET | Anu Gupta', null,
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Anu Gupta', 'PLsgHooHkqhhMQWo55rneDci-gmYynS9Za', 147, 2, 1,
       array['12th'], '12th'),
      (402, 'NEET: Biodiversity & Conservation | LIVE Daily 2.0 | Unacademy NEET | Pradeep Singh', null,
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Pradeep Singh', 'PLsgHooHkqhhOLWySbDetaU3Z-KiEBLE63', 147, 2, 4,
       array['12th'], '12th'),
      (403, 'NEET: Cell Cycle & Cell Division | Class 11 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir', null,
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Pradeep Singh', 'PLsgHooHkqhhMbUvz0HhRZwLrpa4--2M1F', 147, 2, 4,
       array['11th'], '11th'),
      (404, 'NEET: Microbes in Human Welfare | Class 12 | Unacademy NEET | Pradeep Singh', null,
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Pradeep Singh', 'PLsgHooHkqhhMeV7vEcqRc91GnmR15_eHw', 147, 2, 4,
       array['12th'], '12th');

    insert into public.videos select n, 1 from generate_series(1, 4514) n;
    insert into public.chapters select n from generate_series(1, 247) n;
    insert into public.chapter_class_levels select n from generate_series(1, 92) n;
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
    insert into public.teacher_institutes select n from generate_series(1, 33) n;
    insert into public.teacher_subjects select n from generate_series(1, 33) n;
    insert into public.teacher_learning_goals select n from generate_series(1, 32) n;
    insert into public.playlist_teachers
    select n, 1 + ((n - 1) % 29), 'instructor', 1 from generate_series(1, 82) n;
    insert into public.playlist_teachers
    select n, 1 + ((n - 500) % 29), 'instructor', 1 from generate_series(500, 552) n;
    insert into public.playlist_teachers values
      (400, 36, 'instructor', 1), (401, 35, 'instructor', 1),
      (402, 33, 'instructor', 1), (403, 33, 'instructor', 1),
      (404, 33, 'instructor', 1);

    insert into public.playlist_quality_reviews
      (playlist_id, before_state, after_state, note)
    select n, '{}'::jsonb, '{}'::jsonb, 'existing review ' || n
    from generate_series(500, 505) n;
  `);
  return pg;
};

const withLocalFingerprint = async (pg) => {
  const result = await pg.query(`
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
  `);
  return sql.replaceAll("30eee4a4a6842e5beeb7c97083d7f812", result.rows[0].fingerprint);
};

describe("Unacademy NEET sixth/seventh-batch quality-review package", () => {
  it("pins both owner decisions, five exact courses, and canonical review calls", () => {
    expect(sql).toContain("1d0ea7b9-8cac-4f3b-968d-82b4307f264a");
    expect(sql).toContain("cf45d7d5-43ef-4311-abd7-5297ec2ea3b6");
    expect(sql.match(/v_result := public\.review_playlist_quality\(/g)).toHaveLength(5);
    for (const value of [
      "PLsgHooHkqhhP65sAqtkbWpVVSrK7FlTWA",
      "PLsgHooHkqhhMQWo55rneDci-gmYynS9Za",
      "PLsgHooHkqhhOLWySbDetaU3Z-KiEBLE63",
      "PLsgHooHkqhhMbUvz0HhRZwLrpa4--2M1F",
      "PLsgHooHkqhhMeV7vEcqRc91GnmR15_eHw",
      "'Hydrogen'", "'Modern Physics'", "'Biodiversity and Conservation'",
      "'Cell Cycle and Cell Division'", "'Microbes in Human Welfare'",
    ]) expect(sql).toContain(value);
  });

  it("allows only guarded source-title capture as a direct table write", () => {
    const executable = sql.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:insert|delete|alter|drop|truncate)\b\s+(?:into\s+|from\s+)?public\./i);
    expect(executable.match(/update public\.playlists p/g)).toHaveLength(1);
    expect(sql).toContain("if v_updated <> 5 then");
    for (const fragment of [
      "count(*) from public.playlists) <> 385",
      "count(*) from public.videos) <> 4514",
      "count(*) from public.playlist_videos) <> 4520",
      "count(*) from public.chapters) <> 247",
      "count(*) from public.chapter_class_levels) <> 92",
      "count(*) from public.playlist_teachers) <> 140",
      "count(*) from public.playlist_quality_reviews) <> 6",
      "count(*) from public.playlist_quality_reviews) <> 11",
    ]) expect(sql).toContain(fragment);
    expect(sql.match(/30eee4a4a6842e5beeb7c97083d7f812/g)).toHaveLength(2);
  });

  it("pins the immutable hash and remains explicitly preparation-only", () => {
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("PREPARED AND REHEARSED ONLY");
    expect(readiness).toContain("quality-audit total 6→11");
    expect(readiness).toContain("No content import, schema migration, deletion, or `release` push");
  });

  it("rehearses all five reviews atomically on a production-shaped database", async () => {
    const pg = await seedProductionShape();
    await pg.exec(await withLocalFingerprint(pg));
    const result = await pg.query(`
      select
        (select count(*)::int from public.playlists) as playlists,
        (select count(*)::int from public.videos) as videos,
        (select count(*)::int from public.playlist_videos) as memberships,
        (select count(*)::int from public.playlist_teachers) as teacher_links,
        (select count(*)::int from public.playlist_quality_reviews) as reviews,
        (select array_agg(title order by id) from public.playlists
          where id in (400,401,402,403,404)) as titles,
        (select array_agg(source_title order by id) from public.playlists
          where id in (400,401,402,403,404)) as source_titles,
        (select array_agg(teacher_id order by playlist_id) from public.playlist_teachers
          where playlist_id in (400,401,402,403,404)) as teachers,
        (select jsonb_agg(to_jsonb(public.playlist_quality_missing(id)) order by id)
          from public.playlists where id in (400,401,402,403,404)) as missing
    `);
    expect(result.rows[0]).toEqual({
      playlists: 385,
      videos: 4514,
      memberships: 4520,
      teacher_links: 140,
      reviews: 11,
      titles: [
        "Hydrogen", "Modern Physics", "Biodiversity and Conservation",
        "Cell Cycle and Cell Division", "Microbes in Human Welfare",
      ],
      source_titles: [
        "NEET: Hydrogen | Class 11 | Unacademy NEET | Anoop V.",
        "NEET: Modern Physics | Class 12 | Live Daily 2.0 | Unacademy NEET | Anu Gupta",
        "NEET: Biodiversity & Conservation | LIVE Daily 2.0 | Unacademy NEET | Pradeep Singh",
        "NEET: Cell Cycle & Cell Division | Class 11 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir",
        "NEET: Microbes in Human Welfare | Class 12 | Unacademy NEET | Pradeep Singh",
      ],
      teachers: [36, 35, 33, 33, 33],
      missing: [[], [], [], [], []],
    });
    await pg.close();
  }, 30_000);

  it("rolls back cleanly when an exact baseline guard differs", async () => {
    const pg = await seedProductionShape();
    await pg.exec("insert into public.chapters values (248)");
    await expect(pg.exec(await withLocalFingerprint(pg))).rejects.toThrow(/exact baseline differs/);
    await pg.exec("rollback");
    const result = await pg.query(`
      select
        (select count(*)::int from public.playlist_quality_reviews) as reviews,
        (select array_agg(source_title order by id) from public.playlists
          where id in (400,401,402,403,404)) as source_titles,
        (select array_agg(title_review_status order by id) from public.playlists
          where id in (400,401,402,403,404)) as statuses
    `);
    expect(result.rows[0]).toEqual({
      reviews: 6,
      source_titles: [null, null, null, null, null],
      statuses: ["pending", "pending", "pending", "pending", "pending"],
    });
    await pg.close();
  }, 30_000);
});
