<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import HoldingTable from "@/components/HoldingTable.vue";
import { formatSignedYen, formatYen } from "@/domain/format";
import { signedClass } from "@/domain/signed";
import { EMPTY_HOLDINGS, HOLDING_TABLE_CONFIGS, stockFundSummary } from "@/domain/holdings";
import { usePortfolioData } from "@/composables/usePortfolioData";
import { useInitialHashRestore } from "@/composables/useInitialHashRestore";

const route = useRoute();
const router = useRouter();
const { data, loading, error } = usePortfolioData();

useInitialHashRestore({
  route,
  router,
  loading,
  isReady: computed(() => Boolean(data.value)),
});

const holdings = computed(() => data.value?.holdings ?? EMPTY_HOLDINGS);

const summary = computed(() => stockFundSummary(holdings.value));
const stocksAndFundsTotal = computed(() => summary.value.totalYen);
const dailyMoves = computed(() => summary.value.dailyMoves);
const dailyMoveTotal = computed(() => summary.value.dailyMoveTotal);
const dailyMoveClass = computed(() => signedClass(dailyMoveTotal.value));

const configs = HOLDING_TABLE_CONFIGS;


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
