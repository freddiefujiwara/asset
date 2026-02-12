# Asset Visualizer

This project is a small Vue app.
It shows personal assets and liabilities.
It has three screens:

- Dashboard
- Holdings
- Family Assets

The app tries to get live data from an API.
If the API fails, the app uses local mock data.

---

## What this app does

This app helps you see money data in one place.
It shows:

- total assets
- total liabilities
- net worth
- asset breakdown
- liability breakdown
- detailed holdings
- family-level summary

It also has:

- dark / light theme switch
- privacy mode (blur amount values)
- mobile-friendly table layout

---

## Tech stack

- Vue 3 (Composition API, `<script setup>`)
- Vite
- Pinia (state store)
- Vue Router
- Vitest (unit tests)

---

## App structure (inside `src`)

- `main.js`
  - Creates Vue app.
  - Adds Pinia and Router.
  - Defines routes:
    - `/dashboard`
    - `/holdings`
    - `/family-assets`
- `App.vue`
  - Main layout.
  - Header + navigation.
  - Theme toggle and privacy toggle.
  - Saves settings in `localStorage`.
- `style.css`
  - Global styles and color tokens.
  - Light/dark theme variables.
  - Privacy blur style.
  - Responsive table styles.
- `stores/portfolio.js`
  - Fetches data from API.
  - Normalizes data.
  - Falls back to mock JSON on error.
- `views/`
  - `Dashboard.vue`: totals + pie charts + summary tables.
  - `Holdings.vue`: section-by-section detail tables.
  - `FamilyAssets.vue`: grouped by family member.
- `components/`
  - `HoldingTable.vue`: generic table for holdings.
  - `PieChart.vue`: SVG pie chart + legend.
- `domain/`
  - `parse.js`: parse number and percent strings.
  - `format.js`: yen formatting, signed values, daily move extraction.
  - `normalize.js`: map API shape to app-safe shape.
  - `family.js`: detect owner and build family summaries.
- `mocks/sampleApi.json`
  - Mock API data used for fallback.

---

## Data flow (easy view)

1. A view is opened.
2. The view checks if store data exists.
3. If no data, it calls `fetchPortfolio()`.
4. Store tries live API.
5. On success:
   - save normalized live data
   - set source to `live`
6. On failure:
   - save normalized mock data
   - set source to `mock`
   - set error message
7. Views read data from store and render tables/charts.

---

## Main screen behavior

### 1) Dashboard (`/dashboard`)

Shows:

- data source label (`live` or `mock`)
- loading and error messages
- balance sheet cards:
  - total assets
  - total liabilities
  - net worth
- two pie charts:
  - assets by class
  - liabilities by category
- two tables with amount and percent

Data comes from:

- `data.totals`
- `data.summary.assetsByClass`
- `data.summary.liabilitiesByCategory`

### 2) Holdings (`/holdings`)

Shows:

- stock + fund summary block
  - total evaluation amount
  - total daily move
- jump links to each section
- one reusable table per category

Categories:

- cash/deposit
- stocks
- funds
- pensions
- points
- liability details

Special behavior:

- daily move column is computed from several possible field names
- stock name can become an external link to Google stock search
- mobile mode uses stacked table cards

### 3) Family Assets (`/family-assets`)

Shows:

- total stock/fund summary for all family
- jump links by family member
- cards per member:
  - total assets
  - stock/fund total
  - daily move
- detail table per member

Owner detection rule is string-based:

- contains sample tag `@wife-tag` -> wife
- contains sample tag `@child-tag` -> daughter
- else -> me

The app groups rows from multiple categories and sums values.

---

## Domain logic details

### `parse.js`

- `toNumber(value)`
  - supports number input and many currency-like strings
  - removes symbols like `￥`, `¥`, `,`, `円`
  - returns `0` when value is invalid
- `toPercent(value)`
  - supports `"9.94"` and `"9.94%"`
  - returns `0` when invalid

### `format.js`

- `formatYen(value)` -> `¥12,345`
- `formatSignedYen(value)`
  - positive: `+¥...`
  - negative: `-¥...`
  - zero: `±¥0`
- `dailyChangeYen(row)`
  - checks many candidate keys for daily change
- `holdingRowKey(row)`
  - makes stable row key from institution + name

### `normalize.js`

`normalizePortfolio(api)` returns one safe object:

- `totals`
- `summary`
- `holdings`

It converts numeric strings to numbers and gives empty arrays when keys are missing.

### `family.js`

- detects owner from text suffix rules
- finds amount field from many candidate keys
- creates display name from multiple key choices
- builds summary output for 3 fixed groups:
  - me
  - wife
  - daughter

---

## Router and state

### Router

Defined in `main.js`.

- `/` redirects to `/dashboard`
- route components are imported directly (no lazy import)

### Pinia store

Store id: `portfolio`

State:

- `data`
- `loading`
- `error`
- `source`

Action:

- `fetchPortfolio()`

This keeps all data loading logic in one place.

---

## UI settings

### Theme

Saved key: `asset-theme`

- value is `dark` or `light`
- stored in `localStorage`
- applied to `document.documentElement` as `data-theme`

### Privacy mode

Saved key: `asset-privacy`

- value is `on` or off
- stored in `localStorage`
- applied as `data-private`
- when on, `.amount-value` uses CSS blur

---

## Debug API mode on gh-pages

If the GAS API is in DEBUG mode and returns data without authentication, this SPA will still render the app even when `asset-google-id-token` is empty. This is intentional for debug flows.

Possible side effects while DEBUG mode is enabled:

- Anyone who can access the API endpoint may be able to view data without Google login.
- The login gate can be bypassed when API data is returned with `200`.
- Non-auth API failures still fall back to mock data, which can hide temporary API outages.
- If the API does not allow `Authorization` header preflight on your origin, browser CORS can block bearer requests.
  - Default behavior: show a CORS error and stop (no mock fallback) to avoid hiding production auth/CORS misconfiguration.
  - Optional debug-only fallback: set `VITE_DEBUG_ALLOW_UNAUTH_RETRY=true` to retry once without bearer header.

For production, disable DEBUG mode in GAS and rely on server-side allowlist checks (`iss`/`aud`/`exp`/`email_verified` + allowed Gmail list).

## Env (for Google Sign-In)

Set this in `.env.local` when using Google login UI:

```bash
VITE_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
# optional, DEBUG mode only
# VITE_DEBUG_ALLOW_UNAUTH_RETRY=true
```

For gh-pages builds via GitHub Actions, add `VITE_DEBUG_ALLOW_UNAUTH_RETRY` as a Repository Variable only if you intentionally want debug fallback behavior in deployed builds.

---

## How to run

```bash
npm install
npm run dev
```

Open browser at the local Vite URL (usually `http://localhost:5173`).

### Build

```bash
npm run build
npm run preview
```

### Test

```bash
npm run test
```

---

## Test coverage now

There are unit tests for these domain files:

- `parse.js`
- `normalize.js`
- `family.js`

These tests check parsing, normalization safety, and family aggregation logic.

---


## Notes for future improvements

Possible next steps:

- add test file for `format.js`
- add i18n for English/Japanese labels
- move owner rules to config file
- lazy-load route components
- add API timeout and retry control
- add accessibility checks for charts

