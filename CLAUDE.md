# CLAUDE.md

## Project Overview

**Bullion vs Bytes Functions** — Firebase Cloud Functions backend that feeds the [bullionvsbytes.com](https://bullionvsbytes.com) frontend. It polls price data for precious metals, crypto, and a couple of funds/ETFs every 30 minutes, monthly-syncs home price indices for 13 cities (US, Germany, Australia, Shanghai, Singapore, Hong Kong) plus month-end FX rates, stores it all in Firestore, aggregates it into monthly history, and exposes an HTTP endpoint the frontend consumes for charts and performance stats.

This repo is backend-only. The frontend is a separate Next.js repo (bullion-vs-bytes) — see its `CLAUDE.md` for site/product context (growth strategy, InflationGuard funnel, page roadmap). This repo just needs to keep reliable, correctly-shaped data flowing to `getPerformance`.

## Tech Stack

- **Runtime**: Firebase Cloud Functions Gen 2 (`firebase-functions` v7, `onSchedule`/`onRequest` from `firebase-functions/v2/*`), Node 20
- **Language**: TypeScript (`strict: true`, `noImplicitAny: false`)
- **Data store**: Firestore (via `firebase-admin`)
- **HTTP client**: axios
- **Package manager**: Yarn (root) / npm scripts (inside `functions/`)
- **Deployment**: Firebase CLI, project `bullion-vs-bytes`

## Project Structure

```
functions/
  src/
    index.ts               # Exported Cloud Functions (scheduled + HTTP)
    admin.ts                # Firebase Admin init, exports `db`, Timestamp, FieldValue
    schedule/
      prices.ts             # savePrices — runs every 30 min
      realEstate.ts          # saveRealEstatePrices — monthly, merges into monthlyPrices
      fx.ts                  # saveExchangeRates — monthly, merges into monthlyPrices
    scripts/
      backfillMonthly.ts     # one-off/re-runnable full-history backfill (not a deployed function)
    utils/
      rates.ts              # External API calls for the 30-min instruments (CoinGecko, Tiingo, fund value service)
      realEstate.ts          # Real estate sources list (FRED, GREIX, ABS, Eastmoney, data.gov.sg, BIS) + GREIX fetcher + month gap-filling; no admin import
      abs.ts                 # ABS xlsx scraper (discovers the current release file each run)
      bis.ts                 # Hong Kong: BIS WS_SPP CSV API (republishes the RVD index)
      singapore.ts           # Singapore: URA private residential index via data.gov.sg JSON API
      eastmoney.ts           # Shanghai: NBS second-hand changes via Eastmoney JSON, chained into an index
      fx.ts                  # Month-end FX rates from FRED (USD per 1 foreign unit)
      fred.ts / http.ts / months.ts  # shared FRED fetch, key-safe error formatting, groupByMonth
      aggregate.ts           # aggregateMonth — rolls up daily prices into monthlyPrices
      perfromanceData.ts     # getPerformanceData — builds the payload for the HTTP endpoint (note: filename typo, kept as-is)
      time.ts                 # getDate — UTC date formatting helper
    types/
      rates.ts               # Shared types: PmRates, CryptoRates, SPYRate, FundRates, Rates, PriceData, Performances
  package.json
  tsconfig.json
firebase.json               # Functions source config, predeploy lint+build, emulator ports
.firebaserc                 # Firebase project: bullion-vs-bytes
```

## Common Commands

Run from `functions/`:

```bash
npm run build          # tsc build (lib/)
npm run watch           # tsc --watch
npm run lint            # eslint .
npm run lint:fix        # eslint . --fix
npm run serve            # build + start functions emulator
npm run emulator          # yarn build + emulators:start --only functions
npm run debug             # emulator with --inspect-functions
npm run shell              # build + firebase functions:shell
npm run deploy              # firebase deploy --only functions --project bullion-vs-bytes
npm run logs                 # firebase functions:log
npm run backfill:monthly       # build + backfill real estate history (from 1983) and FX (from 2000) into Firestore (add -- --dry-run first)
npm test                       # jest (no test files currently exist)
```

`firebase deploy` runs `lint` then `build` as predeploy hooks automatically (see `firebase.json`).

## Data Model (Firestore)

| Collection | Written by | Shape | Purpose |
|---|---|---|---|
| `dailyPrices` | `savePrices` (every 30 min) | doc ID = timestamp; one doc per run | Rolling 24h window — capped at 48 docs (oldest deleted on write) |
| `prices` | `savePrices` (once/day, at UTC midnight window) | doc ID = `YYYY-MM-DD` | Daily snapshot history, guarded against double-writes via `metadata/lastSavedDate` |
| `monthlyPrices` | `aggregateMonth` (1st of month, cron) **and** `saveRealEstatePrices` + `saveExchangeRates` (monthly) | doc ID = `YYYY-MM` | Long-run monthly history. Both writers use `{ merge: true }` — never plain `set()`, or they wipe each other's fields. Real estate docs reach back to 1983 and FX to 2000, but crypto/PM/SPY/funds only start in 2018-01, so older docs are sparse (only real estate + FX fields) |
| `metadata/lastSavedDate` | `savePrices` | `{ date }` | Idempotency guard so the daily snapshot isn't written twice in the same midnight window |

Tracked instruments: `BTC`, `ETH`, `AG` (silver), `AU` (gold), `SPY`, and three tokenized/fund proxies `BTGLD`, `YPGLD`, `BBGLD` (all 30-min/daily/monthly).

Real estate (monthly docs only, no daily/short-term equivalent; each city has its own unit and base — index points for most, AUD thousands (a median price) for Australia — and the frontend rebases per series and converts currency with the FX rates below):

| Keys | Source | Cadence |
|---|---|---|
| `NY_RE`, `SF_RE`, `MIAMI_RE`, `DALLAS_RE` | FRED Case-Shiller (`NYXRSA`, `SFXRSA`, `MIXRNSA`, `DAXRSA`), needs `FRED_API_KEY` | Monthly, ~2-month lag |
| `HONGKONG_RE` | Hong Kong private domestic price index (RVD, all classes), nominal, 2010 = 100, via the BIS property price statistics API (`stats.bis.org/api/v2/data/dataflow/BIS/WS_SPP/1.0/Q.HK.N.628?format=csv`, no key). BIS series metadata is blank; verified against RVD's own class indices (Q2 2026 vs Q1 rose ~4.1% in both). RVD itself only offers legacy `.xls`, which we deliberately don't parse. Uses `HKDUSD` | Quarterly (quarter-end months), from 1979-Q4 |
| `SINGAPORE_RE` | URA Private Residential Property Price Index (2009-Q1 = 100), all private residential (landed + non-landed, not public HDB flats), via the data.gov.sg datastore API (dataset `d_97f8a2e995022d311c6c68cfda6d034c`, no key). Uses `SGDUSD` | Quarterly (quarter-end months), from 1975 |
| `SHANGHAI_RE` | NBS 70-city **second-hand** price index, republished by Eastmoney's data center (`datacenter-web.eastmoney.com`, no key; unofficial endpoint that akshare also uses, may change or block). NBS only publishes changes, so `utils/eastmoney.ts` chains month-on-month values into a level with Dec 2010 = 100 (matches NBS's published YoY within ~0.5pp over 15 years). It always fetches the full history so the chain has a fixed base, and throws on gaps/missing months. No fallback source | Monthly, ~2-week lag (newest of all sources) |
| `SYDNEY_RE`, `MELBOURNE_RE`, `PERTH_RE` | ABS "Total Value of Dwellings" (6432.0) Table 2, established-house **median price in AUD thousands** (a price, not an index). Scraped: `utils/abs.ts` finds the `643202.xlsx` link on the latest-release page each run (URL changes every quarter), reads columns by ABS Series ID and verifies the labels, throws if anything is off | Quarterly (quarter-end months) |
| `BERLIN_RE`, `FRANKFURT_RE`, `MUNICH_RE` | GREIX (Kiel Institute), apartments, nominal, via `api.greixx.net` (no key; undocumented API behind greix.de — may change, failures throw) | Quarterly (real value on quarter-end months, other months carried forward) |

