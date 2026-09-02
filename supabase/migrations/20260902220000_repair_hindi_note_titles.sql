-- ============================================================================
-- REPAIR the 32 Hindi note titles that lost their Devanagari at ingest.
--
-- THE DEFECT. Every non-ASCII character in these rows is a literal '?'
-- (U+003F). "तोप - NCERT स्पर्श" is stored as "??? - NCERT ??????": the ASCII
-- survived, each other character collapsed to one question mark. That is the
-- exact signature of UTF-8 text pushed through a single-byte client encoding,
-- and it happened when the two seed packages were applied by hand --
-- `supabase/README.md` records that every paper and note seed so far went in
-- that way, outside the migration chain.
--
-- The files themselves are FINE. docs/sql/study_materials_ncert_class10_hindi_
-- {a,b}_seed_2026-08-05.sql hold the correct titles and descriptions in UTF-8.
-- Nothing was lost; only the copy in the database is damaged.
--
-- WHY IT MATTERS NOW. Until 2 Sep 2026 these notes were unreachable from
-- search: the material pillar matched on the title alone, and a full-notes
-- title never contains the word "notes". 20260902180000 widened the haystack
-- with kind words, so "notes" and "ncert notes" now return 205 notes -- and
-- these 32 are among the first rows a Hindi-medium student sees, rendered as
-- rows of question marks.
--
-- HOW EACH ROW WAS IDENTIFIED. Not by pattern-matching the damage: two
-- different titles can collapse to the SAME mask, and two of them do here --
--     "???? ?? ???? - NCERT ??????"  <-  माता का आँचल   AND  कबीर की साखी
--     "???????? - NCERT ???????"     <-  आत्मकथ्य       AND  संस्कृति
-- so mask-matching alone would have written the WRONG title into two rows.
-- Each row was keyed on its chapter scope instead, which is INTACT in
-- `chapters.name`, and only then checked against the mask. Two notes cover two
-- chapters each ("A और B - NCERT ..."); for those, every scoped chapter name
-- must appear in the recovered title.
--
-- NOT TOUCHED: id 87, "How do Organisms Reproduce? - NCERT Science". Its
-- question mark is real punctuation in an English chapter name, its
-- description is clean, and no seed row claims it. It is the reason this file
-- lists ids explicitly instead of matching on '?' across the table.
--
-- THE GUARD, and why it is what it is. Each UPDATE fires only while its row
-- still SHOWS the damage -- a question mark in the title or the description.
-- So: a re-run is a no-op; a row somebody already repaired by hand is left
-- exactly as they left it; and a row repaired only halfway, title fixed and
-- description still broken, is finished rather than skipped. An earlier draft
-- guarded on the exact damaged title instead, which skipped that half-fixed
-- row and then failed its own postflight over the description it had refused
-- to touch.
--
-- Applied with `npx supabase db push`, which is UTF-8 end to end -- that is
-- the point of routing the repair through the chain rather than the SQL
-- Editor, which is how the damage got here. The preflight refuses to write
-- anything at all unless the Devanagari in THIS FILE survived the connection,
-- and the postflight refuses to report success while any target still holds a
-- question mark.
-- ============================================================================

do $preflight$
begin
  if to_regclass('public.study_materials') is null then
    raise exception 'REFUSING: study_materials is missing';
  end if;
  -- The single most important line in this file. A Devanagari string takes
  -- more BYTES than it has CHARACTERS; if this literal arrived as single-byte
  -- text, the connection is doing the very thing being repaired, and the
  -- UPDATEs below would write question marks over question marks.
  if length('तोप') = octet_length('तोप') then
    raise exception 'REFUSING: this connection is not UTF-8 -- the Devanagari in this file arrived as single-byte text, which is the corruption this migration exists to undo';
  end if;
end
$preflight$;

