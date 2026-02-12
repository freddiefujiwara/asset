<script setup>
import { computed } from "vue";
import { formatYen } from "@/domain/format";
import PieChart from "@/components/PieChart.vue";
import { usePortfolioData } from "@/composables/usePortfolioData";

const { data, loading, error, source } = usePortfolioData();

const totals = computed(() =>
  data.value?.totals ?? { assetsYen: 0, liabilitiesYen: 0, netWorthYen: 0 },
);
const assetsByClass = computed(() => data.value?.summary?.assetsByClass ?? []);
const liabilitiesByCategory = computed(() => data.value?.summary?.liabilitiesByCategory ?? []);

const assetPie = computed(() =>
  assetsByClass.value.map((item) => ({
    label: item.name,
    value: item.amountYen,
  })),
);

const liabilityPie = computed(() =>
  liabilitiesByCategory.value.map((item) => ({
    label: item.category,
    value: item.amountYen,
  })),
);
</script>

<template>
  <section>
    <p class="meta">データソース: {{ source || "-" }}</p>
    <p v-if="loading">読み込み中...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <section class="table-wrap balance-sheet">
      <h2 class="section-title">バランスシート</h2>
      <div class="balance-grid">
        <article class="balance-item">
          <h3>総資産</h3>
          <p class="amount-value">{{ formatYen(totals.assetsYen) }}</p>
        </article>
        <article class="balance-item">
          <h3>総負債</h3>
          <p class="amount-value">{{ formatYen(totals.liabilitiesYen) }}</p>
        </article>
        <article class="balance-item net-worth">
          <h3>純資産</h3>
          <p class="amount-value">{{ formatYen(totals.netWorthYen) }}</p>
        </article>
      </div>
    </section>

    <div class="chart-grid">
      <PieChart title="資産内訳（円グラフ）" :data="assetPie" />
      <PieChart title="負債内訳（円グラフ）" :data="liabilityPie" />
    </div>

    <section class="table-wrap">
      <h3 class="section-title">資産内訳</h3>
      <table>
        <thead>
          <tr>
            <th>分類</th>
            <th>金額</th>
            <th>割合 (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in assetsByClass" :key="item.name">
            <td>{{ item.name }}</td>
            <td><span class="amount-value">{{ formatYen(item.amountYen) }}</span></td>
            <td>{{ item.percentage }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="table-wrap">
      <h3 class="section-title">負債内訳</h3>
      <table>
        <thead>
          <tr>
            <th>分類</th>
            <th>金額</th>
            <th>割合 (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in liabilitiesByCategory" :key="item.category">
            <td>{{ item.category }}</td>
            <td><span class="amount-value">{{ formatYen(item.amountYen) }}</span></td>
            <td>{{ item.percentage }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
