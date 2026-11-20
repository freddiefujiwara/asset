import { describe, expect, it } from "vitest";
import {
  formatShareExpiry,
  formatShareRemaining,
  parseShareToken,
  shareSecondsLeft,
} from "./share";
import { normalizePortfolio } from "./normalize";
import { assetDisplayName } from "./family";
import { holdingRowKey } from "./format";
import { buildRegionAllocation, classifyRegion } from "./region";
import { buildAssetSegments, findLargestHolding } from "./assetSummary";
import {
  aggregateByCategory,
  aggregateByMonth,
  aggregateByType,
  getKPIs,
  getRecentAverages,
} from "./cashFlow/aggregates";
import { getMonthKey } from "./cashFlow/shared";

// A value JSON can carry whose toString is not callable: String(),
// template interpolation, Date.parse and new Date() all throw on it.
const UNSTRINGIFIABLE = { toString: [] };

describe("parseShareToken with malformed fragments", () => {
  it("treats an undecodable share token as no token", () => {
    expect(parseShareToken("#share=%E0%A4%A")).toBe("");
    expect(parseShareToken("#share=100%")).toBe("");
    expect(parseShareToken("#share=%")).toBe("");
    expect(parseShareToken("#foo=1&share=%zz&bar=2")).toBe("");
  });

  it("still extracts a well-formed token next to a malformed sibling", () => {
    expect(parseShareToken("#share=abc123")).toBe("abc123");
  });
});

describe("share expiry helpers with deformed values", () => {
  it("shareSecondsLeft returns null for an unstringifiable expiry", () => {
    expect(shareSecondsLeft(UNSTRINGIFIABLE, 0)).toBeNull();
  });

  it("formatShareExpiry returns an empty label for an unstringifiable expiry", () => {
    expect(formatShareExpiry(UNSTRINGIFIABLE)).toBe("");
  });

  it("formatShareExpiry still accepts a millisecond timestamp", () => {
    const ms = new Date(2026, 11, 2, 7, 53).getTime();
    expect(formatShareExpiry(ms)).toBe("20261202 07:53");
  });

  it("formatShareRemaining never prints NaN or Infinity", () => {
    expect(formatShareRemaining(NaN)).toBe("");
    expect(formatShareRemaining(Infinity)).toBe("");
    // -Infinity is already past expiry, so it keeps the expired label.
    expect(formatShareRemaining(-Infinity)).toBe("期限切れ");
  });
});

describe("normalizePortfolio with deformed payloads", () => {
  it("drops a snapshot row whose month cannot be stringified instead of throwing", () => {
    const result = normalizePortfolio({
      snapshots: [
        { month: UNSTRINGIFIABLE, total_assets: "100" },
        { month: "2026-01", total_assets: "200" },
      ],
    });
    expect(result.snapshots).toEqual([
      expect.objectContaining({ month: "2026-01", totalAssetsYen: 200 }),
    ]);
  });

  it("reads an unstringifiable cash-flow name as empty text", () => {
    const result = normalizePortfolio({
      mfcf: [
        { date: "2026-01-01", amount: "500", name: UNSTRINGIFIABLE, category: "食費" },
      ],
    });
    expect(result.cashFlow).toHaveLength(1);
    expect(result.cashFlow[0].name).toBe("");
    expect(result.cashFlow[0].amount).toBe(500);
  });

  it("reads an unstringifiable breakdown category as an empty name", () => {
    const result = normalizePortfolio({
      breakdown: [{ category: UNSTRINGIFIABLE, amount_yen: "10" }],
      "breakdown-liability": [{ category: UNSTRINGIFIABLE, amount_yen: "3" }],
    });
    expect(result.summary.assetsByClass[0].name).toBe("");
    expect(result.summary.assetsByClass[0].amountYen).toBe(10);
    expect(result.summary.liabilitiesByCategory[0].category).toBe("");
  });

  it("reads an unstringifiable region-weight date as empty text", () => {
    const result = normalizePortfolio({
      weights: { acwi: { japan: "5", effective_date: UNSTRINGIFIABLE } },
    });
    expect(result.weights.acwi.effectiveDate).toBe("");
    expect(result.weights.acwi.japan).toBe(5);
  });

  it("drops non-object cash-flow entries instead of inventing ghost rows", () => {
    const result = normalizePortfolio({
      mfcf: [
        null,
        42,
        "x",
        ["not", "a", "row"],
        { date: "2026-01-01", amount: "700", name: "Shop", category: "食費" },
      ],
    });
    expect(result.cashFlow).toHaveLength(1);
    expect(result.cashFlow[0].name).toBe("Shop");
    expect(result.cashFlow[0].amount).toBe(700);
  });
});

