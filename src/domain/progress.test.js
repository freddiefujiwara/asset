import { describe, expect, it } from "vitest";
import {
  ASSET_GOAL_YEN,
  PROGRESS_MILESTONES,
  SIDE_FIRE_ANNUAL_INCOME_YEN,
  UNIVERSITY_FUND_YEN,
  ageAtSnapshotMonth,
  buildAssetGoalTrend,
  buildAssetGoals,
  buildFireProgress,
  buildGoalChartData,
  buildProgressTrend,
  buildProjectionTrend,
  computeFireTargetAssetsYen,
  projectLiabilitiesYen,
  selectProgressFocus,
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

  it("keeps side FIRE as the focus while it is not yet reached", () => {
    expect(progress.side.alreadyReached).toBe(false);
    expect(progress.focus).toEqual({
      focus: "side",
      primaryKind: "side",
      secondaryKind: "full",
      sideAchieved: false,
      fullAchieved: false,
    });
  });

  it("promotes full FIRE once side FIRE is at a reachable level", () => {
    // 2026-11-10時点の実数ベース。サイドFIREは到達可能な水準、
    // 完全FIREはまだ先という水準。
    const currentPortfolio = {
      totals: { assetsYen: 78139712, liabilitiesYen: 11510887, netWorthYen: 66628825 },
      holdings: {
        cashLike: [{ "名称": "銀行預金", "残高": 7502164 }],
        stocks: [{ "名称": "株式A", "評価額": 17538769 }],
        funds: [{ "名称": "投信A", "評価額": 49569663 }],
        pensions: [{ "名称": "確定拠出年金", "現在価値": 3457712 }],
        points: [],
        liabilitiesDetail: [],
      },
    };
    const current = buildFireProgress({ portfolio: currentPortfolio, baseParams });
    expect(current.side.alreadyReached).toBe(true);
    expect(current.full.alreadyReached).toBe(false);
    expect(current.focus).toEqual({
      focus: "full",
      primaryKind: "full",
      secondaryKind: "side",
      sideAchieved: true,
      fullAchieved: false,
    });
    expect(current.fullAssetsYen).toBeGreaterThan(0);
  });

  it("reports both as reached when both are at a reachable level", () => {
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
    expect(rich.full.alreadyReached).toBe(true);
    expect(rich.focus.focus).toBe("both");
    expect(rich.focus.primaryKind).toBeNull();
    expect(rich.focus.secondaryKind).toBeNull();
    expect(rich.focus.sideAchieved).toBe(true);
    expect(rich.focus.fullAchieved).toBe(true);
  });
});

