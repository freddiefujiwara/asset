<script setup>
import { computed, ref, watch, watchEffect } from "vue";
import { usePortfolioData } from "@/composables/usePortfolioData";
import { formatYen } from "@/domain/format";
import { detectAssetOwner, assetAmountYen, calculateAge, USER_BIRTH_DATE } from "@/domain/family";
import CopyButton from "@/components/CopyButton.vue";
import {
  calculateFirePortfolio,
  generateGrowthTable,
  generateAnnualSimulation,
  estimateMortgageMonthlyPayment,
  calculateMonthlyPension,
  FIRE_ALGORITHM_CONSTANTS,
  calculateDaughterAssetsBreakdown,
  generateAlgorithmExplanationSegments,
  getPast5MonthSummary,
  runMonteCarloSimulation,
} from "@/domain/fire";
import FireSimulationTable from "@/components/FireSimulationTable.vue";
import FireSimulationChart from "@/components/FireSimulationChart.vue";

const { data, loading, error } = usePortfolioData();

// Input parameters
const monthlyInvestment = ref(423000);
const annualReturnRate = ref(5);
const currentAge = ref(calculateAge(USER_BIRTH_DATE));
const includeInflation = ref(true);
const inflationRate = ref(2);
const includeTax = ref(true);
const taxRate = ref(20.315);
const postFireExtraExpense = ref(60000);
const retirementLumpSumAtFire = ref(5000000);
const manualPostFireFirstYearExtraExpense = ref(0);
const useAutoFirstYearExtra = ref(true);

const withdrawalRate = ref(4);
const includeBonus = ref(true);

// Monte Carlo
const useMonteCarlo = ref(false);
const monteCarloTrials = ref(1000);
const monteCarloVolatility = ref(15);
const monteCarloSeed = ref(123);

// Data-derived parameters
const firePortfolio = computed(() =>
  data.value
    ? calculateFirePortfolio(data.value)
    : { totalAssetsYen: 0, riskAssetsYen: 0, cashAssetsYen: 0, liabilitiesYen: 0, netWorthYen: 0 },
);
const initialAssets = computed(() => firePortfolio.value.totalAssetsYen);
const riskAssets = computed(() => firePortfolio.value.riskAssetsYen);
const cashAssets = computed(() => firePortfolio.value.cashAssetsYen);
const monthsOfCash = computed(() => (monthlyExpense.value > 0 ? cashAssets.value / monthlyExpense.value : 0));

const past5MonthSummary = computed(() =>
  data.value?.cashFlow
    ? getPast5MonthSummary(data.value.cashFlow)
    : {
        monthlyLivingExpenses: { average: 0, breakdown: [], averageSpecial: 0 },
        monthlyRegularIncome: { average: 0, breakdown: [] },
        annualBonus: { average: 0, breakdown: [] },
        avgFixedMonthly: 0,
        avgVariableMonthly: 0,
        monthCount: 0,
      },
);

const autoMonthlyExpense = computed(() => past5MonthSummary.value.monthlyLivingExpenses.average);
const autoRegularMonthlyIncome = computed(() => past5MonthSummary.value.monthlyRegularIncome.average);
const autoAnnualBonus = computed(() => past5MonthSummary.value.annualBonus.average);
const autoMortgageMonthlyPayment = computed(() =>
  data.value?.cashFlow ? estimateMortgageMonthlyPayment(data.value.cashFlow) : 0,
);

const manualMonthlyExpense = ref(0);
const useAutoExpense = ref(true);
const manualRegularMonthlyIncome = ref(0);
const manualAnnualBonus = ref(0);
const useAutoIncome = ref(true);
const useAutoBonus = ref(true);
const mortgageMonthlyPayment = ref(0);
const mortgagePayoffDate = ref("2042-05");

const simulationParams = computed(() => ({
  initialAssets: initialAssets.value,
  riskAssets: riskAssets.value,
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
  postFireExtraExpense: postFireExtraExpense.value,
  postFireFirstYearExtraExpense: postFireFirstYearExtraExpense.value,
  retirementLumpSumAtFire: retirementLumpSumAtFire.value,
  includePension: true,
  monthlyInvestment: monthlyInvestment.value,
  expenseBreakdown: past5MonthSummary.value.monthlyLivingExpenses.breakdown,
}));

const mortgageOptions = computed(() => {
  const options = [];
  const start = new Date();
  for (let i = 0; i <= 420; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    options.push({ val, label });
  }
  return options;
});

