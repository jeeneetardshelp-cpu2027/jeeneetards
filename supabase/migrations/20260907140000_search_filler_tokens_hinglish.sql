-- ============================================================================
-- UNPARKED 7 Sep 2026. The blocker is gone.
--
-- This file sat in docs/sql/ rather than here, because applying it without a
-- q_long floor would have turned working queries into errors: universal_search
-- picks q_long as the longest SURVIVING token and uses it as the index
-- prefilter, so removing a word can only shorten it, and a two-character
-- needle makes the planner scan until Postgres cancels the statement.
--
-- 20260907093000_universal_search_q_long_floor.sql added that floor and was
-- applied on 7 Sep 2026. The two checks this file was waiting on were then
-- measured against production, before and after:
--
--   "ac the of"   500 57014  ->  200, 258 results
--   "ph the of"   500 57014  ->  200, 212 results
--
-- Those two are exact stand-ins for what "ac ka matlab" and "ph kaise padhe"
-- become once the particles below are filler: same surviving tokens, same
-- needle. "the" and "of" were already English filler, which is what makes
-- them a fair substitute rather than an analogy.
--
-- Ordinary searches were re-checked at the same time and did not move:
-- "kinematics" 1336 results, "ncert notes" 1025, "shm" 103.
--
-- ONE HINDI CONNECTING WORD EMPTIES AN OTHERWISE WORKING QUERY.
--
-- THE DEFECT, measured against production on 2026-09-07 (5,533 videos, 490
-- courses, 263 chapters, 89 faculty, 75 channels, 413 materials = 6,863 rows):
--
--   "kinematics ke numericals"    0 rows   vs "kinematics numericals"  148
--   "friction ka concept"         0 rows   vs "friction concept"         1
--   "thermodynamics ka one shot"  0 rows   vs "thermodynamics one shot"  3
--   "rotation ka one shot"        0 rows   vs "rotation one shot"        8
--   "integration kaise karein"    0 rows   vs "integration"             72
--   "complex numbers ke sawal"    0 rows   vs "complex numbers"         55
--
-- universal_search tier 4 requires EVERY query token to be a substring of the
-- title, and tier 5 requires every token to clear a 0.5 word-similarity
-- threshold. One token that no title contains kills the whole query.
-- public.search_filler_tokens() exists precisely to drop such words before
-- that conjunction is built -- and every one of its 96 entries is English
-- ('a', 'the', 'solve', 'ncert', 'class', 'numerical', ...). The Hindi half of
-- that job was never done, though the catalogue carries 202 Devanagari-bearing
-- titles and the audience types Hinglish.
--
-- WHAT THIS FILE CHANGES. public.search_filler_tokens() and nothing else. The
-- 96 English words are carried over byte for byte; 144 Hindi/Hinglish
-- scaffolding words are appended. 96 + 144 = 240. (The 94 quoted in the
-- brief that commissioned this work is off by two: the baseline array is
-- twelve rows of eight. Counted, not assumed.)
--
-- WHAT THIS FILE DELIBERATELY DOES NOT TOUCH. universal_search,
-- search_video_ids and search_playlist_ids all call search_filler_tokens() at
-- RUNTIME, so they pick this up with no re-emission. Re-emitting one of them
-- would put this change under the carry-over contract in
-- src/searchFeatureCarryOverSqlContract.test.js -- a contract that exists
-- because a body written from an older copy silently DELETES whatever landed
-- in between -- for no benefit whatsoever. This is a one-function change and
-- it stays one.
--
-- ---------------------------------------------------------------------------
-- WHY THESE WORDS AND NOT OTHERS
--
-- Four independent read-only measurement passes screened ~190 candidates
-- against the live catalogue. A word was admitted only if NO pass found a
-- collision. The list below is exactly their intersection; nothing was added
-- back after a rejection.
--
-- THE MECHANISM THAT MAKES THIS NARROW. Tiers 1 (exact) and 3 (prefix) match
-- on p_needle -- the UNFILTERED latin key -- so no filler entry can break an
-- exact or a prefix hit. Only tiers 4 and 5 read the token array, and dropping
-- a token LOOSENS an all-tokens-must-match test. The only way a filler entry
-- can do harm is if a student types the word MEANING it, i.e. if it is a
-- standalone token of a real title.
--
-- SO THE COUNT THAT GOVERNS RISK is whole-token occurrences on the SEARCH KEY,
-- not raw substrings and not raw titles. Measured on all 6,863 rows, with the
-- 202 Devanagari titles keyed through production's own search_latin_key:
--
--     ke   33  (31 Devanagari के)    ka   25  (23 का)    se   12  (10 से)
--     ki   10  (8 की / कि)           kyon 10  (all Devanagari)
--     aura  8  (all और)              hai   7  (5 है)     nahin 6
--     bhi/kaise/kahan 4 each         ko/mein/hoga/nahi/kya 3 each
--     aur/hain/vali 2 each           hota/jo/kyu/sare/koi/wale 1 each
--     the other 119 words:  ZERO whole-token occurrences anywhere.
--
-- EVERY ONE of those occurrences is the word used as a connective in its own
-- title (डायरी का एक पन्ना, सूरदास के पद, कबीर की साखी, सपनों के से दिन,
-- अट नहीं रही है). A 23-query harm corpus built FROM those real titles was
-- A/B'd live against production: 0 intended rows lost.
--
-- THE TRAPS, each already paid for by somebody:
--
--   'shot' is NOT here and must never be. "one shot" names 329 real titles and
--   is the single most useful thing a student can type. Strip it and the query
--   is driven by 'one', which is a substring of money/zone/component/stone.
--   The verification block below aborts if anyone adds it.
--
--   'sir' is NOT here. 475 titles carry it as a whole token -- it is how this
--   catalogue names its faculty, including two teacher rows and ten channels.
--
--   'hindi' and 'english' are NOT here. They are the language labels that keep
--   the Hindi-medium paper set apart from the English one, and 'hindi' is a
--   Class 10 subject in its own right (121 titles).
--
--   'medium' is NOT here even though it measures perfectly inert today (0
--   occurrences of any form in 6,863 rows). It is a first-class physics noun --
--   optical medium, wave medium, denser medium -- that this catalogue has not
--   reached yet, and the day it does, the word would be silently unsearchable.
--   "hindi medium" is an ALIAS problem, and belongs in search_aliases where
--   'hindi' has 121 titles to land on, not in a tokenisation list.
--
--   'par' is NOT here. It is the highest-value rejection: 0 whole tokens, but
--   1,442 titles carry it as a SUBSTRING (part, parabola, particle, parallel),
--   so tier 4 already tolerates it and it is an active discriminator. Measured:
--   "section par" returns Conic Sections at #1-#4 today; strip 'par' and the
--   right answer falls to #11, off a ten-item suggestion list. Also पर
--   transliterates to "para", not "par", so it would not even bridge.
--
--   'hi' is NOT here. HI is hydrogen iodide, and the ONLY whole-token
--   occurrence of "hi" in the whole catalogue is the halogens lecture
--   "Preparation, Properties and Uses of HCl, HBr and HI".
--
--   'ek' and 'para' and 'eka' are NOT here. एक means ONE -- a numeral, and
--   English 'one' is deliberately absent for the "one shot" reason above --
--   and it is the title-defining first word of "एक कहानी यह भी" and
--   "डायरी का एक पन्ना". "para" is live subject matter (ortho/para/meta, and
--   63 rows of Parabola / Parallel Plate / System of Particles).
--
--   'men', 'na', 'ho', 'ne', 'pe', 'kar', 'hum', 'bhai', 'yeh', 'apna',
--   'agar', 'main', 'mains', 'part', 'basic', 'trick' are NOT here either,
--   each for a collision one of the passes could point at in a real row.
--
-- THE SINGULAR TRAP. universal_search strips a token whose search_singular()
-- form is in this list, so adding W also swallows W || 's' whenever
-- length(W) >= 4. Every one of the 144 words was checked in that direction
-- against every distinct token in the catalogue: ZERO victims. The check is
-- not a comment -- the verification block below re-runs it against whatever
-- catalogue it finds and aborts on a single hit.
--
-- THE DEVANAGARI BRIDGE, and why some pairs look redundant.
-- search_latin_key() transliterates Devanagari titles to Latin before
-- matching, and translit_devanagari gives every consonant its inherent 'a'
-- unless a matra or a virama cancels it, and renders anusvara U+0902 as 'n'.
-- So the bridge WORKS for vowel-final particles -- का->ka, के->ke, की/कि->ki,
-- को->ko, से->se, या->ya, है->hai, भी->bhi, क्या->kya, कैसे->kaise -- one
-- entry covering both scripts. It BREAKS for the rest: और->"aura" not "aur",
-- हैं->"hain" not "hai", वाली->"vali" not "wali". That is why 'aur' AND
-- 'aura', 'hai' AND 'hain', 'wala'/'wali' AND 'vala'/'vali' all appear: the
-- Latin spelling serves the Hinglish typist, the transliterated spelling
-- reaches the Devanagari title. Neither is a duplicate of the other.
--
-- ---------------------------------------------------------------------------
-- THE ONE WAY THIS CHANGE NARROWS RATHER THAN WIDENS, stated plainly so it is
-- not discovered in production.
--
-- When filtering leaves NOTHING, the tokeniser reverts to the RAW token list
-- (search_query_tokens, baseline line 5860; universal_search's own copy in
-- 20260902180000 line 291). That guard stops a pure-filler query from matching
-- the whole catalogue -- but it means a query that is ENTIRELY scaffolding
-- gets STRICTER, not looser, because the raw list demands more tokens than the
-- filtered one did. Measured today, before this file:
--
--     "ka lecture"      HTTP 500, statement timeout (57014)
--     "ki notes"        HTTP 500, statement timeout
--     "se questions"    HTTP 500, statement timeout
--     "ka video"        128 rows of pure substring noise
--     "ki class"         84 rows of pure substring noise
--     "sab chapters ke notes"      9 accidental Hindi-literature rows
--     "pura chapter ka revision"   2 rows
--     "kya hai"                    4 rows
--
-- After this file every one of those falls back to its full raw token list.
-- The three timeouts stop timing out -- they time out TODAY precisely because
-- every content-looking word is stripped as English filler, the surviving
-- two-letter Hindi word becomes q_long, and the index prefilter degenerates to
-- '%ka%' plus a trigram scan of the catalogue. The rest lose rows that were
-- never answers. This is a precision gain, but it IS a visible row-count
-- change on contentless queries and it was a deliberate decision, not a
-- surprise.
--
-- The guard itself is unaffected for the queries it was written for:
-- "please help" still tokenises to [please help], "how to" to [how to], "a" to
-- [a]. All three are asserted below.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS MEASURED, AND WHAT WAS NOT.
--
-- MEASURED, read-only, against production: the full 6,863-row catalogue keyed
-- through search_latin_key; whole-token and substring counts per word per
-- table; the singular trap in both directions over every distinct catalogue
-- token; a 23-query harm corpus built from real Hindi titles (0 rows lost); a
-- 24-query fix corpus (23 revived, 0 still empty); the all-filler shape above;
-- and all 31 live search_aliases rows against the new list (no collision, so
-- the CHECK at 20260902170000_search_aliases.sql line 223 stays satisfiable).
--
-- NOT MEASURED. There are no query logs -- public.search_gap_log is locked to
-- anon, correctly -- so every "realistic student query" here is a construction.
-- The harm side is the stronger half, because it is derived from actual
-- catalogue titles rather than invented. Nothing here says what these entries
-- do to query PLANS; removing tokens can only SHORTEN q_long and therefore
-- only broaden the prefilter LIKE, which is worth an EXPLAIN under load.
--
-- ---------------------------------------------------------------------------
-- STAGED, NOT APPLIED. This file waits on the owner's migration gate
-- (supabase/README.md): apply it with `npx supabase db push`, never by pasting
-- it into the SQL editor.
--
-- REHEARSED on a real engine in src/searchFillerTokensHinglishSqlRehearsal.test.js,
-- which replays the COMPOSED chain in db-push order -- baseline, materials,
-- aliases, material words, browse course relevance, then this file -- and
-- asserts the before/after token lists and that all 31 curated shorthands
-- still resolve.
--
-- ROLLBACK. Re-run the function body from the baseline:
--   supabase/migrations/20260831140005_production_baseline.sql, line 5767.
-- Nothing else in the database changes, so that one statement is the whole
-- undo. No table, no column, no policy, no other function is touched here.
-- ============================================================================

