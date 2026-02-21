import { computed, ref } from "vue";
import { usePortfolioData } from "@/composables/usePortfolioData";
import {
  filterCashFlow,
  getKPIs,
  aggregateByMonth,
  aggregateByCategory,
  getUniqueMonths,
  getUniqueLargeCategories,
  getUniqueSmallCategories,
  sortCashFlow,
  getRecentAverages,
} from "@/domain/cashFlow";
import { getPast5MonthSummary } from "@/domain/fire";

export function useCashFlowViewModel() {
  const { data, loading, error, rawResponse } = usePortfolioData();

  const monthFilter = ref("");
  const typeFilter = ref("");
  const largeCategoryFilter = ref("");
  const smallCategoryFilter = ref("");
  const searchFilter = ref("");
  const includeTransfers = ref(true);
  const sortKey = ref("date");
  const sortOrder = ref("desc");

  const cashFlowRaw = computed(() => data.value?.cashFlow ?? []);

  const filteredCashFlow = computed(() => {
    const filtered = filterCashFlow(cashFlowRaw.value, {
      month: monthFilter.value,
      type: typeFilter.value,
      largeCategory: largeCategoryFilter.value,
      smallCategory: smallCategoryFilter.value,
      search: searchFilter.value,
      includeTransfers: includeTransfers.value,
    });
    return sortCashFlow(filtered, sortKey.value, sortOrder.value);
  });

  const hasActiveFilters = computed(() =>
    Boolean(monthFilter.value || typeFilter.value || largeCategoryFilter.value || smallCategoryFilter.value || searchFilter.value),
  );

  const kpis = computed(() => getKPIs(filteredCashFlow.value));
  const monthlyData = computed(() => aggregateByMonth(hasActiveFilters.value ? filteredCashFlow.value : cashFlowRaw.value, { includeNet: !hasActiveFilters.value }));
  const categoryPieData = computed(() => aggregateByCategory(filteredCashFlow.value, { averageMonths: 5, excludeCurrentMonth: true }));

  const showPastAverage = computed(() => !monthFilter.value);
  const pastAverages = computed(() => {
    if (!showPastAverage.value) return null;
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const historicalData = monthlyData.value.filter((d) => d.month !== currentMonthKey);
    return getRecentAverages(historicalData, 5);
  });

  const uniqueMonths = computed(() => getUniqueMonths(cashFlowRaw.value));
  const copyTargetMonths = computed(() => uniqueMonths.value.slice(0, 6));
  const uniqueLargeCategories = computed(() => getUniqueLargeCategories(cashFlowRaw.value));
  const uniqueSmallCategories = computed(() => getUniqueSmallCategories(cashFlowRaw.value, largeCategoryFilter.value));

  const handleSort = ({ key, order }) => {
    sortKey.value = key;
    sortOrder.value = order;
  };

  const handleCategorySelect = (label) => {
    const [large, small = ""] = label.split("/");
    if (largeCategoryFilter.value === large && smallCategoryFilter.value === small) {
      largeCategoryFilter.value = "";
      smallCategoryFilter.value = "";
    } else {
      largeCategoryFilter.value = large;
      smallCategoryFilter.value = small;
    }
  };

  const getSplitResponse = () => {
    if (!rawResponse.value || typeof rawResponse.value !== "object") return null;
    const root = rawResponse.value;
    const target = root?.data && typeof root.data === "object" ? root.data : root;
    if (!target || typeof target !== "object") return null;
    const { mfcf, ...others } = target;
    return { mfcf, others };
  };

  const getMonthlyMfcfJson = (month) => {
    const split = getSplitResponse();
    if (!split) return "[]";
    const mfcfRows = Array.isArray(split.mfcf) ? split.mfcf : [];
    return JSON.stringify(mfcfRows.filter((item) => item?.date?.startsWith(month)), null, 2);
  };

  const getPast5MonthSummaryJson = () => JSON.stringify(getPast5MonthSummary(cashFlowRaw.value), null, 2);

  const resetFilters = () => {
    monthFilter.value = "";
    typeFilter.value = "";
    largeCategoryFilter.value = "";
    smallCategoryFilter.value = "";
    searchFilter.value = "";
    includeTransfers.value = true;
  };

  return {
    loading,
    error,
    monthFilter,
    typeFilter,
    largeCategoryFilter,
    smallCategoryFilter,
    searchFilter,
    includeTransfers,
    sortKey,
    sortOrder,
    filteredCashFlow,
    hasActiveFilters,
    kpis,
    monthlyData,
    categoryPieData,
    pastAverages,
    uniqueMonths,
    copyTargetMonths,
    uniqueLargeCategories,
    uniqueSmallCategories,
    handleSort,
    handleCategorySelect,
    getMonthlyMfcfJson,
    getPast5MonthSummaryJson,
    resetFilters,
  };
}
