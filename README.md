# Asset Visualizer

Asset Visualizer is a small web app.
It helps you see your money data in one place.

You can check:

- assets
- liabilities
- net worth
- holdings details
- cash flow
- FIRE simulation

---

## Main pages

The app has these routes:

- `/` -> redirects to `/balance-sheet`
- `/balance-sheet` -> balance sheet page
- `/holdings` -> redirects to `/balance-sheet`
- `/cash-flow` -> cash flow page
- `/fire` -> FIRE simulator page

---

## What each page does

### 1) Balance Sheet (`/balance-sheet`)

This integrated page provides a comprehensive view of your financial status:

- **Asset Management Summary**: Copyable JSON status, owner filters (All / Me / Wife / Daughter), total value/profit for stocks and funds, and category cards.
- **Balance Sheet Diagram**: Visual contrast between total assets, liabilities, and net worth.
- **Asset Breakdown Charts**: Pie charts for asset and liability distribution.
- **Detailed Asset Lists**: Sortable tables for Cash, Stocks (with treemap), Investment Trusts, Pensions, and Points.
- **Liability Details**: Summary and detailed tables for all liabilities.

You can also:

- sort table columns
- open Google stock search from stock names

### 2) Cash Flow (`/cash-flow`)

This page shows:

- filters (month, large category, small category, text search, transfer toggle)
- KPI cards (income, expense, net, transfers)
- monthly bar chart
- expense pie chart by category
- cash flow table

You can copy:

- monthly cash flow rows (`mfcf`)
- non-`mfcf` response data

### 3) FIRE Simulator (`/fire`)

This page lets you set inputs like:

- monthly investment
- return rate
- current age
- withdrawal rate
- inflation/tax options
- loan payment and payoff month
- post-FIRE extra expense

It also can auto-calculate from cash flow:

- monthly expense
- monthly income
- annual bonus
- loan payment

The simulator:

- estimates pension income
- runs simulation until age 100
- finds earliest FIRE month that can survive to age 100
- shows chart and annual table
- can copy JSON outputs

---

## Data loading and auth

The store file is `src/stores/portfolio.js`.

Flow:

1. App calls the GAS API.
2. If ID token exists, app sends it as `id_token` query param.
3. On success, app normalizes data and sets source to `live`.
4. On error:
   - AUTH error: keep no data and show auth error.
   - CORS error with login token: show CORS message.
   - other errors: fallback to `src/mocks/sampleApi.json` and set source to `mock`.

Google login token is saved in localStorage key:

- `asset-google-id-token`

---

## UI settings

The app saves these settings in localStorage:

- `asset-theme` (`dark` or `light`)
- `asset-privacy` (`on` or `off`)

Privacy mode blurs amount values.

---

## Domain files

Main domain logic is in `src/domain`:

- `parse.js` -> safe number/percent parsing
- `format.js` -> yen format and signed display
- `normalize.js` -> API data normalization
- `dashboard.js` -> balance sheet layout ratios
- `holdings.js` -> holdings summary/table configs/stock tiles
- `assetOwners.js` -> owner filter and category summaries
- `family.js` -> owner detection and family summaries
- `cashFlow.js` -> cash flow filters, sort, KPI, aggregates
- `fire.js` -> FIRE and pension simulation logic
- `signed.js` -> sign class and signed percent

---

## Tech stack

- Vue 3
- Vite
- Pinia
- Vue Router
- Vitest

---

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Test

```bash
npm run test
```

---

## Env var

If you use Google login UI, set this in `.env.local`:

```bash
VITE_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```