Every city has a value for every month from its first observation to the newest month any source has published (Shanghai is usually the newest, so slower sources are carried forward to its month): gaps (quarterly sources, publication lag) are forward-filled at write time by `fillMissingMonths`, and revisions are deliberately not tracked. The monthly job only fetches the last two calendar years; the backfill fetches from 1983.

Not implemented (discussed, deferred): a staleness cap (stop carrying a city forward after ~9 months) and a `metadata/realEstateAsOf` doc with each city's last real month, passed through the API so the frontend can label carried-forward stretches. Until then a stalled source is carried forward silently — Munich/Berlin are already ~5 months behind — so check the job logs (a failing source makes the run throw) and don't assume the newest months are real data.

FX rates (monthly docs only, from 2000, month-end via FRED daily series): `EURUSD`, `AUDUSD`, `SGDUSD`, `JPYUSD`, `CNYUSD`, `HKDUSD`. Every key is **USD per 1 unit of the foreign currency** (FRED quotes SGD/JPY/CNY/HKD the other way round; `utils/fx.ts` inverts them), so local -> USD is always `value * rate`. They exist because non-USD real estate values (DE = EUR, AU = AUD, Shanghai = CNY, Singapore = SGD, Hong Kong = HKD) must be converted to compare with USD assets (`JPYUSD` is stored for a future Tokyo). The frontend keeps the city -> currency map and does the multiplication; the in-progress month has no rate yet, so use the latest available one for the "Today" point. Adding a currency: add it to `FxRates` in `types/rates.ts` and `FX_SERIES` in `utils/fx.ts`, then re-run the backfill.

