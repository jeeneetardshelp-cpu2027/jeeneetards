-- CBSE Boards Gate 1: create-only Class 10 Hindi Course B reference data.
-- Owner-approved on 2026-07-29.
--
-- This transaction inserts exactly one subject and 16 chapters. It performs
-- no content import, update, delete, schema migration, or release action.

begin;

do $cbse_hindi_b_gate_1$
declare
  v_subject_id bigint;
  v_subject_rows integer;
  v_chapter_rows integer;
  v_jee_fingerprint text;
begin
  if exists (select 1 from public.app_environment) then
    raise exception
      'refusing CBSE Hindi B Gate 1: app_environment is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 152
     or (select count(*) from public.videos) <> 1941
     or (select count(*) from public.playlist_videos) <> 1945
     or (select count(*) from public.chapters) <> 185 then
    raise exception 'refusing CBSE Hindi B Gate 1: catalogue baseline drifted';
  end if;

  if not exists (
    select 1 from public.boards where id = 1 and slug = 'cbse'
  ) then
    raise exception
      'refusing CBSE Hindi B Gate 1: CBSE board prerequisite is missing';
  end if;

  if not exists (
    select 1 from public.learning_goals where slug = 'school'
  ) then
    raise exception
      'refusing CBSE Hindi B Gate 1: school learning goal is missing';
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
      'refusing CBSE Hindi B Gate 1: JEE fingerprint mismatch (%)',
      v_jee_fingerprint;
  end if;

  if exists (
    select 1 from public.subjects
    where name = 'Hindi B' or slug = 'hindi-b'
  ) then
    raise exception
      'refusing CBSE Hindi B Gate 1: subject name or slug already exists';
  end if;

  if exists (
    select 1
    from public.chapters
    where name in (
      'कबीर की साखी',
      'मीरा के पद',
      'मनुष्यता',
      'पर्वत प्रदेश में पावस',
      'तोप',
      'कर चले हम फ़िदा',
      'आत्मत्राण',
      'बड़े भाई साहब',
      'डायरी का एक पन्ना',
      'तताँरा वामीरो कथा',
      'अब कहाँ दूसरे के दुख से दुखी होने वाले',
      'पतझर में टूटी पत्तियाँ',
      'कारतूस',
      'हरिहर काका',
      'सपनों के से दिन',
      'टोपी शुक्ला'
    )
  ) then
    raise exception
      'refusing CBSE Hindi B Gate 1: reviewed chapter name already exists';
  end if;

  insert into public.subjects (name, slug, display_order)
  values ('Hindi B', 'hindi-b', 8)
  returning id into v_subject_id;
  get diagnostics v_subject_rows = row_count;

  if v_subject_rows <> 1 or v_subject_id is null then
    raise exception
      'refusing CBSE Hindi B Gate 1: expected one subject insert, received %',
      v_subject_rows;
  end if;

  insert into public.chapters (subject_id, name, slug, display_order)
  values
    (v_subject_id, 'कबीर की साखी', 'kabir-ki-sakhi', 1),
    (v_subject_id, 'मीरा के पद', 'meera-ke-pad', 2),
    (v_subject_id, 'मनुष्यता', 'manushyata', 3),
    (v_subject_id, 'पर्वत प्रदेश में पावस', 'parvat-pradesh-mein-pavas', 4),
    (v_subject_id, 'तोप', 'top', 5),
    (v_subject_id, 'कर चले हम फ़िदा', 'kar-chale-hum-fida', 6),
    (v_subject_id, 'आत्मत्राण', 'aatmatran', 7),
    (v_subject_id, 'बड़े भाई साहब', 'bade-bhai-sahab', 8),
    (v_subject_id, 'डायरी का एक पन्ना', 'diary-ka-ek-panna', 9),
    (v_subject_id, 'तताँरा वामीरो कथा', 'tatara-vamiro-katha', 10),
    (v_subject_id, 'अब कहाँ दूसरे के दुख से दुखी होने वाले', 'ab-kahan-doosron-ke-dukh-se-dukhi-hone-wale', 11),
    (v_subject_id, 'पतझर में टूटी पत्तियाँ', 'patjhar-mein-tooti-pattiyan', 12),
    (v_subject_id, 'कारतूस', 'kartus', 13),
    (v_subject_id, 'हरिहर काका', 'harihar-kaka', 14),
    (v_subject_id, 'सपनों के से दिन', 'sapnon-ke-se-din', 15),
    (v_subject_id, 'टोपी शुक्ला', 'topi-shukla', 16);
  get diagnostics v_chapter_rows = row_count;

  if v_chapter_rows <> 16 then
    raise exception
      'refusing CBSE Hindi B Gate 1: expected 16 chapter inserts, received %',
      v_chapter_rows;
  end if;

  if (select count(*) from public.subjects where id = v_subject_id) <> 1
     or (select count(*) from public.chapters where subject_id = v_subject_id) <> 16
     or (select count(*) from public.chapters) <> 201 then
    raise exception
      'refusing CBSE Hindi B Gate 1: unexpected post-insert counts';
  end if;
end
$cbse_hindi_b_gate_1$;

select
  s.id as subject_id,
  s.name as subject_name,
  s.slug as subject_slug,
  count(c.id)::integer as chapters_created
from public.subjects s
join public.chapters c on c.subject_id = s.id
where s.slug = 'hindi-b'
group by s.id, s.name, s.slug;

select
  c.id,
  c.name,
  c.slug,
  c.display_order
from public.chapters c
join public.subjects s on s.id = c.subject_id
where s.slug = 'hindi-b'
order by c.display_order;

commit;
