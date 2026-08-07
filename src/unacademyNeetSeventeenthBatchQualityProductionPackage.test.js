import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_seventeenth_batch_quality_review_2026-08-07.sql";
const readinessPath = "docs/unacademy-neet-seventeenth-batch-quality-readiness-2026-08-07.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "deadb3d8acadc0f12ccceda29296dff43ba961de18da81255b0b4478da81cfb3";
const productionFingerprint = "30eee4a4a6842e5beeb7c97083d7f812";

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
      id bigint primary key, youtube_video_id text, chapter_id bigint
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
    insert into public.class_levels values (2, 'class-11');
    insert into public.institutes_channels values
      (147, 'Unacademy NEET', 'UCdQwYksctqqiRwqp3PiJMWA');
    insert into public.subjects values (4, 'Biology', 'biology');

    insert into public.playlists
    select n, 'Protected JEE ' || n, 'Protected source ' || n, false,
           'approved', 'identified', 'full-course', 'hinglish', 'intermediate',
           'Teacher ' || n, 'protected-' || n, 1, 1, 4,
           array['11th'], '11th'
    from generate_series(1, 82) n;
    insert into public.playlists
    select n, 'Filler ' || n, 'Filler source ' || n, false,
           'approved', 'identified', 'full-course', 'hinglish', 'intermediate',
           'Filler teacher', 'filler-' || n, 1, 1, 4,
           array['11th'], '11th'
    from generate_series(500, 826) n;
    insert into public.playlists values
      (429, 'NEET: Breathing & Exchange of Gases - Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Dr Sachin Kapur', null,
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Dr. Sachin Kapur', 'PLsgHooHkqhhMpUzdl2c1YMGYdrTxCCXFe', 147, 2, 4,
       array['11th'], '11th');

    insert into public.videos
    select n, 'video-' || n, 1 from generate_series(1, 4699) n;
    insert into public.videos values
      (4790, 'bmF2tmenuMI', 105), (4791, 'fG72ty2A2tg', 105),
      (4792, 'at_rKPlIXoo', 105), (4793, '5Jls9m-jDjM', 105),
      (4794, 'Ev3t9nip0PU', 105), (4795, 'zNpJSgVOR1M', 105);
    insert into public.chapters
    select n, 'Chapter ' || n, 4 from generate_series(1, 263) n;
    update public.chapters set name = 'Breathing and Exchange of Gases'
     where id = 105;
    insert into public.chapter_class_levels select n from generate_series(1, 92) n;

    insert into public.playlist_learning_goals select n, 1 from generate_series(1, 82) n;
    insert into public.playlist_learning_goals values (429, 2);
    insert into public.playlist_class_levels values (429, 2);
    insert into public.playlist_videos
    select n, 1 + ((n - 1) % 82), 1 + ((n - 1) % 4699),
           1 + ((n - 1) / 82)::int
    from generate_series(1, 1304) n;
    insert into public.playlist_videos
    select n, 500, 1 + ((n - 1) % 4699), n - 1304
    from generate_series(1305, 4705) n;
    insert into public.playlist_videos values
      (4841, 429, 4790, 1), (4842, 429, 4791, 2),
      (4843, 429, 4792, 3), (4844, 429, 4793, 4),
      (4845, 429, 4794, 5), (4846, 429, 4795, 6);

    insert into public.teachers
    select n, 'Existing ' || n, 'existing ' || n, 'existing-' || n, true
    from generate_series(1, 33) n;
    insert into public.teachers values
      (38, 'Dr. Sachin Kapur', 'sachin kapur', 'sachin-kapur', true);
    insert into public.teacher_aliases select n from generate_series(1, 54) n;
    insert into public.teacher_institutes select n from generate_series(1, 35) n;
    insert into public.teacher_subjects select n from generate_series(1, 35) n;
    insert into public.teacher_learning_goals select n from generate_series(1, 34) n;
    insert into public.playlist_teachers
    select 1 + ((n - 1) % 82), 1 + ((n - 1) / 82), 'instructor', 1
    from generate_series(1, 164) n;
    insert into public.playlist_teachers values (429, 38, 'instructor', 1);
    insert into public.playlist_quality_reviews
      (playlist_id, before_state, after_state, note)
    select n, '{}'::jsonb, '{}'::jsonb, 'existing review ' || n
    from generate_series(500, 534) n;
  `);
  return pg;
};

const localFingerprint = async (pg) => {
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
  return result.rows[0].fingerprint;
};

const executableSql = async (pg) =>
  sql.replaceAll(productionFingerprint, await localFingerprint(pg));

describe("Unacademy NEET seventeenth-batch quality-review package", () => {
  it("pins the one-course reviewed scope and exact production boundaries", () => {
    for (const fragment of [
      "ae4a8549-84d5-4784-91ed-2f56e4208d88",
      "playlist_id = 429",
      "array[38]::bigint[]",
      "Breathing and Exchange of Gases",
      "PLsgHooHkqhhMpUzdl2c1YMGYdrTxCCXFe",
      "array['bmF2tmenuMI','fG72ty2A2tg','at_rKPlIXoo','5Jls9m-jDjM','Ev3t9nip0PU','zNpJSgVOR1M']",
      "count(*) from public.playlists) <> 410",
      "count(*) from public.playlist_teachers) <> 165",
      "count(*) from public.playlist_quality_reviews) <> 35",
      "count(*) from public.playlist_quality_reviews) <> 36",
    ]) expect(sql).toContain(fragment);
    expect(sql.match(/protected_courses <> 82/g)).toHaveLength(2);
    expect(sql.match(/protected_memberships <> 1304/g)).toHaveLength(2);
    expect(sql.match(new RegExp(productionFingerprint, "g"))).toHaveLength(2);
  });

  it("allows only the canonical source-title and quality-review transition", () => {
    expect(sql.match(/update public\.playlists/g)).toHaveLength(1);
    expect(sql).toContain("public.review_playlist_quality(");
    expect(sql).not.toMatch(/\b(delete|alter|drop|truncate)\b/i);
    expect(sql).not.toContain("insert into public.playlists");
    expect(sql).not.toContain("insert into public.videos");
    expect(sql).not.toContain("insert into public.playlist_videos");
  });

  it("pins the immutable hash and prepared-only approval boundary", () => {
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("Prepared and locally rehearsed only");
    expect(readiness).toContain("35 -> 36");
    expect(readiness).toContain("separate owner approval");
    expect(readiness).toContain("no production SQL or `release` push occurred");
  });

  it("rehearses the exact transition and immutable audit row", async () => {
    const pg = await seedProductionShape();
    await pg.exec(await executableSql(pg));
    const course = await pg.query(`
      select title, source_title, title_review_status, faculty_credit_status,
             public.playlist_quality_missing(id) as missing
      from public.playlists where id = 429
    `);
    expect(course.rows).toEqual([expect.objectContaining({
      title: "Breathing and Exchange of Gases",
      title_review_status: "approved",
      faculty_credit_status: "identified",
      missing: [],
    })]);
    expect(course.rows[0].source_title).toContain("Breathing & Exchange of Gases");
    const totals = await pg.query(`
      select
        (select count(*)::int from public.playlists) as playlists,
        (select count(*)::int from public.videos) as videos,
        (select count(*)::int from public.playlist_videos) as memberships,
        (select count(*)::int from public.playlist_teachers) as links,
        (select count(*)::int from public.playlist_quality_reviews) as reviews
    `);
    expect(totals.rows[0]).toEqual({
      playlists: 410, videos: 4705, memberships: 4711, links: 165, reviews: 36,
    });
    const audit = await pg.query(`
      select before_state, after_state, note
      from public.playlist_quality_reviews where playlist_id = 429
    `);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].before_state.teacher_ids).toEqual([38]);
    expect(audit.rows[0].after_state).toEqual(expect.objectContaining({
      title: "Breathing and Exchange of Gases",
      title_review_status: "approved",
      faculty_credit_status: "identified",
      teacher_ids: [38],
    }));
  });

  it("rolls back completely when the encoded baseline drifts", async () => {
    const pg = await seedProductionShape();
    await pg.exec("insert into public.chapters values (264, 'Unexpected', 4)");
    await expect(pg.exec(await executableSql(pg))).rejects.toThrow("exact baseline differs");
    await pg.exec("rollback");
    const course = await pg.query(`
      select source_title, title_review_status, faculty_credit_status
      from public.playlists where id = 429
    `);
    expect(course.rows[0]).toEqual({
      source_title: null,
      title_review_status: "pending",
      faculty_credit_status: "pending",
    });
    const reviews = await pg.query(
      "select count(*)::int as count from public.playlist_quality_reviews where playlist_id = 429",
    );
    expect(reviews.rows[0].count).toBe(0);
  });
});
