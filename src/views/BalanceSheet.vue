<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import HoldingTable from "@/components/HoldingTable.vue";
import CopyButton from "@/components/CopyButton.vue";
import AssetCategoryCard from "@/components/AssetCategoryCard.vue";
import { formatSignedYen, formatYen } from "@/domain/format";
import { toNumber } from "@/domain/parse";
import { balanceSheetLayout } from "@/domain/dashboard";
import PieChart from "@/components/PieChart.vue";
import { formatSignedPercent, signedClass } from "@/domain/signed";
import { usePortfolioData } from "@/composables/usePortfolioData";
import { filterHoldingsByOwner, OWNER_FILTERS, summarizeByCategory } from "@/domain/assetOwners";
import { assetAmountYen } from "@/domain/family";
import { EMPTY_HOLDINGS, HOLDING_TABLE_CONFIGS, stockFundSummary, stockTiles as buildStockTiles } from "@/domain/holdings";
import { useInitialHashRestore } from "@/composables/useInitialHashRestore";

const route = useRoute();
const router = useRouter();
const { data, loading, error, rawResponse } = usePortfolioData();

const selectedOwner = computed(() => {
  const ownerFromQuery = String(route.query.owner ?? "all").toLowerCase();
  return OWNER_FILTERS.some((owner) => owner.id === ownerFromQuery) ? ownerFromQuery : "all";
});

function selectOwner(ownerId) {
  router.replace({
    query: {
      ...route.query,
      owner: ownerId,
    },
  });
}

const filteredHoldings = computed(() => filterHoldingsByOwner(data.value?.holdings, selectedOwner.value) || EMPTY_HOLDINGS);
const categoryCards = computed(() => summarizeByCategory(filteredHoldings.value));

const assetsByClass = computed(() => {
  const assets = categoryCards.value.filter((c) => !c.isLiability);
  const total = assets.reduce((sum, c) => sum + c.amountYen, 0);
  return assets.map((c) => ({
    name: c.title,
    amountYen: c.amountYen,
    percentage: total > 0 ? Number(((c.amountYen / total) * 100).toFixed(1)) : 0,
  }));
});

const liabilitiesByCategory = computed(() => {
  const details = filteredHoldings.value.liabilitiesDetail || [];
  const groups = {
    "住宅ローン": 0,
    "クレジットカード利用残高": 0,
    "その他負債": 0,
  };

  details.forEach((row) => {
    const type = String(row?.["種類"] || "");
    const amount = toNumber(row?.["残高"]);
    if (type.includes("住宅ローン")) {
      groups["住宅ローン"] += amount;
    } else if (type.includes("クレジットカード")) {
      groups["クレジットカード利用残高"] += amount;
    } else {
      groups["その他負債"] += amount;
    }
  });

  const total = Object.values(groups).reduce((sum, v) => sum + v, 0);

  return Object.entries(groups)
    .filter(([_, amount]) => amount > 0)
    .map(([category, amount]) => ({
      category,
      amountYen: amount,
      percentage: total > 0 ? Number(((amount / total) * 100).toFixed(1)) : 0,
    }));
});

const totals = computed(() => {
  const assetsYen = assetsByClass.value.reduce((sum, c) => sum + c.amountYen, 0);
  const liabilitiesYen = liabilitiesByCategory.value.reduce((sum, c) => sum + c.amountYen, 0);
  return {
    assetsYen,
    liabilitiesYen,
    netWorthYen: assetsYen - liabilitiesYen,
  };
});

const totalRiskAssetsYen = computed(() => {
  const riskKeys = ["stocks", "funds", "pensions"];
  return categoryCards.value
    .filter((c) => riskKeys.includes(c.key))
    .reduce((sum, c) => sum + c.amountYen, 0);
});

const balanceLayout = computed(() => balanceSheetLayout(totals.value));

const enrichedHoldings = computed(() => {
  const h = filteredHoldings.value;
  const totalAssets = totals.value.assetsYen;
  const totalRisk = totalRiskAssetsYen.value;

  const result = { ...h };
  ["stocks", "funds", "pensions"].forEach((key) => {
    if (result[key]) {
      result[key] = result[key].map((row) => {
        const amount = assetAmountYen(row);
        return {
          ...row,
          __riskAssetRatio: totalRisk > 0 ? ((amount / totalRisk) * 100).toFixed(1) : "0.0",
          __totalAssetRatio: totalAssets > 0 ? ((amount / totalAssets) * 100).toFixed(1) : "0.0",
        };
      });
    }
  });

  return result;
});

const summary = computed(() => stockFundSummary(filteredHoldings.value));
const stocksAndFundsTotal = computed(() => summary.value.totalYen);
const dailyMoves = computed(() => summary.value.dailyMoves);
const dailyMoveTotal = computed(() => summary.value.dailyMoveTotal);
const dailyMoveClass = computed(() => signedClass(dailyMoveTotal.value));
const totalProfitYen = computed(() => summary.value.totalProfitYen);
const totalProfitClass = computed(() => signedClass(totalProfitYen.value));
const totalProfitRatePct = computed(() => summary.value.totalProfitRatePct);
const stockTiles = computed(() => buildStockTiles(filteredHoldings.value?.stocks || []));

const KEY_MAP = {
  breakdown: "asset_breakdown",
  "breakdown-liability": "liability_breakdown",
  "total-liability": "total_liability",
  details__portfolio_det_depo__t0: "cash_and_deposit_details",
  details__portfolio_det_eq__t0: "stock_details",
  details__portfolio_det_mf__t0: "investment_trust_details",
  details__portfolio_det_pns__t0: "pension_details",
  details__portfolio_det_po__t0: "point_details",
  "details__liability_det__t0-liability": "liability_details",
};

const getMappedAssetStatusJson = () => {
  if (!rawResponse.value || typeof rawResponse.value !== "object") {
    return "{}";
  }

  const root = rawResponse.value;
  const target = root?.data && typeof root.data === "object" ? root.data : root;

  if (!target || typeof target !== "object") {
    return "{}";
  }

  // eslint-disable-next-line no-unused-vars
  const { mfcf, ...others } = target;

  const mappedOthers = {};
  Object.keys(others).forEach((key) => {
    const newKey = KEY_MAP[key] || key;
    mappedOthers[newKey] = others[key];
  });

  return JSON.stringify(mappedOthers, null, 2);
};

useInitialHashRestore({
  route,
  router,
  loading,
  isReady: computed(() => Boolean(data.value)),
});

const configs = HOLDING_TABLE_CONFIGS;

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

const copyToken = () => {
  const token = localStorage.getItem("asset-google-id-token");
  if (!token) {
    window.alert("トークンが localStorage に見つかりません。");
    throw new Error("Token not found");
  }
  return token;
};
</script>

<template>
  <section id="balance-sheet-top">
    <p v-if="loading">読み込み中...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <section class="table-wrap">
      <div class="header-with-action">
        <h2 class="section-title">資産管理（保有資産・家族別統合）</h2>
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
        <span>評価額合計: <strong class="amount-value is-positive">{{ formatYen(stocksAndFundsTotal) }}</strong></span>
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

    <nav class="section-jump" aria-label="保有資産の小カテゴリ">
      <a v-for="config in configs" :key="`jump-${config.key}`" :href="`#section-${config.key}`">{{ config.title }}</a>
    </nav>

    <section v-for="config in configs.filter(c => !c.isLiability)" :id="`section-${config.key}`" :key="config.key" class="section-block">
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
      <HoldingTable
        :title="config.title"
        :rows="enrichedHoldings[config.key]"
        :columns="config.columns"
        :is-liability="config.isLiability"
      />
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
</style>
