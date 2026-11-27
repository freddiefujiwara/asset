import { nextTick, ref, reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const { growthTableSpy } = vi.hoisted(() => ({ growthTableSpy: vi.fn() }));
const mockData = ref({ cashFlow: [] });

vi.mock("@/composables/usePortfolioData", () => ({
  usePortfolioData: () => ({ data: mockData, loading: ref(false), error: ref(null) }),
}));

vi.mock("@/stores/portfolio", () => ({
  usePortfolioStore: () => reactive({
    data: mockData,
    loading: false,
    error: "",
    fetchPortfolio: vi.fn(),
  }),
}));

vi.mock("@/domain/fire", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    calculateFirePortfolio: () => ({ totalAssetsYen: 1000, riskAssetsYen: 700, cashAssetsYen: 300 }),
    getPast12MonthSummary: () => ({
      monthlyLivingExpenses: { average: 100, breakdown: [], averageSpecial: 0 },
      monthlyRegularIncome: { average: 200, breakdown: [] },
      annualBonus: { average: 120, breakdown: [] },
      monthCount: 12,
    }),
    estimateMortgageMonthlyPayment: () => 10,
    generateGrowthTable: (params) => {
      growthTableSpy(params);
      return { fireReachedMonth: 12, table: [{ month: 12, assets: 777 }] };
    },
    generateAnnualSimulation: () => [{ age: 40, income: 10, pension: 2, expenses: 3, investmentGain: 4, withdrawal: 5, assets: 6, cashAssets: 7, riskAssets: 8 }],
    runMonteCarloSimulation: () => ({ successRate: 0.5, p10: 1, p50: 2, p90: 3, trials: 100 }),
    calculateDaughterAssetsBreakdown: () => ({}),
    generateAlgorithmExplanationSegments: () => [{ value: "abc" }],
  };
});

import { useFireBaseParams } from "@/features/fireSimulator/useFireBaseParams";
import { useFireSimulatorViewModel } from "@/features/fireSimulator/useFireSimulatorViewModel";

describe("useFireSimulatorViewModel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    growthTableSpy.mockClear();
    mockData.value = { cashFlow: [] };
  });

  it("derives key values and export text", () => {
    const vm = useFireSimulatorViewModel();
    expect(vm.firePortfolio.value.totalAssetsYen).toBe(1000);
    expect(vm.initialAssets.value).toBe(1000);
    expect(vm.monthlyExpense.value).toBe(100);
    expect(vm.requiredAssetsAtFire.value).toBe(777);
    expect(vm.copyAnnualTable()).toContain("incomeWithPensionYen");
    expect(vm.copyConditionsAndAlgorithm()).toContain("algorithmConstants");
    expect(vm.copyConditionsAndAlgorithm()).toContain("mortgageMonthlyPaymentYen");
  });

  it("uses the shared FIRE inputs with simulator-specific balances", () => {
    const vm = useFireSimulatorViewModel();
    const { baseParams } = useFireBaseParams();
    vm.annualReturnRate.value = 4.5;
    vm.useAutoFirstYearExtra.value = false;
    vm.manualPostFireFirstYearExtraExpense.value = 320000;

    expect(vm.growthData.value.fireReachedMonth).toBe(12);
    expect(growthTableSpy).toHaveBeenLastCalledWith({
      ...baseParams.value,
      initialAssets: 1000,
      riskAssets: 700,
    });
    expect(baseParams.value.annualReturnRate).toBeCloseTo(0.045);
    expect(vm.postFireFirstYearExtraExpense.value).toBe(320000);

    vm.useAutoFirstYearExtra.value = true;
    expect(vm.growthData.value.fireReachedMonth).toBe(12);
    expect(growthTableSpy.mock.lastCall[0].postFireFirstYearExtraExpense)
      .toBe(vm.postFireFirstYearExtraExpense.value);
    expect(vm.postFireFirstYearExtraExpense.value).not.toBe(320000);
  });

  it("runs monte carlo only when enabled and clears results when disabled", async () => {
    const vm = useFireSimulatorViewModel();
    vm.runMonteCarlo();
    expect(vm.monteCarloResults.value).toBeNull();

    vm.useMonteCarlo.value = true;
    vm.runMonteCarlo();
    vi.runAllTimers();
    expect(vm.monteCarloResults.value.successRate).toBe(0.5);

    vm.useMonteCarlo.value = false;
    vm.runMonteCarlo();
    await nextTick();
    expect(vm.monteCarloResults.value).toBeNull();
  });
});
