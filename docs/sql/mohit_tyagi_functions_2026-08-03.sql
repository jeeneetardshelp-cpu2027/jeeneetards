-- CREATE-ONLY import: a second teaching voice for JEE Mathematics chapter 276.
--
-- Chapter 276 ("Relations and Functions") currently carries lessons from ONE institute, so a
-- student comparing teaching styles has nothing to compare. This adds the
-- complete Mohit Tyagi course for the same chapter.
--
-- Source     : https://www.youtube.com/playlist?list=PL_A4M5IAkMad5zB0Dh6gUw1eYK8dN7hP7
-- Lessons    : 187 (the playlist's full declared count, enumerated in playlist order)
-- Verified   : every youtube_video_id below returned HTTP 200 from YouTube's
--              oEmbed API with author_name "Mohit Tyagi" and a title byte-identical
--              to the source_title recorded here.
-- Titles     : "title" is the cleaned display title (leading playlist numbering,
--              channel branding and exam tags removed); "source_title" preserves
--              YouTube's original verbatim. All 187 pass src/titleQuality.js with
--              zero blocking issues and zero warnings, and are unique within the course.
--
-- Safe to re-run: it aborts rather than duplicating. Order-independent, so it does
-- not matter which of the six 2026-08-03 import files you run first.
do $$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_class_id bigint;
  v_dropper_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_row record;
  v_inserted integer := 0;
begin
  select id into strict v_channel_id
  from public.institutes_channels
  where youtube_channel_id = 'UCpyc1eTpM1cA3P0ZWym4clw';

  select id into strict v_goal_id from public.learning_goals where slug = 'jee';
  select id into strict v_class_id from public.class_levels where slug = 'class-11';
  select id into strict v_dropper_id from public.class_levels where slug = 'dropper';

  -- Guard the target rather than a global row count, so these six files can be
  -- run in any order and a re-run fails loudly instead of duplicating lessons.
  if not exists (
    select 1 from public.chapters
    where id = 276 and subject_id = 3 and name = 'Relations and Functions'
  ) then
    raise exception 'chapter 276 is not the expected "%" chapter', 'Relations and Functions';
  end if;

  if exists (select 1 from public.playlists where title = 'Functions') then
    raise exception 'course "%" already exists - this file has already been run', 'Functions';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      '9-u0G4neDeE', 'SK49jDbZsFA', 'yHOYF99Ibms', 'M1pR3K9luBg', 'It2tBbiGtqk', 'Z9Ev4FBBal8',
      'c_B4GCUmQa4', 'rgvlXA7HA90', 'R3UgBUsTIeU', 's_S-YPXXv34', 'L5FWiZf6I4s', 'eOvv9hhZieg',
      'E2W1VZhzy6s', 'qN9U-j6BTJY', 'poUIv_wGeZo', 'QiMXo2k3JMw', 'd_0o7IQ3UiU', 'WtoOw1lbq4Y',
      'GFUBEdaCO6Y', 'ge_eICXO5Ho', 'DycpQNOfCt4', 'YBOjZVgr52k', 'yk84cWp9EBU', 'eL0qjzsPhXc',
      'WT0qNuTTHhw', 'DeA16yBlXs4', '2-cqt79Pnio', '4v2uAsofIfg', 'TPtJ3igrXpU', '3nzxhwned0Q',
      'b8wvOujILjw', 'IRcDuvrIbwM', 'R9AqKgA4DZ8', 'XqiRaNihVKw', '-XOObragdEM', 'Jt9z5LrQLYs',
      'd2K6zAAMEJc', 'QrUmNHFFPwM', 'noyC6VnFBe8', 'w-zo4apkG1w', 'f7YB9TFmEbE', 'shPplXXlTwY',
      '69C-0lOYixA', 'XoPtdKRYCZQ', '53TogqRikPM', 'BEHlMyAiWaw', 'nCtDwxp_z3A', 'GQIz1JF3oRs',
      'sbPqL0XI0Yo', '1QEVf9pxQdw', 'fjEft5NNft4', '0ZO2of8CRVM', 'gf6q9o_TpMM', 'oRaCPC85EzY',
      '2BgZULoK9hk', 'OqQWDWQP0tA', 'EApHGMjh8s0', 'hYySkDVY9Bk', '8nMgxmJYEOY', 'IFJz5ILxWzE',
      'IbLPRggnj5o', 'manndgTn5jA', 'geWTb6iQSmA', 'slCC07HNcyE', 'U7dg_brPfm4', 'AT3n57oxr6Q',
      'aDQqyFf7Fqo', 't1nZLM-du9A', 'y6TEPa-t5mQ', 'FkyKKYoUrlE', 'otaMJIDHa0c', 'neuIZRNMfnM',
      '_nyaPCke4w0', 'U-PyCCoIA4c', 'M3INrD1Rlto', '1o8JsoEcUiM', '1PQqQtsZN9s', 'K_47bNTAKyE',
      '9NOefy8V-98', 'hJX9qTdWM4k', 'WLhwvYxR5_o', '6R4TOQwMda8', 'XWzVjsDTtuk', 'PHDQJT4jTI8',
      'VbbdzlUAQno', 'EOYtd2fYYzs', 'ranGnlxz0f8', 'uYCstlktcBQ', 'w0VCmqoB1WE', 'cIRIv74-0vQ',
      '2imvbDWvnTw', 'kFcwSc4rU0g', 'pRxMEkzYUpc', 'b69jjKYBWy8', 'moQiXyvy354', 'ggRaSVraXqk',
      'FE7Bzpju9PU', 'YIa1ZWnJ80U', '0EPm7r3xGME', 'SzNttO-qTzE', 'aDBJowh3ErE', '6qpxFn8PueY',
      '59FvQVi_924', 'EuC7d8o4naY', 'Crpjr1O8IeE', 'm-mN7v5htZ8', 'd9KBlRilB_Y', '2CVhaCDrsEI',
      'smK8YCh4IEw', 'qidHQq7FKHM', 's7972tK_F2M', 'wSNurZM9z3w', 'wsQqa4BV1oY', 'P8khCEaMn0c',
      '5b398gq31dA', 'UxP9k10lHOc', 'Bg8r5ofCop8', 'pkkI94ampx8', '5ehApzUBj-0', 'x0IZye1wcME',
      '1p0QHrQH2FQ', 'CwscCy805vQ', 'sEByZBT8YfY', 'UCVZcBQnu3Q', 'Xza4iDTRRbM', 'qfE6Y1eGsQE',
      '0Pmo9XVi42s', 'vq4A03k_4EI', '_J_q9pixTTs', 'TweGuQHfWXs', 'zgzxgatG0c8', 'qlsfIdMGK-8',
      '1LmAA7dO8Ec', 'ImBOAJJzzYM', 'NOy0PHhO8tE', 'h2nINj63FF0', '93rml_UoweI', 'dHVYJRrljgE',
      '9TlnoFEsSQ0', 'APY-A4OUI9k', 'I3CjPoiZt6Y', 'G0Hd2el7pfw', 'nK3db9k1KkQ', 'Wm9-rJTRPjc',
      'UfgOqmyh0JI', 'gFo5_ax_zvE', 'BK8ribpUBuY', 'Df5xsuTBn7M', '9c35EWpWubc', 'UeDT_N4WUgw',
      'pNNwEktvXmc', 'MXQxKIC-O2c', 'sTeslmpNtDU', '6bdfeZ3-GfA', 'aloT4CmySjo', 'OG4QiKQiaGs',
      'yADqhdVii1c', 'v718F72BKZM', 'TaCMVtZ8Xrs', 'j2taDOPtX7c', 'xjU6A0DVsNk', 'qvPIfGbtfVQ',
      'eaiVB6e_rTU', 'kCIezWDe9sE', '6hI4gGk4tgU', 'kU_TTNT8sac', 'j9pPOBfJbMA', 'Kw_ICVb3HNU',
      'oCbs_cKoo6w', 'KZeTp-d0tkc', 'M4fazVIP9ik', 'UtfYEpHNcYY', 'cwSThJGCZ3M', '4NYR2789eaU',
      'yUjbctDSZ8o', 'MSluU-WM0Lg', 'H4EHIS7aNH4', 'ivQhxVhkIEQ', 'k0gidEhXm7A', 'nsF8UNQdjqU',
      'E5aiRM3nQqg', 'hvJlUaYkfro', 'Ic9WJ6dxKrY', 'YHNaNPokFDM', 'ALlskD3lWv8', 'ojoIO7dJS9A',
      'OvLCJ3ZcIYo'
    ])
  ) then
    raise exception 'at least one of these 187 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'Functions',
    'Function',
    'The complete Functions course from the official Mohit Tyagi playlist, in teaching order.',
    'Mohit Tyagi', v_channel_id, 1, 3, 'full-course', 'hinglish',
    'advanced', '11th'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  values (v_playlist_id, v_class_id), (v_playlist_id, v_dropper_id);

  for v_row in
    select * from (values
      (1, '9-u0G4neDeE', 'Function Introduction to Graph and Related — What is a function?', '1 Function Introduction to Graph and Related | What is a function? | Mohit Tyagi | IIT JEE Maths', 726),
      (2, 'SK49jDbZsFA', 'Function Terminologies related to Graph, Domain', '2-Function Terminologies related to Graph, Domain by Mohit Tyagi', 806),
      (3, 'yHOYF99Ibms', 'Function finding domain using graphs', '3 Function finding domain using graphs by Mohit Tyagi', 920),
      (4, 'M1pR3K9luBg', 'Range of function: Graphical interpretation', '4 Range of function: Graphical interpretation by Mohit Tyagi', 914),
      (5, 'It2tBbiGtqk', 'Function: Root, identifying roots on the graph, maximum and minimum value', '5 Function: Root, identifying roots on the graph, maximum and minimum value  by Mohit Tyagi', 639),
      (6, 'Z9Ev4FBBal8', 'Example of finding domain, range, root, maximum and minimum value for a given graph', '6 Example of finding domain, range, root, maximum and minimum value for a given graph by Mohit Tyagi', 692),
      (7, 'c_B4GCUmQa4', 'Function Asymptote, related example Maths', '7 Function Asymptote, related example Maths by Mohit Tyagi', 891),
      (8, 'rgvlXA7HA90', 'Function: Boundedness, unbounded, lower bounded, upper bounded', '8 Function: Boundedness, unbounded, lower bounded, upper bounded by Mohit Tyagi', 618),
      (9, 'R3UgBUsTIeU', 'Function: Boundedness continued, lower bound and upper bound for example', '9 Function: Boundedness continued, lower bound and upper bound for example, by Mohit Tyagi', 688),
      (10, 's_S-YPXXv34', 'Function: periodic/nonperiodic function', '10 Function: periodic/nonperiodic function by Mohit Tyagi', 402),
      (11, 'L5FWiZf6I4s', 'Function Elementary graphs, constant function, linear function, slope', '11 Function Elementary graphs, constant function, linear function, slope Mohit Tyagi Mathematics', 632),
      (12, 'eOvv9hhZieg', 'Function: Graphs for Linear functions, comparison of different lines with slope', '12 Function: Graphs for Linear functions, comparison of different lines with slope by Mohit Tyagi', 634),
      (13, 'E2W1VZhzy6s', 'Function: Quadratic function, parabola upward / downward, discriminant', '13 Function: Quadratic function, parabola upward / downward, discriminant by Mohit Tyagi', 725),
      (14, 'qN9U-j6BTJY', 'Function Elementary Graphs Plotting roots of quadratic expression', '14 Function Elementary Graphs Plotting roots of quadratic expression Mohit Tyagi', 633),
      (15, 'poUIv_wGeZo', 'Function — Elementary Graphs Vertex, intercept', '15 Function-Elementary Graphs Vertex, intercept Mohit Tyagi Mathematics', 642),
      (16, 'QiMXo2k3JMw', 'Function Elementary Graphs Line of symmetry, an example of plotting a parabola', '16 Function Elementary Graphs Line of symmetry, an example of plotting a parabola Mohit Tyagi', 675),
      (17, 'd_0o7IQ3UiU', 'Function Elementary Graphs Plotting of parabola in different cases', '17 Function Elementary Graphs Plotting of parabola in different cases Mohit Tyagi', 959),
      (18, 'WtoOw1lbq4Y', 'Function Elementary Graphs: Graph of even or odd exponent of x', '18 Function Elementary Graphs: Graph of even or odd exponent of x Mohit Tyagi', 660),
      (19, 'GFUBEdaCO6Y', 'Function Elementary Graph of exponent of X continued, its domain, range, roots', '19 Function Elementary Graph of exponent of X continued, its domain, range, roots Mohit Tyagi', 776),
      (20, 'ge_eICXO5Ho', 'Function Elementary Graphs Graphs of fractional/negative exponent of x', '20 Function Elementary Graphs Graphs of fractional/negative exponent of x Mohit Tyagi', 613),
      (21, 'DycpQNOfCt4', 'Function Elementary Graphs of exponent of X continued', '21 Function Elementary Graphs of exponent of X continued Mohit Tyagi Mathematics', 705),
      (22, 'YBOjZVgr52k', 'Function Elementary Graphs Exponential function, comparison graph', '22 Function Elementary Graphs Exponential function, comparison graph Mohit Tyagi', 670),
      (23, 'yk84cWp9EBU', 'Function Elementary Graphs Logarithmic function and comparison graphs', '23 Function Elementary Graphs Logarithmic function and comparison graphs Mohit Tyagi', 635),
      (24, 'eL0qjzsPhXc', 'Function Elementary Graphs Signum function', '24 Function Elementary Graphs Signum function Mohit Tyagi', 608),
      (25, 'WT0qNuTTHhw', 'Function Elementary Graphs Graph of y = x + 1/x', '25 Function Elementary Graphs Graph of y = x + 1/x Mohit Tyagi Mathematics', 605),
      (26, 'DeA16yBlXs4', 'Function Elementary Graphs Trigonometric function, the graph of sin/cos', '26 Function Elementary Graphs Trigonometric function, the graph of sin/cos Mohit Tyagi', 851),
      (27, '2-cqt79Pnio', 'Function Elementary Graphs Graph of tan(x)', '27 Function Elementary Graphs Graph of tan(x) Mohit Tyagi', 538),
      (28, '4v2uAsofIfg', 'Function — Elementary Graphs- Graph of cot X, sec X', '28-Function-Elementary Graphs- Graph of cot X, sec X - Mohit Tyagi Mathematics', 970),
      (29, 'TPtJ3igrXpU', 'Function Elementary Graphs: Graph of cosec x', '29 Function Elementary Graphs: Graph of cosec x Mohit Tyagi Mathematics', 435),
      (30, '3nzxhwned0Q', 'Function Elementary Graphs — Trigonometric functions with domain, range, period', '30 Function Elementary Graphs-Trigonometric functions with domain, range, period-Mohit Tyagi', 370),
      (31, 'b8wvOujILjw', 'Function Elementary Graphs: introduction of Greatest integer function', '31 Function Elementary Graphs: introduction of Greatest integer function Mohit Tyagi', 744),
      (32, 'IRcDuvrIbwM', 'Function Elementary Graphs: Plotting graph of greatest integer function', '32 Function Elementary Graphs: Plotting graph of greatest integer function Mohit Tyagi', 590),
      (33, 'R9AqKgA4DZ8', 'Function Elementary Graphs Introduction to fractional part function', '33 Function Elementary Graphs Introduction to fractional part function Mohit Tyagi Mathematics', 841),
      (34, 'XqiRaNihVKw', 'Function Elementary Graphs: Graph of fractional part function', '34 Function Elementary Graphs: Graph of fractional part function Mohit Tyagi Mathematics', 645),
      (35, '-XOObragdEM', 'Function Elementary Graphs: Important properties of greatest integer function (Part 35)', '35 Function Elementary Graphs: Important properties of greatest integer function Mohit Tyagi', 593),
      (36, 'Jt9z5LrQLYs', 'Function Elementary Graphs: Important properties of greatest integer function (Part 36)', '36 Function Elementary Graphs: Important properties of greatest integer function  Mohit Tyagi', 578),
      (37, 'd2K6zAAMEJc', 'Function Elementary Graphs: example greatest integer function', '37 Function Elementary Graphs: example greatest integer function Mohit Tyagi Mathematics', 536),
      (38, 'QrUmNHFFPwM', 'Function Elementary Graphs: Solution to inequalities involving greatest integer', '38 Function Elementary Graphs: Solution to inequalities involving greatest integer Mohit Tyagi', 833),
      (39, 'noyC6VnFBe8', 'Function Elementary Graphs Solution to inequalities involving greatest integer', '39 Function Elementary Graphs Solution to inequalities involving greatest integer Mohit Tyagi', 866),
      (40, 'w-zo4apkG1w', 'Function: Inverse Trigonometric Function', '40 Function: Inverse Trigonometric Function Mohit Tyagi', 754),
      (41, 'f7YB9TFmEbE', 'Function Inverse Trigonometric Function (Part 2)', '41 Function Inverse Trigonometric Function Part 2 Mohit Tyagi', 602),
      (42, 'shPplXXlTwY', 'Function Inverse Trigonometric: Example inverse trigonometric function with the given', '42 Function Inverse Trigonometric: Example inverse trigonometric function with the given argument', 726),
      (43, '69C-0lOYixA', 'Function Inverse Trigonometric: inverse trigonometric functions with their domain and', '43 Function Inverse Trigonometric: inverse trigonometric functions with their domain and range', 672),
      (44, 'XoPtdKRYCZQ', 'Function Inverse Trigonometric: Graphs of inverse trigonometric function', '44 Function Inverse Trigonometric: Graphs of inverse trigonometric function Mohit Tyagi', 720),
      (45, '53TogqRikPM', 'Function Inverse Trigonometric (important formula set)', '45 Function Inverse Trigonometric (important formula set) Mohit Tyagi Mathematics', 701),
      (46, 'BEHlMyAiWaw', 'Function Inverse Trigonometric (Formula set)', '46 Function Inverse Trigonometric (Formula set) Mohit Tyagi', 641),
      (47, 'nCtDwxp_z3A', 'Function Transformation of graphs — replacing x with -x', '47 Function Transformation of graphs | replacing x with -x  Mohit Tyagi', 605),
      (48, 'GQIz1JF3oRs', 'Function Solving equations and inequalities using graphs, number of solutions (Part 48)', '48 Function Solving equations and inequalities using graphs, number of solutions IIT JEE Mathematics', 367),
      (49, 'sbPqL0XI0Yo', 'Function Solving equations and inequalities using graphs, number of solutions (Part 49)', '49 Function Solving equations and inequalities using graphs, number of solutions-IIT JEE Mathematics', 541),
      (50, '1QEVf9pxQdw', 'Function Solving equations and inequalities using graphs, number of solutions (Part 50)', '50 Function Solving equations and inequalities using graphs, number of solutions Mohit Tyagi', 720),
      (51, 'fjEft5NNft4', 'Function Solving equations and inequalities using graphs, number of solutions (Part 51)', '51 Function Solving equations and inequalities using graphs, number of solutions Mohit Tyagi', 624),
      (52, '0ZO2of8CRVM', 'Function Solving equations and inequalities using graphs, number of solutions (Part 52)', '52 Function Solving equations and inequalities using graphs, number of solutions Mohit Tyagi', 763),
      (53, 'gf6q9o_TpMM', 'Function Solving equations and inequalities using graphs, number of solutions (Part 53)', '53 Function Solving equations and inequalities using graphs, number of solutions Mohit Tyagi', 596),
      (54, 'oRaCPC85EzY', 'Function — Solving equations and inequalities using graphs, number of solutions', '54 Function-Solving equations and inequalities using graphs, number of solutions Mohit Tyagi', 689),
      (55, '2BgZULoK9hk', 'Function Solving equations and inequalities using graphs, number of solutions (Part 55)', '55 Function Solving equations and inequalities using graphs, number of solutions Mohit Tyagi', 653),
      (56, 'OqQWDWQP0tA', 'Function Solving equations and inequalities using graphs, number of solutions (Part 56)', '56 Function Solving equations and inequalities using graphs, number of solutions Mohit Tyagi', 650),
      (57, 'EApHGMjh8s0', 'Function Domain and Range of Expression (Part 1)', '57 Function Domain and Range of Expression Part 1 Mohit Tyagi', 684),
      (58, 'hYySkDVY9Bk', 'Function Domain and Range of Expression (Part 2)', '57 Function Domain and Range of Expression Part 2 Mohit Tyagi', 730),
      (59, '8nMgxmJYEOY', 'Function Domain and Range of Expression (Part 3)', '57 Function Domain and Range of Expression Part 3 Mohit Tyagi | IIT JEE Maths', 687),
      (60, 'IFJz5ILxWzE', 'Function Domain and Range of Expression (Part 4)', '57 Function Domain and Range of Expression Part 4 Mohit Tyagi', 1026),
      (61, 'IbLPRggnj5o', 'Function Domain and Range of Expression (Part 57)', '57 Function Domain and Range of Expression Mohit Tyagi', 625),
      (62, 'manndgTn5jA', 'Function Domain and Range of Expression (Part 58)', '58 Function Domain and Range of Expression Mohit Tyagi', 610),
      (63, 'geWTb6iQSmA', 'Function Domain and Range of Expression (Part 59)', '59 Function Domain and Range of Expression Mohit Tyagi', 751),
      (64, 'slCC07HNcyE', 'Function Domain and Range of Expression (Part 60)', '60 Function Domain and Range of Expression Mohit Tyagi', 726),
      (65, 'U7dg_brPfm4', 'Function Domain and Range of Expression (Part 61)', '61 Function Domain and Range of Expression Mohit Tyagi', 552),
      (66, 'AT3n57oxr6Q', 'Function: Domain of square root function, logarithmic function, inverse function', '62 Function: Domain of square root function, logarithmic function, inverse function Mohit Tyagi', 805),
      (67, 'aDQqyFf7Fqo', 'Function Domain and Range: Points to remember, algebra of domain', '63 Function Domain and Range: Points to remember, algebra of domain Mohit Tyagi', 1105),
      (68, 't1nZLM-du9A', 'Function Domain and Range: Example of domain', '64 Function Domain and Range: Example of domain | Mohit Tyagi', 445),
      (69, 'y6TEPa-t5mQ', 'Function Domain and Range of Expression — Points to remember continued', '65 Function Domain and Range of Expression | Points to remember continued Mohit Tyagi', 732),
      (70, 'FkyKKYoUrlE', 'Function Domain and Range: Inequalities using periodic function, particular/general', '66 Function Domain and Range: Inequalities using periodic function, particular/general solution', 733),
      (71, 'otaMJIDHa0c', 'Function Domain and Range: Example of solving inequalities involving periodic function', '67 Function Domain and Range: Example of solving inequalities involving periodic function', 754),
      (72, 'neuIZRNMfnM', 'Function Domain and Range: Important point regarding writing an angle for a General value', '68 Function Domain and Range: Important point regarding writing an angle for a General value', 653),
      (73, '_nyaPCke4w0', 'Function Domain and Range: trigonometric function and trigonometric inverse functions', '69 Function Domain and Range: trigonometric function and trigonometric inverse functions', 504),
      (74, 'U-PyCCoIA4c', 'Function Domain and Range of Expression: example of domain composite function and related', '70 Function Domain and Range of Expression: example of domain composite function and related', 703),
      (75, 'M3INrD1Rlto', 'Function Domain and Range: Domain composite function, domain of binomial Coefficient', '71 Function Domain and Range: Domain composite function, domain of binomial Coefficient Mohit Tyagi', 602),
      (76, '1o8JsoEcUiM', 'Function Domain and Range: Illustrations based on finding domain', '72 Function Domain and Range: Illustrations based on finding domain Mohit Tyagi', 831),
      (77, '1PQqQtsZN9s', 'Function Domain and Range of Expression: Illustrations based on finding domain (Part 73)', '73 Function Domain and Range of Expression: Illustrations based on finding domain | Mohit Tyagi', 960),
      (78, 'K_47bNTAKyE', 'Function Domain and Range of Expression: Illustrations based on finding domain (Part 74)', '74 Function Domain and Range of Expression: Illustrations based on finding domain | Mohit Tyagi', 887),
      (79, '9NOefy8V-98', 'Function Domain and Range of Expression: Illustrations based on finding domain (Part 75)', '75 Function Domain and Range of Expression: Illustrations based on finding domain | Mohit Tyagi', 644),
      (80, 'hJX9qTdWM4k', 'Function Domain and Range of Expression: Illustrations based on finding domain (Part 76)', '76 Function Domain and Range of Expression: Illustrations based on finding domain | Mohit Tyagi', 653),
      (81, 'WLhwvYxR5_o', 'Function Domain and Range of Expression: Illustrations based on finding domain (Part 77)', '77 Function Domain and Range of Expression: Illustrations based on finding domain | Mohit Tyagi', 772),
      (82, '6R4TOQwMda8', 'Function Domain and Range of Expression: Illustrations based on finding domain (Part 78)', '78 Function Domain and Range of Expression: Illustrations based on finding domain | Mohit Tyagi', 595),
      (83, 'XWzVjsDTtuk', 'Function Domain and Range of Expression: Range of function, range of some important', '79 Function Domain and Range of Expression: Range of function, range of some important functions', 708),
      (84, 'PHDQJT4jTI8', 'Function Domain and Range: finding the range using elementary manipulations, related', '80 Function Domain and Range: finding the range using elementary manipulations, related theory', 707),
      (85, 'VbbdzlUAQno', 'Function Domain and Range: finding the range using elementary manipulations, (Part 2)', '81 Function Domain and Range: finding the range using elementary manipulations, Part 2', 606),
      (86, 'EOYtd2fYYzs', 'Function Domain and Range of Expression: Finding range using elementary (Part 82)', '82 Function Domain and Range of Expression: Finding range using elementary manipulations', 597),
      (87, 'ranGnlxz0f8', 'Function Domain and Range of Expression: Finding range using elementary (Part 83)', '83 Function Domain and Range of Expression: Finding range using elementary manipulations | JEE Maths', 616),
      (88, 'uYCstlktcBQ', 'Function Domain and Range of Expression: Finding range using elementary (Part 84)', '84 Function Domain and Range of Expression: Finding range using elementary manipulations', 603),
      (89, 'w0VCmqoB1WE', 'Function Domain and Range of Expression: Examples of finding range using elementary', '85 Function Domain and Range of Expression: Examples of finding range using elementary manipulations', 648),
      (90, 'cIRIv74-0vQ', 'Function Domain and Range: Examples of finding range using elementary manipulations method', '86 Function Domain and Range: Examples of finding range using elementary manipulations method', 509),
      (91, '2imvbDWvnTw', 'Function Domain and Range of Expression: Range of composite function', '87 Function Domain and Range of Expression: Range of composite function | Mohit Tyagi', 651),
      (92, 'kFcwSc4rU0g', 'Function Domain and Range of Expression: Examples based on range of composite function', '88 Function  Domain and Range of Expression: Examples based on range of composite function', 655),
      (93, 'pRxMEkzYUpc', 'Function: Illustrations, range in restricted domain, range of ratio of two linear exp', '89 Function: Illustrations, range in restricted domain, range of ratio of two linear exp |', 720),
      (94, 'b69jjKYBWy8', 'Function Domain and Range of Expression: Finding range using elementary (Part 90)', '90 Function Domain and Range of Expression: Finding range using elementary manipulations', 840),
      (95, 'moQiXyvy354', 'Function Domain and Range of Expression: Finding range using substitution', '91 Function Domain and Range of Expression: Finding range using substitution', 959),
      (96, 'ggRaSVraXqk', 'Function Domain and Range of Expression: Illustrations based on finding range using', '92 Function Domain and Range of Expression: Illustrations based on finding range using substitution', 673),
      (97, 'FE7Bzpju9PU', 'Function Domain and Range of Expression: Examples of substitution', '93 Function Domain and Range of Expression: Examples of substitution', 704),
      (98, 'YIa1ZWnJ80U', 'Function Domain and Range of Expression: Finding range of linear/quadratic (Part 94)', '94 Function Domain and Range of Expression: Finding range of linear/quadratic', 812),
      (99, '0EPm7r3xGME', 'Function Domain and Range of Expression: Finding range of linear/quadratic (Part 95)', '95 Function Domain and Range of Expression: Finding range of linear/quadratic | Mohit Tyagi', 411),
      (100, 'SzNttO-qTzE', 'Function Domain and Range of Expression: Finding the range of linear/quadratic (Part 96)', '96 Function Domain and Range of Expression: Finding the range of linear/quadratic', 780),
      (101, 'aDBJowh3ErE', 'Function Domain and Range of Expression: Finding the range of linear/quadratic (Part 97)', '97 Function Domain and Range of Expression: Finding the range of linear/quadratic', 322),
      (102, '6qpxFn8PueY', 'Function Domain and Range of Expression: Range of a.sinX + b.cosX', '98 Function Domain and Range of Expression:  Range of a.sinX + b.cosX', 808),
      (103, '59FvQVi_924', 'Function Domain and Range of Expression: Illustrations based on Range of a.sin(x) + b.', '99 Function Domain and Range of Expression: Illustrations based on Range of a.sin(x) + b. Cos (x)', 886),
      (104, 'EuC7d8o4naY', 'Function Domain and Range of Expression: Finding range using derivatives (Part 100)', '100 Function Domain and Range of Expression: Finding range using derivatives', 571),
      (105, 'Crpjr1O8IeE', 'Function Domain and Range of Expression: Finding range using derivatives (Part 101)', '101 Function Domain and Range of Expression: Finding range using derivatives', 622),
      (106, 'm-mN7v5htZ8', 'Function Domain and Range of Expression: Examples of finding range using (Part 102)', '102 Function Domain and Range of Expression: Examples of finding range using derivatives', 613),
      (107, 'd9KBlRilB_Y', 'Function Domain and Range of Expression: Examples of finding range using (Part 103)', '103 Function Domain and Range of Expression: Examples of finding range using derivatives', 844),
      (108, '2CVhaCDrsEI', 'Function Domain and Range of Expression: Important concept - sum of maximum or minimum', '104 Function Domain and Range of Expression: Important concept - sum of maximum or minimum', 710),
      (109, 'smK8YCh4IEw', 'Function Domain and Range of Expression: Examples sum of maximum or minimum', '105 Function Domain and Range of Expression: Examples sum of maximum or minimum', 963),
      (110, 'qidHQq7FKHM', 'Function Domain and Range of Expression: Finding range using AM-GM inequality', '106 Function Domain and Range of Expression: Finding range using  AM-GM inequality', 610),
      (111, 's7972tK_F2M', 'Function Domain and Range of Expression: Finding range using AM-GM inequality (Part 2)', '107 Function Domain and Range of Expression: Finding range using  AM-GM inequality  Part 2', 666),
      (112, 'wSNurZM9z3w', 'Function Domain and Range of Expression: Finding range using AM-GM inequality (Part 3)', '108 Function Domain and Range of Expression: Finding range using  AM-GM inequality Part 3', 396),
      (113, 'wsQqa4BV1oY', 'Function Domain and Range of Expression: Examples based on Finding range using (Part 109)', '109 Function Domain and Range of Expression: Examples based on Finding range using  AM-GM inequality', 796),
      (114, 'P8khCEaMn0c', 'Function Domain and Range of Expression: Examples based on Finding range using (Part 110)', '110 Function Domain and Range of Expression: Examples based on Finding range using  AM-GM inequality', 628),
      (115, '5b398gq31dA', 'Function: Function Definition, Domain, Codomain, and Range', '111 Function: Function Definition, Domain, Codomain, and Range | Mohit Tyagi', 550),
      (116, 'UxP9k10lHOc', 'Function Definition, Domain, Codomain, Range dependent, independent, variable (Part 112)', '112 Function Definition, Domain, Codomain, Range dependent, independent, variable, image, pre-image', 474),
      (117, 'Bg8r5ofCop8', 'Function Definition, Domain, Codomain, Range dependent, independent, variable (Part 113)', '113 Function Definition, Domain, Codomain, Range dependent, independent, variable, image, pre-image', 671),
      (118, 'pkkI94ampx8', 'Classification of function, into/onto function, surjective function', '114 Classification of function, into/onto function, surjective function | IIT JEE Mains/Advanced', 609),
      (119, '5ehApzUBj-0', 'Classification of Function Examples based on into/onto functions', '115 Classification of Function Examples based on into/onto functions | IIT JEE Mains/Advanced-Maths', 622),
      (120, 'x0IZye1wcME', 'Classification of Function: Examples based on into/onto functions (Part 116)', '116 Classification of Function: Examples based on into/onto functions | IIT JEE Mains/Advanced', 642),
      (121, '1p0QHrQH2FQ', 'Classification of Function: Examples based on into/onto functions (Part 117)', '117 Classification of Function: Examples based on into/onto functions | IIT JEE Mains/Advanced', 612),
      (122, 'CwscCy805vQ', 'Classification of Function: Examples based on into/onto functions (Part 118)', '118 Classification of Function: Examples based on into/onto functions | IIT JEE Mains/Advanced', 599),
      (123, 'sEByZBT8YfY', 'Function Even/Odd Functions & Related Concepts (Part 119)', '119 Function Even/Odd Functions & Related Concepts | IIT JEE Mains/Advanced Mohit Tyagi', 632),
      (124, 'UCVZcBQnu3Q', 'Function Even/Odd Functions & Related Concepts (Part 120)', '120 Function Even/Odd Functions & Related Concepts | IIT JEE Mains/Advanced | Mohit Tyagi', 722),
      (125, 'Xza4iDTRRbM', 'Function: Even/Odd Functions & Related Concepts', '121 Function: Even/Odd Functions & Related Concepts | IIT JEE Mains/Advanced | Mohit Tyagi', 726),
      (126, 'qfE6Y1eGsQE', 'Function Even/Odd Functions & Related Concepts (Part 122)', '122 Function Even/Odd Functions & Related Concepts | IIT JEE Mains/Advanced | Mohit Tyagi', 821),
      (127, '0Pmo9XVi42s', 'Even/Odd Functions: combinations of Even / Odd functions sum, product, composition', '123 Even/Odd Functions: combinations of Even / Odd functions sum, product, composition', 724),
      (128, 'vq4A03k_4EI', 'Function Even/Odd Important points regarding even and Odd function', '124 Function Even/Odd Important points regarding even and Odd function | IIT JEE Maths | Mohit Tyagi', 541),
      (129, '_J_q9pixTTs', 'Function Even and Odd extension', '125 Function Even and Odd extension | IIT JEE Mains/Advanced | Mohit Tyagi', 628),
      (130, 'TweGuQHfWXs', 'Function Points to remember for even/odd function', '126 Function Points to remember for even/odd function | IIT JEE Mains/Advanced | Mohit Tyagi', 530),
      (131, 'zgzxgatG0c8', 'Function: Example for Even/Odd Functions', '127 Function: Example for Even/Odd Functions | IIT JEE Mains/Advanced | Mohit Tyagi', 644),
      (132, 'qlsfIdMGK-8', '(a) Function: Example Even/Odd Functions', '128(a) Function: Example Even/Odd Functions | IIT JEE Mains/Advanced | Mohit Tyagi', 707),
      (133, '1LmAA7dO8Ec', '(b) Function: Example Even/Odd Functions', '128(b) Function: Example Even/Odd Functions | IIT JEE Mains/Advanced | Mohit Tyagi', 961),
      (134, 'ImBOAJJzzYM', 'Function: Introduction to periodic non-periodic function', '129 Function: Introduction to periodic  non-periodic function | IIT JEE Mains/Advanced | Mohit Tyagi', 485),
      (135, 'NOy0PHhO8tE', 'Function: Periodic Function & Related Concepts', '130 Function: Periodic Function & Related Concepts | IIT JEE Mains/Advanced | Mohit Tyagi', 572),
      (136, 'h2nINj63FF0', 'Function Example of Periodic Function', '131 Function Example of Periodic Function | IIT JEE Mains/Advanced | Mohit Tyagi', 620),
      (137, '93rml_UoweI', 'Function: Theory of periodic function', '132 Function: Theory of periodic function | IIT JEE Mains/Advanced | Mohit Tyagi', 528),
      (138, 'dHVYJRrljgE', 'Function: Rules to find the period of functions (Part 133)', '133 Function: Rules to find the period of functions | IIT JEE Mains/Advanced | Mohit Tyagi', 512),
      (139, '9TlnoFEsSQ0', 'Function: Rules to find the period of functions (Part 134)', '134 Function: Rules to find the period of functions | IIT JEE Mains/Advanced | Mohit Tyagi', 521),
      (140, 'APY-A4OUI9k', 'Function: Finding period using the LCM', '135 Function: Finding period using the LCM | IIT JEE Mains/Advanced | Mohit Tyagi', 838),
      (141, 'I3CjPoiZt6Y', 'Function: Rules to find the period of functions (Part 136)', '136 Function: Rules to find the period of functions | IIT JEE Mains/Advanced | Mohit Tyagi', 680),
      (142, 'G0Hd2el7pfw', 'Function: Rules to find the period of functions (Part 137)', '137 Function: Rules to find the period of functions | IIT JEE Mains/Advanced | Mohit Tyagi', 636),
      (143, 'nK3db9k1KkQ', 'Function Rules to find the period of functions', '138 Function Rules to find the period of functions | IIT JEE Mains/Advanced | Mohit Tyagi', 650),
      (144, 'Wm9-rJTRPjc', 'Function: Rules to find the period of functions (Part 139)', '139 Function: Rules to find the period of functions | IIT JEE Mains/Advanced | Mohit Tyagi', 595),
      (145, 'UfgOqmyh0JI', 'Function: Rules to find the period of functions (Part 140)', '140 Function: Rules to find the period of functions | IIT JEE Mains/Advanced | Mohit Tyagi', 555),
      (146, 'gFo5_ax_zvE', 'Function: Example based on finding fundamental period (Part 141)', '141 Function: Example based on finding fundamental period | IIT JEE Mains/Advanced | Mohit Tyagi', 663),
      (147, 'BK8ribpUBuY', 'Function: Example based on finding fundamental period (Part 142)', '142 Function: Example based on finding fundamental period | IIT JEE Mains/Advanced | Mohit Tyagi', 591),
      (148, 'Df5xsuTBn7M', 'Function: Application of period of function in finding range, drawing graphs', '143 Function: Application of period of function in finding range, drawing graphs | IIT JEE Mains/Adv', 617),
      (149, '9c35EWpWubc', 'Function: Drawing graphs of the periodic function', '144 Function: Drawing graphs of the periodic function | IIT JEE Mains/Advanced | Mohit Tyagi', 635),
      (150, 'UeDT_N4WUgw', 'Function: One to one and Many to One Function', '145 Function: One to one and Many to One Function | IIT JEE Mains/Advanced | Mohit Tyagi', 653),
      (151, 'pNNwEktvXmc', 'Function: Examples One-to-one and Many to One Function', '146 Function: Examples One-to-one and Many to One Function | IIT JEE Mains/Advanced | Mohit Tyagi', 659),
      (152, 'MXQxKIC-O2c', 'Function: Methods of identifying one-to-one and many-to-one functions', '147 Function: Methods of identifying one-to-one and many-to-one functions  | IIT JEE Mains/Advanced', 579),
      (153, 'sTeslmpNtDU', 'Function methods of identifying one-to-one and many-to-one functions', '148 Function methods of identifying one-to-one and many-to-one functions | IIT JEE Mains/Advanced', 666),
      (154, '6bdfeZ3-GfA', 'Function: Examples based on identifying one-to-one and many-to-one functions (Part 149)', '149 Function: Examples based on identifying one-to-one and many-to-one functions  | IIT JEE', 697),
      (155, 'aloT4CmySjo', 'Function: Examples based on identifying one-to-one and many-to-one functions (Part 150)', '150 Function: Examples based on identifying one-to-one and many-to-one functions | IIT JEE Mains/Adv', 819),
      (156, 'OG4QiKQiaGs', 'Function: Examples based on identifying one-to-one and many-to-one functions (Part 151)', '151 Function: Examples based on identifying one-to-one and many-to-one functions | IIT JEE Mains/Adv', 582),
      (157, 'yADqhdVii1c', 'Function: Examples based on identifying one-to-one and many-to-one functions (Part 152)', '152 Function: Examples based on identifying one-to-one and many-to-one functions | IIT JEE Mains/Adv', 599),
      (158, 'v718F72BKZM', 'Function: Examples based on identifying one-to-one and many-to-one functions (Part 153)', '153 Function: Examples based on identifying one-to-one and many-to-one functions | IIT JEE Mains/Adv', 483),
      (159, 'TaCMVtZ8Xrs', 'Function: Introduction to a composite function', '154 Function: Introduction to a composite function | IIT JEE Mains/Advanced | Mohit Tyagi', 514),
      (160, 'j2taDOPtX7c', 'Function: Introduction to composite function and Example', '155 Function: Introduction to composite function and Example | IIT JEE Mains/Advanced | Mohit Tyagi', 627),
      (161, 'xjU6A0DVsNk', 'Function Examples based on composite function', '156 Function Examples based on composite function | IIT JEE Mains/Advanced  | Mohit Tyagi', 856),
      (162, 'qvPIfGbtfVQ', 'Function: Example based on composite function (with multiple definitions) (Part 157)', '157 Function: Example based on composite function (with multiple definitions) | IIT JEE Mains/Adv', 645),
      (163, 'eaiVB6e_rTU', 'Function: Example based on composite function (with multiple definitions) (Part 158)', '158 Function: Example based on composite function (with multiple definitions) | IIT JEE Mains/Adv', 774),
      (164, 'kCIezWDe9sE', 'Function: Example based on composite function (with multiple definitions) (Part 159)', '159 Function: Example based on composite function (with multiple definitions) | IIT JEE Mains/Adv', 888),
      (165, '6hI4gGk4tgU', 'Function: Example based on composite function (with multiple definitions) (Part 160)', '160 Function: Example based on composite function (with multiple definitions) | IIT JEE Mains/Adv', 632),
      (166, 'kU_TTNT8sac', 'Function: Introduction to the inverse function', '161 Function: Introduction to the inverse function | IIT JEE Mains/Advanced | Mohit Tyagi', 656),
      (167, 'j9pPOBfJbMA', 'Function: Important points related to inverse function', '162 Function: Important points related to inverse function  | IIT JEE Mains/Advanced | Mohit Tyagi', 718),
      (168, 'Kw_ICVb3HNU', 'Function: how to find the inverse function', '163 Function: how to find the inverse function | IIT JEE Mains/Advanced | Mohit Tyagi', 538),
      (169, 'oCbs_cKoo6w', 'Function: How to find inverse function ( — ) (Part 2)', '164 Function: How to find inverse function (Part 2) | IIT JEE Mains/Advanced | Mohit Tyagi', 718),
      (170, 'KZeTp-d0tkc', 'Function: Illustrations based on finding an inverse function', '165 Function: Illustrations based on finding an inverse function  | IIT JEE Mains/Adv | Mohit Tyagi', 618),
      (171, 'M4fazVIP9ik', 'Function: Illustrations based on finding inverse function ( — ) (Part 2)', '166 Function: Illustrations based on finding inverse function (Part 2) | IIT JEE Mains/Advanced', 922),
      (172, 'UtfYEpHNcYY', 'Function: Theory related to the composition of function its inverse', '167 Function: Theory related to the composition of function its inverse | IIT JEE Mains/Advanced', 618),
      (173, 'cwSThJGCZ3M', 'Function: Theory related to the composition of function and its inverse', '168 Function: Theory related to the composition of function and its inverse | IIT JEE Mains/Advanced', 539),
      (174, '4NYR2789eaU', 'Function: Example composition of function and its inverse', '169 Function: Example composition of function and its inverse | IIT JEE Mains/Advanced | Mohit Tyagi', 899),
      (175, 'yUjbctDSZ8o', 'Function: Intersection of function and inverse function', '170 Function: Intersection of function and inverse function | IIT JEE Mains/Advanced | Mohit Tyagi', 641),
      (176, 'MSluU-WM0Lg', 'Function: Example intersection and Inverse function', '171 Function: Example intersection and Inverse function | IIT JEE Mains/Advanced | Mohit Tyagi', 886),
      (177, 'H4EHIS7aNH4', 'Function: Example of inverse of composite functions', '172 Function: Example of inverse of composite functions | IIT JEE Mains/Advanced | Mohit Tyagi', 652),
      (178, 'ivQhxVhkIEQ', 'Function: Miscellaneous points, Example identical functions (Part 173)', '173 Function: Miscellaneous points, Example identical functions | IIT JEE Mains/Advanced', 625),
      (179, 'k0gidEhXm7A', 'Function: Miscellaneous points, Example identical functions (Part 174)', '174 Function: Miscellaneous points, Example identical functions | IIT JEE Mains/Advanced', 623),
      (180, 'nsF8UNQdjqU', 'Function: Examples identical functions, homogeneous expression', '175 Function: Examples identical functions, homogeneous expression  | IIT JEE Mains/Advanced', 660),
      (181, 'E5aiRM3nQqg', 'Function: Example homogeneous expression, graph of reciprocal function', '176 Function: Example homogeneous expression, graph of reciprocal function | IIT JEE Mains/Advanced', 716),
      (182, 'hvJlUaYkfro', 'Function: Illustrations based on graph of reciprocal functions', '177 Function: Illustrations based on graph of reciprocal functions | IIT JEE Mains/Advanced', 566),
      (183, 'Ic9WJ6dxKrY', 'Function Drawing graph of f(x).sin(x)', '178 Function Drawing graph of f(x).sin(x) | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 926),
      (184, 'YHNaNPokFDM', 'Function: Drawing graph of — x-a — + — x-b — + — x-c', '179 Function: Drawing graph of |x-a|+|x-b|+|x-c| | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 683),
      (185, 'ALlskD3lWv8', 'Function Miscellaneous points: Functional rule', '180 Function Miscellaneous points: Functional rule | IIT JEE Mains/Advanced | Mohit Tyagi Maths', 779),
      (186, 'ojoIO7dJS9A', 'Function Miscellaneous points Example functional rule (Part 181)', '181 Function Miscellaneous points Example functional rule | IIT JEE Mains/Advanced | Mohit Tyagi', 801),
      (187, 'OvLCJ3ZcIYo', 'Function Miscellaneous points Example functional rule (Part 182)', '182 Function Miscellaneous points Example functional rule | IIT JEE Mains/Advanced | Mohit Tyagi', 959)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds)
    order by position
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      3, 276, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id)
    values (v_video_id, v_class_id), (v_video_id, v_dropper_id);
    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);

    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> 187 then
    raise exception 'expected 187 lessons for "%", inserted %', 'Functions', v_inserted;
  end if;

  -- Prove the chapter now really does offer more than one teaching voice.
  if (
    select count(distinct v.channel_id)
    from public.videos v
    where v.chapter_id = 276
  ) < 2 then
    raise exception 'chapter 276 still has fewer than two teaching voices after import';
  end if;
end $$;
