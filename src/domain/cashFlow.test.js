import { describe, it, expect } from "vitest";
import {
  filterCashFlow,
  getKPIs,
  aggregateByMonth,
  aggregateByCategory,
  getSixMonthAverages,
  getUniqueMonths,
  getUniqueCategories,
  getUniqueLargeCategories,
  getUniqueSmallCategories,
  sortCashFlow,
} from "./cashFlow";

const mockCashFlow = [
  { date: "2026-02-12", amount: -3000, category: "Food/Grocery", isTransfer: false, name: "Super" },
  { date: "2026-02-11", amount: 5000, category: "", isTransfer: true, name: "Charge" },
  { date: "2026-02-10", amount: 300000, category: "Salary", isTransfer: false, name: "Job" },
  { date: "2026-01-05", amount: -80000, category: "Rent", isTransfer: false, name: "Home" },
  { date: "2026-01-01", amount: -1000, category: "Food/Dining", isTransfer: false, name: "Restaurant" },
];

describe("cashFlow domain", () => {
  describe("filterCashFlow", () => {
    it("returns all when no filters provided", () => {
      expect(filterCashFlow(mockCashFlow)).toHaveLength(5);
    });

    it("filters by largeCategory", () => {
      expect(filterCashFlow(mockCashFlow, { largeCategory: "Food" })).toHaveLength(2);
      expect(filterCashFlow(mockCashFlow, { largeCategory: "Salary" })).toHaveLength(1);
      expect(filterCashFlow(mockCashFlow, { largeCategory: "未分類" })).toHaveLength(1);
    });

    it("filters by smallCategory", () => {
      expect(filterCashFlow(mockCashFlow, { largeCategory: "Food", smallCategory: "Grocery" })).toHaveLength(1);
      expect(filterCashFlow(mockCashFlow, { largeCategory: "Food", smallCategory: "Dining" })).toHaveLength(1);
      expect(filterCashFlow(mockCashFlow, { largeCategory: "Salary", smallCategory: "Dining" })).toHaveLength(0);
    });

    it("filters by month", () => {
      expect(filterCashFlow(mockCashFlow, { month: "2026-02" })).toHaveLength(3);
    });

    it("filters by category (exact match)", () => {
      expect(filterCashFlow(mockCashFlow, { category: "Food/Grocery" })).toHaveLength(1);
      expect(filterCashFlow(mockCashFlow, { category: "Food" })).toHaveLength(0);
    });

    it("filters by search", () => {
      expect(filterCashFlow(mockCashFlow, { search: "Food" })).toHaveLength(2);
      expect(filterCashFlow(mockCashFlow, { search: "Grocery" })).toHaveLength(1);
      expect(filterCashFlow(mockCashFlow, { search: "restaurant" })).toHaveLength(1);
    });

    it("can exclude transfer rows", () => {
      expect(filterCashFlow(mockCashFlow, { includeTransfers: false })).toHaveLength(4);
    });
  });

  describe("getUniqueLargeCategories", () => {
    it("returns sorted unique large categories", () => {
      expect(getUniqueLargeCategories(mockCashFlow)).toEqual(["Food", "Rent", "Salary", "未分類"]);
    });
  });

  describe("getUniqueSmallCategories", () => {
    it("returns sorted unique small categories for a large category", () => {
      expect(getUniqueSmallCategories(mockCashFlow, "Food")).toEqual(["Dining", "Grocery"]);
      expect(getUniqueSmallCategories(mockCashFlow, "Salary")).toEqual([]);
      expect(getUniqueSmallCategories(mockCashFlow, "未分類")).toEqual([]);
    });

    it("returns empty when largeCategory is not provided", () => {
      expect(getUniqueSmallCategories(mockCashFlow, "")).toEqual([]);
      expect(getUniqueSmallCategories(mockCashFlow)).toEqual([]);
    });
  });

  describe("sortCashFlow", () => {
    it("sorts by date asc", () => {
      const sorted = sortCashFlow(mockCashFlow, "date", "asc");
      expect(sorted[0].date).toBe("2026-01-01");
      expect(sorted[4].date).toBe("2026-02-12");
    });

    it("sorts by date desc", () => {
      const sorted = sortCashFlow(mockCashFlow, "date", "desc");
      expect(sorted[0].date).toBe("2026-02-12");
      expect(sorted[4].date).toBe("2026-01-01");
    });

    it("sorts by amount asc", () => {
      const sorted = sortCashFlow(mockCashFlow, "amount", "asc");
      expect(sorted[0].amount).toBe(-80000);
      expect(sorted[4].amount).toBe(300000);
    });

    it("sorts by category asc handling 未分類", () => {
      const sorted = sortCashFlow(mockCashFlow, "category", "asc");
      expect(sorted[0].category).toBe("Food/Dining");
      expect(sorted[4].category).toBe("");
    });

    it("returns original reference when sortKey is missing", () => {
      expect(sortCashFlow(mockCashFlow)).toBe(mockCashFlow);
    });

    it("keeps equal values when comparator returns 0", () => {
      const sameAmount = [
        { date: "2026-02-01", amount: 1, category: "A", isTransfer: false, name: "a" },
        { date: "2026-02-02", amount: 1, category: "B", isTransfer: false, name: "b" },
      ];
      const sorted = sortCashFlow(sameAmount, "amount", "asc");
      expect(sorted).toEqual(sameAmount);
    });

    it("handles greater-than branch in descending order", () => {
      const values = [
        { date: "2026-02-01", amount: 2, category: "A", isTransfer: false, name: "a" },
        { date: "2026-02-02", amount: 1, category: "B", isTransfer: false, name: "b" },
      ];
      const sorted = sortCashFlow(values, "amount", "desc");
      expect(sorted[0].amount).toBe(2);
    });

    it("handles greater-than branch in ascending order", () => {
      const values = [
        { date: "2026-02-01", amount: 2, category: "A", isTransfer: false, name: "a" },
        { date: "2026-02-02", amount: 1, category: "B", isTransfer: false, name: "b" },
      ];
      const sorted = sortCashFlow(values, "amount", "asc");
      expect(sorted[0].amount).toBe(1);
    });
  });

  describe("aggregateByMonth", () => {
    it("aggregates filtered monthly values", () => {
      const filtered = filterCashFlow(mockCashFlow, { largeCategory: "Food" });
      expect(aggregateByMonth(filtered)).toEqual([
        { month: "2026-01", income: 0, expense: 1000, net: -1000 },
        { month: "2026-02", income: 0, expense: 3000, net: -3000 },
      ]);
    });

    it("skips net calculations when includeNet is false", () => {
      const filtered = filterCashFlow(mockCashFlow, { largeCategory: "Food" });
      expect(aggregateByMonth(filtered, { includeNet: false })).toEqual([
        { month: "2026-01", income: 0, expense: 1000, net: 0 },
        { month: "2026-02", income: 0, expense: 3000, net: 0 },
      ]);
    });

    it("ignores transfers and invalid month formats", () => {
      const mixed = [
        ...mockCashFlow,
        { date: "", amount: 10, category: "Misc", isTransfer: false, name: "InvalidDate" },
      ];
      const aggregated = aggregateByMonth(mixed);
      expect(aggregated.find((row) => row.month === "")).toBeUndefined();
      expect(aggregated).toEqual([
        { month: "2026-01", income: 0, expense: 81000, net: -81000 },
        { month: "2026-02", income: 300000, expense: 3000, net: 297000 },
      ]);
    });
  });

  describe("getSixMonthAverages", () => {
    it("returns averages for up to latest 6 months", () => {
      const monthly = [
        { month: "2025-09", income: 100, expense: 10, net: 90 },
        { month: "2025-10", income: 200, expense: 20, net: 180 },
        { month: "2025-11", income: 300, expense: 30, net: 270 },
        { month: "2025-12", income: 400, expense: 40, net: 360 },
        { month: "2026-01", income: 500, expense: 50, net: 450 },
        { month: "2026-02", income: 600, expense: 60, net: 540 },
        { month: "2026-03", income: 700, expense: 70, net: 630 },
      ];

      expect(getSixMonthAverages(monthly)).toEqual({
        income: 450,
        expense: 45,
        net: 405,
        count: 6,
      });
    });

    it("returns zeros for empty input", () => {
      expect(getSixMonthAverages([])).toEqual({ income: 0, expense: 0, net: 0, count: 0 });
    });
  });

  describe("getKPIs", () => {
    it("calculates correct KPIs", () => {
      const kpis = getKPIs(mockCashFlow);
      expect(kpis).toEqual({
        income: 300000,
        expense: -84000,
        net: 216000,
        transfers: 5000,
      });
    });
  });

  describe("aggregateByCategory", () => {
    it("aggregates expense-only categories sorted desc", () => {
      const withUncategorizedExpense = [
        ...mockCashFlow,
        { date: "2026-02-20", amount: -500, category: "", isTransfer: false, name: "Unknown" },
      ];
      expect(aggregateByCategory(withUncategorizedExpense)).toEqual([
        { label: "Rent", value: 80000 },
        { label: "Food/Grocery", value: 3000 },
        { label: "Food/Dining", value: 1000 },
        { label: "未分類", value: 500 },
      ]);
    });
  });

  describe("getUniqueMonths", () => {
    it("returns months in descending order", () => {
      const withInvalid = [
        ...mockCashFlow,
        { date: "2026", amount: 1, category: "Misc", isTransfer: false, name: "Bad" },
      ];
      expect(getUniqueMonths(withInvalid)).toEqual(["2026-02", "2026-01"]);
    });
  });

  describe("getUniqueCategories", () => {
    it("returns sorted categories with fallback", () => {
      expect(getUniqueCategories(mockCashFlow)).toEqual(["Food/Dining", "Food/Grocery", "Rent", "Salary", "未分類"]);
    });
  });
});
