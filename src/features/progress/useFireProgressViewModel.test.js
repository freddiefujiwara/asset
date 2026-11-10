import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dataRef = ref(null);

vi.mock("@/composables/usePortfolioData", () => ({
  usePortfolioData: () => ({
    data: dataRef,
    loading: ref(false),
    error: ref(""),
    rawResponse: ref(null),
  }),
}));

import { useFireProgressViewModel } from "@/features/progress/useFireProgressViewModel";
import { usePortfolioStore } from "@/stores/portfolio";
import { shiftMonthKey } from "@/domain/home";

function monthKey(offset) {
  const now = new Date();
  return shiftMonthKey(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, offset);
}

function buildPortfolio() {
  const cashFlow = [];
  for (let i = 1; i <= 12; i++) {
    const month = monthKey(-i);
    cashFlow.push({ date: `${month}-25`, amount: 830660, name: "給与", category: "収入/給与", isTransfer: false });
    cashFlow.push({ date: `${month}-05`, amount: -483688, name: "生活費", category: "食費/食料品", isTransfer: false });
    cashFlow.push({ date: `${month}-27`, amount: -61089, name: "返済", category: "住宅/ローン返済", isTransfer: false });
  }
  // 賞与（ピーク月 x2 の推計に使う）
  cashFlow.push({ date: `${monthKey(-5)}-15`, amount: 1445229, name: "賞与", category: "収入/一時所得", isTransfer: false });

  return {
    totals: { assetsYen: 78139712, liabilitiesYen: 11510887, netWorthYen: 66628825 },
    holdings: {
      cashLike: [{ "名称": "銀行預金", "残高": 7502164 }],
      stocks: [{ "名称": "株式A", "評価額": 17538769 }],
      funds: [{ "名称": "投信A", "評価額": 49569663 }],
      pensions: [{ "名称": "確定拠出年金", "現在価値": 3457712 }],
      points: [],
      liabilitiesDetail: [],
    },
    cashFlow,
    snapshots: [
      { month: monthKey(-2), totalAssetsYen: 77000000, totalLiabilitiesYen: 11600000, netAssetsYen: 65400000, cashYen: 7000000, riskAssetsYen: 69000000, livingCost12mAvgYen: 470000, income12mAvgYen: 1050000 },
      { month: monthKey(-1), totalAssetsYen: 78139712, totalLiabilitiesYen: 11510887, netAssetsYen: 66628825, cashYen: 7502164, riskAssetsYen: 70630234, livingCost12mAvgYen: 461012, income12mAvgYen: 1056465 },
    ],
  };
}

describe("useFireProgressViewModel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const portfolio = buildPortfolio();
    dataRef.value = portfolio;
    const portfolioStore = usePortfolioStore();
    portfolioStore.data = portfolio;
    portfolioStore.shareMode = false;
  });

  it("describes side FIRE as the main indicator with duration, date and age", () => {
    const vm = useFireProgressViewModel();
    expect(vm.progress.value.fireTargetAssetsYen).toBe(78139712 - 10450000);
    expect(vm.sideProgress.value.reached).toBe(true);
    expect(vm.sideProgress.value.durationLabel).toMatch(/年|ヶ月/);
    expect(vm.sideProgress.value.dateLabel).toMatch(/^\d{4}年\d{1,2}月$/);
    expect(vm.sideProgress.value.ageLabel).toMatch(/^\d+歳$/);
    expect(vm.sideProgress.value.progressRatePct).toBeGreaterThan(0);
    // サイドFIREは完全FIREより早く届く
    expect(vm.sideProgress.value.monthsToReach).toBeLessThan(vm.fullProgress.value.monthsToReach);
  });

  it("builds the trend from snapshots and formats milestones", () => {
    const vm = useFireProgressViewModel();
    expect(vm.trend.value.hasTrend).toBe(true);
    expect(vm.trend.value.points).toHaveLength(2);
    expect(vm.milestones.value).toEqual([
      { id: "age-50", label: "50歳", monthKey: "2029-09", dateLabel: "2029年9月", ageLabel: "50歳" },
      { id: "daughter-independence", label: "娘の独立", monthKey: "2037-04", dateLabel: "2037年4月", ageLabel: "57歳" },
      { id: "mortgage-payoff", label: "住宅ローン完済", monthKey: "2042-05", dateLabel: "2042年5月", ageLabel: "62歳" },
    ]);
  });

  it("reflects share mode from the portfolio store", () => {
    const portfolioStore = usePortfolioStore();
    portfolioStore.shareMode = true;
    const vm = useFireProgressViewModel();
    expect(vm.shareMode.value).toBe(true);
  });
});
