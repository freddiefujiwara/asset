import { getUniqueMonths } from "./cashFlow";
import { assetAmountYen, detectAssetOwner } from "./family";
import { formatYen } from "./format";

const PENSION_USER_START_AGE = 60;
const PENSION_SPOUSE_USER_AGE_START = 62; // Spouse (1976) age 65 when User (1979) is 62
const PENSION_BASIC_FULL = 780000;
const PENSION_BASIC_REDUCTION = 0.9; // 10% reduction for 4 years gap
const PENSION_EARLY_REDUCTION = 0.76; // 24% reduction for starting at 60
const PENSION_USER_DATA_AGE = 44; // Age at which premium data was provided
const PENSION_USER_KOSEN_ACCRUED_AT_44 = 892252; // Accrued Employees' Pension based on 14.9M premiums
const PENSION_USER_KOSEN_FUTURE_FACTOR = 42000; // Estimated future accrual per year worked

export const FIRE_ALGORITHM_CONSTANTS = {
  pension: {
    userStartAge: PENSION_USER_START_AGE,
    spouseUserAgeStart: PENSION_SPOUSE_USER_AGE_START,
    basicFullAnnualYen: PENSION_BASIC_FULL,
    basicReduction: PENSION_BASIC_REDUCTION,
    earlyReduction: PENSION_EARLY_REDUCTION,
    userDataAge: PENSION_USER_DATA_AGE,
    userKoseiAccruedAt44AnnualYen: PENSION_USER_KOSEN_ACCRUED_AT_44,
    userKoseiFutureFactorAnnualYenPerYear: PENSION_USER_KOSEN_FUTURE_FACTOR,
  },
};

/**
 * Calculate pension monthly amount for the given age and FIRE age.
 * @param {number} age - Current age in simulation
 * @param {number} fireAge - Age at which user reaches FIRE
 */
export function calculateMonthlyPension(age, fireAge) {
  let totalAnnual = 0;

  // User pension (starts at 60)
  if (age >= PENSION_USER_START_AGE) {
    const basicPart = PENSION_BASIC_FULL * PENSION_BASIC_REDUCTION * PENSION_EARLY_REDUCTION;
    // Participation stops at FIRE or age 60 (whichever comes first, as pension starts at 60)
    const participationEndAge = Math.min(60, fireAge);
    const futureYears = Math.max(0, participationEndAge - PENSION_USER_DATA_AGE);
    const employeesPartAt65 = PENSION_USER_KOSEN_ACCRUED_AT_44 + futureYears * PENSION_USER_KOSEN_FUTURE_FACTOR;

    totalAnnual += (basicPart + employeesPartAt65 * PENSION_EARLY_REDUCTION);
  }

  // Spouse pension (starts when User is 62, i.e., Spouse is 65)
  if (age >= PENSION_SPOUSE_USER_AGE_START) {
    totalAnnual += PENSION_BASIC_FULL;
  }

  return Math.round(totalAnnual / 12);
}

/**
 * Identify risk assets and sum their values.
 */
export function calculateRiskAssets(portfolio) {
  const riskCategories = [
    "株式（現物）",
    "株式（信用）",
    "投資信託",
    "年金",
    "先物・オプション",
    "外貨預金",
    "債券",
  ];
  if (!portfolio?.summary?.assetsByClass) return 0;
  return portfolio.summary.assetsByClass
    .filter((item) => riskCategories.includes(item.name))
    .reduce((sum, item) => sum + item.amountYen, 0);
}

/**
 * Sum excluded owner's assets from detailed holdings.
 * Used for FIRE simulation where specific family member assets should be omitted.
 */
export function calculateExcludedOwnerAssets(portfolio, excludedOwnerId = "daughter") {
  if (!portfolio?.holdings) {
    return { totalAssetsYen: 0, riskAssetsYen: 0 };
  }

  const allAssetKeys = ["cashLike", "stocks", "funds", "pensions", "points"];
  const riskAssetKeys = ["stocks", "funds", "pensions"];

  const sumByKeys = (keys) => keys.reduce((sum, key) => {
    const rows = Array.isArray(portfolio.holdings?.[key]) ? portfolio.holdings[key] : [];
    const sectionTotal = rows.reduce((sectionSum, row) => {
      const owner = detectAssetOwner(row);
      if (owner.id !== excludedOwnerId) {
        return sectionSum;
      }
      return sectionSum + assetAmountYen(row);
    }, 0);

    return sum + sectionTotal;
  }, 0);

  return {
    totalAssetsYen: sumByKeys(allAssetKeys),
    riskAssetsYen: sumByKeys(riskAssetKeys),
  };
}

/**
 * Calculate detailed asset breakdown for the daughter.
 */
