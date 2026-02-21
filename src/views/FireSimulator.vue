<script setup>
import { useFireSimulatorViewModel } from "@/features/fireSimulator/useFireSimulatorViewModel";

const {
  loading,
  error,
  formatYen,
  CopyButton,
  FireSimulationTable,
  FireSimulationChart,
  monthlyInvestment,
  annualReturnRate,
  currentAge,
  includeInflation,
  inflationRate,
  includeTax,
  taxRate,
  postFireExtraExpense,
  retirementLumpSumAtFire,
  manualPostFireFirstYearExtraExpense,
  useAutoFirstYearExtra,
  withdrawalRate,
  includeBonus,
  useMonteCarlo,
  monteCarloTrials,
  monteCarloVolatility,
  monteCarloSeed,
  firePortfolio,
  initialAssets,
  riskAssets,
  cashAssets,
  monthsOfCash,
  past5MonthSummary,
  manualMonthlyExpense,
  useAutoExpense,
  manualRegularMonthlyIncome,
  manualAnnualBonus,
  useAutoIncome,
  useAutoBonus,
  mortgageMonthlyPayment,
  mortgagePayoffDate,
  monthlyExpense,
  monthlyIncome,
  annualInvestment,
  annualSavings,
  postFireFirstYearExtraExpense,
  growthData,
  annualSimulationData,
  fireAchievementMonth,
  fireAchievementAge,
  pensionAnnualAtFire,
  estimatedMonthlyPensionAt60,
  requiredAssetsAtFire,
  chartAnnotations,
  fireDate,
  formatMonths,
  isCalculatingMonteCarlo,
  runMonteCarlo,
  monteCarloResults,
  algorithmExplanationSegments,
  copyConditionsAndAlgorithm,
  copyAnnualTable,
  copyText,
  mortgageOptions,
} = useFireSimulatorViewModel();
</script>