-- id 175 -- कबीर की साखी
update public.study_materials
   set title = 'कबीर की साखी - NCERT स्पर्श',
       description = 'कबीर की साखियों का आधिकारिक NCERT स्पर्श अध्याय।'
 where id = 175
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 176 -- मीरा के पद
update public.study_materials
   set title = 'मीरा के पद - NCERT स्पर्श',
       description = 'मीरा के पदों का आधिकारिक NCERT स्पर्श अध्याय।'
 where id = 176
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 177 -- मनुष्यता
update public.study_materials
   set title = 'मनुष्यता - NCERT स्पर्श',
       description = 'मैथिलीशरण गुप्त की कविता मनुष्यता का आधिकारिक NCERT स्पर्श अध्याय।'
 where id = 177
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 178 -- पर्वत प्रदेश में पावस
update public.study_materials
   set title = 'पर्वत प्रदेश में पावस - NCERT स्पर्श',
       description = 'सुमित्रानंदन पंत की कविता का आधिकारिक NCERT स्पर्श अध्याय।'
 where id = 178
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 179 -- तोप
update public.study_materials
   set title = 'तोप - NCERT स्पर्श',
       description = 'वीरेन डंगवाल की कविता तोप का आधिकारिक NCERT स्पर्श अध्याय।'
 where id = 179
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 180 -- कर चले हम फ़िदा
update public.study_materials
   set title = 'कर चले हम फ़िदा - NCERT स्पर्श',
       description = 'कैफ़ी आज़मी की कविता का आधिकारिक NCERT स्पर्श अध्याय।'
 where id = 180
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 181 -- आत्मत्राण
update public.study_materials
   set title = 'आत्मत्राण - NCERT स्पर्श',
       description = 'रवींद्रनाथ ठाकुर की कविता आत्मत्राण का आधिकारिक NCERT स्पर्श अध्याय।'
 where id = 181
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 182 -- बड़े भाई साहब
update public.study_materials
   set title = 'बड़े भाई साहब - NCERT स्पर्श',
       description = 'प्रेमचंद की कहानी बड़े भाई साहब का आधिकारिक NCERT स्पर्श अध्याय।'
 where id = 182
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 183 -- डायरी का एक पन्ना
update public.study_materials
   set title = 'डायरी का एक पन्ना - NCERT स्पर्श',
       description = 'सीताराम सेकसरिया के पाठ का आधिकारिक NCERT स्पर्श अध्याय।'
 where id = 183
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 184 -- तताँरा वामीरो कथा
update public.study_materials
   set title = 'तताँरा वामीरो कथा - NCERT स्पर्श',
       description = 'लीलाधर मंडलोई के पाठ का आधिकारिक NCERT स्पर्श अध्याय।'
 where id = 184
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 185 -- तीसरी कसम के शिल्पकार शैलेंद्र
update public.study_materials
   set title = 'तीसरी कसम के शिल्पकार शैलेंद्र - NCERT स्पर्श',
       description = 'प्रहलाद अग्रवाल के पाठ का आधिकारिक NCERT स्पर्श अध्याय।'
 where id = 185
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 186 -- अब कहाँ दूसरे के दुख से दुखी होने वाले
update public.study_materials
   set title = 'अब कहाँ दूसरे के दुख से दुखी होने वाले - NCERT स्पर्श',
       description = 'निदा फ़ाज़ली के पाठ का आधिकारिक NCERT स्पर्श अध्याय।'
 where id = 186
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 187 -- पतझर में टूटी पत्तियाँ
update public.study_materials
   set title = 'पतझर में टूटी पत्तियाँ - NCERT स्पर्श',
       description = 'रवींद्र केलेकर के पाठ का आधिकारिक NCERT स्पर्श अध्याय।'
 where id = 187
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 188 -- कारतूस
update public.study_materials
   set title = 'कारतूस - NCERT स्पर्श',
       description = 'हबीब तनवीर के एकांकी कारतूस का आधिकारिक NCERT स्पर्श अध्याय।'
 where id = 188
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 189 -- हरिहर काका
update public.study_materials
   set title = 'हरिहर काका - NCERT संचयन',
       description = 'मिथिलेश्वर की कहानी हरिहर काका का आधिकारिक NCERT संचयन अध्याय।'
 where id = 189
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 190 -- सपनों के से दिन
update public.study_materials
   set title = 'सपनों के से दिन - NCERT संचयन',
       description = 'गुरदयाल सिंह के संस्मरण का आधिकारिक NCERT संचयन अध्याय।'
 where id = 190
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 191 -- टोपी शुक्ला
update public.study_materials
   set title = 'टोपी शुक्ला - NCERT संचयन',
       description = 'राही मासूम रज़ा के पाठ का आधिकारिक NCERT संचयन अध्याय।'
 where id = 191
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 192 -- सूरदास के पद
update public.study_materials
   set title = 'सूरदास के पद - NCERT क्षितिज',
       description = 'सूरदास के पदों का आधिकारिक NCERT क्षितिज अध्याय।'
 where id = 192
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 193 -- राम-लक्ष्मण-परशुराम संवाद
update public.study_materials
   set title = 'राम-लक्ष्मण-परशुराम संवाद - NCERT क्षितिज',
       description = 'तुलसीदास के राम-लक्ष्मण-परशुराम संवाद का आधिकारिक NCERT क्षितिज अध्याय।'
 where id = 193
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 194 -- आत्मकथ्य
update public.study_materials
   set title = 'आत्मकथ्य - NCERT क्षितिज',
       description = 'जयशंकर प्रसाद की कविता आत्मकथ्य का आधिकारिक NCERT क्षितिज अध्याय।'
 where id = 194
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 195 -- उत्साह + अट नहीं रही है
update public.study_materials
   set title = 'उत्साह और अट नहीं रही है - NCERT क्षितिज',
       description = 'सूर्यकांत त्रिपाठी निराला की कविताओं उत्साह और अट नहीं रही है का आधिकारिक NCERT क्षितिज अध्याय।'
 where id = 195
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 196 -- यह दंतुरित मुसकान + फसल
update public.study_materials
   set title = 'यह दंतुरित मुसकान और फसल - NCERT क्षितिज',
       description = 'नागार्जुन की कविताओं यह दंतुरित मुसकान और फसल का आधिकारिक NCERT क्षितिज अध्याय।'
 where id = 196
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 197 -- संगतकार
update public.study_materials
   set title = 'संगतकार - NCERT क्षितिज',
       description = 'मंगलेश डबराल की कविता संगतकार का आधिकारिक NCERT क्षितिज अध्याय।'
 where id = 197
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 198 -- नेताजी का चश्मा
update public.study_materials
   set title = 'नेताजी का चश्मा - NCERT क्षितिज',
       description = 'स्वयं प्रकाश की कहानी नेताजी का चश्मा का आधिकारिक NCERT क्षितिज अध्याय।'
 where id = 198
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 199 -- बालगोबिन भगत
update public.study_materials
   set title = 'बालगोबिन भगत - NCERT क्षितिज',
       description = 'रामवृक्ष बेनीपुरी के पाठ बालगोबिन भगत का आधिकारिक NCERT क्षितिज अध्याय।'
 where id = 199
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 200 -- लखनवी अंदाज़
update public.study_materials
   set title = 'लखनवी अंदाज़ - NCERT क्षितिज',
       description = 'यशपाल की कहानी लखनवी अंदाज़ का आधिकारिक NCERT क्षितिज अध्याय।'
 where id = 200
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 201 -- एक कहानी यह भी
update public.study_materials
   set title = 'एक कहानी यह भी - NCERT क्षितिज',
       description = 'मन्नू भंडारी के आत्मकथ्य एक कहानी यह भी का आधिकारिक NCERT क्षितिज अध्याय।'
 where id = 201
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 202 -- नौबतखाने में इबादत
update public.study_materials
   set title = 'नौबतखाने में इबादत - NCERT क्षितिज',
       description = 'यतीन्द्र मिश्र के पाठ नौबतखाने में इबादत का आधिकारिक NCERT क्षितिज अध्याय।'
 where id = 202
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 203 -- संस्कृति
update public.study_materials
   set title = 'संस्कृति - NCERT क्षितिज',
       description = 'भदंत आनंद कौसल्यायन के निबंध संस्कृति का आधिकारिक NCERT क्षितिज अध्याय।'
 where id = 203
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 204 -- माता का आँचल
update public.study_materials
   set title = 'माता का आँचल - NCERT कृतिका',
       description = 'शिवपूजन सहाय के पाठ माता का आँचल का आधिकारिक NCERT कृतिका अध्याय।'
 where id = 204
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 205 -- साना-साना हाथ जोड़ि
update public.study_materials
   set title = 'साना-साना हाथ जोड़ि - NCERT कृतिका',
       description = 'मधु कांकरिया के यात्रा-वृत्तांत साना-साना हाथ जोड़ि का आधिकारिक NCERT कृतिका अध्याय।'
 where id = 205
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- id 206 -- मैं क्यों लिखता हूँ
update public.study_materials
   set title = 'मैं क्यों लिखता हूँ - NCERT कृतिका',
       description = 'अज्ञेय के निबंध मैं क्यों लिखता हूँ का आधिकारिक NCERT कृतिका अध्याय।'
 where id = 206
   and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);

