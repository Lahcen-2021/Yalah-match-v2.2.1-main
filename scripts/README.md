# scripts/

One-off developer utilities. **Nothing here is imported by the app, the server or the
build** — these are run by hand, and the site does not depend on any of them.

They used to sit loose in the repo root next to `App.tsx` and `server.ts`, which made it
hard to tell real source from scratch work.

## Run them from the repo root

Every script resolves paths against the current working directory, so invoke them as:

```bash
node scripts/fetch_espn.cjs
```

Output lands in the repo root (where the existing snapshots live), not in this folder.

## What they are

| Group | Files | Purpose |
|---|---|---|
| Team map | `gen-team-map.mts` | Wired up as `npm run gen:team-map`. The one script here with a package.json entry. |
| ESPN fetch | `fetch_espn.cjs`, `fetch_espn_standings.cjs`, `fetch_espn_stats.cjs` | Dump raw ESPN responses to `espn_*.json` in the repo root. |
| ESPN parse | `parse_espn*.cjs` | Read those dumps back and print extracted fields. |
| Competition names | `extract_names.js`, `extract_soccer_names.js` | Derive `competition_names.json` / `soccer_competitions.json` from `all_competitions.json`. |
| Probes | `test_*.js`, `test-cors.js`, `scrape_bein_params.js`, `check_time.js` | Ad-hoc upstream checks written while reverse-engineering a source. Not a test suite — there is no assertion framework here and `npm test` does not run them. |

## About the JSON snapshots they produce

The outputs (`espn_summary.json`, `espn_standings.json`, `espn_stats.json`,
`all_competitions*.json`, `competition_names.json`, `soccer_competitions.json`) are
**gitignored on purpose**: the live backend serves this data now, so a committed copy is
just a stale duplicate. Regenerate with the scripts above if you need one locally.

The one exception is `bein_epg.json`, which stays tracked — `server.ts` reads it at
runtime as a fallback for the beIN guide.
