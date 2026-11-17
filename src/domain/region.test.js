import { describe, expect, it } from "vitest";
import {
  FALLBACK_REGION_WEIGHTS,
  buildRegionAllocation,
  classifyRegion,
} from "./region";

describe("classifyRegion", () => {
  it("classifies yen cash and deposits as Japan", () => {
    expect(classifyRegion("普通預金", "cashLike")).toEqual({ kind: "fixed", bucket: "japan" });
  });

  it("classifies foreign-currency deposits as US", () => {
    expect(classifyRegion("米ドル普通預金", "cashLike")).toEqual({ kind: "fixed", bucket: "us" });
    expect(classifyRegion("外貨預金（USD）", "cashLike")).toEqual({ kind: "fixed", bucket: "us" });
  });

  it("classifies points as Japan", () => {
    expect(classifyRegion("楽天ポイント", "points")).toEqual({ kind: "fixed", bucket: "japan" });
  });

  it("classifies emerging-market funds to the emerging weight set", () => {
    expect(classifyRegion("eMAXIS Slim 新興国株式インデックス", "funds")).toEqual({ kind: "weighted", set: "emerging" });
    expect(classifyRegion("エマージング株式ファンド", "funds")).toEqual({ kind: "weighted", set: "emerging" });
  });

  it("classifies all-country funds to the acwi weight set", () => {
    expect(classifyRegion("楽天・プラス・オールカントリー株式インデックス・ファンド", "funds")).toEqual({ kind: "weighted", set: "acwi" });
    expect(classifyRegion("eMAXIS Slim 全世界株式（オール・カントリー）", "funds")).toEqual({ kind: "weighted", set: "acwi" });
    expect(classifyRegion("楽天・全世界株式インデックス・ファンド", "pensions")).toEqual({ kind: "weighted", set: "acwi" });
  });

  it("classifies developed-market funds to the developed weight set", () => {
    expect(classifyRegion("eMAXIS Slim 先進国株式インデックス", "funds")).toEqual({ kind: "weighted", set: "developed" });
    expect(classifyRegion("たわらノーロード 先進国株式", "pensions")).toEqual({ kind: "weighted", set: "developed" });
  });

  it("classifies US funds as US", () => {
    expect(classifyRegion("eMAXIS Slim 米国株式（S&P500）", "funds")).toEqual({ kind: "fixed", bucket: "us" });
    expect(classifyRegion("楽天・全米株式インデックス・ファンド", "funds")).toEqual({ kind: "fixed", bucket: "us" });
    expect(classifyRegion("NASDAQ100ファンド", "funds")).toEqual({ kind: "fixed", bucket: "us" });
  });

  it("classifies Japanese equity funds and stocks as Japan", () => {
    expect(classifyRegion("eMAXIS Slim 国内株式（TOPIX）", "funds")).toEqual({ kind: "fixed", bucket: "japan" });
    expect(classifyRegion("ニッセイ日経225インデックス", "funds")).toEqual({ kind: "fixed", bucket: "japan" });
    expect(classifyRegion("楽天グループ", "stocks")).toEqual({ kind: "fixed", bucket: "japan" });
  });

  it("classifies crypto as other", () => {
    expect(classifyRegion("ビットコイン", "stocks")).toEqual({ kind: "fixed", bucket: "other" });
  });

  it("leaves unmatched funds and pensions unclassified", () => {
    expect(classifyRegion("eMAXIS Slim バランス（8資産均等型）", "funds")).toBeNull();
    expect(classifyRegion("先進国債券インデックス", "funds")).toBeNull();
    expect(classifyRegion("安定型バランス", "pensions")).toBeNull();
    expect(classifyRegion(null, "funds")).toBeNull();
  });
});