const monthlyExpense = computed(() => (useAutoExpense.value ? autoMonthlyExpense.value : manualMonthlyExpense.value));
const regularMonthlyIncome = computed(() =>
  useAutoIncome.value ? autoRegularMonthlyIncome.value : manualRegularMonthlyIncome.value,
);
const annualBonus = computed(() =>
  includeBonus.value ? (useAutoBonus.value ? autoAnnualBonus.value : manualAnnualBonus.value) : 0,
);
const monthlyIncome = computed(() => regularMonthlyIncome.value + annualBonus.value / 12);
const annualInvestment = computed(() => monthlyInvestment.value * 12);
const annualSavings = computed(() => Math.max(0, (monthlyIncome.value - monthlyExpense.value - monthlyInvestment.value) * 12));

const autoPostFireFirstYearExtraExpense = computed(() => {
  const annualIncome = monthlyIncome.value * 12;
  return Math.round((annualIncome * 0.15) / 10000) * 10000;
});
const postFireFirstYearExtraExpense = computed(() =>
  useAutoFirstYearExtra.value ? autoPostFireFirstYearExtraExpense.value : manualPostFireFirstYearExtraExpense.value
);

watchEffect(() => {
  if (autoMonthlyExpense.value && useAutoExpense.value) {
    manualMonthlyExpense.value = autoMonthlyExpense.value;
  }
  if (useAutoIncome.value) {
    manualRegularMonthlyIncome.value = autoRegularMonthlyIncome.value;
  }
  if (useAutoBonus.value) {
    manualAnnualBonus.value = autoAnnualBonus.value;
  }
  if (autoMortgageMonthlyPayment.value > 0 && mortgageMonthlyPayment.value === 0) {
    mortgageMonthlyPayment.value = autoMortgageMonthlyPayment.value;
  }
  if (useAutoFirstYearExtra.value) {
    manualPostFireFirstYearExtraExpense.value = autoPostFireFirstYearExtraExpense.value;
  }
});

const growthData = computed(() => generateGrowthTable(simulationParams.value));

const monteCarloResults = ref(null);
const isCalculatingMonteCarlo = ref(false);

const runMonteCarlo = () => {
  if (!useMonteCarlo.value) return;
  isCalculatingMonteCarlo.value = true;
  // Give UI a chance to show loading state
  setTimeout(() => {
    monteCarloResults.value = runMonteCarloSimulation(simulationParams.value, {
      trials: monteCarloTrials.value,
      annualVolatility: monteCarloVolatility.value / 100,
      seed: monteCarloSeed.value,
    });
    isCalculatingMonteCarlo.value = false;
  }, 10);
};

watch(useMonteCarlo, (val) => {
  if (!val) {
    monteCarloResults.value = null;
  }
});

const annualSimulationData = computed(() => generateAnnualSimulation(simulationParams.value));

const fireAchievementMonth = computed(() => growthData.value.fireReachedMonth);
const fireAchievementAge = computed(() => Math.floor(currentAge.value + fireAchievementMonth.value / 12));
const pensionAnnualAtFire = computed(() => calculateMonthlyPension(60, fireAchievementAge.value) * 12);
const estimatedMonthlyPensionAt60 = computed(() => calculateMonthlyPension(60, fireAchievementAge.value));

const requiredAssetsAtFire = computed(() => {
  const fireMonth = fireAchievementMonth.value;
  if (fireMonth < 0 || fireMonth >= 1200) return 0;
  const firePoint = growthData.value.table.find((row) => row.month === fireMonth);
  return Math.round(firePoint?.assets ?? 0);
});

const mortgagePayoffAge = computed(() => {
  if (!mortgagePayoffDate.value) return null;
  const payoff = new Date(mortgagePayoffDate.value + "-01");
  return calculateAge(USER_BIRTH_DATE, payoff);
});

const daughterIndependenceAge = computed(() => {
  return calculateAge(USER_BIRTH_DATE, new Date("2037-04-01"));
});

const chartAnnotations = computed(() => {
  const list = [];
  if (fireAchievementMonth.value > 0 && fireAchievementMonth.value < 1200) {
    list.push({ age: fireAchievementAge.value, label: "FIRE達成" });
  }
  list.push({ age: 60, label: "年金開始(本人)" });
  list.push({ age: 62, label: "年金開始(妻)" });
  list.push({ age: daughterIndependenceAge.value, label: "娘の独立" });
  if (mortgagePayoffAge.value) {
    list.push({ age: mortgagePayoffAge.value, label: "ローン完済" });
  }
  return list;
});

const fireDate = (months) => {
  if (months >= 1200 || months < 0) return "未達成 (100年以上)";
  const now = new Date();
  now.setMonth(now.getMonth() + months);
  return `${now.getFullYear()}年${now.getMonth() + 1}月`;
};

