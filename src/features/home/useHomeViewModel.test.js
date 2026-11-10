import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dataRef = ref(null);
const shareModeRef = ref(false);

vi.mock("@/composables/usePortfolioData", () => ({
  usePortfolioData: () => ({
    data: dataRef,
    loading: ref(false),
    error: ref(""),
    rawResponse: ref(null),
  }),
}));

vi.mock("@/stores/portfolio", () => ({
  usePortfolioStore: () => ({ shareMode: shareModeRef.value }),
}));

import { useHomeViewModel } from "@/features/home/useHomeViewModel";
import { shiftMonthKey } from "@/domain/home";

function monthKey(offset) {
  const now = new Date();
  return shiftMonthKey(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, offset);
}

function buildData() {
  const cashFlow = [];
  for (let i = 1; i <= 12; i++) {
    const month = monthKey(-i);
    cashFlow.push({ date: `${month}-05`, amount: -160000, name: "食料品", category: "食費/食料品", isTransfer: false });
  }
  cashFlow.push({
    date: `${monthKey(-1)}-24`,
    amount: -149856,
    name: "ラクテンショウケンカブシキガイシャ (投信積立代金)",
    category: "",
    isTransfer: true,
  });
  cashFlow.push({
    date: `${monthKey(-1)}-02`,
    amount: -162550,
    name: "定期券",
    category: "特別な支出/その他特別な支出",
    isTransfer: false,
  });
  cashFlow.push({ date: `${monthKey(0)}-01`, amount: -100, name: "最新明細", category: "食費/食料品", isTransfer: false });

  return {
    cashFlow,
    snapshots: [
      { month: monthKey(-2), totalAssetsYen: 77000000, totalLiabilitiesYen: 11600000, netAssetsYen: 65400000, cashYen: 7000000, riskAssetsYen: 69000000, livingCost12mAvgYen: 470000, income12mAvgYen: 1050000 },
      { month: monthKey(-1), totalAssetsYen: 78139712, totalLiabilitiesYen: 11510887, netAssetsYen: 66628825, cashYen: 7502164, riskAssetsYen: 70630234, livingCost12mAvgYen: 461012, income12mAvgYen: 1056465 },
    ],
  };
}

describe("useHomeViewModel", () => {
  beforeEach(() => {
    localStorage.clear();
    shareModeRef.value = false;
    dataRef.value = buildData();
  });

  it("builds all action cards from the portfolio data", () => {
    const vm = useHomeViewModel();
    expect(vm.investmentCard.value.lastMonth.amountYen).toBe(149856);
    expect(vm.investmentCard.value.status).toBe("attention");
    expect(vm.livingCostCard.value.lastMonth.amountYen).toBe(160000);
    expect(vm.livingCostCard.value.status).toBe("ok");
    expect(vm.specialExpenseCard.value.lastMonth.totalYen).toBe(162550);
    expect(vm.freshnessCard.value.latestDate).toBe(`${monthKey(0)}-01`);
    expect(vm.monthlyChanges.value.available).toBe(true);
    expect(vm.monthlyChanges.value.rows.map((row) => row.key)).toEqual([
      "netAssets",
      "fireTargetAssets",
      "livingCostAverage",
    ]);
  });

  it("hides the FIRE target row in share mode", () => {
    shareModeRef.value = true;
    const vm = useHomeViewModel();
    expect(vm.shareMode.value).toBe(true);
    expect(vm.monthlyChanges.value.rows.map((row) => row.key)).toEqual([
      "netAssets",
      "livingCostAverage",
    ]);
  });

  it("persists checklist toggles in localStorage under a monthly key", () => {
    const vm = useHomeViewModel();
    expect(vm.checklistItems.value.every((item) => !item.checked)).toBe(true);

    vm.toggleChecklistItem("fire-progress");
    expect(vm.checklistItems.value.find((item) => item.id === "fire-progress").checked).toBe(true);

    const key = Object.keys(localStorage).find((k) => k.startsWith("asset-monthly-checklist:"));
    expect(key).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(key))).toEqual(["fire-progress"]);

    // A fresh view model in the same month restores the state.
    const vm2 = useHomeViewModel();
    expect(vm2.checklistItems.value.find((item) => item.id === "fire-progress").checked).toBe(true);

    vm2.toggleChecklistItem("fire-progress");
    expect(vm2.checklistItems.value.find((item) => item.id === "fire-progress").checked).toBe(false);
  });
});
