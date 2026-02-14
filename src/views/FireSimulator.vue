<script setup>
import { computed, ref, watchEffect } from "vue";
import { usePortfolioData } from "@/composables/usePortfolioData";
import { formatYen } from "@/domain/format";
import {
  calculateFirePortfolio,
  estimateMonthlyExpenses,
  estimateIncomeSplit,
  simulateFire,
  generateGrowthTable,
  generateAnnualSimulation,
  estimateMortgageMonthlyPayment,
  calculateMonthlyPension,
} from "@/domain/fire";
import FireGrowthChart from "@/components/FireGrowthChart.vue";
import HistogramChart from "@/components/HistogramChart.vue";
import FireSimulationTable from "@/components/FireSimulationTable.vue";
import FireSimulationChart from "@/components/FireSimulationChart.vue";

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
const postFireExtraExpense = ref(60000);
const withdrawalRate = ref(4);
const iterations = ref(1000);
const includeBonus = ref(true);

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
const expenseResult = computed(() =>
  data.value?.cashFlow
    ? estimateMonthlyExpenses(data.value.cashFlow)
    : { total: 0, breakdown: [], averageSpecial: 0, monthCount: 0 },
);
const autoMonthlyExpense = computed(() => expenseResult.value.total);
const autoIncomeSplit = computed(() =>
  data.value?.cashFlow
    ? estimateIncomeSplit(data.value.cashFlow)
    : { regularMonthly: 0, bonusAnnual: 0, monthlyTotal: 0, regularBreakdown: [], bonusBreakdown: [], monthCount: 0 },
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
const useAutoBonus = ref(true);
const mortgageMonthlyPayment = ref(0);
const mortgagePayoffDate = ref("2042-07");

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
});

// Simulation results
const simResult = computed(() => {
  return simulateFire({
    initialAssets: initialAssets.value,
    riskAssets: riskAssets.value,
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
    postFireExtraExpense: postFireExtraExpense.value,
    iterations: iterations.value,
    includePension: true,
  });
});

const growthData = computed(() => {
  const params = {
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
    includePension: true,
    monthlyInvestment: monthlyInvestment.value,
  };
  return generateGrowthTable(params);
});

const annualSimulationData = computed(() => {
  return generateAnnualSimulation({
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
    includePension: true,
    monthlyInvestment: monthlyInvestment.value,
  });
});

const stats = computed(() => simResult.value.stats);

const medianFireAge = computed(() => Math.floor(currentAge.value + stats.value.median / 12));
const medianPensionAnnual = computed(() => calculateMonthlyPension(60, medianFireAge.value) * 12);

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