begin;

do $preflight$
begin
  if to_regprocedure('public.search_filler_tokens()') is null then
    raise exception
      'REFUSING: public.search_filler_tokens() does not exist -- apply the baseline first';
  end if;
  -- The verification block below proves this change with DATA, by calling the
  -- tokeniser. If the helpers are missing, the proof is missing, and an
  -- unproven change to the filler list is exactly what this file must not be.
  if to_regprocedure('public.search_query_tokens(text)') is null
     or to_regprocedure('public.search_singular(text)') is null
     or to_regprocedure('public.search_latin_key(text)') is null then
    raise exception
      'REFUSING: search_query_tokens / search_singular / search_latin_key are missing, so this change cannot be verified against data';
  end if;
end
$preflight$;


create or replace function public.search_filler_tokens() returns text[]
    language sql immutable parallel safe
    as $fn$
  select array[
    -- ------------------------------------------------------------------
    -- ENGLISH. Carried over byte for byte from the production baseline
    -- (20260831140005_production_baseline.sql, line 5767). The verification
    -- block below aborts if a single one of these 96 goes missing.
    -- ------------------------------------------------------------------
    'a', 'an', 'the', 'of', 'in', 'on', 'for', 'to',
    'and', 'or', 'is', 'are', 'was', 'be', 'by', 'with',
    'from', 'at', 'as', 'it', 'this', 'that', 'my', 'me',
    'i', 'how', 'what', 'why', 'when', 'which', 'who', 'where',
    'can', 'do', 'does', 'solve', 'solved', 'solving', 'solution', 'explain',
    'explained', 'explanation', 'find', 'finding', 'learn', 'study', 'understand', 'revise',
    'revision', 'problem', 'question', 'numerical', 'example', 'exercise', 'practice', 'sum',
    'lecture', 'lesson', 'video', 'playlist', 'course', 'class', 'chapter', 'topic',
    'note', 'pdf', 'best', 'good', 'easy', 'quick', 'fast', 'complete',
    'full', 'free', 'new', 'latest', 'all', 'any', 'please', 'help',
    'need', 'want', 'ncert', 'cbse', 'syllabus', 'exam', 'paper', 'test',
    'mock', 'preparation', 'std', 'standard', 'th', 'nd', 'rd', 'st',

    -- ------------------------------------------------------------------
    -- HINDI / HINGLISH. 144 words. Grouped by what they DO in a query, with
    -- the whole-token count on the search key in brackets where it is not
    -- zero. Every non-zero count is the word acting as a connective inside
    -- its own title, verified row by row.
    -- ------------------------------------------------------------------

    -- Case particles and postpositions. का/के/की/कि/को/से all transliterate
    -- onto these exact strings, so one entry covers both scripts. These four
    -- are what the reported bug is actually made of.
    'ka', 'ke', 'ki', 'ko', 'se', 'mein', 'tak',            -- [25][33][10][3][12][3][0]

    -- Conjunctions and connectives. 'aura' is the Devanagari half of 'aur'
    -- (और -> "aura"); without it the bridge does not reach a Devanagari title.
    'aur', 'aura', 'ya', 'bhi', 'jo', 'toh', 'phir', 'lekin', 'magar',  -- [2][8][0][4][1]

    -- Copulas and light verbs. हैं carries an anusvara and keys to "hain",
    -- NOT "hai", so both spellings are needed.
    'hai', 'hain', 'hoga', 'hota', 'nahi', 'nahin',         -- [7][2][3][1][3][6]

    -- Pronouns and demonstratives.
    'vo', 'woh', 'iska', 'uska', 'iske', 'unke', 'apne',
    'mera', 'meri', 'mujhe', 'humein', 'aap', 'tum', 'yaar',

    -- Question words. The Hindi twins of what/why/how/when/where, all of
    -- which are already English filler.
    'kya', 'kyu', 'kyun', 'kyon', 'kaise', 'kaisa', 'kab',  -- [3][1][0][10][4][0][0]
    'kahan', 'kaun', 'kitna', 'kitne', 'kitni', 'matlab',   -- [4]

    -- "do it" verbs -- karna and its inflections.
    'karo', 'kare', 'karein', 'karna', 'karke', 'karne', 'karte', 'karu', 'karun',

    -- "tell me" verbs -- batana and its inflections.
    'batao', 'bata', 'batana', 'bataye', 'bataiye',

    -- "explain it" verbs -- samjhana and its inflections. samjhein and
    -- padhein are here because their absence is measurably why
    -- "gravitation kaise samjhein" and "organic chemistry kaise padhein"
    -- stayed dead in the screening pass.
    'samjhao', 'samjhana', 'samjha', 'samjhna', 'samjh', 'samajh',
    'samjhe', 'samjho', 'samjhein', 'samjhaye', 'samjhaiye',

    -- "teach / show / read / make it" verbs.
    'sikhao', 'sikhna', 'seekho', 'seekhna',
    'dikhao', 'dekho', 'dekhna',
    'padho', 'padhe', 'padhna', 'padhein', 'padhai',
    'banao', 'nikalo', 'lagao',

    -- "I want / I need".
    'chahiye', 'chahie', 'chahta', 'chahte',

    -- Quantifiers -- the Hindi twins of 'all', 'complete', 'any', which are
    -- already English filler. 'sab' occurs ZERO times in the catalogue in any
    -- form, in either script.
    'sab', 'sabhi', 'sabse', 'sara', 'sare', 'saara', 'saare',   -- [0][0][0][0][1][0][0]
    'pura', 'puri', 'poora', 'poori', 'thoda', 'zyada', 'jyada',
    'bahut', 'bilkul', 'kuch', 'koi',                            -- [1] for koi

    -- Relative-clause scaffolding: "capacitor WALA question". वाला/वाली key
    -- to "vala"/"vali" (व is always 'v'), so both spellings are carried.
    'wala', 'wali', 'waala', 'wale', 'vala', 'vali',             -- [0][0][0][1][0][2]

    -- Purpose and quality words -- "X KE LIYE best lecture", "achha lecture".
    'liye', 'taiyari', 'tayari', 'yaad', 'jaldi',
    'achha', 'accha', 'acha', 'badiya', 'badhiya', 'behtar', 'sahi',
    'aasan', 'asan', 'mushkil',
    'jaruri', 'zaroori', 'jarurat', 'zarurat',

    -- Hindi twins of words already in the English half: question, solution,
    -- method. 'prashna' is the form translit_devanagari produces for प्रश्न,
    -- so it is the spelling that would actually appear on a key.
    'sawal', 'sawaal', 'prashn', 'prashna', 'uttar', 'tarika', 'tareeka',

    -- Politeness. 'please' is already English filler; this is the shorthand.
    'plz'
  ]::text[];
