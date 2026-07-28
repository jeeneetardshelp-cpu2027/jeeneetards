-- CBSE Boards MVP Gate 1: create-only Class 10 Social Science reference data.
-- Owner-approved on 2026-07-28.
--
-- This transaction inserts exactly one subject and 22 chapters. It performs
-- no UPDATE, DELETE, ALTER, DROP, content import, or release/deploy action.

begin;

do $cbse_sst_gate_1$
declare
  v_subject_id bigint;
  v_subject_rows integer;
  v_chapter_rows integer;
  v_jee_fingerprint text;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing CBSE SST Gate 1: app_environment is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 143
     or (select count(*) from public.videos) <> 1855
     or (select count(*) from public.playlist_videos) <> 1859
     or (select count(*) from public.chapters) <> 124 then
    raise exception 'refusing CBSE SST Gate 1: catalogue baseline drifted';
  end if;

  if not exists (
    select 1 from public.boards where id = 1 and slug = 'cbse'
  ) then
    raise exception 'refusing CBSE SST Gate 1: CBSE board prerequisite is missing';
  end if;

  if not exists (
    select 1 from public.learning_goals where slug = 'school'
  ) then
    raise exception 'refusing CBSE SST Gate 1: school learning goal is missing';
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
      'refusing CBSE SST Gate 1: JEE fingerprint mismatch (%)',
      v_jee_fingerprint;
  end if;

  if exists (
    select 1 from public.subjects
    where name = 'Social Science' or slug = 'social-science'
  ) then
    raise exception 'refusing CBSE SST Gate 1: subject name or slug already exists';
  end if;

  insert into public.subjects (name, slug, display_order)
  values ('Social Science', 'social-science', 5)
  returning id into v_subject_id;
  get diagnostics v_subject_rows = row_count;

  if v_subject_rows <> 1 or v_subject_id is null then
    raise exception
      'refusing CBSE SST Gate 1: expected one subject insert, received %',
      v_subject_rows;
  end if;

  insert into public.chapters (subject_id, name, slug, display_order)
  values
    (v_subject_id, 'The Rise of Nationalism in Europe', 'the-rise-of-nationalism-in-europe', 1),
    (v_subject_id, 'Nationalism in India', 'nationalism-in-india', 2),
    (v_subject_id, 'The Making of a Global World', 'the-making-of-a-global-world', 3),
    (v_subject_id, 'The Age of Industrialisation', 'the-age-of-industrialisation', 4),
    (v_subject_id, 'Print Culture and the Modern World', 'print-culture-and-the-modern-world', 5),
    (v_subject_id, 'Resources and Development', 'resources-and-development', 6),
    (v_subject_id, 'Forest and Wildlife Resources', 'forest-and-wildlife-resources', 7),
    (v_subject_id, 'Water Resources', 'water-resources', 8),
    (v_subject_id, 'Agriculture', 'agriculture', 9),
    (v_subject_id, 'Minerals and Energy Resources', 'minerals-and-energy-resources', 10),
    (v_subject_id, 'Manufacturing Industries', 'manufacturing-industries', 11),
    (v_subject_id, 'Lifelines of National Economy', 'lifelines-of-national-economy', 12),
    (v_subject_id, 'Power Sharing', 'power-sharing', 13),
    (v_subject_id, 'Federalism', 'federalism', 14),
    (v_subject_id, 'Gender, Religion and Caste', 'gender-religion-and-caste', 15),
    (v_subject_id, 'Political Parties', 'political-parties', 16),
    (v_subject_id, 'Outcomes of Democracy', 'outcomes-of-democracy', 17),
    (v_subject_id, 'Development', 'development', 18),
    (v_subject_id, 'Sectors of the Indian Economy', 'sectors-of-the-indian-economy', 19),
    (v_subject_id, 'Money and Credit', 'money-and-credit', 20),
    (v_subject_id, 'Globalisation and the Indian Economy', 'globalisation-and-the-indian-economy', 21),
    (v_subject_id, 'Consumer Rights', 'consumer-rights', 22);
  get diagnostics v_chapter_rows = row_count;

  if v_chapter_rows <> 22 then
    raise exception
      'refusing CBSE SST Gate 1: expected 22 chapter inserts, received %',
      v_chapter_rows;
  end if;

  if (select count(*) from public.subjects where id = v_subject_id) <> 1
     or (select count(*) from public.chapters where subject_id = v_subject_id) <> 22
     or (select count(*) from public.chapters) <> 146 then
    raise exception 'refusing CBSE SST Gate 1: unexpected post-insert counts';
  end if;
end
$cbse_sst_gate_1$;

select
  s.id as subject_id,
  s.name as subject_name,
  s.slug as subject_slug,
  count(c.id)::integer as chapters_created
from public.subjects s
join public.chapters c on c.subject_id = s.id
where s.slug = 'social-science'
group by s.id, s.name, s.slug;

select
  c.id,
  c.name,
  c.slug,
  c.display_order
from public.chapters c
join public.subjects s on s.id = c.subject_id
where s.slug = 'social-science'
order by c.display_order;

commit;
