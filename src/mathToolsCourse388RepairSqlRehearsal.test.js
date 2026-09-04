import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const SQL = readFileSync(
  join(
    import.meta.dirname,
    "../supabase/migrations/20260904085000_repair_math_tools_course_388.sql",
  ),
  "utf8",
);

const VIDEO_IDS = [
  "NAlLWcfQHrA", "f8qQBzJOrro", "oLEoCUsI_JM", "mWV_ZstQFjs",
  "WNX89aIrtG0", "7dWQ9YZW1IY", "vNIHUxsVO9o", "4i2uxEWoUzc",
  "eOc_-cj-E8E", "Zhb_8ZhuoCk", "nEFmIsjmUhw", "8TexFzMMmwc",
  "nqQ2MXQn6EE", "8tDXLa7YnzE", "vjGgO55Za1M", "RFSYpB9XbJU",
  "odjEcwc6puw", "eqmZeDWw-vM", "6CQg42hcp3M", "CV48M3NZLC8",
  "ZJ7R7htvCms", "Locn5Y9Xp-0", "AJMHRZJzFaI", "C-4hhDLXDoo",
  "W0GzhprYsp4", "1Ok39Wx126M", "2Lwt4x6LEsM", "cooR9L3wa7c",
  "IhE84X4oOkw", "xb2ybnjDNRo", "O1NmjdpBA9E", "3m-AKyC5lYY",
  "PAzUF3462a4", "y89zyc7ESxo", "8vPsqiU66PQ",
];

const WORLD = `
create table public.institutes_channels (
  id bigint primary key, name text not null, youtube_channel_id text not null
);
create table public.subjects (id bigint primary key, name text, slug text);
create table public.categories (id bigint primary key, name text, slug text);
create table public.learning_goals (id bigint primary key, name text, slug text unique);
create table public.class_levels (id bigint primary key, name text, slug text unique);
create table public.chapters (
  id bigint primary key, subject_id bigint, name text, slug text
);
create table public.teachers (
  id bigint primary key, display_name text, slug text, verified boolean
);
create table public.teacher_aliases (
  id bigint generated always as identity primary key,
  teacher_id bigint, alias text, status text
);
create table public.teacher_institutes (teacher_id bigint, institute_id bigint);
create table public.teacher_subjects (teacher_id bigint, subject_id bigint);
create table public.teacher_learning_goals (teacher_id bigint, learning_goal_id bigint);
create table public.playlists (
  id bigint primary key,
  title text,
  source_title text,
  teacher text,
  channel_id bigint,
  subject_id bigint,
  category_id bigint,
  content_type text,
  language text,
  difficulty text,
  class_levels text[],
  audience_focus text,
  youtube_playlist_id text unique,
  title_review_status text default 'pending',
  faculty_credit_status text default 'pending',
  source_title_changed boolean default false
);
create table public.videos (
  id bigint primary key,
  youtube_video_id text unique,
  chapter_id bigint,
  subject_id bigint,
  category_id bigint
);
create table public.playlist_videos (
  playlist_id bigint, video_id bigint, position int,
  primary key (playlist_id, video_id)
);
create table public.playlist_learning_goals (
  playlist_id bigint, learning_goal_id bigint,
  primary key (playlist_id, learning_goal_id)
);
create table public.playlist_class_levels (
  playlist_id bigint, class_level_id bigint,
  primary key (playlist_id, class_level_id)
);
create table public.playlist_boards (playlist_id bigint, board_id bigint);
create table public.playlist_teachers (
  playlist_id bigint, teacher_id bigint, role text default 'instructor', position int,
  primary key (playlist_id, teacher_id)
);
create table public.video_learning_goals (
  video_id bigint, learning_goal_id bigint,
  primary key (video_id, learning_goal_id)
);
create table public.video_class_levels (
  video_id bigint, class_level_id bigint,
  primary key (video_id, class_level_id)
);

create or replace function public.review_playlist_quality(
  p_playlist_id bigint,
  p_display_title text,
  p_teacher_ids bigint[],
  p_faculty_status text,
  p_content_type text,
  p_language text,
  p_difficulty text,
  p_note text default null
) returns jsonb language plpgsql as $fn$
declare v_teacher bigint;
begin
  delete from public.playlist_teachers where playlist_id = p_playlist_id;
  foreach v_teacher in array p_teacher_ids loop
    insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
    values (p_playlist_id, v_teacher, 'instructor', 1);
  end loop;
  update public.playlists
     set title = p_display_title,
         title_review_status = 'approved',
         faculty_credit_status = p_faculty_status,
         content_type = p_content_type,
         language = p_language,
         difficulty = p_difficulty,
         source_title_changed = false
   where id = p_playlist_id;
  return jsonb_build_object('playlist_id', p_playlist_id, 'note', p_note);
end $fn$;

create or replace function public.playlist_quality_missing(p_playlist_id bigint)
returns text[] language sql stable as $fn$
  select case when p.source_title is not null
                    and p.title_review_status = 'approved'
                    and p.faculty_credit_status = 'identified'
                    and exists (
                      select 1 from public.playlist_teachers pt
                       where pt.playlist_id = p.id
                    )
              then array[]::text[] else array['quality-gap']::text[] end
    from public.playlists p where p.id = p_playlist_id
$fn$;
`;

