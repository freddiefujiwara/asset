# Asset Visualizer - Technical Specification (Very Detailed)

## 1. Project Overview

### 1.1 Background
Many people keep financial data in different places:

- Bank accounts
- Brokerage accounts
- Pension services
- Point/reward programs
- Credit card debt and mortgage debt
- Monthly income and expense records

Because these data sources are separate, it is hard to answer basic questions quickly:

- "How much is my net worth now?"
- "How much of my assets are risky?"
- "How much do I spend every month?"
- "When can I safely retire (FIRE)?"

This project solves that fragmentation problem by loading one portfolio payload from a Google Apps Script API and converting it into a unified in-memory model.

---

### 1.2 Goal
The app gives one integrated personal finance dashboard with three major capabilities:

1. **Balance sheet visualization** (assets, liabilities, net worth)
2. **Cash flow analytics** (filters, KPIs, monthly/category aggregation)
3. **FIRE simulation** (retirement timing and sustainability until age 100)

The app is designed for direct practical use, not just static reporting. It supports:

- Real API + auth flow
- Mock fallback when API is unavailable
- Copy-to-clipboard for analysis data and simulation outputs
- Privacy masking mode for sensitive amount values

---

### 1.3 Problems It Solves

- **Data inconsistency**: Input fields can include currency symbols, commas, or percent strings. Parsing/normalization layers standardize values.
- **Resilience**: If API fails, app automatically falls back to mock data.
- **Owner separation**: Holdings can be filtered by owner (self/spouse/daughter) through text-based owner detection rules.
- **Financial planning complexity**: FIRE module includes inflation, tax, pension timing, mortgage payoff, and post-FIRE expense settings.

---

## 2. System Architecture

### 2.1 Runtime Stack

- **Vue 3** (Composition API)
- **Vite** (build/dev tool)
- **Pinia** (state management)
- **Vue Router** (page routing)
- **Vitest + Vue Test Utils** (unit tests)

---

### 2.2 High-Level Layer Design

1. **UI/View Layer (`src/views`, `src/components`)**
   - Presents charts/tables/forms.
   - Handles user interactions and copy actions.

2. **State Layer (`src/stores`)**
   - `portfolio` store fetches + normalizes portfolio data.
   - `ui` store manages privacy mode persistence.

3. **Domain Layer (`src/domain`)**
   - Pure logic modules for parsing, formatting, aggregation, owner detection, and simulation.
   - Business rules are intentionally concentrated here.

4. **Composable Layer (`src/composables`)**
   - Reusable view orchestration (data loading, hash-restore behavior).

---

### 2.3 Route Map

- `/` -> redirect to `/balance-sheet`
- `/holdings` -> redirect to `/balance-sheet`
- `/balance-sheet` -> integrated asset/liability/holdings page
- `/cash-flow` -> transaction analytics page
- `/fire` -> FIRE simulation page

---

## 3. Data Contracts and Data Structures

## 3.1 External API Input (Raw)
The app expects JSON from a Google Apps Script endpoint. Main keys (raw format) include:

- `breakdown`: asset summary by category
- `breakdown-liability`: liability summary by category
- `total-liability`: total liabilities
- `details__portfolio_det_depo__t0`: cash-like holdings
- `details__portfolio_det_eq__t0`: stock holdings
- `details__portfolio_det_mf__t0`: fund holdings
- `details__portfolio_det_pns__t0`: pension holdings
- `details__portfolio_det_po__t0`: point holdings
- `details__liability_det__t0-liability`: detailed liabilities
- `mfcf`: cash flow rows

Special server-side auth error shape:

- `{ status: 401|403, error: "..." }`

---

### 3.2 Internal Normalized Model
After normalization, the store keeps one canonical structure:

```ts
interface Portfolio {
  totals: {
    assetsYen: number;
    liabilitiesYen: number;
    netWorthYen: number;
  };
  summary: {
    assetsByClass: Array<{ name: string; amountYen: number; percentage: number }>;
    liabilitiesByCategory: Array<{ category: string; amountYen: number; percentage: number }>;
  };
  holdings: {
    cashLike: any[];
    stocks: any[];
    funds: any[];
    pensions: any[];
    points: any[];
    liabilitiesDetail: any[];
  };
  cashFlow: Array<{
    date: string;
    amount: number;
    currency: string;
    name: string;
    category: string;
    isTransfer: boolean;
  }>;
}
```

