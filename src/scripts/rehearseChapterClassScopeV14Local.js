import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = resolve(import.meta.dirname, "../..");
const expectedProductionHost = "kezelafqhgqrprpadmlf.supabase.co";
const expectedHashes = {
  browseDraft: "c6961481247c74a36cb449aa6bfab45627ccc2fe2fb876f3701bc0c129ca7315",
  rollbackRehearsal: "dd46b3456c49c31d1d235e2e9ba3919cb1188a211c4eeb6821aa7a0966ce5dd0",
};

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const split = line.indexOf("=");
        const key = line.slice(0, split).trim();
        let value = line.slice(split + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return [key, value];
      }),
  );
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readPinned(relativePath, expectedHash) {
  const value = await readFile(resolve(root, relativePath));
  const actualHash = sha256(value);
  if (actualHash !== expectedHash) {
    throw new Error(
      `${relativePath} hash mismatch: expected ${expectedHash}, got ${actualHash}`,
    );
  }
  return value.toString("utf8");
}

const env = parseEnv(await readFile(resolve(root, ".env"), "utf8"));
const baseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

if (!baseUrl || !anonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required");
}
if (new URL(baseUrl).hostname !== expectedProductionHost) {
  throw new Error(
    `Refusing unexpected snapshot target ${new URL(baseUrl).hostname}; expected ${expectedProductionHost}`,
  );
}

// Deliberately use only the public anonymous credential. Every remote request
// below is an HTTP GET; all SQL runs inside a new in-memory PGlite database.
const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
};

const tables = [
  {
    name: "learning_goals",
    columns: ["id", "slug", "name", "display_order"],
    order: "id.asc",
  },
  {
    name: "class_levels",
    columns: ["id", "slug", "name", "display_order"],
    order: "id.asc",
  },
  {
    name: "subjects",
    columns: ["id", "slug", "name", "display_order"],
    order: "id.asc",
  },
  {
    name: "chapters",
    columns: ["id", "subject_id", "slug", "name", "display_order"],
    order: "id.asc",
  },
  {
    name: "playlists",
    columns: [
      "id",
      "title",
      "teacher",
      "youtube_playlist_id",
      "category_id",
      "subject_id",
      "class_levels",
      "audience_focus",
      "content_type",
      "language",
      "difficulty",
      "channel_id",
    ],
    order: "id.asc",
  },
  { name: "videos", columns: ["id", "chapter_id"], order: "id.asc" },
  {
    name: "playlist_videos",
    columns: ["id", "playlist_id", "video_id", "position"],
    order: "id.asc",
  },
  {
    name: "playlist_learning_goals",
    columns: ["playlist_id", "learning_goal_id"],
    order: "playlist_id.asc,learning_goal_id.asc",
  },
  {
    name: "playlist_class_levels",
    columns: ["playlist_id", "class_level_id"],
    order: "playlist_id.asc,class_level_id.asc",
  },
  {
    name: "chapter_class_levels",
    columns: [
      "chapter_id",
      "class_level_id",
      "source_url",
      "scope_note",
      "reviewed_on",
      "created_at",
    ],
    order: "chapter_id.asc,class_level_id.asc",
  },
];

async function fetchCount(table) {
  const url = new URL(`/rest/v1/${table}`, baseUrl);
  url.searchParams.set("select", "*");
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    method: "GET",
    headers: {
      ...headers,
      Prefer: "count=exact",
      Range: "0-0",
      "Range-Unit": "items",
    },
  });
  if (!response.ok) {
    throw new Error(`${table} count failed: ${response.status} ${await response.text()}`);
  }
  const contentRange = response.headers.get("content-range");
  const total = Number(contentRange?.split("/")[1]);
  if (!Number.isInteger(total)) {
    throw new Error(`${table} count missing from Content-Range: ${contentRange}`);
  }
  return total;
}

async function fetchAll({ name, columns, order }) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const url = new URL(`/rest/v1/${name}`, baseUrl);
    url.searchParams.set("select", columns.join(","));
    url.searchParams.set("order", order);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...headers,
        Range: `${from}-${from + pageSize - 1}`,
        "Range-Unit": "items",
      },
    });
    if (!response.ok) {
      throw new Error(`${name} read failed: ${response.status} ${await response.text()}`);
    }
    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

const guardedCounts = [
  "playlists",
  "videos",
  "playlist_videos",
  "chapters",
  "subjects",
  "class_levels",
  "chapter_class_levels",
];

