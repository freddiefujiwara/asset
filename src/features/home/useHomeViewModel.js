import { computed, ref } from "vue";
import { usePortfolioData } from "@/composables/usePortfolioData";
import { usePortfolioStore } from "@/stores/portfolio";
import {
  MONTHLY_CHECKLIST_ITEMS,
  buildFreshnessCard,
  buildInvestmentCard,
  buildLivingCostCard,
  buildMilestoneCard,
  buildMonthlyChanges,
  buildSpecialExpenseCard,
  checklistStorageKey,
  parseChecklistState,
} from "@/domain/home";
import { UNIVERSITY_FUND_YEN } from "@/domain/progress";

/**
 * ホーム画面（今月の判断）のビューモデル。
 * 判定はすべてドメイン層（@/domain/home）で行い、ここはデータ接続と
 * チェックリストの localStorage 保存だけを担う。
 */
export function useHomeViewModel() {
  const { data, loading, error } = usePortfolioData();
  const portfolioStore = usePortfolioStore();
  const now = new Date();

  const shareMode = computed(() => portfolioStore.shareMode);
  const cashFlow = computed(() => data.value?.cashFlow ?? []);
  const snapshots = computed(() => data.value?.snapshots ?? []);

  const investmentCard = computed(() => buildInvestmentCard(cashFlow.value, now));
  const livingCostCard = computed(() => buildLivingCostCard(cashFlow.value, now));
  const specialExpenseCard = computed(() => buildSpecialExpenseCard(cashFlow.value, now));
  const milestoneCard = computed(() => buildMilestoneCard(now));
  const freshnessCard = computed(() => buildFreshnessCard(cashFlow.value, now));
  const monthlyChanges = computed(() => {
    const changes = buildMonthlyChanges(snapshots.value, UNIVERSITY_FUND_YEN);
    // 共有モードではFIRE関連の行を出さない（既存の共有モードの扱いに合わせる）。
    if (!shareMode.value) return changes;
    return {
      ...changes,
      rows: changes.rows.filter((row) => row.key !== "fireTargetAssets"),
    };
  });

  // 月次チェックリスト: キーに年月を含むため、月替わりで自動リセットされる。
  const storageKey = checklistStorageKey(now);
  const readStoredCheckedIds = () => {
    try {
      return parseChecklistState(globalThis.localStorage?.getItem(storageKey));
    } catch {
      return [];
    }
  };
  const checkedIds = ref(readStoredCheckedIds());
  const checklistItems = computed(() =>
    MONTHLY_CHECKLIST_ITEMS.map((item) => ({
      ...item,
      checked: checkedIds.value.includes(item.id),
    })),
  );
  const toggleChecklistItem = (id) => {
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
    investmentCard,
    livingCostCard,
    specialExpenseCard,
    milestoneCard,
    freshnessCard,
    monthlyChanges,
    checklistItems,
    toggleChecklistItem,
  };
}
