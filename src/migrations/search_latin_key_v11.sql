-- =====================================================================
--  search_latin_key_v11.sql — the Hinglish bridge for universal search
--
--  ONE JOB: give Devanagari content and Latin queries a SINGLE comparison
--  key, so that all four combinations work through one index:
--
--        query \ content   Devanagari            Latin
--        Devanagari        कबीर  -> kabiira       —
--        Latin             kabir -> kabiira       motion -> motion
--
--  Today 48 lesson titles and 33 chapters are stored in Devanagari
--  (कबीर की साखी, मीरा के पद, बड़े भाई साहब, पर्वत प्रदेश में पावस). A student
--  typing "kabir ki sakhi" — which is what they actually type; nobody switches
--  keyboards to search — currently gets nothing at all. This file is the
--  transliteration half of the fix. The sargable predicates, the
--  word_similarity fuzzy tier and the indexes live in the universal_search
--  replacement; this file deliberately creates NO index and NO table so the
--  two halves can be reviewed and rolled back independently.
--
--  WHAT THIS IS NOT
--  Not a scholarly romanisation. IAST/ISO-15919 spell साखी as "sākhī", which no
--  student types. Not a phonetic engine either: real Hindi also deletes the
--  inherent vowel (कबीर is said "kabir", not "kabira"), and modelling that needs
--  syllable-weight rules wrong often enough to be worse than useless in a key.
--
--  So the scheme is blunt and mechanical, with two deliberate choices:
--    * long vowels are emitted SHORT (ी -> "i", ा -> "a", ू -> "u"), because
--      students type "sakhi", never "saakhii";
--    * the inherent vowel is KEPT (कबीर -> "kabira"), because dropping it
--      correctly is the phonology problem above.
--  The result: the key only ever has MORE letters than the student's spelling,
--  never different ones, so the student's form is a substring of the key.
--
--    content              key                        student types
--    क्षितिज               kshitija                   kshitij      -> PREFIX
--    मनुष्यता              manushyata                 manushyata   -> EXACT
--    त्रिकोणमिति            trikonamiti                trikonamiti  -> EXACT
--    कबीर की साखी          kabira ki sakhi            kabir ki sakhi   -> ALL-TOKENS
--    बड़े भाई साहब         bade bhai sahaba           bade bhai sahab  -> ALL-TOKENS
--    मीरा के पद            mira ke pada               mira ke pad      -> ALL-TOKENS
--    पर्वत प्रदेश में पावस    parvata pradesha men pavasa parvat pradesh pavas -> ALL-TOKENS
--
--  CRITICALLY: shortening happens INSIDE the vowel tables, so it can only ever
--  touch Devanagari-derived letters. An earlier revision folded aa/ii/uu over
--  the WHOLE string and silently broke Latin content — "Meiosis I" and
--  "Meiosis II" collapsed to one key, and the query "IIT" shortened to a
--  2-character needle that fell below the tier floors and returned nothing.
--  Latin bytes must stay untouched; the self-test asserts that as an equation.
--
--  What is still NOT covered: Hindi deletes schwa word-INTERNALLY too (सूरदास
--  -> "suradasa" against a typed "surdas"), and function words vary ("mein"
--  vs "men"). Those reach the fuzzy word_similarity tier and may miss. The
--  honest fix is a small curated alias table a human can extend — NOT more
--  guessing about which vowels to drop, which would make the key
--  non-deterministic and break the prefix tier for everyone.
--
--  INDEX SAFETY WARNING
--  universal_search builds expression indexes on public.search_latin_key(col).
--  An expression index is only as correct as the function was on the day it was
--  built. If you EVER change the transliteration table below after those
--  indexes exist, you MUST `reindex` them in the same transaction, or searches
--  will silently miss rows. That is also why the self-test at the bottom raises
--  rather than warns: a broken transliterator must not be applyable.
--
--  Requires: universal_search.sql (for public.normalize_search_text).
--  Apply BEFORE the universal_search v11 replacement, which indexes these.
--  Database encoding must be UTF8 (Supabase always is).
-- =====================================================================


