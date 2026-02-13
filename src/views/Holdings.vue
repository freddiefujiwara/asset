<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import HoldingTable from "@/components/HoldingTable.vue";
import AssetCategoryCard from "@/components/AssetCategoryCard.vue";
import { formatSignedYen, formatYen } from "@/domain/format";
import { formatSignedPercent, signedClass } from "@/domain/signed";
import { EMPTY_HOLDINGS, HOLDING_TABLE_CONFIGS, stockFundSummary, stockTiles as buildStockTiles } from "@/domain/holdings";
import { filterHoldingsByOwner, OWNER_FILTERS, summarizeByCategory } from "@/domain/assetOwners";
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

const selectedOwner = computed(() => {
  const ownerFromQuery = String(route.query.owner ?? "all").toLowerCase();
  return OWNER_FILTERS.some((owner) => owner.id === ownerFromQuery) ? ownerFromQuery : "all";
});

const holdings = computed(() => data.value?.holdings ?? EMPTY_HOLDINGS);
const filteredHoldings = computed(() => filterHoldingsByOwner(holdings.value, selectedOwner.value));

const summary = computed(() => stockFundSummary(filteredHoldings.value));
const stocksAndFundsTotal = computed(() => summary.value.totalYen);
const dailyMoves = computed(() => summary.value.dailyMoves);
const dailyMoveTotal = computed(() => summary.value.dailyMoveTotal);
const dailyMoveClass = computed(() => signedClass(dailyMoveTotal.value));
const totalProfitYen = computed(() => summary.value.totalProfitYen);
const totalProfitClass = computed(() => signedClass(totalProfitYen.value));
const totalProfitRatePct = computed(() => summary.value.totalProfitRatePct);
const stockTiles = computed(() => buildStockTiles(filteredHoldings.value.stocks));
const categoryCards = computed(() => summarizeByCategory(filteredHoldings.value));

const configs = HOLDING_TABLE_CONFIGS;

function selectOwner(ownerId) {
  router.replace({
    query: {
      ...route.query,
      owner: ownerId,
    },
  });
}
</script>

<template>
  <section id="holdings-top">
    <p v-if="loading">読み込み中...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <section class="table-wrap">
      <h2 class="section-title">資産管理（保有資産・家族別統合）</h2>
      <div class="owner-tabs" role="tablist" aria-label="表示対象の切り替え">
        <button
          v-for="owner in OWNER_FILTERS"
          :key="owner.id"
          type="button"
          class="owner-tab"
          :class="selectedOwner === owner.id ? 'is-active' : ''"
          :aria-selected="selectedOwner === owner.id"
          @click="selectOwner(owner.id)"
        >
          {{ owner.label }}
        </button>
      </div>
      <div class="summary-row">
        <span>評価額合計: <strong class="amount-value">{{ formatYen(stocksAndFundsTotal) }}</strong></span>
        <span>
          評価損益合計:
          <strong :class="['amount-value', totalProfitClass]">{{ formatSignedYen(totalProfitYen) }}</strong>
        </span>
        <span>
          評価損益率:
          <strong :class="signedClass(totalProfitRatePct)">{{ formatSignedPercent(totalProfitRatePct) }}</strong>
        </span>
        <span>
          前日比合計:
          <strong :class="dailyMoveClass">
            {{ dailyMoves.length ? formatSignedYen(dailyMoveTotal) : "-" }}
          </strong>
        </span>
      </div>
    </section>

    <section class="card-grid">
      <AssetCategoryCard
        v-for="card in categoryCards"
        :key="card.key"
        :title="card.title"
        :amount-yen="card.amountYen"
        :count="card.count"
      />
    </section>

    <nav class="section-jump" aria-label="保有資産の小カテゴリ">
      <a v-for="config in configs" :key="`jump-${config.key}`" :href="`#section-${config.key}`">{{ config.title }}</a>
    </nav>

    <section v-for="config in configs" :id="`section-${config.key}`" :key="config.key" class="section-block">
      <section v-if="config.key === 'stocks' && stockTiles.length" class="table-wrap">
        <h3 class="section-title">保有銘柄（評価額）</h3>
        <div class="stock-tile-grid">
          <article
            v-for="tile in stockTiles"
            :key="`${tile.name}-${tile.value}`"
            class="stock-tile"
            :class="tile.isNegative ? 'is-negative-box' : 'is-positive-box'"
            tabindex="0"
            :aria-label="`${tile.name} 評価額 ${formatYen(tile.value)}`"
            :style="{
              left: `${tile.x}%`,
              top: `${tile.y}%`,
              width: `${tile.width}%`,
              height: `${tile.height}%`,
              '--name-scale': tile.fontScale,
            }"
          >
            <p class="stock-tile-name">{{ tile.name }}</p>
            <span class="stock-tile-tooltip" role="tooltip">
              {{ tile.name }}<br>
              評価額: <span class="amount-value">{{ formatYen(tile.value) }}</span>
              <template v-if="tile.dailyChange != null">
                <br>前日比: <span :class="signedClass(tile.dailyChange)">{{ formatSignedYen(tile.dailyChange) }}</span>
              </template>
            </span>
          </article>
        </div>
      </section>
      <HoldingTable :title="config.title" :rows="filteredHoldings[config.key]" :columns="config.columns" />
      <p class="back-top-wrap"><a href="#holdings-top">↑ トップへ戻る</a></p>
    </section>
  </section>
</template>
