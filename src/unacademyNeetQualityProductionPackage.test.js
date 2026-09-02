import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_first_batch_quality_review_2026-08-03.sql";
const readinessPath = "docs/unacademy-neet-quality-first-batch-readiness-2026-08-03.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "6191c696f6ba7e62055390c48d48230417d69410bb2c06f76034e518b19ecc5e";

const seedProductionShape = async () => {
  const pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create function public.is_admin() returns boolean language sql stable as $$ select false $$;

    create table public.app_environment (id bigint);
    create table public.playlists (
      id bigint primary key,
      title text,
      source_title text,
      source_title_changed boolean,
      title_review_status text,
      faculty_credit_status text,
      content_type text,
      language text,
      difficulty text,
      teacher text,
      youtube_playlist_id text,
      channel_id bigint,
      category_id bigint,
      subject_id bigint,
      class_levels text[],
      audience_focus text
    );
    create table public.videos (id bigint primary key, chapter_id bigint);
    create table public.playlist_videos (
      id bigint primary key,
      playlist_id bigint,
      video_id bigint,
      position int
    );
    create table public.chapters (id bigint primary key);
    create table public.chapter_class_levels (id bigint primary key);
    create table public.learning_goals (id bigint primary key, name text, slug text unique);
    create table public.playlist_learning_goals (
      playlist_id bigint,
      learning_goal_id bigint,
      primary key (playlist_id, learning_goal_id)
    );
    create table public.class_levels (id bigint primary key, slug text unique);
    create table public.playlist_class_levels (
      playlist_id bigint,
      class_level_id bigint,
      primary key (playlist_id, class_level_id)
    );
    create table public.institutes_channels (
      id bigint primary key,
      name text,
      youtube_channel_id text
    );
    create table public.subjects (id bigint primary key, name text, slug text);
    create table public.teachers (
      id bigint primary key,
      display_name text,
      canonical_name text,
      slug text unique,
      verified boolean
    );
    create table public.teacher_aliases (id bigint primary key);
    create table public.teacher_institutes (id bigint primary key);
    create table public.teacher_subjects (id bigint primary key);
    create table public.teacher_learning_goals (id bigint primary key);
    create table public.playlist_teachers (
      playlist_id bigint,
      teacher_id bigint,
      role text,
      position int,
      primary key (playlist_id, teacher_id)
    );
    create table public.playlist_quality_reviews (
      id bigint generated always as identity primary key,
      playlist_id bigint not null,
      before_state jsonb not null,
      after_state jsonb not null,
      note text,
      reviewed_by uuid,
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

    create function public.set_playlist_teachers(
      p_playlist_id bigint, p_teacher_ids bigint[])
    returns jsonb language plpgsql as $$
    declare v_id bigint; v_pos int := 0; v_bad bigint[];
    begin
      if p_teacher_ids is null then raise exception 'teacher array required'; end if;
      if (select count(distinct x) from unnest(p_teacher_ids) x)
         <> coalesce(array_length(p_teacher_ids, 1), 0) then
        raise exception 'duplicate teacher';
      end if;
      select array_agg(x) into v_bad from unnest(p_teacher_ids) x
       where not exists (select 1 from public.teachers t where t.id = x);
      if v_bad is not null then raise exception 'unknown teacher'; end if;
      delete from public.playlist_teachers where playlist_id = p_playlist_id;
      foreach v_id in array p_teacher_ids loop
        v_pos := v_pos + 1;
        insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
        values (p_playlist_id, v_id,
                case when v_pos = 1 then 'instructor' else 'co-instructor' end,
                v_pos);
      end loop;
      return jsonb_build_object('playlist_id', p_playlist_id, 'teachers', v_pos);
    end $$;

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
        case when p.faculty_credit_status = 'team' and exists (
          select 1 from public.playlist_teachers pt where pt.playlist_id = p.id
        ) then 'faculty-team-conflict' end,
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
      p_playlist_id bigint,
      p_display_title text,
      p_teacher_ids bigint[],
      p_faculty_status text,
      p_content_type text,
      p_language text,
      p_difficulty text,
      p_note text default null
    )
    returns jsonb language plpgsql as $$
    declare
      p public.playlists%rowtype;
      v_title text;
      v_before jsonb;
      v_after jsonb;
      v_missing text[];
    begin
      select * into p from public.playlists where id = p_playlist_id for update;
      if not found then raise exception 'unknown playlist'; end if;
      v_title := regexp_replace(btrim(coalesce(p_display_title, '')), '\\s+', ' ', 'g');
      if char_length(v_title) < 3 or char_length(v_title) > 90 then
        raise exception 'invalid title';
      end if;
      if p_teacher_ids is null then raise exception 'teacher ids required'; end if;
      if p_faculty_status not in ('identified','team','unknown') then
        raise exception 'invalid faculty status';
      end if;
      if p_faculty_status = 'identified' and cardinality(p_teacher_ids) = 0 then
        raise exception 'identified requires teacher';
      end if;
      if p_content_type not in ('full-course','one-shot','revision','pyq','practice')
         or p_language not in ('hindi','english','hinglish')
         or p_difficulty not in ('beginner','intermediate','advanced') then
        raise exception 'invalid metadata';
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
      perform public.set_playlist_teachers(p.id, p_teacher_ids);
      update public.playlists
         set title = v_title,
             title_review_status = 'approved',
             faculty_credit_status = p_faculty_status,
             content_type = p_content_type,
             language = p_language,
             difficulty = p_difficulty,
             source_title_changed = false
       where id = p.id;
      v_after := jsonb_build_object(
        'title', v_title,
        'title_review_status', 'approved',
        'faculty_credit_status', p_faculty_status,
        'content_type', p_content_type,
        'language', p_language,
        'difficulty', p_difficulty,
        'teacher_ids', to_jsonb(p_teacher_ids)
      );
      insert into public.playlist_quality_reviews
        (playlist_id, before_state, after_state, note, reviewed_by)
      values (p.id, v_before, v_after, nullif(btrim(p_note), ''), auth.uid());
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
      (1, 'Physics', 'physics'),
      (2, 'Chemistry', 'chemistry'),
      (3, 'Mathematics', 'mathematics'),
      (4, 'Biology', 'biology');

    insert into public.playlists
    select n, 'Course ' || n, 'Source ' || n, false, 'approved', 'identified',
           'full-course', 'hinglish', 'intermediate', 'Teacher ' || n,
           'source-' || n, 1, 1, 1, array['11th'], '11th'
      from generate_series(1, 332) n;
    insert into public.playlists
    select n, 'Course ' || n, 'Source ' || n, false, 'pending', 'pending',
           'full-course', 'hinglish', 'intermediate', 'Teacher ' || n,
           null, 1, 1, 1, array['11th'], '11th'
      from generate_series(344, 361) n;
    insert into public.playlists values
      (341,
       'Chemical Bonding',
       'Chemical Bonding - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Tyagi',
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Ashwani Tyagi', 'PLsgHooHkqhhOpvf0vvBRLS91fUm9T_eE1', 147, 2, 2,
       array['11th'], '11th'),
      (342,
       'Evolution',
       'NEET: Evolution - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh',
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Pradeep Singh', 'PLsgHooHkqhhOQCrgTeH7u28Es6agZtG_x', 147, 2, 4,
       array['12th'], '12th'),
      (343,
       'Principles of Inheritance and Variation',
       'NEET: Principles of Inheritance and Variation - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh',
       false, 'pending', 'pending', 'full-course', 'hinglish', 'intermediate',
       'Pradeep Singh', 'PLsgHooHkqhhNoUZC_HaAwe9k_5crRH-Ig', 147, 2, 4,
       array['12th'], '12th');

    insert into public.videos select n, 1 from generate_series(1, 4159) n;
    insert into public.chapters select n from generate_series(1, 245) n;
    insert into public.chapter_class_levels select n from generate_series(1, 92) n;
    insert into public.playlist_learning_goals select n, 1 from generate_series(1, 83) n;
    insert into public.playlist_learning_goals values (341, 2), (342, 2), (343, 2);
    insert into public.playlist_class_levels values (341, 2), (342, 3), (343, 3);

    insert into public.playlist_videos
    select n, 1 + ((n - 1) % 83), 1 + ((n - 1) % 4018),
           1 + ((n - 1) / 83)::int
      from generate_series(1, 1307) n;
    insert into public.playlist_videos
    select n, 341, n, n - 1307 from generate_series(1308, 1322) n;
    insert into public.playlist_videos
    select n, 342, n, n - 1322 from generate_series(1323, 1337) n;
    insert into public.playlist_videos
    select n, 343, n, n - 1337 from generate_series(1338, 1351) n;
    insert into public.playlist_videos
    select n, 200, 1 + ((n - 1) % 4159), n - 1351
      from generate_series(1352, 4165) n;

    insert into public.teachers
    select n, 'Existing ' || n, 'existing ' || n, 'existing-' || n, true
      from generate_series(1, 27) n;
    insert into public.teachers values
      (32, 'Ashwani Tyagi', 'ashwani tyagi', 'ashwani-tyagi', true),
      (33, 'Pradeep Singh', 'pradeep singh', 'pradeep-singh', true);
    insert into public.teacher_aliases select n from generate_series(1, 45) n;
    insert into public.teacher_institutes select n from generate_series(1, 30) n;
    insert into public.teacher_subjects select n from generate_series(1, 30) n;
    insert into public.teacher_learning_goals select n from generate_series(1, 29) n;
    insert into public.playlist_teachers
    select n, 1 + ((n - 1) % 27), 'instructor', 1 from generate_series(1, 130) n;
    insert into public.playlist_teachers values
      (341, 32, 'instructor', 1),
      (342, 33, 'instructor', 1),
      (343, 33, 'instructor', 1);
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
    "c742fabf93ff8dd33d6ecd5eb4793db0",
    result.rows[0].fingerprint,
  );
};

