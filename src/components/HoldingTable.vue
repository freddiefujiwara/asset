<script setup>
import { computed } from "vue";
import { dailyChangeYen, formatSignedYen, formatYen, holdingRowKey } from "@/domain/format";

const props = defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  title: { type: String, required: true },
});

const safeRows = computed(() => (Array.isArray(props.rows) ? props.rows : []));

const amountLikePattern = /金額|残高|評価額|価値/i;
const nonAmountPattern = /コード|率|割合/i;

function isAmountColumn(column) {
  if (column.key === "__dailyChange") {
    return false;
  }

  const keyLabel = `${column.key}${column.label}`;
  return amountLikePattern.test(keyLabel) && !nonAmountPattern.test(keyLabel);
}

function formatCell(column, row) {
  if (column.key === "__dailyChange") {
    const daily = dailyChangeYen(row);
    return daily == null ? "-" : formatSignedYen(daily);
  }

  const rawValue = row[column.key];
  if (rawValue == null) {
    return "-";
  }

  if (!isAmountColumn(column)) {
    return rawValue;
  }

  return formatYen(rawValue);
}


function stockPriceUrl(name) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${String(name ?? "")} 株価`)}`;
}

function isStockNameColumn(column, row) {
  return column.key === "銘柄名" && row?.["銘柄コード"];
}

function cellClass(column, row) {
  if (column.key !== "__dailyChange") {
    return "";
  }

  const daily = dailyChangeYen(row);
  if (daily == null || daily === 0) {
    return "";
  }

  return daily > 0 ? "is-positive" : "is-negative";
}
</script>

<template>
  <section class="table-wrap">
    <h3 class="section-title">{{ title }}（{{ safeRows.length }}件）</h3>
    <table class="stack-table">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, idx) in safeRows" :key="`${holdingRowKey(row)}__${idx}`">
          <td
            v-for="column in columns"
            :key="column.key"
            :class="cellClass(column, row)"
            :data-label="column.label"
          >
            <a
              v-if="isStockNameColumn(column, row)"
              class="stock-link"
              :href="stockPriceUrl(row[column.key])"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ formatCell(column, row) }}
            </a>
            <span v-else :class="isAmountColumn(column) ? 'amount-value' : ''">{{ formatCell(column, row) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