-- ------------------------------------------------------------
--  translit_devanagari — Devanagari block (U+0900..U+097F) to Latin
--
--  Written as an explicit character loop, NOT translate(). translate() is a
--  context-free 1:1 substitution and this script is neither:
--
--    * a consonant carries an INHERENT 'a'  (क -> "ka", ब -> "ba");
--    * a following matra REPLACES it        (कि -> "ki",  बे -> "be");
--    * a following virama U+094D CANCELS it (क् -> "k");
--    * so conjuncts fall out for free       (क्ष -> "ksha", त्र -> "tra").
--
--  Implementation: v_cons holds the consonant that is still waiting to learn
--  its vowel. Every branch either fills it, cancels it, or FLUSHES it with the
--  inherent 'a' before emitting something else. End of string flushes too.
--
--  Code points are written in decimal because the matras and the virama are
--  combining characters: pasted into source they attach themselves to the
--  preceding character and become invisible and un-reviewable. The U+ value and
--  the Unicode name are in the comment on every line — that is the readable
--  form here, and it cannot be corrupted by an editor or a diff viewer.
-- ------------------------------------------------------------
create or replace function public.translit_devanagari(p_text text)
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $translit$
declare
  -- '[' U+0900 '-' U+097F ']' built with chr() for the same reason as above.
  c_deva  constant text := '[' || chr(2304) || '-' || chr(2431) || ']';
  v_len   int;
  v_i     int := 1;
  v_cp    int;
  v_cons  text := null;   -- consonant awaiting its vowel: 'k', 'bh', 'gy', ...
  v_out   text := '';
  v_v     text;
  v_c     text;
