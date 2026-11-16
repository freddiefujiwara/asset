import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useFireSimulatorStore } from "@/stores/fireSimulator";

/**
 * FIRE計算エンジンへの前提パラメータ（baseParams）の組み立て。
 * FIRE計算画面の simulationParams と同じ前提を、資産額だけ差し替えられる
 * 形で共有する。FIRE進捗画面とホーム画面（FIRE進捗の要点）が共用する。
 * initialAssets / riskAssets は呼び出し側（ドメイン層）で差し替えるため含めない。
 */
export function useFireBaseParams() {
  const fireSimulatorStore = useFireSimulatorStore();

  const {
    annualReturnRate,
    currentAge,
    includeInflation,
    inflationRate,
    includeTax,
    taxRate,
    withdrawalRate,
    postFireExtraExpense,
    retirementLumpSumAtFire,
    manualPostFireFirstYearExtraExpense,
    useAutoFirstYearExtra,
    autoPostFireFirstYearExtraExpense,
    monthlyInvestment,
    mortgageMonthlyPayment,
    mortgagePayoffDate,
    monthlyExpense,
    monthlyIncome,
    past12MonthSummary,
  } = storeToRefs(fireSimulatorStore);

  // FIRE計算画面と同じ決め方（自動推計 or 手入力）。
  const postFireFirstYearExtraExpense = computed(() =>
    useAutoFirstYearExtra.value
      ? autoPostFireFirstYearExtraExpense.value
      : manualPostFireFirstYearExtraExpense.value,
  );

  const baseParams = computed(() => ({
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
    expenseBreakdown: past12MonthSummary.value.monthlyLivingExpenses.breakdown,
  }));

  return { baseParams, currentAge };
}
