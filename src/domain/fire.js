import { getUniqueMonths } from "./cashFlow";

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
 * Using PV of a growing annuity formula.
 */
function calculateRequiredAssets({
  monthlyExpense,
  monthlyReturn,
  monthlyInflation,
  remainingMonths,
  taxRate,
  includeTax,
}) {
  if (remainingMonths <= 0) return 0;

  let pv;
  const g = monthlyInflation;
  const r = monthlyReturn;
  const n = remainingMonths;

  if (Math.abs(r - g) < 1e-10) {
    pv = monthlyExpense * n;
  } else {
    const x = (1 + g) / (1 + r);
    pv = monthlyExpense * (1 - Math.pow(x, n)) / (r - g);
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
}) {
  let assets = initialAssets;
  const monthlyReturnMean = Math.pow(1 + annualReturnRate, 1 / 12) - 1;
  const monthlySD = annualStandardDeviation / Math.sqrt(12);
  const monthlyInflationRate = Math.pow(1 + (includeInflation ? inflationRate : 0), 1 / 12) - 1;

  const totalMonthsUntil100 = (100 - currentAge) * 12;

  const simulationStartDate = new Date();

  for (let m = 0; m <= maxMonths; m++) {
    const remainingMonths = totalMonthsUntil100 - m;
    const currentMonthlyExpense = calculateCurrentMonthlyExpense({
      baseMonthlyExpense: monthlyExpense,
      monthlyInflationRate,
      monthIndex: m,
      simulationStartDate,
      mortgageMonthlyPayment,
      mortgagePayoffDate,
    });

    const requiredAssets = calculateRequiredAssets({
      monthlyExpense: currentMonthlyExpense,
      monthlyReturn: monthlyReturnMean,
      monthlyInflation: monthlyInflationRate,
      remainingMonths,
      taxRate,
      includeTax,
    });

    if (assets >= requiredAssets) {
      return m;
    }

    const riskAssets = assets * riskAssetRatio;
    const safeAssets = assets - riskAssets;

    const returnRate = monthlyReturnMean + monthlySD * boxMuller();
    const grownRiskAssets = riskAssets * (1 + returnRate);
    const grownSafeAssets = safeAssets; // Assume safe assets (cash) have 0% return for simplicity

    // monthlyIncome already includes all regular/bonus cashflow assumptions,
    // and expense is deducted below. Do not add monthlyInvestment separately,
    // otherwise investment capital is double-counted.
    const netCashflow = monthlyIncome - currentMonthlyExpense;
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
  } = params;

  const riskAssetRatio = initialAssets > 0 ? riskAssets / initialAssets : 0;
  const monthlyReturnMean = Math.pow(1 + annualReturnRate, 1 / 12) - 1;
  const monthlyInflationRate = Math.pow(1 + (includeInflation ? inflationRate : 0), 1 / 12) - 1;

  const totalMonthsUntil100 = (100 - currentAge) * 12;
  const actualMaxMonths = Math.min(maxMonths, totalMonthsUntil100);

  const table = [];
  let assets = initialAssets;
  let fireReachedMonth = -1;
  const simulationStartDate = new Date();

  for (let m = 0; m <= actualMaxMonths; m++) {
    const remainingMonths = totalMonthsUntil100 - m;
    const currentMonthlyExpense = calculateCurrentMonthlyExpense({
      baseMonthlyExpense: monthlyExpense,
      monthlyInflationRate,
      monthIndex: m,
      simulationStartDate,
      mortgageMonthlyPayment,
      mortgagePayoffDate,
    });

    const requiredAssets = calculateRequiredAssets({
      monthlyExpense: currentMonthlyExpense,
      monthlyReturn: monthlyReturnMean,
      monthlyInflation: monthlyInflationRate,
      remainingMonths,
      taxRate,
      includeTax,
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

    const riskPart = assets * riskAssetRatio;
    const safePart = assets - riskPart;

    let currentIncome = monthlyIncome;
    let currentWithdrawal;

    if (isFire) {
      // Once FIRE is reached, stop investment and perform withdrawal (annually / 12)
      // or withdraw monthly expense, whichever is higher to ensure living.
      currentIncome = 0;
      let grossExpense = currentMonthlyExpense;
      if (includeTax) {
        grossExpense /= 1 - taxRate;
      }
      const amountFromWithdrawalRate = (assets * withdrawalRate) / 12;
      currentWithdrawal = Math.max(grossExpense, amountFromWithdrawalRate);
    } else {
      currentWithdrawal = currentMonthlyExpense;
    }

    // monthlyIncome already contains ongoing cashflow assumptions.
    // Do not add monthlyInvestment separately to avoid double-counting.
    assets = riskPart * (1 + monthlyReturnMean) + safePart + currentIncome;
    assets -= currentWithdrawal;

    if (assets < 0) {
      assets = 0;
    }
  }

  return {
    table,
    fireReachedMonth,
  };
}
