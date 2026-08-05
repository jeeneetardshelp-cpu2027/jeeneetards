import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_eighth_batch_quality_review_2026-08-05.sql";
const readinessPath = "docs/unacademy-neet-eighth-batch-quality-readiness-2026-08-05.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "1f3e6d902eea43660977777b4b2843e4d737cfd5b0a9374d10ad7ee79555806e";

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
      (2, 'Chemistry', 'chemistry'), (4, 'Biology', 'biology');

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
    from generate_series(500, 802) n;
    insert into public.playlists values
      (405, 'Redox Reactions | Class 11 | Unacademy NEET | Anoop Vashishtha', null,
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Anoop Vashishtha', 'PLsgHooHkqhhPnLRiFEOjuIGraO0odfi1I', 147, 2, 2,
       array['11th'], '11th'),
      (406, 'NEET: Cell Organelles Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | Pradeep Singh', null,
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Pradeep Singh', 'PLsgHooHkqhhNW-QJ3H58FESiVXdxHYoqw', 147, 2, 4,
       array['11th'], '11th'),
      (407, 'NEET: Molecular Basis of Inheritance - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh', null,
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Pradeep Singh', 'PLsgHooHkqhhOO8a8vMQLe_CVVzttQd_Dh', 147, 2, 4,
       array['12th'], '12th');

    insert into public.videos select n, 1 from generate_series(1, 4539) n;
    insert into public.chapters select n from generate_series(1, 247) n;
    insert into public.chapter_class_levels select n from generate_series(1, 92) n;
    insert into public.playlist_learning_goals select n, 1 from generate_series(1, 82) n;
    insert into public.playlist_learning_goals values (405, 2), (406, 2), (407, 2);
    insert into public.playlist_class_levels values (405, 2), (406, 2), (407, 3);

    insert into public.playlist_videos
    select n, 1 + ((n - 1) % 82), 1 + ((n - 1) % 4539),
           1 + ((n - 1) / 82)::int
    from generate_series(1, 1304) n;
    insert into public.playlist_videos
    select n, 405, n, n - 1304 from generate_series(1305, 1311) n;
    insert into public.playlist_videos
    select n, 406, n, n - 1311 from generate_series(1312, 1320) n;
    insert into public.playlist_videos
    select n, 407, n, n - 1320 from generate_series(1321, 1329) n;
    insert into public.playlist_videos
    select n, 500, 1 + ((n - 1) % 4539), n - 1329
    from generate_series(1330, 4545) n;

    insert into public.teachers
    select n, 'Existing ' || n, 'existing ' || n, 'existing-' || n, true
    from generate_series(1, 30) n;
    insert into public.teachers values
      (33, 'Pradeep Singh', 'pradeep singh', 'pradeep-singh', true),
      (36, 'Anoop Vashishtha', 'anoop vashishtha', 'anoop-vashishtha', true);
    insert into public.teacher_aliases select n from generate_series(1, 50) n;
    insert into public.teacher_institutes select n from generate_series(1, 33) n;
    insert into public.teacher_subjects select n from generate_series(1, 33) n;
    insert into public.teacher_learning_goals select n from generate_series(1, 32) n;
    insert into public.playlist_teachers
    select n, 1 + ((n - 1) % 30), 'instructor', 1 from generate_series(1, 82) n;
    insert into public.playlist_teachers
    select n, 1 + ((n - 500) % 30), 'instructor', 1 from generate_series(500, 557) n;
    insert into public.playlist_teachers values
      (405, 36, 'instructor', 1), (406, 33, 'instructor', 1),
      (407, 33, 'instructor', 1);

    insert into public.playlist_quality_reviews
      (playlist_id, before_state, after_state, note)
    select n, '{}'::jsonb, '{}'::jsonb, 'existing review ' || n
    from generate_series(500, 510) n;
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

describe("Unacademy NEET eighth-batch quality-review package", () => {
  it("pins the owner decision, three exact courses, and canonical review calls", () => {
    expect(sql).toContain("809b153c-b5ff-48e0-a869-02faa49b0e8f");
    expect(sql.match(/v_result := public\.review_playlist_quality\(/g)).toHaveLength(3);
    for (const value of [
      "PLsgHooHkqhhPnLRiFEOjuIGraO0odfi1I",
      "PLsgHooHkqhhNW-QJ3H58FESiVXdxHYoqw",
      "PLsgHooHkqhhOO8a8vMQLe_CVVzttQd_Dh",
      "'Redox Reactions'", "'Cell Organelles'",
      "'Molecular Basis of Inheritance'",
    ]) expect(sql).toContain(value);
  });

  it("allows only guarded source-title capture as a direct table write", () => {
    const executable = sql.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:insert|delete|alter|drop|truncate)\b\s+(?:into\s+|from\s+)?public\./i);
    expect(executable.match(/update public\.playlists p/g)).toHaveLength(1);
    expect(sql).toContain("if v_updated <> 3 then");
    for (const fragment of [
      "count(*) from public.playlists) <> 388",
      "count(*) from public.videos) <> 4539",
      "count(*) from public.playlist_videos) <> 4545",
      "count(*) from public.chapters) <> 247",
      "count(*) from public.chapter_class_levels) <> 92",
      "count(*) from public.playlist_teachers) <> 143",
      "count(*) from public.playlist_quality_reviews) <> 11",
      "count(*) from public.playlist_quality_reviews) <> 14",
    ]) expect(sql).toContain(fragment);
    expect(sql.match(/30eee4a4a6842e5beeb7c97083d7f812/g)).toHaveLength(2);
  });

  it("pins the immutable hash and prepared-only handoff", () => {
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("Prepared and locally rehearsed only");
    expect(readiness).toContain("11 -> 14");
    expect(readiness).toContain("30eee4a4a6842e5beeb7c97083d7f812");
    expect(readiness).toContain("no production write or `release` push occurred");
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
          where id in (405,406,407)) as titles,
        (select array_agg(source_title order by id) from public.playlists
          where id in (405,406,407)) as source_titles,
        (select array_agg(teacher_id order by playlist_id) from public.playlist_teachers
          where playlist_id in (405,406,407)) as teachers,
        (select jsonb_agg(to_jsonb(public.playlist_quality_missing(id)) order by id)
          from public.playlists where id in (405,406,407)) as missing
    `);
    expect(result.rows[0]).toEqual({
      playlists: 388,
      videos: 4539,
      memberships: 4545,
      teacher_links: 143,
      reviews: 14,
      titles: ["Redox Reactions", "Cell Organelles", "Molecular Basis of Inheritance"],
      source_titles: [
        "Redox Reactions | Class 11 | Unacademy NEET | Anoop Vashishtha",
        "NEET: Cell Organelles Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | Pradeep Singh",
        "NEET: Molecular Basis of Inheritance - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh",
      ],
      teachers: [36, 33, 33],
      missing: [[], [], []],
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
          where id in (405,406,407)) as source_titles,
        (select array_agg(title_review_status order by id) from public.playlists
          where id in (405,406,407)) as statuses
    `);
    expect(result.rows[0]).toEqual({
      reviews: 11,
      source_titles: [null, null, null],
      statuses: ["pending", "pending", "pending"],
    });
    await pg.close();
  }, 30_000);
});
