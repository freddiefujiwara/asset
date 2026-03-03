import { nextTick, ref, reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

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

vi.mock("@/lib/lzString", () => ({
  compressToEncodedURIComponent: vi.fn((val) => val),
}));

vi.mock("@/domain/fire", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    calculateFirePortfolio: () => ({ totalAssetsYen: 1000, riskAssetsYen: 700, cashAssetsYen: 300 }),
    getPast5MonthSummary: () => ({
      monthlyLivingExpenses: { average: 100, breakdown: [], averageSpecial: 0 },
      monthlyRegularIncome: { average: 200, breakdown: [] },
      annualBonus: { average: 120, breakdown: [] },
      monthCount: 5,
    }),
    estimateMortgageMonthlyPayment: () => 10,
    generateGrowthTable: () => ({ fireReachedMonth: 12, table: [{ month: 12, assets: 777 }] }),
    generateAnnualSimulation: () => [{ age: 40, income: 10, pension: 2, expenses: 3, investmentGain: 4, withdrawal: 5, assets: 6, cashAssets: 7, riskAssets: 8 }],
    runMonteCarloSimulation: () => ({ successRate: 0.5, p10: 1, p50: 2, p90: 3, trials: 100 }),
    calculateDaughterAssetsBreakdown: () => ({}),
    generateAlgorithmExplanationSegments: () => [{ value: "abc" }],
  };
});

import { useFireSimulatorViewModel } from "@/features/fireSimulator/useFireSimulatorViewModel";
import { compressToEncodedURIComponent } from "@/lib/lzString";

describe("useFireSimulatorViewModel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
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

  it("includes required fixed flags in externalSimulatorUrl payload", () => {
    const vm = useFireSimulatorViewModel();
    const url = vm.externalSimulatorUrl.value;

    // Since we mocked compressToEncodedURIComponent to return the input string
    const payloadStr = url.replace("https://freddiefujiwara.com/fire/", "").replace(/_/g, "+");
    const payload = JSON.parse(payloadStr);

    expect(payload.mpffyeem).toBe(true);
    expect(payload.mabm).toBe(true);
    expect(payload.mctsr).toBe(80);
    expect(payload.sea).toBe(100);
    expect(payload.wm).toBe("max");
    expect(payload.pc.earlyReduction).toBeUndefined();
    expect(compressToEncodedURIComponent).toHaveBeenCalled();
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
