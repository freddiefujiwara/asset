import { computed } from "vue";
import { usePortfolioData } from "@/composables/usePortfolioData";
import { usePortfolioStore } from "@/stores/portfolio";
import { useFireBaseParams } from "@/features/fireSimulator/useFireBaseParams";
import { fireDate, formatMonths } from "@/features/fireSimulator/formatters";
import {
  buildAssetDailyChange,
  buildAttentionItems,
  buildFreshnessCard,
  buildHeadline,
  buildInvestmentCard,
  buildRecentExpenses,
} from "@/domain/home";
import { riskAssetSummary } from "@/domain/holdings";
import { buildCashFlowReview } from "@/domain/cashFlow/review";
import {
  getSideFireAnnualIncomeYen,
  getUniversityFundYen,
} from "@/domain/familyConfig";
import {
  buildAssetGoals,
  buildFireProgress,
  buildProjectionTrend,
} from "@/domain/progress";

/**
 * ホーム画面（アクション型ダッシュボード）のビューモデル。
 * 判定はすべてドメイン層で行い、ここはデータ接続だけを担う。
 * 構成: 一行の結論 → 資産推移（前日比と主な原因）→ 要確認（最大3件）→
 * 過去3日間の支出 → FIRE進捗の要点（一番下）。
 */
export function useHomeViewModel() {
  const { data, loading, error } = usePortfolioData();
  const portfolioStore = usePortfolioStore();
  const { baseParams, currentAge } = useFireBaseParams();
  const now = new Date();

  const shareMode = computed(() => portfolioStore.shareMode);
  const cashFlow = computed(() => data.value?.cashFlow ?? []);
  const snapshots = computed(() => data.value?.snapshots ?? []);

  // 要確認リストの材料（既存のカード判定と収支の要確認リスト）。
  const investmentCard = computed(() => buildInvestmentCard(cashFlow.value, now));
  const freshnessCard = computed(() => buildFreshnessCard(cashFlow.value, now));
  const review = computed(() => buildCashFlowReview(cashFlow.value, now));
  const attention = computed(() =>
    buildAttentionItems({
      investmentCard: investmentCard.value,
      freshnessCard: freshnessCard.value,
      review: review.value,
    }),
  );

  // 資産推移: 保有明細の前日比を集計する。リスク資産の現在額も併せて出す。
  const assetDaily = computed(() => {
    const holdings = data.value?.holdings;
    return {
      ...buildAssetDailyChange(holdings),
      riskAssetsYen: riskAssetSummary(holdings).totalYen,
    };
  });

  // 過去3日間の支出（明細の最新日を末日にする）。
  const recentExpenses = computed(() => buildRecentExpenses(cashFlow.value));

  // FIRE進捗の要点（完全FIRE）。共有モードでは /progress と同様に出さない。
  const fireProgress = computed(() =>
    !shareMode.value && data.value
      ? buildFireProgress({ portfolio: data.value, baseParams: baseParams.value })
      : null,
  );
  const projectionTrend = computed(() =>
    !shareMode.value && data.value
      ? buildProjectionTrend(snapshots.value, {
          baseParams: baseParams.value,
          universityFundYen: getUniversityFundYen(),
          sideFireAnnualIncomeYen: getSideFireAnnualIncomeYen(),
        })
      : { hasTrend: false, points: [], delta: { side: null, full: null } },
  );

  // 1億円目標（金融資産・純金融資産）の要点。FIRE進捗の要点に併記する。
  const assetGoals = computed(() =>
    !shareMode.value && data.value
      ? buildAssetGoals({ portfolio: data.value, baseParams: baseParams.value })
      : null,
  );

  const describeGoalSummary = (goal) => {
    if (!goal) return null;
    return {
      progressRatePct: goal.progressRate != null ? goal.progressRate * 100 : null,
      alreadyReached: goal.alreadyReached,
      reached: goal.reached,
      dateLabel: goal.reached ? fireDate(goal.monthsToReach) : null,
    };
  };

  const fireSummary = computed(() => {
    const full = fireProgress.value?.full;
    if (!full) return null;
    const latestPoint =
      projectionTrend.value.points[projectionTrend.value.points.length - 1];
    const projectedMonth = latestPoint?.full?.projectedMonth ?? null;
    const [projYear, projMonth] = projectedMonth
      ? projectedMonth.split("-").map(Number)
      : [null, null];
    return {
      progressRatePct: full.progressRate != null ? full.progressRate * 100 : null,
      requiredAssetsYen: full.requiredAssetsYen,
      gapYen: full.gapYen,
      alreadyReached: full.alreadyReached,
      reached: full.reached,
      durationLabel: full.reached ? formatMonths(full.monthsToReach) : null,
      dateLabel: full.reached ? fireDate(full.monthsToReach) : null,
      ageLabel: full.reached
        ? `${Math.floor(currentAge.value + full.monthsToReach / 12)}歳`
        : null,
      projectedMonthLabel: projectedMonth ? `${projYear}年${projMonth}月` : null,
      deltaMonths: projectionTrend.value.delta.full,
      hasTrend: projectionTrend.value.hasTrend,
      totalGoal: describeGoalSummary(assetGoals.value?.total),
      netGoal: describeGoalSummary(assetGoals.value?.net),
    };
  });

  // 一行の結論。ペース判定は完全FIREの到達見込みの先月比（共有モードでは出さない）。
  const headline = computed(() =>
    buildHeadline({
      snapshots: snapshots.value,
      currentNetAssetsYen: data.value?.totals?.netWorthYen ?? 0,
      projectionDeltaMonths: shareMode.value
        ? null
        : projectionTrend.value.delta.full,
    }),
  );

  return {
    loading,
    error,
    shareMode,
    headline,
    assetDaily,
    attention,
    recentExpenses,
    fireSummary,
  };
}
