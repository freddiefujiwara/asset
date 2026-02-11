<script setup>
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { usePortfolioStore } from "@/stores/portfolio";
import HoldingTable from "@/components/HoldingTable.vue";

const store = usePortfolioStore();
const { data, loading, error } = storeToRefs(store);

onMounted(() => {
  if (!data.value) {
    store.fetchPortfolio();
  }
});

const holdings = computed(
  () =>
    data.value?.holdings ?? {
      cashLike: [],
      stocks: [],
      funds: [],
      pensions: [],
      points: [],
      liabilitiesDetail: [],
    },
);

const configs = [
  {
    title: "Cash Like",
    key: "cashLike",
    columns: [
      { key: "種類・名称", label: "名称" },
      { key: "残高", label: "残高" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
  {
    title: "Stocks",
    key: "stocks",
    columns: [
      { key: "銘柄コード", label: "コード" },
      { key: "銘柄名", label: "銘柄名" },
      { key: "評価額", label: "評価額" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
  {
    title: "Funds",
    key: "funds",
    columns: [
      { key: "銘柄名", label: "銘柄名" },
      { key: "評価額", label: "評価額" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
  {
    title: "Pensions",
    key: "pensions",
    columns: [
      { key: "名称", label: "名称" },
      { key: "現在価値", label: "現在価値" },
      { key: "評価損益率", label: "評価損益率" },
    ],
  },
  {
    title: "Points",
    key: "points",
    columns: [
      { key: "名称", label: "名称" },
      { key: "現在の価値", label: "現在の価値" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
  {
    title: "Liabilities Detail",
    key: "liabilitiesDetail",
    columns: [
      { key: "種類", label: "種類" },
      { key: "名称・説明", label: "名称" },
      { key: "残高", label: "残高" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
];
</script>

<template>
  <section>
    <p v-if="loading">読み込み中...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <HoldingTable
      v-for="config in configs"
      :key="config.key"
      :title="config.title"
      :rows="holdings[config.key]"
      :columns="config.columns"
    />
  </section>
</template>