Deliberately skipped (don't re-research): **Tokyo** (MLIT price index halted since Dec 2025 because of a calculation bug, no new release date as of 2026-09; the workbook's Tokyo sheet has a Condominiums column, so it is easy to add once MLIT resumes). Shanghai has no fallback source by choice.

Adding a city: add its key to `RealEstateRates` in `types/rates.ts`, add it to an existing source or write a new `utils/<source>.ts` fetcher returning `RealEstateObservation[]` and add that to the source list in `utils/realEstate.ts` (add the currency to the FX list if it isn't USD), then re-run the backfill (`--dry-run` first). `getPerformanceData` spreads monthly docs, so no other change is needed for it to appear in the API.

## Exported Functions (`src/index.ts`)

- `savePricesScheduled` — every 30 minutes, 540s timeout. Fetches crypto/SPY/fund rates in parallel and calls `savePrices`.
- `aggregateMonthlyPrices` — cron `0 0 1 * *`, `timeZone: 'UTC'`. Aggregates the *previous* month into `monthlyPrices`.
- `saveRealEstatePricesScheduled` — cron `0 6 8 * *`, `timeZone: 'UTC'` (the 8th, not the 1st: Case-Shiller for month M is released at the end of M+2 and FRED adds it a day or two later; GREIX publishes ~5-6 weeks after quarter end, e.g. Q2 on Aug 6, Q3 on ~Nov 6). Fetches the last two calendar years, forward-fills gaps and merges them into `monthlyPrices`. Sources fail independently: it saves what it got, then throws if any source failed. Gen2 cron schedules must set `timeZone` explicitly (default is America/Los_Angeles).
- `saveExchangeRatesScheduled` — cron `0 6 8 * *`, `timeZone: 'UTC'` (the 8th, because FRED's daily FX arrives in weekly batches). Fetches the last two calendar years of month-ends; the in-progress month is skipped.
- `getPerformance` — HTTP endpoint (CORS open to `*`, GET only). Returns `PriceData`: `dailyRates`, `monthlyChartData` (last 10 years only, ~121 rows / ~70 KB, as `monthlyPrices` reaches back to 1983; includes real estate + FX keys; the current-month row is built from live prices and has no real estate/FX keys, so the frontend should use the latest stored month for those; crypto/PM/SPY only start in 2018-01, so a 10Y chart of those is really ~8.7Y), `shortTermChartData` (90-day, sampled every 2 days), `lastUpdated`, and `performances` (1M/3M/YTD/1Y/3Y/5Y, crypto/PM/SPY only — no real estate). The frontend does not use `performances`; it computes performance client-side to keep payloads small, so don't add derived metrics here.
- The old `test` health-check endpoint was removed (it was a public URL; keep it commented out/removed rather than letting it trigger writes).

## External Data Sources (`src/utils/rates.ts`)

- **CoinGecko** — BTC, ETH, and tokenized gold/silver proxies (`kinesis-silver`, `tether-gold`) used as the actual AG/AU source in `savePrices`
- **Tiingo** — SPY price, 15-min delayed on free tier
- **getfundvalue-6jf7yi4gba-uc.a.run.app** — separate Cloud Run service returning `BTGLD`/`YPGLD`/`BBGLD` fund values

API keys come from `functions/.env` (`TIINGO_API_KEY`, `FRED_API_KEY`; gitignored) via `process.env` — the Firebase CLI bundles it on deploy and loads it in the emulator. `functions.config()` is no longer used; don't reintroduce it. FRED keys must be exactly 32 lowercase alphanumeric chars.

## Coding Conventions

- TypeScript `strict: true` — do not weaken this in `tsconfig.json`
- ESLint + Prettier enforced as a predeploy gate (`npm run lint` must pass before deploy)
- Keep the `Rates` / `CryptoRates` / `FundRates` / `PmRates` type composition in `types/rates.ts` as the single source of truth for instrument fields — all collections and the HTTP response reuse it
- New instruments should be added consistently across: `types/rates.ts`, `utils/rates.ts` (fetch), `schedule/prices.ts` (write), `utils/aggregate.ts` (rollup), `utils/perfromanceData.ts` (read + performance calc)
- No test framework is actively used (jest configured but no test files exist) — do not add tests without discussion

## Key Files

| File | Purpose |
|---|---|
| `src/index.ts` | Function exports — scheduled jobs + HTTP endpoint |
| `src/schedule/prices.ts` | Core write path: 30-min snapshots + once-daily history write |
| `src/utils/rates.ts` | All external API integrations |
| `src/utils/aggregate.ts` | Monthly rollup logic |
| `src/utils/realEstate.ts` / `src/utils/fx.ts` | Real estate sources list + gap-filling, and month-end FX rates (`src/scripts/backfillMonthly.ts` runs both over full history) |
| `src/utils/perfromanceData.ts` | Builds the full API response consumed by the frontend, including performance % calculations |
| `src/types/rates.ts` | Shared types — mirror any changes here on the frontend's expected response shape |
| `firebase.json` | Emulator ports (functions: 5003, firestore: 8080), predeploy lint+build |

## Working With This Repo

- Changes to `PriceData` / `Performances` shape in `types/rates.ts` are a contract change with the frontend (`lib/` consumers in bullion-vs-bytes) — check both sides before shipping.
- ESLint uses `eslint-import-resolver-typescript` (the default resolver can't see `firebase-functions/v2/*` exports maps) and `import/namespace` is off (false positives on `firebase-admin`).
- `savePrices` has two write paths with different cadences (every 30 min vs. once/day) — be careful not to break the midnight-window dedup logic in the daily path when touching this file.
- Performance calculations in `perfromanceData.ts` rely on exact `monthlyPrices` doc IDs (`YYYY-MM`) existing for the lookback periods (YTD, 1Y, 3Y, 5Y) — a missing month will throw (non-null assertions on `.find()` results).
- Functions were migrated Gen1 -> Gen2: an existing Gen1 function can't be upgraded in place under the same name, it must be deleted first (`firebase functions:delete <name> --project bullion-vs-bytes --force`) then deployed. New functions have no such issue.
- Deploys go straight to the `bullion-vs-bytes` Firebase project — there's no separate staging project, so treat `npm run deploy` as a production action.
