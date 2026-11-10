import { describe, expect, it } from "vitest";
import {
  PROGRESS_MILESTONES,
  SIDE_FIRE_ANNUAL_INCOME_YEN,
  UNIVERSITY_FUND_YEN,
  ageAtSnapshotMonth,
  buildFireProgress,
  buildProgressTrend,
  buildProjectionTrend,
  computeFireTargetAssetsYen,
} from "./progress";

// サイドFIREにも完全FIREにもまだ届いていない水準のフィクスチャ
const portfolio = {
  totals: { assetsYen: 40000000, liabilitiesYen: 11510887, netWorthYen: 28489113 },
  holdings: {
    cashLike: [{ "名称": "銀行預金", "残高": 5000000 }],
    stocks: [{ "名称": "株式A", "評価額": 2000000 }],
    funds: [{ "名称": "投信A", "評価額": 25000000 }],
    pensions: [{ "名称": "確定拠出年金", "現在価値": 1000000 }],
    points: [],
    liabilitiesDetail: [],
  },
};

// FIRE計算画面の既定値と同じ前提（2026-11-10時点の実数ベース）
const baseParams = {
  annualReturnRate: 0.05,
  monthlyExpense: 483688,
  monthlyIncome: 1071000,
  currentAge: 47,
  includeInflation: true,
  inflationRate: 0.02,
  includeTax: true,
  taxRate: 0.20315,
  withdrawalRate: 0.04,
  mortgageMonthlyPayment: 61089,
  mortgagePayoffDate: "2042-05",
  postFireExtraExpense: 60000,
  postFireFirstYearExtraExpense: 1930000,
  retirementLumpSumAtFire: 5000000,
  includePension: true,
  monthlyInvestment: 423000,
  expenseBreakdown: null,
};

describe("computeFireTargetAssetsYen", () => {
  it("subtracts the university fund from total assets", () => {
    expect(computeFireTargetAssetsYen(portfolio)).toBe(40000000 - UNIVERSITY_FUND_YEN);
    expect(UNIVERSITY_FUND_YEN).toBe(10450000);
  });

  it("never goes negative and tolerates missing portfolio", () => {
    expect(computeFireTargetAssetsYen({ totals: { assetsYen: 100 } })).toBe(0);
    expect(computeFireTargetAssetsYen(null)).toBe(0);
  });
});

describe("buildFireProgress", () => {
  const progress = buildFireProgress({ portfolio, baseParams });

  it("exposes the target assets and side FIRE assumptions", () => {
    expect(progress.totalAssetsYen).toBe(40000000);
    expect(progress.fireTargetAssetsYen).toBe(29550000);
    expect(progress.sideFireAnnualIncomeYen).toBe(SIDE_FIRE_ANNUAL_INCOME_YEN);
    expect(SIDE_FIRE_ANNUAL_INCOME_YEN).toBe(4000000);
  });

  it("reaches side FIRE earlier and with less required assets than full FIRE", () => {
    expect(progress.side.reached).toBe(true);
    expect(progress.full.reached).toBe(true);
    expect(progress.side.monthsToReach).toBeLessThan(progress.full.monthsToReach);
    expect(progress.side.requiredAssetsYen).toBeLessThan(progress.full.requiredAssetsYen);
  });

  it("treats an immediately reachable side FIRE as 100% with no gap", () => {
    const richPortfolio = {
      totals: { assetsYen: 200000000, liabilitiesYen: 0, netWorthYen: 200000000 },
      holdings: {
        cashLike: [{ "名称": "銀行預金", "残高": 50000000 }],
        stocks: [],
        funds: [{ "名称": "投信A", "評価額": 150000000 }],
        pensions: [],
        points: [],
        liabilitiesDetail: [],
      },
    };
    const rich = buildFireProgress({ portfolio: richPortfolio, baseParams });
    expect(rich.side.alreadyReached).toBe(true);
    expect(rich.side.monthsToReach).toBe(0);
    expect(rich.side.progressRate).toBe(1);
    expect(rich.side.gapYen).toBe(0);
    expect(rich.side.requiredAssetsYen).toBe(rich.fireTargetAssetsYen);
  });

  it("computes progress rate and gap against the required assets", () => {
    expect(progress.side.progressRate).toBeCloseTo(
      progress.fireTargetAssetsYen / progress.side.requiredAssetsYen,
    );
    expect(progress.side.gapYen).toBe(progress.side.requiredAssetsYen - progress.fireTargetAssetsYen);
    expect(progress.side.progressRate).toBeGreaterThan(0);
    expect(progress.side.progressRate).toBeLessThan(1);
  });
});

describe("buildProgressTrend", () => {
  const snapshots = [
    { month: "2026-10", totalAssetsYen: 77000000 },
    { month: "2026-11", totalAssetsYen: 78139712 },
  ];

  it("builds monthly progress rates against the current required assets", () => {
    const trend = buildProgressTrend(snapshots, {
      universityFundYen: UNIVERSITY_FUND_YEN,
      requiredAssetsYen: 100000000,
    });
    expect(trend.hasTrend).toBe(true);
    expect(trend.points).toEqual([
      { month: "2026-10", fireTargetAssetsYen: 66550000, progressRate: 0.6655 },
      { month: "2026-11", fireTargetAssetsYen: 67689712, progressRate: 0.67689712 },
    ]);
  });

  it("has no trend with a single snapshot", () => {
    const trend = buildProgressTrend(snapshots.slice(1), {
      universityFundYen: UNIVERSITY_FUND_YEN,
      requiredAssetsYen: 100000000,
    });
    expect(trend.hasTrend).toBe(false);
    expect(trend.points).toHaveLength(1);
  });
});

