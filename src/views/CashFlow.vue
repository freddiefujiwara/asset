<script setup>
import { computed, ref } from "vue";
import { usePortfolioData } from "@/composables/usePortfolioData";
import { formatYen } from "@/domain/format";
import {
  filterCashFlow,
  getKPIs,
  aggregateByMonth,
  aggregateByCategory,
  getUniqueMonths,
  getUniqueCategories,
} from "@/domain/cashFlow";
import CashFlowBarChart from "@/components/CashFlowBarChart.vue";
import CashFlowTable from "@/components/CashFlowTable.vue";
import PieChart from "@/components/PieChart.vue";

const { data, loading, error, source } = usePortfolioData();

const monthFilter = ref("");
const categoryFilter = ref("");
const searchFilter = ref("");
const includeTransfers = ref(true);

const cashFlowRaw = computed(() => data.value?.cashFlow ?? []);

const filteredCashFlow = computed(() => {
  return filterCashFlow(cashFlowRaw.value, {
    month: monthFilter.value,
    category: categoryFilter.value,
    search: searchFilter.value,
    includeTransfers: includeTransfers.value,
  });
});

const kpis = computed(() => getKPIs(filteredCashFlow.value));
const monthlyData = computed(() => aggregateByMonth(cashFlowRaw.value));
const categoryPieData = computed(() => aggregateByCategory(filteredCashFlow.value));

const uniqueMonths = computed(() => getUniqueMonths(cashFlowRaw.value));
const uniqueCategories = computed(() => getUniqueCategories(cashFlowRaw.value));

const resetFilters = () => {
  monthFilter.value = "";
  categoryFilter.value = "";
  searchFilter.value = "";
  includeTransfers.value = true;
};
</script>

<template>
  <section>
    <p class="meta">データソース: {{ source || "-" }}</p>
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
          <label>カテゴリ</label>
          <select v-model="categoryFilter">
            <option value="">すべて</option>
            <option v-for="c in uniqueCategories" :key="c" :value="c">{{ c }}</option>
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

    <CashFlowBarChart :data="monthlyData" />

    <div class="chart-grid">
      <PieChart title="カテゴリ別支出内訳" :data="categoryPieData" />
    </div>

    <CashFlowTable :items="filteredCashFlow" />
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
@media (max-width: 700px) {
  .filter-grid {
    gap: 12px;
  }
  .search-item input {
    min-width: 100%;
  }
}
</style>