async function seed(pg) {
  await pg.exec(`
    insert into public.institutes_channels values
      (1, 'Mohit Tyagi', 'UCpyc1eTpM1cA3P0ZWym4clw');
    insert into public.subjects values (1, 'Physics', 'physics');
    insert into public.categories values (1, 'JEE', 'jee');
    insert into public.learning_goals values (1, 'JEE', 'jee'), (2, 'NEET', 'neet');
    insert into public.class_levels values
      (2, 'Class 11', 'class-11'), (4, 'Dropper', 'dropper');
    insert into public.chapters values
      (80, 1, 'Basic Mathematics for Physics', 'basic-mathematics-for-physics');
    insert into public.teachers values
      (1, 'Amit Bijarnia', 'amit-bijarnia', true);
    insert into public.teacher_aliases (teacher_id, alias, status)
      values (1, 'ABJ Sir', 'verified');
    insert into public.teacher_institutes values (1, 1);
    insert into public.teacher_subjects values (1, 1);
    insert into public.teacher_learning_goals values (1, 1);
    insert into public.playlists (
      id, title, teacher, channel_id, subject_id, category_id, content_type,
      language, difficulty, class_levels, audience_focus, youtube_playlist_id
    ) values (
      388, 'Mathematical Tools and Basic Maths — ABJ Sir', 'ABJ Sir', 1, 1, 1,
      'full-course', 'hinglish', 'advanced', array['11th', 'Dropper'], '11th',
      'PL_A4M5IAkMaev6ovGTwhfLLidWzCveoHZ'
    );
    insert into public.playlist_learning_goals values (388, 1), (388, 2);
    insert into public.playlist_class_levels values (388, 2), (388, 4);
  `);
  for (let index = 0; index < VIDEO_IDS.length; index += 1) {
    const videoId = 4430 + index;
    await pg.query(
      "insert into public.videos values ($1, $2, 80, 1, 1)",
      [videoId, VIDEO_IDS[index]],
    );
    await pg.query(
      "insert into public.playlist_videos values (388, $1, $2)",
      [videoId, index + 1],
    );
    await pg.query(
      "insert into public.video_learning_goals values ($1, 1), ($1, 2)",
      [videoId],
    );
    await pg.query(
      "insert into public.video_class_levels values ($1, 2), ($1, 4)",
      [videoId],
    );
  }
}

let pg;
beforeEach(async () => {
  pg = new PGlite();
  await pg.exec(WORLD);
  await seed(pg);
});

