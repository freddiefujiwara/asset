import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeRef = { query: {} };
const replace = vi.fn();
const portfolioDataRef = ref(null);
const rawResponseRef = ref(null);

vi.mock("vue-router", () => ({
  useRoute: () => routeRef,
  useRouter: () => ({ replace }),
}));

vi.mock("@/composables/usePortfolioData", () => ({
  usePortfolioData: () => ({
    data: portfolioDataRef,
    loading: ref(false),
    error: ref(null),
    rawResponse: rawResponseRef,
  }),
}));

vi.mock("@/composables/useInitialHashRestore", () => ({
  useInitialHashRestore: vi.fn(),
}));

import { useBalanceSheetViewModel } from "@/features/balanceSheet/useBalanceSheetViewModel";

describe("useBalanceSheetViewModel", () => {
  beforeEach(() => {
    replace.mockClear();
    routeRef.query = {};
    portfolioDataRef.value = {
      holdings: {
        stocks: [{ "銘柄コード": "7203", "保有数": "10", "保有株数": "10", "評価額": "1000" }],
        funds: [],
        pensions: [],
        points: [],
        cashLike: [],
        liabilitiesDetail: [{ 種類: "住宅ローン", 残高: "100" }],
      },
    };
    rawResponseRef.value = { data: { breakdown: [1], mfcf: [2] } };
  });

  it("derives owner and supports owner selection", () => {
    routeRef.query = { owner: "wife", extra: "1" };
    const vm = useBalanceSheetViewModel();
    expect(vm.selectedOwner.value).toBe("wife");
    vm.selectOwner("all");
    expect(replace).toHaveBeenCalledWith({ query: { owner: "all", extra: "1" } });
  });

  it("derives the daily move rate against the previous day's total", () => {
    portfolioDataRef.value = {
      holdings: {
        stocks: [{ "銘柄名": "テスト株", "評価額": "1100", "前日比": "100" }],
        funds: [],
        pensions: [],
        points: [],
        cashLike: [],
        liabilitiesDetail: [],
      },
    };
    const vm = useBalanceSheetViewModel();
    expect(vm.dailyMoveTotal.value).toBe(100);
    // 前日比％ = 100 ÷（1100 − 100）
    expect(vm.dailyMoveRatePct.value).toBeCloseTo(10);
  });

  it("builds mapped raw JSON and treemap URL", () => {
    const vm = useBalanceSheetViewModel();
    expect(vm.getMappedAssetStatusJson()).toContain("asset_breakdown");
    expect(vm.getMappedAssetStatusJson()).not.toContain("mfcf");
    expect(vm.stockTreemapUrl.value).toContain("portfolio-treemap");
  });

  it("builds the look-through region allocation and pie data", () => {
    portfolioDataRef.value = {
      holdings: {
        stocks: [],
        funds: [{ "銘柄名": "オールカントリー株式", "評価額": "1000000" }],
        pensions: [],
        points: [],
        cashLike: [{ "種類・名称": "普通預金", "残高": "1000000" }],
        liabilitiesDetail: [],
      },
      weights: {
        acwi: { japan: 10, us: 50, developed_other: 20, emerging: 20, other: 0, effectiveDate: "2026-11-02" },
      },
    };
    const vm = useBalanceSheetViewModel();
    const japan = vm.regionAllocation.value.buckets.find((bucket) => bucket.key === "japan");
    // 日本 = 現金100万 + オルカン按分10%
    expect(japan.amountYen).toBe(1100000);
    expect(vm.regionAllocation.value.effectiveDate).toBe("2026-11-02");
    expect(vm.regionPie.value.find((slice) => slice.label === "日本")).toEqual({
      label: "日本",
      value: 1100000,
      color: "#38bdf8",
    });
  });
});
