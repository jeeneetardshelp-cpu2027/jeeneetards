-- fix_course5_lesson_order_2026-07-29.sql
--
-- Course 5 — Rectilinear Motion (Kinematics), ABJ Sir / Mohit Tyagi.
-- Lessons 6 and 7 are swapped relative to the lecture numbering in the
-- video titles:
--   position 6 -> video 11  "#7 Examples on motion under gravity with graph…"
--   position 7 -> video 12  "#6 Example motion under gravity…"
-- Swap the two positions so the sequence follows #1…#10.
--
-- Verified against production 2026-07-29 via read-only REST query
-- (playlist_videos?playlist_id=eq.5&order=position).
-- Reversible: running the same UPDATE again swaps them back.
-- No unique constraint exists on (playlist_id, position), so a single
-- atomic UPDATE is safe (the unique key is (playlist_id, video_id)).

begin;

update public.playlist_videos
   set position = case video_id when 11 then 7 when 12 then 6 end
 where playlist_id = 5
   and video_id in (11, 12)
   and position in (6, 7);   -- refuse to touch rows that moved since review

-- Abort the transaction unless the order is now exactly as intended.
do $$
declare
  v6 bigint;
  v7 bigint;
begin
  select video_id into v6 from public.playlist_videos
   where playlist_id = 5 and position = 6;
  select video_id into v7 from public.playlist_videos
   where playlist_id = 5 and position = 7;
  if v6 is distinct from 12 or v7 is distinct from 11 then
    raise exception
      'course 5 lesson swap failed verification: pos6=video %, pos7=video %',
      v6, v7;
  end if;
end $$;

commit;
