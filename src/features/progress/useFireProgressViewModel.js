import { computed } from "vue";
import { storeToRefs } from "pinia";
import { usePortfolioData } from "@/composables/usePortfolioData";
import { usePortfolioStore } from "@/stores/portfolio";
import { useFireSimulatorStore } from "@/stores/fireSimulator";
import { calculateAge, USER_BIRTH_DATE } from "@/domain/family";
import {
  PROGRESS_MILESTONES,
  UNIVERSITY_FUND_YEN,
  buildFireProgress,
  buildProgressTrend,
} from "@/domain/progress";
import { fireDate, formatMonths } from "@/features/fireSimulator/formatters";

/**
 * FIRE進捗画面のビューモデル。
 * 前提（利回り・生活費・収入・ローン等）はFIRE計算画面と共有の
 * fireSimulator ストアの既定値を使い、入力は持たない。
 */
export function useFireProgressViewModel() {
  const { data, loading, error } = usePortfolioData();
  const portfolioStore = usePortfolioStore();
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

  const shareMode = computed(() => portfolioStore.shareMode);

  // FIRE計算画面の simulationParams と同じ組み立て（initialAssets/riskAssets は
  // ドメイン側で主指標・補助指標それぞれに差し替える）。
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

  const progress = computed(() =>
    data.value
      ? buildFireProgress({ portfolio: data.value, baseParams: baseParams.value })
      : null,
  );

  const describeRun = (run) => {
    if (!run) return null;
    if (!run.reached) {
      return { ...run, durationLabel: "見込みなし", dateLabel: "—", ageLabel: "—" };
    }
    return {
      ...run,
      durationLabel: formatMonths(run.monthsToReach),
      dateLabel: fireDate(run.monthsToReach),
      ageLabel: `${Math.floor(currentAge.value + run.monthsToReach / 12)}歳`,
      progressRatePct: run.progressRate != null ? run.progressRate * 100 : null,
    };
  };

  const sideProgress = computed(() => describeRun(progress.value?.side));
  const fullProgress = computed(() => describeRun(progress.value?.full));

  const trend = computed(() => {
    const requiredAssetsYen = progress.value?.side?.requiredAssetsYen;
    if (!requiredAssetsYen) return { hasTrend: false, points: [] };
    return buildProgressTrend(data.value?.snapshots ?? [], {
      universityFundYen: UNIVERSITY_FUND_YEN,
      requiredAssetsYen,
    });
  });

  const milestones = computed(() =>
    PROGRESS_MILESTONES.map((milestone) => {
      const [year, month] = milestone.monthKey.split("-").map(Number);
      // 年齢はその月の末日時点（節目の月に到達する年齢）で出す。
      const endOfMonth = new Date(year, month, 0);
      return {
        ...milestone,
        dateLabel: `${year}年${month}月`,
        ageLabel: `${calculateAge(USER_BIRTH_DATE, endOfMonth)}歳`,
      };
    }),
  );

  return {
    loading,
    error,
    shareMode,
    progress,
    sideProgress,
    fullProgress,
    trend,
    milestones,
    universityFundYen: UNIVERSITY_FUND_YEN,
  };
}