$fn$;


alter function public.search_filler_tokens() owner to postgres;

comment on function public.search_filler_tokens() is
  'Query words that express intent or exam scaffolding rather than subject matter, in English and in Hindi/Hinglish. Removed from universal_search tokens so one filler word cannot fail an all-tokens-must-match query. A word belongs here only if no student would ever type it MEANING it: "shot", "sir", "hindi", "english", "medium", "par", "hi", "ek" and "part" are excluded on measured collisions with real titles.';

-- create-or-replace does not reset grants, but re-stating them keeps the file
-- self-contained and matches the baseline exactly. universal_search is
-- SECURITY INVOKER, so a logged-out student resolves this function AS anon:
-- miss the anon grant and every public search dies with
-- "permission denied for function search_filler_tokens".
revoke all on function public.search_filler_tokens() from public;
grant execute on function public.search_filler_tokens() to anon;
grant execute on function public.search_filler_tokens() to authenticated;
grant execute on function public.search_filler_tokens() to service_role;


-- ============================================================================
-- SELF-VERIFICATION. Everything below runs inside the same transaction as the
-- CREATE above, so any failure rolls the function back to what it was.
-- ============================================================================
do $verify$
declare
  -- The 96 English words, re-typed here on purpose. This is the copy the
  -- assertion compares against, so a word dropped from the body above fails
  -- HERE rather than silently in production three weeks later.
  v_english constant text[] := array[
    'a', 'an', 'the', 'of', 'in', 'on', 'for', 'to',
    'and', 'or', 'is', 'are', 'was', 'be', 'by', 'with',
    'from', 'at', 'as', 'it', 'this', 'that', 'my', 'me',
    'i', 'how', 'what', 'why', 'when', 'which', 'who', 'where',
    'can', 'do', 'does', 'solve', 'solved', 'solving', 'solution', 'explain',
    'explained', 'explanation', 'find', 'finding', 'learn', 'study', 'understand', 'revise',
    'revision', 'problem', 'question', 'numerical', 'example', 'exercise', 'practice', 'sum',
    'lecture', 'lesson', 'video', 'playlist', 'course', 'class', 'chapter', 'topic',
    'note', 'pdf', 'best', 'good', 'easy', 'quick', 'fast', 'complete',
    'full', 'free', 'new', 'latest', 'all', 'any', 'please', 'help',
    'need', 'want', 'ncert', 'cbse', 'syllabus', 'exam', 'paper', 'test',
    'mock', 'preparation', 'std', 'standard', 'th', 'nd', 'rd', 'st'
  ];

  v_hindi constant text[] := array[
    'ka', 'ke', 'ki', 'ko', 'se', 'mein', 'tak',
    'aur', 'aura', 'ya', 'bhi', 'jo', 'toh', 'phir', 'lekin', 'magar',
    'hai', 'hain', 'hoga', 'hota', 'nahi', 'nahin',
    'vo', 'woh', 'iska', 'uska', 'iske', 'unke', 'apne',
    'mera', 'meri', 'mujhe', 'humein', 'aap', 'tum', 'yaar',
    'kya', 'kyu', 'kyun', 'kyon', 'kaise', 'kaisa', 'kab',
    'kahan', 'kaun', 'kitna', 'kitne', 'kitni', 'matlab',
    'karo', 'kare', 'karein', 'karna', 'karke', 'karne', 'karte', 'karu', 'karun',
    'batao', 'bata', 'batana', 'bataye', 'bataiye',
    'samjhao', 'samjhana', 'samjha', 'samjhna', 'samjh', 'samajh',
    'samjhe', 'samjho', 'samjhein', 'samjhaye', 'samjhaiye',
    'sikhao', 'sikhna', 'seekho', 'seekhna',
    'dikhao', 'dekho', 'dekhna',
    'padho', 'padhe', 'padhna', 'padhein', 'padhai',
    'banao', 'nikalo', 'lagao',
    'chahiye', 'chahie', 'chahta', 'chahte',
    'sab', 'sabhi', 'sabse', 'sara', 'sare', 'saara', 'saare',
    'pura', 'puri', 'poora', 'poori', 'thoda', 'zyada', 'jyada',
    'bahut', 'bilkul', 'kuch', 'koi',
    'wala', 'wali', 'waala', 'wale', 'vala', 'vali',
    'liye', 'taiyari', 'tayari', 'yaad', 'jaldi',
    'achha', 'accha', 'acha', 'badiya', 'badhiya', 'behtar', 'sahi',
    'aasan', 'asan', 'mushkil',
    'jaruri', 'zaroori', 'jarurat', 'zarurat',
    'sawal', 'sawaal', 'prashn', 'prashna', 'uttar', 'tarika', 'tareeka',
    'plz'
  ];

  -- Words that were SCREENED AND REJECTED. Each one has a collision somebody
  -- measured in a real row. If a later hand adds one of these to widen the
  -- list, this migration -- or a re-run of this block -- refuses.
  v_forbidden constant text[] := array[
    'shot', 'one', 'sir', 'hindi', 'english', 'medium', 'par', 'hi', 'na',
    'ho', 'ne', 'pe', 'men', 'ek', 'eka', 'para', 'bhai', 'kar', 'hum',
    'apna', 'yeh', 'ye', 'wo', 'tha', 'thi', 'bro', 'agar', 'part', 'main',
    'mains', 'mai', 'basic', 'trick', 'bada', 'bade', 'rahi', 'raha',
    'gaya', 'related'
  ];

  v_list      text[] := public.search_filler_tokens();
  v_missing   text[];
  v_extra     text[];
  v_bad       text[];
  v_victims   text[];
  v_tokens    text[];
  v_volatile  "char";
  v_parallel  "char";
  v_kind      "char";
  v_rettype   text;
  v_probe     record;
  v_scan      record;
  v_n         integer;
