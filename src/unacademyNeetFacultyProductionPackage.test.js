import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_first_batch_faculty_2026-08-03.sql";
const readinessPath = "docs/unacademy-neet-faculty-first-batch-readiness-2026-08-03.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "63ae41e5bd6774a36169931dfa50e2867745b6b7a670a5dd81d053c90ca421ee";

describe("Unacademy NEET first-batch faculty production package", () => {
  it("pins the exact owner-reviewed identities, courses, and decision", () => {
    expect(sql).toContain("6579f542-da9b-499f-bd46-3aa796ea4f27");
    expect(sql).toContain("'Ashwani Tyagi', '', 'ashwani-tyagi', true");
    expect(sql).toContain("'Pradeep Singh', '', 'pradeep-singh', true");
    expect(sql).toContain("(341::bigint, 'ashwani-tyagi')");
    expect(sql).toContain("(342::bigint, 'pradeep-singh')");
    expect(sql).toContain("(343::bigint, 'pradeep-singh')");
    expect(sql).toContain("UCdQwYksctqqiRwqp3PiJMWA");
    expect(sql).toContain("'Chemical Bonding'::text");
    expect(sql).toContain("'Evolution'::text");
    expect(sql).toContain("'Principles of Inheritance and Variation'::text");
    expect(sql).not.toContain("Chemical Bonding - Playlist | Class 11");
  });

  it("is additive-only and leaves quality-review status pending", () => {
    const executable = sql.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:update|delete|alter|drop|truncate)\b/i);
    expect(executable).not.toContain("review_playlist_quality");
    expect(executable).toContain("faculty_credit_status is distinct from 'pending'");
    expect(executable).toContain("faculty_credit_status <> 'pending'");
    expect(sql.match(/insert into public\./g)).toHaveLength(6);
  });

  it("pins the refreshed exact preflight and additive postflight totals", () => {
    for (const fragment of [
      "count(*) from public.playlists) <> 334",
      "count(*) from public.videos) <> 3955",
      "count(*) from public.playlist_videos) <> 3961",
      "count(*) from public.chapters) <> 245",
      "count(*) from public.chapter_class_levels) <> 92",
      "count(*) from public.teachers) <> 27",
      "count(*) from public.teacher_aliases) <> 41",
      "count(*) from public.playlist_teachers) <> 130",
      "count(*) from public.teachers) <> 29",
      "count(*) from public.teacher_aliases) <> 45",
      "count(*) from public.playlist_teachers) <> 133",
    ]) {
      expect(sql).toContain(fragment);
    }
    expect(sql).toContain("15::bigint");
    expect(sql).toContain("14::bigint");
  });

  it("uses the v14 protected original-JEE definition at both gates", () => {
    expect(sql.match(/p\.id < 167/g)).toHaveLength(8);
    expect(sql.match(/protected_courses <> 83/g)).toHaveLength(2);
    expect(sql.match(/protected_memberships <> 1307/g)).toHaveLength(2);
    expect(sql.match(/c742fabf93ff8dd33d6ecd5eb4793db0/g)).toHaveLength(2);
  });

  it("pins the immutable artifact hash and prepared-only handoff", () => {
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("Prepared and locally validated only");
    expect(readiness).toContain("has **not** been\napplied");
    expect(readiness).toContain("+2 teachers, +4 aliases");
  });

  it("executes atomically against a production-shaped local rehearsal", async () => {
    const pg = new PGlite();
    await pg.exec(`
      create table public.app_environment (id bigint);
      create table public.playlists (
        id bigint primary key,
        title text,
        teacher text,
        youtube_playlist_id text,
        category_id bigint,
        subject_id bigint,
        class_levels text[],
        audience_focus text,
        content_type text,
        language text,
        difficulty text,
        channel_id bigint,
        faculty_credit_status text
      );
      create table public.videos (id bigint primary key);
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
        id bigint generated by default as identity primary key,
        display_name text not null,
        canonical_name text not null,
        slug text not null unique,
        verified boolean not null default false
      );
      create table public.teacher_aliases (
        id bigint generated by default as identity primary key,
        teacher_id bigint not null,
        alias text not null,
        normalized_alias text not null,
        alias_type text not null,
        status text not null,
        source text not null,
        verified_at timestamptz,
        unique (teacher_id, normalized_alias)
      );
      create function public.test_normalize_teacher_alias()
      returns trigger language plpgsql as $$
      begin
        new.normalized_alias := lower(trim(new.alias));
        return new;
      end $$;
      create trigger test_normalize_teacher_alias
        before insert on public.teacher_aliases
        for each row execute function public.test_normalize_teacher_alias();
      create table public.teacher_institutes (
        teacher_id bigint,
        institute_id bigint,
        is_primary boolean not null default false,
        primary key (teacher_id, institute_id)
      );
      create table public.teacher_subjects (
        teacher_id bigint,
        subject_id bigint,
        primary key (teacher_id, subject_id)
      );
      create table public.teacher_learning_goals (
        teacher_id bigint,
        learning_goal_id bigint,
        primary key (teacher_id, learning_goal_id)
      );
      create table public.playlist_teachers (
        playlist_id bigint,
        teacher_id bigint,
        role text,
        position int,
        primary key (playlist_id, teacher_id)
      );

      insert into public.learning_goals values (1, 'JEE', 'jee'), (2, 'NEET', 'neet');
      insert into public.class_levels values (2, 'class-11'), (3, 'class-12');
      insert into public.institutes_channels
        values (147, 'Unacademy NEET', 'UCdQwYksctqqiRwqp3PiJMWA');
      insert into public.subjects
      select n,
             case n when 2 then 'Chemistry' when 4 then 'Biology' else 'Subject ' || n end,
             case n when 2 then 'chemistry' when 4 then 'biology' else 'subject-' || n end
      from generate_series(1, 28) n;

      insert into public.playlists
      select n, 'Course ' || n, 'Teacher ' || n, 'source-' || n, 1, 1,
             array['class-11'], 'Class 11', 'lectures', 'Hindi', 'all-levels', 1, 'pending'
      from generate_series(1, 331) n;
      insert into public.playlists values
        (341,
         'Chemical Bonding',
         'Ashwani Tyagi', 'PLsgHooHkqhhOpvf0vvBRLS91fUm9T_eE1', 2, 2,
         array['class-11'], 'Class 11', 'lectures', 'Hindi', 'all-levels', 147, 'pending'),
        (342,
         'Evolution',
         'Pradeep Singh', 'PLsgHooHkqhhOQCrgTeH7u28Es6agZtG_x', 2, 4,
         array['class-12'], 'Class 12', 'lectures', 'Hindi', 'all-levels', 147, 'pending'),
        (343,
         'Principles of Inheritance and Variation',
         'Pradeep Singh', 'PLsgHooHkqhhNoUZC_HaAwe9k_5crRH-Ig', 2, 4,
         array['class-12'], 'Class 12', 'lectures', 'Hindi', 'all-levels', 147, 'pending');
      insert into public.videos select n from generate_series(1, 3955) n;
      insert into public.chapters select n from generate_series(1, 245) n;
      insert into public.chapter_class_levels select n from generate_series(1, 92) n;

      insert into public.playlist_learning_goals
      select n, 1 from generate_series(1, 83) n;
      insert into public.playlist_learning_goals values (341, 2), (342, 2), (343, 2);
      insert into public.playlist_class_levels values (341, 2), (342, 3), (343, 3);

      insert into public.playlist_videos
      select n, 1 + ((n - 1) % 83), 1 + ((n - 1) % 3955),
             1 + ((n - 1) / 83)::int
      from generate_series(1, 1307) n;
      insert into public.playlist_videos
      select n, 341, n, n - 1307 from generate_series(1308, 1322) n;
      insert into public.playlist_videos
      select n, 342, n, n - 1322 from generate_series(1323, 1337) n;
      insert into public.playlist_videos
      select n, 343, n, n - 1337 from generate_series(1338, 1351) n;
      insert into public.playlist_videos
      select n, 200, 1 + ((n - 1) % 3955), n - 1351
      from generate_series(1352, 3961) n;

      insert into public.teachers (display_name, canonical_name, slug, verified)
      select 'Existing Teacher ' || n, 'existing teacher ' || n, 'existing-' || n, true
      from generate_series(1, 27) n;
      insert into public.teacher_aliases
        (teacher_id, alias, normalized_alias, alias_type, status, source, verified_at)
      select 1 + ((n - 1) % 27), 'Existing Alias ' || n, '', 'full-name',
             'verified', 'manual', now()
      from generate_series(1, 41) n;
      insert into public.teacher_institutes
      select 1 + ((n - 1) % 27), n, false from generate_series(1, 28) n;
      insert into public.teacher_subjects
      select 1 + ((n - 1) % 27), n from generate_series(1, 28) n;
      insert into public.teacher_learning_goals
      select n, 1 from generate_series(1, 27) n;
      insert into public.playlist_teachers
      select n, 1 + ((n - 1) % 27), 'instructor', 1
      from generate_series(1, 130) n;
    `);

    const fingerprintResult = await pg.query(`
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
    const localFingerprint = fingerprintResult.rows[0].fingerprint;
    const rehearsalSql = sql.replaceAll(
      "c742fabf93ff8dd33d6ecd5eb4793db0",
      localFingerprint,
    );

    await pg.exec(rehearsalSql);
    const result = await pg.query(`
      select
        (select count(*)::int from public.teachers) as teachers,
        (select count(*)::int from public.teacher_aliases) as aliases,
        (select count(*)::int from public.teacher_institutes) as institutes,
        (select count(*)::int from public.teacher_subjects) as subjects,
        (select count(*)::int from public.teacher_learning_goals) as goals,
        (select count(*)::int from public.playlist_teachers) as course_links,
        (select array_agg(t.slug order by pt.playlist_id)
           from public.playlist_teachers pt
           join public.teachers t on t.id = pt.teacher_id
          where pt.playlist_id in (341, 342, 343)) as linked_slugs
    `);
    expect(result.rows[0]).toEqual({
      teachers: 29,
      aliases: 45,
      institutes: 30,
      subjects: 30,
      goals: 29,
      course_links: 133,
      linked_slugs: ["ashwani-tyagi", "pradeep-singh", "pradeep-singh"],
    });
    await pg.close();
  }, 30_000);
});
