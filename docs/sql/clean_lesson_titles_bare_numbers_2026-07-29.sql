-- clean_lesson_titles_bare_numbers_2026-07-29.sql
--
-- Follow-up to clean_lesson_titles_2026-07-29.sql. That pass keyed off the
-- repo's titleQuality rules, which flag "#4 ..." and "Lecture 4 ..." prefixes
-- but NOT a bare "1- ..." / "22 ...". Sixteen lessons therefore kept a leading
-- position number (visible in course 5, where lessons 1-3 read "1- Rectilinear
-- motion" beside the cleaned lessons 4-10), several of them also carrying a
-- pipe-less exam tail ("IIT JEE ADVANCED Free Videos").
--
-- Stripping the number alone is NOT safe: courses 67, 81 and 84 have adjacent
-- lessons whose remaining text is identical, so these titles are written out
-- individually with the same conventions as the main pass (source wording
-- kept, promo tails dropped, "(Part N)" only where a course genuinely repeats
-- a topic across consecutive lessons).
--
-- Same safety contract as the main pass: source_title already holds every
-- original, the update refuses rows edited since review, and the transaction
-- aborts unless every targeted lesson ends clean. Idempotent.

begin;

update public.videos v
   set title = n.new_title
  from (values
    -- Course 5 — Rectilinear Motion (Kinematics). Sources carry no topic
    -- beyond the chapter name, so the course convention is a bare title plus
    -- (Part N) for the repeats, exactly as the main pass did elsewhere.
    (1,   'Rectilinear Motion'),
    (2,   'Rectilinear Motion (Part 2)'),
    (3,   'Rectilinear Motion (Part 3)'),
    -- Course 47 — Atomic Structure. Sibling lesson 21 is the concept; this is
    -- the question set on it.
    (456, 'Questions on Line Spectrum of Atomic Hydrogen'),
    -- Course 67 — Differential Equations.
    (678, 'Differential Equations — Introduction'),
    (679, 'Differential Equations — Introduction (Part 2)'),
    (680, 'Differential Equations — Variable Separable'),
    (681, 'Differential Equations — Homogeneous and Linear'),
    (682, 'Differential Equations — Rate of Change and Orthogonal Trajectory'),
    -- Course 81 — Area Under Curves.
    (893, 'Area Under the Curves'),
    (894, 'Area Under the Curves (Part 2)'),
    -- Course 84 — Logarithms.
    (993, 'Logarithm — Introduction and Basic Formulae'),
    (994, 'Logarithm — Formulae and Examples'),
    (995, 'Logarithm — Inequalities and Examples'),
    (996, 'Logarithm — Characteristic and Mantissa'),
    (997, 'Logarithm — Number of Digits in an Integer')
  ) as n(id, new_title)
 where v.id = n.id
   and v.title = v.source_title;

do $$
declare
  n_bad int;
begin
  -- No targeted lesson may still open with a bare position number.
  select count(*) into n_bad
    from public.videos
   where id in (1, 2, 3, 456, 678, 679, 680, 681, 682, 893, 894, 993, 994, 995, 996, 997)
     and title ~ '^[[:space:]]*[0-9]{1,3}[[:space:]]*[-.):]?[[:space:]]';
  if n_bad <> 0 then
    raise exception 'bare-number title cleanup failed: % still numbered', n_bad;
  end if;

  -- And no course may now show the same lesson title twice.
  if exists (
    select 1
      from public.playlist_videos pv
      join public.videos v on v.id = pv.video_id
     group by pv.playlist_id, lower(btrim(v.title))
    having count(*) > 1
  ) then
    raise exception 'bare-number title cleanup created a duplicate title within a course';
  end if;
end $$;

commit;
