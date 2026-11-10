import { describe, expect, it } from "vitest";
import {
  PROGRESS_MILESTONES,
  SIDE_FIRE_ANNUAL_INCOME_YEN,
  UNIVERSITY_FUND_YEN,
  buildFireProgress,
  buildProgressTrend,
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

describe("PROGRESS_MILESTONES", () => {
  it("contains the three life event markers", () => {
    expect(PROGRESS_MILESTONES).toEqual([
      { id: "age-50", label: "50歳", monthKey: "2029-09" },
      { id: "daughter-independence", label: "娘の独立", monthKey: "2037-04" },
      { id: "mortgage-payoff", label: "住宅ローン完済", monthKey: "2042-05" },
    ]);
  });
});
