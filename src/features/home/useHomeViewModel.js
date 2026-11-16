import { computed, ref } from "vue";
import { usePortfolioData } from "@/composables/usePortfolioData";
import { usePortfolioStore } from "@/stores/portfolio";
import { useFireBaseParams } from "@/features/fireSimulator/useFireBaseParams";
import { fireDate, formatMonths } from "@/features/fireSimulator/formatters";
import { DEADLINE_DEFINITIONS } from "@/config/deadlines";
import {
  buildAttentionItems,
  buildDeadlineItems,
  buildFreshnessCard,
  buildHeadline,
  buildInvestmentCard,
  buildMonthlyChecklist,
  checklistStorageKey,
  parseChecklistState,
} from "@/domain/home";
import { buildCashFlowReview } from "@/domain/cashFlow/review";
import {
  SIDE_FIRE_ANNUAL_INCOME_YEN,
  UNIVERSITY_FUND_YEN,
  buildFireProgress,
  buildProjectionTrend,
} from "@/domain/progress";

/**
 * ホーム画面（アクション型ダッシュボード）のビューモデル。
 * 判定はすべてドメイン層で行い、ここはデータ接続とチェックリストの
 * localStorage 保存だけを担う。
 * 構成: 一行の結論 → 期限のあるアクション → FIRE進捗の要点 →
 * 要確認（最大3件）→ 月次チェックリスト。
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

  // 期限のあるアクション（静的設定 @/config/deadlines）。
  const deadlineItems = computed(() => buildDeadlineItems(DEADLINE_DEFINITIONS, now));

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
          universityFundYen: UNIVERSITY_FUND_YEN,
          sideFireAnnualIncomeYen: SIDE_FIRE_ANNUAL_INCOME_YEN,
        })
      : { hasTrend: false, points: [], delta: { side: null, full: null } },
  );

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

  // 月次チェックリスト: キーに年月を含むため、月替わりで自動リセットされる。
  // 先月の投資が基準どおりなら、データ判定で自動的にチェック済みにする。
  const storageKey = checklistStorageKey(now);
  const readStoredCheckedIds = () => {
    try {
      return parseChecklistState(globalThis.localStorage?.getItem(storageKey));
    } catch {
      return [];
    }
  };
  const checkedIds = ref(readStoredCheckedIds());
  const autoCheckedIds = computed(() =>
    investmentCard.value.status === "ok" ? ["investment-standard"] : [],
  );
  const checklistItems = computed(() =>
    buildMonthlyChecklist(checkedIds.value, autoCheckedIds.value),
  );
  const toggleChecklistItem = (id) => {
    // 自動確認済みの項目は手動で切り替えられない。
    if (autoCheckedIds.value.includes(id)) return;
    const next = new Set(checkedIds.value);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    checkedIds.value = Array.from(next);
    try {
      globalThis.localStorage?.setItem(storageKey, JSON.stringify(checkedIds.value));
    } catch {
      // 保存できなくても画面のチェック状態は維持する
    }
  };

  return {
    loading,
    error,
    shareMode,
    headline,
    deadlineItems,
    fireSummary,
    attention,
    checklistItems,
    toggleChecklistItem,
  };
}
