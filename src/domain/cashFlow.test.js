import { describe, it, expect } from "vitest";
import {
  filterCashFlow,
  getKPIs,
  aggregateByMonth,
  aggregateByCategory,
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
        // ["Food/Dining", "Food/Grocery", "Rent", "Salary", "未分類"] (sorted alphabetically)
        expect(sorted[0].category).toBe("Food/Dining");
        expect(sorted[4].category).toBe("");
    });
  });

  describe("getKPIs", () => {
    it("calculates correct KPIs", () => {
      const kpis = getKPIs(mockCashFlow);
      expect(kpis.income).toBe(300000);
      expect(kpis.expense).toBe(-84000); // -3000 + -80000 + -1000
    });
  });
});
