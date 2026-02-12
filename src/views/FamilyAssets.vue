<script setup>
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { usePortfolioStore } from "@/stores/portfolio";
import { formatSignedYen, formatYen } from "@/domain/format";
import { summarizeFamilyAssets } from "@/domain/family";

const store = usePortfolioStore();
const { data, loading, error } = storeToRefs(store);

onMounted(() => {
  if (!data.value) {
    store.fetchPortfolio();
  }
});

const familyGroups = computed(() => summarizeFamilyAssets(data.value?.holdings));
const totalStockFund = computed(() => familyGroups.value.reduce((sum, group) => sum + group.stockFundYen, 0));
const hasAnyDailyMove = computed(() => familyGroups.value.some((group) => group.hasDailyMove));
const totalDailyMove = computed(() => familyGroups.value.reduce((sum, group) => sum + group.dailyMoveYen, 0));
const totalDailyClass = computed(() =>
  totalDailyMove.value > 0 ? "is-positive" : totalDailyMove.value < 0 ? "is-negative" : "",
);
const totalProfitYen = computed(() => familyGroups.value.reduce((sum, group) => sum + group.profitYen, 0));
const totalProfitClass = computed(() =>
  totalProfitYen.value > 0 ? "is-positive" : totalProfitYen.value < 0 ? "is-negative" : "",
);
const totalProfitRate = computed(() => {
  const principal = totalStockFund.value - totalProfitYen.value;
  if (principal === 0) {
    return totalStockFund.value === 0 && totalProfitYen.value === 0 ? 0 : null;
  }

  return (totalProfitYen.value / principal) * 100;
});

function formatSignedPercent(value) {
  if (value == null) {
    return "-";
  }

  const sign = value > 0 ? "+" : value < 0 ? "-" : "±";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

function signedClass(value) {
  return value > 0 ? "is-positive" : value < 0 ? "is-negative" : "";
}

function stockPriceUrl(name) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${String(name ?? "")} 株価`)}`;
}

</script>

<template>
  <section id="family-top">
    <h2 class="section-title">家族別資産</h2>
    <p v-if="loading">読み込み中...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <section class="table-wrap">
      <h3 class="section-title">株式・投信サマリー（家族合算）</h3>
      <div class="summary-row">
        <span>評価額合計: <strong class="amount-value">{{ formatYen(totalStockFund) }}</strong></span>
        <span>
          評価損益合計:
          <strong :class="totalProfitClass">{{ formatSignedYen(totalProfitYen) }}</strong>
        </span>
        <span>
          評価損益率:
          <strong :class="signedClass(totalProfitRate)">{{ formatSignedPercent(totalProfitRate) }}</strong>
        </span>
        <span>
          前日比合計:
          <strong :class="totalDailyClass">
            {{ hasAnyDailyMove ? formatSignedYen(totalDailyMove) : "-" }}
          </strong>
        </span>
      </div>
    </section>

    <nav class="section-jump" aria-label="家族別資産の小カテゴリ">
      <a v-for="group in familyGroups" :key="`jump-${group.ownerLabel}`" :href="`#family-${group.ownerLabel}`">
        {{ group.ownerLabel }}
      </a>
    </nav>

    <div class="card-grid">
      <article v-for="group in familyGroups" :key="group.ownerLabel" class="card">
        <h3>{{ group.ownerLabel }}の資産</h3>
        <p class="amount-value">{{ formatYen(group.totalYen) }}</p>
        <p class="meta">株・投信: <span class="amount-value">{{ formatYen(group.stockFundYen) }}</span></p>
        <p class="meta">
          評価損益: <strong :class="signedClass(group.profitYen)">{{ formatSignedYen(group.profitYen) }}</strong>
        </p>
        <p class="meta">
          評価損益率:
          <strong :class="signedClass(group.profitRatePct)">{{ formatSignedPercent(group.profitRatePct) }}</strong>
        </p>
        <p class="meta">
          前日比:
          <strong :class="signedClass(group.dailyMoveYen)">
            {{ group.hasDailyMove ? formatSignedYen(group.dailyMoveYen) : "-" }}
          </strong>
        </p>
      </article>
    </div>

    <section
      v-for="group in familyGroups"
      :id="`family-${group.ownerLabel}`"
      :key="`table-${group.ownerLabel}`"
      class="section-block table-wrap"
    >
      <h3 class="section-title">{{ group.ownerLabel }}の明細（{{ group.items.length }}件）</h3>
      <table class="stack-table">
        <thead>
          <tr>
            <th>種別</th>
            <th>名称</th>
            <th>金融機関</th>
            <th>金額</th>
            <th>評価損益</th>
            <th>評価損益率</th>
            <th>前日比</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in group.items" :key="`${group.ownerLabel}-${idx}`">
            <td data-label="種別">{{ item.type }}</td>
            <td data-label="名称">
              <a
                v-if="item.type === '株式'"
                class="stock-link"
                :href="stockPriceUrl(item.name)"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ item.name }}
              </a>
              <template v-else>{{ item.name }}</template>
            </td>
            <td data-label="金融機関">{{ item.institution }}</td>
            <td data-label="金額"><span class="amount-value">{{ formatYen(item.amountYen) }}</span></td>
            <td data-label="評価損益" :class="signedClass(item.profitYen)">
              {{ item.profitYen == null ? "-" : formatSignedYen(item.profitYen) }}
            </td>
            <td data-label="評価損益率" :class="signedClass(item.profitRatePct)">
              {{ formatSignedPercent(item.profitRatePct) }}
            </td>
            <td
              data-label="前日比"
              :class="signedClass(item.dailyMoveYen)"
            >
              {{ item.dailyMoveYen == null ? "-" : formatSignedYen(item.dailyMoveYen) }}
            </td>
          </tr>
        </tbody>
      </table>
      <p class="back-top-wrap"><a href="#family-top">↑ トップへ戻る</a></p>
    </section>
  </section>
</template>
