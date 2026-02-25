import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { usePortfolioData } from "@/composables/usePortfolioData";
import { useFireSimulatorStore } from "@/stores/fireSimulator";
import { formatYen } from "@/domain/format";
import { calculateAge, USER_BIRTH_DATE } from "@/domain/family";
import CopyButton from "@/components/CopyButton.vue";
import {
  generateGrowthTable,
  generateAnnualSimulation,
  calculateMonthlyPension,
  runMonteCarloSimulation,
  calculateDaughterAssetsBreakdown,
  generateAlgorithmExplanationSegments,
} from "@/domain/fire";
import FireSimulationTable from "@/components/FireSimulationTable.vue";
import FireSimulationChart from "@/components/FireSimulationChart.vue";
import {
  createMortgageOptions,
  fireDate,
  formatMonths,
  buildAnnualTableJson,
  buildConditionsAndAlgorithmJson,
} from "@/features/fireSimulator/formatters";

export function useFireSimulatorViewModel() {
  const { data, loading, error } = usePortfolioData();
  const fireSimulatorStore = useFireSimulatorStore();

  const {
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
    manualMonthlyExpense,
    useAutoExpense,
    manualRegularMonthlyIncome,
    manualAnnualBonus,
    useAutoIncome,
    useAutoBonus,
    mortgageMonthlyPayment,
    mortgagePayoffDate,
    firePortfolio,
    initialAssets,
    riskAssets,
    cashAssets,
    past5MonthSummary,
    autoMonthlyExpense,
    autoRegularMonthlyIncome,
    autoAnnualBonus,
    autoMortgageMonthlyPayment,
    monthlyExpense,
    regularMonthlyIncome,
    annualBonus,
    monthlyIncome,
    externalSimulatorUrl,
    autoPostFireFirstYearExtraExpense,
  } = storeToRefs(fireSimulatorStore);

  const annualInvestment = computed(() => monthlyInvestment.value * 12);
  const annualSavings = computed(() => Math.max(0, (monthlyIncome.value - monthlyExpense.value - monthlyInvestment.value) * 12));
  const monthsOfCash = computed(() => (monthlyExpense.value > 0 ? cashAssets.value / monthlyExpense.value : 0));

  const postFireFirstYearExtraExpense = computed(() =>
    useAutoFirstYearExtra.value ? autoPostFireFirstYearExtraExpense.value : manualPostFireFirstYearExtraExpense.value,
  );

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
    mortgageMonthlyPaymentYen: mortgageMonthlyPayment.value,
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
    firePortfolio,
    initialAssets,
    riskAssets,
    cashAssets,
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
    externalSimulatorUrl,
    copyText,
    mortgageOptions: computed(() => createMortgageOptions()),
  };
}
