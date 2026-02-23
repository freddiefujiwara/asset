<script setup>
import HoldingTable from "@/components/HoldingTable.vue";
import CopyButton from "@/components/CopyButton.vue";
import AssetCategoryCard from "@/components/AssetCategoryCard.vue";
import AssetTreemap from "@/components/AssetTreemap.vue";
import PieChart from "@/components/PieChart.vue";
import { formatSignedYen, formatYen } from "@/domain/format";
import { formatSignedPercent, signedClass } from "@/domain/signed";
import { useBalanceSheetViewModel } from "@/features/balanceSheet/useBalanceSheetViewModel";

const {
  loading,
  error,
  OWNER_FILTERS,
  selectedOwner,
  selectOwner,
  categoryCards,
  riskAssetsTotal,
  dailyMoves,
  dailyMoveTotal,
  dailyMoveClass,
  totalProfitYen,
  totalProfitClass,
  totalProfitRatePct,
  balanceLayout,
  totals,
  assetPie,
  liabilityPie,
  totalRiskTiles,
  configs,
  stockTiles,
  fundTiles,
  pensionTiles,
  getCategoryAmount,
  enrichedHoldings,
  stockTreemapUrl,
  getMappedAssetStatusJson,
  copyToken,
} = useBalanceSheetViewModel();
</script>

<template>
  <section id="balance-sheet-top">
    <p v-if="loading">読み込み中...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <section class="table-wrap">
      <div class="header-with-action">
        <h2 class="section-title">リスク資産管理（保有リスク資産・家族別統合）</h2>
        <CopyButton
          label="📋 資産状況をコピー"
          :copy-value="getMappedAssetStatusJson"
          disabled-on-privacy
        />
      </div>
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
        <span>評価額合計: <strong class="amount-value is-positive">{{ formatYen(riskAssetsTotal) }}</strong></span>
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
        :is-liability="card.isLiability"
      />
    </section>

    <section class="table-wrap balance-sheet">
      <h2 class="section-title">バランスシート</h2>
      <div class="balance-map" role="img" aria-label="左が資産、右上が負債、右下が純資産のバランスシート図">
        <article
          class="balance-item balance-assets"
          :style="{ width: `${balanceLayout.assetsWidthPct}%` }"
        >
          <h3>総資産</h3>
          <p class="amount-value">{{ formatYen(totals.assetsYen) }}</p>
        </article>
        <section class="balance-right" :style="{ width: `${balanceLayout.rightWidthPct}%` }">
          <article class="balance-item balance-liabilities" :style="{ height: `${balanceLayout.liabilitiesHeightPct}%` }">
            <h3>総負債</h3>
            <p class="amount-value">{{ formatYen(totals.liabilitiesYen) }}</p>
          </article>
          <article class="balance-item balance-net-worth" :style="{ height: `${balanceLayout.netWorthHeightPct}%` }">
            <h3>純資産</h3>
            <p class="amount-value">{{ formatYen(totals.netWorthYen) }}</p>
          </article>
        </section>
      </div>
    </section>

    <div class="chart-grid">
      <PieChart title="資産内訳（円グラフ）" :data="assetPie" />
      <PieChart title="負債内訳（円グラフ）" :data="liabilityPie" />
    </div>

    <AssetTreemap
      v-if="totalRiskTiles.length"
      title="総保有銘柄（評価額）"
      :tiles="totalRiskTiles"
    >
      <template #title>
        総保有銘柄（評価額）: <span class="amount-value is-positive">{{ formatYen(riskAssetsTotal) }}</span>
      </template>
    </AssetTreemap>

    <nav class="section-jump" aria-label="保有資産の小カテゴリ">
      <a v-for="config in configs" :key="`jump-${config.key}`" :href="`#section-${config.key}`">{{ config.title }}</a>
    </nav>

    <section v-for="config in configs.filter(c => !c.isLiability)" :id="`section-${config.key}`" :key="config.key" class="section-block">
      <AssetTreemap
        v-if="config.key === 'stocks' && stockTiles.length"
        title="保有銘柄（評価額）"
        :tiles="stockTiles"
      >
        <template #title>
          保有銘柄（評価額）: <span class="amount-value is-positive">{{ formatYen(getCategoryAmount('stocks')) }}</span>
        </template>
      </AssetTreemap>
      <AssetTreemap
        v-if="config.key === 'funds' && fundTiles.length"
        title="保有銘柄（評価額）"
        :tiles="fundTiles"
      >
        <template #title>
          保有銘柄（評価額）: <span class="amount-value is-positive">{{ formatYen(getCategoryAmount('funds')) }}</span>
        </template>
      </AssetTreemap>
      <AssetTreemap
        v-if="config.key === 'pensions' && pensionTiles.length"
        title="保有銘柄（評価額）"
        :tiles="pensionTiles"
      >
        <template #title>
          保有銘柄（評価額）: <span class="amount-value is-positive">{{ formatYen(getCategoryAmount('pensions')) }}</span>
        </template>
      </AssetTreemap>
      <HoldingTable
        :title="config.title"
        :rows="enrichedHoldings[config.key]"
        :columns="config.columns"
        :is-liability="config.isLiability"
      >
        <template #action v-if="config.key === 'stocks'">
          <a
            v-if="stockTreemapUrl"
            class="portfolio-treemap-link"
            :href="stockTreemapUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            現在の株価
          </a>
        </template>
      </HoldingTable>
      <p class="back-top-wrap"><a href="#balance-sheet-top">↑ トップへ戻る</a></p>
    </section>

    <section v-for="config in configs.filter(c => c.isLiability)" :id="`section-${config.key}`" :key="config.key" class="section-block">
      <HoldingTable
        :title="config.title"
        :rows="enrichedHoldings[config.key]"
        :columns="config.columns"
        :is-liability="config.isLiability"
      />
      <p class="back-top-wrap"><a href="#balance-sheet-top">↑ トップへ戻る</a></p>
    </section>

    <section class="footer-actions">
      <CopyButton
        label="📋 トークンIDをコピー"
        :copy-value="copyToken"
        disabled-on-privacy
      />
    </section>
  </section>
</template>

<style scoped>
.header-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.header-with-action .section-title {
  margin-bottom: 0;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.portfolio-treemap-link {
  display: inline-block;
  text-decoration: none;
  color: var(--link);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 10px;
  background: var(--surface-elevated);
  font-size: 0.9rem;
}
</style>
