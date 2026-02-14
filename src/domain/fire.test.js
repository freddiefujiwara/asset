import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateRiskAssets,
  calculateExcludedOwnerAssets,
  calculateFirePortfolio,
  calculateCashAssets,
  estimateMonthlyExpenses,
  estimateMonthlyIncome,
  estimateIncomeSplit,
  estimateMortgageMonthlyPayment,
  simulateFire,
  generateGrowthTable,
  generateAnnualSimulation,
  calculateMonthlyPension,
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

    it("handles non-array holdings entries", () => {
      const portfolio = {
        holdings: {
          cashLike: { "名称・説明": "普通預金@aojiru.pudding", "残高": "100000" },
          stocks: null,
          funds: undefined,
          pensions: "invalid",
          points: 123,
        },
      };

      expect(calculateExcludedOwnerAssets(portfolio, "daughter")).toEqual({
        totalAssetsYen: 0,
        riskAssetsYen: 0,
      });
    });
  });

  describe("calculateFirePortfolio", () => {
    const portfolio = {
      holdings: {
        cashLike: [
          { category: "預金・現金", "名称・説明": "銀行A", 残高: "1000000" }, // me
          { category: "預金・現金", "名称・説明": "銀行B@chipop", 残高: "500000" }, // wife
          { category: "預金・現金", "名称・説明": "銀行C@aojiru.pudding", 残高: "200000" }, // daughter
        ],
        stocks: [
          { category: "株式（現物）", 銘柄名: "株A", 評価額: "2000000" }, // me
          { category: "株式（現物）", 銘柄名: "株B@aojiru.pudding", 評価額: "300000" }, // daughter
        ],
        liabilitiesDetail: [
          { 種類: "住宅ローン", 残高: "10000000" }, // me
          { 種類: "カード借入@aojiru.pudding", 残高: "5000" }, // daughter
        ],
      },
    };

    it("returns zeros for empty portfolio", () => {
      expect(calculateFirePortfolio(null)).toEqual({
        totalAssetsYen: 0,
        riskAssetsYen: 0,
        cashAssetsYen: 0,
        liabilitiesYen: 0,
        netWorthYen: 0,
      });
    });

    it("aggregates assets and liabilities strictly for me and wife", () => {
      const result = calculateFirePortfolio(portfolio);
      // Assets: me(1M cash, 2M stock) + wife(0.5M cash) = 3.5M
      // Risk: me(2M stock) = 2.0M
      // Cash: 3.5M - 2.0M = 1.5M
      // Liabilities: me(10M loan) = 10M
      // Net Worth: 3.5M - 10M = -6.5M
      expect(result.totalAssetsYen).toBe(3500000);
      expect(result.riskAssetsYen).toBe(2000000);
      expect(result.cashAssetsYen).toBe(1500000);
      expect(result.liabilitiesYen).toBe(10000000);
      expect(result.netWorthYen).toBe(-6500000);
    });

    it("supports custom owner list", () => {
      const result = calculateFirePortfolio(portfolio, ["me"]);
      expect(result.totalAssetsYen).toBe(3000000);
      expect(result.liabilitiesYen).toBe(10000000);
    });

    it("handles missing categories and missing liability section", () => {
      const partialPortfolio = {
        holdings: {
          cashLike: [
            { "名称・説明": "不明な資産", 残高: "50000" } // me, no category
          ]
          // stocks and liabilitiesDetail missing
        }
      };
      const result = calculateFirePortfolio(partialPortfolio);
      expect(result.totalAssetsYen).toBe(50000);
      expect(result.riskAssetsYen).toBe(0);
      expect(result.liabilitiesYen).toBe(0);
    });
  });

  describe("calculateCashAssets", () => {
    it("returns 0 for empty portfolio", () => {
      expect(calculateCashAssets(null)).toBe(0);
    });

    it("calculates total assets minus risk assets", () => {
      const portfolio = {
        totals: { assetsYen: 10000 },
        summary: {
          assetsByClass: [
            { name: "預金・現金", amountYen: 4000 },
            { name: "株式（現物）", amountYen: 6000 },
          ],
        },
      };
      // Total 10000, Risk 6000 -> Cash 4000
      expect(calculateCashAssets(portfolio)).toBe(4000);
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

  describe("calculateMonthlyPension", () => {
    it("returns 0 before age 60", () => {
      expect(calculateMonthlyPension(59.9, 50)).toBe(0);
    });

    it("returns approx 116,929 (1.4M / 12) at age 60 if FIRE at 50", () => {
      // User Basic (60): 780k * 0.9 * 0.76 = 533,520
      // User Kosei (65): 892,252 (accrued at 44) + (50 - 44) * 42,000 = 892,252 + 252,000 = 1,144,252
      // User Kosei (60): 1,144,252 * 0.76 = 869,632
      // Total (60): 533,520 + 869,632 = 1,403,152
      // Monthly: 1,403,152 / 12 = 116,929
      expect(calculateMonthlyPension(60, 50)).toBe(116929);
    });

    it("adds spouse pension (approx 65,000) at user age 62", () => {
      // User part: 116,929
      // Spouse part: 780,000 / 12 = 65,000
      // Total: 116,929 + 65,000 = 181,929
      expect(calculateMonthlyPension(62, 50)).toBe(181929);
    });

    it("adjusts user pension based on FIRE age", () => {
      // FIRE at 40 (Participation stops before age 44 data point)
      // User Basic (60): 533,520
      // User Kosei (65): 892,252 (capped at accrued amount so far)
      // User Kosei (60): 892,252 * 0.76 = 678,112
      // Total (60): 533,520 + 678,112 = 1,211,632
      // Monthly: 1,211,632 / 12 = 100,969
      expect(calculateMonthlyPension(60, 40)).toBe(100969);
    });

    it("caps participation at age 60", () => {
      // FIRE at 65, but participation for pension calculation caps at 60
      expect(calculateMonthlyPension(60, 65)).toBe(calculateMonthlyPension(60, 60));
    });
  });

  describe("pension impact on simulation", () => {
    it("reduces requiredAssets when pension is near", () => {
      const params = {
        initialAssets: 10000000,
        riskAssets: 0,
        annualReturnRate: 0,
        monthlyExpense: 200000,
        currentAge: 59,
        maxMonths: 1,
        includePension: true,
      };
      const resultAt59 = generateGrowthTable(params);
      const resultAt40 = generateGrowthTable({ ...params, currentAge: 40 });

      // Required assets at age 59 should be much lower than at age 40 because pension starts in 1 year
      expect(resultAt59.table[0].requiredAssets).toBeLessThan(resultAt40.table[0].requiredAssets);
    });

    it("includes pension in post-FIRE cash flow", () => {
      // Start at age 60, already FIRE'd
      const initialAssets = 100000000;
      const monthlyExpense = 200000;
      const pension = calculateMonthlyPension(60, 60);

      const result = generateGrowthTable({
        initialAssets,
        riskAssets: 0,
        annualReturnRate: 0,
        monthlyExpense,
        currentAge: 60,
        maxMonths: 1,
        withdrawalRate: 0,
        includePension: true,
      });

      // assets at m1 = initial + pension - expense
      // 100,000,000 + 116,666 - 200,000 = 99,916,666
      expect(result.table[1].assets).toBe(initialAssets + pension - monthlyExpense);
    });

    it("handles tax with pension enabled", () => {
      const result = generateGrowthTable({
        initialAssets: 10000000,
        riskAssets: 0,
        annualReturnRate: 0.05,
        monthlyExpense: 200000,
        currentAge: 50,
        maxMonths: 1,
        includePension: true,
        includeTax: true,
        taxRate: 0.2,
      });
      expect(result.table[0].requiredAssets).toBeGreaterThan(0);
    });

    it("works in simulateFire with pension enabled", () => {
      const result = simulateFire({
        initialAssets: 1000000,
        riskAssets: 0,
        annualReturnRate: 0.05,
        annualStandardDeviation: 0.1,
        monthlyExpense: 200000,
        currentAge: 50,
        iterations: 1,
        includePension: true,
      });
      expect(result.stats.median).toBeDefined();
    });
  });

  describe("generateAnnualSimulation", () => {
    const params = {
      initialAssets: 10000000,
      riskAssets: 5000000,
      annualReturnRate: 0.05,
      monthlyExpense: 200000,
      monthlyIncome: 300000,
      currentAge: 40,
    };

    it("generates annual data until age 100", () => {
      const result = generateAnnualSimulation(params);
      // From age 40 to 100 (inclusive) -> 40, 41, ..., 100 is 61 points
      expect(result.length).toBe(61);
      expect(result[0].age).toBe(40);
      expect(result[result.length - 1].age).toBe(100);
    });

    it("aggregates monthly income and expenses into annual values", () => {
      const result = generateAnnualSimulation({
        ...params,
        annualReturnRate: 0,
        includeInflation: false,
      });
      // 12 months * 300k = 3.6M
      expect(result[0].income).toBe(3600000);
      // 12 months * 200k = 2.4M
      expect(result[0].expenses).toBe(2400000);
    });

    it("handles pension and transition to FIRE", () => {
      const result = generateAnnualSimulation({
        ...params,
        initialAssets: 100000000, // already FIRE
        includePension: true,
        currentAge: 59,
      });
      // Age 59: FIRE'd, income 0, pension 0
      expect(result[0].age).toBe(59);
      expect(result[0].income).toBe(0);
      expect(result[0].pension).toBe(0);

      // Age 60: Pension starts (around 116k * 12 = 1.4M)
      expect(result[1].age).toBe(60);
      expect(result[1].pension).toBeGreaterThan(1000000);
    });

    it("calculates withdrawal amount when expenses > income", () => {
      const result = generateAnnualSimulation({
        ...params,
        initialAssets: 0,
        riskAssets: 0,
        monthlyIncome: 100000,
        monthlyExpense: 200000,
        annualReturnRate: 0,
      });
      // Shortfall: 100k/month * 12 = 1.2M
      expect(result[0].withdrawal).toBe(1200000);
    });

    it("maintains risk asset ratio", () => {
      const result = generateAnnualSimulation({
        ...params,
        initialAssets: 10000000,
        riskAssets: 8000000, // 80%
      });
      const year0 = result[0];
      expect(year0.riskAssets / year0.assets).toBeCloseTo(0.8, 2);
    });

    it("handles mid-year mortgage payoff", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-10T09:00:00+09:00"));

      const result = generateAnnualSimulation({
        ...params,
        currentAge: 40,
        mortgageMonthlyPayment: 100000,
        mortgagePayoffDate: "2026-07", // 6 months of mortgage in the first year
        monthlyExpense: 200000, // base expense
      });

      // Total expenses for first year:
      // Jan-Jun: 200k (incl mortgage if baseExpense includes it?)
      // Wait, in our logic baseMonthlyExpense is the total expense,
      // and mortgage is subtracted after payoff.
      // So first 6 months: 200k
      // Next 6 months: 200k - 100k = 100k
      // Total: 6 * 200k + 6 * 100k = 1.2M + 0.6M = 1.8M
      expect(result[0].expenses).toBe(1800000);

      vi.useRealTimers();
    });

    it("handles tax on withdrawal", () => {
      const result = generateAnnualSimulation({
        ...params,
        initialAssets: 0,
        riskAssets: 0,
        monthlyIncome: 0,
        monthlyExpense: 100000,
        includeTax: true,
        taxRate: 0.2,
      });
      // Shortfall 100k -> Gross up 125k. Annual: 125k * 12 = 1.5M
      expect(result[0].withdrawal).toBe(1500000);
    });

    it("handles tax on withdrawal when post-FIRE", () => {
      const result = generateAnnualSimulation({
        ...params,
        initialAssets: 100000000,
        monthlyExpense: 100000,
        includeTax: true,
        taxRate: 0.2,
        withdrawalRate: 0,
      });
      // 100k / 0.8 = 125k. Annual: 1.5M
      expect(result[0].withdrawal).toBe(1500000);
    });

    it("handles inflation", () => {
      const result = generateAnnualSimulation({
        ...params,
        includeInflation: true,
        inflationRate: 0.1,
      });
      expect(result[1].expenses).toBeGreaterThan(result[0].expenses);
    });

    it("sets assets to 0 if they go negative", () => {
      const result = generateAnnualSimulation({
        ...params,
        initialAssets: 1000,
        monthlyIncome: 0,
        monthlyExpense: 1000000,
      });
      expect(result[1].assets).toBe(0);
    });
  });
});
