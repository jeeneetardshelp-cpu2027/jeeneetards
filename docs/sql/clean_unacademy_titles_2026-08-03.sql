-- Clean the Unacademy NEET titles to the catalogue's own standard.
--
-- These 44 lessons and 3 courses were imported with YouTube's raw titles, which
-- carry five pipe-separated branding segments ("… | Class 11 | Unacademy NEET |
-- LIVE DAILY | NEET Chemistry | Ashwani Tyagi"). They are the ONLY titles in the
-- catalogue that fail src/titleQuality.js -- 33 of the 44 lessons are BLOCKING
-- (over 90 characters), and every other one of the 3,908 lessons is clean.
--
-- The content itself is sound: all 44 video ids were independently re-verified
-- against YouTube's oEmbed API, all resolve, all are hosted on Unacademy NEET,
-- and none shows the fabrication signatures that caused this channel's data to
-- be discarded on 31 July. This migration only rewrites display titles.
--
-- source_title keeps YouTube's original verbatim, so the change is reversible:
--   update public.videos set title = source_title where id in (...)
-- Every row is matched on its exact current title, so if anything has already
-- been renamed this file changes nothing rather than guessing.
do $$
declare
  v_channel_id bigint;
  v_updated integer;
  v_total integer := 0;
begin
  select id into strict v_channel_id from public.institutes_channels where name = 'Unacademy NEET';

  update public.playlists
     set title = 'Chemical Bonding',
         source_title = coalesce(source_title, 'Chemical Bonding - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Tyagi')
   where id = 341 and channel_id = v_channel_id and title = 'Chemical Bonding - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Tyagi';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;

  update public.playlists
     set title = 'Evolution',
         source_title = coalesce(source_title, 'NEET: Evolution - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh')
   where id = 342 and channel_id = v_channel_id and title = 'NEET: Evolution - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;

  update public.playlists
     set title = 'Principles of Inheritance and Variation',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance and Variation - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh')
   where id = 343 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance and Variation - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;

  if v_total <> 3 then
    raise exception 'expected to rename 3 courses, renamed %', v_total;
  end if;

  v_total := 0;
  update public.videos
     set title = 'Chemical Bonding — Lecture 1',
         source_title = coalesce(source_title, 'Chemical Bonding - Lecture 1 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3898 and channel_id = v_channel_id and title = 'Chemical Bonding - Lecture 1 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Chemical Bonding — Lecture 2',
         source_title = coalesce(source_title, 'Chemical Bonding - Lecture 2 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3899 and channel_id = v_channel_id and title = 'Chemical Bonding - Lecture 2 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Chemical Bonding — Lecture 3',
         source_title = coalesce(source_title, 'Chemical Bonding - Lecture 3 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3900 and channel_id = v_channel_id and title = 'Chemical Bonding - Lecture 3 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Chemical Bonding — Lecture 4',
         source_title = coalesce(source_title, 'Chemical Bonding - Lecture 4 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3901 and channel_id = v_channel_id and title = 'Chemical Bonding - Lecture 4 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Chemical Bonding — Lecture 5',
         source_title = coalesce(source_title, 'Chemical Bonding - Lecture 5 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3902 and channel_id = v_channel_id and title = 'Chemical Bonding - Lecture 5 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Chemical Bonding — Lecture 6',
         source_title = coalesce(source_title, 'Chemical Bonding - Lecture 6 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3903 and channel_id = v_channel_id and title = 'Chemical Bonding - Lecture 6 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Chemical Bonding — Lecture 7',
         source_title = coalesce(source_title, 'Chemical Bonding - Lecture 7 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3904 and channel_id = v_channel_id and title = 'Chemical Bonding - Lecture 7 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Chemical Bonding — Lecture 8',
         source_title = coalesce(source_title, 'Chemical Bonding - Lecture 8 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3905 and channel_id = v_channel_id and title = 'Chemical Bonding - Lecture 8 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Chemical Bonding — Lecture 9',
         source_title = coalesce(source_title, 'Chemical Bonding - Lecture 9 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3906 and channel_id = v_channel_id and title = 'Chemical Bonding - Lecture 9 | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Chemical Bonding — Lecture 10',
         source_title = coalesce(source_title, 'Chemical Bonding - Lecture 10 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3907 and channel_id = v_channel_id and title = 'Chemical Bonding - Lecture 10 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Chemical Bonding — Lecture 11',
         source_title = coalesce(source_title, 'Chemical Bonding - Lecture 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3908 and channel_id = v_channel_id and title = 'Chemical Bonding - Lecture 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Chemical Bonding — Lecture 12',
         source_title = coalesce(source_title, 'Chemical Bonding - Lecture 12 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3909 and channel_id = v_channel_id and title = 'Chemical Bonding - Lecture 12 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Chemical Bonding — Lecture 13',
         source_title = coalesce(source_title, 'Chemical Bonding - Lecture 13 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3910 and channel_id = v_channel_id and title = 'Chemical Bonding - Lecture 13 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Chemical Bonding - L14',
         source_title = coalesce(source_title, 'Chemical Bonding - L14 | Special Bonds | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3911 and channel_id = v_channel_id and title = 'Chemical Bonding - L14 | Special Bonds | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Chemical Bonding - L15',
         source_title = coalesce(source_title, 'Chemical Bonding - L15 | Hydrogen | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir')
   where id = 3912 and channel_id = v_channel_id and title = 'Chemical Bonding - L15 | Hydrogen | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Evolution - L1',
         source_title = coalesce(source_title, 'NEET: Evolution - L1 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir')
   where id = 3913 and channel_id = v_channel_id and title = 'NEET: Evolution - L1 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Evolution - L2',
         source_title = coalesce(source_title, 'NEET: Evolution - L2 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3914 and channel_id = v_channel_id and title = 'NEET: Evolution - L2 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Evolution - L3',
         source_title = coalesce(source_title, 'NEET: Evolution - L3 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3915 and channel_id = v_channel_id and title = 'NEET: Evolution - L3 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Evolution - L4',
         source_title = coalesce(source_title, 'NEET: Evolution - L4 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3916 and channel_id = v_channel_id and title = 'NEET: Evolution - L4 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Evolution - L5',
         source_title = coalesce(source_title, 'NEET: Evolution - L5 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3917 and channel_id = v_channel_id and title = 'NEET: Evolution - L5 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Evolution - L6',
         source_title = coalesce(source_title, 'NEET: Evolution - L6 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3918 and channel_id = v_channel_id and title = 'NEET: Evolution - L6 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Evolution - L7',
         source_title = coalesce(source_title, 'NEET: Evolution - L7 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3919 and channel_id = v_channel_id and title = 'NEET: Evolution - L7 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Theories of Evolution - L1',
         source_title = coalesce(source_title, 'NEET: Theories of Evolution - L1 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3920 and channel_id = v_channel_id and title = 'NEET: Theories of Evolution - L1 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Theories of Evolution - L2',
         source_title = coalesce(source_title, 'NEET: Theories of Evolution - L2 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3921 and channel_id = v_channel_id and title = 'NEET: Theories of Evolution - L2 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Theories of Evolution - L3',
         source_title = coalesce(source_title, 'NEET: Theories of Evolution - L3 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3922 and channel_id = v_channel_id and title = 'NEET: Theories of Evolution - L3 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Theories of Evolution - L4',
         source_title = coalesce(source_title, 'NEET: Theories of Evolution - L4 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3923 and channel_id = v_channel_id and title = 'NEET: Theories of Evolution - L4 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Theories of Evolution - L5',
         source_title = coalesce(source_title, 'NEET: Theories of Evolution - L5 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3924 and channel_id = v_channel_id and title = 'NEET: Theories of Evolution - L5 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Theories of Evolution - L6',
         source_title = coalesce(source_title, 'NEET: Theories of Evolution - L6 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3925 and channel_id = v_channel_id and title = 'NEET: Theories of Evolution - L6 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Theories of Evolution - L7',
         source_title = coalesce(source_title, 'NEET: Theories of Evolution - L7 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3926 and channel_id = v_channel_id and title = 'NEET: Theories of Evolution - L7 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Theories of Evolution - L8',
         source_title = coalesce(source_title, 'NEET: Theories of Evolution - L8 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3927 and channel_id = v_channel_id and title = 'NEET: Theories of Evolution - L8 | Class 12 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Principles of Inheritance & Variation - L1',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance & Variation - L1 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir')
   where id = 3928 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance & Variation - L1 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Principles of Inheritance & Variation - L2',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance & Variation - L2 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir')
   where id = 3929 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance & Variation - L2 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Principles of Inheritance & Variation - L3',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance & Variation - L3 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir')
   where id = 3930 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance & Variation - L3 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Principles of Inheritance & Variation - L4',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance & Variation - L4 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir')
   where id = 3931 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance & Variation - L4 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Principles of Inheritance & Variation - L5',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance & Variation - L5 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir')
   where id = 3932 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance & Variation - L5 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Principles of Inheritance & Variation - L6',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance & Variation - L6 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir')
   where id = 3933 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance & Variation - L6 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Principles of Inheritance & Variation - L7',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance & Variation - L7 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir')
   where id = 3934 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance & Variation - L7 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Principles of Inheritance & Variation - L8',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance & Variation - L8 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir')
   where id = 3935 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance & Variation - L8 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Principles of Inheritance & Variation - L9',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance & Variation - L9 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir')
   where id = 3936 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance & Variation - L9 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Principles of Inheritance & Variation - L10',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance & Variation - L10 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir')
   where id = 3937 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance & Variation - L10 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Principles of Inheritance & Variation - L11',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance & Variation - L11 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir')
   where id = 3938 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance & Variation - L11 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Principles of Inheritance & Variation - L12',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance & Variation - L12 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir')
   where id = 3939 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance & Variation - L12 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Principles of Inheritance & Variation - L13',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance & Variation - L13 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir')
   where id = 3940 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance & Variation - L13 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;
  update public.videos
     set title = 'Principles of Inheritance & Variation - L14',
         source_title = coalesce(source_title, 'NEET: Principles of Inheritance & Variation - L14 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh')
   where id = 3941 and channel_id = v_channel_id and title = 'NEET: Principles of Inheritance & Variation - L14 | Live Daily 2.0 | Unacademy NEET | Pradeep Singh';
  get diagnostics v_updated = row_count;
  v_total := v_total + v_updated;

  if v_total <> 44 then
    raise exception 'expected to rename 44 lessons, renamed %', v_total;
  end if;

  -- Nothing on this channel may still carry a raw pipe-branded title.
  if exists (
    select 1 from public.videos
    where channel_id = v_channel_id and (length(title) > 90 or title like '%|%')
  ) then
    raise exception 'a lesson on this channel still has an unclean title';
  end if;
  if exists (
    select 1 from public.playlists
    where channel_id = v_channel_id and (length(title) > 90 or title like '%|%')
  ) then
    raise exception 'a course on this channel still has an unclean title';
  end if;
end $$;
