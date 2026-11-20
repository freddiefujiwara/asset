import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { toNumber, toPercent } from "./parse";
import { normalizePortfolio } from "./normalize";
import {
  buildShareUrl,
  formatShareExpiry,
  formatShareRemaining,
  parseShareToken,
  shareSecondsLeft,
} from "./share";
import { formatSignedYen, formatYen } from "./format";
import { buildRegionAllocation } from "./region";
import { buildAssetSegments } from "./assetSummary";
import { aggregateByMonth, getKPIs } from "./cashFlow/aggregates";

// A value JSON can carry whose toString is not callable. Several layers
// (String(), Date.parse, template interpolation) throw on it, so it is a
// legitimate member of the deformed-input domain.
const UNSTRINGIFIABLE = { toString: [] };

const deformedValue = fc.oneof(
  fc.jsonValue(),
  fc.constant(UNSTRINGIFIABLE),
  fc.constant(null),
);

describe("parse layer properties", () => {
  it("toNumber always returns a finite number and never throws", () => {
    fc.assert(
      fc.property(deformedValue, (value) => {
        const result = toNumber(value);
        expect(Number.isFinite(result)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("toNumber is idempotent", () => {
    fc.assert(
      fc.property(deformedValue, (value) => {
        expect(toNumber(toNumber(value))).toBe(toNumber(value));
      }),
      { numRuns: 100 },
    );
  });

  it("toPercent always returns a finite number and never throws", () => {
    fc.assert(
      fc.property(deformedValue, (value) => {
        expect(Number.isFinite(toPercent(value))).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

describe("share helper properties", () => {
  it("parseShareToken never throws on arbitrary fragments", () => {
    // Alphabet biased toward fragment syntax and broken percent escapes.
    const fragmentChar = fc.constantFrom(
      ..."abcXYZ019%&=#_- .".split(""),
      "%E0%A4%A",
      "%zz",
      "share=",
    );
    fc.assert(
      fc.property(fc.array(fragmentChar, { maxLength: 24 }).map((cs) => cs.join("")), (hash) => {
        expect(typeof parseShareToken(hash)).toBe("string");
      }),
      { numRuns: 100 },
    );
  });

  it("buildShareUrl and parseShareToken round-trip a token", () => {
    fc.assert(
      // unit: "grapheme" keeps the string free of lone surrogates, which
      // encodeURIComponent itself rejects — such a token cannot exist in
      // a real URL (same narrowing as the earlier repos in this wave).
      fc.property(fc.string({ unit: "grapheme" }), (token) => {
        const url = buildShareUrl("https://example.com/asset/", token);
        expect(parseShareToken(url.slice("https://example.com/asset/".length))).toBe(token);
      }),
      { numRuns: 100 },
    );
  });

  it("shareSecondsLeft returns null or a non-negative integer for any expiry value", () => {
    fc.assert(
      fc.property(deformedValue, fc.integer(), (expiresAt, nowMs) => {
        const result = shareSecondsLeft(expiresAt, nowMs);
        expect(result === null || (Number.isInteger(result) && result >= 0)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("formatShareExpiry always returns a string", () => {
    fc.assert(
      fc.property(deformedValue, (expiresAt) => {
        expect(typeof formatShareExpiry(expiresAt)).toBe("string");
      }),
      { numRuns: 100 },
    );
  });

  it("formatShareRemaining never prints NaN or Infinity", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.double(), fc.constant(null)),
        (seconds) => {
          const label = formatShareRemaining(seconds);
          expect(label).not.toContain("NaN");
          expect(label).not.toContain("Infinity");
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("normalizePortfolio properties", () => {
  const payload = fc.record(
    {
      breakdown: fc.array(fc.record({ category: deformedValue, amount_yen: deformedValue, percentage: deformedValue }), { maxLength: 6 }),
      "breakdown-liability": fc.array(fc.record({ category: deformedValue, amount_yen: deformedValue }), { maxLength: 4 }),
      mfcf: fc.array(
        fc.oneof(
          fc.record({ date: deformedValue, amount: deformedValue, name: deformedValue, category: deformedValue, currency: deformedValue, is_transfer: deformedValue }),
          deformedValue,
        ),
        { maxLength: 8 },
      ),
      snapshots: fc.array(fc.record({ month: deformedValue, total_assets: deformedValue, net_assets: deformedValue }), { maxLength: 6 }),
    },
    { requiredKeys: [] },
  );

  it("never throws and keeps totals consistent for deformed payloads", () => {
    fc.assert(
      fc.property(payload, (api) => {
        const result = normalizePortfolio(api);
        const { totals, summary, cashFlow, snapshots } = result;
        expect(Number.isFinite(totals.assetsYen)).toBe(true);
        expect(Number.isFinite(totals.liabilitiesYen)).toBe(true);
        expect(Number.isFinite(totals.netWorthYen)).toBe(true);
        const classSum = summary.assetsByClass.reduce((sum, item) => sum + item.amountYen, 0);
        expect(totals.assetsYen).toBe(classSum);
        expect(totals.netWorthYen).toBe(totals.assetsYen - totals.liabilitiesYen);
        for (const item of summary.assetsByClass) {
          expect(typeof item.name).toBe("string");
          expect(Number.isFinite(item.amountYen)).toBe(true);
        }
        for (const row of cashFlow) {
          expect(typeof row.date).toBe("string");
          expect(typeof row.name).toBe("string");
          expect(typeof row.category).toBe("string");
          expect(Number.isFinite(row.amount)).toBe(true);
        }
        for (let i = 0; i < snapshots.length; i++) {
          expect(snapshots[i].month).toMatch(/^\d{4}-\d{2}$/);
          if (i > 0) {
            expect(snapshots[i - 1].month <= snapshots[i].month).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe("format properties", () => {
  it("yen formatters never leak NaN, undefined or Infinity", () => {
    fc.assert(
      fc.property(deformedValue, (value) => {
        for (const label of [formatYen(value), formatSignedYen(value)]) {
          expect(label).not.toContain("NaN");
          expect(label).not.toContain("undefined");
          expect(label).not.toContain("Infinity");
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe("buildRegionAllocation properties", () => {
  const holdingRow = fc.record({
    name: fc.oneof(
      fc.constantFrom(
        "eMAXIS Slim 全世界株式（オール・カントリー）",
        "eMAXIS Slim 全世界株式（除く日本）",
        "eMAXIS Slim 新興国株式インデックス",
        "S&P500インデックス",
        "日本株式インデックス",
        "謎のファンド",
      ),
      fc.constant(UNSTRINGIFIABLE),
    ),
    amount: fc.integer({ min: 1, max: 100000000 }),
  });

  it("conserves the total across buckets for fallback weights", () => {
    fc.assert(
      fc.property(fc.array(holdingRow, { maxLength: 8 }), (rows) => {
        const holdings = {
          funds: rows.map((row) => ({ "名称・説明": row.name, "評価額": String(row.amount) })),
        };
        const result = buildRegionAllocation(holdings, null);
        const bucketSum = result.buckets.reduce((sum, bucket) => sum + bucket.amountYen, 0);
        // Each bucket is rounded to whole yen, so the rounded sum can
        // drift from the exact total by at most half a yen per bucket.
        expect(Math.abs(bucketSum - result.totalYen)).toBeLessThanOrEqual(3);
        const ratioSum = result.buckets.reduce((sum, bucket) => sum + bucket.ratioPct, 0);
        if (result.totalYen > 0) {
          expect(Math.abs(ratioSum - 100)).toBeLessThan(0.01);
        }
        for (const bucket of result.buckets) {
          expect(Number.isFinite(bucket.ratioPct)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe("cash flow aggregate properties", () => {
  const cashRow = fc.record({
    date: fc
      .tuple(
        fc.integer({ min: 2025, max: 2026 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
      )
      .map(
        ([y, m, d]) =>
          `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      ),
    amount: fc.integer({ min: -200000, max: 500000 }),
    isTransfer: fc.boolean(),
    category: fc.constantFrom("食費", "住居費", "特別な支出>>家電", "カード>>引落", "その他"),
  });

  it("monthly buckets conserve the expense total and match the KPIs", () => {
    fc.assert(
      fc.property(fc.array(cashRow, { maxLength: 20 }), (rows) => {
        const kpis = getKPIs(rows);
        expect(kpis.net).toBe(kpis.income + kpis.expense);
        const months = aggregateByMonth(rows);
        let income = 0;
        let expense = 0;
        for (const month of months) {
          // Documented invariant in aggregateByMonth: the four expense
          // buckets always add back up to the month's expense.
          expect(month.fixed + month.variable + month.special + month.exclude).toBe(month.expense);
          income += month.income;
          expense += month.expense;
        }
        expect(income).toBe(kpis.income);
        // Sum form: -kpis.expense is -0 for an all-zero history, and
        // toBe (Object.is) distinguishes -0 from 0.
        expect(expense + kpis.expense).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});

describe("buildAssetSegments properties", () => {
  it("always returns finite yen figures for deformed inputs", () => {
    fc.assert(
      fc.property(
        deformedValue,
        fc.array(
          fc.oneof(
            fc.record({ key: fc.constantFrom("pensions", "stocks"), amountYen: deformedValue }),
            fc.constant(null),
          ),
          { maxLength: 5 },
        ),
        (totalAssetsYen, categoryCards) => {
          const segments = buildAssetSegments({ totalAssetsYen, categoryCards });
          for (const key of ["totalAssetsYen", "fireTargetAssetsYen", "ageLockedYen", "usableBefore60Yen"]) {
            expect(Number.isFinite(segments[key])).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
