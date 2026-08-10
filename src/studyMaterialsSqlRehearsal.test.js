import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration = readFileSync("src/migrations/study_materials_v1.sql", "utf8");
const curriculumMigration = readFileSync(
  "src/migrations/study_materials_v2_catalog.sql",
  "utf8",
);
const ncertClass10ScienceSeed = readFileSync(
  "docs/sql/study_materials_ncert_class10_science_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass10MathematicsSeed = readFileSync(
  "docs/sql/study_materials_ncert_class10_mathematics_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass10EnglishSeed = readFileSync(
  "docs/sql/study_materials_ncert_class10_english_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass10SocialScienceSeed = readFileSync(
  "docs/sql/study_materials_ncert_class10_social_science_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass10HindiBSeed = readFileSync(
  "docs/sql/study_materials_ncert_class10_hindi_b_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass10HindiASeed = readFileSync(
  "docs/sql/study_materials_ncert_class10_hindi_a_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass11MathematicsSeed = readFileSync(
  "docs/sql/study_materials_ncert_class11_mathematics_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass12MathematicsSeed = readFileSync(
  "docs/sql/study_materials_ncert_class12_mathematics_seed_2026-08-05.sql",
  "utf8",
);
const ncertSeed = readFileSync(
  "docs/sql/study_materials_ncert_kinematics_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass11PhysicsSeed = readFileSync(
  "docs/sql/study_materials_ncert_class11_physics_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass12PhysicsSeed = readFileSync(
  "docs/sql/study_materials_ncert_class12_physics_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass11ChemistrySeed = readFileSync(
  "docs/sql/study_materials_ncert_class11_chemistry_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass12ChemistrySeed = readFileSync(
  "docs/sql/study_materials_ncert_class12_chemistry_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass11BiologySeed = readFileSync(
  "docs/sql/study_materials_ncert_class11_biology_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass12BiologySeed = readFileSync(
  "docs/sql/study_materials_ncert_class12_biology_seed_2026-08-05.sql",
  "utf8",
);
const jeeAdvanced2026PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2026_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2025PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2025_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2024PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2024_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2023PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2023_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2022PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2022_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2021PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2021_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2020PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2020_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2019PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2019_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2018PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2018_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2017PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2017_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2016PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2016_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2015PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2015_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2014PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2014_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2013PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2013_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2012PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2012_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2011PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2011_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2010PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2010_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2009PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2009_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2008PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2008_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeAdvanced2007PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2007_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeMain2016PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_main_2016_papers_seed_2026-08-10.sql",
  "utf8",
);
const jeeMain2017PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_main_2017_papers_seed_2026-08-08.sql",
  "utf8",
);
const jeeMain2022Session1PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_main_2022_session1_papers_seed_2026-08-06.sql",
  "utf8",
);
const jeeMain2022Session2PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_main_2022_session2_papers_seed_2026-08-07.sql",
  "utf8",
);
const jeeMain2023Session2PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_main_2023_session2_papers_seed_2026-08-08.sql",
  "utf8",
);
const jeeMain2025Session2PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_main_2025_session2_papers_seed_2026-08-07.sql",
  "utf8",
);
const jeeMain2024Session1PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_main_2024_session1_papers_seed_2026-08-07.sql",
  "utf8",
);
const jeeMain2024Session2PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_main_2024_session2_papers_seed_2026-08-07.sql",
  "utf8",
);
const jeeMain2026Session2PapersSeed = readFileSync(
  "docs/sql/study_materials_jee_main_2026_session2_papers_seed_2026-08-06.sql",
  "utf8",
);

