<script setup>
import { computed, ref, watchEffect } from "vue";
import { usePortfolioData } from "@/composables/usePortfolioData";
import { formatYen } from "@/domain/format";
import {
  calculateRiskAssets,
  estimateMonthlyExpenses,
  estimateIncomeSplit,
  simulateFire,
  generateGrowthTable,
  estimateMortgageMonthlyPayment,
} from "@/domain/fire";
import FireGrowthChart from "@/components/FireGrowthChart.vue";
import HistogramChart from "@/components/HistogramChart.vue";

const { data, loading, error } = usePortfolioData();

// Input parameters
const calculateInitialAge = () => {
  const birthDate = new Date("1979-09-02");
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const monthlyInvestment = ref(423000);
const annualReturnRate = ref(5);
const annualStandardDeviation = ref(15);
const currentAge = ref(calculateInitialAge());
const includeInflation = ref(false);
const inflationRate = ref(2);
const includeTax = ref(false);
const taxRate = ref(20.315);
const withdrawalRate = ref(4);
const iterations = ref(1000);

// Data-derived parameters
const initialAssets = computed(() => data.value?.totals?.netWorthYen ?? 0);
const riskAssets = computed(() => (data.value ? calculateRiskAssets(data.value) : 0));
const expenseResult = computed(() =>
  data.value?.cashFlow
    ? estimateMonthlyExpenses(data.value.cashFlow)
    : { total: 0, breakdown: [], averageSpecial: 0, monthCount: 0 },
);
const autoMonthlyExpense = computed(() => expenseResult.value.total);
const autoIncomeSplit = computed(() =>
  data.value?.cashFlow
    ? estimateIncomeSplit(data.value.cashFlow)
    : { regularMonthly: 0, bonusAnnual: 0, monthlyTotal: 0 },
);
const autoRegularMonthlyIncome = computed(() => autoIncomeSplit.value.regularMonthly);
const autoAnnualBonus = computed(() => autoIncomeSplit.value.bonusAnnual);
const autoMortgageMonthlyPayment = computed(() =>
  data.value?.cashFlow ? estimateMortgageMonthlyPayment(data.value.cashFlow) : 0,
);

const manualMonthlyExpense = ref(0);
const useAutoExpense = ref(true);
const manualRegularMonthlyIncome = ref(0);
const manualAnnualBonus = ref(0);
const useAutoIncome = ref(true);
const mortgageMonthlyPayment = ref(0);
const mortgagePayoffDate = ref("2042-07");

const monthlyExpense = computed(() => (useAutoExpense.value ? autoMonthlyExpense.value : manualMonthlyExpense.value));
const regularMonthlyIncome = computed(() =>
  useAutoIncome.value ? autoRegularMonthlyIncome.value : manualRegularMonthlyIncome.value,
);
const annualBonus = computed(() => (useAutoIncome.value ? autoAnnualBonus.value : manualAnnualBonus.value));
const monthlyIncome = computed(() => regularMonthlyIncome.value + annualBonus.value / 12);

watchEffect(() => {
  if (autoMonthlyExpense.value && useAutoExpense.value) {
    manualMonthlyExpense.value = autoMonthlyExpense.value;
  }
  if (useAutoIncome.value) {
    manualRegularMonthlyIncome.value = autoRegularMonthlyIncome.value;
    manualAnnualBonus.value = autoAnnualBonus.value;
  }
  if (autoMortgageMonthlyPayment.value > 0 && mortgageMonthlyPayment.value === 0) {
    mortgageMonthlyPayment.value = autoMortgageMonthlyPayment.value;
  }
});

// Simulation results
const simResult = computed(() => {
  return simulateFire({
    initialAssets: initialAssets.value,
    riskAssets: riskAssets.value,
    monthlyInvestment: monthlyInvestment.value,
    annualReturnRate: annualReturnRate.value / 100,
    annualStandardDeviation: annualStandardDeviation.value / 100,
    monthlyExpense: monthlyExpense.value,
    monthlyIncome: monthlyIncome.value,
    includeInflation: includeInflation.value,
    inflationRate: inflationRate.value / 100,
    currentAge: currentAge.value,
    includeTax: includeTax.value,
    taxRate: taxRate.value / 100,
    withdrawalRate: withdrawalRate.value / 100,
    mortgageMonthlyPayment: mortgageMonthlyPayment.value,
    mortgagePayoffDate: mortgagePayoffDate.value || null,
    iterations: iterations.value,
  });
});

const growthData = computed(() => {
  return generateGrowthTable({
    initialAssets: initialAssets.value,
    riskAssets: riskAssets.value,
    monthlyInvestment: monthlyInvestment.value,
    annualReturnRate: annualReturnRate.value / 100,
    monthlyExpense: monthlyExpense.value,
    monthlyIncome: monthlyIncome.value,
    currentAge: currentAge.value,
    includeInflation: includeInflation.value,
    inflationRate: inflationRate.value / 100,
    includeTax: includeTax.value,
    taxRate: taxRate.value / 100,
    withdrawalRate: withdrawalRate.value / 100,
    mortgageMonthlyPayment: mortgageMonthlyPayment.value,
    mortgagePayoffDate: mortgagePayoffDate.value || null,
  });
});

const stats = computed(() => simResult.value.stats);

const fireDate = (months) => {
  if (months >= 1200) return "未達成 (100年以上)";
  const now = new Date();
  now.setMonth(now.getMonth() + months);
  return `${now.getFullYear()}年${now.getMonth() + 1}月`;
};

const formatMonths = (m) => {
  if (m >= 1200) return "100年以上";
  const years = Math.floor(m / 12);
  const months = m % 12;
  if (years === 0) return `${months}ヶ月`;
  return `${years}年${months}ヶ月`;
};

const achievementProbability = computed(() => {
    const reached = simResult.value.trials.filter(m => m < 1200).length;
    return (reached / iterations.value) * 100;
});
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
          <label>リスク/標準偏差 (%)</label>
          <input v-model.number="annualStandardDeviation" type="number" step="0.5" class="is-public" />
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
            <label class="auto-toggle">
              <input type="checkbox" v-model="useAutoExpense" /> 自動算出
            </label>
          </div>
          <input v-model.number="manualMonthlyExpense" type="number" step="10000" :disabled="useAutoExpense" />
          <div v-if="useAutoExpense && expenseResult.monthCount > 0" class="expense-breakdown">
            <details>
              <summary>算出内訳 ({{ expenseResult.monthCount }}ヶ月平均)</summary>
              <div class="breakdown-content">
                <div v-for="item in expenseResult.breakdown" :key="item.name" class="breakdown-row">
                  <span class="cat-name">{{ item.name }}</span>
                  <span class="cat-amount amount-value">{{ formatYen(item.amount) }}</span>
                </div>
                <div v-if="expenseResult.averageSpecial > 0" class="special-info">
                  <span class="meta">※ 特別な支出 (平均 {{ formatYen(expenseResult.averageSpecial) }}) は除外済み</span>
                </div>
              </div>
            </details>
          </div>
        </div>
        <div class="filter-item expense-item">
          <div class="label-row">
            <label>定期収入 (月額)</label>
            <label class="auto-toggle">
              <input type="checkbox" v-model="useAutoIncome" /> 自動算出
            </label>
          </div>
          <input v-model.number="manualRegularMonthlyIncome" type="number" step="10000" :disabled="useAutoIncome" />
        </div>
        <div class="filter-item expense-item">
          <label>ボーナス (年額)</label>
          <input v-model.number="manualAnnualBonus" type="number" step="10000" :disabled="useAutoIncome" />
          <span v-if="useAutoIncome" class="meta">自動算出: {{ formatYen(autoAnnualBonus) }}</span>
        </div>
        <div class="filter-item">
          <label>住宅ローン月額 (円)</label>
          <input v-model.number="mortgageMonthlyPayment" type="number" step="10000" />
        </div>
        <div class="filter-item">
          <label>ローン完済年月</label>
          <input v-model="mortgagePayoffDate" type="month" class="is-public" />
        </div>
        <div class="filter-item">
          <label>インフレ考慮</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="checkbox" v-model="includeInflation" />
            <input v-if="includeInflation" v-model.number="inflationRate" type="number" step="0.1" style="width: 60px;" />
            <span v-if="includeInflation">%</span>
          </div>
        </div>
        <div class="filter-item">
          <label>税金考慮</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="checkbox" v-model="includeTax" />
            <input v-if="includeTax" v-model.number="taxRate" type="number" step="0.1" style="width: 80px;" />
            <span v-if="includeTax">%</span>
          </div>
        </div>
      </div>

      <div class="initial-summary">
        <details>
          <summary>初期条件の確認</summary>
          <div class="initial-summary-grid">
            <div>
              <span class="meta">現在の純資産:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(initialAssets) }}</span>
            </div>
            <div>
              <span class="meta">うちリスク資産:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(riskAssets) }}</span>
              <span class="meta"> ({{ (data?.totals?.assetsYen > 0) ? ((riskAssets / data.totals.assetsYen) * 100).toFixed(1) : 0 }}% / 総資産比)</span>
            </div>
            <div>
              <span class="meta">推定年間支出:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(monthlyExpense * 12) }}</span>
            </div>
            <div>
              <span class="meta">推定年間収入:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(monthlyIncome * 12) }}</span>
            </div>
            <div>
              <span class="meta">うちボーナス:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(annualBonus) }}</span>
            </div>
            <div>
              <span class="meta">必要資産目安:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(Math.round(growthData.table[0]?.requiredAssets ?? 0)) }}</span>
              <span class="meta"> (100歳寿命)</span>
            </div>
          </div>
        </details>
      </div>
    </div>

    <div class="card-grid">
      <article class="card">
        <h2>FIRE達成まで (中央値)</h2>
        <p class="is-positive">{{ formatMonths(stats.median) }}</p>
        <p class="meta">達成予定: {{ fireDate(stats.median) }}</p>
      </article>
      <article class="card">
        <h2>FIRE達成年齢</h2>
        <p class="is-positive">{{ Math.floor(currentAge + stats.median / 12) }}歳</p>
        <p class="meta">現在 {{ currentAge }}歳</p>
      </article>
      <article class="card">
        <h2>90%信頼区間</h2>
        <p>{{ formatMonths(stats.p5) }} 〜 {{ formatMonths(stats.p95) }}</p>
        <p class="meta">不確実性を考慮した予測</p>
      </article>
      <article class="card">
        <h2>100歳までの達成率</h2>
        <p :class="achievementProbability > 80 ? 'is-positive' : 'is-negative'">
          {{ achievementProbability.toFixed(1) }}%
        </p>
        <p class="meta">{{ iterations }}回の試行結果</p>
      </article>
    </div>

    <FireGrowthChart :data="growthData.table" :base-age="currentAge" />

    <div class="chart-grid">
      <HistogramChart :data="simResult.trials" :max-months="1200" />
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
.filter-item input[type="number"] {
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
.investment-deduction {
  color: var(--negative);
  font-weight: bold;
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
.fire-summary span {
    font-size: 0.95rem;
}
</style>
