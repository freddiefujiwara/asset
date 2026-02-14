<script setup>
import { computed, ref } from "vue";
import { dailyChangeYen, formatSignedYen, formatYen, holdingRowKey } from "@/domain/format";
import { toNumber } from "@/domain/parse";

const props = defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  title: { type: String, required: true },
  isLiability: { type: Boolean, default: false },
});

const safeRows = computed(() => (Array.isArray(props.rows) ? props.rows : []));

const amountLikePattern = /金額|残高|評価額|価値|損益/i;
const nonAmountPattern = /コード|率|割合/i;
const percentPattern = /率|割合/i;
const SORTABLE_COLUMN_KEYS = new Set(["評価額", "評価損益", "評価損益率", "__dailyChange"]);

const sortKey = ref("");
const sortDirection = ref("asc");

function isAmountColumn(column) {
  if (column.key === "__dailyChange") {
    return false;
  }

  const keyLabel = `${column.key}${column.label}`;
  return amountLikePattern.test(keyLabel) && !nonAmountPattern.test(keyLabel);
}

function isSortableColumn(column) {
  return SORTABLE_COLUMN_KEYS.has(column.key);
}

function toggleSort(column) {
  if (!isSortableColumn(column)) {
    return;
  }

  if (sortKey.value !== column.key) {
    sortKey.value = column.key;
    sortDirection.value = "asc";
    return;
  }

  sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
}

function sortMarker(column) {
  if (sortKey.value !== column.key) {
    return "";
  }

  return sortDirection.value === "asc" ? " ↑" : " ↓";
}

function sortValue(row, key) {
  if (key === "__dailyChange") {
    const daily = dailyChangeYen(row);
    return daily == null ? null : daily;
  }

  return toNumber(row?.[key]);
}

const displayedRows = computed(() => {
  if (!sortKey.value) {
    return safeRows.value;
  }

  const direction = sortDirection.value === "asc" ? 1 : -1;

  return safeRows.value
    .map((row, idx) => ({ row, idx }))
    .sort((a, b) => {
      const aValue = sortValue(a.row, sortKey.value);
      const bValue = sortValue(b.row, sortKey.value);

      if (aValue == null && bValue == null) {
        return a.idx - b.idx;
      }
      if (aValue == null) {
        return 1;
      }
      if (bValue == null) {
        return -1;
      }

      if (aValue === bValue) {
        return a.idx - b.idx;
      }

      return aValue > bValue ? direction : -direction;
    })
    .map((entry) => entry.row);
});

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
    if (percentPattern.test(`${column.key}${column.label}`)) {
      const value = String(rawValue);
      return value.includes("%") ? value : `${value}%`;
    }

    return rawValue;
  }

  const formatted = formatYen(rawValue);
  return props.isLiability ? `-${formatted}` : formatted;
}

function stockPriceUrl(name) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${String(name ?? "")} 株価`)}`;
}

function isStockNameColumn(column, row) {
  return column.key === "銘柄名" && row?.["銘柄コード"];
}

function cellClass(column, row) {
  if (column.key === "評価損益" || column.key === "評価損益率") {
    const value = toNumber(row?.[column.key]);
    if (value == null || value === 0) return "";
    return value > 0 ? "is-positive" : "is-negative";
  }

  if (column.key === "__dailyChange") {
    const value = dailyChangeYen(row);
    if (value == null || value === 0) return "";
    return value > 0 ? "is-positive" : "is-negative";
  }

  if (isAmountColumn(column)) {
    return props.isLiability ? "is-negative" : "is-positive";
  }

  return "";
}
</script>

<template>
  <section class="table-wrap">
    <h3 class="section-title">{{ title }}（{{ safeRows.length }}件）</h3>
    <table class="stack-table">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key">
            <button
              v-if="isSortableColumn(column)"
              type="button"
              class="sort-button"
              @click="toggleSort(column)"
            >
              {{ column.label }}{{ sortMarker(column) }}
            </button>
            <template v-else>{{ column.label }}</template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, idx) in displayedRows" :key="`${holdingRowKey(row)}__${idx}`">
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