describe("raw holding rows with deformed name fields", () => {
  it("assetDisplayName always returns a string", () => {
    expect(assetDisplayName({ "名称・説明": UNSTRINGIFIABLE })).toBe("-");
    expect(assetDisplayName({ "名称・説明": 42 })).toBe("42");
    expect(assetDisplayName({ "名称": true })).toBe("true");
    expect(assetDisplayName({ "名称・説明": UNSTRINGIFIABLE, "名称": "予備名" })).toBe("予備名");
  });

  it("classifyRegion treats an unstringifiable name as unclassified text", () => {
    expect(() => classifyRegion(UNSTRINGIFIABLE, "funds")).not.toThrow();
    expect(classifyRegion(UNSTRINGIFIABLE, "funds")).toBeNull();
  });

  it("buildRegionAllocation survives a holding whose name cannot be stringified", () => {
    const result = buildRegionAllocation(
      { funds: [{ "名称・説明": UNSTRINGIFIABLE, "評価額": "1000" }] },
      null,
    );
    expect(result.totalYen).toBe(1000);
    expect(result.unclassified).toHaveLength(1);
    expect(result.unclassified[0].name).toBe("-");
  });

  it("holdingRowKey never throws on deformed name fields", () => {
    expect(holdingRowKey({ "名称・説明": UNSTRINGIFIABLE })).toBe("__");
    expect(holdingRowKey({ "保有金融機関": UNSTRINGIFIABLE, "名称": "x" })).toBe("__x");
  });
});

describe("buildAssetSegments with deformed view-model values", () => {
  it("does not turn a boolean total into a real reading", () => {
    const segments = buildAssetSegments({ totalAssetsYen: true, categoryCards: [] });
    expect(segments.totalAssetsYen).toBe(0);
  });

  it("does not turn an array card amount into a real reading", () => {
    const segments = buildAssetSegments({
      totalAssetsYen: 100,
      categoryCards: [{ key: "pensions", amountYen: [65] }],
    });
    expect(segments.ageLockedYen).toBe(0);
    expect(segments.usableBefore60Yen).toBe(100);
  });

  it("never leaks NaN from a non-numeric total", () => {
    const segments = buildAssetSegments({ totalAssetsYen: "abc", categoryCards: [] });
    expect(segments.totalAssetsYen).toBe(0);
    expect(Number.isFinite(segments.fireTargetAssetsYen)).toBe(true);
    expect(Number.isFinite(segments.usableBefore60Yen)).toBe(true);
  });

  it("ignores nullish entries inside categoryCards", () => {
    const segments = buildAssetSegments({
      totalAssetsYen: 100,
      categoryCards: [null, undefined, { key: "pensions", amountYen: 30 }],
    });
    expect(segments.ageLockedYen).toBe(30);
  });

  it("findLargestHolding reads a non-numeric risk total as zero", () => {
    const largest = findLargestHolding(
      { stocks: [{ "名称": "x", "評価額": "10" }] },
      "abc",
    );
    expect(largest.riskAssetsTotalYen).toBe(0);
    expect(largest.ratioOfRiskAssetsPct).toBeNull();
  });
});

describe("cash flow aggregates with deformed inputs", () => {
  it("getKPIs reads a non-array as all zeros", () => {
    expect(getKPIs(null)).toEqual({ income: 0, expense: 0, net: 0, transfers: 0 });
    expect(getKPIs(undefined)).toEqual({ income: 0, expense: 0, net: 0, transfers: 0 });
  });

  it("monthly/category/type aggregates read a non-array as empty", () => {
    expect(aggregateByMonth(null)).toEqual([]);
    expect(aggregateByCategory(null)).toEqual([]);
    expect(aggregateByType(null)).toEqual([]);
    expect(getRecentAverages(null).count).toBe(0);
  });

  it("getMonthKey only reads string dates", () => {
    expect(getMonthKey(null)).toBe("");
    expect(getMonthKey({})).toBe("");
    expect(getMonthKey({ date: 20260101 })).toBe("");
    expect(getMonthKey({ date: "2026-01-15" })).toBe("2026-01");
  });

  it("skips a row whose date is not a string instead of throwing", () => {
    const rows = [
      { date: 20260101, amount: -100, isTransfer: false, category: "食費" },
      { date: "2026-01-15", amount: -300, isTransfer: false, category: "食費" },
    ];
    expect(aggregateByMonth(rows)).toEqual([
      expect.objectContaining({ month: "2026-01", expense: 300 }),
    ]);
  });
});