async function productionShapedDatabase() {
  const pg = new PGlite();
  await pg.exec(`
    create role anon;
    create role authenticated;
    create role service_role;

    create function public.is_admin()
    returns boolean language sql stable as $$ select false $$;

    create table public.learning_goals (
      id bigint primary key, name text not null, slug text not null unique,
      display_order integer not null default 0
    );
    create table public.boards (
      id bigint primary key, name text not null, slug text not null unique,
      display_order integer not null default 0
    );
    create table public.class_levels (
      id bigint primary key, name text not null, slug text not null unique,
      display_order integer not null default 0
    );
    create table public.subjects (
      id bigint primary key, name text not null, slug text not null unique,
      display_order integer not null default 0
    );
    create table public.chapters (
      id bigint generated by default as identity primary key,
      subject_id bigint not null references public.subjects(id),
      name text not null, slug text not null, display_order integer not null default 0,
      unique (subject_id, name), unique (subject_id, slug)
    );
    create table public.videos (
      id bigint primary key, chapter_id bigint references public.chapters(id)
    );

    insert into public.learning_goals values
      (1, 'JEE', 'jee', 1), (2, 'NEET', 'neet', 2),
      (3, 'Olympiad', 'olympiad', 3), (4, 'School Boards', 'school', 4);
    insert into public.boards values (1, 'CBSE', 'cbse', 1);
    insert into public.class_levels values
      (10, 'Class 10', 'class-10', 1),
      (11, 'Class 11', 'class-11', 2),
      (12, 'Class 12', 'class-12', 3);
    insert into public.subjects values
      (1, 'Physics', 'physics', 1), (2, 'Chemistry', 'chemistry', 2),
      (3, 'Biology', 'biology', 3), (4, 'Mathematics', 'mathematics', 4),
      (5, 'English', 'english', 5),
      (6, 'Social Science', 'social-science', 6),
      (7, 'Hindi B', 'hindi-b', 7),
      (8, 'Hindi A', 'hindi-a', 8);
    insert into public.chapters values
      (100, 1, 'Motion in a Straight Line', 'motion-in-a-straight-line', 1),
      (101, 1, 'Kinematics', 'kinematics', 2),
      (28, 1, 'Units and Measurements', 'units-and-measurements', 3),
      (82, 1, 'Laws of Motion', 'laws-of-motion', 4),
      (6, 1, 'Newton''s Laws of Motion (NLM)', 'newtons-laws-of-motion-nlm', 5),
      (7, 1, 'Friction', 'friction', 6),
      (21, 1, 'Work, Energy and Power', 'work-energy-and-power', 7),
      (22, 1, 'System of Particles and Centre of Mass', 'system-of-particles-and-centre-of-mass', 8),
      (27, 1, 'Rotational Motion', 'rotational-motion', 9),
      (81, 1, 'Gravitation', 'gravitation', 10),
      (24, 1, 'Mechanical Properties of Solids', 'mechanical-properties-of-solids', 11),
      (26, 1, 'Mechanical Properties of Fluids', 'mechanical-properties-of-fluids', 12),
      (25, 1, 'Thermal Properties of Matter', 'thermal-properties-of-matter', 13),
      (23, 1, 'Thermodynamics', 'thermodynamics', 14),
      (275, 1, 'Kinetic Theory of Gases', 'kinetic-theory-of-gases', 15),
      (84, 1, 'Oscillations and Waves', 'oscillations-and-waves', 16),
      (300, 1, 'Electrostatics', 'electrostatics', 17),
      (301, 1, 'Capacitance', 'capacitance', 18),
      (302, 1, 'Current Electricity', 'current-electricity', 19),
      (303, 1, 'Moving Charges and Magnetism', 'moving-charges-and-magnetism', 20),
      (304, 1, 'Magnetism and Matter', 'magnetism-and-matter', 21),
      (305, 1, 'Electromagnetic Induction', 'electromagnetic-induction', 22),
      (306, 1, 'Alternating Current', 'alternating-current', 23),
      (307, 1, 'Electromagnetic Waves', 'electromagnetic-waves', 24),
      (308, 1, 'Ray Optics and Optical Instruments', 'ray-optics-and-optical-instruments', 25),
      (309, 1, 'Wave Optics', 'wave-optics', 26),
      (310, 1, 'Dual Nature of Radiation and Matter', 'dual-nature-of-radiation-and-matter', 27),
      (311, 1, 'Atoms', 'atoms', 28),
      (312, 1, 'Modern Physics', 'modern-physics', 29),
      (313, 1, 'Semiconductor Electronics', 'semiconductor-electronics', 30),
      (200, 2, 'Redox Reactions', 'redox-reactions', 1),
      (201, 2, 'Introduction to Chemistry', 'introduction-to-chemistry', 2),
      (202, 2, 'Mole Concept', 'mole-concept', 3),
      (203, 2, 'Atomic Structure', 'atomic-structure', 4),
      (204, 2, 'Periodic Table', 'periodic-table', 5),
      (205, 2, 'Chemical Bonding and Molecular Structure', 'chemical-bonding-and-molecular-structure', 6),
      (206, 2, 'Thermodynamics', 'thermodynamics', 7),
      (207, 2, 'Thermochemistry', 'thermochemistry', 8),
      (208, 2, 'Chemical Equilibrium', 'chemical-equilibrium', 9),
      (209, 2, 'Ionic Equilibrium', 'ionic-equilibrium', 10),
      (210, 2, 'Purification and Characterisation of Organic Compounds', 'purification-and-characterisation-of-organic-compounds', 11),
      (211, 2, 'Some Basic Principles of Organic Chemistry', 'some-basic-principles-of-organic-chemistry', 12),
      (212, 2, 'Structural Isomerism', 'structural-isomerism', 13),
      (213, 2, 'Stereoisomerism', 'stereoisomerism', 14),
      (214, 2, 'Organic Reaction Mechanisms', 'organic-reaction-mechanisms', 15),
      (215, 2, 'Hydrocarbons', 'hydrocarbons', 16),
      (216, 2, 'Solutions', 'solutions', 17),
      (217, 2, 'Electrochemistry', 'electrochemistry', 18),
      (218, 2, 'Chemical Kinetics', 'chemical-kinetics', 19),
      (219, 2, 'The d- and f-Block Elements', 'the-d-and-f-block-elements', 20),
      (220, 2, 'Coordination Compounds', 'coordination-compounds', 21),
      (221, 2, 'Organic Compounds Containing Halogens', 'organic-compounds-containing-halogens', 22),
      (222, 2, 'Organic Compounds Containing Oxygen', 'organic-compounds-containing-oxygen', 23),
      (223, 2, 'Carboxylic Acids and Derivatives', 'carboxylic-acids-and-derivatives', 24),
      (224, 2, 'Organic Compounds Containing Nitrogen', 'organic-compounds-containing-nitrogen', 25),
      (225, 2, 'Amines', 'amines', 26),
      (226, 2, 'Biomolecules', 'biomolecules', 27),
      (400, 3, 'The Living World', 'the-living-world', 1),
      (401, 3, 'Biological Classification', 'biological-classification', 2),
      (402, 3, 'Plant Kingdom', 'plant-kingdom', 3),
      (403, 3, 'Animal Kingdom', 'animal-kingdom', 4),
      (404, 3, 'Morphology of Flowering Plants', 'morphology-of-flowering-plants', 5),
      (405, 3, 'Anatomy of Flowering Plants', 'anatomy-of-flowering-plants', 6),
      (406, 3, 'Structural Organisation in Animals', 'structural-organisation-in-animals', 7),
      (407, 3, 'Cell: The Unit of Life', 'cell-the-unit-of-life', 8),
      (408, 3, 'Biomolecules', 'biomolecules', 9),
      (409, 3, 'Cell Cycle and Cell Division', 'cell-cycle-and-cell-division', 10),
      (410, 3, 'Photosynthesis in Higher Plants', 'photosynthesis-in-higher-plants', 11),
      (411, 3, 'Respiration in Plants', 'respiration-in-plants', 12),
      (412, 3, 'Plant Growth and Development', 'plant-growth-and-development', 13),
      (413, 3, 'Breathing and Exchange of Gases', 'breathing-and-exchange-of-gases', 14),
      (414, 3, 'Body Fluids and Circulation', 'body-fluids-and-circulation', 15),
      (415, 3, 'Excretory Products and Their Elimination', 'excretory-products-and-their-elimination', 16),
      (416, 3, 'Locomotion and Movement', 'locomotion-and-movement', 17),
      (417, 3, 'Neural Control and Coordination', 'neural-control-and-coordination', 18),
      (418, 3, 'Chemical Coordination and Integration', 'chemical-coordination-and-integration', 19),
      (419, 3, 'Sexual Reproduction in Flowering Plants', 'sexual-reproduction-in-flowering-plants', 20),
      (420, 3, 'Human Reproduction', 'human-reproduction', 21),
      (421, 3, 'Reproductive Health', 'reproductive-health', 22),
      (422, 3, 'Principles of Inheritance and Variation', 'principles-of-inheritance-and-variation', 23),
      (423, 3, 'Molecular Basis of Inheritance', 'molecular-basis-of-inheritance', 24),
      (424, 3, 'Evolution', 'evolution', 25),
      (425, 3, 'Human Health and Disease', 'human-health-and-disease', 26),
      (426, 3, 'Microbes in Human Welfare', 'microbes-in-human-welfare', 27),
      (427, 3, 'Biotechnology: Principles and Processes', 'biotechnology-principles-and-processes', 28),
      (428, 3, 'Biotechnology and its Applications', 'biotechnology-and-its-applications', 29),
      (429, 3, 'Organisms and Populations', 'organisms-and-populations', 30),
      (430, 3, 'Ecosystem', 'ecosystem', 31),
      (431, 3, 'Biodiversity and Conservation', 'biodiversity-and-conservation', 32),
      (500, 4, 'Real Numbers', 'real-numbers', 1),
      (501, 4, 'Polynomials', 'polynomials', 2),
      (502, 4, 'Pair of Linear Equations in Two Variables', 'pair-of-linear-equations-in-two-variables', 3),
      (503, 4, 'Quadratic Equations', 'quadratic-equations', 4),
      (504, 4, 'Arithmetic Progressions', 'arithmetic-progressions', 5),
      (505, 4, 'Triangles', 'triangles', 6),
      (506, 4, 'Coordinate Geometry', 'coordinate-geometry', 7),
      (507, 4, 'Introduction to Trigonometry', 'introduction-to-trigonometry', 8),
      (508, 4, 'Some Applications of Trigonometry', 'some-applications-of-trigonometry', 9),
      (509, 4, 'Circles', 'circles', 10),
      (510, 4, 'Areas Related to Circles', 'areas-related-to-circles', 11),
      (511, 4, 'Surface Areas and Volumes', 'surface-areas-and-volumes', 12),
      (512, 4, 'Statistics', 'statistics', 13),
      (513, 4, 'Probability', 'probability', 14),
      (514, 4, 'Relations and Functions', 'relations-and-functions', 15),
      (515, 4, 'Inverse Trigonometric Functions', 'inverse-trigonometric-functions', 16),
      (516, 4, 'Matrices', 'matrices', 17),
      (517, 4, 'Determinants', 'determinants', 18),
      (518, 4, 'Continuity', 'continuity', 19),
      (519, 4, 'Differentiation', 'differentiation', 20),
      (520, 4, 'Limits, Continuity and Differentiability', 'limits-continuity-and-differentiability', 21),
      (521, 4, 'Applications of Derivatives', 'applications-of-derivatives', 22),
      (522, 4, 'Indefinite Integration', 'indefinite-integration', 23),
      (523, 4, 'Definite Integration', 'definite-integration', 24),
      (524, 4, 'Application of Integrals', 'application-of-integrals', 25),
      (525, 4, 'Differential Equations', 'differential-equations', 26),
      (526, 4, 'Vectors and Three Dimensional Geometry', 'vectors-and-three-dimensional-geometry', 27),
      (527, 4, 'Trigonometry', 'trigonometry', 28),
      (528, 4, 'Complex Numbers', 'complex-numbers', 29),
      (529, 4, 'Sequences and Series', 'sequences-and-series', 30),
      (530, 4, 'Permutations and Combinations', 'permutations-and-combinations', 31),
      (531, 4, 'Binomial Theorem', 'binomial-theorem', 32),
      (532, 4, 'Straight Lines', 'straight-lines', 33),
      (533, 4, 'Parabola', 'parabola', 34),
      (534, 4, 'Ellipse', 'ellipse', 35),
      (535, 4, 'Hyperbola', 'hyperbola', 36),
      (600, 5, 'A Letter to God', 'a-letter-to-god', 1),
      (601, 5, 'Nelson Mandela: Long Walk to Freedom', 'nelson-mandela-long-walk-to-freedom', 2),
      (602, 5, 'Two Stories about Flying', 'two-stories-about-flying', 3),
      (603, 5, 'From the Diary of Anne Frank', 'from-the-diary-of-anne-frank', 4),
      (604, 5, 'Glimpses of India', 'glimpses-of-india', 5),
      (605, 5, 'Mijbil the Otter', 'mijbil-the-otter', 6),
      (606, 5, 'Madam Rides the Bus', 'madam-rides-the-bus', 7),
      (607, 5, 'The Sermon at Benares', 'the-sermon-at-benares', 8),
      (608, 5, 'The Proposal', 'the-proposal', 9),
      (609, 5, 'A Triumph of Surgery', 'a-triumph-of-surgery', 10),
      (610, 5, 'The Thief''s Story', 'the-thiefs-story', 11),
      (611, 5, 'The Midnight Visitor', 'the-midnight-visitor', 12),
      (612, 5, 'A Question of Trust', 'a-question-of-trust', 13),
      (613, 5, 'Footprints Without Feet', 'footprints-without-feet', 14),
      (614, 5, 'The Making of a Scientist', 'the-making-of-a-scientist', 15),
      (615, 5, 'The Necklace', 'the-necklace', 16),
      (616, 5, 'Bholi', 'bholi', 17),
      (617, 5, 'The Book That Saved the Earth', 'the-book-that-saved-the-earth', 18),
      (700, 6, 'The Rise of Nationalism in Europe', 'the-rise-of-nationalism-in-europe', 1),
      (701, 6, 'Nationalism in India', 'nationalism-in-india', 2),
      (702, 6, 'The Making of a Global World', 'the-making-of-a-global-world', 3),
      (703, 6, 'The Age of Industrialisation', 'the-age-of-industrialisation', 4),
      (704, 6, 'Print Culture and the Modern World', 'print-culture-and-the-modern-world', 5),
      (705, 6, 'Resources and Development', 'resources-and-development', 6),
      (706, 6, 'Forest and Wildlife Resources', 'forest-and-wildlife-resources', 7),
      (707, 6, 'Water Resources', 'water-resources', 8),
      (708, 6, 'Agriculture', 'agriculture', 9),
      (709, 6, 'Minerals and Energy Resources', 'minerals-and-energy-resources', 10),
      (710, 6, 'Manufacturing Industries', 'manufacturing-industries', 11),
      (711, 6, 'Lifelines of National Economy', 'lifelines-of-national-economy', 12),
      (712, 6, 'Power Sharing', 'power-sharing', 13),
      (713, 6, 'Federalism', 'federalism', 14),
      (714, 6, 'Gender, Religion and Caste', 'gender-religion-and-caste', 15),
      (715, 6, 'Political Parties', 'political-parties', 16),
      (716, 6, 'Outcomes of Democracy', 'outcomes-of-democracy', 17),
      (717, 6, 'Development', 'development', 18),
      (718, 6, 'Sectors of the Indian Economy', 'sectors-of-the-indian-economy', 19),
      (719, 6, 'Money and Credit', 'money-and-credit', 20),
      (720, 6, 'Globalisation and the Indian Economy', 'globalisation-and-the-indian-economy', 21),
      (721, 6, 'Consumer Rights', 'consumer-rights', 22),
      (800, 7, 'कबीर की साखी', 'kabir-ki-sakhi', 1),
      (801, 7, 'मीरा के पद', 'meera-ke-pad', 2),
      (802, 7, 'मनुष्यता', 'manushyata', 3),
      (803, 7, 'पर्वत प्रदेश में पावस', 'parvat-pradesh-mein-pavas', 4),
      (804, 7, 'तोप', 'top', 5),
      (805, 7, 'कर चले हम फ़िदा', 'kar-chale-hum-fida', 6),
      (806, 7, 'आत्मत्राण', 'aatmatran', 7),
      (807, 7, 'बड़े भाई साहब', 'bade-bhai-sahab', 8),
      (808, 7, 'डायरी का एक पन्ना', 'diary-ka-ek-panna', 9),
      (809, 7, 'तताँरा वामीरो कथा', 'tatara-vamiro-katha', 10),
      (810, 7, 'तीसरी कसम के शिल्पकार शैलेंद्र', 'teesri-kasam-ke-shilpkar-shailendra', 11),
      (811, 7, 'अब कहाँ दूसरों के दुख से दुखी होने वाले', 'ab-kahan-doosron-ke-dukh-se-dukhi-hone-wale', 12),
      (812, 7, 'पतझर में टूटी पत्तियाँ', 'patjhar-mein-tooti-pattiyan', 13),
      (813, 7, 'कारतूस', 'kartus', 14),
      (814, 7, 'हरिहर काका', 'harihar-kaka', 15),
      (815, 7, 'सपनों के से दिन', 'sapnon-ke-se-din', 16),
      (816, 7, 'टोपी शुक्ला', 'topi-shukla', 17),
      (900, 8, 'सूरदास के पद', 'surdas-ke-pad', 1),
      (901, 8, 'राम-लक्ष्मण-परशुराम संवाद', 'ram-lakshman-parshuram-samvad', 2),
      (902, 8, 'आत्मकथ्य', 'aatmakathya', 3),
      (903, 8, 'उत्साह', 'utsah', 4),
      (904, 8, 'अट नहीं रही है', 'at-nahin-rahi-hai', 5),
      (905, 8, 'यह दंतुरित मुसकान', 'yah-danturit-muskan', 6),
      (906, 8, 'फसल', 'fasal', 7),
      (907, 8, 'संगतकार', 'sangatkar', 8),
      (908, 8, 'नेताजी का चश्मा', 'netaji-ka-chashma', 9),
      (909, 8, 'बालगोबिन भगत', 'balgobin-bhagat', 10),
      (910, 8, 'लखनवी अंदाज़', 'lakhnavi-andaz', 11),
      (911, 8, 'एक कहानी यह भी', 'ek-kahani-yah-bhi', 12),
      (912, 8, 'नौबतखाने में इबादत', 'naubatkhane-mein-ibadat', 13),
      (913, 8, 'संस्कृति', 'sanskriti', 14),
      (914, 8, 'माता का आँचल', 'mata-ka-aanchal', 15),
      (915, 8, 'साना-साना हाथ जोड़ि', 'sana-sana-hath-jodi', 16),
      (916, 8, 'मैं क्यों लिखता हूँ', 'main-kyon-likhta-hoon', 17);
    select setval(
      pg_get_serial_sequence('public.chapters', 'id'),
      (select max(id) from public.chapters),
      true
    );
    insert into public.videos values (1000, 100);

    grant select on public.learning_goals, public.boards,
      public.class_levels, public.subjects, public.chapters
      to anon, authenticated;
  `);
  await pg.exec(migration);
  return pg;
}

