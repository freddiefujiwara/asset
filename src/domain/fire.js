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

/**
 * Estimate monthly basic expenses from cash flow.
 * Returns a breakdown by category and excludes special expenses.
 * Also excludes "Cash" and "Card" related categories as requested.
 */
export function estimateMonthlyExpenses(cashFlow) {
  const months = getUniqueMonths(cashFlow);
  const monthCount = Math.max(months.length, 1);

  const breakdownMap = {};
  let totalNormalExpense = 0;
  let totalSpecialExpense = 0;

  cashFlow.forEach((item) => {
    if (item.isTransfer || item.amount >= 0) return;

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
      amount: Math.round(total / monthCount),
    }))
    .sort((a, b) => b.amount - a.amount);

  const averageNormal = Math.round(totalNormalExpense / monthCount);
  const finalTotal = averageNormal;

  return {
    total: finalTotal,
    breakdown,
    averageSpecial: Math.round(totalSpecialExpense / monthCount),
    monthCount,
  };
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
 * Simulate one trial of asset growth until FIRE or max time.
 */
function simulateTrial({
  initialAssets,
  riskAssetRatio,
  monthlyInvestment,
  annualReturnRate,
  annualStandardDeviation,
  monthlyExpense,
  targetMultiplier,
  maxMonths,
  includeInflation,
  inflationRate,
  includeTax,
  taxRate,
}) {
  let assets = initialAssets;
  const monthlyReturnMean = Math.pow(1 + annualReturnRate, 1 / 12) - 1;
  const monthlySD = annualStandardDeviation / Math.sqrt(12);
  const monthlyInflationRate = Math.pow(1 + (includeInflation ? inflationRate : 0), 1 / 12) - 1;

  for (let m = 0; m <= maxMonths; m++) {
    const currentAnnualExpense = monthlyExpense * 12 * Math.pow(1 + monthlyInflationRate, m);
    let requiredAssets = currentAnnualExpense * targetMultiplier;

    if (includeTax) {
      // Simple tax consideration: increase required assets to cover tax on 4% withdrawal
      // withdrawal * (1 - taxRate) = expense => withdrawal = expense / (1 - taxRate)
      requiredAssets /= (1 - taxRate);
    }

    if (assets >= requiredAssets) {
      return m;
    }

    const riskAssets = assets * riskAssetRatio;
    const safeAssets = assets - riskAssets;

    const returnRate = monthlyReturnMean + monthlySD * boxMuller();
    const grownRiskAssets = riskAssets * (1 + returnRate);
    const grownSafeAssets = safeAssets; // Assume safe assets (cash) have 0% return for simplicity

    assets = grownRiskAssets + grownSafeAssets + monthlyInvestment;
    assets -= monthlyExpense * Math.pow(1 + monthlyInflationRate, m);

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
    monthlyInvestment,
    annualReturnRate,
    annualStandardDeviation,
    monthlyExpense,
    targetMultiplier = 25,
    iterations = 1000,
    maxMonths = 1200,
    includeInflation = false,
    inflationRate = 0.02,
    includeTax = false,
    taxRate = 0.20315,
  } = params;

  const riskAssetRatio = initialAssets > 0 ? riskAssets / initialAssets : 0;
  const trials = [];

  for (let i = 0; i < iterations; i++) {
    trials.push(
      simulateTrial({
        initialAssets,
        riskAssetRatio,
        monthlyInvestment,
        annualReturnRate,
        annualStandardDeviation,
        monthlyExpense,
        targetMultiplier,
        maxMonths,
        includeInflation,
        inflationRate,
        includeTax,
        taxRate,
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
    monthlyInvestment,
    annualReturnRate,
    monthlyExpense,
    targetMultiplier = 25,
    maxMonths = 600, // 50 years for chart
    includeInflation = false,
    inflationRate = 0.02,
    includeTax = false,
    taxRate = 0.20315,
  } = params;

  const riskAssetRatio = initialAssets > 0 ? riskAssets / initialAssets : 0;
  const monthlyReturnMean = Math.pow(1 + annualReturnRate, 1 / 12) - 1;
  const monthlyInflationRate = Math.pow(1 + (includeInflation ? inflationRate : 0), 1 / 12) - 1;

  const table = [];
  let assets = initialAssets;
  let fireReachedMonth = -1;

  for (let m = 0; m <= maxMonths; m++) {
    const currentAnnualExpense = monthlyExpense * 12 * Math.pow(1 + monthlyInflationRate, m);
    let requiredAssets = currentAnnualExpense * targetMultiplier;
    if (includeTax) {
      requiredAssets /= (1 - taxRate);
    }

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

    if (m === maxMonths) break;

    const riskPart = assets * riskAssetRatio;
    const safePart = assets - riskPart;

    let currentInvestment = monthlyInvestment;
    let currentWithdrawal;

    if (isFire) {
      // Once FIRE is reached, stop investment and apply 4% withdrawal rule
      currentInvestment = 0;
      currentWithdrawal = (assets * 0.04) / 12;
    } else {
      currentWithdrawal = monthlyExpense * Math.pow(1 + monthlyInflationRate, m);
    }

    assets = riskPart * (1 + monthlyReturnMean) + safePart + currentInvestment;
    assets -= currentWithdrawal;

    if (assets < 0) {
      // Just keep it 0 if it goes below
      assets = 0;
    }
  }

  return {
    table,
    fireReachedMonth,
  };
}