const formatMonths = (m) => {
  if (m >= 1200 || m < 0) return "100年以上";
  const years = Math.floor(m / 12);
  const months = m % 12;
  if (years === 0) return `${months}ヶ月`;
  return `${years}年${months}ヶ月`;
};

const copyText = async (text) => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "absolute";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
};

const daughterBreakdown = computed(() => calculateDaughterAssetsBreakdown(data.value));

const algorithmExplanationSegments = computed(() => {
  return generateAlgorithmExplanationSegments({
    daughterBreakdown: daughterBreakdown.value,
    fireAchievementAge: fireAchievementAge.value,
    pensionAnnualAtFire: pensionAnnualAtFire.value,
    withdrawalRatePct: withdrawalRate.value,
    postFireExtraExpenseMonthly: postFireExtraExpense.value,
    postFireFirstYearExtraExpense: postFireFirstYearExtraExpense.value,
    retirementLumpSumAtFire: retirementLumpSumAtFire.value,
    useMonteCarlo: useMonteCarlo.value,
    monteCarloTrials: monteCarloTrials.value,
    monteCarloVolatilityPct: monteCarloVolatility.value,
  });
});

const algorithmExplanationFull = computed(() => {
  return algorithmExplanationSegments.value
    .map((seg) => seg.value)
    .join("");
});

const buildConditionsAndAlgorithmJson = () => ({
  conditions: {
    totalFinancialAssetsYen: initialAssets.value,
    riskAssetsYen: riskAssets.value,
    cashAssetsYen: cashAssets.value,
    estimatedAnnualExpenseYen: monthlyExpense.value * 12,
    estimatedAnnualIncomeYen: monthlyIncome.value * 12,
    annualInvestmentYen: annualInvestment.value,
    annualSavingsYen: annualSavings.value,
    annualBonusYen: annualBonus.value,
    requiredAssetsAtFireYen: requiredAssetsAtFire.value,
    fireAchievementMonth: fireAchievementMonth.value,
    fireAchievementAge: fireAchievementAge.value,
    mortgagePayoffDate: mortgagePayoffDate.value || null,
    expectedAnnualReturnRatePercent: annualReturnRate.value,
    includeInflation: includeInflation.value,
    inflationRatePercent: inflationRate.value,
    includeTax: includeTax.value,
    taxRatePercent: taxRate.value,
    withdrawalRatePercent: withdrawalRate.value,
    postFireExtraExpenseMonthlyYen: postFireExtraExpense.value,
    postFireFirstYearExtraExpenseYen: postFireFirstYearExtraExpense.value,
    retirementLumpSumAtFireYen: retirementLumpSumAtFire.value,
  },
  monteCarlo: monteCarloResults.value ? {
    successRatePercent: (monteCarloResults.value.successRate * 100).toFixed(1),
    p10Yen: monteCarloResults.value.p10,
    p50Yen: monteCarloResults.value.p50,
    p90Yen: monteCarloResults.value.p90,
    trials: monteCarloResults.value.trials,
    volatilityPercent: monteCarloVolatility.value,
    seed: monteCarloSeed.value
  } : null,
  pensionEstimates: {
    householdMonthlyAtUserAge60Yen: estimatedMonthlyPensionAt60.value,
    householdAnnualAtUserAge60Yen: pensionAnnualAtFire.value,
    userMonthlyAtAge60Yen: calculateMonthlyPension(60, fireAchievementAge.value),
    spouseMonthlyAtUserAge62Yen: Math.round(FIRE_ALGORITHM_CONSTANTS.pension.basicFullAnnualYen / 12),
    spousePensionStartWhenUserAge: FIRE_ALGORITHM_CONSTANTS.pension.spouseUserAgeStart,
  },
  algorithmConstants: FIRE_ALGORITHM_CONSTANTS,
  algorithmExplanation: algorithmExplanationFull.value,
});

const buildAnnualTableJson = () => annualSimulationData.value.map((row) => ({
  age: row.age,
  incomeWithPensionYen: row.income + row.pension,
  expensesYen: row.expenses,
  investmentGainYen: row.investmentGain,
  withdrawalYen: row.withdrawal,
  totalAssetsYen: row.assets,
  savingsCashYen: row.cashAssets,
  riskAssetsYen: row.riskAssets,
}));

const copyConditionsAndAlgorithm = () => JSON.stringify(buildConditionsAndAlgorithmJson(), null, 2);

const copyAnnualTable = () => JSON.stringify(buildAnnualTableJson(), null, 2);

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
