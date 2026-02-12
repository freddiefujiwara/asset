<script setup>
import { computed, nextTick, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { usePortfolioStore } from "@/stores/portfolio";
import HoldingTable from "@/components/HoldingTable.vue";
import { dailyChangeYen, formatSignedYen, formatYen } from "@/domain/format";
import { toNumber } from "@/domain/parse";

const store = usePortfolioStore();
const route = useRoute();
const router = useRouter();
const { data, loading, error } = storeToRefs(store);

let pendingInitialHash = "";
let restoredInitialHash = false;

function scrollToPendingHash() {
  if (!pendingInitialHash) {
    return;
  }

  const target = document.querySelector(pendingInitialHash);
  if (target) {
    target.scrollIntoView({ block: "start" });
  }
}

async function restoreInitialHashIfReady() {
  if (restoredInitialHash || !pendingInitialHash || loading.value || !data.value) {
    return;
  }

  restoredInitialHash = true;
  await nextTick();
  await router.replace({ path: route.path, hash: pendingInitialHash });
  await nextTick();
  scrollToPendingHash();
}

onMounted(async () => {
  if (route.hash) {
    pendingInitialHash = route.hash;
    await router.replace({ path: route.path, hash: "" });
  }

  if (!data.value) {
    store.fetchPortfolio();
  }

  restoreInitialHashIfReady();
});

watch([loading, data], () => {
  restoreInitialHashIfReady();
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

const stocksAndFunds = computed(() => [...holdings.value.stocks, ...holdings.value.funds]);
const stocksAndFundsTotal = computed(() =>
  stocksAndFunds.value.reduce((sum, row) => sum + toNumber(row?.["評価額"]), 0),
);
const dailyMoves = computed(() => stocksAndFunds.value.map((row) => dailyChangeYen(row)).filter((v) => v != null));
const dailyMoveTotal = computed(() => dailyMoves.value.reduce((sum, v) => sum + v, 0));
const dailyMoveClass = computed(() =>
  dailyMoveTotal.value > 0 ? "is-positive" : dailyMoveTotal.value < 0 ? "is-negative" : "",
);

const configs = [
  {
    title: "現金・預金",
    key: "cashLike",
    columns: [
      { key: "種類・名称", label: "名称" },
      { key: "残高", label: "残高" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
  {
    title: "株式",
    key: "stocks",
    columns: [
      { key: "銘柄コード", label: "コード" },
      { key: "銘柄名", label: "銘柄名" },
      { key: "評価額", label: "評価額" },
      { key: "評価損益", label: "評価損益" },
      { key: "評価損益率", label: "評価損益率" },
      { key: "__dailyChange", label: "前日比" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
  {
    title: "投資信託",
    key: "funds",
    columns: [
      { key: "銘柄名", label: "銘柄名" },
      { key: "評価額", label: "評価額" },
      { key: "評価損益", label: "評価損益" },
      { key: "評価損益率", label: "評価損益率" },
      { key: "__dailyChange", label: "前日比" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
  {
    title: "年金",
    key: "pensions",
    columns: [
      { key: "名称", label: "名称" },
      { key: "現在価値", label: "現在価値" },
      { key: "評価損益率", label: "評価損益率" },
    ],
  },
  {
    title: "ポイント",
    key: "points",
    columns: [
      { key: "名称", label: "名称" },
      { key: "現在の価値", label: "現在の価値" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
  {
    title: "負債詳細",
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
  <section id="holdings-top">
    <p v-if="loading">読み込み中...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <section class="table-wrap">
      <h3 class="section-title">株式・投信サマリー</h3>
      <div class="summary-row">
        <span>評価額合計: <strong class="amount-value">{{ formatYen(stocksAndFundsTotal) }}</strong></span>
        <span>
          前日比合計:
          <strong :class="dailyMoveClass">
            {{ dailyMoves.length ? formatSignedYen(dailyMoveTotal) : "-" }}
          </strong>
        </span>
      </div>
    </section>

    <nav class="section-jump" aria-label="保有資産の小カテゴリ">
      <a v-for="config in configs" :key="`jump-${config.key}`" :href="`#section-${config.key}`">{{ config.title }}</a>
    </nav>

    <section v-for="config in configs" :id="`section-${config.key}`" :key="config.key" class="section-block">
      <HoldingTable :title="config.title" :rows="holdings[config.key]" :columns="config.columns" />
      <p class="back-top-wrap"><a href="#holdings-top">↑ トップへ戻る</a></p>
    </section>
  </section>
</template>