describe("ageAtSnapshotMonth", () => {
  it("derives the age at the end of the snapshot month from the birth date", () => {
    // 1979-09-02 生まれ: 2026年11月末は47歳、2029年9月末は50歳
    expect(ageAtSnapshotMonth("2026-11")).toBe(47);
    expect(ageAtSnapshotMonth("2029-09")).toBe(50);
    expect(ageAtSnapshotMonth("2029-08")).toBe(49);
  });

  it("returns null for an invalid month key", () => {
    expect(ageAtSnapshotMonth("2026/11")).toBeNull();
    expect(ageAtSnapshotMonth(null)).toBeNull();
  });
});

describe("buildProjectionTrend", () => {
  const modestSnapshot = {
    month: "2026-10",
    totalAssetsYen: 40000000,
    riskAssetsYen: 33000000,
    livingCost12mAvgYen: 483688,
    income12mAvgYen: 1071000,
  };
  const richSnapshot = {
    month: "2026-11",
    totalAssetsYen: 200000000,
    riskAssetsYen: 150000000,
    livingCost12mAvgYen: 483688,
    income12mAvgYen: 1071000,
  };

  it("recomputes each month's projection from that month's snapshot values", () => {
    const trend = buildProjectionTrend([modestSnapshot, richSnapshot], { baseParams });
    expect(trend.hasTrend).toBe(true);
    expect(trend.points).toHaveLength(2);

    const [first, second] = trend.points;
    expect(first.month).toBe("2026-10");
    expect(first.fireTargetAssetsYen).toBe(40000000 - UNIVERSITY_FUND_YEN);
    expect(first.side.reached).toBe(true);
    expect(first.side.alreadyReached).toBe(false);
    expect(first.side.monthsToReach).toBeGreaterThanOrEqual(1);
    expect(first.side.projectedMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(first.side.projectedMonth > first.month).toBe(true);

    // 資産が大きく増えた月は、その月自体が到達見込みになる
    expect(second.side.alreadyReached).toBe(true);
    expect(second.side.monthsToReach).toBe(0);
    expect(second.side.projectedMonth).toBe("2026-11");
    expect(second.full.reached).toBe(true);
  });

  it("computes how many months the projection moved since the previous month", () => {
    const trend = buildProjectionTrend([modestSnapshot, richSnapshot], { baseParams });
    // 翌月に到達可能な水準になったので、先月比は「先月の到達まで月数 − 経過1か月」
    expect(trend.delta.side).toBe(trend.points[0].side.monthsToReach - 1);
    expect(trend.delta.side).toBeGreaterThanOrEqual(0);
  });

  it("sorts snapshots by month even when given out of order", () => {
    const trend = buildProjectionTrend([richSnapshot, modestSnapshot], { baseParams });
    expect(trend.points.map((point) => point.month)).toEqual(["2026-10", "2026-11"]);
  });

  it("reflects a higher living cost as a later projection", () => {
    const expensiveSnapshot = { ...modestSnapshot, month: "2026-11", livingCost12mAvgYen: 900000 };
    const trend = buildProjectionTrend([modestSnapshot, expensiveSnapshot], { baseParams });
    const [first, second] = trend.points;
    expect(
      second.side.projectedMonth === null ||
        second.side.projectedMonth > first.side.projectedMonth,
    ).toBe(true);
  });

  it("marks months that never reach FIRE as having no projection", () => {
    const hopelessSnapshot = {
      month: "2026-10",
      totalAssetsYen: 10000000,
      riskAssetsYen: 5000000,
      livingCost12mAvgYen: 5000000,
      income12mAvgYen: 100000,
    };
    const trend = buildProjectionTrend([hopelessSnapshot, richSnapshot], { baseParams });
    expect(trend.points[0].side.reached).toBe(false);
    expect(trend.points[0].side.projectedMonth).toBeNull();
    // 先月が見込みなしなら先月比は出さない
    expect(trend.delta.side).toBeNull();
  });

  it("has no trend and no delta with a single snapshot", () => {
    const trend = buildProjectionTrend([richSnapshot], { baseParams });
    expect(trend.hasTrend).toBe(false);
    expect(trend.points).toHaveLength(1);
    expect(trend.delta).toEqual({ side: null, full: null });
  });
});

describe("PROGRESS_MILESTONES", () => {
  it("contains the three life event markers", () => {
    expect(PROGRESS_MILESTONES).toEqual([
      { id: "age-50", label: "50歳", monthKey: "2029-09" },
      { id: "daughter-independence", label: "娘の独立", monthKey: "2037-04" },
      { id: "mortgage-payoff", label: "住宅ローン完済", monthKey: "2042-05" },
    ]);
  });
});
