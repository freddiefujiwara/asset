<script setup>
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { usePortfolioStore } from "@/stores/portfolio";
import { formatYen } from "@/domain/format";

const store = usePortfolioStore();
const { data, loading, error, source } = storeToRefs(store);

const totals = computed(() =>
  data.value?.totals ?? { assetsYen: 0, liabilitiesYen: 0, netWorthYen: 0 },
);
const assetsByClass = computed(() => data.value?.summary?.assetsByClass ?? []);
const liabilitiesByCategory = computed(() => data.value?.summary?.liabilitiesByCategory ?? []);

onMounted(() => {
  if (!data.value) {
    store.fetchPortfolio();
  }
});
</script>

<template>
  <section>
    <p class="meta">データソース: {{ source || "-" }}</p>
    <p v-if="loading">読み込み中...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="card-grid">
      <article class="card">
        <h2>総資産</h2>
        <p>{{ formatYen(totals.assetsYen) }}</p>
      </article>
      <article class="card">
        <h2>総負債</h2>
        <p>{{ formatYen(totals.liabilitiesYen) }}</p>
      </article>
      <article class="card">
        <h2>純資産</h2>
        <p>{{ formatYen(totals.netWorthYen) }}</p>
      </article>
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
            <td>{{ formatYen(item.amountYen) }}</td>
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
            <td>{{ formatYen(item.amountYen) }}</td>
            <td>{{ item.percentage }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
