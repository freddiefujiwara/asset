<script setup>
import { formatYen } from "@/domain/format";

defineProps({
  data: { type: Array, required: true },
});
</script>

<template>
  <div class="chart-card simulation-table-card">
    <h3 class="section-title">年齢別収支推移表</h3>
    <div class="table-wrapper">
      <table class="simulation-table">
        <thead>
          <tr>
            <th>年齢</th>
            <th class="text-right">収入 (年金込)</th>
            <th class="text-right">支出</th>
            <th class="text-right">取り崩し額</th>
            <th class="text-right">金融資産(合計)</th>
            <th class="text-right">貯金額</th>
            <th class="text-right">リスク資産額</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data" :key="row.age">
            <td class="age-cell">{{ row.age }}歳</td>
            <td class="amount-value text-right">{{ formatYen(row.income + row.pension) }}</td>
            <td class="amount-value text-right">{{ formatYen(row.expenses) }}</td>
            <td class="amount-value text-right" :class="{ 'is-negative': row.withdrawal > 0 }">
              {{ formatYen(row.withdrawal) }}
            </td>
            <td class="amount-value text-right" style="font-weight: bold;">{{ formatYen(row.assets) }}</td>
            <td class="amount-value text-right">{{ formatYen(row.cashAssets) }}</td>
            <td class="amount-value text-right">{{ formatYen(row.riskAssets) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.simulation-table-card {
  margin-top: 24px;
}
.table-wrapper {
  overflow-x: auto;
  margin: 0 -16px; /* Bleed on mobile if needed, but card has padding */
  padding: 0 16px;
}
.simulation-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  white-space: nowrap;
}
.simulation-table th {
  text-align: left;
  padding: 12px 8px;
  border-bottom: 2px solid var(--border);
  color: var(--muted);
  font-weight: 600;
  position: sticky;
  top: 0;
  background: var(--surface);
  z-index: 1;
}
.simulation-table td {
  padding: 10px 8px;
  border-bottom: 1px solid var(--border);
}
.text-right {
  text-align: right;
}
.age-cell {
  font-weight: 600;
  color: var(--text);
}
.is-negative {
  color: var(--negative);
}
.simulation-table tr:hover {
  background: var(--surface-elevated);
}

@media (max-width: 640px) {
  .simulation-table {
    font-size: 0.75rem;
  }
  .simulation-table th, .simulation-table td {
    padding: 8px 4px;
  }
}
</style>
