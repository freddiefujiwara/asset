import { computed } from "vue";
import { storeToRefs } from "pinia";
import { usePortfolioData } from "@/composables/usePortfolioData";
import { usePortfolioStore } from "@/stores/portfolio";
import { useFireSimulatorStore } from "@/stores/fireSimulator";
import { calculateAge, USER_BIRTH_DATE } from "@/domain/family";
import {
  PROGRESS_MILESTONES,
  SIDE_FIRE_ANNUAL_INCOME_YEN,
  UNIVERSITY_FUND_YEN,
  buildFireProgress,
  buildProjectionTrend,
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

  // 主指標の振り分け（ドメインの selectProgressFocus）。
  // サイドFIREが到達可能な水準になったら完全FIREが主指標に昇格する。
  const focus = computed(() => progress.value?.focus ?? null);
  const bothReached = computed(() => focus.value?.focus === "both");

  const labelForKind = (kind) => (kind === "side" ? "サイドFIRE" : "完全FIRE");
  const runForKind = (kind) =>
    kind === "side" ? progress.value?.side : progress.value?.full;

  const primaryProgress = computed(() => {
    const kind = focus.value?.primaryKind;
    if (!kind || !progress.value) return null;
    const run = describeRun(runForKind(kind));
    if (!run) return null;
    const isSide = kind === "side";
    return {
      ...run,
      kind,
      label: labelForKind(kind),
      // 主指標の対象資産。サイドFIREは大学資金を除いた対象資産、
      // 完全FIREは総資産そのものが対象（対象資産の行はサイドのときだけ出す）。
      baseAssetsLabel: isSide ? "FIRE対象資産（大学資金を除く）" : null,
      baseAssetsYen: isSide
        ? progress.value.fireTargetAssetsYen
        : progress.value.totalAssetsYen,
      rateLabel: isSide
        ? "到達率（FIRE対象資産 ÷ 必要資産）"
        : "到達率（総資産 ÷ 必要資産）",
    };
  });

  const secondaryProgress = computed(() => {
    const kind = focus.value?.secondaryKind;
    if (!kind || !progress.value) return null;
    const run = describeRun(runForKind(kind));
    if (!run) return null;
    return {
      ...run,
      kind,
      label: labelForKind(kind),
      achieved: run.alreadyReached === true,
    };
  });

  const trend = computed(() => {
    const requiredAssetsYen = progress.value?.side?.requiredAssetsYen;
    if (!requiredAssetsYen) return { hasTrend: false, points: [] };
    return buildProgressTrend(data.value?.snapshots ?? [], {
      universityFundYen: UNIVERSITY_FUND_YEN,
      requiredAssetsYen,
    });
  });

  // 到達見込み時期の推移（各月の資産・収支を現在の前提で振り返り計算）。
  const projectionTrend = computed(() =>
    buildProjectionTrend(data.value?.snapshots ?? [], {
      baseParams: baseParams.value,
      universityFundYen: UNIVERSITY_FUND_YEN,
      sideFireAnnualIncomeYen: SIDE_FIRE_ANNUAL_INCOME_YEN,
    }),
  );

  const describeProjection = (projection) => {
    if (!projection) return "—";
    if (projection.alreadyReached) return "到達可能な水準";
    if (!projection.reached || !projection.projectedMonth) return "見込みなし";
    const [year, month] = projection.projectedMonth.split("-").map(Number);
    return `${year}年${month}月`;
  };

  // 到達率の推移と到達見込みの推移を月で突き合わせた表示行。
  const trendRows = computed(() => {
    const rateByMonth = new Map(
      trend.value.points.map((point) => [point.month, point]),
    );
    return projectionTrend.value.points.map((point) => ({
      month: point.month,
      fireTargetAssetsYen:
        rateByMonth.get(point.month)?.fireTargetAssetsYen ?? point.fireTargetAssetsYen,
      progressRate: rateByMonth.get(point.month)?.progressRate ?? null,
      sideProjectedLabel: describeProjection(point.side),
      fullProjectedLabel: describeProjection(point.full),
    }));
  });

  const hasAnyTrend = computed(
    () => trend.value.hasTrend || projectionTrend.value.hasTrend,
  );

  const describeDelta = (delta) => {
    if (delta == null) return null;
    if (delta > 0) return `先月より見込みが${delta}か月近づきました`;
    if (delta < 0) return `先月より見込みが${-delta}か月遠のきました`;
    return "先月から見込みは変わりません";
  };

  const sideDeltaLabel = computed(() =>
    describeDelta(projectionTrend.value.delta.side),
  );
  const fullDeltaLabel = computed(() =>
    describeDelta(projectionTrend.value.delta.full),
  );

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
    focus,
    bothReached,
    primaryProgress,
    secondaryProgress,
    trend,
    projectionTrend,
    trendRows,
    hasAnyTrend,
    sideDeltaLabel,
    fullDeltaLabel,
    milestones,
    universityFundYen: UNIVERSITY_FUND_YEN,
  };
}
