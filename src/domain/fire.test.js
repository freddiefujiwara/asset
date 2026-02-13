import { describe, it, expect, vi } from "vitest";
import {
  calculateRiskAssets,
  estimateMonthlyExpenses,
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

  describe("estimateMonthlyExpenses", () => {
    it("calculates average monthly expenses and breakdown", () => {
      const cashFlow = [
        { date: "2026-02-01", amount: -100, isTransfer: false, category: "Food" },
        { date: "2026-02-02", amount: -200, isTransfer: false, category: "Housing" },
        { date: "2026-01-01", amount: -300, isTransfer: false, category: "Food" },
        { date: "2026-01-02", amount: -400, isTransfer: false, category: "Housing" },
      ];
      const result = estimateMonthlyExpenses(cashFlow);
      expect(result.total).toBe(500);
      expect(result.breakdown).toContainEqual({ name: "Food", amount: 200 });
      expect(result.breakdown).toContainEqual({ name: "Housing", amount: 300 });
    });

    it("excludes special expenses and returns them separately", () => {
      const cashFlow = [
        { date: "2026-02-01", amount: -1000, isTransfer: false, category: "特別な支出/旅行" },
        { date: "2026-02-01", amount: -500, isTransfer: false, category: "Food" },
      ];
      const result = estimateMonthlyExpenses(cashFlow);
      expect(result.total).toBe(500);
      expect(result.averageSpecial).toBe(1000);
    });

    it("handles transfers, income, and missing categories", () => {
      const cashFlow = [
        { date: "2026-02-01", amount: 1000, isTransfer: false, category: "Income" },
        { date: "2026-02-01", amount: -100, isTransfer: true, category: "Transfer" },
        { date: "2026-02-01", amount: -200, isTransfer: false, category: "" }, // should be 未分類
      ];
      const result = estimateMonthlyExpenses(cashFlow);
      expect(result.total).toBe(200);
      expect(result.breakdown).toContainEqual({ name: "未分類", amount: 200 });
    });

    it("excludes Cash and Card categories", () => {
      const cashFlow = [
        { date: "2026-02-01", amount: -1000, isTransfer: false, category: "Food" },
        { date: "2026-02-01", amount: -500, isTransfer: false, category: "現金・カード/現金引き出し" },
        { date: "2026-02-01", amount: -300, isTransfer: false, category: "カード/支払い" },
      ];
      const result = estimateMonthlyExpenses(cashFlow);
      expect(result.total).toBe(1000);
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0].name).toBe("Food");
    });

    it("returns zeros for empty cash flow", () => {
      const result = estimateMonthlyExpenses([]);
      expect(result.total).toBe(0);
      expect(result.breakdown).toEqual([]);
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
  });
});