describe("study materials v1 local SQL rehearsal", () => {
  it("loads current NCERT Class 11 Mathematics across JEE and CBSE lecture taxonomy", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass11MathematicsSeed);
      await pg.exec(ncertClass11MathematicsSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 14, scopes: 38 });

      for (const [goal, board] of [["jee", null], ["school", "cbse"]]) {
        const directory = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => '${goal}',
            p_board_slug => ${board ? `'${board}'` : "null"},
            p_class_slug => 'class-11',
            p_subject_slug => 'mathematics'
          )
        `);
        expect(directory.rows).toHaveLength(14);
        expect(Number(directory.rows[0].total_count)).toBe(14);
      }

      for (const chapter of [
        "sets",
        "trigonometry",
        "complex-numbers",
        "quadratic-equations",
        "linear-inequalities",
        "circles",
        "parabola",
        "ellipse",
        "hyperbola",
        "limits-continuity-and-differentiability",
        "differentiation",
      ]) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'jee',
            p_class_slug => 'class-11',
            p_subject_slug => 'mathematics',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(1);
      }

      const neet = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_class_slug => 'class-11',
          p_subject_slug => 'mathematics'
        )
      `);
      expect(neet.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads current NCERT Class 12 Mathematics across JEE and CBSE lecture taxonomy", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass12MathematicsSeed);
      await pg.exec(ncertClass12MathematicsSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 13, scopes: 32 });

      for (const [goal, board] of [["jee", null], ["school", "cbse"]]) {
        const directory = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => '${goal}',
            p_board_slug => ${board ? `'${board}'` : "null"},
            p_class_slug => 'class-12',
            p_subject_slug => 'mathematics'
          )
        `);
        expect(directory.rows).toHaveLength(13);
        expect(Number(directory.rows[0].total_count)).toBe(13);
      }

      for (const [chapter, expected] of [
        ["limits-continuity-and-differentiability", 1],
        ["continuity", 1],
        ["differentiation", 1],
        ["indefinite-integration", 1],
        ["definite-integration", 1],
        ["vectors-and-three-dimensional-geometry", 2],
        ["linear-programming", 1],
      ]) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'jee',
            p_class_slug => 'class-12',
            p_subject_slug => 'mathematics',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(expected);
      }

      const neet = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_class_slug => 'class-12',
          p_subject_slug => 'mathematics'
        )
      `);
      expect(neet.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads current NCERT Class 10 Mathematics beside the existing CBSE lecture taxonomy", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass10MathematicsSeed);
      await pg.exec(ncertClass10MathematicsSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 14, scopes: 14 });

      const directory = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-10',
          p_subject_slug => 'mathematics'
        )
      `);
      expect(directory.rows).toHaveLength(14);
      expect(Number(directory.rows[0].total_count)).toBe(14);

      for (const chapter of [
        'real-numbers',
        'quadratic-equations',
        'introduction-to-trigonometry',
        'surface-areas-and-volumes',
        'probability',
      ]) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'school',
            p_board_slug => 'cbse',
            p_class_slug => 'class-10',
            p_subject_slug => 'mathematics',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(1);
      }

      const entrance = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-10',
          p_subject_slug => 'mathematics'
        )
      `);
      expect(entrance.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both rationalised NCERT Class 10 English readers into exact CBSE chapter scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass10EnglishSeed);
      await pg.exec(ncertClass10EnglishSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 18, scopes: 18 });

      const directory = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-10',
          p_subject_slug => 'english'
        )
      `);
      expect(directory.rows).toHaveLength(18);
      expect(Number(directory.rows[0].total_count)).toBe(18);

      for (const [chapter, source] of [
        ['a-letter-to-god', 'jeff101.pdf'],
        ['the-proposal', 'jeff109.pdf'],
        ['a-triumph-of-surgery', 'jefp101.pdf'],
        ['the-making-of-a-scientist', 'jefp106.pdf'],
        ['the-book-that-saved-the-earth', 'jefp109.pdf'],
      ]) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'school',
            p_board_slug => 'cbse',
            p_class_slug => 'class-10',
            p_subject_slug => 'english',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].source_url).toContain(source);
      }

      const entrance = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-10',
          p_subject_slug => 'english'
        )
      `);
      expect(entrance.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads all four rationalised NCERT Class 10 Social Science books into exact CBSE chapter scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass10SocialScienceSeed);
      await pg.exec(ncertClass10SocialScienceSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 22, scopes: 22 });

      const directory = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-10',
          p_subject_slug => 'social-science'
        )
      `);
      expect(directory.rows).toHaveLength(22);
      expect(Number(directory.rows[0].total_count)).toBe(22);

      for (const [chapter, source] of [
        ['the-rise-of-nationalism-in-europe', 'jess301.pdf'],
        ['resources-and-development', 'jess101.pdf'],
        ['power-sharing', 'jess401.pdf'],
        ['development', 'jess201.pdf'],
        ['consumer-rights', 'jess205.pdf'],
      ]) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'school',
            p_board_slug => 'cbse',
            p_class_slug => 'class-10',
            p_subject_slug => 'social-science',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].source_url).toContain(source);
      }

      const entrance = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-10',
          p_subject_slug => 'social-science'
        )
      `);
      expect(entrance.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads rationalised NCERT Class 10 Hindi B into exact CBSE chapter scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass10HindiBSeed);
      await pg.exec(ncertClass10HindiBSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 17, scopes: 17 });

      const directory = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-10',
          p_subject_slug => 'hindi-b'
        )
      `);
      expect(directory.rows).toHaveLength(17);
      expect(Number(directory.rows[0].total_count)).toBe(17);

      for (const [chapter, source] of [
        ['kabir-ki-sakhi', 'jhsp101.pdf'],
        ['teesri-kasam-ke-shilpkar-shailendra', 'jhsp111.pdf'],
        ['kartus', 'jhsp114.pdf'],
        ['harihar-kaka', 'jhsy101.pdf'],
        ['topi-shukla', 'jhsy103.pdf'],
      ]) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'school',
            p_board_slug => 'cbse',
            p_class_slug => 'class-10',
            p_subject_slug => 'hindi-b',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].source_url).toContain(source);
      }

      const entrance = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-10',
          p_subject_slug => 'hindi-b'
        )
      `);
      expect(entrance.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads rationalised NCERT Class 10 Hindi A with shared poem scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass10HindiASeed);
      await pg.exec(ncertClass10HindiASeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 15, scopes: 17 });

      const directory = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-10',
          p_subject_slug => 'hindi-a'
        )
      `);
      expect(directory.rows).toHaveLength(15);
      expect(Number(directory.rows[0].total_count)).toBe(15);

      for (const [chapter, source] of [
        ['surdas-ke-pad', 'jhks101.pdf'],
        ['utsah', 'jhks104.pdf'],
        ['at-nahin-rahi-hai', 'jhks104.pdf'],
        ['yah-danturit-muskan', 'jhks105.pdf'],
        ['fasal', 'jhks105.pdf'],
        ['sanskriti', 'jhks112.pdf'],
        ['mata-ka-aanchal', 'jhkr101.pdf'],
        ['main-kyon-likhta-hoon', 'jhkr103.pdf'],
      ]) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'school',
            p_board_slug => 'cbse',
            p_class_slug => 'class-10',
            p_subject_slug => 'hindi-a',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].source_url).toContain(source);
      }

      const entrance = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-10',
          p_subject_slug => 'hindi-a'
        )
      `);
      expect(entrance.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads current NCERT Class 10 Science into exact CBSE subject and chapter scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass10ScienceSeed);
      await pg.exec(ncertClass10ScienceSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 13, scopes: 13 });

      for (const [subject, expected] of [
        ['chemistry', 4], ['biology', 5], ['physics', 4],
      ]) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'school',
            p_board_slug => 'cbse',
            p_class_slug => 'class-10',
            p_subject_slug => '${subject}'
          )
        `);
        expect(result.rows).toHaveLength(expected);
        expect(Number(result.rows[0].total_count)).toBe(expected);
      }

      for (const [subject, chapter] of [
        ['chemistry', 'chemical-reactions-and-equations'],
        ['biology', 'life-processes'],
        ['biology', 'our-environment'],
        ['physics', 'light-reflection-and-refraction'],
        ['physics', 'magnetic-effects-of-electric-current'],
      ]) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'school',
            p_board_slug => 'cbse',
            p_class_slug => 'class-10',
            p_subject_slug => '${subject}',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(1);
      }

      const entrance = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-10'
        )
      `);
      expect(entrance.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads the rationalised NCERT Class 12 Biology set for NEET and CBSE", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass12BiologySeed);
      await pg.exec(ncertClass12BiologySeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 13, scopes: 26 });

      const class12 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-12',
          p_subject_slug => 'biology'
        )
      `);
      expect(class12.rows).toHaveLength(13);
      expect(Number(class12.rows[0].total_count)).toBe(13);

      for (const chapter of [
        'sexual-reproduction-in-flowering-plants',
        'molecular-basis-of-inheritance',
        'biotechnology-principles-and-processes',
        'biodiversity-and-conservation',
      ]) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'neet',
            p_class_slug => 'class-12',
            p_subject_slug => 'biology',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(1);
      }

      const jee = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-12',
          p_subject_slug => 'biology'
        )
      `);
      expect(jee.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads the rationalised NCERT Class 11 Biology set for NEET and CBSE", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass11BiologySeed);
      await pg.exec(ncertClass11BiologySeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 19, scopes: 38 });

      const class11 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-11',
          p_subject_slug => 'biology'
        )
      `);
      expect(class11.rows).toHaveLength(19);
      expect(Number(class11.rows[0].total_count)).toBe(19);

      for (const chapter of [
        'the-living-world',
        'cell-the-unit-of-life',
        'photosynthesis-in-higher-plants',
        'chemical-coordination-and-integration',
      ]) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'neet',
            p_class_slug => 'class-11',
            p_subject_slug => 'biology',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(1);
      }

      const jee = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-11',
          p_subject_slug => 'biology'
        )
      `);
      expect(jee.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads the rationalised NCERT Class 12 Chemistry set across all curricula", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass12ChemistrySeed);
      await pg.exec(ncertClass12ChemistrySeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 10, scopes: 36 });

      const class12 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-12',
          p_subject_slug => 'chemistry'
        )
      `);
      expect(class12.rows).toHaveLength(10);
      expect(Number(class12.rows[0].total_count)).toBe(10);

      for (const [chapter, expected] of [
        ['organic-compounds-containing-oxygen', 2],
        ['carboxylic-acids-and-derivatives', 1],
        ['amines', 1],
      ]) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'jee',
            p_class_slug => 'class-12',
            p_subject_slug => 'chemistry',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(expected);
      }

      const class11 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_class_slug => 'class-11',
          p_subject_slug => 'chemistry'
        )
      `);
      expect(class11.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads the rationalised NCERT Class 11 Chemistry set across all curricula", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass11ChemistrySeed);
      await pg.exec(ncertClass11ChemistrySeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 9, scopes: 48 });

      const class11 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-11',
          p_subject_slug => 'chemistry'
        )
      `);
      expect(class11.rows).toHaveLength(9);
      expect(Number(class11.rows[0].total_count)).toBe(9);

      for (const chapter of ['thermochemistry', 'ionic-equilibrium', 'organic-reaction-mechanisms']) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'jee',
            p_class_slug => 'class-11',
            p_subject_slug => 'chemistry',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(1);
      }

      const class12 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_class_slug => 'class-12',
          p_subject_slug => 'chemistry'
        )
      `);
      expect(class12.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both complete NCERT Physics classes without cross-class leakage", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass11PhysicsSeed);
      await pg.exec(ncertClass12PhysicsSeed);
      await pg.exec(ncertClass12PhysicsSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 28, scopes: 105 });

      const class12 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-12',
          p_subject_slug => 'physics'
        )
      `);
      expect(class12.rows).toHaveLength(14);
      expect(Number(class12.rows[0].total_count)).toBe(14);

      const electrostatics = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-12',
          p_subject_slug => 'physics',
          p_chapter_slug => 'electrostatics'
        )
      `);
      expect(electrostatics.rows).toHaveLength(2);

      const modernPhysics = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_class_slug => 'class-12',
          p_subject_slug => 'physics',
          p_chapter_slug => 'modern-physics'
        )
      `);
      expect(modernPhysics.rows).toHaveLength(4);

      const class11 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-11',
          p_subject_slug => 'physics'
        )
      `);
      expect(class11.rows).toHaveLength(14);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads the complete NCERT Class 11 Physics set once across all three curricula", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass11PhysicsSeed);
      await pg.exec(ncertClass11PhysicsSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 14, scopes: 51 });

      const sources = await pg.query(`
        select source_url, page_count
          from public.study_materials
         order by source_url
      `);
      expect(sources.rows).toHaveLength(14);
      expect(sources.rows[0]).toEqual({
        source_url: "https://ncert.nic.in/textbook/pdf/keph101.pdf",
        page_count: 12,
      });
      expect(sources.rows.at(-1)).toEqual({
        source_url: "https://ncert.nic.in/textbook/pdf/keph207.pdf",
        page_count: 22,
      });

      const jee = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-11',
          p_subject_slug => 'physics'
        )
      `);
      expect(jee.rows).toHaveLength(14);
      expect(Number(jee.rows[0].total_count)).toBe(14);

      const kinematics = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-11',
          p_subject_slug => 'physics',
          p_chapter_slug => 'kinematics'
        )
      `);
      expect(kinematics.rows).toHaveLength(2);

      const oscillations = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_class_slug => 'class-11',
          p_subject_slug => 'physics',
          p_chapter_slug => 'oscillations-and-waves'
        )
      `);
      expect(oscillations.rows).toHaveLength(2);
    } finally {
      await pg.close();
    }
  });

  it("exposes CBSE material taxonomy even when no matching course exists", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertSeed);
      await pg.exec(curriculumMigration);
      await pg.exec("set role anon");

      const curriculum = await pg.query(`
        select level, slug, name, resource_count::integer
          from public.get_study_material_curriculum(
            p_goal_slug => 'school',
            p_board_slug => 'cbse',
            p_class_slug => 'class-11',
            p_subject_slug => 'physics'
          )
      `);
      expect(curriculum.rows).toEqual(expect.arrayContaining([
        { level: "goal", slug: "school", name: "School Boards", resource_count: 1 },
        { level: "board", slug: "cbse", name: "CBSE", resource_count: 1 },
        { level: "class", slug: "class-11", name: "Class 11", resource_count: 1 },
        { level: "subject", slug: "physics", name: "Physics", resource_count: 1 },
        { level: "chapter", slug: "kinematics", name: "Kinematics", resource_count: 1 },
      ]));

      await pg.exec("reset role");
    } finally {
      await pg.close();
    }
  });

  it("publishes the reviewed NCERT chapter once across JEE, NEET and CBSE scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertSeed);
      await pg.exec(ncertSeed);

      const material = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-11',
          p_subject_slug => 'physics',
          p_chapter_slug => 'kinematics'
        )
      `);
      expect(material.rows).toHaveLength(1);
      expect(material.rows[0]).toMatchObject({
        title: "Motion in a Straight Line — NCERT Physics",
        material_type: "full_notes",
        source_name: "NCERT",
        source_url: "https://ncert.nic.in/textbook/pdf/keph102.pdf",
        page_count: 14,
      });
      expect(material.rows[0].scopes).toHaveLength(3);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 1, scopes: 3 });
    } finally {
      await pg.close();
    }
  });

  it("executes and returns one shared approved resource in directory and lecture scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      const approved = await pg.query(`
        insert into public.study_materials (
          title, material_type, source_name, source_url, file_format,
          rights_status, review_status, published_at
        ) values (
          'Straight-line motion formula sheet', 'formula_sheet', 'Official source',
          'https://example.edu/motion-formulas.pdf', 'pdf',
          'official_source', 'approved', now()
        ) returning id
      `);
      const materialId = approved.rows[0].id;
      await pg.exec(`
        insert into public.study_material_scopes (
          material_id, learning_goal_id, class_level_id, subject_id, chapter_id
        ) values
          (${materialId}, 1, 11, 1, 100),
          (${materialId}, 2, 11, 1, 100);
        insert into public.study_material_videos (material_id, video_id)
        values (${materialId}, 1000);

        insert into public.study_materials (
          title, material_type, source_name, source_url, rights_status
        ) values (
          'Unreviewed notes', 'short_notes', 'Unknown',
          'https://example.edu/unreviewed', 'creator_permission'
        );
      `);

      const directory = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-11',
          p_subject_slug => 'physics',
          p_chapter_slug => 'motion-in-a-straight-line'
        )
      `);
      expect(directory.rows).toHaveLength(1);
      expect(directory.rows[0]).toMatchObject({
        title: "Straight-line motion formula sheet",
        material_type: "formula_sheet",
        total_count: 1,
      });
      expect(directory.rows[0].scopes).toHaveLength(2);

      const lecture = await pg.query(`
        select * from public.get_study_materials(
          p_chapter_id => 100,
          p_video_id => 1000
        )
      `);
      expect(lecture.rows).toHaveLength(1);
      expect(lecture.rows[0].id).toBe(materialId);

      await pg.exec("set role anon");
      const publicRows = await pg.query("select title from public.study_materials order by title");
      expect(publicRows.rows.map((row) => row.title)).toEqual([
        "Straight-line motion formula sheet",
      ]);
      await pg.exec("reset role");
    } finally {
      await pg.close();
    }
  });

  it("rejects mismatched chapter subjects and non-School board scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      const inserted = await pg.query(`
        insert into public.study_materials (
          title, material_type, source_name, source_url,
          rights_status, review_status, published_at
        ) values (
          'Reviewed notes', 'full_notes', 'Creator',
          'https://example.edu/reviewed-notes',
          'creator_permission', 'approved', now()
        ) returning id
      `);
      const materialId = inserted.rows[0].id;

      await expect(pg.exec(`
        insert into public.study_material_scopes (
          material_id, learning_goal_id, class_level_id, subject_id, chapter_id
        ) values (${materialId}, 1, 11, 2, 100)
      `)).rejects.toThrow(/chapter and subject do not match/i);

      await expect(pg.exec(`
        insert into public.study_material_scopes (
          material_id, learning_goal_id, board_id, class_level_id
        ) values (${materialId}, 1, 1, 11)
      `)).rejects.toThrow(/must use the School learning goal/i);
    } finally {
      await pg.close();
    }
  });

  it("loads all four JEE Advanced 2026 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2026PapersSeed);
      await pg.exec(jeeAdvanced2026PapersSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 4, scopes: 4 });

      const jee = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(jee.rows).toHaveLength(4);
      expect(Number(jee.rows[0].total_count)).toBe(4);
      expect(new Set(jee.rows.map((row) => row.language))).toEqual(new Set(["English", "Hindi"]));
      expect(jee.rows.every((row) => row.exam_year === 2026)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(neet.rows).toHaveLength(0);

      const classSpecific = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-12',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads all four JEE Advanced 2025 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2025PapersSeed);
      await pg.exec(jeeAdvanced2025PapersSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 4, scopes: 4 });

      const jee = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(jee.rows).toHaveLength(4);
      expect(Number(jee.rows[0].total_count)).toBe(4);
      expect(new Set(jee.rows.map((row) => row.language))).toEqual(new Set(["English", "Hindi"]));
      expect(jee.rows.every((row) => row.exam_year === 2025)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(neet.rows).toHaveLength(0);

      const classSpecific = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-12',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads all four JEE Advanced 2024 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2024PapersSeed);
      await pg.exec(jeeAdvanced2024PapersSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 4, scopes: 4 });

      const jee = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(jee.rows).toHaveLength(4);
      expect(Number(jee.rows[0].total_count)).toBe(4);
      expect(new Set(jee.rows.map((row) => row.language))).toEqual(new Set(["English", "Hindi"]));
      expect(jee.rows.every((row) => row.exam_year === 2024)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(neet.rows).toHaveLength(0);

      const classSpecific = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-12',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads all four JEE Advanced 2023 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2023PapersSeed);
      await pg.exec(jeeAdvanced2023PapersSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 4, scopes: 4 });

      const jee = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(jee.rows).toHaveLength(4);
      expect(Number(jee.rows[0].total_count)).toBe(4);
      expect(new Set(jee.rows.map((row) => row.language))).toEqual(new Set(["English", "Hindi"]));
      expect(jee.rows.every((row) => row.exam_year === 2023)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(neet.rows).toHaveLength(0);

      const classSpecific = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-12',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads all four JEE Advanced 2022 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2022PapersSeed);
      await pg.exec(jeeAdvanced2022PapersSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 4, scopes: 4 });

      const jee = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(jee.rows).toHaveLength(4);
      expect(Number(jee.rows[0].total_count)).toBe(4);
      expect(new Set(jee.rows.map((row) => row.language))).toEqual(new Set(["English", "Hindi"]));
      expect(jee.rows.every((row) => row.exam_year === 2022)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(neet.rows).toHaveLength(0);

      const classSpecific = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-12',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads all four JEE Advanced 2021 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2021PapersSeed);
      await pg.exec(jeeAdvanced2021PapersSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 4, scopes: 4 });

      const jee = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(jee.rows).toHaveLength(4);
      expect(Number(jee.rows[0].total_count)).toBe(4);
      expect(new Set(jee.rows.map((row) => row.language))).toEqual(new Set(["English", "Hindi"]));
      expect(jee.rows.every((row) => row.exam_year === 2021)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(neet.rows).toHaveLength(0);

      const classSpecific = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-12',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads all four JEE Advanced 2020 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2020PapersSeed);
      await pg.exec(jeeAdvanced2020PapersSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 4, scopes: 4 });

      const jee = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(jee.rows).toHaveLength(4);
      expect(Number(jee.rows[0].total_count)).toBe(4);
      expect(new Set(jee.rows.map((row) => row.language))).toEqual(new Set(["English", "Hindi"]));
      expect(jee.rows.every((row) => row.exam_year === 2020)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(neet.rows).toHaveLength(0);

      const classSpecific = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-12',
          p_material_type => 'previous_year_paper'
        )
      `);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads all four JEE Advanced 2019 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2019PapersSeed);
      await pg.exec(jeeAdvanced2019PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 4, scopes: 4 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(4);
      expect(Number(jee.rows[0].total_count)).toBe(4);
      expect(new Set(jee.rows.map((row) => row.language))).toEqual(new Set(["English", "Hindi"]));
      expect(jee.rows.every((row) => row.exam_year === 2019)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both JEE Advanced 2018 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2018PapersSeed);
      await pg.exec(jeeAdvanced2018PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 2, scopes: 2 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(2);
      expect(Number(jee.rows[0].total_count)).toBe(2);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2018)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both JEE Advanced 2017 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2017PapersSeed);
      await pg.exec(jeeAdvanced2017PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 2, scopes: 2 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(2);
      expect(Number(jee.rows[0].total_count)).toBe(2);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2017)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both JEE Advanced 2016 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2016PapersSeed);
      await pg.exec(jeeAdvanced2016PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 2, scopes: 2 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(2);
      expect(Number(jee.rows[0].total_count)).toBe(2);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2016)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both JEE Advanced 2015 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2015PapersSeed);
      await pg.exec(jeeAdvanced2015PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 2, scopes: 2 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(2);
      expect(Number(jee.rows[0].total_count)).toBe(2);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2015)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both JEE Advanced 2014 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2014PapersSeed);
      await pg.exec(jeeAdvanced2014PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 2, scopes: 2 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(2);
      expect(Number(jee.rows[0].total_count)).toBe(2);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2014)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both JEE Advanced 2013 bilingual papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2013PapersSeed);
      await pg.exec(jeeAdvanced2013PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 2, scopes: 2 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(2);
      expect(Number(jee.rows[0].total_count)).toBe(2);
      expect(jee.rows.every((row) => row.language === "Hinglish")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2013)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both IIT-JEE 2012 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2012PapersSeed);
      await pg.exec(jeeAdvanced2012PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 2, scopes: 2 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(2);
      expect(Number(jee.rows[0].total_count)).toBe(2);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2012)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both IIT-JEE 2011 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2011PapersSeed);
      await pg.exec(jeeAdvanced2011PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 2, scopes: 2 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(2);
      expect(Number(jee.rows[0].total_count)).toBe(2);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2011)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both IIT-JEE 2010 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2010PapersSeed);
      await pg.exec(jeeAdvanced2010PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 2, scopes: 2 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(2);
      expect(Number(jee.rows[0].total_count)).toBe(2);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2010)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both IIT-JEE 2009 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2009PapersSeed);
      await pg.exec(jeeAdvanced2009PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 2, scopes: 2 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(2);
      expect(Number(jee.rows[0].total_count)).toBe(2);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2009)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both IIT-JEE 2008 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2008PapersSeed);
      await pg.exec(jeeAdvanced2008PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 2, scopes: 2 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(2);
      expect(Number(jee.rows[0].total_count)).toBe(2);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2008)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both IIT-JEE 2007 papers into one JEE-only exam scope each", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeAdvanced2007PapersSeed);
      await pg.exec(jeeAdvanced2007PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 2, scopes: 2 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(2);
      expect(Number(jee.rows[0].total_count)).toBe(2);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2007)).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads all six official JEE Main 2016 papers into JEE-only exam scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeMain2016PapersSeed);
      await pg.exec(jeeMain2016PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 6, scopes: 6 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(6);
      expect(Number(jee.rows[0].total_count)).toBe(6);
      expect(jee.rows.every((row) => row.language === "Hinglish")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2016)).toBe(true);
      expect(jee.rows.every((row) => row.source_name === "Central Board of Secondary Education (JEE Main)")).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads all ten official JEE Main 2017 papers into JEE-only exam scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeMain2017PapersSeed);
      await pg.exec(jeeMain2017PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 10, scopes: 10 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(10);
      expect(Number(jee.rows[0].total_count)).toBe(10);
      expect(jee.rows.every((row) => row.language === "Hinglish")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2017)).toBe(true);
      expect(jee.rows.every((row) => row.source_name === "Central Board of Secondary Education (JEE Main)")).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads all twelve official JEE Main 2022 Session 1 papers into JEE-only exam scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeMain2022Session1PapersSeed);
      await pg.exec(jeeMain2022Session1PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 12, scopes: 12 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(12);
      expect(Number(jee.rows[0].total_count)).toBe(12);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2022)).toBe(true);
      expect(jee.rows.every((row) => row.source_name === "National Testing Agency (JEE Main)")).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads nine verified official JEE Main 2022 Session 2 papers into JEE-only exam scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeMain2022Session2PapersSeed);
      await pg.exec(jeeMain2022Session2PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 9, scopes: 9 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(9);
      expect(Number(jee.rows[0].total_count)).toBe(9);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2022)).toBe(true);
      expect(jee.rows.every((row) => row.source_name === "National Testing Agency (JEE Main)")).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads twelve verified official JEE Main 2023 Session 2 papers into JEE-only exam scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeMain2023Session2PapersSeed);
      await pg.exec(jeeMain2023Session2PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 12, scopes: 12 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(12);
      expect(Number(jee.rows[0].total_count)).toBe(12);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.title.includes("English & Hindi"))).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2023)).toBe(true);
      expect(jee.rows.map((row) => row.page_count).sort((a, b) => a - b)).toEqual([
        103, 105, 106, 107, 107, 108, 110, 110, 113, 114, 115, 115,
      ]);
      expect(jee.rows.every((row) => row.source_name === "National Testing Agency (JEE Main)")).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads eight verified official JEE Main 2025 Session 2 papers into JEE-only exam scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeMain2025Session2PapersSeed);
      await pg.exec(jeeMain2025Session2PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 8, scopes: 8 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(8);
      expect(Number(jee.rows[0].total_count)).toBe(8);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.title.includes("English & Hindi"))).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2025)).toBe(true);
      expect(jee.rows.every((row) => row.source_name === "National Testing Agency (JEE Main)")).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads eight verified official JEE Main 2024 Session 1 papers into JEE-only exam scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeMain2024Session1PapersSeed);
      await pg.exec(jeeMain2024Session1PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 8, scopes: 8 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(8);
      expect(Number(jee.rows[0].total_count)).toBe(8);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.title.includes("English & Hindi"))).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2024)).toBe(true);
      expect(jee.rows.map((row) => row.page_count).sort((a, b) => a - b)).toEqual([
        104, 105, 106, 108, 116, 117, 117, 121,
      ]);
      expect(jee.rows.every((row) => row.source_name === "National Testing Agency (JEE Main)")).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads all ten official JEE Main 2024 Session 2 papers into JEE-only exam scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeMain2024Session2PapersSeed);
      await pg.exec(jeeMain2024Session2PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 10, scopes: 10 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(10);
      expect(Number(jee.rows[0].total_count)).toBe(10);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.title.includes("English & Hindi"))).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2024)).toBe(true);
      expect(jee.rows.map((row) => row.page_count).sort((a, b) => a - b)).toEqual([
        106, 107, 108, 110, 117, 121, 122, 123, 123, 125,
      ]);
      expect(jee.rows.every((row) => row.source_name === "National Testing Agency (JEE Main)")).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads nine official JEE Main 2026 Session 2 papers into JEE-only exam scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(jeeMain2026Session2PapersSeed);
      await pg.exec(jeeMain2026Session2PapersSeed);
      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 9, scopes: 9 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'previous_year_paper'
      )`);
      expect(jee.rows).toHaveLength(9);
      expect(Number(jee.rows[0].total_count)).toBe(9);
      expect(jee.rows.every((row) => row.language === "English")).toBe(true);
      expect(jee.rows.every((row) => row.exam_year === 2026)).toBe(true);
      expect(jee.rows.every((row) => row.source_name === "National Testing Agency (JEE Main)")).toBe(true);
      expect(jee.rows.every((row) => row.scopes.length === 1)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].goal === "jee")).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].subject === null)).toBe(true);
      expect(jee.rows.every((row) => row.scopes[0].chapter === null)).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'previous_year_paper'
      )`);
      expect(neet.rows).toHaveLength(0);
      const classSpecific = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_class_slug => 'class-12',
        p_material_type => 'previous_year_paper'
      )`);
      expect(classSpecific.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);
});