const estimatedMonthlyWithdrawal = computed(() => {
  const basePlusExtra = monthlyExpense.value + postFireExtraExpense.value;
  const grossExpense = includeTax.value
    ? basePlusExtra / (1 - taxRate.value / 100)
    : basePlusExtra;

  const initialRequiredAssets = Math.round(growthData.value.table[0]?.requiredAssets ?? 0);
  const withdrawalFromRate = (initialRequiredAssets * (withdrawalRate.value / 100)) / 12;

  return Math.max(grossExpense, withdrawalFromRate);
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
          <input v-model.number="withdrawalRate" type="number" step="0.1" />
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
          <div v-if="useAutoIncome && autoIncomeSplit.monthCount > 0" class="expense-breakdown">
            <details>
              <summary>算出内訳 ({{ autoIncomeSplit.monthCount }}ヶ月平均)</summary>
              <div class="breakdown-content">
                <div v-for="item in autoIncomeSplit.regularBreakdown" :key="item.name" class="breakdown-row">
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
              <label class="auto-toggle">
                <input type="checkbox" v-model="useAutoBonus" /> 自動算出
              </label>
              <label class="auto-toggle">
                <input type="checkbox" v-model="includeBonus" /> ボーナスを考慮
              </label>
            </div>
          </div>
          <input v-model.number="manualAnnualBonus" type="number" step="10000" :disabled="useAutoBonus || !includeBonus" />
          <div v-if="useAutoBonus && autoIncomeSplit.monthCount > 0" class="expense-breakdown">
            <details>
              <summary>算出内訳 ({{ autoIncomeSplit.monthCount }}ヶ月平均)</summary>
              <div class="breakdown-content">
                <div v-for="item in autoIncomeSplit.bonusBreakdown" :key="item.name" class="breakdown-row">
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
        <div class="filter-item">
          <label>FIRE後の社会保険料・税(月額)</label>
          <input v-model.number="postFireExtraExpense" type="number" step="5000" />
        </div>
      </div>

      <div class="initial-summary">
        <details>
          <summary>条件の確認</summary>
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
              <span class="meta">現金資産:</span>
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(cashAssets) }}</span>
              <span class="meta"> (生活費の{{ monthsOfCash.toFixed(1) }}ヶ月分)</span>
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
              <span class="amount-value" style="margin-left: 8px;">{{ formatYen(Math.round(growthData.table[0]?.requiredAssets ?? 0)) }}</span>
              <span class="meta"> (100歳寿命)</span>
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
              <span class="meta">リスク:</span>
              <span style="margin-left: 8px;">{{ annualStandardDeviation }}%</span>
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
          <div class="algorithm-details" style="font-size: 0.8rem; color: var(--muted); margin-top: 10px; line-height: 1.6;">
            <ul style="margin: 0; padding-left: 20px;">
              <li>{{ iterations }}回試行のモンテカルロ・シミュレーションにより達成時期の分布を算出しています。</li>
              <li>100歳寿命までの必要資産額を、将来の支出額から現在価値（PV）に割り戻して算出しています。</li>
              <li>リスク資産の運用益は正規乱数（期待リターンと標準偏差）を用いて再現しており、不確実性を考慮しています。</li>
              <li>娘名義の資産（現金・株式・投資信託・年金・ポイント）は初期資産から除外してシミュレーションしています。</li>
              <li style="color: var(--primary); font-weight: bold;">投資優先順位ルール: 生活防衛資金として現金を維持するため、毎月の投資額は「前月までの貯金残高 + 当月の収支剰余金」を上限として自動調整されます（貯金がマイナスにならないよう制限されます）。</li>
              <li>FIRE達成後は追加投資を停止し、定期収入（給与・ボーナス等）もゼロになると仮定しています。</li>
              <li>FIRE達成後は、年間支出または資産の{{ withdrawalRate }}%（設定値）のいずれか大きい額を引き出すと仮定しています。</li>
              <li style="margin-top: 8px; list-style: none; font-weight: bold; color: var(--text);">■ 年金受給の見込みについて</li>
              <li>本シミュレーションでは、ご本人が{{ medianFireAge }}歳でFIREし、60歳から年金を繰上げ受給する以下のシナリオを想定しています。</li>
              <ul style="margin: 0; padding-left: 20px;">
                <li>受給開始: 60歳（2039年〜）</li>
              <li>世帯受給額（概算）: <strong class="privacy-mask">年額 {{ formatYen(medianPensionAnnual) }}</strong>（<span class="privacy-mask">月額 {{ formatYen(Math.round(medianPensionAnnual / 12)) }}</span>）</li>
                <li>算定根拠:
                  <ul style="margin: 0; padding-left: 20px;">
                  <li>ねんきん特別便のデータ（累計納付額 <span class="privacy-mask">約1,496万円</span>）に基づき、現在までの加入実績を反映。</li>
                    <li>20代前半の未納期間（4年間）による基礎年金の減額を反映。</li>
                    <li>{{ medianFireAge }}歳リタイア(シミュレーション結果による)に伴う厚生年金加入期間の停止を考慮。</li>
                    <li>60歳繰上げ受給による受給額24%減額を適用。</li>
                  </ul>
                </li>
                <li>配偶者加算: 奥様（1976年生）が65歳に達した時点から、奥様自身の基礎年金が世帯収入に加算されるものとして計算。</li>
              </ul>
              <li style="margin-top: 8px;">住宅ローンの完済月以降は、月間支出からローン返済額を自動的に差し引いてシミュレーションを継続します。</li>
              <li>達成時期の90%信頼区間: {{ formatMonths(stats.p5) }} 〜 {{ formatMonths(stats.p95) }} (不確実性を考慮した予測)</li>
              <li>100歳までの達成率: <span :class="achievementProbability > 80 ? 'is-positive' : 'is-negative' " style="font-weight: bold;">{{ achievementProbability.toFixed(1) }}%</span> ({{ iterations }}回の試行結果に基づく)</li>
              <li>FIRE後の追加支出（デフォルト<span class="privacy-mask">6万円</span>）は、国民年金（夫婦2名分: <span class="privacy-mask">約3.5万円</span>）、国民健康保険（均等割7割軽減想定: <span class="privacy-mask">約1.5万円</span>）、固定資産税（<span class="privacy-mask">月1万円</span>）を合算した目安値です。</li>
              <li>※ 注意：リタイア1年目は前年の所得に基づき社会保険料・住民税が高額になる「1年目の罠」があるため、別途数十万円単位の予備費確保を推奨します。</li>
            </ul>
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
        <h2>FIRE達成に必要な資産</h2>
        <p class="is-positive amount-value">{{ formatYen(Math.round(growthData.table[0]?.requiredAssets ?? 0)) }}</p>
        <p class="meta">あと <span class="amount-value">{{ formatYen(Math.max(0, Math.round(growthData.table[0]?.requiredAssets ?? 0) - initialAssets)) }}</span> 不足</p>
      </article>
      <article class="card">
        <h2>月額の想定取り崩し額</h2>
        <p class="amount-value">{{ formatYen(estimatedMonthlyWithdrawal) }}</p>
        <p class="meta">
          {{ useAutoExpense ? '実績' : '手入力' }}に税金・取崩率を考慮
        </p>
      </article>
    </div>

    <FireGrowthChart :data="growthData.table" :base-age="currentAge" />

    <div class="chart-grid">
      <HistogramChart :data="simResult.trials" :max-months="1200" />
    </div>

    <FireSimulationChart :data="annualSimulationData" />
    <FireSimulationTable :data="annualSimulationData" />

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
