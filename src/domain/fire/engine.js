import { getUniqueMonths, getExpenseType } from "../cashFlow";
import { formatYen } from "../format";
import { FIRE_ALGORITHM_CONSTANTS, calculateMonthlyPension } from "./pension";
import {
  calculateRiskAssets,
  calculateExcludedOwnerAssets,
  calculateDaughterAssetsBreakdown,
  calculateFirePortfolio,
  calculateCashAssets,
} from "./portfolio";

/**
 * Independence date for the daughter: born 2013-02-20, turns 24 in 2037-02.
 * Starts working from 2037-04.
 */
const INDEPENDENCE_MONTH_KEY = "2037-04";

export {
  FIRE_ALGORITHM_CONSTANTS,
  calculateMonthlyPension,
  calculateRiskAssets,
  calculateExcludedOwnerAssets,
  calculateDaughterAssetsBreakdown,
  calculateFirePortfolio,
  calculateCashAssets,
};

/**
 * Create text segments that explain the FIRE algorithm.
 */
export function generateAlgorithmExplanationSegments(params) {
  const {
    daughterBreakdown,
    fireAchievementAge,
    pensionAnnualAtFire,
    withdrawalRatePct,
    postFireExtraExpenseMonthly,
    postFireFirstYearExtraExpense,
    retirementLumpSumAtFire,
    useMonteCarlo,
    monteCarloTrials,
    monteCarloVolatilityPct,
  } = params;

  const daughterDetailStr = `現金:${formatYen(daughterBreakdown.cash)}, 株式:${formatYen(daughterBreakdown.stocks)}, 投資信託:${formatYen(daughterBreakdown.funds)}, 年金:${formatYen(daughterBreakdown.pensions)}, ポイント:${formatYen(daughterBreakdown.points)}, 負債:${formatYen(daughterBreakdown.liabilities)}`;

  const segments = [
    { type: "text", value: "本シミュレーションは、設定された期待リターン・インフレ率・年金・ローン等のキャッシュフローに基づき、100歳時点で資産が残る最短リタイア年齢を算出しています。\n・必要資産目安は「FIRE達成年齢で退職して100歳まで資産が尽きない最小条件」を満たす達成時点の金融資産額と同じ定義です。\n・娘名義の資産（" },
    { type: "amount", value: daughterDetailStr },
    { type: "text", value: "）は初期資産から除外してシミュレーションしています。\n・投資優先順位ルール: 生活防衛資金として現金を維持するため、毎月の投資額は「前月までの貯金残高 + 当月の収支剰余金」を上限として自動調整されます（貯金がマイナスにならないよう制限されます）。\n・FIRE達成後は追加投資を停止し、定期収入（給与・ボーナス等）もゼロになると仮定しています。\n・FIRE達成月には退職金（一括）として " },
    { type: "amount", value: formatYen(retirementLumpSumAtFire) },
    { type: "text", value: " が現金資産に加算されます。\n・FIRE達成後は、年間支出または資産の" },
    { type: "text", value: String(withdrawalRatePct) },
    { type: "text", value: "%（設定値）のいずれか大きい額を引き出すと仮定しています。余剰分は再投資されず現金に滞留します。\n\n■ 年金受給の見込みについて\n本シミュレーションでは、ご本人が" },
    { type: "text", value: String(fireAchievementAge) },
    { type: "text", value: "歳でFIREし、60歳から年金を繰上げ受給する以下のシナリオを想定しています。\n・受給開始: 60歳（2039年〜）\n・世帯受給額（概算）: 年額 " },
    { type: "amount", value: formatYen(pensionAnnualAtFire) },
    { type: "text", value: "（月額 " },
    { type: "amount", value: formatYen(Math.round(pensionAnnualAtFire / 12)) },
    { type: "text", value: "）\n・算定根拠:\n  - ねんきん特別便のデータ（累計納付額 " },
    { type: "amount", value: "約1,496万円" },
    { type: "text", value: "）に基づき、現在までの加入実績を反映。\n  - 20代前半の未納期間（4年間）による基礎年金の減額を反映。\n  - " },
    { type: "text", value: String(fireAchievementAge) },
    { type: "text", value: "歳リタイア(シミュレーション結果による)に伴う厚生年金加入期間の停止を考慮。\n  - 60歳繰上げ受給による受給額24%減額を適用。\n・配偶者加算: 奥様（1976年生）が65歳に達した時点から、奥様自身の基礎年金が世帯収入に加算されるものとして計算。\n\n住宅ローンの完済月以降は、月間支出からローン返済額を自動的に差し引いてシミュレーションを継続します。\n\n■ 家族構成の変化（娘の独立）について\n娘が24歳になる2037年4月以降は、家族人数が3人から2人に減少するものとして生活費を見直します。\n・対象カテゴリと減額率:\n  - 食費: 約3割減 (x2/3)\n  - 教養・教育: ほぼゼロ (¥0)\n  - 通信費: 約3割減 (x2/3)\n  - 衣服・美容: 約3割減 (x2/3)\n  - 日用品: 約3割減 (x2/3)\n・その他のカテゴリ（住居・光熱費・保険等）は変更なしと仮定しています。\n" },
  ];

  if (useMonteCarlo) {
    segments.push(
      { type: "text", value: "\n■ 順序リスク評価（モンテカルロ法）について\n本シミュレーションでは " },
      { type: "text", value: String(monteCarloTrials) },
      { type: "text", value: " 回のランダム試行を行い、期待リターンにボラティリティ（年率 " },
      { type: "text", value: String(monteCarloVolatilityPct) },
      { type: "text", value: "%）を加味した収益率の変動が資産寿命に与える影響を評価しています。\n・リターン分布: 対数正規分布を仮定し、Box-Muller法を用いて月次の収益率を生成しています。\n・P50 (中央値): 試行結果のうち、上位から50%の位置にあるシナリオです。期待リターンに近い結果を示します。\n・P10 (下位10%): 試行結果のうち、下位10%（ワーストに近い）のシナリオです。不況が続いた場合の生存確認に利用します。\n・P90 (上位10%): 試行結果のうち、上位10%（好況）のシナリオです。\n" }
    );
  }

  segments.push(
    { type: "text", value: "\n■ 各項目の算出定義\n・収入 (年金込): 定期収入（給与等） + 年金受給額の合算です。\n・支出: (基本生活費 - 住宅ローン) × インフレ調整 + 住宅ローン(固定) + FIRE後追加支出（FIRE達成月より加算） + FIRE1年目特別支出\n・運用益: 当年中の運用リターン合計。月次複利で計算されます。\n・取り崩し額: 生活費の不足分、または「資産 × 取崩率」のいずれか大きい額を引き出します（税金考慮時は利益分のみグロスアップ）。\n・貯金額 (現金): 前年末残高 + 当年収支(収入 - 支出) - 当年投資額 + リスク資産からの補填（純額）\n・リスク資産額: 前年末残高 + 投資額 + 運用益 - 取崩額(グロス)\n\nFIRE後の追加支出（デフォルト" },
    { type: "amount", value: formatYen(postFireExtraExpenseMonthly) },
    { type: "text", value: "）は、国民年金（夫婦2名分: " },
    { type: "amount", value: "約3.5万円" },
    { type: "text", value: "）、国民健康保険（均等割7割軽減想定: " },
    { type: "amount", value: "約1.5万円" },
    { type: "text", value: "）、固定資産税（" },
    { type: "amount", value: "月1万円" },
    { type: "text", value: "）を合算した目安値です。\n・リタイア1年目の特別支出: 前年所得に基づく社会保険料・住民税のスパイク分として、FIRE後12か月間にわたり年額 " },
    { type: "amount", value: formatYen(postFireFirstYearExtraExpense) },
    { type: "text", value: "（インフレ調整あり）が追加で計上されます。" }
  );

  return segments;
}


