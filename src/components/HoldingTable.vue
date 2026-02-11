<script setup>
import { computed } from "vue";
import { holdingRowKey } from "@/domain/format";

const props = defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  title: { type: String, required: true },
});

const safeRows = computed(() => (Array.isArray(props.rows) ? props.rows : []));
</script>

<template>
  <section class="table-wrap">
    <h3 class="section-title">{{ title }}（{{ safeRows.length }}件）</h3>
    <table>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, idx) in safeRows" :key="`${holdingRowKey(row)}__${idx}`">
          <td v-for="column in columns" :key="column.key">{{ row[column.key] ?? "-" }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
