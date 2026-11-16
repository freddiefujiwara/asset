import { createPinia, setActivePinia } from "pinia";
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

function daysAgoKey(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildData() {
  const cashFlow = [];
  for (let i = 1; i <= 12; i++) {
    const month = monthKey(-i);
    cashFlow.push({ date: `${month}-05`, amount: -160000, name: "食料品", category: "食費/食料品", isTransfer: false });
  }
  // 先月の投資実行（本人分322,818円相当）→ 基準どおり
  cashFlow.push({
    date: `${monthKey(-1)}-26`,
    amount: -23000,
    name: "コクミンネンキンキキンレンゴウカイ(カクテイキヨシユツネンキン)",
    category: "",
    isTransfer: true,
  });
  cashFlow.push({
    date: `${monthKey(-1)}-24`,
    amount: -299818,
    name: "ラクテンショウケンカブシキガイシャ (投信積立代金)",
    category: "",
    isTransfer: true,
  });
  // 先月の大きな特別支出
  cashFlow.push({
    date: `${monthKey(-1)}-02`,
    amount: -162550,
    name: "定期券",
    category: "特別な支出/その他特別な支出",
    isTransfer: false,
  });
  // 最新明細は10日前 → 鮮度は要確認
  cashFlow.push({ date: daysAgoKey(10), amount: -100, name: "最新明細", category: "食費/食料品", isTransfer: false });

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

describe("useHomeViewModel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    shareModeRef.value = false;
    dataRef.value = buildData();
  });

  it("builds the headline from the last two snapshots", () => {
    const vm = useHomeViewModel();
    expect(vm.headline.value.hasComparison).toBe(true);
    expect(vm.headline.value.netAssetsYen).toBe(66628825);
    expect(vm.headline.value.diffYen).toBe(1228825);
  });

  it("builds the FIRE summary for the full FIRE run outside share mode", () => {
    const vm = useHomeViewModel();
    expect(vm.fireSummary.value).not.toBe(null);
    expect(vm.fireSummary.value).toHaveProperty("progressRatePct");
    expect(vm.fireSummary.value.hasTrend).toBe(true);
  });

  it("hides the FIRE summary in share mode and drops the pace from the headline", () => {
    shareModeRef.value = true;
    const vm = useHomeViewModel();
    expect(vm.shareMode.value).toBe(true);
    expect(vm.fireSummary.value).toBe(null);
    expect(vm.headline.value.pace).toBe(null);
    // 純資産の先月比そのものは共有モードでも出す
    expect(vm.headline.value.hasComparison).toBe(true);
  });

  it("collects attention items from the existing judgments, capped at three", () => {
    const vm = useHomeViewModel();
    const kinds = vm.attention.value.items.map((item) => item.kind);
    // 鮮度（最新明細が10日前）と大きな特別支出（定期券162,550円）が入る。
    // 投資は基準どおり、生活費は平均どおりなので入らない。
    expect(kinds).toEqual(["freshness", "special"]);
    expect(vm.attention.value.totalCount).toBe(2);
  });

  it("returns deadline items sorted by countdown", () => {
    const vm = useHomeViewModel();
    const items = vm.deadlineItems.value;
    expect(Array.isArray(items)).toBe(true);
    const countdowns = items.map((item) => item.countdownDays);
    expect(countdowns).toEqual([...countdowns].sort((a, b) => a - b));
    items.forEach((item) => {
      expect(item.countdownDays).toBeLessThanOrEqual(45);
    });
  });

  it("auto-checks the investment checklist item when last month met the standard", () => {
    const vm = useHomeViewModel();
    const item = vm.checklistItems.value.find((entry) => entry.id === "investment-standard");
    expect(item).toMatchObject({ checked: true, auto: true });

    // 自動確認済みの項目は手動で切り替えられない
    vm.toggleChecklistItem("investment-standard");
    expect(
      vm.checklistItems.value.find((entry) => entry.id === "investment-standard").checked,
    ).toBe(true);
  });

  it("persists manual checklist toggles in localStorage under a monthly key", () => {
    const vm = useHomeViewModel();
    expect(vm.checklistItems.value.find((item) => item.id === "fire-progress").checked).toBe(false);

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