export function calculateDaughterAssetsBreakdown(portfolio) {
  const breakdown = {
    cash: 0,
    stocks: 0,
    funds: 0,
    pensions: 0,
    points: 0,
    liabilities: 0,
  };

  if (!portfolio?.holdings) return breakdown;

  const map = {
    cashLike: "cash",
    stocks: "stocks",
    funds: "funds",
    pensions: "pensions",
    points: "points",
  };

  Object.entries(map).forEach(([key, bKey]) => {
    const rows = portfolio.holdings[key] || [];
    rows.forEach((row) => {
      if (detectAssetOwner(row).id === "daughter") {
        breakdown[bKey] += assetAmountYen(row);
      }
    });
  });

  const liabRows = portfolio.holdings.liabilitiesDetail || [];
  liabRows.forEach((row) => {
    if (detectAssetOwner(row).id === "daughter") {
      breakdown.liabilities += assetAmountYen(row);
    }
  });

  return breakdown;
}

/**
 * Generate algorithm explanation segments for UI and export.
 */
export function generateAlgorithmExplanationSegments(params) {
  const {
    daughterBreakdown,
    fireAchievementAge,
    pensionAnnualAtFire,
    withdrawalRatePct,
    postFireExtraExpenseMonthly,
  } = params;

  const daughterDetailStr = `現金:${formatYen(daughterBreakdown.cash)}, 株式:${formatYen(daughterBreakdown.stocks)}, 投資信託:${formatYen(daughterBreakdown.funds)}, 年金:${formatYen(daughterBreakdown.pensions)}, ポイント:${formatYen(daughterBreakdown.points)}, 負債:${formatYen(daughterBreakdown.liabilities)}`;

  return [
    { type: "text", value: "本シミュレーションは、設定された期待リターン・インフレ率・年金・ローン等のキャッシュフローに基づき、100歳時点で資産が残る最短リタイア年齢を算出しています。\n・必要資産目安は「FIRE達成年齢で退職して100歳まで資産が尽きない最小条件」を満たす達成時点の金融資産額と同じ定義です。\n・娘名義の資産（" },
    { type: "amount", value: daughterDetailStr },
    { type: "text", value: "）は初期資産から除外してシミュレーションしています。\n・投資優先順位ルール: 生活防衛資金として現金を維持するため、毎月の投資額は「前月までの貯金残高 + 当月の収支剰余金」を上限として自動調整されます（貯金がマイナスにならないよう制限されます）。\n・FIRE達成後は追加投資を停止し、定期収入（給与・ボーナス等）もゼロになると仮定しています。\n・FIRE達成後は、年間支出または資産の" },
    { type: "text", value: String(withdrawalRatePct) },
    { type: "text", value: "%（設定値）のいずれか大きい額を引き出すと仮定しています。\n\n■ 年金受給の見込みについて\n本シミュレーションでは、ご本人が" },
    { type: "text", value: String(fireAchievementAge) },
    { type: "text", value: "歳でFIREし、60歳から年金を繰上げ受給する以下のシナリオを想定しています。\n・受給開始: 60歳（2039年〜）\n・世帯受給額（概算）: 年額 " },
    { type: "amount", value: formatYen(pensionAnnualAtFire) },
    { type: "text", value: "（月額 " },
    { type: "amount", value: formatYen(Math.round(pensionAnnualAtFire / 12)) },
    { type: "text", value: "）\n・算定根拠:\n  - ねんきん特別便のデータ（累計納付額 " },
    { type: "amount", value: "約1,496万円" },
    { type: "text", value: "）に基づき、現在までの加入実績を反映。\n  - 20代前半の未納期間（4年間）による基礎年金の減額を反映。\n  - " },
    { type: "text", value: String(fireAchievementAge) },
    { type: "text", value: "歳リタイア(シミュレーション結果による)に伴う厚生年金加入期間の停止を考慮。\n  - 60歳繰上げ受給による受給額24%減額を適用。\n・配偶者加算: 奥様（1976年生）が65歳に達した時点から、奥様自身の基礎年金が世帯収入に加算されるものとして計算。\n\n住宅ローンの完済月以降は、月間支出からローン返済額を自動的に差し引いてシミュレーションを継続します。\n\n■ 各項目の算出定義\n・収入 (年金込): 定期収入（給与等） + 年金受給額の合算です。\n・支出: (基本生活費 - 住宅ローン) × インフレ調整 + 住宅ローン(固定) + FIRE後追加支出（FIRE達成月より加算）\n・運用益: 当年中の運用リターン合計。月次複利で計算されます。\n・取り崩し額: 生活費の不足分、または「資産 × 取崩率」のいずれか大きい額を引き出します（税金考慮時はグロスアップ）。\n・貯金額 (現金): 前年末残高 + 当年収支(収入 - 支出) - 当年投資額 + リスク資産からの補填（純額）\n・リスク資産額: 前年末残高 + 投資額 + 運用益 - 取崩額(グロス)\n\nFIRE後の追加支出（デフォルト" },
    { type: "amount", value: formatYen(postFireExtraExpenseMonthly) },
    { type: "text", value: "）は、国民年金（夫婦2名分: " },
    { type: "amount", value: "約3.5万円" },
    { type: "text", value: "）、国民健康保険（均等割7割軽減想定: " },
    { type: "amount", value: "約1.5万円" },
    { type: "text", value: "）、固定資産税（" },
    { type: "amount", value: "月1万円" },
    { type: "text", value: "）を合算した目安値です。\n※ 注意：リタイア1年目は前年の所得に基づき社会保険料・住民税が高額になる「1年目の罠」があるため、別途数十万円単位の予備費確保を推奨します。" },
  ];
}