describe("course 388 repair package", () => {
  it("links Amit Bijarnia and removes only the NEET scope", async () => {
    await pg.exec(SQL);

    const course = await pg.query(
      "select source_title, title_review_status, faculty_credit_status from public.playlists where id = 388",
    );
    expect(course.rows[0]).toEqual({
      source_title: "Mathematical Tools - IIT JEE Physics by Best Kota Faculty",
      title_review_status: "approved",
      faculty_credit_status: "identified",
    });

    const faculty = await pg.query(
      "select teacher_id, role, position from public.playlist_teachers where playlist_id = 388",
    );
    expect(faculty.rows).toEqual([{ teacher_id: 1, role: "instructor", position: 1 }]);

    const playlistGoals = await pg.query(
      "select learning_goal_id from public.playlist_learning_goals where playlist_id = 388 order by 1",
    );
    expect(playlistGoals.rows.map((row) => Number(row.learning_goal_id))).toEqual([1]);
    const videoGoals = await pg.query(
      "select learning_goal_id, count(*)::int as n from public.video_learning_goals group by 1 order by 1",
    );
    expect(videoGoals.rows).toEqual([{ learning_goal_id: 1, n: 35 }]);
  });

  it("preserves all lessons, exact order, chapter and class scopes", async () => {
    await pg.exec(SQL);
    const lessons = await pg.query(`
      select v.youtube_video_id, pv.position, v.chapter_id
        from public.playlist_videos pv join public.videos v on v.id = pv.video_id
       where pv.playlist_id = 388 order by pv.position
    `);
    expect(lessons.rows.map((row) => row.youtube_video_id)).toEqual(VIDEO_IDS);
    expect(lessons.rows.every((row, index) => row.position === index + 1)).toBe(true);
    expect(lessons.rows.every((row) => Number(row.chapter_id) === 80)).toBe(true);
    const classes = await pg.query(
      "select class_level_id, count(*)::int as n from public.video_class_levels group by 1 order by 1",
    );
    expect(classes.rows).toEqual([
      { class_level_id: 2, n: 35 },
      { class_level_id: 4, n: 35 },
    ]);
  });

  it("is rerunnable without changing the desired result", async () => {
    await pg.exec(SQL);
    await pg.exec(SQL);
    const links = await pg.query(
      "select count(*)::int as n from public.playlist_teachers where playlist_id = 388",
    );
    expect(links.rows[0].n).toBe(1);
  });

  it("rolls back if the course metadata changed", async () => {
    await pg.exec("update public.playlists set title = 'Changed' where id = 388");
    await expect(pg.exec(SQL)).rejects.toThrow(/metadata drifted/i);
    await pg.exec("rollback");
    const links = await pg.query("select count(*)::int as n from public.playlist_teachers");
    expect(links.rows[0].n).toBe(0);
  });

  it("rolls back if the source lesson order changed", async () => {
    await pg.exec("update public.playlist_videos set position = 99 where video_id = 4430");
    await expect(pg.exec(SQL)).rejects.toThrow(/video set or order drifted/i);
  });

  it("refuses to alter globally shared video scope", async () => {
    await pg.exec(`
      insert into public.playlists (
        id, title, teacher, channel_id, subject_id, category_id, content_type,
        language, difficulty, class_levels, audience_focus, youtube_playlist_id
      ) values (
        999, 'Other', 'Other', 1, 1, 1, 'full-course', 'hinglish', 'advanced',
        array['11th'], '11th', 'PL_other'
      );
      insert into public.playlist_videos values (999, 4430, 1);
    `);
    await expect(pg.exec(SQL)).rejects.toThrow(/shared by another course/i);
  });

  it("refuses to overwrite another faculty decision", async () => {
    await pg.exec(`
      insert into public.teachers values (77, 'Other Teacher', 'other-teacher', true);
      insert into public.playlist_teachers values (388, 77, 'instructor', 1);
    `);
    await expect(pg.exec(SQL)).rejects.toThrow(/different or multi-faculty/i);
  });
});