describe("buildRegionAllocation", () => {
  const bucketOf = (allocation, key) => allocation.buckets.find((bucket) => bucket.key === key);

  it("allocates fixed and weighted holdings with the fallback weights", () => {
    const allocation = buildRegionAllocation(
      {
        cashLike: [{ "種類・名称": "普通預金", "残高": "1,000,000" }],
        stocks: [{ "銘柄名": "楽天グループ", "評価額": "500,000" }],
        funds: [
          { "銘柄名": "eMAXIS Slim 米国株式（S&P500）", "評価額": "2,000,000" },
          { "銘柄名": "楽天・プラス・オールカントリー株式インデックス・ファンド", "評価額": "1,000,000" },
        ],
        pensions: [],
        points: [{ "名称": "楽天ポイント", "現在の価値": "100,000" }],
      },
      null,
    );

    expect(allocation.totalYen).toBe(4600000);
    // 日本 = 現金100万 + 楽天株50万 + ポイント10万 + オルカン按分 5.08%
    expect(bucketOf(allocation, "japan").amountYen).toBe(1650800);
    // 米国 = S&P500 200万 + オルカン按分 64.63%
    expect(bucketOf(allocation, "us").amountYen).toBe(2646300);
    expect(bucketOf(allocation, "emerging").amountYen).toBe(111900);
    expect(bucketOf(allocation, "other").amountYen).toBe(0);
    expect(allocation.unclassified).toEqual([]);
    expect(allocation.effectiveDate).toBe("2026-10-30");
    expect(bucketOf(allocation, "japan").ratioPct).toBeCloseTo((1650800 / 4600000) * 100, 5);
  });

  it("uses API weights when provided and reports the latest effective date", () => {
    const weights = {
      acwi: { japan: 10, us: 50, developed_other: 20, emerging: 20, other: 0, effectiveDate: "2026-11-02" },
      developed: { japan: 0, us: 80, developed_other: 20, emerging: 0, other: 0, effectiveDate: "2026-11-02" },
    };
    const allocation = buildRegionAllocation(
      {
        funds: [
          { "銘柄名": "オールカントリー株式", "評価額": "1000000" },
          { "銘柄名": "先進国株式インデックス", "評価額": "1000000" },
        ],
      },
      weights,
    );

    expect(bucketOf(allocation, "us").amountYen).toBe(1300000);
    expect(bucketOf(allocation, "japan").amountYen).toBe(100000);
    expect(allocation.effectiveDate).toBe("2026-11-02");
  });

  it("falls back per-set when the API provides only some sets or a malformed set", () => {
    const allocation = buildRegionAllocation(
      { funds: [{ "銘柄名": "オールカントリー株式", "評価額": "1000000" }] },
      { acwi: "not-an-object", developed: { us: 100 } },
    );
    // acwi は文字列なのでフォールバック値で按分される
    expect(bucketOf(allocation, "us").amountYen).toBe(646300);
    expect(allocation.effectiveDate).toBe(FALLBACK_REGION_WEIGHTS.acwi.effectiveDate);
  });

  it("uses the fallback effective date when an API set has none", () => {
    const allocation = buildRegionAllocation(
      { funds: [{ "銘柄名": "オールカントリー株式", "評価額": "1000000" }] },
      { acwi: { japan: 0, us: 100, developed_other: 0, emerging: 0, other: 0 } },
    );
    expect(bucketOf(allocation, "us").amountYen).toBe(1000000);
    expect(allocation.effectiveDate).toBe("2026-10-30");
  });

  it("collects unclassified holdings into other with a sorted detail list", () => {
    const allocation = buildRegionAllocation(
      {
        funds: [
          { "銘柄名": "バランスファンドA", "評価額": "300000" },
          { "銘柄名": "バランスファンドB", "評価額": "700000" },
        ],
        pensions: [{ "名称": "安定型バランス", "現在価値": "100000" }],
      },
      null,
    );

    expect(bucketOf(allocation, "other").amountYen).toBe(1100000);
    expect(allocation.unclassified.map((item) => item.name)).toEqual([
      "バランスファンドB",
      "バランスファンドA",
      "安定型バランス",
    ]);
    expect(allocation.effectiveDate).toBe("");
  });

  it("skips zero and negative amounts and tolerates malformed holdings", () => {
    const allocation = buildRegionAllocation(
      {
        cashLike: [{ "種類・名称": "普通預金", "残高": "0" }],
        funds: "not-an-array",
        stocks: [{ "銘柄名": "テスト株", "評価額": "-100" }],
      },
      null,
    );

    expect(allocation.totalYen).toBe(0);
    expect(allocation.buckets.every((bucket) => bucket.amountYen === 0 && bucket.ratioPct === 0)).toBe(true);
    expect(allocation.unclassified).toEqual([]);
  });

  it("tolerates missing holdings entirely", () => {
    const allocation = buildRegionAllocation(undefined, undefined);
    expect(allocation.totalYen).toBe(0);
    expect(allocation.buckets).toHaveLength(5);
  });
});