begin
  -- Contract: STRICT-safe on null.
  if p_text is null then
    return null;
  end if;

  -- IDENTITY FAST PATH, and the reason one key can serve both scripts: text
  -- with no Devanagari in it is returned byte-for-byte unchanged. Every Latin
  -- title and every Latin query takes this branch, so the loop never runs on
  -- the overwhelmingly common case and this function costs one regex test.
  if p_text !~ c_deva then
    return p_text;
  end if;

  v_len := length(p_text);

  while v_i <= v_len loop
    v_cp := ascii(substr(p_text, v_i, 1));

    -- ---- ज्ञ, the one conjunct that does NOT fall out of the general rules.
    -- ज=j + ञ=n would give "jn", but every Hindi speaker says and types "gy"
    -- (ज्ञान -> "gyaana", विज्ञान -> "vigyaana"). Three code points, so it has
    -- to be matched by lookahead and therefore has to come first.
    -- ascii(substr()) past the end is ascii('') = 0, so this cannot over-read.
    if v_cp = 2332                                          -- U+091C  JA
       and ascii(substr(p_text, v_i + 1, 1)) = 2381          -- U+094D  VIRAMA
       and ascii(substr(p_text, v_i + 2, 1)) = 2334          -- U+091E  NYA
    then
      if v_cons is not null then v_out := v_out || v_cons || 'a'; end if;
      v_cons := 'gy';
      v_i := v_i + 3;
      continue;
    end if;

    -- ---- OUTSIDE THE DEVANAGARI BLOCK: pass through unchanged.
    if v_cp < 2304 or v_cp > 2431 then                      -- U+0900 .. U+097F
      -- The one documented exception. ZWNJ/ZWJ are invisible cluster-shaping
      -- controls that appear INSIDE Devanagari words (क्‌ष) and mean nothing
      -- lexically. Passing them through would leave a zero-width character in
      -- the key, where normalize_search_text will not remove it either (it is
      -- Cf, neither punct nor space), so the same word stored with and without
      -- one would get two different keys and one of them would never match.
      -- Dropping them cannot affect Latin input: Latin text never contains
      -- them, so the identity guarantee above is untouched.
      if v_cp = 8204 or v_cp = 8205 then                    -- U+200C, U+200D
        v_i := v_i + 1;
        continue;
      end if;
      if v_cons is not null then v_out := v_out || v_cons || 'a'; v_cons := null; end if;
      v_out := v_out || substr(p_text, v_i, 1);
      v_i := v_i + 1;
      continue;
    end if;

    -- ---- DEPENDENT VOWEL SIGNS (matras). These REPLACE the inherent 'a'.
    v_v := case v_cp
             when 2362 then 'e'     -- U+093A  vowel sign OE
             when 2363 then 'aa'    -- U+093B  vowel sign OOE
             when 2366 then 'a'     -- U+093E  vowel sign AA  (short: students type 'sakhi', not 'saakhii')
             when 2367 then 'i'     -- U+093F  vowel sign I
             when 2368 then 'i'     -- U+0940  vowel sign II  (short, see AA)
             when 2369 then 'u'     -- U+0941  vowel sign U
             when 2370 then 'u'     -- U+0942  vowel sign UU  (short, see AA)
             when 2371 then 'ri'    -- U+0943  vowel sign VOCALIC R
             when 2372 then 'ri'    -- U+0944  vowel sign VOCALIC RR
             when 2373 then 'e'     -- U+0945  vowel sign CANDRA E
             when 2374 then 'e'     -- U+0946  vowel sign SHORT E
             when 2375 then 'e'     -- U+0947  vowel sign E
             when 2376 then 'ai'    -- U+0948  vowel sign AI
             when 2377 then 'o'     -- U+0949  vowel sign CANDRA O
             when 2378 then 'o'     -- U+094A  vowel sign SHORT O
             when 2379 then 'o'     -- U+094B  vowel sign O
             when 2380 then 'au'    -- U+094C  vowel sign AU
             when 2382 then 'e'     -- U+094E  vowel sign PRISHTHAMATRA E
             when 2383 then 'au'    -- U+094F  vowel sign AW
             when 2402 then 'li'    -- U+0962  vowel sign VOCALIC L
             when 2403 then 'li'    -- U+0963  vowel sign VOCALIC LL
           end;
    if v_v is not null then
      v_out  := v_out || coalesce(v_cons, '') || v_v;
      v_cons := null;
      v_i    := v_i + 1;
      continue;
    end if;

    -- ---- VIRAMA: cancel the inherent 'a'. This is what builds conjuncts.
    if v_cp = 2381 then                                     -- U+094D  VIRAMA
      v_out  := v_out || coalesce(v_cons, '');
      v_cons := null;
      v_i    := v_i + 1;
      continue;
    end if;

    -- ---- MARKS THAT PRODUCE NOTHING.
    -- Dropped WITHOUT flushing v_cons: the pending consonant is simply carried
    -- past them, which is what a combining mark should do. Deferring the flush
    -- can never lose it — the next branch or the end of the loop emits it.
    -- Nukta matters most: dropping it makes ड+U+093C give exactly the same key
    -- as the precomposed ड़ U+095C, so canonically-different spellings of
    -- बड़े both key to "bade" and the expression index stays trustworthy.
    if v_cp = 2364                                          -- U+093C  NUKTA
       or v_cp = 2365                                       -- U+093D  AVAGRAHA
       or (v_cp between 2385 and 2391)                      -- U+0951..U+0957 accents
       or v_cp = 2417                                       -- U+0971  high spacing dot
       or v_cp = 2429                                       -- U+097D  glottal stop
    then
      v_i := v_i + 1;
      continue;
    end if;

    -- ---- Everything from here FLUSHES the pending consonant first.
    -- हंस must become "hansa", not "hnsa": the anusvara follows a consonant
    -- that still owns its inherent 'a'.
    if v_cons is not null then v_out := v_out || v_cons || 'a'; v_cons := null; end if;

    -- ---- NASALISATION AND ASPIRATION MARKS.
    if v_cp = 2304 or v_cp = 2305 or v_cp = 2306 then
      v_out := v_out || 'n';        -- U+0900 inverted candrabindu, U+0901 ँ, U+0902 ं
      v_i := v_i + 1;
      continue;
    end if;
    if v_cp = 2307 then                                     -- U+0903  VISARGA
      v_out := v_out || 'h';
      v_i := v_i + 1;
      continue;
    end if;

    -- ---- INDEPENDENT VOWELS.
    v_v := case v_cp
             when 2308 then 'a'     -- U+0904  SHORT A
             when 2309 then 'a'     -- U+0905  A
             when 2310 then 'a'     -- U+0906  AA  (short, see the matra table)
             when 2311 then 'i'     -- U+0907  I
             when 2312 then 'i'     -- U+0908  II  (short)
             when 2313 then 'u'     -- U+0909  U
             when 2314 then 'u'     -- U+090A  UU  (short)
             when 2315 then 'ri'    -- U+090B  VOCALIC R
             when 2316 then 'li'    -- U+090C  VOCALIC L
             when 2317 then 'e'     -- U+090D  CANDRA E
             when 2318 then 'e'     -- U+090E  SHORT E
             when 2319 then 'e'     -- U+090F  E
             when 2320 then 'ai'    -- U+0910  AI
             when 2321 then 'o'     -- U+0911  CANDRA O
             when 2322 then 'o'     -- U+0912  SHORT O
             when 2323 then 'o'     -- U+0913  O
             when 2324 then 'au'    -- U+0914  AU
             when 2400 then 'ri'    -- U+0960  VOCALIC RR
             when 2401 then 'li'    -- U+0961  VOCALIC LL
             when 2418 then 'a'     -- U+0972  CANDRA A
             when 2419 then 'a'     -- U+0973  OE
             when 2420 then 'a'     -- U+0974  OOE
             when 2421 then 'au'    -- U+0975  AW
             when 2422 then 'u'     -- U+0976  UE
             when 2423 then 'uu'    -- U+0977  UUE
           end;
    if v_v is not null then
      v_out := v_out || v_v;
      v_i   := v_i + 1;
      continue;
    end if;

    -- ---- CONSONANTS. The value is the consonant ALONE; the inherent 'a' is
    -- added later, by whichever branch flushes it. The precomposed nukta forms
    -- U+0958..U+095F map to the same letters as base+U+093C on purpose (see
    -- the nukta note above) — क़/ख़/ग़/ज़ lose the Perso-Arabic distinction
    -- (q/x/gh/z) because a student typing a chapter name does not make it.
    v_c := case v_cp
             when 2325 then 'k'     -- U+0915  KA
             when 2326 then 'kh'    -- U+0916  KHA
             when 2327 then 'g'     -- U+0917  GA
             when 2328 then 'gh'    -- U+0918  GHA
             when 2329 then 'n'     -- U+0919  NGA
             when 2330 then 'ch'    -- U+091A  CA
             when 2331 then 'chh'   -- U+091B  CHA   (छ; keeps छ distinct from च)
             when 2332 then 'j'     -- U+091C  JA
             when 2333 then 'jh'    -- U+091D  JHA
             when 2334 then 'n'     -- U+091E  NYA
             when 2335 then 't'     -- U+091F  TTA
             when 2336 then 'th'    -- U+0920  TTHA
             when 2337 then 'd'     -- U+0921  DDA
             when 2338 then 'dh'    -- U+0922  DDHA
             when 2339 then 'n'     -- U+0923  NNA
             when 2340 then 't'     -- U+0924  TA
             when 2341 then 'th'    -- U+0925  THA
             when 2342 then 'd'     -- U+0926  DA
             when 2343 then 'dh'    -- U+0927  DHA
             when 2344 then 'n'     -- U+0928  NA
             when 2345 then 'n'     -- U+0929  NNNA
             when 2346 then 'p'     -- U+092A  PA
             when 2347 then 'ph'    -- U+092B  PHA
             when 2348 then 'b'     -- U+092C  BA
             when 2349 then 'bh'    -- U+092D  BHA
             when 2350 then 'm'     -- U+092E  MA
             when 2351 then 'y'     -- U+092F  YA
             when 2352 then 'r'     -- U+0930  RA
             when 2353 then 'r'     -- U+0931  RRA
             when 2354 then 'l'     -- U+0932  LA
             when 2355 then 'l'     -- U+0933  LLA
             when 2356 then 'l'     -- U+0934  LLLA
             when 2357 then 'v'     -- U+0935  VA
             when 2358 then 'sh'    -- U+0936  SHA
             when 2359 then 'sh'    -- U+0937  SSA
             when 2360 then 's'     -- U+0938  SA
             when 2361 then 'h'     -- U+0939  HA
             when 2392 then 'k'     -- U+0958  QA    (= KA + nukta)
             when 2393 then 'kh'    -- U+0959  KHHA
             when 2394 then 'g'     -- U+095A  GHHA
             when 2395 then 'j'     -- U+095B  ZA
             when 2396 then 'd'     -- U+095C  DDDHA (ड़)
             when 2397 then 'dh'    -- U+095D  RHA   (ढ़)
             when 2398 then 'ph'    -- U+095E  FA    (फ़)
             when 2399 then 'y'     -- U+095F  YYA
             when 2424 then 'd'     -- U+0978  MARWARI DDA
             when 2425 then 'jh'    -- U+0979  ZHA
             when 2426 then 'y'     -- U+097A  HEAVY YA
             when 2427 then 'g'     -- U+097B  GGA
             when 2428 then 'j'     -- U+097C  JJA
             when 2430 then 'd'     -- U+097E  DDDA
             when 2431 then 'b'     -- U+097F  BBA
           end;
    if v_c is not null then
      v_cons := v_c;
      v_i    := v_i + 1;
      continue;
    end if;

    -- ---- DEVANAGARI DIGITS U+0966..U+096F -> 0..9.
    if v_cp between 2406 and 2415 then
      v_out := v_out || (v_cp - 2406)::text;
      v_i   := v_i + 1;
      continue;
    end if;

    -- ---- DANDA / DOUBLE DANDA / ABBREVIATION SIGN are sentence punctuation:
    -- a space, which normalize_search_text then collapses.
    if v_cp = 2404 or v_cp = 2405 or v_cp = 2416 then        -- U+0964 U+0965 U+0970
      v_out := v_out || ' ';
      v_i   := v_i + 1;
      continue;
    end if;

    if v_cp = 2384 then                                      -- U+0950  OM
      v_out := v_out || 'om';
      v_i   := v_i + 1;
      continue;
    end if;

    -- Unassigned / unhandled inside the block: drop it rather than leak a
    -- Devanagari character into something called a *Latin* key.
    v_i := v_i + 1;
  end loop;

  -- Trailing consonant still holding its inherent 'a' (पद -> "pada").
  if v_cons is not null then v_out := v_out || v_cons || 'a'; end if;

  return v_out;
