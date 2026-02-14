import { getUniqueMonths } from "./cashFlow";
import { assetAmountYen, detectAssetOwner } from "./family";

const PENSION_USER_START_AGE = 60;
const PENSION_SPOUSE_USER_AGE_START = 62; // Spouse (1976) age 65 when User (1979) is 62
const PENSION_BASIC_FULL = 780000;
const PENSION_BASIC_REDUCTION = 0.9; // 10% reduction for 4 years gap
const PENSION_EARLY_REDUCTION = 0.76; // 24% reduction for starting at 60
const PENSION_USER_DATA_AGE = 44; // Age at which premium data was provided
const PENSION_USER_KOSEN_ACCRUED_AT_44 = 892252; // Accrued Employees' Pension based on 14.9M premiums
const PENSION_USER_KOSEN_FUTURE_FACTOR = 42000; // Estimated future accrual per year worked

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

function getPastFiveMonths(now) {
  const months = [];
  for (let i = 1; i <= 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

/**
 * Estimate monthly basic expenses from cash flow.
 * Returns a breakdown by category and excludes special expenses.
 * Also excludes "Cash" and "Card" related categories as requested.
 */
export function estimateMonthlyExpenses(cashFlow) {
  const now = new Date();
  const targetMonths = getPastFiveMonths(now);
  const monthSet = new Set(targetMonths);
  const divisor = 5;

  const breakdownMap = {};
  let totalNormalExpense = 0;
  let totalSpecialExpense = 0;

  cashFlow.forEach((item) => {
    if (item.isTransfer || item.amount >= 0) return;

    const month = item.date?.substring(0, 7) || "";
    if (!monthSet.has(month)) {
      return;
    }

    const absAmount = Math.abs(item.amount);
    const category = item.category || "未分類";

    if (category.startsWith("特別な支出")) {
      totalSpecialExpense += absAmount;
      return;
    }

    // Exclude Cash/Card categories as requested
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

  const averageNormal = Math.round(totalNormalExpense / divisor);
  const finalTotal = averageNormal;

  return {
    total: finalTotal,
    breakdown,
    averageSpecial: Math.round(totalSpecialExpense / divisor),
    monthCount: divisor,
  };
}

/**
 * Estimate monthly average income from cash flow (previous 5 months, excluding current month).
 */
export function estimateMonthlyIncome(cashFlow) {
  const now = new Date();
  const targetMonths = getPastFiveMonths(now);
  const monthSet = new Set(targetMonths);
  const divisor = 5;

  let totalIncome = 0;

  cashFlow.forEach((item) => {
    if (item.isTransfer || item.amount <= 0) return;

    const month = item.date?.substring(0, 7) || "";
    if (!monthSet.has(month)) return;

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
  const now = new Date();
  const targetMonths = getPastFiveMonths(now);
  const monthSet = new Set(targetMonths);
  const divisor = 5;

  let totalRegularIncome = 0;
  let totalBonusIncome = 0;
  const regularBreakdownMap = {};
  const bonusBreakdownMap = {};

  cashFlow.forEach((item) => {
    if (item.isTransfer || item.amount <= 0) return;

    const month = item.date?.substring(0, 7) || "";
    if (!monthSet.has(month)) return;

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
 * Estimate mortgage monthly payment from category "住宅/ローン返済".
 */
export function estimateMortgageMonthlyPayment(cashFlow) {
  const now = new Date();
  const targetMonths = getPastFiveMonths(now);
  const monthSet = new Set(targetMonths);
  const divisor = 5;

  let totalMortgage = 0;

  cashFlow.forEach((item) => {
    if (item.isTransfer || item.amount >= 0) return;

    const month = item.date?.substring(0, 7) || "";
    if (!monthSet.has(month)) return;

    if ((item.category || "").startsWith("住宅/ローン返済")) {
      totalMortgage += Math.abs(item.amount);
    }
  });

  return Math.round(totalMortgage / divisor);
}

/**
 * Box-Muller transform for normal distribution random numbers.
 */
function boxMuller() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Calculate required assets to last until age 100.
 * Using PV of a growing annuity formula, considering future pension benefits.
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
}) {
  if (remainingMonths <= 0) return 0;

  const g = monthlyInflation;
  const r = monthlyReturn;
  const n = remainingMonths;

  const pvAnnuity = (P, periods) => {
    if (Math.abs(r - g) < 1e-10) return P * periods;
    const x = (1 + g) / (1 + r);
    return P * (1 - Math.pow(x, periods)) / (r - g);
  };

  // PV of Expenses
  let pv = pvAnnuity(monthlyExpense, n);

  // Subtract PV of Pensions (Deferred Annuities)
  if (!includePension) {
    if (includeTax) {
      pv /= (1 - taxRate);
    }
    return Math.max(0, pv);
  }

  // User pension starts at 60
  const userPensionAmount = calculateMonthlyPension(60, currentAgeInSimulation);
  const monthsToUserPension = Math.max(0, (60 - currentAgeInSimulation) * 12);
  if (monthsToUserPension < n) {
    const periods = n - monthsToUserPension;
    const pvPension = pvAnnuity(userPensionAmount, periods);
    const discount = Math.pow((1 + g) / (1 + r), monthsToUserPension);
    pv -= pvPension * discount;
  }

  // Spouse pension starts when user is 62
  const totalPensionAt62 = calculateMonthlyPension(62, currentAgeInSimulation);
  const spousePensionAmount = totalPensionAt62 - userPensionAmount;
  const monthsToSpousePension = Math.max(0, (62 - currentAgeInSimulation) * 12);
  if (monthsToSpousePension < n) {
    const periods = n - monthsToSpousePension;
    const pvSpouse = pvAnnuity(spousePensionAmount, periods);
    const discount = Math.pow((1 + g) / (1 + r), monthsToSpousePension);
    pv -= pvSpouse * discount;
  }

  if (includeTax) {
    // Roughly estimate tax on withdrawals
    pv /= (1 - taxRate);
  }

  return Math.max(0, pv);
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
  const expenseWithInflation = baseMonthlyExpense * Math.pow(1 + monthlyInflationRate, monthIndex);

  if (!mortgageMonthlyPayment || !mortgagePayoffDate) {
    return expenseWithInflation;
  }

  const currentDate = new Date(simulationStartDate);
  currentDate.setMonth(currentDate.getMonth() + monthIndex);
  const currentMonthKey = toMonthKey(currentDate);

  if (currentMonthKey >= mortgagePayoffDate) {
    return Math.max(0, expenseWithInflation - mortgageMonthlyPayment);
  }

  return expenseWithInflation;
}

/**
 * Simulate one trial of asset growth until FIRE or max time.
 */
function simulateTrial({
  initialAssets,
  riskAssetRatio,
  annualReturnRate,
  annualStandardDeviation,
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
  includePension = false,
}) {
  let assets = initialAssets;
  const monthlyReturnMean = Math.pow(1 + annualReturnRate, 1 / 12) - 1;
  const monthlySD = annualStandardDeviation / Math.sqrt(12);
  const monthlyInflationRate = Math.pow(1 + (includeInflation ? inflationRate : 0), 1 / 12) - 1;

  const totalMonthsUntil100 = (100 - currentAge) * 12;

  const simulationStartDate = new Date();

  for (let m = 0; m <= maxMonths; m++) {
    const ageAtMonthM = currentAge + m / 12;
    const remainingMonths = totalMonthsUntil100 - m;
    const currentMonthlyExpense = calculateCurrentMonthlyExpense({
      baseMonthlyExpense: monthlyExpense,
      monthlyInflationRate,
      monthIndex: m,
      simulationStartDate,
      mortgageMonthlyPayment,
      mortgagePayoffDate,
    });

    const extraWithInflation = postFireExtraExpense * Math.pow(1 + monthlyInflationRate, m);

    // Check if FIRE is reached at the beginning of this month
    const requiredAssets = calculateRequiredAssets({
      monthlyExpense: currentMonthlyExpense + extraWithInflation,
      monthlyReturn: monthlyReturnMean,
      monthlyInflation: monthlyInflationRate,
      remainingMonths,
      taxRate,
      includeTax,
      currentAgeInSimulation: ageAtMonthM,
      includePension,
    });

    if (assets >= requiredAssets) {
      return m;
    }

    const riskAssets = assets * riskAssetRatio;
    const safeAssets = assets - riskAssets;

    const returnRate = monthlyReturnMean + monthlySD * boxMuller();
    const grownRiskAssets = riskAssets * (1 + returnRate);
    const grownSafeAssets = safeAssets; // Assume safe assets (cash) have 0% return for simplicity

    const currentMonthlyPension = includePension ? calculateMonthlyPension(ageAtMonthM, ageAtMonthM) : 0;
    // monthlyIncome already includes all regular/bonus cashflow assumptions,
    // and expense is deducted below. Do not add monthlyInvestment separately,
    // otherwise investment capital is double-counted.
    const netCashflow = monthlyIncome - currentMonthlyExpense + currentMonthlyPension;
    if (netCashflow >= 0) {
      assets = grownRiskAssets + grownSafeAssets + netCashflow;
    } else {
      let shortfall = -netCashflow;
      if (includeTax) {
        shortfall /= 1 - taxRate;
      }
      assets = grownRiskAssets + grownSafeAssets - shortfall;
    }

    if (assets < 0) return maxMonths;
  }
  return maxMonths;
}

/**
 * Monte Carlo simulation for FIRE achievement.
 */
export function simulateFire(params) {
  const {
    initialAssets,
    riskAssets,
    annualReturnRate,
    annualStandardDeviation,
    monthlyExpense,
    monthlyIncome = 0,
    currentAge = 40,
    iterations = 1000,
    maxMonths = 1200,
    includeInflation = false,
    inflationRate = 0.02,
    includeTax = false,
    taxRate = 0.20315,
    withdrawalRate = 0.04,
    mortgageMonthlyPayment = 0,
    mortgagePayoffDate = null,
    postFireExtraExpense = 0,
    includePension = false,
  } = params;

  const riskAssetRatio = initialAssets > 0 ? riskAssets / initialAssets : 0;
  const trials = [];

  for (let i = 0; i < iterations; i++) {
    trials.push(
      simulateTrial({
        initialAssets,
        riskAssetRatio,
        annualReturnRate,
        annualStandardDeviation,
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
      }),
    );
  }

  trials.sort((a, b) => a - b);
  const median = trials[Math.floor(trials.length / 2)];
  const p5 = trials[Math.floor(trials.length * 0.05)];
  const p95 = trials[Math.floor(trials.length * 0.95)];
  const mean = trials.reduce((a, b) => a + b, 0) / trials.length;

  return {
    trials,
    stats: {
      mean,
      median,
      p5,
      p95,
    },
  };
}

/**
 * Generate a deterministic growth table for charting.
 */
export function generateGrowthTable(params) {
  const {
    initialAssets,
    riskAssets,
    annualReturnRate,
    monthlyExpense,
    monthlyIncome = 0,
    currentAge = 40,
    maxMonths = 1200, // Extend to 100 years potentially
    includeInflation = false,
    inflationRate = 0.02,
    includeTax = false,
    taxRate = 0.20315,
    withdrawalRate = 0.04,
    mortgageMonthlyPayment = 0,
    mortgagePayoffDate = null,
    postFireExtraExpense = 0,
    includePension = false,
    monthlyInvestment = 0,
  } = params;

  const monthlyReturnMean = Math.pow(1 + annualReturnRate, 1 / 12) - 1;
  const monthlyInflationRate = Math.pow(1 + (includeInflation ? inflationRate : 0), 1 / 12) - 1;

  const totalMonthsUntil100 = (100 - currentAge) * 12;
  const actualMaxMonths = Math.min(maxMonths, totalMonthsUntil100);

  const table = [];
  let currentRisk = riskAssets;
  let currentCash = initialAssets - riskAssets;
  let fireReachedMonth = -1;
  const simulationStartDate = new Date();

  for (let m = 0; m <= actualMaxMonths; m++) {
    const ageAtMonthM = currentAge + m / 12;
    const remainingMonths = totalMonthsUntil100 - m;
    const currentMonthlyExpense = calculateCurrentMonthlyExpense({
      baseMonthlyExpense: monthlyExpense,
      monthlyInflationRate,
      monthIndex: m,
      simulationStartDate,
      mortgageMonthlyPayment,
      mortgagePayoffDate,
    });

    const extraWithInflation = postFireExtraExpense * Math.pow(1 + monthlyInflationRate, m);

    const assets = currentCash + currentRisk;
    const requiredAssets = calculateRequiredAssets({
      monthlyExpense: currentMonthlyExpense + extraWithInflation,
      monthlyReturn: monthlyReturnMean,
      monthlyInflation: monthlyInflationRate,
      remainingMonths,
      taxRate,
      includeTax,
      currentAgeInSimulation: ageAtMonthM,
      includePension,
    });

    if (fireReachedMonth === -1 && assets >= requiredAssets) {
      fireReachedMonth = m;
    }

    const isFire = fireReachedMonth !== -1 && m >= fireReachedMonth;

    table.push({
      month: m,
      assets,
      requiredAssets,
      isFire,
    });

    if (m === actualMaxMonths) break;

    const fireReachedAge = fireReachedMonth === -1 ? ageAtMonthM : currentAge + fireReachedMonth / 12;
    const currentMonthlyPension = includePension ? calculateMonthlyPension(ageAtMonthM, fireReachedAge) : 0;

    // Growth
    currentRisk *= (1 + monthlyReturnMean);

    if (isFire) {
      let grossExpense = currentMonthlyExpense + extraWithInflation;
      if (includeTax) {
        grossExpense /= 1 - taxRate;
      }
      const amountFromWithdrawalRate = (assets * withdrawalRate) / 12;
      const totalNeeded = Math.max(grossExpense, amountFromWithdrawalRate);

      const toWithdraw = Math.max(0, totalNeeded - currentMonthlyPension);
      currentRisk -= toWithdraw;
      const netFromWithdrawal = includeTax ? toWithdraw * (1 - taxRate) : toWithdraw;
      currentCash += currentMonthlyPension + netFromWithdrawal - (currentMonthlyExpense + extraWithInflation);
    } else {
      currentCash += monthlyIncome + currentMonthlyPension - currentMonthlyExpense;
      currentCash -= monthlyInvestment;
      currentRisk += monthlyInvestment;

      if (currentCash < 0 && includeTax) {
        const shortfall = Math.abs(currentCash);
        const taxImpact = (shortfall / (1 - taxRate)) - shortfall;
        currentRisk -= taxImpact;
      }
    }

    if (currentCash + currentRisk < 0) {
      currentCash = 0;
      currentRisk = 0;
    }
  }

  return {
    table,
    fireReachedMonth,
  };
}

/**
 * Generate annual simulation data for a representative scenario until age 100.
 */
export function generateAnnualSimulation(params) {
  const {
    initialAssets,
    riskAssets,
    annualReturnRate,
    monthlyExpense,
    monthlyIncome = 0,
    currentAge = 40,
    includeInflation = false,
    inflationRate = 0.02,
    includeTax = false,
    taxRate = 0.20315,
    withdrawalRate = 0.04,
    mortgageMonthlyPayment = 0,
    mortgagePayoffDate = null,
    postFireExtraExpense = 0,
    includePension = false,
    monthlyInvestment = 0,
  } = params;

  const monthlyReturnMean = Math.pow(1 + annualReturnRate, 1 / 12) - 1;
  const monthlyInflationRate = Math.pow(1 + (includeInflation ? inflationRate : 0), 1 / 12) - 1;

  const totalMonthsUntil100 = (100 - currentAge) * 12;
  const simulationStartDate = new Date();

  const annualData = [];
  let currentRisk = riskAssets;
  let currentCash = initialAssets - riskAssets; // Net cash (Cash - Debt)
  let fireReachedMonth = -1;

  let currentYearData = {
    age: Math.floor(currentAge),
    income: 0,
    pension: 0,
    expenses: 0,
    withdrawal: 0,
    assets: 0,
    investmentGain: 0,
  };

  for (let m = 0; m <= totalMonthsUntil100; m++) {
    const ageAtMonthM = currentAge + m / 12;
    const currentAgeInt = Math.floor(ageAtMonthM);

    // If we transition to a new year, save the previous year's data
    if (currentAgeInt > currentYearData.age) {
      currentYearData.assets = Math.round(currentCash + currentRisk);
      currentYearData.riskAssets = Math.round(currentRisk);
      currentYearData.cashAssets = Math.round(currentCash);
      annualData.push(currentYearData);

      currentYearData = {
        age: currentAgeInt,
        income: 0,
        pension: 0,
        expenses: 0,
        withdrawal: 0,
        assets: 0,
        investmentGain: 0,
      };
    }

    if (m === totalMonthsUntil100) break;

    const remainingMonths = totalMonthsUntil100 - m;
    const currentMonthlyExpense = calculateCurrentMonthlyExpense({
      baseMonthlyExpense: monthlyExpense,
      monthlyInflationRate,
      monthIndex: m,
      simulationStartDate,
      mortgageMonthlyPayment,
      mortgagePayoffDate,
    });

    const extraWithInflation = postFireExtraExpense * Math.pow(1 + monthlyInflationRate, m);

    const assets = currentCash + currentRisk;
    const requiredAssets = calculateRequiredAssets({
      monthlyExpense: currentMonthlyExpense + extraWithInflation,
      monthlyReturn: monthlyReturnMean,
      monthlyInflation: monthlyInflationRate,
      remainingMonths,
      taxRate,
      includeTax,
      currentAgeInSimulation: ageAtMonthM,
      includePension,
    });

    if (fireReachedMonth === -1 && assets >= requiredAssets) {
      fireReachedMonth = m;
    }

    const isFire = fireReachedMonth !== -1 && m >= fireReachedMonth;
    const fireReachedAge = fireReachedMonth === -1 ? ageAtMonthM : currentAge + fireReachedMonth / 12;
    const currentMonthlyPension = includePension ? calculateMonthlyPension(ageAtMonthM, fireReachedAge) : 0;

    let currentIncome = isFire ? 0 : monthlyIncome;
    let monthlyExpenses = currentMonthlyExpense + (isFire ? extraWithInflation : 0);
    let monthlyWithdrawal = 0;

    // Accumulate annual values
    currentYearData.income += currentIncome;
    currentYearData.pension += currentMonthlyPension;
    currentYearData.expenses += monthlyExpenses;

    // Asset growth and Cash flow logic
    const gain = currentRisk * monthlyReturnMean;
    currentRisk += gain;
    currentYearData.investmentGain += gain;

    if (isFire) {
      const totalAssets = currentCash + currentRisk;
      let grossExpense = monthlyExpenses;
      if (includeTax) {
        grossExpense /= 1 - taxRate;
      }
      const withdrawalFromRate = (totalAssets * withdrawalRate) / 12;
      const totalNeeded = Math.max(grossExpense, withdrawalFromRate);

      // Withdraw from risk assets to cover gap between totalNeeded and pension
      const toWithdraw = Math.max(0, totalNeeded - currentMonthlyPension);
      currentRisk -= toWithdraw;

      // Cash flow: pension in, expenses out, plus net from withdrawal
      const netFromWithdrawal = includeTax ? toWithdraw * (1 - taxRate) : toWithdraw;
      currentCash += currentMonthlyPension + netFromWithdrawal - monthlyExpenses;
      monthlyWithdrawal = toWithdraw;
    } else {
      // Accumulation phase
      const netCashflow = currentIncome + currentMonthlyPension - monthlyExpenses;
      currentCash += netCashflow;
      if (netCashflow < 0) {
        monthlyWithdrawal = Math.abs(netCashflow);
        if (includeTax) {
          monthlyWithdrawal /= 1 - taxRate;
        }
      }

      // Investment
      currentCash -= monthlyInvestment;
      currentRisk += monthlyInvestment;

      // Tax impact if cash is negative (shortfall covered by selling risk assets)
      if (currentCash < 0 && includeTax) {
        const shortfall = Math.abs(currentCash);
        const taxImpact = (shortfall / (1 - taxRate)) - shortfall;
        currentRisk -= taxImpact;
      }
    }

    currentYearData.withdrawal += monthlyWithdrawal;

    if (currentCash + currentRisk < 0) {
      currentCash = 0;
      currentRisk = 0;
    }
  }

  // Final push for the last year (usually age 100)
  currentYearData.assets = Math.round(currentCash + currentRisk);
  currentYearData.riskAssets = Math.round(currentRisk);
  currentYearData.cashAssets = Math.round(currentCash);
  annualData.push(currentYearData);

  // Round values
  annualData.forEach(d => {
    d.income = Math.round(d.income);
    d.pension = Math.round(d.pension);
    d.expenses = Math.round(d.expenses);
    d.withdrawal = Math.round(d.withdrawal);
    d.investmentGain = Math.round(d.investmentGain);
  });

  return annualData;
}
