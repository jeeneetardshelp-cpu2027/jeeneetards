-- CBSE Boards Gate 1: Class 10 Mathematics reference data.
-- Owner-approved revision on 2026-07-29:
-- reuse four exact existing chapters and create the remaining ten.

begin;

do $cbse_mathematics_gate_1$
declare
  v_chapter_rows integer;
  v_jee_fingerprint text;
begin
  if exists (select 1 from public.app_environment) then
    raise exception
      'refusing CBSE Mathematics Gate 1: app_environment is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 148
     or (select count(*) from public.videos) <> 1882
     or (select count(*) from public.playlist_videos) <> 1886
     or (select count(*) from public.chapters) <> 159 then
    raise exception
      'refusing CBSE Mathematics Gate 1: catalogue baseline drifted';
  end if;

  if not exists (
    select 1
    from public.subjects
    where id = 3 and name = 'Mathematics' and slug = 'mathematics'
  ) then
    raise exception
      'refusing CBSE Mathematics Gate 1: Mathematics subject id 3 is missing';
  end if;

  if not exists (
    select 1 from public.boards where id = 1 and slug = 'cbse'
  ) or not exists (
    select 1 from public.learning_goals where slug = 'school'
  ) then
    raise exception
      'refusing CBSE Mathematics Gate 1: school/CBSE prerequisites are missing';
  end if;

  select md5(
    coalesce((
      select string_agg(row_to_json(x)::text, '|' order by x.id)
      from (
        select
          p.id,
          p.title,
          p.teacher,
          p.youtube_playlist_id,
          p.category_id,
          p.subject_id,
          p.class_levels,
          p.audience_focus,
          p.content_type,
          p.language,
          p.difficulty
        from public.playlists p
        join public.playlist_learning_goals plg on plg.playlist_id = p.id
        join public.learning_goals lg on lg.id = plg.learning_goal_id
        where lg.slug = 'jee'
      ) x
    ), '')
    || '|'
    || coalesce((
      select string_agg(
        row_to_json(y)::text,
        '|' order by y.playlist_id, y.position, y.id
      )
      from (
        select pv.id, pv.playlist_id, pv.video_id, pv.position
        from public.playlist_videos pv
        join public.playlist_learning_goals plg
          on plg.playlist_id = pv.playlist_id
        join public.learning_goals lg on lg.id = plg.learning_goal_id
        where lg.slug = 'jee'
      ) y
    ), '')
  ) into v_jee_fingerprint;

  if v_jee_fingerprint <> 'd7aae3ce7635401ebeffe97e627048bc' then
    raise exception
      'refusing CBSE Mathematics Gate 1: JEE fingerprint mismatch (%)',
      v_jee_fingerprint;
  end if;

  if (
    select count(*)
    from public.chapters
    where subject_id = 3
      and (id, name, slug) in (
        (62, 'Statistics', 'statistics'),
        (64, 'Circles', 'circles'),
        (66, 'Probability', 'probability'),
        (76, 'Quadratic Equations', 'quadratic-equations')
      )
  ) <> 4 then
    raise exception
      'refusing CBSE Mathematics Gate 1: reviewed reusable chapters differ';
  end if;

  if exists (
    select 1
    from public.chapters
    where subject_id = 3
      and (
        name in (
          'Real Numbers',
          'Polynomials',
          'Pair of Linear Equations in Two Variables',
          'Arithmetic Progressions',
          'Triangles',
          'Coordinate Geometry',
          'Introduction to Trigonometry',
          'Some Applications of Trigonometry',
          'Areas Related to Circles',
          'Surface Areas and Volumes'
        )
        or slug in (
          'real-numbers',
          'polynomials',
          'pair-of-linear-equations-in-two-variables',
          'arithmetic-progressions',
          'triangles',
          'coordinate-geometry',
          'introduction-to-trigonometry',
          'some-applications-of-trigonometry',
          'areas-related-to-circles',
          'surface-areas-and-volumes'
        )
      )
  ) then
    raise exception
      'refusing CBSE Mathematics Gate 1: a create-only chapter already exists';
  end if;

  insert into public.chapters (subject_id, name, slug, display_order)
  values
    (3, 'Real Numbers', 'real-numbers', 0),
    (3, 'Polynomials', 'polynomials', 0),
    (3, 'Pair of Linear Equations in Two Variables', 'pair-of-linear-equations-in-two-variables', 0),
    (3, 'Arithmetic Progressions', 'arithmetic-progressions', 0),
    (3, 'Triangles', 'triangles', 0),
    (3, 'Coordinate Geometry', 'coordinate-geometry', 0),
    (3, 'Introduction to Trigonometry', 'introduction-to-trigonometry', 0),
    (3, 'Some Applications of Trigonometry', 'some-applications-of-trigonometry', 0),
    (3, 'Areas Related to Circles', 'areas-related-to-circles', 0),
    (3, 'Surface Areas and Volumes', 'surface-areas-and-volumes', 0);
  get diagnostics v_chapter_rows = row_count;

  if v_chapter_rows <> 10
     or (select count(*) from public.chapters) <> 169 then
    raise exception
      'refusing CBSE Mathematics Gate 1: unexpected insert result';
  end if;
end
$cbse_mathematics_gate_1$;

select
  c.id,
  c.name,
  c.slug,
  case
    when c.id in (62, 64, 66, 76) then 'reused'
    else 'created'
  end as gate_action
from public.chapters c
where c.subject_id = 3
  and c.name in (
    'Real Numbers',
    'Polynomials',
    'Pair of Linear Equations in Two Variables',
    'Quadratic Equations',
    'Arithmetic Progressions',
    'Triangles',
    'Coordinate Geometry',
    'Introduction to Trigonometry',
    'Some Applications of Trigonometry',
    'Circles',
    'Areas Related to Circles',
    'Surface Areas and Volumes',
    'Statistics',
    'Probability'
  )
order by c.name;

commit;
