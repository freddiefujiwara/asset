import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateRiskAssets,
  calculateExcludedOwnerAssets,
  estimateMonthlyExpenses,
  estimateMonthlyIncome,
  estimateIncomeSplit,
  estimateMortgageMonthlyPayment,
  simulateFire,
  generateGrowthTable,
} from "./fire";

describe("fire domain", () => {
  describe("calculateRiskAssets", () => {
    it("returns 0 for empty portfolio", () => {
      expect(calculateRiskAssets(null)).toBe(0);
      expect(calculateRiskAssets({})).toBe(0);
    });

    it("sums only risk assets (Stocks, Funds, Pension, etc.)", () => {
      const portfolio = {
        summary: {
          assetsByClass: [
            { name: "預金・現金", amountYen: 1000 },
            { name: "株式（現物）", amountYen: 2000 },
            { name: "投資信託", amountYen: 3000 },
            { name: "ポイント・マイル", amountYen: 400 },
            { name: "年金", amountYen: 5000 },
            { name: "債券", amountYen: 6000 },
          ],
        },
      };
      // Risk: 2000 + 3000 + 5000 + 6000 = 16000
      expect(calculateRiskAssets(portfolio)).toBe(16000);
    });
  });

  describe("calculateExcludedOwnerAssets", () => {
    it("returns 0 when holdings are missing", () => {
      expect(calculateExcludedOwnerAssets(null)).toEqual({ totalAssetsYen: 0, riskAssetsYen: 0 });
      expect(calculateExcludedOwnerAssets({})).toEqual({ totalAssetsYen: 0, riskAssetsYen: 0 });
    });

    it("sums only daughter assets and risk assets", () => {
      const portfolio = {
        holdings: {
          cashLike: [
            { "名称・説明": "普通預金@aojiru.pudding", "残高": "100000" },
            { "名称・説明": "普通預金", "残高": "300000" },
          ],
          stocks: [
            { "名称・説明": "株A@aojiru.pudding", "現在価値": "200000" },
            { "名称・説明": "株B", "現在価値": "500000" },
          ],
          funds: [
            { "名称・説明": "投信@aojiru.pudding", "評価額": "300000" },
          ],
          pensions: [
            { "名称・説明": "年金@aojiru.pudding", "現在価値": "400000" },
          ],
          points: [
            { "名称・説明": "ポイント@aojiru.pudding", "残高": "5000" },
          ],
        },
      };

      expect(calculateExcludedOwnerAssets(portfolio, "daughter")).toEqual({
        totalAssetsYen: 1005000,
        riskAssetsYen: 900000,
      });
    });
  });

  describe("estimateMonthlyExpenses", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-15T09:00:00+09:00"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });
    it("calculates average monthly expenses and breakdown", () => {
      // Past 5 months from 2026-03: Feb, Jan, Dec, Nov, Oct
      const cashFlow = [
        { date: "2026-02-01", amount: -100, isTransfer: false, category: "Food" },
        { date: "2026-02-02", amount: -200, isTransfer: false, category: "Housing" },
        { date: "2026-01-01", amount: -300, isTransfer: false, category: "Food" },
        { date: "2026-01-02", amount: -400, isTransfer: false, category: "Housing" },
      ];
      // Total: 1000. Divided by 5 = 200.
      const result = estimateMonthlyExpenses(cashFlow);
      expect(result.total).toBe(200);
      expect(result.breakdown).toContainEqual({ name: "Food", amount: 80 }); // 400 / 5
      expect(result.breakdown).toContainEqual({ name: "Housing", amount: 120 }); // 600 / 5
    });

    it("excludes special expenses and returns them separately", () => {
      const cashFlow = [
        { date: "2026-02-01", amount: -1000, isTransfer: false, category: "特別な支出/旅行" },
        { date: "2026-02-01", amount: -500, isTransfer: false, category: "Food" },
      ];
      const result = estimateMonthlyExpenses(cashFlow);
      expect(result.total).toBe(100); // 500 / 5
      expect(result.averageSpecial).toBe(200); // 1000 / 5
    });

    it("handles transfers, income, and missing categories", () => {
      const cashFlow = [
        { date: "2026-02-01", amount: 1000, isTransfer: false, category: "Income" },
        { date: "2026-02-01", amount: -100, isTransfer: true, category: "Transfer" },
        { date: "2026-02-01", amount: -500, isTransfer: false, category: "" }, // should be 未分類
      ];
      const result = estimateMonthlyExpenses(cashFlow);
      expect(result.total).toBe(100); // 500 / 5
      expect(result.breakdown).toContainEqual({ name: "未分類", amount: 100 });
    });

    it("excludes Cash and Card categories", () => {
      const cashFlow = [
        { date: "2026-02-01", amount: -1000, isTransfer: false, category: "Food" },
        { date: "2026-02-01", amount: -500, isTransfer: false, category: "現金・カード/現金引き出し" },
        { date: "2026-02-01", amount: -300, isTransfer: false, category: "カード/支払い" },
      ];
      const result = estimateMonthlyExpenses(cashFlow);
      expect(result.total).toBe(200); // 1000 / 5
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0].name).toBe("Food");
    });


    it("uses previous 5 calendar months and excludes current month", () => {
      vi.setSystemTime(new Date("2026-06-15T09:00:00+09:00"));
      // Past 5: May, Apr, Mar, Feb, Jan

      const cashFlow = [
        { date: "2026-06-01", amount: -10000, isTransfer: false, category: "Food" }, // current month excluded
        { date: "2026-05-01", amount: -100, isTransfer: false, category: "Food" },
        { date: "2026-04-01", amount: -100, isTransfer: false, category: "Food" },
        { date: "2026-03-01", amount: -100, isTransfer: false, category: "Food" },
        { date: "2026-02-01", amount: -100, isTransfer: false, category: "Food" },
        { date: "2026-01-01", amount: -100, isTransfer: false, category: "Food" },
        { date: "2025-12-01", amount: -100, isTransfer: false, category: "Food" }, // beyond 5 months excluded
      ];

      const result = estimateMonthlyExpenses(cashFlow);
      expect(result.total).toBe(100); // 500 / 5
      expect(result.monthCount).toBe(5);
    });

    it("returns zeros for empty cash flow", () => {
      const result = estimateMonthlyExpenses([]);
      expect(result.total).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it("handles missing date in expenses for coverage", () => {
      const cashFlow = [{ date: null, amount: -100, isTransfer: false, category: "Food" }];
      const result = estimateMonthlyExpenses(cashFlow);
      expect(result.total).toBe(0);
    });
  });

  describe("estimateMonthlyIncome", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-15T09:00:00+09:00"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("handles missing date for coverage", () => {
        expect(estimateMonthlyIncome([{ date: null, amount: 100, isTransfer: false }])).toBe(0);
    });

    it("calculates average monthly income excluding current month and transfers", () => {
      const cashFlow = [
        { date: "2026-03-01", amount: 300000, isTransfer: false, category: "収入/給与" }, // current excluded
        { date: "2026-02-01", amount: 300000, isTransfer: false, category: "収入/給与" },
        { date: "2026-01-01", amount: 300000, isTransfer: false, category: "収入/給与" },
        { date: "2025-12-01", amount: 300000, isTransfer: false, category: "収入/給与" },
        { date: "2025-11-01", amount: 300000, isTransfer: false, category: "収入/給与" },
        { date: "2025-10-01", amount: 300000, isTransfer: false, category: "収入/給与" },
        { date: "2026-02-10", amount: 10000, isTransfer: true, category: "振替" }, // excluded
        { date: "2026-02-20", amount: -5000, isTransfer: false, category: "返金" }, // excluded
      ];
      expect(estimateMonthlyIncome(cashFlow)).toBe(300000); // 1.5M / 5
    });
  });

  describe("estimateIncomeSplit", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-15T09:00:00+09:00"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("splits regular monthly income and bonus annualized amount", () => {
      const cashFlow = [
        { date: "2026-03-01", amount: 300000, isTransfer: false, category: "収入/給与" }, // current month excluded
        { date: "2026-02-01", amount: 300000, isTransfer: false, category: "収入/給与" },
        { date: "2026-01-01", amount: 300000, isTransfer: false, category: "収入/給与" },
        { date: "2025-12-01", amount: 300000, isTransfer: false, category: "収入/給与" },
        { date: "2025-11-01", amount: 300000, isTransfer: false, category: "収入/給与" },
        { date: "2025-10-01", amount: 300000, isTransfer: false, category: "収入/給与" },
        { date: "2026-02-15", amount: 500000, isTransfer: false, category: "収入/賞与" },
      ];

      const result = estimateIncomeSplit(cashFlow);
      expect(result.regularMonthly).toBe(300000);
      expect(result.bonusAnnual).toBe(1200000); // 500,000 annualized: 500,000 * (12 / 5) = 1,200,000
      expect(result.monthlyTotal).toBe(400000);
      expect(result.regularBreakdown).toContainEqual({ name: "収入/給与", amount: 300000 });
      expect(result.bonusBreakdown).toContainEqual({ name: "収入/賞与", amount: 1200000 });
      expect(result.monthCount).toBe(5);
    });

    it("handles edge cases for coverage in income split", () => {
      const cashFlow = [
        { date: "2026-02-01", amount: 100, isTransfer: true, category: "収入/給与" }, // transfer excluded
        { date: "2026-02-01", amount: -100, isTransfer: false, category: "収入/給与" }, // amount <= 0 excluded
        { date: "2026-02-01", amount: 100, isTransfer: false }, // category missing
        { date: "2026-02-01", amount: 100, isTransfer: false, category: "その他" }, // category doesn't start with 収入/
        { date: "2026-03-01", amount: 100, isTransfer: false, category: "収入/給与" }, // current month excluded
        { date: null, amount: 100, isTransfer: false, category: "収入/給与" }, // missing date excluded
      ];
      const result = estimateIncomeSplit(cashFlow);
      expect(result.regularMonthly).toBe(0);
      expect(result.bonusAnnual).toBe(0);
    });
  });

  describe("estimateMortgageMonthlyPayment", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-15T09:00:00+09:00"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("estimates monthly mortgage payment from 住宅/ローン返済 category", () => {
      const cashFlow = [
        { date: "2026-02-01", amount: -120000, isTransfer: false, category: "住宅/ローン返済" },
        { date: "2026-01-01", amount: -120000, isTransfer: false, category: "住宅/ローン返済" },
        { date: "2025-12-01", amount: -120000, isTransfer: false, category: "住宅/ローン返済" },
        { date: "2025-11-01", amount: -120000, isTransfer: false, category: "住宅/ローン返済" },
        { date: "2025-10-01", amount: -120000, isTransfer: false, category: "住宅/ローン返済" },
        { date: "2026-02-01", amount: -10000, isTransfer: false, category: "住宅/管理費" },
      ];

      expect(estimateMortgageMonthlyPayment(cashFlow)).toBe(120000);
    });

    it("handles edge cases for coverage in mortgage estimation", () => {
      const cashFlow = [
        { date: "2026-02-01", amount: -100, isTransfer: true, category: "住宅/ローン返済" }, // transfer
        { date: "2026-02-01", amount: 100, isTransfer: false, category: "住宅/ローン返済" }, // amount >= 0
        { date: "2026-03-01", amount: -100, isTransfer: false, category: "住宅/ローン返済" }, // current month excluded
        { date: "2026-02-01", amount: -100, isTransfer: false }, // missing category
        { date: null, amount: -100, isTransfer: false, category: "住宅/ローン返済" }, // missing date
      ];
      expect(estimateMortgageMonthlyPayment(cashFlow)).toBe(0);
    });
  });

  describe("simulateFire", () => {
    const params = {
      initialAssets: 10000000,
      riskAssets: 5000000,
      monthlyInvestment: 100000,
      annualReturnRate: 0.05,
      annualStandardDeviation: 0.1,
      monthlyExpense: 200000,
      iterations: 10,
    };

    it("runs Monte Carlo simulation and returns stats", () => {
      const result = simulateFire(params);
      expect(result.trials).toHaveLength(10);
      expect(result.stats.median).toBeDefined();
      expect(result.stats.mean).toBeDefined();
      expect(result.stats.p5).toBeDefined();
      expect(result.stats.p95).toBeDefined();
    });

    it("handles 0 initial assets", () => {
      const result = simulateFire({ ...params, initialAssets: 0, riskAssets: 0 });
      expect(result.stats.median).toBeGreaterThan(0);
    });

    it("returns 0 months if already reached FIRE", () => {
      const result = simulateFire({
        ...params,
        initialAssets: 100000000, // 100M yen
        monthlyExpense: 100000, // 1.2M/year
      });
      expect(result.stats.median).toBe(0);
    });

    it("handles inflation and tax options", () => {
      const result = simulateFire({
        ...params,
        includeInflation: true,
        inflationRate: 0.03,
        includeTax: true,
        taxRate: 0.2,
      });
      expect(result.stats.median).toBeDefined();
    });

    it("returns maxMonths if assets go below 0", () => {
      const result = simulateFire({
        ...params,
        initialAssets: 1000,
        monthlyInvestment: 0,
        monthlyExpense: 1000000,
        maxMonths: 10,
      });
      expect(result.stats.median).toBe(10);
    });

    it("returns maxMonths if loop finishes without reaching target but stays positive", () => {
      const result = simulateFire({
        ...params,
        initialAssets: 1000,
        monthlyInvestment: 0,
        monthlyExpense: 10, // Small expense so assets stay positive but below required
        annualReturnRate: 0,
        annualStandardDeviation: 0,
        maxMonths: 5,
        iterations: 1
      });
      // Required assets for 100-40=60 years will be much more than 1000
      expect(result.stats.median).toBe(5);
    });

    it("supports monthly income before FIRE", () => {
      const resultWithoutIncome = simulateFire({
        ...params,
        initialAssets: 0,
        riskAssets: 0,
        monthlyInvestment: 0,
        monthlyIncome: 0,
        monthlyExpense: 100000,
        annualReturnRate: 0,
        annualStandardDeviation: 0,
        iterations: 1,
        maxMonths: 12,
      });

      const resultWithIncome = simulateFire({
        ...params,
        initialAssets: 0,
        riskAssets: 0,
        monthlyInvestment: 0,
        monthlyIncome: 500000,
        monthlyExpense: 100000,
        annualReturnRate: 0,
        annualStandardDeviation: 0,
        iterations: 1,
        maxMonths: 12,
      });

      expect(resultWithIncome.stats.median).toBeLessThanOrEqual(resultWithoutIncome.stats.median);
    });
  });

  describe("generateGrowthTable", () => {
    const params = {
      initialAssets: 10000000,
      riskAssets: 5000000,
      monthlyInvestment: 100000,
      annualReturnRate: 0.05,
      monthlyExpense: 200000,
      maxMonths: 12,
    };

    it("generates a table of asset growth", () => {
      const result = generateGrowthTable(params);
      expect(result.table).toHaveLength(13); // 0 to 12
      expect(result.table[0].assets).toBe(10000000);
      expect(result.table[1].assets).toBeGreaterThan(0);
    });

    it("detects FIRE reached month and stops investment / performs withdrawal based on withdrawalRate", () => {
      const result = generateGrowthTable({
        ...params,
        initialAssets: 100000000, // already reached FIRE
        monthlyExpense: 100000,
        annualReturnRate: 0,
        currentAge: 40,
        withdrawalRate: 0.03, // Custom rate
      });
      expect(result.fireReachedMonth).toBe(0);
      expect(result.table[0].isFire).toBe(true);
      // month 0 assets: 100,000,000
      // 3% withdrawal: 100,000,000 * 0.03 / 12 = 250,000
      // monthlyExpense: 100,000
      // withdrawal = max(100k, 250k) = 250,000
      // month 1 assets: 100,000,000 - 250,000 = 99,750,000
      expect(result.table[1].assets).toBeCloseTo(99750000, 0);
    });

    it("depletes exactly at age 100 in deterministic table if returns=0", () => {
      // If returns=0 and inflation=0, requiredAssets = expense * remainingMonths
      const currentAge = 90;
      const remainingMonths = (100 - 90) * 12; // 120 months
      const monthlyExpense = 100000;
      const required = monthlyExpense * remainingMonths; // 12,000,000

      const result = generateGrowthTable({
        initialAssets: required,
        riskAssets: 0,
        monthlyInvestment: 0,
        annualReturnRate: 0,
        monthlyExpense,
        currentAge,
        includeInflation: false,
      });

      expect(result.fireReachedMonth).toBe(0);
      expect(result.table[remainingMonths].assets).toBeCloseTo(0);
    });

    it("handles tax and inflation", () => {
      const result = generateGrowthTable({
        ...params,
        includeInflation: true,
        includeTax: true,
      });
      expect(result.table[1].requiredAssets).toBeGreaterThan(result.table[0].requiredAssets);
    });

    it("grosses up withdrawal by taxRate when includeTax is true post-FIRE", () => {
      const initialAssets = 100000000;
      const monthlyExpense = 100000;
      const taxRate = 0.2; // 20%
      const result = generateGrowthTable({
        ...params,
        initialAssets,
        monthlyExpense,
        includeTax: true,
        taxRate,
        annualReturnRate: 0,
        withdrawalRate: 0,
      });
      // Post-FIRE withdrawal should be 100,000 / (1 - 0.2) = 125,000
      expect(result.fireReachedMonth).toBe(0);
      expect(result.table[1].assets).toBe(initialAssets - 125000);
    });

    it("increases requiredAssets and withdrawal when postFireExtraExpense is provided", () => {
      const initialAssets = 200000000;
      const monthlyExpense = 100000;
      const postFireExtraExpense = 50000;
      const result = generateGrowthTable({
        ...params,
        initialAssets,
        monthlyExpense,
        postFireExtraExpense,
        annualReturnRate: 0,
        withdrawalRate: 0,
      });
      // Post-FIRE withdrawal should be 100,000 + 50,000 = 150,000
      expect(result.fireReachedMonth).toBe(0);
      expect(result.table[1].assets).toBe(initialAssets - 150000);
      // requiredAssets at m=0 for 40->100 age (720 months)
      // should be (100k + 50k) * 720 = 108,000,000
      expect(result.table[0].requiredAssets).toBe(108000000);
    });

    it("sets assets to 0 if they go negative", () => {
      const result = generateGrowthTable({
        ...params,
        initialAssets: 1000,
        monthlyInvestment: 0,
        monthlyExpense: 1000000,
      });
      expect(result.table[1].assets).toBe(0);
    });

    it("handles initialAssets 0 in ratio calculation", () => {
        const result = generateGrowthTable({
            ...params,
            initialAssets: 0,
            riskAssets: 0
        });
        expect(result.table[0].assets).toBe(0);
    });

    it("drops mortgage payment after payoff month", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-10T09:00:00+09:00"));

      const result = generateGrowthTable({
        initialAssets: 0,
        riskAssets: 0,
        monthlyInvestment: 0,
        monthlyIncome: 100000,
        annualReturnRate: 0,
        monthlyExpense: 90000,
        currentAge: 40,
        maxMonths: 2,
        mortgageMonthlyPayment: 50000,
        mortgagePayoffDate: "2026-02",
      });

      // m0: before payoff -> expense 90,000, assets +10,000
      expect(result.table[1].assets).toBe(10000);
      // m1 update happens after payoff month start -> expense becomes 40,000, assets +60,000
      expect(result.table[2].assets).toBe(70000);

      vi.useRealTimers();
    });

    it("sets income to 0 after FIRE is reached", () => {
      const result = generateGrowthTable({
        initialAssets: 100000000,
        riskAssets: 0,
        monthlyInvestment: 0,
        monthlyIncome: 500000,
        annualReturnRate: 0,
        monthlyExpense: 100000,
        currentAge: 40,
        maxMonths: 1,
        withdrawalRate: 0,
      });

      // FIRE reached at month 0, so month 1 should subtract expense only (income is forced to 0)
      expect(result.fireReachedMonth).toBe(0);
      expect(result.table[1].assets).toBe(99900000);
    });
  });
});
