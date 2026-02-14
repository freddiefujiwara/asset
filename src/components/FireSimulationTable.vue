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
            <th title="年齢">年齢</th>
            <th class="text-right" title="月間給与 + (年間ボーナス / 12) + 公的年金">収入 (年金込)</th>
            <th class="text-right" title="基本生活費 + (FIRE後追加支出 ※FIRE後のみ) - 住宅ローン削減分(完済後)">支出</th>
            <th class="text-right" title="リスク資産残高 × 期待リターン">運用益(当年分)</th>
            <th class="text-right" title="Max(支出, 資産 × 取り崩し率) - 収入 - 年金 (※FIRE後)">取り崩し額</th>
            <th class="text-right" title="金融資産(合計) = 貯金額 + リスク資産額">金融資産(合計)</th>
            <th class="text-right" title="前年末貯金 + 当年貯金可能額(収入-支出) - 当年投資額">貯金額</th>
            <th class="text-right" title="前年リスク資産 + 当年投資額 + 当年運用益">リスク資産額</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data" :key="row.age">
            <td class="age-cell">{{ row.age }}歳</td>
            <td class="amount-value text-right">{{ formatYen(row.income + row.pension) }}</td>
            <td class="amount-value text-right">{{ formatYen(row.expenses) }}</td>
            <td class="amount-value text-right is-positive">{{ formatYen(row.investmentGain) }}</td>
            <td class="amount-value text-right" :class="{ 'is-negative': row.withdrawal > 0 }">
              {{ formatYen(row.withdrawal) }}
            </td>
            <td class="amount-value text-right" style="font-weight: bold;">{{ formatYen(row.assets) }}</td>
            <td class="amount-value text-right" :class="{ 'is-negative': row.cashAssets < 0 }">{{ formatYen(row.cashAssets) }}</td>
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