const FIVE_MONTH_LOOKBACK_COUNT = 5;

/**
 * Return month keys for past months.
 */
function getPastMonths(now, count) {
  const months = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

/**
 * Loop past lookback rows and run callback.
 */
function processLookbackCashFlow(cashFlow, callback) {
  const now = new Date();
  const targetMonths = getPastMonths(now, FIVE_MONTH_LOOKBACK_COUNT);
  const monthSet = new Set(targetMonths);

  cashFlow.forEach((item) => {
    if (item.isTransfer) return;
    const month = item.date?.substring(0, 7) || "";
    if (!monthSet.has(month)) return;
    callback(item);
  });
}

/**
 * Estimate monthly basic expenses from cash flow.
 * Returns a breakdown by category and excludes special expenses.
 * Also excludes "Cash" and "Card" related categories as requested.
 */
/**
 * Estimate monthly expenses from past cash flow rows.
 */
export function estimateMonthlyExpenses(cashFlow) {
  const divisor = FIVE_MONTH_LOOKBACK_COUNT;
  const breakdownMap = {};
  let totalNormalExpense = 0;
  let totalSpecialExpense = 0;
  let totalFixedExpense = 0;
  let totalVariableExpense = 0;

  processLookbackCashFlow(cashFlow, (item) => {
    if (item.amount >= 0) return;

    const absAmount = Math.abs(item.amount);
    const category = item.category || "未分類";
    const type = getExpenseType(item);

    if (type === "exclude") {
      if (category.startsWith("特別な支出")) {
        totalSpecialExpense += absAmount;
      }
      return;
    }

    if (type === "fixed") {
      totalFixedExpense += absAmount;
    } else if (type === "variable") {
      totalVariableExpense += absAmount;
    }

    totalNormalExpense += absAmount;
    const largeCat = category.split("/")[0];
    breakdownMap[largeCat] = (breakdownMap[largeCat] || 0) + absAmount;
  });

  const breakdown = Object.entries(breakdownMap)
    .map(([name, total]) => ({
      name,
      amount: Math.round(total / divisor),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    total: Math.round(totalNormalExpense / divisor),
    breakdown,
    averageSpecial: Math.round(totalSpecialExpense / divisor),
    averageFixed: Math.round(totalFixedExpense / divisor),
    averageVariable: Math.round(totalVariableExpense / divisor),
    monthCount: divisor,
  };
}

/**
 * Estimate monthly average income from cash flow (previous 5 months, excluding current month).
 */
/**
 * Estimate monthly income from past cash flow rows.
 */
export function estimateMonthlyIncome(cashFlow) {
  const divisor = FIVE_MONTH_LOOKBACK_COUNT;
  let totalIncome = 0;

  processLookbackCashFlow(cashFlow, (item) => {
    if (item.amount <= 0) return;
    totalIncome += item.amount;
  });

  return Math.round(totalIncome / divisor);
}

/**
 * Estimate income split by regular (給与等) and bonus (賞与/ボーナス) from cash flow.
 * - regularMonthly: average monthly regular income
 * - bonusAnnual: total annualized bonus estimated from the target window
 */
/**
 * Split income into regular and bonus values.
 */
export function estimateIncomeSplit(cashFlow) {
  const divisor = FIVE_MONTH_LOOKBACK_COUNT;
  let totalRegularIncome = 0;
  let totalBonusIncome = 0;
  const regularBreakdownMap = {};
  const bonusBreakdownMap = {};

  processLookbackCashFlow(cashFlow, (item) => {
    if (item.amount <= 0) return;

    const category = item.category || "未分類";
    if (category === "収入/給与") {
      totalRegularIncome += item.amount;
      regularBreakdownMap[category] = (regularBreakdownMap[category] || 0) + item.amount;
    } else if (category.startsWith("収入/")) {
      totalBonusIncome += item.amount;
      bonusBreakdownMap[category] = (bonusBreakdownMap[category] || 0) + item.amount;
    }
  });

  const regularMonthly = Math.round(totalRegularIncome / divisor);
  const bonusAnnual = Math.round(totalBonusIncome * (12 / divisor));

  const regularBreakdown = Object.entries(regularBreakdownMap)
    .map(([name, total]) => ({
      name,
      amount: Math.round(total / divisor),
    }))
    .sort((a, b) => b.amount - a.amount);

  const bonusBreakdown = Object.entries(bonusBreakdownMap)
    .map(([name, total]) => ({
      name,
      amount: Math.round(total * (12 / divisor)),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    regularMonthly,
    bonusAnnual,
    monthlyTotal: regularMonthly + bonusAnnual / 12,
    regularBreakdown,
    bonusBreakdown,
    monthCount: divisor,
  };
}

/**
 * Aggregate past 5 months summary (excluding current month) for copying and simulation.
 */
/**
 * Build one summary object for the past five months.
 */
export function getPast5MonthSummary(cashFlow) {
  const expenses = estimateMonthlyExpenses(cashFlow);
  const income = estimateIncomeSplit(cashFlow);

  return {
    monthlyLivingExpenses: {
      average: expenses.total,
      breakdown: expenses.breakdown,
      averageSpecial: expenses.averageSpecial,
    },
    monthlyRegularIncome: {
      average: income.regularMonthly,
      breakdown: income.regularBreakdown,
    },
    annualBonus: {
      average: income.bonusAnnual,
      breakdown: income.bonusBreakdown,
    },
    avgFixedMonthly: expenses.averageFixed,
    avgVariableMonthly: expenses.averageVariable,
    monthCount: expenses.monthCount,
  };
}

/**
 * Estimate mortgage monthly payment from category "住宅/ローン返済".
 */
/**
 * Estimate mortgage payment per month from cash flow.
 */
export function estimateMortgageMonthlyPayment(cashFlow) {
  const divisor = FIVE_MONTH_LOOKBACK_COUNT;
  let totalMortgage = 0;

  processLookbackCashFlow(cashFlow, (item) => {
    if (item.amount >= 0) return;
    if ((item.category || "").startsWith("住宅/ローン返済")) {
      totalMortgage += Math.abs(item.amount);
    }
  });

  return Math.round(totalMortgage / divisor);
}

/**
 * Calculate required assets to last until age 100.
 * Account for inflation, pension, and the 4% withdrawal floor rule.
 * Uses a simplified numerical approximation for the target asset.
 */
/**
 * Calculate required assets at one month by backward method.
 */
function calculateRequiredAssets({
  monthlyExpense,
  monthlyReturn,
  monthlyInflation,
  remainingMonths,
  taxRate,
  includeTax,
  currentAgeInSimulation,
  includePension = true,
  withdrawalRate = 0.04,
}) {
  if (remainingMonths <= 0) return 0;

  const r = monthlyReturn;
  const g = monthlyInflation;
  const w = withdrawalRate / 12;
  const t = includeTax ? taxRate : 0;

  // Numerical approximation of required assets (Backward Loop)
  // We want to find A such that we survive remainingMonths
  let A = 0;
  for (let i = remainingMonths - 1; i >= 0; i--) {
    const age = currentAgeInSimulation + i / 12;
    // For required assets calculation at month 'i', we assume FIRE'd at 'currentAgeInSimulation'
    const P = includePension ? calculateMonthlyPension(age, currentAgeInSimulation) : 0;
    const E = monthlyExpense * Math.pow(1 + g, i);

    // Withdrawal needed to cover expenses (net)
    const W_expense = Math.max(0, E - P);

    // Case 1: Expense > Withdrawal Floor
    const A_case1 = (A / (1 + r)) + W_expense / (1 - t);

    // Case 2: Withdrawal Floor > Expense
    // Conservative approach:
    const A_case2 = (A / (1 + r) - (P / (1 - t))) / (1 - (w / (1 - t)));

    A = Math.max(A_case1, A_case2);
  }

  return Math.max(0, A);
}

/**
 * Convert Date to YYYY-MM month key.
 */
function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Calculate monthly expense with inflation and events.
 */
function calculateCurrentMonthlyExpense({
  baseMonthlyExpense,
  monthlyInflationRate,
  monthIndex,
  simulationStartDate,
  mortgageMonthlyPayment,
  mortgagePayoffDate,
  lifestyleReductionFactor = 1.0,
}) {
  const mortgage = mortgageMonthlyPayment || 0;
  const nonMortgageExpense = Math.max(0, baseMonthlyExpense - mortgage);

  const currentDate = new Date(simulationStartDate);
  currentDate.setMonth(currentDate.getMonth() + monthIndex);
  const currentMonthKey = toMonthKey(currentDate);

  const isIndependent = currentMonthKey >= INDEPENDENCE_MONTH_KEY;
  const effectiveReduction = isIndependent ? lifestyleReductionFactor : 1.0;

  const inflatedNonMortgage = (nonMortgageExpense * effectiveReduction) * Math.pow(1 + monthlyInflationRate, monthIndex);

  if (!mortgage || !mortgagePayoffDate) {
    return inflatedNonMortgage + mortgage;
  }

  // Use strictly greater than to ensure the payoff month itself is still paid
  if (currentMonthKey > mortgagePayoffDate) {
    return inflatedNonMortgage;
  }

  return inflatedNonMortgage + mortgage;
}

/**
 * Calculate the reduction factor for lifestyle expenses when family size changes from 3 to 2.
 * Rules:
 * - Food (食費): x2/3
 * - Education (教養・教育): 0
 * - Communication (通信費): x2/3
 * - Clothing/Beauty (衣服・美容): x2/3
 * - Daily goods (日用品): x2/3
 * - Others: No change
 */
/**
 * Compute lifestyle reduction factor after daughter independence.
 */
export function calculateLifestyleReduction(breakdown) {
  if (!breakdown || !Array.isArray(breakdown) || breakdown.length === 0) {
    return 1.0;
  }

  const reductionRules = {
    "食費": 2 / 3,
    "教養・教育": 0,
    "通信費": 2 / 3,
    "衣服・美容": 2 / 3,
    "日用品": 2 / 3,
  };

  let originalTotal = 0;
  let reducedTotal = 0;

  breakdown.forEach((item) => {
    originalTotal += item.amount;
    const multiplier = reductionRules[item.name] ?? 1.0;
    reducedTotal += item.amount * multiplier;
  });

  if (originalTotal === 0) return 1.0;
  return reducedTotal / originalTotal;
}

/**
 * Normalizes and validates simulation parameters.
 */
/**
 * Normalize user params and apply defaults.
 */
export function normalizeFireParams(params) {
  if (!params) return normalizeFireParams({});
  const monthlyExpense = params.monthlyExpense ?? (params.monthlyExpenses ? params.monthlyExpenses / 12 : 0);
  return {
    initialAssets: Number(params.initialAssets ?? 0),
    riskAssets: Number(params.riskAssets ?? 0),
    annualReturnRate: Number(params.annualReturnRate ?? 0),
    monthlyExpense: Number(monthlyExpense),
    monthlyIncome: Number(params.monthlyIncome ?? 0),
    currentAge: Number(params.currentAge || 40),
    includeInflation: Boolean(params.includeInflation),
    inflationRate: Number(params.inflationRate ?? 0.02),
    includeTax: Boolean(params.includeTax),
    taxRate: Number(params.taxRate ?? 0.20315),
    withdrawalRate: Number(params.withdrawalRate ?? 0.04),
    mortgageMonthlyPayment: Number(params.mortgageMonthlyPayment ?? 0),
    mortgagePayoffDate: params.mortgagePayoffDate || null,
    postFireExtraExpense: Number(params.postFireExtraExpense ?? 0),
    postFireFirstYearExtraExpense: Number(params.postFireFirstYearExtraExpense ?? 0),
    retirementLumpSumAtFire: Number(params.retirementLumpSumAtFire ?? 5000000),
    includePension: Boolean(params.includePension),
    monthlyInvestment: Number(params.monthlyInvestment ?? 0),
    maxMonths: Number(params.maxMonths ?? 1200),
    expenseBreakdown: params.expenseBreakdown || null,
  };
}

/**
 * Internal simulation engine.
 */
/**
 * Run core month-by-month FIRE simulation.
 */
function _runCoreSimulation(params, { recordMonthly = false, fireMonth = -1, returnsArray = null } = {}) {
  const {
    initialAssets,
    riskAssets,
    annualReturnRate,
    monthlyExpense,
    monthlyIncome,
    currentAge,
    maxMonths,
    includeInflation,
    inflationRate,
    includeTax,
    taxRate,
    withdrawalRate,
    mortgageMonthlyPayment,
    mortgagePayoffDate,
    postFireExtraExpense,
    postFireFirstYearExtraExpense,
    retirementLumpSumAtFire,
    includePension,
    monthlyInvestment,
  } = params;

  const monthlyExp = monthlyExpense;
  const monthlyReturnMean = Math.pow(1 + annualReturnRate, 1 / 12) - 1;
  const monthlyInflationRate = Math.pow(1 + (includeInflation ? inflationRate : 0), 1 / 12) - 1;
  const totalMonthsUntil100 = (100 - currentAge) * 12;
  const simulationStartDate = new Date();

  let currentRisk = riskAssets;
  let currentCostBasis = riskAssets; // Initialize cost basis with starting risk assets
  let currentCash = initialAssets - riskAssets;
  let fireReachedMonth = fireMonth;
  const monthlyData = recordMonthly ? [] : null;

  const simulationLimit = totalMonthsUntil100;
  const lifestyleReductionFactor = calculateLifestyleReduction(params.expenseBreakdown);

  for (let m = 0; m <= simulationLimit; m++) {
    const ageAtMonthM = currentAge + m / 12;
    const remainingMonths = Math.max(0, totalMonthsUntil100 - m);

    // 1. One-time injection of retirement lump sum at FIRE achievement month
    if (m === fireReachedMonth) {
      currentCash += retirementLumpSumAtFire;
    }

    const curMonthlyExp = calculateCurrentMonthlyExpense({
      baseMonthlyExpense: monthlyExp,
      monthlyInflationRate,
      monthIndex: m,
      simulationStartDate,
      mortgageMonthlyPayment,
      mortgagePayoffDate,
      lifestyleReductionFactor,
    });
    const extraWithInf = postFireExtraExpense * Math.pow(1 + monthlyInflationRate, m);

    // 2. Add first-year post-FIRE social insurance spike (12 months starting from FIRE month)
    let firstYearSpikeWithInf = 0;
    if (fireReachedMonth !== -1 && m >= fireReachedMonth && m < fireReachedMonth + 12) {
      firstYearSpikeWithInf = (postFireFirstYearExtraExpense / 12) * Math.pow(1 + monthlyInflationRate, m);
    }

    const assets = Math.max(0, currentCash + currentRisk);

    const isFire = fireReachedMonth !== -1 && m >= fireReachedMonth;
    const fireAgeAtMonthM = fireReachedMonth === -1 ? (currentAge + 100) : currentAge + fireReachedMonth / 12;
    const curPension = includePension ? calculateMonthlyPension(ageAtMonthM, fireAgeAtMonthM) : 0;

    const monthlyIncomeVal = isFire ? 0 : monthlyIncome;
    const monthlyExpensesVal = curMonthlyExp + (isFire ? extraWithInf : 0) + firstYearSpikeWithInf;
    const incomeAvailable = monthlyIncomeVal + curPension;

    if (recordMonthly && m <= maxMonths) {
      const reqAssets = calculateRequiredAssets({
        monthlyExpense: curMonthlyExp + extraWithInf + (m >= fireReachedMonth && m < fireReachedMonth + 12 ? (postFireFirstYearExtraExpense / 12) * Math.pow(1 + monthlyInflationRate, m) : 0),
        monthlyReturn: monthlyReturnMean,
        monthlyInflation: monthlyInflationRate,
        remainingMonths,
        taxRate,
        includeTax,
        currentAgeInSimulation: ageAtMonthM,
        includePension,
        withdrawalRate,
      });

      monthlyData.push({
        month: m,
        age: ageAtMonthM,
        assets,
        riskAssets: currentRisk,
        cashAssets: currentCash,
        requiredAssets: reqAssets,
        isFire,
        income: monthlyIncomeVal,
        pension: curPension,
        expenses: monthlyExpensesVal,
        investmentGain: 0,
        withdrawal: 0,
      });
    }

    if (m === totalMonthsUntil100) break;

    let monthlyWithdrawal = 0;
    let monthlyInvest = 0;
    let investmentGain = 0;
    const returnRate = returnsArray[m];

    if (!isFire) {
      // Accumulation: Pay expenses from income + cash, then invest surplus
      const netFlow = incomeAvailable - monthlyExpensesVal;
      const cashAfterFlow = currentCash + netFlow;

      if (cashAfterFlow < 0) {
        // Shortfall: take from risk (capped by available risk)
        const needed = Math.abs(cashAfterFlow);

        // Correct Tax Logic: Only tax the gain portion
        const gainRatio = currentRisk > 0 ? Math.max(0, (currentRisk - currentCostBasis) / currentRisk) : 0;
        const maxNetFromRisk = Math.max(0, currentRisk * (1 - (includeTax ? gainRatio * taxRate : 0)));
        const actualNetFromRisk = Math.min(needed, maxNetFromRisk);
        const grossFromRisk = actualNetFromRisk / (1 - (includeTax ? gainRatio * taxRate : 0));

        const costBasisWithdrawn = grossFromRisk * (1 - gainRatio);
        currentCostBasis -= costBasisWithdrawn;
        currentRisk -= grossFromRisk;
        currentRisk = Math.max(0, currentRisk);
        currentCostBasis = Math.max(0, currentCostBasis);

        currentCash = cashAfterFlow + actualNetFromRisk;
        monthlyWithdrawal = actualNetFromRisk > 0 ? grossFromRisk : 0;
      } else {
        // Surplus: invest
        monthlyInvest = Math.min(monthlyInvestment, cashAfterFlow);
        currentCash = cashAfterFlow - monthlyInvest;
        currentRisk += monthlyInvest;
        currentCostBasis += monthlyInvest; // Increase cost basis by investment amount
        monthlyWithdrawal = 0;
      }
    } else {
      // FIRE: Use income/pension first, then assets (cash/risk) to satisfy withdrawal target or cover expenses
      const targetWithdrawalFromAssets = (assets * withdrawalRate) / 12;
      const expenseShortfall = Math.max(0, monthlyExpensesVal - incomeAvailable);
      const netToTakeFromAssets = Math.max(expenseShortfall, targetWithdrawalFromAssets);

      // 1. Take from Cash first
      const takenFromCash = Math.min(currentCash, netToTakeFromAssets);
      const remainingShortfall = netToTakeFromAssets - takenFromCash;

      // 2. Take from Risk if Cash is insufficient (capped by available risk)
      // Correct Tax Logic: Only tax the gain portion
      const gainRatio = currentRisk > 0 ? Math.max(0, (currentRisk - currentCostBasis) / currentRisk) : 0;
      const maxNetFromRisk = Math.max(0, currentRisk * (1 - (includeTax ? gainRatio * taxRate : 0)));
      const actualNetFromRisk = Math.min(remainingShortfall, maxNetFromRisk);
      const grossFromRisk = actualNetFromRisk / (1 - (includeTax ? gainRatio * taxRate : 0));

      const costBasisWithdrawn = grossFromRisk * (1 - gainRatio);
      currentCostBasis -= costBasisWithdrawn;
      currentRisk -= grossFromRisk;
      currentRisk = Math.max(0, currentRisk);
      currentCostBasis = Math.max(0, currentCostBasis);

      // 3. Ledger balance
      // Any withdrawal exceeding the expense shortfall (due to asset withdrawal rate rule)
      // is added to cash assets (currentCash).
      currentCash += (incomeAvailable + actualNetFromRisk - monthlyExpensesVal);

      monthlyWithdrawal = takenFromCash + grossFromRisk;
    }

    // Apply growth
    investmentGain = currentRisk * returnRate;
    currentRisk += investmentGain;

    if (recordMonthly && m <= maxMonths) {
      const last = monthlyData[monthlyData.length - 1];
      if (last) {
        last.investmentGain = investmentGain;
        last.withdrawal = monthlyWithdrawal;
      }
    }
  }

  const survived = (currentCash + currentRisk) >= 0;
  return { fireReachedMonth, monthlyData, survived, finalAssets: currentCash + currentRisk };
}

/**
 * Find the earliest retirement month that survives until age 100.
 */
/**
 * Find first month where assets reach zero.
 */
function findSurvivalMonth(params, returnsArray = null) {
  const { currentAge, maxMonths } = params;
  const totalMonthsLimit = Math.min(maxMonths, (100 - currentAge) * 12);

  let result = -1;

  // 1. Linear search for the first year that survives until age 100
  for (let m = 0; m <= totalMonthsLimit; m += 12) {
    const res = _runCoreSimulation(params, { fireMonth: m, returnsArray });
    if (res.survived) {
      result = m;
      break;
    }
  }

  // 2. Refine monthly if a successful year was found
  if (result !== -1) {
    let monthlyLow = Math.max(0, result - 11);
    let monthlyHigh = result;
    while (monthlyLow <= monthlyHigh) {
      const mid = Math.floor((monthlyLow + monthlyHigh) / 2);
      const res = _runCoreSimulation(params, { fireMonth: mid, returnsArray });
      if (res.survived) {
        result = mid;
        monthlyHigh = mid - 1;
      } else {
        monthlyLow = mid + 1;
      }
    }
  }

  return result;
}

/**
 * Core simulation engine. Finds survival month if not forced.
 */
/**
 * Execute FIRE simulation and return summary.
 */
export function performFireSimulation(inputParams, options = {}) {
  const params = normalizeFireParams(inputParams);
  const { forceFireMonth = null, returnsArray = null, recordMonthly = false } = options;

  let targetReturns = returnsArray;
  if (!targetReturns) {
    const { currentAge, annualReturnRate } = params;
    const totalMonthsUntil100 = (100 - currentAge) * 12;
    const monthlyReturnMean = Math.pow(1 + annualReturnRate, 1 / 12) - 1;

    targetReturns = [];
    for (let m = 0; m <= totalMonthsUntil100; m++) {
      targetReturns.push(monthlyReturnMean);
    }
  }

  let fireMonth = forceFireMonth;
  if (fireMonth === null) {
    fireMonth = findSurvivalMonth(params, targetReturns);
  }

  return _runCoreSimulation(params, {
    recordMonthly,
    fireMonth,
    returnsArray: targetReturns
  });
}

/**
 * Generate a deterministic growth table for charting.
 */
/**
 * Generate monthly growth table for chart use.
 */
export function generateGrowthTable(params) {
  const { monthlyData, fireReachedMonth } = performFireSimulation(params, { recordMonthly: true });
  return {
    table: monthlyData.map(d => ({
      month: d.month,
      age: d.age,
      assets: d.assets,
      requiredAssets: d.requiredAssets,
      isFire: d.isFire,
    })),
    fireReachedMonth,
  };
}

/**
 * Generate annual simulation data for a representative scenario until age 100.
 */
/**
 * Convert monthly simulation rows to annual rows.
 */
export function generateAnnualSimulation(params) {
  const { monthlyData, fireReachedMonth } = performFireSimulation(params, { recordMonthly: true });
  const yearlySummaries = [];
  for (let y = 0; y < Math.ceil(monthlyData.length / 12); y++) {
    const startIdx = y * 12;
    const endIdx = Math.min(startIdx + 12, monthlyData.length);
    const slice = monthlyData.slice(startIdx, endIdx);
    const income = slice.reduce((sum, m) => sum + m.income, 0);
    const pension = slice.reduce((sum, m) => sum + m.pension, 0);
    const expenses = slice.reduce((sum, m) => sum + m.expenses, 0);
    const withdrawal = slice.reduce((sum, m) => sum + m.withdrawal, 0);
    const gain = slice.reduce((sum, m) => sum + m.investmentGain, 0);
    const firstMonth = monthlyData[startIdx];
    const endMonth = (endIdx < monthlyData.length) ? monthlyData[endIdx] : monthlyData[endIdx - 1];
    const endCash = (endIdx < monthlyData.length) ? monthlyData[endIdx].cashAssets : monthlyData[endIdx - 1].cashAssets;
    const fireMonthInYear = fireReachedMonth >= startIdx && fireReachedMonth < endIdx
      ? fireReachedMonth
      : null;
    yearlySummaries.push({
      age: Math.floor(firstMonth.age),
      income: Math.round(income),
      pension: Math.round(pension),
      expenses: Math.round(expenses),
      withdrawal: Math.round(withdrawal),
      investmentGain: Math.round(gain),
      assets: Math.round(firstMonth.assets),
      assetsYearEnd: Math.round(endMonth.assets),
      riskAssets: Math.round(firstMonth.riskAssets),
      cashAssets: Math.round(firstMonth.cashAssets),
      savings: Math.round(endCash - firstMonth.cashAssets),
      fireMonthInYear,
    });
  }
  return yearlySummaries;
}

/**
 * Seeded random number generator (Mulberry32).
 */
/**
 * Create deterministic pseudo random generator.
 */
function createRandom(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

/**
 * Standard Normal Random Variable using Box-Muller transform.
 */
/**
 * Generate normal random value from uniform random input.
 */
function nextGaussian(rand) {
  let u = 0, v = 0;
  while(u === 0) u = rand();
  while(v === 0) v = rand();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Execute Monte Carlo simulation.
 */
/**
 * Run Monte Carlo trials and return percentiles.
 */
export function runMonteCarloSimulation(inputParams, { trials = 1000, annualVolatility = 0.15, seed = 123 } = {}) {
  const params = normalizeFireParams(inputParams);
  const detResult = performFireSimulation(params);
  const fireMonth = detResult.fireReachedMonth;
  const safeTrials = Math.max(1, Math.floor(Number(trials) || 0));
  const safeAnnualVolatility = Math.max(0, Number.isFinite(annualVolatility) ? annualVolatility : 0);
  const rand = createRandom(seed);

  const { currentAge, annualReturnRate } = params;
  const totalMonths = (100 - currentAge) * 12;

  // Lognormal return parameters
  const mu = annualReturnRate;
  const sigma = safeAnnualVolatility;
  // Log-return mean and variance
  const alpha = Math.log(1 + mu) - 0.5 * Math.log(1 + Math.pow(sigma / (1 + mu), 2));
  const betaSq = Math.log(1 + Math.pow(sigma / (1 + mu), 2));

  const alphaM = alpha / 12;
  const betaM = Math.sqrt(betaSq / 12);

  const finalAssetsList = [];
  const annualHistory = []; // [trialIndex][yearIndex]
  let successCount = 0;

  const totalYears = Math.ceil(totalMonths / 12);

  for (let t = 0; t < safeTrials; t++) {
    const returnsArray = [];
    for (let m = 0; m <= totalMonths; m++) {
      const logReturn = alphaM + betaM * nextGaussian(rand);
      returnsArray.push(Math.exp(logReturn) - 1);
    }

    const res = _runCoreSimulation(params, {
      fireMonth,
      returnsArray,
      recordMonthly: true
    });

    finalAssetsList.push(res.finalAssets);
    if (res.survived) successCount++;

    // Collect annual asset values (start of year)
    const yearAssets = [];
    for (let y = 0; y <= totalYears; y++) {
      const mIdx = y * 12;
      if (mIdx < res.monthlyData.length) {
        yearAssets.push(res.monthlyData[mIdx].assets);
      } else {
        yearAssets.push(res.monthlyData[res.monthlyData.length - 1].assets);
      }
    }
    annualHistory.push(yearAssets);
  }

  finalAssetsList.sort((a, b) => a - b);

  /**
   * Interpolate one percentile from sorted values.
   */
  const interpolatePercentile = (sortedValues, p) => {
    if (sortedValues.length === 1) return sortedValues[0];

    const pos = (p / 100) * (sortedValues.length - 1);
    const lowerIndex = Math.floor(pos);
    const upperIndex = Math.ceil(pos);

    if (lowerIndex === upperIndex) {
      return sortedValues[lowerIndex];
    }

    const weight = pos - lowerIndex;
    return sortedValues[lowerIndex] + (sortedValues[upperIndex] - sortedValues[lowerIndex]) * weight;
  };

  /**
   * Get percentile helper for final asset list.
   */
  const getPercentile = (p) => interpolatePercentile(finalAssetsList, p);

  const p10Path = [];
  const p50Path = [];
  const p90Path = [];

  for (let y = 0; y <= totalYears; y++) {
    const assetsAtY = annualHistory.map(h => h[y]).sort((a, b) => a - b);
    p10Path.push(interpolatePercentile(assetsAtY, 10));
    p50Path.push(interpolatePercentile(assetsAtY, 50));
    p90Path.push(interpolatePercentile(assetsAtY, 90));
  }

  return {
    successRate: successCount / safeTrials,
    p10: getPercentile(10),
    p50: getPercentile(50),
    p90: getPercentile(90),
    p10Path,
    p50Path,
    p90Path,
    trials: safeTrials,
    fireReachedMonth: fireMonth
  };
}
