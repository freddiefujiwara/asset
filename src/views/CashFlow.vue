<script setup>
import { computed, ref } from "vue";
import { usePortfolioData } from "@/composables/usePortfolioData";
import { formatYen } from "@/domain/format";
import CopyButton from "@/components/CopyButton.vue";
import {
  filterCashFlow,
  getKPIs,
  aggregateByMonth,
  aggregateByCategory,
  getUniqueMonths,
  getUniqueLargeCategories,
  getUniqueSmallCategories,
  sortCashFlow,
  getSixMonthAverages,
} from "@/domain/cashFlow";
import { getPast5MonthSummary } from "@/domain/fire";
import CashFlowBarChart from "@/components/CashFlowBarChart.vue";
import CashFlowTable from "@/components/CashFlowTable.vue";
import PieChart from "@/components/PieChart.vue";

const { data, loading, error, rawResponse } = usePortfolioData();

const monthFilter = ref("");
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
    largeCategory: largeCategoryFilter.value,
    smallCategory: smallCategoryFilter.value,
    search: searchFilter.value,
    includeTransfers: includeTransfers.value,
  });
  return sortCashFlow(filtered, sortKey.value, sortOrder.value);
});

const hasActiveFilters = computed(() =>
  Boolean(
    monthFilter.value
    || largeCategoryFilter.value
    || smallCategoryFilter.value
    || searchFilter.value,
  ),
);

const kpis = computed(() => getKPIs(filteredCashFlow.value));
const monthlyData = computed(() =>
  aggregateByMonth(
    hasActiveFilters.value ? filteredCashFlow.value : cashFlowRaw.value,
    { includeNet: !hasActiveFilters.value },
  ),
);
const categoryPieData = computed(() => aggregateByCategory(filteredCashFlow.value, { averageMonths: 5, excludeCurrentMonth: true }));

const showSixMonthAverage = computed(() => !monthFilter.value);
const sixMonthAverages = computed(() =>
  showSixMonthAverage.value ? getSixMonthAverages(monthlyData.value) : null,
);

const uniqueMonths = computed(() => getUniqueMonths(cashFlowRaw.value));
const copyTargetMonths = computed(() => uniqueMonths.value.slice(0, 6));
const uniqueLargeCategories = computed(() => getUniqueLargeCategories(cashFlowRaw.value));
const uniqueSmallCategories = computed(() =>
  getUniqueSmallCategories(cashFlowRaw.value, largeCategoryFilter.value),
);

const handleSort = ({ key, order }) => {
  sortKey.value = key;
  sortOrder.value = order;
};

const getSplitResponse = () => {
  if (!rawResponse.value || typeof rawResponse.value !== "object") {
    return null;
  }

  const root = rawResponse.value;
  const target = root?.data && typeof root.data === "object" ? root.data : root;

  if (!target || typeof target !== "object") {
    return null;
  }

  const { mfcf, ...others } = target;
  return { mfcf, others };
};

const copyText = async (text) => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "absolute";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
};

const getMonthlyMfcfJson = (month) => {
  const split = getSplitResponse();
  if (!split) return "[]";

  const mfcfRows = Array.isArray(split.mfcf) ? split.mfcf : [];
  const targetRows = mfcfRows.filter((item) => item?.date?.startsWith(month));
  return JSON.stringify(targetRows, null, 2);
};

const getPast5MonthSummaryJson = () => {
  return JSON.stringify(getPast5MonthSummary(cashFlowRaw.value), null, 2);
};

const resetFilters = () => {
  monthFilter.value = "";
  largeCategoryFilter.value = "";
  smallCategoryFilter.value = "";
  searchFilter.value = "";
  includeTransfers.value = true;
};
</script>

<template>
  <section>
    <p v-if="loading">読み込み中...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="filter-section table-wrap">
      <h3 class="section-title">フィルター</h3>
      <div class="filter-grid">
        <div class="filter-item">
          <label>月</label>
          <select v-model="monthFilter">
            <option value="">すべて</option>
            <option v-for="m in uniqueMonths" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <div class="filter-item">
          <label>大カテゴリ</label>
          <select v-model="largeCategoryFilter" @change="smallCategoryFilter = ''">
            <option value="">すべて</option>
            <option v-for="c in uniqueLargeCategories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="filter-item">
          <label>小カテゴリ</label>
          <select v-model="smallCategoryFilter" :disabled="!largeCategoryFilter">
            <option value="">すべて</option>
            <option v-for="c in uniqueSmallCategories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="filter-item search-item">
          <label>検索</label>
          <input v-model="searchFilter" type="text" placeholder="名称・カテゴリ..." />
        </div>
        <div class="filter-item transfer-toggle">
          <label>
            <input type="checkbox" v-model="includeTransfers" />
            振替を含める
          </label>
        </div>
        <div class="filter-item">
          <button class="theme-toggle" type="button" @click="resetFilters">リセット</button>
        </div>
      </div>
    </div>

    <div class="card-grid">
      <article class="card">
        <h2>合計収入</h2>
        <p class="is-positive amount-value">{{ formatYen(kpis.income) }}</p>
      </article>
      <article class="card">
        <h2>合計支出</h2>
        <p class="is-negative amount-value">{{ formatYen(Math.abs(kpis.expense)) }}</p>
      </article>
      <article class="card">
        <h2>純収支</h2>
        <p :class="kpis.net >= 0 ? 'is-positive' : 'is-negative'" class="amount-value">
          {{ formatYen(kpis.net) }}
        </p>
      </article>
      <article class="card">
        <h2>振替合計</h2>
        <p class="amount-value">{{ formatYen(kpis.transfers) }}</p>
      </article>
    </div>

    <CashFlowBarChart :data="monthlyData" :show-net="!hasActiveFilters" :averages="sixMonthAverages" />

    <div class="chart-grid">
      <PieChart title="カテゴリ別支出内訳" :data="categoryPieData" :value-formatter="formatYen" />
    </div>

    <div class="table-wrap api-actions">
      <CopyButton
        label="📋 過去5ヶ月分のサマリをコピー"
        :copy-value="getPast5MonthSummaryJson"
        disabled-on-privacy
      />
      <CopyButton
        v-for="month in copyTargetMonths"
        :key="month"
        :label="`📋 ${month.replace('-', '')}分をコピー`"
        :copy-value="() => getMonthlyMfcfJson(month)"
        disabled-on-privacy
      />
    </div>

    <CashFlowTable
      :items="filteredCashFlow"
      :sort-key="sortKey"
      :sort-order="sortOrder"
      @sort="handleSort"
    />
  </section>
</template>

<style scoped>
.filter-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
}
.filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.filter-item label {
  font-size: 0.8rem;
  color: var(--muted);
}
.filter-item select,
.filter-item input {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface-elevated);
  color: var(--text);
  font: inherit;
}
.search-item input {
  min-width: 200px;
}
.transfer-toggle {
  flex-direction: row;
  align-items: center;
  height: 38px;
}
.transfer-toggle label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--text);
  font-size: 0.9rem;
}

.api-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 700px) {
  .filter-grid {
    gap: 12px;
  }
  .search-item input {
    min-width: 100%;
  }
}
</style>
