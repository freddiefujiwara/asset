import { describe, it, expect } from "vitest";
import {
  filterCashFlow,
  getKPIs,
  aggregateByMonth,
  aggregateByCategory,
  getUniqueMonths,
  getUniqueCategories,
} from "./cashFlow";

const mockCashFlow = [
  { date: "2026-02-12", amount: -3000, category: "Food", isTransfer: false, name: "Super" },
  { date: "2026-02-11", amount: 5000, category: "", isTransfer: true, name: "Charge" },
  { date: "2026-02-10", amount: 300000, category: "Salary", isTransfer: false, name: "Job" },
  { date: "2026-01-05", amount: -80000, category: "Rent", isTransfer: false, name: "Home" },
  { date: "2026-01-01", amount: -1000, category: "", isTransfer: false, name: "Misc" },
];

describe("cashFlow domain", () => {
  describe("filterCashFlow", () => {
    it("returns all when no filters provided", () => {
      expect(filterCashFlow(mockCashFlow)).toHaveLength(5);
    });

    it("filters by month", () => {
      expect(filterCashFlow(mockCashFlow, { month: "2026-02" })).toHaveLength(3);
      expect(filterCashFlow(mockCashFlow, { month: "2026-03" })).toHaveLength(0);
    });

    it("filters by category", () => {
      expect(filterCashFlow(mockCashFlow, { category: "Food" })).toHaveLength(1);
      expect(filterCashFlow(mockCashFlow, { category: "未分類" })).toHaveLength(2); // Charge (isTransfer: true) and Misc (isTransfer: false)
    });

    it("filters by transfers", () => {
      expect(filterCashFlow(mockCashFlow, { includeTransfers: false })).toHaveLength(4);
      expect(filterCashFlow(mockCashFlow, { includeTransfers: true })).toHaveLength(5);
    });

    it("filters by search", () => {
      expect(filterCashFlow(mockCashFlow, { search: "Super" })).toHaveLength(1);
      expect(filterCashFlow(mockCashFlow, { search: "Rent" })).toHaveLength(1);
      expect(filterCashFlow(mockCashFlow, { search: "none" })).toHaveLength(0);
      expect(filterCashFlow(mockCashFlow, { search: "未分類" })).toHaveLength(2);
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

  describe("aggregateByMonth", () => {
    it("aggregates data correctly", () => {
      const result = aggregateByMonth(mockCashFlow);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        month: "2026-01",
        income: 0,
        expense: 81000,
        net: -81000,
      });
      expect(result[1]).toEqual({
        month: "2026-02",
        income: 300000,
        expense: 3000,
        net: 297000,
      });
    });

    it("ignores items with invalid dates", () => {
      const invalidData = [
        { date: "2026", amount: 100, isTransfer: false },
        { date: "", amount: 100, isTransfer: false },
      ];
      expect(aggregateByMonth(invalidData)).toHaveLength(0);
    });
  });

  describe("aggregateByCategory", () => {
    it("aggregates only expenses and groups them", () => {
      const result = aggregateByCategory(mockCashFlow);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ label: "Rent", value: 80000 });
      expect(result[1]).toEqual({ label: "Food", value: 3000 });
      expect(result[2]).toEqual({ label: "未分類", value: 1000 });
    });
  });

  describe("getUniqueMonths", () => {
    it("returns sorted unique months", () => {
      expect(getUniqueMonths(mockCashFlow)).toEqual(["2026-02", "2026-01"]);
    });

    it("handles invalid dates", () => {
        const data = [{ date: "2026" }];
        expect(getUniqueMonths(data)).toHaveLength(0);
    });
  });

  describe("getUniqueCategories", () => {
    it("returns sorted unique categories", () => {
      expect(getUniqueCategories(mockCashFlow)).toEqual(["Food", "Rent", "Salary", "未分類"]);
    });
  });
});