---

### 3.3 Store State

`portfolio` store state:

- `data: Portfolio | null`
- `loading: boolean`
- `error: string`
- `source: "" | "live" | "mock"`
- `rawResponse: object | null`

`ui` store state:

- `privacyMode: boolean`

---

## 4. Detailed Functional Specification

## 4.1 App Shell + Authentication Gate

### Input

- Local storage values:
  - `asset-theme`
  - `asset-google-id-token`
  - `asset-privacy`
- Env variable:
  - `VITE_GOOGLE_CLIENT_ID`

### Behavior

1. On mount:
   - Reads theme and token from localStorage.
   - Loads Google Identity Services script (`https://accounts.google.com/gsi/client`).
   - Calls portfolio fetch if no current data and no current error.

2. Login gate visibility:
   - Shown when initial loading ended, token is missing, and live data is unavailable.

3. Google login button:
   - Renders only when script loaded + client id exists + gate visible.

4. Logout:
   - Removes token from localStorage.
   - Clears portfolio store state.
   - Triggers new fetch (which then may fall back to mock or show auth errors depending on API behavior).

### Exceptions / Edge Cases

- Missing client id -> login gate shows explicit configuration message.
- Google script load failure -> user-facing error shown.
- If auth error appears while token exists, app auto-logs out and retries cleanly.

---

## 4.2 Data Fetching (`portfolio` store)

### Input

- API endpoint constant
- Optional `id_token` query param from localStorage

### Output

- Live normalized data OR mock normalized data
- Error state for auth/CORS/network/HTTP

### Step-by-step Flow

1. Prevent duplicate fetch when `loading = true`.
2. Prevent repeated retries after terminal CORS-blocked state.
3. Build API URL. If id token exists, append `id_token` query param.
4. Fetch API.
5. If HTTP non-OK -> throw `HTTP <status>` error.
6. Parse JSON.
7. If payload contains auth status (401/403):
   - If error is `missing id token` but token exists: retry once.
   - If still missing token -> throw guided auth error message for GAS implementation.
   - Otherwise throw `AUTH <status>: <message>`.
8. On success:
   - Keep `rawResponse`
   - Normalize payload (`json.data ?? json`)
   - `source = "live"`

### Error Branches

1. **AUTH error**:
   - Keep `data = null`
   - `source = ""`
   - No mock fallback (explicit auth issue should be visible)

2. **CORS-style fetch error with token present**:
   - Keep `data = null`
   - `source = ""`
   - Set CORS guidance message
   - Block further auto-retries

3. **Other errors**:
   - Fallback to bundled `sampleApi.json`
   - Normalize mock
   - `source = "mock"`
   - Keep human-readable fallback message

---

## 4.3 Normalization Rules (`normalizePortfolio`)

### Main Rules

- Any missing list key becomes empty array.
- All amount-like fields are parsed with robust numeric parser.
- Percent strings like `"9.4%"` become `9.4`.
- Net worth = assets - liabilities.

### Pension special rule
If a pension row has no `評価損益` but has `現在価値` and `評価損益率`:

\[
profit = round( currentValue * rate / (100 + rate) )
\]

This is skipped when denominator is zero (`rate = -100`).

### Cash flow normalization
Each transaction row is converted to:

- safe string date (`""` if missing)
- numeric amount (0 if invalid)
- currency default `"JPY"`
- string name/category defaults
- boolean `isTransfer`

---

## 4.4 Balance Sheet Page

### Functions

1. Owner filter (`all`, `me`, `wife`, `daughter`) via query param.
2. Category cards with per-category totals and counts.
3. Balance sheet geometry (asset panel vs liability/net-worth split).
4. Stock/Fund summary:
   - total amount
   - total daily change
   - total profit
   - total profit rate
5. Treemap-like stock tiles.
6. Detailed holding tables by category.
7. Copy mapped raw asset JSON (excluding cash flow key).

### Input/Output

- Input: normalized `data.holdings` + query param `owner`
- Output: computed view data (cards, charts, tables, totals)

### Edge Cases

