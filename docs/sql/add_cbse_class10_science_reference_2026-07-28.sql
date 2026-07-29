-- CBSE Boards Gate 1: create-only Class 10 Science reference data.
-- Owner-approved on 2026-07-28.
--
-- This transaction inserts exactly one subject and 13 chapters. It performs
-- no content import or release action.

begin;

do $cbse_science_gate_1$
declare
  v_subject_id bigint;
  v_subject_rows integer;
  v_chapter_rows integer;
  v_jee_fingerprint text;
begin
  if exists (select 1 from public.app_environment) then
    raise exception
      'refusing CBSE Science Gate 1: app_environment is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 147
     or (select count(*) from public.videos) <> 1873
     or (select count(*) from public.playlist_videos) <> 1877
     or (select count(*) from public.chapters) <> 146 then
    raise exception 'refusing CBSE Science Gate 1: catalogue baseline drifted';
  end if;

  if not exists (
    select 1 from public.boards where id = 1 and slug = 'cbse'
  ) then
    raise exception
      'refusing CBSE Science Gate 1: CBSE board prerequisite is missing';
  end if;

  if not exists (
    select 1 from public.learning_goals where slug = 'school'
  ) then
    raise exception
      'refusing CBSE Science Gate 1: school learning goal is missing';
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
      'refusing CBSE Science Gate 1: JEE fingerprint mismatch (%)',
      v_jee_fingerprint;
  end if;

  if exists (
    select 1 from public.subjects
    where name = 'Science' or slug = 'science'
  ) then
    raise exception
      'refusing CBSE Science Gate 1: subject name or slug already exists';
  end if;

  if exists (
    select 1
    from public.chapters
    where name in (
      'Chemical Reactions and Equations',
      'Acids, Bases and Salts',
      'Metals and Non-metals',
      'Carbon and its Compounds',
      'Life Processes',
      'Control and Coordination',
      'How do Organisms Reproduce?',
      'Heredity',
      'Light: Reflection and Refraction',
      'The Human Eye and the Colourful World',
      'Electricity',
      'Magnetic Effects of Electric Current',
      'Our Environment'
    )
  ) then
    raise exception
      'refusing CBSE Science Gate 1: reviewed chapter name already exists';
  end if;

  insert into public.subjects (name, slug, display_order)
  values ('Science', 'science', 6)
  returning id into v_subject_id;
  get diagnostics v_subject_rows = row_count;

  if v_subject_rows <> 1 or v_subject_id is null then
    raise exception
      'refusing CBSE Science Gate 1: expected one subject insert, received %',
      v_subject_rows;
  end if;

  insert into public.chapters (subject_id, name, slug, display_order)
  values
    (v_subject_id, 'Chemical Reactions and Equations', 'chemical-reactions-and-equations', 1),
    (v_subject_id, 'Acids, Bases and Salts', 'acids-bases-and-salts', 2),
    (v_subject_id, 'Metals and Non-metals', 'metals-and-non-metals', 3),
    (v_subject_id, 'Carbon and its Compounds', 'carbon-and-its-compounds', 4),
    (v_subject_id, 'Life Processes', 'life-processes', 5),
    (v_subject_id, 'Control and Coordination', 'control-and-coordination', 6),
    (v_subject_id, 'How do Organisms Reproduce?', 'how-do-organisms-reproduce', 7),
    (v_subject_id, 'Heredity', 'heredity', 8),
    (v_subject_id, 'Light: Reflection and Refraction', 'light-reflection-and-refraction', 9),
    (v_subject_id, 'The Human Eye and the Colourful World', 'the-human-eye-and-the-colourful-world', 10),
    (v_subject_id, 'Electricity', 'electricity', 11),
    (v_subject_id, 'Magnetic Effects of Electric Current', 'magnetic-effects-of-electric-current', 12),
    (v_subject_id, 'Our Environment', 'our-environment', 13);
  get diagnostics v_chapter_rows = row_count;

  if v_chapter_rows <> 13 then
    raise exception
      'refusing CBSE Science Gate 1: expected 13 chapter inserts, received %',
      v_chapter_rows;
  end if;

  if (select count(*) from public.subjects where id = v_subject_id) <> 1
     or (select count(*) from public.chapters where subject_id = v_subject_id) <> 13
     or (select count(*) from public.chapters) <> 159 then
    raise exception
      'refusing CBSE Science Gate 1: unexpected post-insert counts';
  end if;
end
$cbse_science_gate_1$;

select
  s.id as subject_id,
  s.name as subject_name,
  s.slug as subject_slug,
  count(c.id)::integer as chapters_created
from public.subjects s
join public.chapters c on c.subject_id = s.id
where s.slug = 'science'
group by s.id, s.name, s.slug;

select
  c.id,
  c.name,
  c.slug,
  c.display_order
from public.chapters c
join public.subjects s on s.id = c.subject_id
where s.slug = 'science'
order by c.display_order;

commit;
