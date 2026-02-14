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
    // A = (A/(1+r)) + (A*w - P)/(1-t)  => A(1 - w/(1-t)) = A/(1+r) - P/(1-t)
    // This is more complex to solve simply in a loop without knowing A.
    // However, if A*w > E-P, it means we are withdrawing more than needed.
    // A simplified conservative approach:
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
 * Internal simulation engine.
 */
function _runCoreSimulation(params, { recordMonthly = false, fireMonth = -1, returnsArray = null, randomReturn = false } = {}) {
  const {
    initialAssets,
    riskAssets,
    annualReturnRate,
    annualStandardDeviation,
    monthlyExpense,
    monthlyExpenses,
    monthlyIncome = 0,
    currentAge = 40,
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
    monthlyInvestment = 0,
  } = params;

  const monthlyExp = monthlyExpense ?? (monthlyExpenses ? monthlyExpenses / 12 : 0);
  const monthlyReturnMean = Math.pow(1 + annualReturnRate, 1 / 12) - 1;
  const monthlySD = (annualStandardDeviation || 0) / Math.sqrt(12);
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

      // 3. Ledger balance (NewCash = OldCash + Income - Expenses + Divestment)
      // Note: We don't Math.max(0) here to allow realistic "Debt/Negative Savings" if total assets are 0
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
  const { currentAge = 40, maxMonths = 1200 } = params;
  const totalMonthsLimit = Math.min(maxMonths, (100 - currentAge) * 12);

  let low = 0;
  let high = totalMonthsLimit;
  let result = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 12) * 12; // Test yearly steps as requested
    const res = _runCoreSimulation(params, { fireMonth: mid, returnsArray });
    if (res.survived) {
      result = mid;
      high = mid - 12;
    } else {
      low = mid + 12;
    }
  }

  // Refine monthly if result was found
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
function performFireSimulation(params, options = {}) {
  const { forceFireMonth = null, returnsArray = null, randomReturn = false, recordMonthly = false } = options;

  let targetReturns = returnsArray;
  if (!targetReturns) {
    const { currentAge = 40, annualReturnRate = 0, annualStandardDeviation = 0 } = params;
    const totalMonthsUntil100 = (100 - currentAge) * 12;
    const monthlyReturnMean = Math.pow(1 + annualReturnRate, 1 / 12) - 1;
    const monthlySD = annualStandardDeviation / Math.sqrt(12);

    targetReturns = [];
    for (let m = 0; m <= totalMonthsUntil100; m++) {
      if (randomReturn) {
        targetReturns.push(monthlyReturnMean + monthlySD * boxMuller());
      } else {
        targetReturns.push(monthlyReturnMean);
      }
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
 * Monte Carlo simulation for FIRE achievement.
 */
export function simulateFire(params) {
  const { currentAge = 40, maxMonths = 1200 } = params;
  const iterations = params.iterations ?? 1000;
  const maxMonthsLimit = Math.min(maxMonths, (100 - currentAge) * 12);

  const trials = [];
  for (let i = 0; i < iterations; i++) {
    const res = performFireSimulation(params, { randomReturn: true });
    const reached = res.fireReachedMonth === -1 ? maxMonthsLimit : res.fireReachedMonth;
    trials.push(reached);
  }
  trials.sort((a, b) => a - b);
  const median = trials[Math.floor(trials.length / 2)];
  const p5 = trials[Math.floor(trials.length * 0.05)];
  const p95 = trials[Math.floor(trials.length * 0.95)];
  const mean = trials.reduce((a, b) => a + b, 0) / trials.length;
  return { trials, stats: { mean, median, p5, p95 } };
}

/**
 * Generate a deterministic growth table for charting.
 */
export function generateGrowthTable(params) {
  const { monthlyData, fireReachedMonth } = performFireSimulation(params, { recordMonthly: true });
  return {
    table: monthlyData.map(d => ({
      month: d.month,
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