- Unknown owner query -> fallback `all`
- Empty holdings -> empty cards/tables/charts (no crash)
- Missing daily change field -> ignored in summary daily totals

---

## 4.5 Cash Flow Page

### Filters

- Month (`YYYY-MM`)
- Large category
- Small category (depends on selected large category)
- Text search (name + category)
- Include/exclude transfers

### Metrics and Aggregations

- KPI: income, expense, net, transfers
- Monthly aggregation (income/expense/net)
- Expense category pie (5-month average option excluding current month)
- Optional 6-month averages for monthly bars

### Copy Features

- Per-month `mfcf` JSON snippets
- Past-5-month summary JSON (for FIRE defaulting)

### Edge Cases

- Missing category -> treated as `未分類`
- Missing/invalid date -> excluded from month-based ops
- If filter active, monthly net aggregation behavior changes to avoid misleading global net line

---

## 4.6 FIRE Simulator Page

### 4.6.1 Inputs

User-adjustable parameters include:

- `monthlyInvestment`
- `annualReturnRate`
- `currentAge`
- `withdrawalRate`
- `includeInflation`, `inflationRate`
- `includeTax`, `taxRate`
- `includePension`
- `mortgageMonthlyPayment`
- `mortgagePayoffDate`
- `postFireExtraExpense`
- Regular income / bonus / expense (manual or auto from 5-month history)

### 4.6.2 Auto-derived values

- Initial assets / risk assets / cash assets from owner-scoped portfolio
- Past-5-month summary for expense/income/bonus defaults
- Mortgage payment estimate from category prefix `住宅/ローン返済`

### 4.6.3 Outputs

- Earliest FIRE month that survives to age 100
- FIRE age/date and required assets at FIRE point
- Monthly growth table for chart
- Annual simulation summary table
- Algorithm explanation segments for copy/export

### 4.6.4 Exception / Edge Behavior

- If no survivable month found in horizon -> "not achieved" style state
- `monthlyExpense` fallback from `monthlyExpenses / 12` for backward compatibility
- Month cap defaults to 1200
- Investment per month is capped by available cash (no forced negative cash through investing)
- Mortgage payoff month itself is still paid; drop starts from following month
- Income is forced to zero after FIRE month

---

## 5. Algorithm Details

## 5.1 Parsing Algorithms

### `toNumber`
1. If input is finite number -> return as-is.
2. If non-string -> return 0.
3. Remove yen symbols, commas, spaces, "円", and non-numeric punctuation except `+ - .`.
4. Convert with `Number(...)`.
5. If not finite -> 0.

Time: **O(n)** on string length.
Space: **O(n)** temporary normalized string.

### `toPercent`
Similar structure; removes `%` then number-converts.

---

## 5.2 Balance Layout Algorithm (`balanceSheetLayout`)

Input: assets/liabilities/net worth.

1. Clamp negative values to zero for layout stability.
2. Compute right side = liabilities + net worth.
3. If total is zero -> fallback fixed rectangle ratios.
4. Else compute proportional widths/heights.
5. Clamp widths/heights into `[20, 80]` when both counterpart values are non-zero to avoid very thin visual blocks.

Time: **O(1)**.
Space: **O(1)**.

---

## 5.3 Stock Treemap Algorithm (`layoutTreemap`)

This is a recursive binary split algorithm:

1. Sort entries by value descending before recursion.
2. At each recursion:
   - Compute total of segment.
   - Find split index where left sum is close to half.
3. Split along longer dimension:
   - If width >= height: vertical split
   - Else: horizontal split
4. Recurse for left and right sublists.
5. Base case: one item -> assign full rectangle.

Time: approximately **O(n log n)** average due recursive partitioning with per-level scans.
Space: **O(n)** output + recursion stack.

---

## 5.4 Owner Detection Algorithm

Owner is inferred from text suffix patterns inside any string field of a row:

- contains `@chipop` -> wife
- contains `@aojiru.pudding` -> daughter
- else -> me

Used by:

- owner-based holdings filter
- family summary
- FIRE owner isolation
- daughter asset exclusion/breakdown

Complexity per row: **O(k)** over merged text size.

---

## 5.5 Cash Flow Aggregation Algorithms

### `filterCashFlow`
Checks each row against active filters (month, category, transfer, text).

