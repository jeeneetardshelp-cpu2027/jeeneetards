import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqlPath = "docs/sql/unacademy_neet_second_batch_faculty_2026-08-04.sql";
const readinessPath = "docs/unacademy-neet-faculty-second-batch-readiness-2026-08-04.md";
const sql = readFileSync(sqlPath, "utf8");
const readiness = readFileSync(readinessPath, "utf8");
const expectedHash = "970b515f9092717fd0c03feccd426b5ecd2925c0874048cd2b0c9bfaef16c7c7";

describe("Unacademy NEET second-batch faculty production package", () => {
  it("pins the approved identities, courses, and decision", () => {
    expect(sql).toContain("4555712a-b4ea-446c-8f57-04d2257562f9");
    for (const fragment of [
      "'Mahendra Singh', '', 'mahendra-singh', true",
      "'Anu Gupta', '', 'anu-gupta', true",
      "'Anoop Vashishtha', '', 'anoop-vashishtha', true",
      "(374::bigint, 'mahendra-singh')",
      "(375::bigint, 'anu-gupta')",
      "(376::bigint, 'anoop-vashishtha')",
      "UCdQwYksctqqiRwqp3PiJMWA",
    ]) expect(sql).toContain(fragment);
  });

  it("is additive-only and keeps quality review separate", () => {
    const executable = sql.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:update|delete|alter|drop|truncate)\b/i);
    expect(executable).not.toContain("review_playlist_quality");
    expect(sql.match(/insert into public\./g)).toHaveLength(6);
    expect(sql).toContain("title_review_status <> 'pending'");
    expect(sql).toContain("faculty_credit_status <> 'pending'");
  });

  it("pins exact baseline, postflight, aliases, and protected JEE", () => {
    for (const fragment of [
      "count(*) from public.playlists) <> 358",
      "count(*) from public.videos) <> 4223",
      "count(*) from public.playlist_videos) <> 4229",
      "count(*) from public.chapters) <> 250",
      "count(*) from public.teachers) <> 29",
      "count(*) from public.teacher_aliases) <> 45",
      "count(*) from public.playlist_teachers) <> 133",
      "count(*) from public.teachers) <> 32",
      "count(*) from public.teacher_aliases) <> 50",
      "count(*) from public.playlist_teachers) <> 136",
      "anoop-vashishtha:anoop",
      "anu-gupta:anu gupta",
      "mahendra-singh:mahendra",
    ]) expect(sql).toContain(fragment);
    expect(sql.match(/protected_courses <> 83/g)).toHaveLength(2);
    expect(sql.match(/protected_memberships <> 1307/g)).toHaveLength(2);
    expect(sql.match(/c742fabf93ff8dd33d6ecd5eb4793db0/g)).toHaveLength(2);
  });

  it("pins the immutable artifact hash and prepared-only handoff", () => {
    expect(createHash("sha256").update(sql, "utf8").digest("hex")).toBe(expectedHash);
    expect(readiness).toContain(`SHA-256: \`${expectedHash}\``);
    expect(readiness).toContain("Applied successfully to production");
    expect(readiness).toContain("+3 teachers, +5 normalized aliases");
    expect(readiness).toContain("32 teachers / 50 aliases");
    expect(readiness).toContain("c742fabf93ff8dd33d6ecd5eb4793db0");
  });

  it("executes atomically against a production-shaped local rehearsal", async () => {
    const pg = new PGlite();
    await pg.exec(`
      create table public.app_environment (id bigint);
      create table public.playlists (
        id bigint primary key, title text, teacher text, youtube_playlist_id text,
        category_id bigint, subject_id bigint, class_levels text[], audience_focus text,
        content_type text, language text, difficulty text, channel_id bigint,
        title_review_status text, faculty_credit_status text
      );
      create table public.videos (id bigint primary key);
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

      create function public.normalize_person_name(p_name text) returns text
      language sql immutable as $$
        select nullif(trim(regexp_replace(
          regexp_replace(lower(coalesce(p_name, '')),
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

      insert into public.institutes_channels values (147, 'Unacademy NEET', 'UCdQwYksctqqiRwqp3PiJMWA');
      insert into public.subjects values (1, 'Physics', 'physics'), (2, 'Chemistry', 'chemistry');
      insert into public.learning_goals values (1, 'jee'), (2, 'neet');
      insert into public.class_levels values (1, 'protected'), (2, 'class-11'), (3, 'class-12');
      insert into public.chapters select n from generate_series(1, 250) n;
      insert into public.chapter_class_levels select n, 1 from generate_series(1, 92) n;
      insert into public.videos select n from generate_series(1, 4223) n;

      insert into public.playlists
      select n, 'Protected ' || n, 'Teacher ' || n, 'protected-' || n,
             1, 1, array['11th'], '11th', 'full-course', 'hinglish',
             'intermediate', 1, 'approved', 'identified'
      from generate_series(1, 83) n;
      insert into public.playlists
      select n, 'Filler ' || n, 'Teacher', 'filler-' || n,
             1, 1, null, null, 'full-course', 'hinglish',
             'intermediate', 1, 'approved', 'identified'
      from generate_series(500, 771) n;
      insert into public.playlists values
        (374, 'Rotational Motion -  Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh', 'Mahendra Singh', 'PLsgHooHkqhhM1W_NWZnLgqMDysIuHrMXu', 2, 1, array['11th'], '11th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
        (375, 'NEET: Current Electricity | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Physics | Anu Gupta', 'Anu Gupta', 'PLsgHooHkqhhNmUjrOF64b49WSKp93PsKZ', 2, 1, array['12th'], '12th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending'),
        (376, 'NEET: Electrochemistry - Playlist | Class 12 | Unacademy NEET | Live Daily | NEET Chemistry | Anoop Vashishtha', 'Anoop Vashishtha', 'PLsgHooHkqhhPx8PUmYV2q6n6IbpGnCDlg', 2, 2, array['12th'], '12th', 'full-course', 'hinglish', 'intermediate', 147, 'pending', 'pending');

      insert into public.playlist_learning_goals select n, 1 from generate_series(1, 83) n;
      insert into public.playlist_learning_goals values (374, 2), (375, 2), (376, 2);
      insert into public.playlist_class_levels values (374, 2), (375, 3), (376, 3);
      insert into public.playlist_videos
      select n, 1 + ((n - 1) % 83), 1 + ((n - 1) % 4223),
             1 + ((n - 1) / 83)::int
      from generate_series(1, 1307) n;
      insert into public.playlist_videos
      select n, 374, n, n - 1307 from generate_series(1308, 1321) n;
      insert into public.playlist_videos
      select n, 375, n, n - 1321 from generate_series(1322, 1332) n;
      insert into public.playlist_videos
      select n, 376, n, n - 1332 from generate_series(1333, 1341) n;
      insert into public.playlist_videos
      select n, 500, 1 + ((n - 1) % 4223), n - 1341
      from generate_series(1342, 4229) n;

      insert into public.teachers (display_name, canonical_name, slug, verified)
      select 'Existing Teacher ' || n, '', 'existing-' || n, true
      from generate_series(1, 29) n;
      insert into public.teacher_aliases
        (teacher_id, alias, normalized_alias, alias_type, status, source, verified_at)
      select 1 + ((n - 1) % 29), 'Existing Alias ' || n, '', 'full-name',
             'verified', 'manual', now()
      from generate_series(1, 45) n;
      insert into public.teacher_institutes
      select 1 + ((n - 1) % 29), n, false from generate_series(1, 30) n;
      insert into public.teacher_subjects
      select 1 + ((n - 1) % 29), n from generate_series(1, 30) n;
      insert into public.teacher_learning_goals
      select n, 1 from generate_series(1, 29) n;
      insert into public.playlist_teachers
      select 1 + ((n - 1) % 83), 1 + ((n - 1) % 29), 'instructor', 1
      from generate_series(1, 133) n;
    `);

    const fingerprint = (await pg.query(`
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
    await pg.exec(sql.replaceAll("c742fabf93ff8dd33d6ecd5eb4793db0", fingerprint));

    const result = (await pg.query(`
      select
        (select count(*)::int from public.teachers) as teachers,
        (select count(*)::int from public.teacher_aliases) as aliases,
        (select count(*)::int from public.teacher_institutes) as institutes,
        (select count(*)::int from public.teacher_subjects) as subjects,
        (select count(*)::int from public.teacher_learning_goals) as goals,
        (select count(*)::int from public.playlist_teachers) as course_links,
        (select array_agg(t.slug order by pt.playlist_id)
           from public.playlist_teachers pt join public.teachers t on t.id = pt.teacher_id
          where pt.playlist_id in (374, 375, 376)) as linked_slugs,
        (select array_agg(t.slug || ':' || ta.normalized_alias
                          order by t.slug, ta.normalized_alias)
           from public.teacher_aliases ta join public.teachers t on t.id = ta.teacher_id
          where t.slug in ('mahendra-singh', 'anu-gupta', 'anoop-vashishtha')) as normalized_aliases
    `)).rows[0];
    expect(result).toEqual({
      teachers: 32,
      aliases: 50,
      institutes: 33,
      subjects: 33,
      goals: 32,
      course_links: 136,
      linked_slugs: ["mahendra-singh", "anu-gupta", "anoop-vashishtha"],
      normalized_aliases: [
        "anoop-vashishtha:anoop",
        "anoop-vashishtha:anoop vashishtha",
        "anu-gupta:anu gupta",
        "mahendra-singh:mahendra",
        "mahendra-singh:mahendra singh",
      ],
    });
    await pg.close();
  }, 30_000);
});