<template>
  <section>
    <p v-if="loading">読み込み中...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="filter-section table-wrap">
      <h3 class="section-title">シミュレーション引数</h3>
      <div class="fire-form-grid">
        <div class="filter-item">
          <label>毎月の投資額 (円)</label>
          <input v-model.number="monthlyInvestment" type="number" step="10000" />
        </div>
        <div class="filter-item">
          <label>期待リターン (年率 %)</label>
          <input v-model.number="annualReturnRate" type="number" step="0.1" class="is-public" />
        </div>
        <div class="filter-item">
          <label>現在の年齢</label>
          <input v-model.number="currentAge" type="number" class="is-public" />
        </div>
        <div class="filter-item">
          <label>取り崩し率 (%)</label>
          <input v-model.number="withdrawalRate" type="number" step="0.1" class="is-public" />
        </div>
        <div class="filter-item expense-item">
          <div class="label-row">
            <label>生活費 (月額)</label>
            <label class="auto-toggle is-public">
              <input type="checkbox" v-model="useAutoExpense" class="is-public" /> 自動算出
            </label>
          </div>
          <input v-model.number="manualMonthlyExpense" type="number" step="10000" :disabled="useAutoExpense" />
          <div v-if="useAutoExpense && past5MonthSummary.monthCount > 0" class="expense-breakdown">
            <details>
              <summary>算出内訳 ({{ past5MonthSummary.monthCount }}ヶ月平均)</summary>
              <div class="breakdown-content">
                <div class="breakdown-row total-row">
                  <span class="cat-name">固定費 (合計)</span>
                  <span class="cat-amount amount-value">{{ formatYen(past5MonthSummary.avgFixedMonthly) }}</span>
                </div>
                <div class="breakdown-row total-row">
                  <span class="cat-name">変動費 (合計)</span>
                  <span class="cat-amount amount-value">{{ formatYen(past5MonthSummary.avgVariableMonthly) }}</span>
                </div>
                <hr class="breakdown-divider" />
                <div v-for="item in past5MonthSummary.monthlyLivingExpenses.breakdown" :key="item.name" class="breakdown-row">
                  <span class="cat-name">{{ item.name }}</span>
                  <span class="cat-amount amount-value">{{ formatYen(item.amount) }}</span>
                </div>
                <div v-if="past5MonthSummary.monthlyLivingExpenses.averageSpecial > 0" class="special-info">
                  <span class="meta">※ 特別な支出 (平均 {{ formatYen(past5MonthSummary.monthlyLivingExpenses.averageSpecial) }}) は除外済み</span>
                </div>
              </div>
            </details>
          </div>
        </div>
        <div class="filter-item expense-item">
          <div class="label-row">
            <label>定期収入 (月額)</label>
            <label class="auto-toggle is-public">
              <input type="checkbox" v-model="useAutoIncome" class="is-public" /> 自動算出
            </label>
          </div>
          <input v-model.number="manualRegularMonthlyIncome" type="number" step="10000" :disabled="useAutoIncome" />
          <div v-if="useAutoIncome && past5MonthSummary.monthCount > 0" class="expense-breakdown">
            <details>
              <summary>算出内訳 ({{ past5MonthSummary.monthCount }}ヶ月平均)</summary>
              <div class="breakdown-content">
                <div v-for="item in past5MonthSummary.monthlyRegularIncome.breakdown" :key="item.name" class="breakdown-row">
                  <span class="cat-name">{{ item.name }}</span>
                  <span class="cat-amount amount-value">{{ formatYen(item.amount) }}</span>
                </div>
              </div>
            </details>
          </div>
        </div>
        <div class="filter-item expense-item">
          <div class="label-row">
            <label>ボーナス (年額)</label>
            <div class="toggle-group">
              <label class="auto-toggle is-public">
                <input type="checkbox" v-model="useAutoBonus" class="is-public" /> 自動算出
              </label>
              <label class="auto-toggle is-public">
                <input type="checkbox" v-model="includeBonus" class="is-public" /> ボーナスを考慮
              </label>
            </div>
          </div>
          <input v-model.number="manualAnnualBonus" type="number" step="10000" :disabled="useAutoBonus || !includeBonus" />
          <div v-if="useAutoBonus && past5MonthSummary.monthCount > 0" class="expense-breakdown">
            <details>
              <summary>算出内訳 ({{ past5MonthSummary.monthCount }}ヶ月平均)</summary>
              <div class="breakdown-content">
                <div v-for="item in past5MonthSummary.annualBonus.breakdown" :key="item.name" class="breakdown-row">
                  <span class="cat-name">{{ item.name }}</span>
                  <span class="cat-amount amount-value">{{ formatYen(item.amount) }}</span>
                </div>
              </div>
            </details>
          </div>
        </div>
        <div class="filter-item">
          <label>住宅ローン月額 (円)</label>
          <input v-model.number="mortgageMonthlyPayment" type="number" step="10000" />
        </div>
        <div class="filter-item">
          <label>ローン完済年月</label>
          <select v-model="mortgagePayoffDate" class="date-select">
            <option v-for="opt in mortgageOptions" :key="opt.val" :value="opt.val">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="filter-item">
          <label class="is-public">インフレ考慮</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="checkbox" v-model="includeInflation" class="is-public" />
            <input v-if="includeInflation" v-model.number="inflationRate" type="number" step="0.1" style="width: 60px;" class="is-public" />
            <span v-if="includeInflation" class="is-public">%</span>
          </div>
        </div>
        <div class="filter-item">
          <label class="is-public">税金考慮</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="checkbox" v-model="includeTax" class="is-public" />
            <input v-if="includeTax" v-model.number="taxRate" type="number" step="0.1" style="width: 80px;" class="is-public" />
            <span v-if="includeTax" class="is-public">%</span>
          </div>
        </div>
        <div class="filter-item">
          <label>FIRE後の社会保険料・税(月額)</label>
          <input v-model.number="postFireExtraExpense" type="number" step="5000" />
        </div>
        <div class="filter-item expense-item">
          <div class="label-row">
            <label>FIRE達成時の退職金 (円)</label>
          </div>
          <input v-model.number="retirementLumpSumAtFire" type="number" step="100000" />
        </div>
        <div class="filter-item expense-item">
          <div class="label-row">
            <label>FIRE1年目の追加支出 (年額)</label>
            <label class="auto-toggle is-public">
              <input type="checkbox" v-model="useAutoFirstYearExtra" class="is-public" /> 自動算出
            </label>
          </div>
          <input v-model.number="manualPostFireFirstYearExtraExpense" type="number" step="100000" :disabled="useAutoFirstYearExtra" />
          <div v-if="useAutoFirstYearExtra" class="expense-breakdown" style="font-size: 0.7rem; color: var(--muted); padding: 4px;">
            ※ 年間収入の15%相当（社会保険料・住民税のスパイク分）
          </div>
        </div>
      </div>

      <div class="monte-carlo-settings" style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--border);">
        <h4 style="font-size: 0.9rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          🎲 順序リスク評価 (モンテカルロ法)
          <label class="auto-toggle is-public">
            <input type="checkbox" v-model="useMonteCarlo" class="is-public" /> 有効にする
          </label>
        </h4>
        <div v-if="useMonteCarlo" class="fire-form-grid">
          <div class="filter-item">
            <label>試行回数</label>
            <input v-model.number="monteCarloTrials" type="number" step="100" min="100" max="10000" />
          </div>
          <div class="filter-item">
            <label>年率ボラティリティ (%)</label>
            <input v-model.number="monteCarloVolatility" type="number" step="1" min="0" />
          </div>
          <div class="filter-item">
            <label>乱数シード (再現用)</label>
            <input v-model.number="monteCarloSeed" type="number" />
          </div>
        </div>
        <div v-if="useMonteCarlo" style="margin-top: 12px;">
          <button
            @click="runMonteCarlo"
            class="calculate-btn"
            :disabled="isCalculatingMonteCarlo"
          >
            {{ isCalculatingMonteCarlo ? '⚡ 計算中...' : '🎲 モンテカルロ試行を実行' }}
          </button>
        </div>
      </div>

      <div class="copy-actions">
        <CopyButton
          label="📋 条件とアルゴリズムをコピー"
          :copy-value="copyConditionsAndAlgorithm"
          disabled-on-privacy
        />
      </div>

      <div class="initial-summary">
        <details>
          <summary>条件の確認</summary>
          <div class="initial-summary-grid">
            <div>
              <span class="meta">総金融資産:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(initialAssets) }}</span>
            </div>
            <div>
              <span class="meta">うちリスク資産:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(riskAssets) }}</span>
              <span class="meta"> ({{ (data?.totals?.assetsYen > 0) ? ((riskAssets / data.totals.assetsYen) * 100).toFixed(1) : 0 }}% / 総資産比)</span>
            </div>
            <div>
              <span class="meta">現金資産:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(cashAssets) }}</span>
              <span class="meta"> (生活費の{{ monthsOfCash.toFixed(1) }}ヶ月分)</span>
            </div>
            <div>
              <span class="meta">推定年間支出:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(monthlyExpense * 12) }}</span>
              <div v-if="useAutoExpense" style="font-size: 0.7rem; margin-top: 4px;">
                <span class="meta">内訳(月平均): </span>
                <span class="amount-value">固定{{ formatYen(past5MonthSummary.avgFixedMonthly) }}</span> /
                <span class="amount-value">変動{{ formatYen(past5MonthSummary.avgVariableMonthly) }}</span>
              </div>
            </div>
            <div>
              <span class="meta">推定年間収入:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(monthlyIncome * 12) }}</span>
            </div>
            <div>
              <span class="meta">年間投資額:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(annualInvestment) }}</span>
            </div>
            <div>
              <span class="meta">年間貯金額:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(annualSavings) }}</span>
            </div>
            <div>
              <span class="meta">うちボーナス:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(annualBonus) }}</span>
            </div>
            <div>
              <span class="meta">必要資産目安:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(requiredAssetsAtFire) }}</span>
              <span class="meta"> ({{ fireAchievementAge }}歳時点・100歳寿命)</span>
            </div>
            <div>
              <span class="meta">ローン完済年月:</span>
              <span style="margin-left: 8px;">{{ mortgagePayoffDate || '設定なし' }}</span>
            </div>
            <div>
              <span class="meta">期待リターン:</span>
              <span style="margin-left: 8px;">{{ annualReturnRate }}%</span>
            </div>
            <div>
              <span class="meta">取り崩し率:</span>
              <span style="margin-left: 8px;">{{ withdrawalRate }}%</span>
            </div>
            <div v-if="includeInflation">
              <span class="meta">インフレ率:</span>
              <span style="margin-left: 8px;">{{ inflationRate }}%</span>
            </div>
            <div v-if="includeTax">
              <span class="meta">税率:</span>
              <span style="margin-left: 8px;">{{ taxRate }}%</span>
            </div>
            <div>
              <span class="meta">FIRE後追加支出:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(postFireExtraExpense) }}</span>
            </div>
          </div>
        </details>
      </div>

      <div class="initial-summary" style="margin-top: 0; border-top: none;">
        <details>
          <summary>FIREアルゴリズムの詳細</summary>
          <div class="algorithm-details" style="font-size: 0.8rem; color: var(--muted); margin-top: 10px; line-height: 1.6; white-space: pre-wrap;">
            <template v-for="(seg, idx) in algorithmExplanationSegments" :key="idx">
              <span v-if="seg.type === 'amount'" class="amount-value">{{ seg.value }}</span>
              <span v-else>{{ seg.value }}</span>
            </template>
          </div>
        </details>
      </div>
    </div>

    <div v-if="useMonteCarlo && monteCarloResults" class="card-grid monte-carlo-results">
      <article class="card highlight">
        <h2>FIRE成功率 (100歳生存)</h2>
        <p :class="monteCarloResults.successRate > 0.9 ? 'is-positive' : monteCarloResults.successRate > 0.5 ? 'is-warning' : 'is-negative'">
          {{ (monteCarloResults.successRate * 100).toFixed(1) }}%
        </p>
        <p class="meta">{{ monteCarloResults.trials }}回の試行結果</p>
      </article>
      <article class="card">
        <h2>最終資産・中央値 (P50)</h2>
        <p class="amount-value">{{ formatYen(monteCarloResults.p50) }}</p>
        <p class="meta">確率50%でこの額以上残る</p>
      </article>
      <article class="card">
        <h2>最終資産・下位10% (P10)</h2>
        <p class="amount-value" :class="monteCarloResults.p10 < 0 ? 'is-negative' : ''">
          {{ formatYen(monteCarloResults.p10) }}
        </p>
        <p class="meta">最悪ケースに近いシナリオ</p>
      </article>
      <article class="card">
        <h2>最終資産・上位10% (P90)</h2>
        <p class="amount-value">{{ formatYen(monteCarloResults.p90) }}</p>
        <p class="meta">好調な市場が続いた場合</p>
      </article>
    </div>

    <div class="card-grid">
      <article class="card">
        <h2>FIRE達成まで</h2>
        <p class="is-positive">{{ formatMonths(fireAchievementMonth) }}</p>
        <p class="meta">達成予定: {{ fireDate(fireAchievementMonth) }}</p>
      </article>
      <article class="card">
        <h2>FIRE達成年齢</h2>
        <p class="is-positive">{{ fireAchievementAge }}歳</p>
        <p class="meta">現在 {{ currentAge }}歳</p>
      </article>
      <article class="card">
        <h2>FIRE達成に必要な資産</h2>
        <p class="is-positive amount-value">{{ formatYen(requiredAssetsAtFire) }}</p>
        <p class="meta">
          あといくら必要か:
          <span class="amount-value">{{ formatYen(requiredAssetsAtFire - firePortfolio.netWorthYen) }}</span>
        </p>
      </article>
      <article class="card">
        <h2>60歳時点の毎月の年金受給額（見込み）</h2>
        <p class="amount-value">{{ formatYen(estimatedMonthlyPensionAt60) }}</p>
        <p class="meta">{{ fireAchievementAge }}歳でFIREした場合の概算</p>
      </article>
    </div>

    <div class="main-visualization">
      <FireSimulationChart :data="annualSimulationData" :annotations="chartAnnotations" :monte-carlo-paths="monteCarloResults" />
      <div class="copy-actions table-copy-action">
        <CopyButton
          label="📋 年齢別収支推移表をコピー"
          :copy-value="copyAnnualTable"
          disabled-on-privacy
        />
      </div>
      <FireSimulationTable :data="annualSimulationData" />
    </div>

  </section>