begin
  -- ---- 1. the function is still what universal_search assumes it is -------
  -- IMMUTABLE is not cosmetic: search_aliases's CHECK constraint calls this
  -- function, and a non-immutable function cannot appear in one at all.
  select p.provolatile, p.proparallel, p.prokind,
         pg_catalog.format_type(p.prorettype, null)
    into v_volatile, v_parallel, v_kind, v_rettype
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'search_filler_tokens'
     and p.pronargs = 0;

  if v_volatile is null then
    raise exception 'REFUSING: public.search_filler_tokens() vanished';
  end if;
  if v_volatile <> 'i' then
    raise exception 'REFUSING: search_filler_tokens() is not IMMUTABLE (provolatile=%)', v_volatile;
  end if;
  if v_parallel <> 's' then
    raise exception 'REFUSING: search_filler_tokens() is not PARALLEL SAFE (proparallel=%)', v_parallel;
  end if;
  if v_kind <> 'f' then
    raise exception 'REFUSING: search_filler_tokens() is no longer a plain function (prokind=%)', v_kind;
  end if;
  if v_rettype <> 'text[]' then
    raise exception 'REFUSING: search_filler_tokens() returns %, not text[]', v_rettype;
  end if;

  -- A logged-out student resolves this by name inside SECURITY INVOKER
  -- universal_search. Without these grants, every public search 500s.
  for v_probe in select unnest(array['anon', 'authenticated', 'service_role']) as role_name loop
    if not exists (select 1 from pg_roles where rolname = v_probe.role_name) then
      continue;   -- a bare engine (rehearsal fixture) may not have the role
    end if;
    if not has_function_privilege(
         v_probe.role_name, 'public.search_filler_tokens()', 'execute') then
      raise exception 'REFUSING: % cannot execute search_filler_tokens()', v_probe.role_name;
    end if;
  end loop;

  if (select obj_description(p.oid, 'pg_proc')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'search_filler_tokens'
         and p.pronargs = 0) is null then
    raise exception 'REFUSING: the COMMENT on search_filler_tokens() was lost';
  end if;

  -- ---- 2. the English list survived intact -------------------------------
  select array_agg(w order by w) into v_missing
    from unnest(v_english) as w
   where not (w = any (v_list));
  if v_missing is not null then
    raise exception
      'REFUSING: this file DROPPED English filler words that the baseline shipped: %',
      array_to_string(v_missing, ', ');
  end if;

  -- ---- 3. every Hindi word this file exists to add is present ------------
  select array_agg(w order by w) into v_missing
    from unnest(v_hindi) as w
   where not (w = any (v_list));
  if v_missing is not null then
    raise exception
      'REFUSING: Hindi filler words are missing from the emitted list: %',
      array_to_string(v_missing, ', ');
  end if;

  -- ---- 4. nothing rejected came back, and nothing else crept in ----------
  -- The rejected-word check runs FIRST on purpose. Anyone who adds 'shot' also
  -- fails the "undeclared word" check below, and that check's message -- "add
  -- it to v_english or v_hindi" -- is precisely the wrong advice for 'shot'.
  -- Whoever hits this must read the reason, not a nudge toward doing it
  -- properly.
  select array_agg(w order by w) into v_bad
    from unnest(v_forbidden) as w
   where w = any (v_list);
  if v_bad is not null then
    raise exception
      'REFUSING: these words were SCREENED AND REJECTED on a measured collision with real titles, and must never be filler: %. "one shot" alone names 329 titles; "sir" names 475.',
      array_to_string(v_bad, ', ');
  end if;

  select array_agg(w order by w) into v_extra
    from unnest(v_list) as w
   where not (w = any (v_english)) and not (w = any (v_hindi));
  if v_extra is not null then
    raise exception
      'REFUSING: words in the emitted list that neither half of this file declares: %. Add them to v_english or v_hindi, with the measurement that justifies them.',
      array_to_string(v_extra, ', ');
  end if;

  if cardinality(v_list) <> cardinality(v_english) + cardinality(v_hindi) then
    raise exception 'REFUSING: list has % entries, expected % English + % Hindi',
      cardinality(v_list), cardinality(v_english), cardinality(v_hindi);
  end if;
  select count(*) into v_n from (select distinct w from unnest(v_list) as w) d;
  if v_n <> cardinality(v_list) then
    raise exception 'REFUSING: the filler list has duplicates (% entries, % distinct)',
      cardinality(v_list), v_n;
  end if;

  -- Shape. Tokens are compared against a space-split latin key, so anything
  -- with whitespace, an upper-case letter or a digit can never match and is a
  -- silent typo rather than an entry.
  select array_agg(w order by w) into v_bad
    from unnest(v_list) as w
   where w is null or w = '' or w <> lower(w) or w !~ '^[a-z]+$';
  if v_bad is not null then
    raise exception
      'REFUSING: filler entries that can never match a latin-key token: %',
      array_to_string(v_bad, ', ');
  end if;

  -- ---- 5. THE SINGULAR TRAP, against whatever catalogue is here ----------
  -- universal_search also strips a token whose search_singular() form is in
  -- the list, so adding W swallows W || 's' once length(W) >= 4. Adding a word
  -- whose plural is a real topic would silently delete that topic from every
  -- query. This scans the actual catalogue rather than trusting the screen.
  for v_scan in
    select * from unnest(
      array['videos', 'playlists', 'chapters', 'teachers',
            'institutes_channels', 'study_materials'],
      array['title', 'title', 'name', 'display_name', 'name', 'title']
    ) as t(rel, col)
  loop
    if to_regclass('public.' || v_scan.rel) is null then
      continue;
    end if;
    if not exists (
      select 1 from pg_attribute
       where attrelid = ('public.' || v_scan.rel)::regclass
         and attname = v_scan.col and attnum > 0 and not attisdropped
    ) then
      continue;
    end if;

    execute format($q$
      select array_agg(distinct tok)
        from (select unnest(string_to_array(public.search_latin_key(%I), ' ')) as tok
                from public.%I) s
       where tok <> ''
         and length(tok) > 4
         and right(tok, 1) = 's'
         and public.search_singular(tok) = any ($1)
    $q$, v_scan.col, v_scan.rel)
    into v_victims
    using v_hindi;

    if v_victims is not null and cardinality(v_victims) > 0 then
      raise exception
        'REFUSING: the singular rule would strip these REAL public.% tokens: %. A word whose plural is real content cannot be filler.',
        v_scan.rel, array_to_string(v_victims, ', ');
    end if;
  end loop;

  -- ---- 6. the curated shorthand table stays writable --------------------
  -- 20260902170000_search_aliases.sql line 223 forbids an alias whose latin
  -- key is a filler token. Existing rows are not re-validated when this
  -- function changes, so a collision would not fail here -- it would fail the
  -- next time an admin edited that row. Catch it now.
  if to_regclass('public.search_aliases') is not null then
    select array_agg(alias order by alias) into v_bad
      from public.search_aliases
     where public.search_latin_key(alias) = any (v_hindi);
    if v_bad is not null then
      raise exception
        'REFUSING: these curated shorthands would become filler tokens and their rows would stop being editable: %',
        array_to_string(v_bad, ', ');
    end if;
  end if;

  -- ---- 7. PROVE IT WITH DATA. -------------------------------------------
  -- Every expectation below was measured against production on 2026-09-07 by
  -- taking production's own latin key and replaying the tokeniser's algorithm
  -- with this list. The first block is what this file exists to fix; the
  -- second is what it must leave exactly as it found it.
  for v_probe in
    select * from unnest(
      array[
        -- the fix
        'kinematics ke numericals',
        'friction ka concept',
        'thermodynamics ka one shot',
        'integration kaise karein',
        'complex numbers ke sawal',
        'capacitor wala question',
        'electrostatics ke liye video',
        'ek kahani yeh bhi',
        -- the words we refused to add, proved still alive
        'thermodynamics one shot',
        'anshul sir limits',
        'class 10 hindi',
        'hindi medium physics',
        'jee mains previous year paper',
        'rotation par questions',
        'hcl hbr and hi',
        'apna physics',
        'bade bhai sahab',
        'kar chale hum fida',
        -- the pre-existing behaviour that must not move
        'how to solve pulley problems',
        'gravitation class 11',
        'rotational motion',
        'kinamatics',
        -- the all-filler fallback guard, in both languages
        'please help',
        'kya hai',
        'a'
      ],
      array[
        'kinematics',
        'friction concept',
        'thermodynamics one shot',
        'integration',
        'complex numbers',
        'capacitor',
        'electrostatics',
        'ek kahani yeh',

        'thermodynamics one shot',
        'anshul sir limits',
        'hindi',
        'hindi medium physics',
        'jee mains previous year',
        'rotation par',
        'hcl hbr hi',
        'apna physics',
        'bade bhai sahab',
        'kar chale hum fida',

        'pulley',
        'gravitation',
        'rotational motion',
        'kinamatics',

        'please help',
        'kya hai',
        'a'
      ]
    ) as t(probe_query, expected)
  loop
    select q_tokens into v_tokens from public.search_query_tokens(v_probe.probe_query);
    if v_tokens is null or cardinality(v_tokens) = 0 then
      raise exception
        'REFUSING: "%" tokenises to NOTHING -- the empty-token fallback is broken, and tier 5 would match the entire catalogue',
        v_probe.probe_query;
    end if;
    if array_to_string(v_tokens, ' ') is distinct from v_probe.expected then
      raise exception
        'REFUSING: "%" tokenises to [%], expected [%]',
        v_probe.probe_query, array_to_string(v_tokens, ' '), v_probe.expected;
    end if;
  end loop;

  raise notice
    'search_filler_tokens(): % words (% English + % Hindi/Hinglish). Verified IMMUTABLE PARALLEL SAFE, granted to anon/authenticated/service_role, no singular-rule victim in the catalogue, no curated shorthand shadowed, and 25 tokenisation probes exact.',
    cardinality(v_list), cardinality(v_english), cardinality(v_hindi);
end
$verify$;

commit;