/**
 * Sum assets and liabilities for specific owners (Self and Spouse).
 * This ensures strict isolation for FIRE simulation.
 */
export function calculateFirePortfolio(portfolio, includedOwnerIds = ["me", "wife"]) {
  if (!portfolio?.holdings) {
    return { totalAssetsYen: 0, riskAssetsYen: 0, cashAssetsYen: 0, liabilitiesYen: 0, netWorthYen: 0 };
  }

  const riskCategories = [
    "株式（現物）",
    "株式（信用）",
    "投資信託",
    "年金",
    "先物・オプション",
    "外貨預金",
    "債券",
  ];

  const allAssetKeys = ["cashLike", "stocks", "funds", "pensions", "points"];

  let totalAssetsYen = 0;
  let riskAssetsYen = 0;

  allAssetKeys.forEach((key) => {
    const rows = Array.isArray(portfolio.holdings?.[key]) ? portfolio.holdings[key] : [];
    rows.forEach((row) => {
      const owner = detectAssetOwner(row);
      if (!includedOwnerIds.includes(owner.id)) return;

      const amount = assetAmountYen(row);
      totalAssetsYen += amount;

      const category = row.category || "";
      if (riskCategories.includes(category)) {
        riskAssetsYen += amount;
      }
    });
  });

  const liabRows = Array.isArray(portfolio.holdings?.liabilitiesDetail)
    ? portfolio.holdings.liabilitiesDetail
    : [];
  const liabilitiesYen = liabRows.reduce((sum, row) => {
    const owner = detectAssetOwner(row);
    if (!includedOwnerIds.includes(owner.id)) return sum;
    return sum + assetAmountYen(row);
  }, 0);

  return {
    totalAssetsYen,
    riskAssetsYen,
    cashAssetsYen: totalAssetsYen - riskAssetsYen,
    liabilitiesYen,
    netWorthYen: totalAssetsYen - liabilitiesYen,
  };
}

/**
 * Calculate cash assets (Total Assets - Risk Assets).
 */
export function calculateCashAssets(portfolio) {
  const riskAssets = calculateRiskAssets(portfolio);
  const totalAssets = portfolio?.totals?.assetsYen || 0;
  return totalAssets - riskAssets;
}

const FIVE_MONTH_LOOKBACK_COUNT = 5;

