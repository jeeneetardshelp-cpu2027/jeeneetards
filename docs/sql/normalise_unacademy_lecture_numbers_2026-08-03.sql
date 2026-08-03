-- Normalise the abbreviated Unacademy lecture numbering.
--
-- The Unacademy import left 31 lessons numbered "- L14" while their
-- siblings read "— Lecture 14". In course 341 (Chemical Bonding) the two styles
-- sit in the SAME course -- lessons 1-13 read "Lecture", 14-15 read "L" -- which
-- is the only mixed-numbering course in the catalogue. Courses 342 and 343 are
-- internally consistent but use the minority form; 52 other courses use the
-- em-dash "Lecture N" style, so all 31 are moved to it together
-- rather than fixing only the two that visibly clash.
--
-- Titles only. source_title still holds YouTube's original, so this reverts with
-- `update videos set title = source_title` for these ids. Every row is matched
-- on its exact current title, so anything already renamed is left alone and the
-- count assertion below catches it.
--
-- Deliberately NOT touched: the 70 Competishun+ lessons using "L-3" or "(L-6)".
-- Those are consistent within their own courses and predate this work; changing
-- them is a separate editorial decision, not a defect fix.
do $$
declare
  v_channel_id bigint;
  v_updated integer;
  v_total integer := 0;
begin
  select id into strict v_channel_id from public.institutes_channels where name = 'Unacademy NEET';

  update public.videos set title = 'Chemical Bonding — Lecture 14'
   where id = 3911 and channel_id = v_channel_id and title = 'Chemical Bonding - L14';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Chemical Bonding — Lecture 15'
   where id = 3912 and channel_id = v_channel_id and title = 'Chemical Bonding - L15';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Evolution — Lecture 1'
   where id = 3913 and channel_id = v_channel_id and title = 'Evolution - L1';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Evolution — Lecture 2'
   where id = 3914 and channel_id = v_channel_id and title = 'Evolution - L2';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Evolution — Lecture 3'
   where id = 3915 and channel_id = v_channel_id and title = 'Evolution - L3';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Evolution — Lecture 4'
   where id = 3916 and channel_id = v_channel_id and title = 'Evolution - L4';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Evolution — Lecture 5'
   where id = 3917 and channel_id = v_channel_id and title = 'Evolution - L5';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Evolution — Lecture 6'
   where id = 3918 and channel_id = v_channel_id and title = 'Evolution - L6';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Evolution — Lecture 7'
   where id = 3919 and channel_id = v_channel_id and title = 'Evolution - L7';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Theories of Evolution — Lecture 1'
   where id = 3920 and channel_id = v_channel_id and title = 'Theories of Evolution - L1';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Theories of Evolution — Lecture 2'
   where id = 3921 and channel_id = v_channel_id and title = 'Theories of Evolution - L2';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Theories of Evolution — Lecture 3'
   where id = 3922 and channel_id = v_channel_id and title = 'Theories of Evolution - L3';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Theories of Evolution — Lecture 4'
   where id = 3923 and channel_id = v_channel_id and title = 'Theories of Evolution - L4';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Theories of Evolution — Lecture 5'
   where id = 3924 and channel_id = v_channel_id and title = 'Theories of Evolution - L5';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Theories of Evolution — Lecture 6'
   where id = 3925 and channel_id = v_channel_id and title = 'Theories of Evolution - L6';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Theories of Evolution — Lecture 7'
   where id = 3926 and channel_id = v_channel_id and title = 'Theories of Evolution - L7';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Theories of Evolution — Lecture 8'
   where id = 3927 and channel_id = v_channel_id and title = 'Theories of Evolution - L8';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Principles of Inheritance & Variation — Lecture 1'
   where id = 3928 and channel_id = v_channel_id and title = 'Principles of Inheritance & Variation - L1';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Principles of Inheritance & Variation — Lecture 2'
   where id = 3929 and channel_id = v_channel_id and title = 'Principles of Inheritance & Variation - L2';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Principles of Inheritance & Variation — Lecture 3'
   where id = 3930 and channel_id = v_channel_id and title = 'Principles of Inheritance & Variation - L3';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Principles of Inheritance & Variation — Lecture 4'
   where id = 3931 and channel_id = v_channel_id and title = 'Principles of Inheritance & Variation - L4';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Principles of Inheritance & Variation — Lecture 5'
   where id = 3932 and channel_id = v_channel_id and title = 'Principles of Inheritance & Variation - L5';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Principles of Inheritance & Variation — Lecture 6'
   where id = 3933 and channel_id = v_channel_id and title = 'Principles of Inheritance & Variation - L6';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Principles of Inheritance & Variation — Lecture 7'
   where id = 3934 and channel_id = v_channel_id and title = 'Principles of Inheritance & Variation - L7';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Principles of Inheritance & Variation — Lecture 8'
   where id = 3935 and channel_id = v_channel_id and title = 'Principles of Inheritance & Variation - L8';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Principles of Inheritance & Variation — Lecture 9'
   where id = 3936 and channel_id = v_channel_id and title = 'Principles of Inheritance & Variation - L9';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Principles of Inheritance & Variation — Lecture 10'
   where id = 3937 and channel_id = v_channel_id and title = 'Principles of Inheritance & Variation - L10';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Principles of Inheritance & Variation — Lecture 11'
   where id = 3938 and channel_id = v_channel_id and title = 'Principles of Inheritance & Variation - L11';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Principles of Inheritance & Variation — Lecture 12'
   where id = 3939 and channel_id = v_channel_id and title = 'Principles of Inheritance & Variation - L12';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Principles of Inheritance & Variation — Lecture 13'
   where id = 3940 and channel_id = v_channel_id and title = 'Principles of Inheritance & Variation - L13';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos set title = 'Principles of Inheritance & Variation — Lecture 14'
   where id = 3941 and channel_id = v_channel_id and title = 'Principles of Inheritance & Variation - L14';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;

  if v_total <> 31 then
    raise exception 'expected to rename 31 lessons, renamed %', v_total;
  end if;

  -- No abbreviated form may remain on this channel.
  if exists (
    select 1 from public.videos
    where channel_id = v_channel_id and title ~* '[-–—][[:space:]]*L[[:space:]]*-?[0-9]+[[:space:]]*$'
  ) then
    raise exception 'an abbreviated lecture number is still present on this channel';
  end if;
end $$;
