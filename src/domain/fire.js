import { aggregateByMonth, getSixMonthAverages } from "./cashFlow";

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
 * Subtracts the monthly investment amount if it's included in the expenses.
 */
export function estimateMonthlyExpenses(cashFlow, monthlyInvestment = 0) {
  const monthlyData = aggregateByMonth(cashFlow);
  const averages = getSixMonthAverages(monthlyData);
  return Math.max(0, Math.round(averages.expense - monthlyInvestment));
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

    table.push({
      month: m,
      assets,
      requiredAssets,
      isFire: fireReachedMonth !== -1 && m >= fireReachedMonth,
    });

    if (m === maxMonths) break;

    const riskPart = assets * riskAssetRatio;
    const safePart = assets - riskPart;
    assets = riskPart * (1 + monthlyReturnMean) + safePart + monthlyInvestment;
    assets -= monthlyExpense * Math.pow(1 + monthlyInflationRate, m);

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