Time: **O(n)**.

### `aggregateByMonth`
Groups non-transfer rows by `YYYY-MM` key, sums income/expense/net.

Time: **O(n)**.
Space: **O(m)** for month map.

### `aggregateByCategory`
Groups negative non-transfer rows by category, optional averaging window.

Time: **O(n log n)** due final sorting.

---

## 5.6 FIRE Simulation Core Algorithm

### 5.6.1 Parameter normalization
`normalizeFireParams` converts all inputs to numbers/booleans, sets defaults, and applies backward compatibility for old field names.

### 5.6.2 Monthly simulation state
At each month, state includes:

- `currentCash`
- `currentRisk`
- derived total assets
- income / pension / expenses
- withdrawal and investment gain

### 5.6.3 Monthly transition (pre-FIRE)

1. Compute `netFlow = income + pension - expenses`.
2. Update cash by net flow.
3. If cash negative:
   - Cover shortfall from risk assets.
   - If tax enabled, gross-up sale amount.
4. If cash positive:
   - Invest up to `monthlyInvestment` but never more than available cash.
5. Apply risk return for this month.

### 5.6.4 Monthly transition (post-FIRE)

1. Income is set to zero (pension may remain).
2. Compute expense shortfall.
3. Compute withdrawal target by rule:
   - `max(expense shortfall, assets * withdrawalRate / 12)`
4. Take from cash first, then risk assets (gross-up when tax enabled).
5. Apply risk return.

### 5.6.5 Required assets backward loop
`calculateRequiredAssets` runs from end-of-life backward to present month:

- Includes inflation growth of expenses.
- Includes pension offset if enabled.
- Considers withdrawal floor and tax gross-up.
- Uses conservative max of two requirement formulas each month.

### 5.6.6 Finding earliest FIRE month

1. Coarse search by year (`m += 12`) to find first surviving year.
2. Binary refinement inside that year window to find earliest successful month.

This hybrid search greatly reduces computation versus full linear monthly scan.

### Complexity
Let `T = months until age 100`.

- One simulation run: **O(T)**.
- FIRE search: coarse `O(T/12)` + refinement `O(log 12)` runs, each run O(T), so practical upper bound roughly **O(T²/12)** in worst case with repeated full re-simulations.
- Memory: **O(T)** only when recording monthly table.

---

## 6. Exception Handling and Edge-Case Matrix

## 6.1 Parsing and Normalization

- Invalid numbers (`NaN`, `Infinity`, malformed text): safely become `0`.
- Missing arrays: become `[]`.
- Null API object: full-safe empty portfolio.
- Pension profit derivation skipped on impossible denominator.

## 6.2 Store / API

- Double fetch calls while loading: second call ignored.
- Auth failures: no mock fallback (intentional explicit auth handling).
- CORS-like network failure with token: terminal guidance state to avoid spam retries.
- Non-auth API failure: mock fallback for app continuity.

## 6.3 Cash Flow

- Missing date: excluded from date-window calculations.
- Missing category: treated as uncategorized string.
- Transfers optionally excluded from most analytics.

## 6.4 FIRE

- Negative total asset situations are clamped in charted asset representation via `Math.max(0, ...)` when read.
- Mortgage cutoff uses strict `>` compare on month key to keep payoff month payment included.
- If both cash and risk are insufficient, simulation still proceeds with zero-floor behavior; survival result reflects depletion.

---

## 7. Technology Choices and Rationale

### 7.1 Vue 3 + Composition API
Chosen for:

- Reactive computed modeling for finance dashboard state
- Easy separation between UI and domain logic
- Lightweight setup for single-page app

### 7.2 Pinia
Chosen for:

- Simple store syntax
- Test-friendly design
- Native fit for Vue 3 ecosystem

### 7.3 Vite
Chosen for:

- Fast local startup
- Simple static build output
- Good default DX for Vue projects

### 7.4 Vitest
Chosen for:

- Fast ESM-native test runner
- Compatible with Vite and Vue Test Utils
- Good branch-level domain testing support

### 7.5 Domain-First Functional Modules
Business logic is mostly in pure JS functions under `src/domain`.

Benefits:

- High testability
- Clear separation from UI rendering
- Easy to re-use for copy/export features