-- ---------------------------------------------------------------------
-- POSTFLIGHT. Abort the whole migration unless every named row now holds real
-- multibyte text. The failure being guarded against -- losing the encoding in
-- transit -- would otherwise write the damage straight back and look like a
-- clean run.
-- ---------------------------------------------------------------------
do $postflight$
declare
  v_missing int;
  v_bad     int;
  v_ascii   int;
  v_shape   int;
begin
  select count(*) into v_missing
    from unnest(array[175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206]) as t(id)
   where not exists (select 1 from public.study_materials sm where sm.id = t.id);
  if v_missing > 0 then
    raise exception 'REPAIR FAILED: % of the % target rows do not exist', v_missing, 32;
  end if;

  select count(*) into v_bad
    from public.study_materials
   where id = any(array[175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206])
     and (position('?' in title) > 0 or position('?' in coalesce(description, '')) > 0);
  if v_bad > 0 then
    raise exception 'REPAIR FAILED: % rows still contain a question mark', v_bad;
  end if;

  -- Belt and braces on the preflight: if the literals had arrived as ASCII the
  -- check above would already have caught the question marks, but a title with
  -- no multibyte character in it is not a Hindi title whatever it contains.
  select count(*) into v_ascii
    from public.study_materials
   where id = any(array[175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206])
     and length(title) = octet_length(title);
  if v_ascii > 0 then
    raise exception 'REPAIR FAILED: % titles are pure ASCII, so the Devanagari did not survive the connection', v_ascii;
  end if;


  -- Encoding-proof check, and the only one here that is. The two above
  -- assume a bad connection collapses Devanagari to '?', which is what
  -- happened to these rows -- but a different client encoding could write
  -- some OTHER multibyte mojibake, which carries no question marks and is
  -- not pure ASCII, so it would slip past both. This compares the first
  -- character's CODE POINT against a plain integer: every one of these
  -- titles begins with its chapter name, which is Devanagari (U+0900-U+097F
  -- = 2304-2431). A number cannot itself be mis-encoded on the way in.
  select count(*) into v_shape
    from public.study_materials
   where id = any(array[175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206])
     and ascii(substring(title from 1 for 1)) not between 2304 and 2431;
  if v_shape > 0 then
    raise exception 'REPAIR FAILED: % titles do not begin with a Devanagari character, so the text that arrived is not the text in this file', v_shape;
  end if;

  raise notice 'HINDI NOTE TITLES REPAIRED: % rows named; none left holding a question mark, every title multibyte, every title beginning with a Devanagari code point.', 32;
end
$postflight$;
