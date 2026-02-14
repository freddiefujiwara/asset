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
            <th title="シミュレーション上の年齢（年度末時点）">年齢</th>
            <th class="text-right" title="定期収入 + 年金受給額（インフレ調整なし）">収入 (年金込)</th>
            <th class="text-right" title="基本生活費（インフレ調整済）+ FIRE後追加費用 - 住宅ローン削減分（固定額）">支出</th>
            <th class="text-right" title="当年中のリスク資産の運用リターン（複利効果）">運用益(当年分)</th>
            <th class="text-right" title="FIRE後の資産取崩し額 = Max(支出[税込], 資産 × 設定取崩率)">取り崩し額</th>
            <th class="text-right" title="年度末時点の総資産額（貯金額 + リスク資産額）">金融資産(合計)</th>
            <th class="text-right" title="前年末の貯金 + 当年のキャッシュフロー（収入 + 取崩額 - 支出 - 投資額）">貯金額</th>
            <th class="text-right" title="前年末のリスク資産 + 当年の投資額 + 当年の運用益 - 当年の取崩額">リスク資産額</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data" :key="row.age">
            <td class="age-cell" title="年度末時点の年齢">{{ row.age }}歳</td>
            <td class="amount-value text-right" :title="`定期収入: ${formatYen(row.income)} + 年金: ${formatYen(row.pension)}` ">{{ formatYen(row.income + row.pension) }}</td>
            <td class="amount-value text-right" title="基本生活費（インフレ適用） + FIRE後追加支出 - 住宅ローン削減分">{{ formatYen(row.expenses) }}</td>
            <td class="amount-value text-right is-positive" title="リスク資産 × 期待リターン（月次複利計算の年間合計）">{{ formatYen(row.investmentGain) }}</td>
            <td class="amount-value text-right" :class="{ 'is-negative': row.withdrawal > 0 }" title="FIRE達成後の資産取崩しルールに基づく引出額（税金考慮済）">
              {{ formatYen(row.withdrawal) }}
            </td>
            <td class="amount-value text-right" style="font-weight: bold;" title="貯金額（現金） + リスク資産額">{{ formatYen(row.assets) }}</td>
            <td class="amount-value text-right" :class="{ 'is-negative': row.cashAssets < 0 }" title="当年の収支剰余金（または不足補填後の残キャッシュ）">{{ formatYen(row.cashAssets) }}</td>
            <td class="amount-value text-right" title="リスク資産の年度末残高（運用益反映後）">{{ formatYen(row.riskAssets) }}</td>
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