end
$translit$;

comment on function public.translit_devanagari(text) is
  'Mechanical Devanagari->Latin transliteration in the spelling an Indian student types. Identity for non-Devanagari input. Only ever adds letters, never removes them.';


-- ------------------------------------------------------------
--  search_latin_key — THE shared comparison key
--
--  Transliterate, then hand the case/punctuation half to the EXISTING
--  normalize_search_text. Reused rather than reimplemented on purpose: the
--  Latin-only indexes in universal_search.sql are built on
--  normalize_search_text, and if the two normalisers ever drifted apart, a
--  Latin query would normalise one way for the old index and another way for
--  this one and the two tiers would disagree about what "matches".
--
--  Consequences of that composition, both relied upon by the caller:
--    * IDENTITY ON LATIN: search_latin_key(x) = normalize_search_text(x) for
--      every x containing no Devanagari. So the same expression can serve
--      Latin content without changing its behaviour at all.
--    * IDEMPOTENT: search_latin_key(search_latin_key(x)) = search_latin_key(x),
--      because the output is always already-normalised Latin. That is what lets
--      the QUERY and the CONTENT go through the same function.
--    * null / empty / punctuation-only input -> null (from normalize_search_text).
-- ------------------------------------------------------------
create or replace function public.search_latin_key(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $key$
  select public.normalize_search_text(public.translit_devanagari(p_text));
$key$;

comment on function public.search_latin_key(text) is
  'Script-neutral comparison key: Devanagari transliterated to Latin, then normalize_search_text. Identity transform for Latin input, so one key serves Latin and Devanagari content and queries in all four combinations.';


-- ------------------------------------------------------------
-- GRANTS
--
-- Supabase grants EXECUTE on every new public function to anon, authenticated
-- AND service_role by default, so a bare `grant ... to anon` is a no-op that
-- hides whatever the default already allowed. Revoke first, then grant exactly
-- what is intended — same reasoning as the grant block in universal_search.sql.
--
-- Both MUST be executable by anon, and this is not optional: universal_search
-- is SECURITY INVOKER, so when a logged-out student searches, its body runs as
-- anon and calls search_latin_key BY NAME. Tightening either of these to
-- authenticated-only makes every public search fail with "permission denied for
-- function search_latin_key" — the whole search box, for every visitor, not
-- just the Hindi chapters.
--
-- The exposure is nil: both are IMMUTABLE pure text functions that read no
-- table and can only tell the caller something about a string they already have.
-- ------------------------------------------------------------
revoke all on function public.translit_devanagari(text)
  from public, anon, authenticated, service_role;
revoke all on function public.search_latin_key(text)
  from public, anon, authenticated, service_role;

grant execute on function public.translit_devanagari(text)
  to anon, authenticated, service_role;
grant execute on function public.search_latin_key(text)
  to anon, authenticated, service_role;


-- =====================================================================
--  SELF-TEST — raises, so a broken transliterator cannot be applied.
--
--  These are not invented strings: every Devanagari row below is a real
--  chapter name from the CBSE Class 10 Hindi A/B catalogue as stored in
--  public.chapters today. The expected value is THIS SCHEME'S canonical
--  output AFTER the informal-romanisation fold, so "saakhii" is stored as
--  "sakhi" and the spelling a student types is a substring of the key. What
--  the fold does NOT cover ("mein" vs "men") is the fuzzy tier's job. The test asserts
--  the exact key so that any future edit to the mapping table shows up here
--  instead of as silently missing search results.
--
--  Every pair is also checked for idempotence (key(key(x)) = key(x)), because
--  the query and the content are both pushed through this same function and a
--  scheme that is not idempotent would match content only when the student
--  typed Devanagari.
-- =====================================================================
do $selftest$
declare
  r      record;
  v_got  text;
  v_bad  text := '';
  v_n    int  := 0;
begin
  for r in
    select * from (values
      -- ---- Class 10 Hindi B, verbatim from the catalogue ----------------
      ('कबीर की साखी',            'kabira ki sakhi'),
      ('मीरा के पद',              'mira ke pada'),
      ('मनुष्यता',                'manushyata'),
      ('पर्वत प्रदेश में पावस',      'parvata pradesha men pavasa'),
      ('बड़े भाई साहब',           'bade bhai sahaba'),
      ('तोप',                     'topa'),
      ('कर चले हम फ़िदा',          'kara chale hama phida'),
      ('आत्मत्राण',               'atmatrana'),
      ('डायरी का एक पन्ना',        'dayari ka eka panna'),
      ('तताँरा वामीरो कथा',        'tatanra vamiro katha'),
      ('पतझर में टूटी पत्तियाँ',     'patajhara men tuti pattiyan'),
      ('कारतूस',                  'karatusa'),
      ('हरिहर काका',              'harihara kaka'),
      ('सपनों के से दिन',          'sapanon ke se dina'),
      ('टोपी शुक्ला',              'topi shukla'),
      ('सूरदास',                  'suradasa'),
      -- ---- the three conjuncts the design note claims -------------------
      ('क्षितिज',                  'kshitija'),   -- क् + ष -> ksh, positionally
      ('क्ष',                      'ksha'),
      ('त्र',                      'tra'),
      ('ज्ञ',                      'gya'),        -- the one hard-coded digraph
      ('ज्ञान',                    'gyana'),
      ('विज्ञान',                  'vigyana'),
      ('त्रिकोणमिति',              'trikonamiti'),-- lands EXACT on what students type
      ('राम लक्ष्मण',              'rama lakshmana'),
      -- ---- marks -------------------------------------------------------
      ('हंस',                     'hansa'),      -- anusvara after inherent 'a'
      ('संख्या',                   'sankhya'),
      ('दुःख',                    'duhkha'),     -- visarga
      ('ॐ',                       'om'),
      ('अध्याय १२',               'adhyaya 12'),-- Devanagari digits
      ('राम। सीता',               'rama sita'),-- danda becomes a space
      -- ---- mixed script, the real shape of many titles -----------------
      ('Class 10 हिंदी B',        'class 10 hindi b'),
      -- ---- LATIN IDENTITY ----------------------------------------------
      ('Projectile Motion',        'projectile motion'),
      ('Class 11 Physics: Motion', 'class 11 physics motion'),
      ('Newton''s Laws of Motion', 'newtons laws of motion')
    ) as t(src, expected)
  loop
    v_n := v_n + 1;

    v_got := public.search_latin_key(r.src);
    if v_got is distinct from r.expected then
      v_bad := v_bad || format(E'\n  %s  ->  %L   expected  %L', r.src, v_got, r.expected);
    end if;

    -- Idempotence: the key of the key must be the key.
    if public.search_latin_key(v_got) is distinct from v_got then
      v_bad := v_bad || format(E'\n  NOT IDEMPOTENT: %L -> %L',
                               v_got, public.search_latin_key(v_got));
    end if;
  end loop;

  -- A test that passes because the list was emptied proves nothing.
  if v_n < 30 then
    raise exception 'search_latin_key self-test is vacuous: only % pairs checked', v_n;
  end if;

  if v_bad <> '' then
    raise exception 'search_latin_key self-test FAILED (% pairs checked):%', v_n, v_bad;
  end if;

  raise notice 'search_latin_key: % transliteration pairs OK.', v_n;
end
$selftest$;


-- Invariants that are not single pairs.
do $selftest_invariants$
declare
  r        record;
  v_bad    text := '';
  v_zwnj   text;
  v_collide text;
begin
  ------------------------------------------------------------------ null/empty
  if public.search_latin_key(null) is not null then
    v_bad := v_bad || E'\n  search_latin_key(null) must be null';
  end if;
  if public.translit_devanagari(null) is not null then
    v_bad := v_bad || E'\n  translit_devanagari(null) must be null';
  end if;
  if public.search_latin_key('') is not null then
    v_bad := v_bad || E'\n  search_latin_key('''') must be null';
  end if;
  if public.search_latin_key('   ') is not null then
    v_bad := v_bad || E'\n  whitespace-only must be null';
  end if;
  -- A lone danda is punctuation in any script: it must not become a key.
  if public.search_latin_key(chr(2404)) is not null then
    v_bad := v_bad || E'\n  lone danda U+0964 must be null, not a key';
  end if;

  ------------------------------------------------- Latin identity, stated once
  -- The contract's central claim, asserted as an EQUATION against the existing
  -- normaliser rather than against hand-written strings: for anything with no
  -- Devanagari in it, this function must do exactly what the Latin-only tiers
  -- already do, or the two index sets disagree.
  if exists (
    select 1 from (values
      ('Projectile Motion'), ('  ROTATIONAL   motion  '), ('p-Block Elements'),
      ('Newton''s 3rd Law'), ('Thermodynamics (Part 2)'), ('12th / Dropper'),
      ('Class 11 Physics: Motion'), ('Alcohols, Phenols & Ethers')
    ) as t(s)
     where public.search_latin_key(t.s) is distinct from public.normalize_search_text(t.s)
  ) then
    v_bad := v_bad || E'\n  Latin input is NOT the identity transform: '
                   || 'search_latin_key <> normalize_search_text';
  end if;
  -- ...and translit itself must not touch a Latin byte, punctuation included.
  if public.translit_devanagari('Projectile Motion 12: p-Block & Co.')
     is distinct from 'Projectile Motion 12: p-Block & Co.' then
    v_bad := v_bad || E'\n  translit_devanagari altered pure-Latin text';
  end if;

  ------------------------------------------------ Unicode spelling robustness
  -- बड़े written with the PRECOMPOSED ड़ (U+095C) and with the DECOMPOSED
  -- ड + nukta (U+0921 U+093C) are the same word and must key identically —
  -- otherwise an expression index built over rows imported from two different
  -- sources silently splits into two half-searchable halves.
  if public.search_latin_key(chr(2348) || chr(2396) || chr(2375))
     is distinct from public.search_latin_key(chr(2348) || chr(2337) || chr(2364) || chr(2375))
  then
    v_bad := v_bad || E'\n  precomposed U+095C and decomposed U+0921+U+093C disagree';
  end if;
  if public.search_latin_key(chr(2348) || chr(2396) || chr(2375)) is distinct from 'bade' then
    v_bad := v_bad || E'\n  बड़े must key to bade';
  end if;
  -- फ़ the same way: U+095E vs U+092B + nukta.
  if public.search_latin_key(chr(2398) || chr(2367))
     is distinct from public.search_latin_key(chr(2347) || chr(2364) || chr(2367))
  then
    v_bad := v_bad || E'\n  precomposed U+095E and decomposed U+092B+U+093C disagree';
  end if;
  -- A ZWNJ inside a cluster is invisible and must be invisible to the key too.
  v_zwnj := chr(2325) || chr(2381) || chr(8204) || chr(2359)
            || chr(2367) || chr(2340) || chr(2367) || chr(2332);
  if public.search_latin_key(v_zwnj) is distinct from 'kshitija' then
    v_bad := v_bad || format(E'\n  ZWNJ changed the key: got %L, want %L',
                             public.search_latin_key(v_zwnj), 'kshitija');
  end if;

  ------------------------------------------------------------ positional rules
  -- These four assert the mechanism itself, not a word: inherent 'a', matra
  -- replacement, virama cancellation. If someone "simplifies" the loop into a
  -- translate() call, these are what break first.
  if public.search_latin_key(chr(2325))                is distinct from 'ka'  then
    v_bad := v_bad || E'\n  bare क must carry the inherent a -> ka'; end if;
  if public.search_latin_key(chr(2325) || chr(2367))   is distinct from 'ki'  then
    v_bad := v_bad || E'\n  matra must REPLACE the inherent a: कि -> ki'; end if;
  if public.search_latin_key(chr(2325) || chr(2381))   is distinct from 'k'   then
    v_bad := v_bad || E'\n  virama must CANCEL the inherent a: क् -> k'; end if;
  if public.search_latin_key(chr(2348) || chr(2375))   is distinct from 'be'  then
    v_bad := v_bad || E'\n  बे -> be'; end if;


  ------------------------------------------- the fold's reason for existing
  -- Not a transform check: the SPELLING A STUDENT TYPES must be findable in
  -- the key. Token-substring containment is exactly what the all-tokens tier
  -- matches on, so this asserts the end-to-end promise, not an intermediate.
  --
  -- KNOWN GAP, deliberately not asserted here: Hindi also deletes schwa
  -- word-INTERNALLY, which this fold does not model. सूरदास keys to "suradasa"
  -- but a student types "surdas"; कारतूस keys to "karatusa" against "kartus".
  -- Those reach the fuzzy word_similarity tier instead of the exact tiers, and
  -- may miss. Modelling interior schwa correctly is context-dependent Hindi
  -- phonology, not a regex — the honest fix is a small curated alias table
  -- (typed form -> chapter) that a human can extend, which is why this test
  -- asserts only the cases the fold genuinely delivers rather than pretending.
  for r in
    select * from (values
      ('कबीर की साखी',        'kabir ki sakhi'),
      ('मीरा के पद',          'mira ke pad'),
      ('बड़े भाई साहब',       'bade bhai sahab'),
      ('टोपी शुक्ला',          'topi shukla'),
      ('डायरी का एक पन्ना',    'dayari ka ek panna'),
      ('हरिहर काका',          'harihar kaka')
    ) as t(devanagari, typed)
  loop
    -- coalesce + null guard: bool_and over an empty set is NULL and 'if not
    -- (NULL)' does not branch, so without this the assertion could pass by
    -- producing no tokens at all — the vacuity class this file guards against.
    if public.search_latin_key(r.typed) is null
       or not coalesce((
         select bool_and(public.search_latin_key(r.devanagari) like '%' || tok || '%')
           from unnest(string_to_array(public.search_latin_key(r.typed), ' ')) as tok
       ), false) then
      v_bad := v_bad || format(
        E'\n  a student typing %L cannot reach %L (key %L)',
        r.typed, r.devanagari, public.search_latin_key(r.devanagari));
    end if;
  end loop;

  ------------------------------------------- key collisions over REAL DATA
  -- THE ASSERTION THAT WOULD HAVE CAUGHT THE LAST BUG. A revision of this file
  -- folded aa/ii/uu over the whole string, which collapsed "Meiosis I" and
  -- "Meiosis II" to one key: the query "Meiosis II" then returned Meiosis I
  -- labelled 'exact', and no query could reach the second lesson ever again.
  -- Every transform-level test still passed, because they all assert the
  -- transform, not its effect on the catalogue. This one asserts the effect:
  -- two DIFFERENT titles inside one course must never share a key.
  -- Verified to hold on production data (0 collisions) before being made fatal.
  select string_agg(format('%L (course %s)', d.k, d.playlist_id), '; ')
    into v_collide
    from (
      select pv.playlist_id, public.search_latin_key(v.title) as k
        from public.playlist_videos pv
        join public.videos v on v.id = pv.video_id
       group by pv.playlist_id, public.search_latin_key(v.title)
      having count(distinct v.title) > 1
    ) d;
  if v_collide is not null then
    v_bad := v_bad || E'\n  distinct lesson titles collapse to one search key, '
                   || 'so one of them is unreachable: ' || v_collide;
  end if;

  if v_bad <> '' then
    raise exception 'search_latin_key invariant self-test FAILED:%', v_bad;
  end if;

  raise notice 'search_latin_key: invariants OK (null-safety, Latin identity, nukta/ZWNJ, positional rules).';
end
$selftest_invariants$;