function getPastMonths(now, count) {
  const months = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

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
export function estimateMonthlyExpenses(cashFlow) {
  const divisor = FIVE_MONTH_LOOKBACK_COUNT;
  const breakdownMap = {};
  let totalNormalExpense = 0;
  let totalSpecialExpense = 0;

  processLookbackCashFlow(cashFlow, (item) => {
    if (item.amount >= 0) return;

    const absAmount = Math.abs(item.amount);
    const category = item.category || "未分類";

    if (category.startsWith("特別な支出")) {
      totalSpecialExpense += absAmount;
      return;
    }

    if (category.startsWith("現金") || category.startsWith("カード")) {
      return;
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
    monthCount: divisor,
  };
}

/**
 * Estimate monthly average income from cash flow (previous 5 months, excluding current month).
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
    monthCount: expenses.monthCount,
  };
}

/**
 * Estimate mortgage monthly payment from category "住宅/ローン返済".
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

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function calculateCurrentMonthlyExpense({
  baseMonthlyExpense,
  monthlyInflationRate,
  monthIndex,
  simulationStartDate,
  mortgageMonthlyPayment,
  mortgagePayoffDate,
}) {
  const mortgage = mortgageMonthlyPayment || 0;
  const nonMortgageExpense = Math.max(0, baseMonthlyExpense - mortgage);
  const inflatedNonMortgage = nonMortgageExpense * Math.pow(1 + monthlyInflationRate, monthIndex);

  if (!mortgage || !mortgagePayoffDate) {
    return inflatedNonMortgage + mortgage;
  }

  const currentDate = new Date(simulationStartDate);
  currentDate.setMonth(currentDate.getMonth() + monthIndex);
  const currentMonthKey = toMonthKey(currentDate);

  // Use strictly greater than to ensure the payoff month itself is still paid
  if (currentMonthKey > mortgagePayoffDate) {
    return inflatedNonMortgage;
  }

  return inflatedNonMortgage + mortgage;
}

/**
 * Normalizes and validates simulation parameters.
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
    includePension: Boolean(params.includePension),
    monthlyInvestment: Number(params.monthlyInvestment ?? 0),
    maxMonths: Number(params.maxMonths ?? 1200),
  };
}

/**
 * Internal simulation engine.
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
    includePension,
    monthlyInvestment,
  } = params;

  const monthlyExp = monthlyExpense;
  const monthlyReturnMean = Math.pow(1 + annualReturnRate, 1 / 12) - 1;
  const monthlyInflationRate = Math.pow(1 + (includeInflation ? inflationRate : 0), 1 / 12) - 1;
  const totalMonthsUntil100 = (100 - currentAge) * 12;
  const simulationStartDate = new Date();

  let currentRisk = riskAssets;
  let currentCash = initialAssets - riskAssets;
  let fireReachedMonth = fireMonth;
  const monthlyData = recordMonthly ? [] : null;

  const simulationLimit = totalMonthsUntil100;

  for (let m = 0; m <= simulationLimit; m++) {
    const ageAtMonthM = currentAge + m / 12;
    const remainingMonths = Math.max(0, totalMonthsUntil100 - m);

    const curMonthlyExp = calculateCurrentMonthlyExpense({
      baseMonthlyExpense: monthlyExp,
      monthlyInflationRate,
      monthIndex: m,
      simulationStartDate,
      mortgageMonthlyPayment,
      mortgagePayoffDate,
    });
    const extraWithInf = postFireExtraExpense * Math.pow(1 + monthlyInflationRate, m);
    const assets = Math.max(0, currentCash + currentRisk);

    const isFire = fireReachedMonth !== -1 && m >= fireReachedMonth;
    const fireAgeAtMonthM = fireReachedMonth === -1 ? (currentAge + 100) : currentAge + fireReachedMonth / 12;
    const curPension = includePension ? calculateMonthlyPension(ageAtMonthM, fireAgeAtMonthM) : 0;

    const monthlyIncomeVal = isFire ? 0 : monthlyIncome;
    const monthlyExpensesVal = curMonthlyExp + (isFire ? extraWithInf : 0);
    const incomeAvailable = monthlyIncomeVal + curPension;

    if (recordMonthly && m <= maxMonths) {
      const reqAssets = calculateRequiredAssets({
        monthlyExpense: curMonthlyExp + extraWithInf,
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
        const maxNetFromRisk = Math.max(0, currentRisk * (includeTax ? (1 - taxRate) : 1));
        const actualNetFromRisk = Math.min(needed, maxNetFromRisk);
        const grossFromRisk = actualNetFromRisk / (includeTax ? (1 - taxRate) : 1);
        currentRisk -= grossFromRisk;
        currentRisk = Math.max(0, currentRisk);

        currentCash = cashAfterFlow + actualNetFromRisk;
        monthlyWithdrawal = actualNetFromRisk > 0 ? grossFromRisk : 0;
      } else {
        // Surplus: invest
        monthlyInvest = Math.min(monthlyInvestment, cashAfterFlow);
        currentCash = cashAfterFlow - monthlyInvest;
        currentRisk += monthlyInvest;
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
      const maxNetFromRisk = Math.max(0, currentRisk * (includeTax ? (1 - taxRate) : 1));
      const actualNetFromRisk = Math.min(remainingShortfall, maxNetFromRisk);
      const grossFromRisk = actualNetFromRisk / (includeTax ? (1 - taxRate) : 1);
      currentRisk -= grossFromRisk;
      currentRisk = Math.max(0, currentRisk);

      // 3. Ledger balance
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
  return { fireReachedMonth, monthlyData, survived };
}

/**
 * Find the earliest retirement month that survives until age 100.
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
export function generateAnnualSimulation(params) {
  const { monthlyData } = performFireSimulation(params, { recordMonthly: true });
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
    const endCash = (endIdx < monthlyData.length) ? monthlyData[endIdx].cashAssets : monthlyData[endIdx - 1].cashAssets;
    yearlySummaries.push({
      age: Math.floor(firstMonth.age),
      income: Math.round(income),
      pension: Math.round(pension),
      expenses: Math.round(expenses),
      withdrawal: Math.round(withdrawal),
      investmentGain: Math.round(gain),
      assets: Math.round(firstMonth.assets),
      riskAssets: Math.round(firstMonth.riskAssets),
      cashAssets: Math.round(firstMonth.cashAssets),
      savings: Math.round(endCash - firstMonth.cashAssets),
    });
  }
  return yearlySummaries;
}
