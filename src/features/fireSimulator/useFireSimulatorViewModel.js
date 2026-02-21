import { computed, ref, watch, watchEffect } from "vue";
import { usePortfolioData } from "@/composables/usePortfolioData";
import { formatYen } from "@/domain/format";
import { calculateAge, USER_BIRTH_DATE } from "@/domain/family";
import CopyButton from "@/components/CopyButton.vue";
import {
  calculateFirePortfolio,
  generateGrowthTable,
  generateAnnualSimulation,
  estimateMortgageMonthlyPayment,
  calculateMonthlyPension,
  getPast5MonthSummary,
  runMonteCarloSimulation,
  calculateDaughterAssetsBreakdown,
  generateAlgorithmExplanationSegments,
} from "@/domain/fire";
import FireSimulationTable from "@/components/FireSimulationTable.vue";
import FireSimulationChart from "@/components/FireSimulationChart.vue";
import {
  EMPTY_SUMMARY,
  createMortgageOptions,
  fireDate,
  formatMonths,
  buildAnnualTableJson,
  buildConditionsAndAlgorithmJson,
} from "@/features/fireSimulator/formatters";

export function useFireSimulatorViewModel() {
  const { data, loading, error } = usePortfolioData();

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

  const useMonteCarlo = ref(false);
  const monteCarloTrials = ref(1000);
  const monteCarloVolatility = ref(15);
  const monteCarloSeed = ref(123);

  const firePortfolio = computed(() =>
    data.value
      ? calculateFirePortfolio(data.value)
      : { totalAssetsYen: 0, riskAssetsYen: 0, cashAssetsYen: 0, liabilitiesYen: 0, netWorthYen: 0 },
  );
  const initialAssets = computed(() => firePortfolio.value.totalAssetsYen);
  const riskAssets = computed(() => firePortfolio.value.riskAssetsYen);
  const cashAssets = computed(() => firePortfolio.value.cashAssetsYen);

  const past5MonthSummary = computed(() =>
    data.value?.cashFlow ? getPast5MonthSummary(data.value.cashFlow) : EMPTY_SUMMARY,
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
  const monthsOfCash = computed(() => (monthlyExpense.value > 0 ? cashAssets.value / monthlyExpense.value : 0));

  const autoPostFireFirstYearExtraExpense = computed(() => {
    const annualIncome = monthlyIncome.value * 12;
    return Math.round((annualIncome * 0.15) / 10000) * 10000;
  });
  const postFireFirstYearExtraExpense = computed(() =>
    useAutoFirstYearExtra.value ? autoPostFireFirstYearExtraExpense.value : manualPostFireFirstYearExtraExpense.value,
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

  const growthData = computed(() => generateGrowthTable(simulationParams.value));
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
    const payoff = new Date(`${mortgagePayoffDate.value}-01`);
    return calculateAge(USER_BIRTH_DATE, payoff);
  });

  const daughterIndependenceAge = computed(() => calculateAge(USER_BIRTH_DATE, new Date("2037-04-01")));

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

  const daughterBreakdown = computed(() => calculateDaughterAssetsBreakdown(data.value));

  const algorithmExplanationSegments = computed(() =>
    generateAlgorithmExplanationSegments({
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
    }),
  );

  const algorithmExplanationFull = computed(() => algorithmExplanationSegments.value.map((seg) => seg.value).join(""));

  const monteCarloResults = ref(null);
  const isCalculatingMonteCarlo = ref(false);

  const runMonteCarlo = () => {
    if (!useMonteCarlo.value) {
      monteCarloResults.value = null;
      return;
    }
    isCalculatingMonteCarlo.value = true;
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

  const conditionsPayload = computed(() => ({
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
  }));

  const copyConditionsAndAlgorithm = () =>
    JSON.stringify(
      buildConditionsAndAlgorithmJson({
        conditions: conditionsPayload.value,
        monteCarloResults: monteCarloResults.value,
        monteCarloVolatility: monteCarloVolatility.value,
        monteCarloSeed: monteCarloSeed.value,
        estimatedMonthlyPensionAt60: estimatedMonthlyPensionAt60.value,
        pensionAnnualAtFire: pensionAnnualAtFire.value,
        fireAchievementAge: fireAchievementAge.value,
        algorithmExplanation: algorithmExplanationFull.value,
      }),
      null,
      2,
    );

  const copyAnnualTable = () => JSON.stringify(buildAnnualTableJson(annualSimulationData.value), null, 2);

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

  return {
    loading,
    error,
    formatYen,
    CopyButton,
    FireSimulationTable,
    FireSimulationChart,
    monthlyInvestment,
    annualReturnRate,
    currentAge,
    includeInflation,
    inflationRate,
    includeTax,
    taxRate,
    postFireExtraExpense,
    retirementLumpSumAtFire,
    manualPostFireFirstYearExtraExpense,
    useAutoFirstYearExtra,
    withdrawalRate,
    includeBonus,
    useMonteCarlo,
    monteCarloTrials,
    monteCarloVolatility,
    monteCarloSeed,
    initialAssets,
    riskAssets,
    cashAssets,
    monthsOfCash,
    past5MonthSummary,
    manualMonthlyExpense,
    useAutoExpense,
    manualRegularMonthlyIncome,
    manualAnnualBonus,
    useAutoIncome,
    useAutoBonus,
    mortgageMonthlyPayment,
    mortgagePayoffDate,
    monthlyExpense,
    monthlyIncome,
    annualInvestment,
    annualSavings,
    postFireFirstYearExtraExpense,
    growthData,
    annualSimulationData,
    fireAchievementMonth,
    fireAchievementAge,
    pensionAnnualAtFire,
    estimatedMonthlyPensionAt60,
    requiredAssetsAtFire,
    chartAnnotations,
    fireDate,
    formatMonths,
    isCalculatingMonteCarlo,
    runMonteCarlo,
    monteCarloResults,
    algorithmExplanationSegments,
    copyConditionsAndAlgorithm,
    copyAnnualTable,
    copyText,
    mortgageOptions: computed(() => createMortgageOptions()),
  };
}
