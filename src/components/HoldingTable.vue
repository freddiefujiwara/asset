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

function formatCell(column, row) {
  if (column.key === "__dailyChange") {
    const daily = dailyChangeYen(row);
    return daily == null ? "-" : formatSignedYen(daily);
  }

  const rawValue = row[column.key];
  if (rawValue == null) {
    return "-";
  }

  const keyLabel = `${column.key}${column.label}`;
  const shouldFormatAmount = amountLikePattern.test(keyLabel) && !nonAmountPattern.test(keyLabel);

  if (!shouldFormatAmount) {
    return rawValue;
  }

  return formatYen(rawValue);
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
            {{ formatCell(column, row) }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
