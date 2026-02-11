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
</script>

<template>
  <section>
    <h2 class="section-title">家族別資産</h2>
    <p v-if="loading">読み込み中...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <section class="table-wrap">
      <h3 class="section-title">株式・投信サマリー（家族合算）</h3>
      <div class="summary-row">
        <span>評価額合計: <strong>{{ formatYen(totalStockFund) }}</strong></span>
        <span>
          前日比合計:
          <strong :class="totalDailyClass">
            {{ hasAnyDailyMove ? formatSignedYen(totalDailyMove) : "-" }}
          </strong>
        </span>
      </div>
    </section>

    <div class="card-grid">
      <article v-for="group in familyGroups" :key="group.ownerLabel" class="card">
        <h3>{{ group.ownerLabel }}の資産</h3>
        <p>{{ formatYen(group.totalYen) }}</p>
        <p class="meta">株・投信: {{ formatYen(group.stockFundYen) }}</p>
        <p class="meta">
          前日比:
          <strong :class="group.dailyMoveYen > 0 ? 'is-positive' : group.dailyMoveYen < 0 ? 'is-negative' : ''">
            {{ group.hasDailyMove ? formatSignedYen(group.dailyMoveYen) : "-" }}
          </strong>
        </p>
      </article>
    </div>

    <section v-for="group in familyGroups" :key="`table-${group.ownerLabel}`" class="table-wrap">
      <h3 class="section-title">{{ group.ownerLabel }}の明細（{{ group.items.length }}件）</h3>
      <table class="stack-table">
        <thead>
          <tr>
            <th>種別</th>
            <th>名称</th>
            <th>金融機関</th>
            <th>金額</th>
            <th>前日比</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in group.items" :key="`${group.ownerLabel}-${idx}`">
            <td data-label="種別">{{ item.type }}</td>
            <td data-label="名称">{{ item.name }}</td>
            <td data-label="金融機関">{{ item.institution }}</td>
            <td data-label="金額">{{ formatYen(item.amountYen) }}</td>
            <td
              data-label="前日比"
              :class="item.dailyMoveYen > 0 ? 'is-positive' : item.dailyMoveYen < 0 ? 'is-negative' : ''"
            >
              {{ item.dailyMoveYen == null ? "-" : formatSignedYen(item.dailyMoveYen) }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
