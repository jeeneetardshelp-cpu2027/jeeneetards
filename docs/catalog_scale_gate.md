# Catalogue scale release gate

Status: passed 8/8 on disposable staging on 23 July 2026 (run `a008ac`).
The run cleaned every fixture row. This is a destructive-fixture test for a
**disposable staging project only**. It refuses production by URL and by the
`app_environment` marker, requires both `TEST_ALLOW=1` and `SCALE_ALLOW=1`,
uses unique collected ids for cleanup, and writes `catalog-scale-report.json`.

Measured p95 end-to-end times over seven post-warm-up requests were:

| Request | p95 | Budget |
|---|---:|---:|
| JEE Class 11 chapter navigation | 1,011 ms | 1,200 ms |
| Contextual facet counts | 96 ms | 1,800 ms |
| Filtered 12-course page + exact count | 125 ms | 1,200 ms |
| Leading-wildcard title search | 109 ms | 1,200 ms |

The chapter-navigation result passes, but its 189 ms margin is narrow compared
with the other queries. Treat it as the first performance watch item before
raising the catalogue beyond this fixture size; passing is not evidence of
unbounded scale.

The default fixture represents the near-term catalogue rather than today's
seven production courses:

- 1,000 playlists;
- 10,000 videos;
- 20 channels;
- 50 chapters;
- 200 distinct legacy teacher labels.

It measures anonymous student-facing requests after two warm-up calls:

1. JEE Class 11 chapter navigation;
2. contextual facet counts;
3. the real 12-course filtered PostgREST page with exact count;
4. the current leading-wildcard title search.

The report records median, p95 and maximum end-to-end request time. Default
p95 budgets are 1,200 ms for curriculum/page/search and 1,800 ms for facets.
These include network time from the test machine; they are release budgets,
not a pure database benchmark.

## Run

In `.env.staging`, temporarily add:

```text
SCALE_ALLOW=1
```

Then run:

```text
set "SCALE_ALLOW=1" && npm.cmd run verify:catalog-scale
```

Remove `SCALE_ALLOW` after the run. Do not loosen a failing budget merely to
make the report green: inspect the recorded query first, then change indexes or
query shape and repeat against a freshly cleaned fixture.

Optional bounded overrides are `SCALE_PLAYLISTS`,
`SCALE_VIDEOS_PER_PLAYLIST`, `SCALE_CHANNELS`, `SCALE_CHAPTERS`,
`SCALE_TEACHERS`, `SCALE_SAMPLES`, `SCALE_CATALOG_P95_MS`,
`SCALE_FACET_P95_MS`, and `SCALE_PAGE_P95_MS`.
