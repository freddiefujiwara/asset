import { describe, it, expect } from "vitest";
import {
  buildAssetSegments,
  buildBalanceMonthlyChanges,
  findLargestHolding,
} from "./assetSummary";

describe("buildAssetSegments", () => {
  const categoryCards = [
    { key: "cashLike", amountYen: 7000000 },
    { key: "stocks", amountYen: 17000000 },
    { key: "funds", amountYen: 49000000 },
    { key: "pensions", amountYen: 3500000 },
    { key: "points", amountYen: 1500000 },
  ];

  it("builds the three segments with the shared university fund setting", () => {
    const segments = buildAssetSegments({ totalAssetsYen: 78000000, categoryCards });
    expect(segments.totalAssetsYen).toBe(78000000);
    expect(segments.universityFundYen).toBe(10450000);
    expect(segments.fireTargetAssetsYen).toBe(67550000);
    expect(segments.ageLockedYen).toBe(3500000);
    expect(segments.usableBefore60Yen).toBe(74500000);
  });

  it("respects a custom university fund and tolerates missing categories", () => {
    const segments = buildAssetSegments({
      totalAssetsYen: 1000000,
      categoryCards: [],
      universityFundYen: 300000,
    });
    expect(segments.fireTargetAssetsYen).toBe(700000);
    expect(segments.ageLockedYen).toBe(0);
    expect(segments.usableBefore60Yen).toBe(1000000);
  });
});

describe("findLargestHolding", () => {
  const holdings = {
    stocks: [{ "銘柄名": "楽天グループ", "評価額": "5000000", "評価損益": "-500000" }],
    funds: [{ "銘柄名": "eMAXIS Slim 全世界株式", "評価額": "20000000", "評価損益": "3000000" }],
    pensions: [{ "名称": "iDeCo", "現在価値": "3000000", "評価損益": "100000" }],
  };

  it("picks the largest holding across risk categories with ratio of risk assets", () => {
    const largest = findLargestHolding(holdings, 28000000);
    expect(largest.name).toBe("eMAXIS Slim 全世界株式");
    expect(largest.categoryTitle).toBe("投資信託");
    expect(largest.amountYen).toBe(20000000);
    expect(largest.profitYen).toBe(3000000);
    expect(largest.ratioOfRiskAssetsPct).toBeCloseTo(71.43, 2);
  });

  it("returns null when there are no risk holdings", () => {
    expect(findLargestHolding({ stocks: [], funds: [], pensions: [] }, 0)).toBeNull();
    expect(findLargestHolding(null, 0)).toBeNull();
  });
});

describe("buildBalanceMonthlyChanges", () => {
  it("is unavailable until two snapshots exist", () => {
    expect(buildBalanceMonthlyChanges([]).available).toBe(false);
    const one = buildBalanceMonthlyChanges([
      { month: "2026-10", totalAssetsYen: 78000000, netAssetsYen: 66000000 },
    ]);
    expect(one.available).toBe(false);
  });

  it("diffs total and net assets between the last two snapshots", () => {
    const changes = buildBalanceMonthlyChanges([
      { month: "2026-09", totalAssetsYen: 77000000, netAssetsYen: 65000000 },
      { month: "2026-10", totalAssetsYen: 78000000, netAssetsYen: 66500000 },
    ]);
    expect(changes.available).toBe(true);
    expect(changes.month).toBe("2026-10");
    expect(changes.previousMonth).toBe("2026-09");
    expect(changes.rows).toEqual([
      { key: "totalAssets", label: "総資産", currentYen: 78000000, previousYen: 77000000, diffYen: 1000000 },
      { key: "netAssets", label: "純資産", currentYen: 66500000, previousYen: 65000000, diffYen: 1500000 },
    ]);
  });
});