</template>

<style scoped>
.fire-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  align-items: flex-end;
}
.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.filter-item label {
  font-size: 0.85rem;
  color: var(--muted);
}
.filter-item input[type="number"],
.filter-item .date-select {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface-elevated);
  color: var(--text);
  font: inherit;
}
.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.toggle-group {
  display: flex;
  gap: 8px;
  align-items: center;
}
.auto-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 0.75rem !important;
  color: var(--primary) !important;
}
.auto-toggle input {
  cursor: pointer;
}
.expense-breakdown {
  margin-top: 8px;
  background: var(--surface);
  border-radius: 4px;
  padding: 4px 8px;
  border: 1px solid var(--border);
}
.expense-breakdown summary {
  font-size: 0.75rem;
  cursor: pointer;
  color: var(--muted);
  user-select: none;
}
.initial-summary {
  margin-top: 14px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}
.initial-summary summary {
  font-size: 0.8rem;
  color: var(--muted);
  cursor: pointer;
}
.initial-summary-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}
.breakdown-content {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.75rem;
}
.breakdown-row {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px dashed var(--border);
  padding-bottom: 2px;
}
.total-row {
  font-weight: bold;
  color: var(--primary);
  border-bottom: 1px solid var(--border);
}
.breakdown-divider {
  margin: 4px 0;
  border: none;
  border-top: 1px solid var(--border);
}
.special-info {
  margin-top: 4px;
  font-size: 0.7rem;
  color: var(--muted);
}
.card h2 {
    font-size: 0.9rem;
    color: var(--muted);
    margin-bottom: 8px;
}
.card p {
    font-size: 1.5rem;
    font-weight: bold;
    margin: 4px 0;
}
.card.highlight {
    border: 2px solid var(--primary);
}
.main-visualization {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.copy-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.table-copy-action {
  margin-top: 0;
  margin-bottom: -10px;
}

.calculate-btn {
  background: var(--primary);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  width: 100%;
  transition: opacity 0.2s;
}

.calculate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.calculate-btn:hover:not(:disabled) {
  opacity: 0.9;
}
</style>