---

## 8. Setup, Configuration, and Deployment

## 8.1 Requirements

- Node.js (LTS recommended)
- npm (comes with Node.js)

---

## 8.2 Install

```bash
npm install
```

---

## 8.3 Run (Development)

```bash
npm run dev
```

Default Vite local URL is usually:

- `http://localhost:5173`

---

## 8.4 Build + Preview

```bash
npm run build
npm run preview
```

Build output goes to `dist/`.

---

## 8.5 Test

```bash
npm run test
```

Optional coverage:

```bash
npm run test:coverage
```

---

## 8.6 Environment Variables

Create `.env.local` if Google login UI is used:

```bash
VITE_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

If this is missing, app still runs, but login gate cannot render a valid Google sign-in button.

---

## 8.7 Browser Local Storage Keys

- `asset-theme`: `dark` or `light`
- `asset-privacy`: `on` or `off`
- `asset-google-id-token`: Google ID token string

---

## 8.8 Deployment Procedure (Static Hosting)

This app is a client-side SPA and can be deployed to any static hosting service.

### Standard steps

1. Set build-time env vars (for example `VITE_GOOGLE_CLIENT_ID`).
2. Run `npm ci` (or `npm install`).
3. Run `npm run build`.
4. Deploy `dist/` directory.
5. Configure SPA fallback routing so direct path access resolves to `index.html`.

### Examples of platforms

- Vercel
- Netlify
- GitHub Pages (with SPA route fallback handling)
- Nginx static host

---

## 8.9 API / CORS Notes for Production

Because browser directly calls Google Apps Script URL:

- GAS must return proper CORS headers.
- API must accept `id_token` as query parameter (`e.parameter.id_token`) per app expectation.

If not configured correctly, app shows dedicated guidance for CORS/auth issues.

---

## 9. Module-by-Module Technical Reference

- `src/domain/parse.js`: robust number/percent parsing
- `src/domain/format.js`: currency formatting, sign formatting helpers
- `src/domain/normalize.js`: canonical portfolio normalization
- `src/domain/dashboard.js`: balance-sheet rectangle ratio logic
- `src/domain/holdings.js`: holdings table configs, stock/fund summary, treemap tile generation
- `src/domain/assetOwners.js`: owner filter logic and category summarization
- `src/domain/family.js`: owner detection, family aggregation, age calculation
- `src/domain/cashFlow.js`: filtering/sorting/aggregation helpers
- `src/domain/fire.js`: FIRE simulation engine and supporting estimation utilities
- `src/stores/portfolio.js`: fetch/auth/fallback state machine
- `src/stores/ui.js`: privacy mode persistence and HTML attribute sync
- `src/composables/usePortfolioData.js`: view-level store access helper
- `src/composables/useInitialHashRestore.js`: hash restore after async data readiness

---

## 10. Test Coverage Summary (Conceptual)

The existing test suite validates:

- Parser robustness for malformed values
- Portfolio normalization fallbacks and pension derivation
- Dashboard geometry clamping behavior
- Holdings summary and tile generation paths
- Owner filtering and family aggregation
- Cash flow filtering/aggregation edge cases
- FIRE logic under pension/tax/inflation/mortgage/withdrawal conditions
- Portfolio store retry/auth/CORS/mock fallback behavior
- UI privacy mode persistence behavior

This gives strong confidence that business logic behavior is intentional and stable across edge cases.

---

## 11. Known Constraints and Assumptions

1. Owner detection is rule-based using string suffix matching, so it depends on naming consistency in source data.
2. FIRE simulation is deterministic by default (constant monthly return unless custom returns array provided).
3. Pension model is a practical approximation with fixed constants and specific household assumptions.
4. App expects Japanese category naming conventions in several places (for example pension/mortgage/income category prefixes).

---

## 12. Quick Start for New Engineers

1. Run app (`npm install && npm run dev`).
2. Read `src/stores/portfolio.js` to understand external data lifecycle.
3. Read `src/domain/normalize.js` for canonical data shape.
4. Read `src/domain/fire.js` for simulation model and assumptions.
5. Read tests (`src/domain/*.test.js`) to understand edge-case contracts.

If you understand those files, you can safely extend most features without surprises.
