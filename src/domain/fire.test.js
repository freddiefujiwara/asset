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

    it("sums only risk assets", () => {
      const portfolio = {
        summary: {
          assetsByClass: [
            { name: "預金・現金", amountYen: 1000 },
            { name: "株式（現物）", amountYen: 2000 },
            { name: "投資信託", amountYen: 3000 },
            { name: "ポイント・マイル", amountYen: 400 },
            { name: "年金", amountYen: 5000 },
          ],
        },
      };
      // Risk: 2000 + 3000 + 5000 = 10000
      expect(calculateRiskAssets(portfolio)).toBe(10000);
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

    it("subtracts monthly investment from expenses", () => {
      const cashFlow = [
        { date: "2026-02-01", amount: -1000, isTransfer: false, category: "Misc" },
      ];
      const result = estimateMonthlyExpenses(cashFlow, 400);
      expect(result.total).toBe(600);
    });

    it("ensures estimated expenses are not negative", () => {
      const cashFlow = [
        { date: "2026-02-01", amount: -100, isTransfer: false, category: "Misc" },
      ];
      const result = estimateMonthlyExpenses(cashFlow, 400);
      expect(result.total).toBe(0);
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
        targetMultiplier: 25, // 30M required
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
        monthlyInvestment: 1000,
        monthlyExpense: 1000,
        annualReturnRate: 0,
        annualStandardDeviation: 0,
        targetMultiplier: 1000, // required = 1000 * 12 * 1000 = 12,000,000
        maxMonths: 5,
        iterations: 1
      });
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

    it("detects FIRE reached month", () => {
      const result = generateGrowthTable({
        ...params,
        initialAssets: 50000000,
        monthlyExpense: 100000,
      });
      expect(result.fireReachedMonth).toBe(0);
      expect(result.table[0].isFire).toBe(true);
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
