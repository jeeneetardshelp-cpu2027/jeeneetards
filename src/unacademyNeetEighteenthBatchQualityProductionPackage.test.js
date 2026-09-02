import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_eighteenth_batch_quality_review_2026-08-07.sql";
const readinessPath = "docs/unacademy-neet-eighteenth-batch-quality-readiness-2026-08-07.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "b6e4421a027bd50e8639302f23f204635876a1f17f1855c2da7c400fa9f7a442";

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
    create table public.videos (
      id bigint primary key, chapter_id bigint, youtube_video_id text
    );
    create table public.playlist_videos (
      id bigint primary key, playlist_id bigint, video_id bigint, position int
    );
    create table public.chapters (id bigint primary key, name text, subject_id bigint);
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
      v_before := jsonb_build_object(
        'title', p.title, 'title_review_status', p.title_review_status,
        'faculty_credit_status', p.faculty_credit_status,
        'content_type', p.content_type, 'language', p.language,
        'difficulty', p.difficulty,
        'teacher_ids', coalesce((select jsonb_agg(pt.teacher_id order by pt.position)
          from public.playlist_teachers pt where pt.playlist_id = p.id), '[]'::jsonb)
      );
      delete from public.playlist_teachers where playlist_id = p.id;
      foreach v_id in array p_teacher_ids loop
        v_position := v_position + 1;
        insert into public.playlist_teachers values
          (p.id, v_id, case when v_position = 1 then 'instructor' else 'co-instructor' end, v_position);
      end loop;
      update public.playlists set
        title = p_display_title, title_review_status = 'approved',
        faculty_credit_status = p_faculty_status, content_type = p_content_type,
        language = p_language, difficulty = p_difficulty,
        source_title_changed = false
      where id = p.id;
      v_after := jsonb_build_object(
        'title', p_display_title, 'title_review_status', 'approved',
        'faculty_credit_status', p_faculty_status,
        'content_type', p_content_type, 'language', p_language,
        'difficulty', p_difficulty, 'teacher_ids', to_jsonb(p_teacher_ids)
      );
      insert into public.playlist_quality_reviews
        (playlist_id, before_state, after_state, note, reviewed_by)
      values (p.id, v_before, v_after, p_note, auth.uid());
      v_missing := public.playlist_quality_missing(p.id);
      return jsonb_build_object(
        'playlist_id', p.id, 'missing_fields', v_missing,
        'quality_ready', cardinality(v_missing) = 0
      );
    end $$;

    insert into public.learning_goals values (1, 'JEE', 'jee'), (2, 'NEET', 'neet');
    insert into public.class_levels values (2, 'class-11'), (3, 'class-12');
    insert into public.institutes_channels values
      (147, 'Unacademy NEET', 'UCdQwYksctqqiRwqp3PiJMWA');
    insert into public.subjects values
      (1, 'Physics', 'physics'), (2, 'Chemistry', 'chemistry'),
      (4, 'Biology', 'biology');

    insert into public.playlists
    select n, 'Protected JEE ' || n, 'Protected source ' || n, false,
           'approved', 'identified', 'full-course', 'hinglish', 'intermediate',
           'Teacher ' || n, 'protected-' || n, 1, 1, 2,
           array['11th'], '11th'
    from generate_series(1, 82) n;
    insert into public.playlists
    select n, 'Filler ' || n, 'Filler source ' || n, false,
           'approved', 'identified', 'full-course', 'hinglish', 'intermediate',
           'Filler teacher', 'filler-' || n, 1, 1, 2,
           array['11th'], '11th'
    from generate_series(500, 827) n;
    insert into public.playlists values
      (430, 'Photosynthesis - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Pradeep Singh', null,
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Pradeep Singh', 'PLsgHooHkqhhOnifSHdglxvopt3ZmRFQ5-', 147, 2, 4,
       array['11th'], '11th'),
      (431, 'Ionic Equilibrium - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Tyagi', null,
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Ashwani Tyagi', 'PLsgHooHkqhhN29ebCtU31NQc4RSZQDJ0z', 147, 2, 2,
       array['11th'], '11th'),
      (432, 'Excretory Products And Their Elimination | Human Physiology - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Dr. Sachin Kapur', null,
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Dr. Sachin Kapur', 'PLsgHooHkqhhPG_PVhW2TE7Ll_Rw2QUdu5', 147, 2, 4,
       array['11th'], '11th');

    insert into public.videos
    select n, 1, 'video-' || n from generate_series(1, 4723) n;
    update public.videos set chapter_id = 119 where id between 1305 and 1307;
    update public.videos set chapter_id = 38 where id between 1308 and 1315;
    update public.videos set chapter_id = 111 where id between 1316 and 1322;
    update public.videos v set youtube_video_id = expected.youtube_video_id
    from (values
      (1305::bigint, '5jycoZ1eYKE'::text), (1306, 'XI1FNUWIDvs'),
      (1307, 'EhVOh2x8KRU'), (1308, 'cmkw7yEt9aM'),
      (1309, 'RNOT5OZRsto'), (1310, 'rz7hyHgXRng'),
      (1311, 'Ef0E436QV_g'), (1312, 'P1iYtGppf7w'),
      (1313, 'P4XHbcrBsyQ'), (1314, 'O_4qhTPCLcI'),
      (1315, 'EbAahd3ecJc'), (1316, '1u3F_NiQ7WY'),
      (1317, 'bzI9ss05Rms'), (1318, 'FD-DbUnla_o'),
      (1319, 'M_BaySNiTfY'), (1320, 'TjuciK33QmU'),
      (1321, 'm7KXt6x_-PM'), (1322, 'gTlmFUV9mhA')
    ) expected(id, youtube_video_id)
    where v.id = expected.id;
    insert into public.chapters select n, 'Chapter ' || n, 1 from generate_series(1, 263) n;
    update public.chapters set name = 'Photosynthesis in Higher Plants', subject_id = 4 where id = 119;
    update public.chapters set name = 'Ionic Equilibrium', subject_id = 2 where id = 38;
    update public.chapters set name = 'Excretory Products and Their Elimination', subject_id = 4 where id = 111;
    insert into public.chapter_class_levels select n from generate_series(1, 92) n;
    insert into public.playlist_learning_goals select n, 1 from generate_series(1, 82) n;
    insert into public.playlist_learning_goals values (430, 2), (431, 2), (432, 2);
    insert into public.playlist_class_levels values (430, 2), (431, 2), (432, 2);

    insert into public.playlist_videos
    select n, 1 + ((n - 1) % 82), 1 + ((n - 1) % 4723),
           1 + ((n - 1) / 82)::int
    from generate_series(1, 1304) n;
    insert into public.playlist_videos
    select n, 430, n, n - 1304 from generate_series(1305, 1307) n;
    insert into public.playlist_videos
    select n, 431, n, n - 1307 from generate_series(1308, 1315) n;
    insert into public.playlist_videos
    select n, 432, n, n - 1315 from generate_series(1316, 1322) n;
    insert into public.playlist_videos
    select n, 500, 1 + ((n - 1) % 4723), n - 1322
    from generate_series(1323, 4729) n;

    insert into public.teachers
    select n, 'Existing ' || n, 'existing ' || n, 'existing-' || n, true
    from generate_series(1, 31) n;
    insert into public.teachers values
      (32, 'Ashwani Tyagi', 'ashwani tyagi', 'ashwani-tyagi', true),
      (33, 'Pradeep Singh', 'pradeep singh', 'pradeep-singh', true),
      (38, 'Dr. Sachin Kapur', 'sachin kapur', 'sachin-kapur', true);
    insert into public.teacher_aliases select n from generate_series(1, 54) n;
    insert into public.teacher_institutes select n from generate_series(1, 35) n;
    insert into public.teacher_subjects select n from generate_series(1, 35) n;
    insert into public.teacher_learning_goals select n from generate_series(1, 34) n;
    insert into public.playlist_teachers
    select n, 1 + ((n - 1) % 30), 'instructor', 1 from generate_series(1, 82) n;
    insert into public.playlist_teachers
    select n, 1 + ((n - 500) % 32), 'instructor', 1 from generate_series(500, 582) n;
    insert into public.playlist_teachers values
      (430, 33, 'instructor', 1), (431, 32, 'instructor', 1), (432, 38, 'instructor', 1);
    insert into public.playlist_quality_reviews
      (playlist_id, before_state, after_state, note)
    select n, '{}'::jsonb, '{}'::jsonb, 'existing review ' || n
    from generate_series(500, 535) n;
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
  return sql.replaceAll(
    "30eee4a4a6842e5beeb7c97083d7f812",
    result.rows[0].fingerprint,
  );
};

