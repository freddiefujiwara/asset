import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useFireSimulatorStore } from "./fireSimulator";
import { usePortfolioStore } from "./portfolio";
import { EMPTY_SUMMARY } from "@/features/fireSimulator/formatters";

describe("fireSimulator store derived values", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("falls back to zeroed values while no portfolio data is loaded", () => {
    const store = useFireSimulatorStore();
    expect(store.firePortfolio).toEqual({
      totalAssetsYen: 0,
      riskAssetsYen: 0,
      cashAssetsYen: 0,
      liabilitiesYen: 0,
      netWorthYen: 0,
    });
    expect(store.initialAssets).toBe(0);
    expect(store.past12MonthSummary).toEqual(EMPTY_SUMMARY);
    expect(store.autoMortgageMonthlyPayment).toBe(0);
  });

  it("keeps the fallbacks when the portfolio has no cash flow rows", () => {
    const portfolioStore = usePortfolioStore();
    portfolioStore.data = { totals: { assetsYen: 0 }, holdings: {} };
    const store = useFireSimulatorStore();
    expect(store.past12MonthSummary).toEqual(EMPTY_SUMMARY);
    expect(store.autoMortgageMonthlyPayment).toBe(0);
  });

  it("derives summaries from the portfolio cash flow when present", () => {
    const portfolioStore = usePortfolioStore();
    portfolioStore.data = {
      totals: { assetsYen: 1000000 },
      holdings: {},
      cashFlow: [
        { date: "2026-10-05", amount: -50000, category: "食費/食料品", name: "買い物", isTransfer: false },
        { date: "2026-10-25", amount: 500000, category: "収入/給与", name: "給与", isTransfer: false },
      ],
    };
    const store = useFireSimulatorStore();
    expect(store.past12MonthSummary).not.toEqual(EMPTY_SUMMARY);
    expect(store.autoMortgageMonthlyPayment).toBeGreaterThanOrEqual(0);
  });

  it("uses the manual values when the automatic toggles are off", () => {
    const store = useFireSimulatorStore();
    store.manualMonthlyExpense = 234567;
    store.useAutoExpense = false;
    expect(store.monthlyExpense).toBe(234567);

    store.manualRegularMonthlyIncome = 456789;
    store.useAutoIncome = false;
    expect(store.regularMonthlyIncome).toBe(456789);

    store.manualAnnualBonus = 120000;
    store.useAutoBonus = false;
    expect(store.annualBonus).toBe(120000);

    store.includeBonus = false;
    expect(store.annualBonus).toBe(0);
  });
});