const beforeCounts = Object.fromEntries(
  await Promise.all(guardedCounts.map(async (name) => [name, await fetchCount(name)])),
);
const snapshot = Object.fromEntries(
  await Promise.all(tables.map(async (table) => [table.name, await fetchAll(table)])),
);
const afterCounts = Object.fromEntries(
  await Promise.all(guardedCounts.map(async (name) => [name, await fetchCount(name)])),
);

if (JSON.stringify(beforeCounts) !== JSON.stringify(afterCounts)) {
  throw new Error(
    `Production changed during the read-only snapshot: ${JSON.stringify({ beforeCounts, afterCounts })}`,
  );
}
for (const name of guardedCounts) {
  if (snapshot[name].length !== beforeCounts[name]) {
    throw new Error(
      `${name} snapshot mismatch: expected ${beforeCounts[name]}, got ${snapshot[name].length}`,
    );
  }
}

console.log(`Read-only snapshot captured from ${new URL(baseUrl).hostname}`);
console.log(JSON.stringify(beforeCounts));

const pg = new PGlite();
await pg.waitReady;

let localFailure = null;
try {
  await pg.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;

    create table public.learning_goals (
      id bigint primary key,
      slug text not null unique,
      name text not null unique,
      display_order integer not null
    );
    create table public.class_levels (
      id bigint primary key,
      slug text not null unique,
      name text not null unique,
      display_order integer not null
    );
    create table public.subjects (
      id bigint primary key,
      slug text not null unique,
      name text not null unique,
      display_order integer not null
    );
    create table public.chapters (
      id bigint primary key,
      subject_id bigint not null references public.subjects(id),
      slug text not null,
      name text not null,
      display_order integer not null,
      unique (subject_id, slug)
    );
    create table public.playlists (
      id bigint primary key,
      title text not null,
      teacher text,
      youtube_playlist_id text,
      category_id bigint,
      subject_id bigint references public.subjects(id),
      class_levels text[] not null default '{}',
      audience_focus text,
      content_type text,
      language text,
      difficulty text,
      channel_id bigint
    );
    create table public.videos (
      id bigint primary key,
      chapter_id bigint references public.chapters(id)
    );
    create table public.playlist_videos (
      id bigint primary key,
      playlist_id bigint not null references public.playlists(id),
      video_id bigint not null references public.videos(id),
      position integer not null
    );
    create table public.playlist_learning_goals (
      playlist_id bigint not null references public.playlists(id),
      learning_goal_id bigint not null references public.learning_goals(id),
      primary key (playlist_id, learning_goal_id)
    );
    create table public.playlist_class_levels (
      playlist_id bigint not null references public.playlists(id),
      class_level_id bigint not null references public.class_levels(id),
      primary key (playlist_id, class_level_id)
    );
    create table public.chapter_class_levels (
      chapter_id bigint not null references public.chapters(id) on delete cascade,
      class_level_id bigint not null references public.class_levels(id) on delete cascade,
      source_url text not null,
      scope_note text not null,
      reviewed_on date not null,
      created_at timestamptz not null default now(),
      primary key (chapter_id, class_level_id)
    );
  `);

  async function insertRows(table) {
    const rows = snapshot[table.name];
    const columns = table.columns;
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const sql = `insert into public.${table.name} (${columns.join(", ")}) values (${placeholders})`;
    await pg.transaction(async (tx) => {
      for (const row of rows) {
        await tx.query(sql, columns.map((column) => row[column]));
      }
    });
  }

  for (const table of tables) {
    await insertRows(table);
  }

  const protectedBaseline = await pg.query(`
    select
      (select count(*)::integer
         from public.playlists p
        where p.id < 167
          and exists (
            select 1
              from public.playlist_learning_goals plg
              join public.learning_goals lg on lg.id = plg.learning_goal_id
             where plg.playlist_id = p.id and lg.slug = 'jee'
          )) as protected_courses,
      (select count(*)::integer
         from public.playlist_videos pv
         join public.playlists p on p.id = pv.playlist_id
        where p.id < 167
          and exists (
            select 1
              from public.playlist_learning_goals plg
              join public.learning_goals lg on lg.id = plg.learning_goal_id
             where plg.playlist_id = p.id and lg.slug = 'jee'
          )) as protected_memberships,
      md5(
        coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
          select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
                 p.subject_id, p.class_levels, p.audience_focus, p.content_type,
                 p.language, p.difficulty
            from public.playlists p
            join public.playlist_learning_goals plg on plg.playlist_id = p.id
            join public.learning_goals lg on lg.id = plg.learning_goal_id
           where lg.slug = 'jee' and p.id < 167
        ) x), '') || '|' ||
        coalesce((select string_agg(row_to_json(y)::text, '|'
                                    order by y.playlist_id, y.position, y.id) from (
          select pv.id, pv.playlist_id, pv.video_id, pv.position
            from public.playlist_videos pv
            join public.playlists p on p.id = pv.playlist_id
           where p.id < 167 and exists (
             select 1
               from public.playlist_learning_goals plg
               join public.learning_goals lg on lg.id = plg.learning_goal_id
              where plg.playlist_id = p.id and lg.slug = 'jee'
           )
        ) y), '')
      ) as protected_fingerprint
  `);
  console.log(JSON.stringify(protectedBaseline.rows[0]));

  let browseSql = await readPinned(
    "src/migrations/chapter_class_scopes_v13_browse_draft.sql",
    expectedHashes.browseDraft,
  );
  browseSql = browseSql.replace(
    /do \$not_approved\$[\s\S]*?\$not_approved\$;\s*/,
    "",
  );
  await pg.exec(browseSql);

  async function chapterCount(goal, classSlug, subject) {
    const result = await pg.query(
      `select count(*)::integer as n
         from public.get_browse_curriculum($1, $2, $3)
        where level = 'chapter'`,
      [goal, classSlug, subject],
    );
    return result.rows[0].n;
  }

  async function chapterOverlap(goal, subject) {
    const result = await pg.query(
      `select count(*)::integer as n from (
         select slug from public.get_browse_curriculum($1, 'class-11', $2)
          where level = 'chapter'
         intersect
         select slug from public.get_browse_curriculum($1, 'class-12', $2)
          where level = 'chapter'
       ) overlapping_chapters`,
      [goal, subject],
    );
    return result.rows[0].n;
  }

  const browseBaseline = {
    jee_chemistry_11: await chapterCount("jee", "class-11", "chemistry"),
    jee_chemistry_12: await chapterCount("jee", "class-12", "chemistry"),
    jee_chemistry_overlap: await chapterOverlap("jee", "chemistry"),
    jee_mathematics_11: await chapterCount("jee", "class-11", "mathematics"),
    jee_mathematics_12: await chapterCount("jee", "class-12", "mathematics"),
    jee_mathematics_overlap: await chapterOverlap("jee", "mathematics"),
    neet_physics_11: await chapterCount("neet", "class-11", "physics"),
    neet_physics_12: await chapterCount("neet", "class-12", "physics"),
    neet_physics_overlap: await chapterOverlap("neet", "physics"),
    neet_chemistry_11: await chapterCount("neet", "class-11", "chemistry"),
    neet_chemistry_12: await chapterCount("neet", "class-12", "chemistry"),
    neet_chemistry_overlap: await chapterOverlap("neet", "chemistry"),
    neet_biology_11: await chapterCount("neet", "class-11", "biology"),
    neet_biology_12: await chapterCount("neet", "class-12", "biology"),
    neet_biology_overlap: await chapterOverlap("neet", "biology"),
    school_mathematics_10: await chapterCount("school", "class-10", "mathematics"),
  };
  console.log(JSON.stringify(browseBaseline));

  const rehearsalSql = await readPinned(
    "production/chapter_class_scopes_v14_clone_rehearsal/rollback_rehearsal.sql",
    expectedHashes.rollbackRehearsal,
  );
  const results = await pg.exec(rehearsalSql);
  const rows = results.flatMap((result) => result.rows ?? []);
  const projection = rows.find((row) => row.rehearsed_scope_rows !== undefined);
  const verified = rows.find(
    (row) => row.result === "v14 rollback verified; no persistent database change",
  );

  if (!projection || !verified) {
    throw new Error("Expected v14 projection or rollback evidence was not returned");
  }

  const finalScopeCount = await pg.query(
    "select count(*)::integer as n from public.chapter_class_levels",
  );
  if (finalScopeCount.rows[0].n !== 5) {
    throw new Error(`Local rollback failed: ${finalScopeCount.rows[0].n} scope rows remain`);
  }

  console.log(JSON.stringify(projection));
  console.log(verified.result);
  console.log("Production requests were GET-only; all SQL ran in ephemeral PGlite memory.");
} catch (error) {
  localFailure = error;
}

if (localFailure) {
  console.error(`Local rehearsal failed: ${localFailure.message}`);
  if (localFailure.cause?.message) {
    console.error(`Cause: ${localFailure.cause.message}`);
  }
  process.exit(1);
}

await pg.close();