describe("Unacademy NEET eighteenth-batch quality-review package", () => {
  it("pins the exact courses and canonical review calls", () => {
    expect(sql.match(/v_result := public\.review_playlist_quality\(/g)).toHaveLength(3);
    for (const value of [
      "PLsgHooHkqhhOnifSHdglxvopt3ZmRFQ5-",
      "PLsgHooHkqhhN29ebCtU31NQc4RSZQDJ0z",
      "PLsgHooHkqhhPG_PVhW2TE7Ll_Rw2QUdu5",
      "430, 'Photosynthesis in Higher Plants', array[33]::bigint[]",
      "431, 'Ionic Equilibrium', array[32]::bigint[]",
      "432, 'Excretory Products and Their Elimination', array[38]::bigint[]",
    ]) expect(sql).toContain(value);
  });

  it("allows only guarded source-title capture as a direct table write", () => {
    const executable = sql.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:insert|delete|alter|drop|truncate)\b\s+(?:into\s+|from\s+)?public\./i);
    expect(executable.match(/update public\.playlists p/g)).toHaveLength(1);
    expect(sql).toContain("if v_updated <> 3 then");
    for (const fragment of [
      "count(*) from public.playlists) <> 413",
      "count(*) from public.videos) <> 4723",
      "count(*) from public.playlist_videos) <> 4729",
      "count(*) from public.chapters) <> 263",
      "count(*) from public.chapter_class_levels) <> 92",
      "count(*) from public.playlist_teachers) <> 168",
      "count(*) from public.playlist_quality_reviews) <> 36",
      "count(*) from public.playlist_quality_reviews) <> 39",
    ]) expect(sql).toContain(fragment);
    expect(sql.match(/30eee4a4a6842e5beeb7c97083d7f812/g)).toHaveLength(2);
  });

  it("pins the immutable hash and successful production evidence", () => {
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("Applied successfully to production");
    expect(readiness).toContain("36 -> 39");
    expect(readiness).toContain("exact-hash owner approval");
    expect(readiness).toContain("The completed artifact must not be rerun");
    expect(readiness).toContain("No `release` push occurred");
    expect(readiness).toContain("30eee4a4a6842e5beeb7c97083d7f812");
  });

  it("rehearses all three reviews atomically on a production-shaped database", async () => {
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
          where id in (430,431,432)) as titles,
        (select array_agg(source_title order by id) from public.playlists
          where id in (430,431,432)) as source_titles,
        (select array_agg(teacher_id order by playlist_id) from public.playlist_teachers
          where playlist_id in (430,431,432)) as teachers,
        (select jsonb_agg(to_jsonb(public.playlist_quality_missing(id)) order by id)
          from public.playlists where id in (430,431,432)) as missing
    `);
    expect(result.rows[0]).toEqual({
      playlists: 413,
      videos: 4723,
      memberships: 4729,
      teacher_links: 168,
      reviews: 39,
      titles: ["Photosynthesis in Higher Plants", "Ionic Equilibrium", "Excretory Products and Their Elimination"],
      source_titles: [
        "Photosynthesis - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Pradeep Singh",
        "Ionic Equilibrium - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Tyagi",
        "Excretory Products And Their Elimination | Human Physiology - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Dr. Sachin Kapur",
      ],
      teachers: [33, 32, 38],
      missing: [[], [], []],
    });
    await pg.close();
  });

  it("rolls back cleanly when an exact baseline guard differs", async () => {
    const pg = await seedProductionShape();
    await pg.exec("insert into public.chapters values (264, 'Concurrent chapter', 2)");
    await expect(pg.exec(await withLocalFingerprint(pg))).rejects.toThrow(/exact baseline differs/);
    await pg.exec("rollback");
    const result = await pg.query(`
      select
        (select count(*)::int from public.playlist_quality_reviews) as reviews,
        (select array_agg(source_title order by id) from public.playlists
          where id in (430,431,432)) as source_titles,
        (select array_agg(title_review_status order by id) from public.playlists
          where id in (430,431,432)) as statuses
    `);
    expect(result.rows[0]).toEqual({
      reviews: 36,
      source_titles: [null, null, null],
      statuses: ["pending", "pending", "pending"],
    });
    await pg.close();
  });
});
