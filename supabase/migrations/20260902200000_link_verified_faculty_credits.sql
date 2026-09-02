-- ---------------------------------------------------------------------------
-- Link ten courses to faculty who are ALREADY in the registry.
--
-- WHAT THIS IS. 168 courses name a teacher in free text with no
-- playlist_teachers row, so they are absent from /faculty and from the browse
-- teacher filter. Measured against production on 2026-09-02, that number is
-- misleading and most of it must NOT be linked:
--
--     168  named but unlinked
--     132  ... whose `teacher` is the CHANNEL's own name, not a person
--          (Competishun+ 76, Mohit Tyagi 32, Magnet Brains 10, ...). Linking
--          these would file institutes in the faculty directory.
--      26  ... needing a new identity, several of them not one person at all
--          ("Dr. Sachin Kapur & Pushpendu Sir" is two, "Sarvesh Sir, Pankaj
--          Sir & Amit Sir" is three, "ExpHub" is an institute)
--      10  ... whose name matches a VERIFIED teacher already in the registry
--
-- This package is those ten, and only those ten. The other 158 belong in the
-- Faculty Review queue (scan_free_text_teachers -> proposals -> approve or
-- reject), because they need a human to decide who somebody is. Nothing here
-- creates a teacher, an alias or a proposal.
--
-- WHAT IT DELIBERATELY DOES NOT DO. It leaves playlists.faculty_credit_status
-- alone. On production 'identified' is a strict subset of linked (64 of 238),
-- so it means "a person confirmed this credit", which an automatic name match
-- has not done. These ten stay 'pending' alongside the other 174 linked-but-
-- pending courses, and the review pass can promote them.
--
-- SAFETY. Every row re-checks its own assumptions at apply time against the
-- names, not the ids alone: if the registry has moved, a course has been
-- re-credited, or someone has already linked it differently, the statement
-- raises and the whole transaction rolls back rather than guessing. Linking
-- goes through set_playlist_teachers, the same entry point the admin Faculty
-- Review panel uses, so role and position invariants are whatever that
-- function says they are rather than something this file reinvents.
--
-- Rerunnable: a course that already has any link is skipped, so a second
-- apply cannot overwrite a richer credit added later by hand.
-- ---------------------------------------------------------------------------

begin;

do $$
declare
  -- playlist_id, the exact teachers.display_name expected, the registry id
  -- expected for that name, and the exact playlists.teacher text expected.
  v_rows constant jsonb := '[
    {"playlist": 146, "teacher_id": 21, "name": "Sudhanshu Kumar"},
    {"playlist": 391, "teacher_id": 33, "name": "Pradeep Singh"},
    {"playlist": 392, "teacher_id": 33, "name": "Pradeep Singh"},
    {"playlist": 393, "teacher_id": 34, "name": "Mahendra Singh"},
    {"playlist": 394, "teacher_id": 37, "name": "Seep Pahuja"},
    {"playlist": 395, "teacher_id": 38, "name": "Dr. Sachin Kapur"},
    {"playlist": 396, "teacher_id": 32, "name": "Ashwani Tyagi"},
    {"playlist": 397, "teacher_id": 33, "name": "Pradeep Singh"},
    {"playlist": 398, "teacher_id": 34, "name": "Mahendra Singh"},
    {"playlist": 399, "teacher_id": 35, "name": "Anu Gupta"}
  ]'::jsonb;
  r            jsonb;
  v_playlist   bigint;
  v_teacher    bigint;
  v_name       text;
  v_actual     text;
  v_linked     int;
  v_verified   boolean;
  v_done       int := 0;
  v_skipped    int := 0;
begin
  for r in select * from jsonb_array_elements(v_rows) loop
    v_playlist := (r->>'playlist')::bigint;
    v_teacher  := (r->>'teacher_id')::bigint;
    v_name     := r->>'name';

    -- 1. The registry entry must still be that person, and still verified.
    select t.verified into v_verified
      from public.teachers t
     where t.id = v_teacher and t.display_name = v_name;
    if not found then
      raise exception
        'teacher % is no longer id % with that display_name — re-measure before applying',
        v_name, v_teacher;
    end if;
    if not coalesce(v_verified, false) then
      raise exception
        'teacher % (id %) is no longer verified; this package only links verified faculty',
        v_name, v_teacher;
    end if;

    -- 2. The course must still carry exactly that free-text credit. If it has
    --    been re-credited since the measurement, this is not the same claim.
    select nullif(trim(coalesce(p.teacher, '')), '') into v_actual
      from public.playlists p where p.id = v_playlist;
    if v_actual is null then
      raise exception 'playlist % has no teacher text (or does not exist)', v_playlist;
    end if;
    if lower(regexp_replace(v_actual, '\s+', ' ', 'g')) <> lower(v_name) then
      raise exception
        'playlist % now credits "%", not "%" — re-measure before applying',
        v_playlist, v_actual, v_name;
    end if;

    -- 3. Never overwrite a credit somebody has already curated. A course that
    --    gained a link after the measurement is left exactly as it is.
    select count(*) into v_linked
      from public.playlist_teachers pt where pt.playlist_id = v_playlist;
    if v_linked > 0 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    perform public.set_playlist_teachers(v_playlist, array[v_teacher]);
    v_done := v_done + 1;
  end loop;

  raise notice 'linked % course(s); skipped % already-linked', v_done, v_skipped;

  -- Postflight, inside the transaction. The invariant is that none of the ten
  -- is left unlinked — NOT that each carries the id this file names, because a
  -- course skipped above was skipped precisely because somebody had already
  -- credited it, possibly to more than one teacher. Asserting my own id there
  -- would fail the transaction for the case the skip exists to protect.
  if exists (
    select 1
      from jsonb_array_elements(v_rows) x
     where not exists (
       select 1 from public.playlist_teachers pt
        where pt.playlist_id = (x->>'playlist')::bigint
     )
  ) then
    raise exception 'postflight failed: one of the ten courses is still unlinked';
  end if;
end $$;

commit;