describe("Unacademy NEET first-batch quality-review production package", () => {
  it("pins the exact review decision, courses, teachers, and canonical RPC", () => {
    expect(sql).toContain("6579f542-da9b-499f-bd46-3aa796ea4f27");
    expect(sql.match(/v_result := public\.review_playlist_quality\(/g)).toHaveLength(3);
    expect(sql).toContain("array[32]::bigint[]");
    expect(sql.match(/array\[33\]::bigint\[\]/g)).toHaveLength(2);
    expect(sql).toContain("'Chemical Bonding'");
    expect(sql).toContain("'Evolution'");
    expect(sql).toContain("'Principles of Inheritance and Variation'");
    expect(sql).toContain("'identified'");
    expect(sql).toContain("'full-course'");
    expect(sql).toContain("'hinglish'");
    expect(sql).toContain("'intermediate'");
  });

  it("contains no direct catalogue write and pins the exact current baseline", () => {
    const executable = sql.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:insert|update|delete|alter|drop|truncate)\b\s+(?:into\s+|from\s+)?public\./i);
    for (const fragment of [
      "count(*) from public.playlists) <> 353",
      "count(*) from public.videos) <> 4159",
      "count(*) from public.playlist_videos) <> 4165",
      "count(*) from public.chapters) <> 245",
      "count(*) from public.chapter_class_levels) <> 92",
      "count(*) from public.teachers) <> 29",
      "count(*) from public.teacher_aliases) <> 45",
      "count(*) from public.playlist_teachers) <> 133",
      "count(*) from public.playlist_quality_reviews) <> 0",
      "count(*) from public.playlist_quality_reviews) <> 3",
    ]) expect(sql).toContain(fragment);
    expect(sql.match(/c742fabf93ff8dd33d6ecd5eb4793db0/g)).toHaveLength(2);
  });

  it("pins the immutable hash and recorded production application state", () => {
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("Applied to production on 4 August 2026");
    expect(readiness).toContain("04 Aug 2026, 01:01:50 IST");
    expect(readiness).toContain("Independent postflight confirmed");
    expect(readiness).toContain("No restore,");
    expect(readiness).toContain("`release` push was performed");
    expect(readiness).toContain("c742fabf93ff8dd33d6ecd5eb4793db0");
  });

  it("rehearses the three reviews atomically against a production-shaped database", async () => {
    const pg = await seedProductionShape();
    await pg.exec(await withLocalFingerprint(pg));
    const result = await pg.query(`
      select
        (select count(*)::int from public.playlists) as playlists,
        (select count(*)::int from public.videos) as videos,
        (select count(*)::int from public.playlist_videos) as memberships,
        (select count(*)::int from public.playlist_teachers) as teacher_links,
        (select count(*)::int from public.playlist_quality_reviews) as reviews,
        (select array_agg(title_review_status order by id)
           from public.playlists where id in (341,342,343)) as title_statuses,
        (select array_agg(faculty_credit_status order by id)
           from public.playlists where id in (341,342,343)) as faculty_statuses,
        (select array_agg(teacher_id order by playlist_id)
           from public.playlist_teachers where playlist_id in (341,342,343)) as teachers,
        (select jsonb_agg(to_jsonb(public.playlist_quality_missing(id)) order by id)
           from public.playlists where id in (341,342,343)) as missing
    `);
    expect(result.rows[0]).toEqual({
      playlists: 353,
      videos: 4159,
      memberships: 4165,
      teacher_links: 133,
      reviews: 3,
      title_statuses: ["approved", "approved", "approved"],
      faculty_statuses: ["identified", "identified", "identified"],
      teachers: [32, 33, 33],
      missing: [[], [], []],
    });
    await pg.close();
  });

  it("rolls back without reviews when an exact baseline guard differs", async () => {
    const pg = await seedProductionShape();
    await pg.exec("insert into public.chapters values (246)");
    await expect(pg.exec(await withLocalFingerprint(pg))).rejects.toThrow(/exact baseline differs/);
    await pg.exec("rollback");
    const result = await pg.query(`
      select
        (select count(*)::int from public.playlist_quality_reviews) as reviews,
        (select array_agg(title_review_status order by id)
           from public.playlists where id in (341,342,343)) as title_statuses,
        (select array_agg(faculty_credit_status order by id)
           from public.playlists where id in (341,342,343)) as faculty_statuses
    `);
    expect(result.rows[0]).toEqual({
      reviews: 0,
      title_statuses: ["pending", "pending", "pending"],
      faculty_statuses: ["pending", "pending", "pending"],
    });
    await pg.close();
  });
});
