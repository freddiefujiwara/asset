<script setup>
import { formatYen } from "@/domain/format";
import CopyButton from "@/components/CopyButton.vue";
import CashFlowBarChart from "@/components/CashFlowBarChart.vue";
import CashFlowTable from "@/components/CashFlowTable.vue";
import PieChart from "@/components/PieChart.vue";
import { useCashFlowViewModel } from "@/features/cashFlow/useCashFlowViewModel";

const monthLabel = (monthKey) => {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-");
  return `${year}年${Number(month)}月`;
};

const {
  loading,
  error,
  reviewList,
  showReviewCategory,
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
  getPast12MonthSummaryJson,
  resetFilters,
} = useCashFlowViewModel();
</script>

<template>
  <section>
    <p v-if="loading">読み込み中...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="table-wrap review-section">
      <h3 class="section-title">要確認リスト（{{ monthLabel(reviewList.month) }}・確定分）</h3>
      <p class="meta">
        生活費 <span class="amount-value">{{ formatYen(reviewList.livingCostYen) }}</span>
        ／ 直近12か月平均 <span class="amount-value">{{ formatYen(reviewList.averageLivingCostYen) }}</span>
        <strong v-if="reviewList.livingCostOverAverage" class="error">（平均の+10%超・要確認）</strong>
      </p>
      <template v-if="reviewList.categories.length">
        <p class="meta">基準（12か月平均）を+10%以上上回ったカテゴリです。クリックすると明細を表示します。</p>
        <ul class="review-list">
          <li v-for="category in reviewList.categories" :key="category.label">
            <button type="button" class="review-item" @click="showReviewCategory(category.label)">
              <span class="review-label">{{ category.label }}</span>
              <span class="amount-value">{{ formatYen(category.monthYen) }}</span>
              <span class="meta">
                平均 {{ formatYen(category.averageYen) }}／超過
                <span class="amount-value">{{ formatYen(category.excessYen) }}</span>
                <template v-if="category.ratioPct !== null">（+{{ category.ratioPct }}%）</template>
              </span>
            </button>
          </li>
        </ul>
      </template>
      <p v-else class="meta">基準を大きく上回るカテゴリはありませんでした。</p>

      <div v-if="reviewList.special.items.length" class="review-special">
        <h4>特別支出（生活費とは別枠）</h4>
        <p class="meta">
          {{ monthLabel(reviewList.month) }}の特別支出は合計
          <span class="amount-value">{{ formatYen(reviewList.special.totalYen) }}</span>
          です。生活費の数字には含まれていません。
        </p>
        <ul class="meta review-special-list">
          <li v-for="item in reviewList.special.items" :key="`${item.date}-${item.name}`">
            {{ item.date }} {{ item.name }}
            <span class="amount-value">{{ formatYen(item.amountYen) }}</span>
          </li>
        </ul>
      </div>
    </div>

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
          <label>種別</label>
          <select v-model="typeFilter">
            <option value="">すべて</option>
            <option value="fixed">固定費</option>
            <option value="variable">変動費</option>
            <option value="exclude">除外</option>
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

    <CashFlowBarChart :data="monthlyData" :show-net="!hasActiveFilters" :averages="pastAverages" />

    <div class="chart-grid">
      <PieChart
        title="カテゴリ別支出内訳"
        :data="categoryPieData"
        :value-formatter="formatYen"
        @select="handleCategorySelect"
      />
    </div>

    <div class="table-wrap api-actions">
      <CopyButton
        label="📋 過去12ヶ月分のサマリをコピー"
        :copy-value="getPast12MonthSummaryJson"
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
.review-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.review-item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 12px;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-elevated);
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
.review-label {
  font-weight: 600;
}
.review-special {
  margin-top: 16px;
  border-top: 1px dashed var(--border);
  padding-top: 12px;
}
.review-special h4 {
  margin: 0 0 6px;
  font-size: 0.95rem;
}
.review-special-list {
  margin: 0;
  padding-left: 18px;
}

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

.chart-grid {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.chart-grid > * {
  flex: 1;
  min-width: 0;
}

@media (max-width: 768px) {
  .chart-grid {
    flex-direction: column;
  }
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