describe("selectProgressFocus", () => {
  const run = (overrides = {}) => ({
    reached: true,
    alreadyReached: false,
    monthsToReach: 12,
    ...overrides,
  });

  it("keeps side FIRE primary while side FIRE is unreached", () => {
    const focus = selectProgressFocus({ side: run(), full: run() });
    expect(focus.focus).toBe("side");
    expect(focus.primaryKind).toBe("side");
    expect(focus.secondaryKind).toBe("full");
    expect(focus.sideAchieved).toBe(false);
    expect(focus.fullAchieved).toBe(false);
  });

  it("treats a side FIRE with no projection as unreached", () => {
    const focus = selectProgressFocus({
      side: run({ reached: false, monthsToReach: null }),
      full: run(),
    });
    expect(focus.focus).toBe("side");
    expect(focus.sideAchieved).toBe(false);
  });

  it("promotes full FIRE when side FIRE is already reachable", () => {
    const focus = selectProgressFocus({
      side: run({ alreadyReached: true, monthsToReach: 0 }),
      full: run(),
    });
    expect(focus.focus).toBe("full");
    expect(focus.primaryKind).toBe("full");
    expect(focus.secondaryKind).toBe("side");
    expect(focus.sideAchieved).toBe(true);
    expect(focus.fullAchieved).toBe(false);
  });

  it("has no primary when both are already reachable", () => {
    const focus = selectProgressFocus({
      side: run({ alreadyReached: true, monthsToReach: 0 }),
      full: run({ alreadyReached: true, monthsToReach: 0 }),
    });
    expect(focus.focus).toBe("both");
    expect(focus.primaryKind).toBeNull();
    expect(focus.secondaryKind).toBeNull();
    expect(focus.sideAchieved).toBe(true);
    expect(focus.fullAchieved).toBe(true);
  });

  it("defaults to side FIRE when runs are missing", () => {
    expect(selectProgressFocus({}).focus).toBe("side");
    expect(selectProgressFocus().focus).toBe("side");
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

describe("buildFireProgress edge cases", () => {
  it("marks both runs as not reached when assets only shrink", () => {
    const brokePortfolio = {
      totals: { assetsYen: 12000000, liabilitiesYen: 0, netWorthYen: 12000000 },
      holdings: {
        cashLike: [{ "名称": "銀行預金", "残高": 12000000 }],
        stocks: [],
        funds: [],
        pensions: [],
        points: [],
        liabilitiesDetail: [],
      },
    };
    const brokeParams = {
      ...baseParams,
      monthlyIncome: 0,
      monthlyInvestment: 0,
      annualReturnRate: 0,
      monthlyExpense: 900000,
      includePension: false,
      retirementLumpSumAtFire: 0,
    };
    const progress = buildFireProgress({ portfolio: brokePortfolio, baseParams: brokeParams });
    expect(progress.side.reached).toBe(false);
    expect(progress.side.alreadyReached).toBe(false);
    expect(progress.side.monthsToReach).toBeNull();
    expect(progress.side.requiredAssetsYen).toBeNull();
    expect(progress.side.progressRate).toBeNull();
    expect(progress.side.gapYen).toBeNull();
    expect(progress.full.reached).toBe(false);
  });

  it("treats a missing portfolio as zero assets", () => {
    const progress = buildFireProgress({ portfolio: null, baseParams });
    expect(progress.totalAssetsYen).toBe(0);
    expect(progress.fireTargetAssetsYen).toBe(0);
  });

  it("accepts a null postFireExtraExpense in the base params", () => {
    const progress = buildFireProgress({
      portfolio,
      baseParams: { ...baseParams, postFireExtraExpense: null },
    });
    expect(progress.side).toBeTypeOf("object");
    expect(progress.full).toBeTypeOf("object");
  });
});

describe("buildProgressTrend edge cases", () => {
  it("treats a non-array snapshots argument as empty", () => {
    const trend = buildProgressTrend(null, {
      universityFundYen: UNIVERSITY_FUND_YEN,
      requiredAssetsYen: 100000000,
    });
    expect(trend.hasTrend).toBe(false);
    expect(trend.points).toEqual([]);
  });

  it("reports a null progress rate when the required assets are zero", () => {
    const trend = buildProgressTrend(
      [
        { month: "2026-10", totalAssetsYen: 77000000 },
        { month: "2026-11", totalAssetsYen: 78139712 },
      ],
      { universityFundYen: UNIVERSITY_FUND_YEN, requiredAssetsYen: 0 },
    );
    expect(trend.points.map((point) => point.progressRate)).toEqual([null, null]);
  });
});

describe("buildProjectionTrend edge cases", () => {
  it("treats a non-array snapshots argument as empty", () => {
    const trend = buildProjectionTrend(null, { baseParams });
    expect(trend.hasTrend).toBe(false);
    expect(trend.points).toEqual([]);
    expect(trend.delta).toEqual({ side: null, full: null });
  });

  it("falls back to the base params for snapshots without amounts or averages", () => {
    const { postFireExtraExpense, ...paramsWithoutExtra } = baseParams;
    const trend = buildProjectionTrend([{ month: "2026-10" }, { month: "2026-11" }], {
      baseParams: paramsWithoutExtra,
    });
    expect(trend.hasTrend).toBe(true);
    expect(trend.points).toHaveLength(2);
    expect(trend.points[0].fireTargetAssetsYen).toBe(0);
  });
});

describe("projectLiabilitiesYen", () => {
  const base = {
    currentLiabilitiesYen: 11510887,
    mortgageMonthlyPayment: 61089,
    mortgagePayoffDate: "2042-05",
    startMonthKey: "2026-11",
    monthOffset: 0,
  };

  it("keeps liabilities constant without a mortgage payment or payoff date", () => {
    expect(projectLiabilitiesYen({ ...base, mortgageMonthlyPayment: 0 })).toBe(11510887);
    expect(projectLiabilitiesYen({ ...base, mortgagePayoffDate: null })).toBe(11510887);
  });

  it("keeps liabilities constant for invalid month keys", () => {
    expect(projectLiabilitiesYen({ ...base, mortgagePayoffDate: "2042/05" })).toBe(11510887);
    expect(projectLiabilitiesYen({ ...base, startMonthKey: "x" })).toBe(11510887);
  });

  it("declines the mortgage portion by the monthly payment and floors at the other liabilities", () => {
    // 残り187か月×61,089円 = 11,423,643円がローン相当分、その他は87,244円
    expect(projectLiabilitiesYen({ ...base, monthOffset: 0 })).toBe(11510887);
    expect(projectLiabilitiesYen({ ...base, monthOffset: 10 })).toBe(11510887 - 610890);
    expect(projectLiabilitiesYen({ ...base, monthOffset: 500 })).toBe(87244);
  });

  it("treats a payoff date in the past as no mortgage balance", () => {
    expect(
      projectLiabilitiesYen({ ...base, mortgagePayoffDate: "2020-01", monthOffset: 30 }),
    ).toBe(11510887);
  });

  it("tolerates missing liabilities", () => {
    expect(projectLiabilitiesYen({ ...base, currentLiabilitiesYen: null })).toBe(0);
    expect(
      projectLiabilitiesYen({ monthOffset: 0, mortgagePayoffDate: "2042-05", startMonthKey: "2026-11" }),
    ).toBe(0);
  });
});

describe("buildAssetGoals", () => {
  it("projects both 100M goals from the current portfolio", () => {
    const goals = buildAssetGoals({ portfolio, baseParams });
    expect(ASSET_GOAL_YEN).toBe(100000000);
    expect(goals.goalYen).toBe(100000000);
    expect(goals.totalAssetsYen).toBe(40000000);
    expect(goals.netAssetsYen).toBe(40000000 - 11510887);
    expect(goals.total.progressRate).toBeCloseTo(0.4);
    expect(goals.net.progressRate).toBeCloseTo(0.28489113);
    expect(goals.total.reached).toBe(true);
    expect(goals.net.reached).toBe(true);
    expect(goals.total.alreadyReached).toBe(false);
    expect(goals.net.monthsToReach).toBeGreaterThan(goals.total.monthsToReach);
    expect(goals.series.length).toBeGreaterThan(0);
    expect(goals.series[0].totalAssetsYen).toBe(40000000);
  });

  it("marks goals already reached when the current amount is at or above 100M", () => {
    const richPortfolio = {
      totals: { assetsYen: 120000000, liabilitiesYen: 10000000, netWorthYen: 110000000 },
      holdings: {
        cashLike: [{ "名称": "銀行預金", "残高": 20000000 }],
        stocks: [],
        funds: [{ "名称": "投信A", "評価額": 100000000 }],
        pensions: [],
        points: [],
        liabilitiesDetail: [],
      },
    };
    const goals = buildAssetGoals({ portfolio: richPortfolio, baseParams });
    expect(goals.total).toMatchObject({ reached: true, alreadyReached: true, monthsToReach: 0 });
    expect(goals.net).toMatchObject({ reached: true, alreadyReached: true, monthsToReach: 0 });
    expect(goals.total.progressRate).toBeCloseTo(1.2);
  });

  it("reports no projection when assets never reach the goal", () => {
    const poorPortfolio = {
      totals: { assetsYen: 1000000, liabilitiesYen: 500000, netWorthYen: 500000 },
      holdings: {
        cashLike: [{ "名称": "銀行預金", "残高": 1000000 }],
        stocks: [],
        funds: [],
        pensions: [],
        points: [],
        liabilitiesDetail: [],
      },
    };
    const poorParams = {
      ...baseParams,
      monthlyIncome: 100000,
      monthlyInvestment: 0,
      annualReturnRate: 0,
    };
    const goals = buildAssetGoals({ portfolio: poorPortfolio, baseParams: poorParams });
    expect(goals.total.reached).toBe(false);
    expect(goals.total.monthsToReach).toBeNull();
    expect(goals.total.projectedMonth).toBeNull();
    expect(goals.net.reached).toBe(false);
  });

  it("tolerates a missing portfolio and a missing current age", () => {
    const { currentAge, ...paramsWithoutAge } = baseParams;
    const goals = buildAssetGoals({ portfolio: null, baseParams: paramsWithoutAge });
    expect(goals.totalAssetsYen).toBe(0);
    expect(goals.total.progressRate).toBe(0);
    // 資産ゼロからでも収入の余剰が積み上がる前提のため、到達見込み自体は立つ
    expect(goals.total.reached).toBe(true);
    expect(goals.series[0].totalAssetsYen).toBe(0);
  });
});

describe("buildAssetGoalTrend", () => {
  const snapshotA = {
    month: "2026-10",
    totalAssetsYen: 77000000,
    totalLiabilitiesYen: 11600000,
    riskAssetsYen: 69000000,
    livingCost12mAvgYen: 470000,
    income12mAvgYen: 1050000,
  };
  const snapshotB = {
    month: "2026-11",
    totalAssetsYen: 78139712,
    totalLiabilitiesYen: 11510887,
    riskAssetsYen: 70630234,
    livingCost12mAvgYen: 461012,
    income12mAvgYen: 1056465,
  };

  it("builds per-month goal projections with deltas", () => {
    const trend = buildAssetGoalTrend([snapshotB, snapshotA], { baseParams });
    expect(trend.hasTrend).toBe(true);
    expect(trend.points.map((p) => p.month)).toEqual(["2026-10", "2026-11"]);
    expect(trend.points[1].total.projectedMonth).not.toBeNull();
    expect(trend.delta.total).not.toBeNull();
    expect(trend.delta.net).not.toBeNull();
  });

  it("has no trend with a single snapshot and tolerates non-array input", () => {
    const single = buildAssetGoalTrend([snapshotA], { baseParams });
    expect(single.hasTrend).toBe(false);
    expect(single.delta).toEqual({ total: null, net: null });
    const empty = buildAssetGoalTrend(null, { baseParams });
    expect(empty.points).toEqual([]);
    expect(empty.hasTrend).toBe(false);
  });

  it("skips snapshots with invalid months and missing amounts", () => {
    const trend = buildAssetGoalTrend(
      [{ month: "bad" }, { month: "2026-10" }],
      { baseParams },
    );
    expect(trend.points).toHaveLength(1);
    expect(trend.points[0].total.progressRate).toBe(0);
  });
});

describe("buildGoalChartData", () => {
  const snapshots = [
    { month: "2026-10", totalAssetsYen: 77000000, totalLiabilitiesYen: 11600000 },
    { month: "2026-11", totalAssetsYen: 78139712, totalLiabilitiesYen: 11510887 },
  ];

  it("combines actuals, projections and goal lines", () => {
    const assetGoals = buildAssetGoals({ portfolio, baseParams });
    const chart = buildGoalChartData({
      snapshots,
      assetGoals,
      fullRequiredAssetsYen: 128643042,
    });
    expect(chart.goalYen).toBe(100000000);
    expect(chart.fullRequiredAssetsYen).toBe(128643042);
    expect(chart.actualTotal).toEqual([
      { month: "2026-10", value: 77000000 },
      { month: "2026-11", value: 78139712 },
    ]);
    expect(chart.actualNet[1]).toEqual({ month: "2026-11", value: 66628825 });
    // 両目標とも到達見込みがあるため、遅い方の到達+24か月で打ち切る
    const lastNet = chart.projectedNet[chart.projectedNet.length - 1];
    expect(chart.projectedTotal.length).toBeLessThan(assetGoals.series.length);
    expect(lastNet.value).toBeGreaterThan(100000000);
  });

  it("caps the projection at 360 months when a goal is unreachable", () => {
    const assetGoals = {
      total: { reached: false, monthsToReach: null },
      net: { reached: true, monthsToReach: 10 },
      series: Array.from({ length: 400 }, (_, i) => ({
        monthOffset: i,
        monthKey: "2030-01",
        totalAssetsYen: i,
        netAssetsYen: i,
      })),
    };
    const chart = buildGoalChartData({ snapshots: [], assetGoals, fullRequiredAssetsYen: null });
    expect(chart.projectedTotal).toHaveLength(361);
    expect(chart.fullRequiredAssetsYen).toBeNull();
    expect(chart.actualTotal).toEqual([]);
  });

  it("tolerates missing asset goals and snapshots", () => {
    const chart = buildGoalChartData({ snapshots: null, assetGoals: null, fullRequiredAssetsYen: undefined });
    expect(chart.projectedTotal).toEqual([]);
    expect(chart.projectedNet).toEqual([]);
    expect(chart.fullRequiredAssetsYen).toBeNull();
    const partial = buildGoalChartData({ snapshots, assetGoals: {}, fullRequiredAssetsYen: 1 });
    expect(partial.projectedTotal).toEqual([]);
    const sparse = buildGoalChartData({
      snapshots: [{ month: "bad" }, null, { month: "2026-10" }],
      assetGoals: null,
      fullRequiredAssetsYen: null,
    });
    expect(sparse.actualTotal).toEqual([{ month: "2026-10", value: 0 }]);
    expect(sparse.actualNet).toEqual([{ month: "2026-10", value: 0 }]);
  });
});
