-- CBSE Class 10 Science Gate 2: additive reviewed faculty binding.
-- Owner decision: bcdcd82a-52dd-4f3a-b7da-75a1b637293e.
-- Run only after the reviewed mapped-v12 course import succeeds.

begin;

do $shobhit_science_faculty$
declare
  v_teacher_id bigint;
  created_teacher jsonb;
begin
  if (select count(*) from public.playlists) <> 148
     or (select count(*) from public.videos) <> 1882
     or (select count(*) from public.playlist_videos) <> 1886
     or (select count(*) from public.chapters) <> 159 then
    raise exception 'CBSE Science post-import catalogue baseline differs';
  end if;

  if (select count(*) from public.playlists
      where youtube_playlist_id = 'PLo9JtLytZaK1wxHXpkXanN_XNxhXg-aoV') <> 1 then
    raise exception 'reviewed Shobhit Nirwan Science course is missing or duplicated';
  end if;

  select id
    into v_teacher_id
    from public.teachers
   where slug = 'shobhit-nirwan'
      or lower(display_name) = lower('Shobhit Nirwan');

  if v_teacher_id is null then
    created_teacher := public.create_teacher(
      'Shobhit Nirwan',
      '[]'::jsonb,
      true,
      false
    );
    v_teacher_id := (created_teacher ->> 'teacher_id')::bigint;
  end if;

  insert into public.teacher_institutes (teacher_id, institute_id, is_primary)
  select v_teacher_id, p.channel_id, true
    from public.playlists p
   where p.youtube_playlist_id = 'PLo9JtLytZaK1wxHXpkXanN_XNxhXg-aoV'
  on conflict (teacher_id, institute_id) do nothing;

  insert into public.teacher_subjects (teacher_id, subject_id)
  select v_teacher_id, s.id
    from public.subjects s
   where s.name = 'Science'
  on conflict (teacher_id, subject_id) do nothing;

  insert into public.teacher_learning_goals (teacher_id, learning_goal_id)
  select v_teacher_id, lg.id
    from public.learning_goals lg
   where lg.slug = 'school'
  on conflict (teacher_id, learning_goal_id) do nothing;

  insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
  select p.id, v_teacher_id, 'instructor', 1
    from public.playlists p
   where p.youtube_playlist_id = 'PLo9JtLytZaK1wxHXpkXanN_XNxhXg-aoV'
  on conflict (playlist_id, teacher_id) do nothing;

  if not exists (
    select 1
      from public.playlists p
      join public.playlist_teachers pt on pt.playlist_id = p.id
      join public.teachers t on t.id = pt.teacher_id
     where p.youtube_playlist_id = 'PLo9JtLytZaK1wxHXpkXanN_XNxhXg-aoV'
       and t.id = v_teacher_id
       and t.display_name = 'Shobhit Nirwan'
       and t.verified
  ) then
    raise exception 'reviewed Shobhit Nirwan faculty binding failed';
  end if;
end;
$shobhit_science_faculty$;

select
  t.id as teacher_id,
  t.display_name,
  t.slug,
  t.verified,
  p.id as playlist_id,
  p.title
from public.teachers t
join public.playlist_teachers pt on pt.teacher_id = t.id
join public.playlists p on p.id = pt.playlist_id
where p.youtube_playlist_id = 'PLo9JtLytZaK1wxHXpkXanN_XNxhXg-aoV'
  and t.display_name = 'Shobhit Nirwan';

commit;
