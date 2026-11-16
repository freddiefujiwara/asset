import { CARD_STATUS } from "./cards";

/**
 * トップページの「要確認」リスト。
 * 既存の判定（ホームのカード判定と収支画面の要確認リスト）を候補に変え、
 * 優先度順に最大3件だけを出す。無ければ items は空で、画面側が
 * 「要確認はありません」と明示する。
 *
 * 候補と優先度（数字が小さいほど上位）:
 * 1. データ鮮度（明細の取り込みが止まっていると他の数字が信用できないため最優先）
 * 2. 投資実行額の不足（先月が基準未満）
 * 3. 生活費カテゴリの +10% 超（収支の要確認リストと同じ判定、超過額順）
 * 4. 生活費全体の +10% 超（カテゴリ単位の超過が無いのに全体が超えた場合に残る）
 * 5. 大きな特別支出（先月の最大の1件が下記の目安以上の場合）
 * いずれも事実の提示までで、売買などの指示は出さない。
 */
export const ATTENTION_ITEM_LIMIT = 3;

/** 特別支出を「大きな単発」とみなす目安（先月の最大の1件）。 */
export const ATTENTION_SPECIAL_EXPENSE_YEN = 50000;

const PRIORITY = {
  freshness: 10,
  investment: 20,
  category: 30,
  livingCost: 40,
  special: 50,
};

export function buildAttentionItems({ investmentCard, freshnessCard, review } = {}) {
  const candidates = [];

  if (freshnessCard?.status === CARD_STATUS.ATTENTION) {
    candidates.push({
      id: "freshness",
      kind: "freshness",
      priority: PRIORITY.freshness,
      latestDate: freshnessCard.latestDate,
      ageDays: freshnessCard.ageDays,
      linkTo: null,
    });
  }

  if (investmentCard?.status === CARD_STATUS.ATTENTION) {
    candidates.push({
      id: "investment",
      kind: "investment",
      priority: PRIORITY.investment,
      month: investmentCard.lastMonth.month,
      amountYen: investmentCard.lastMonth.amountYen,
      standardYen: investmentCard.standardYen,
      linkTo: "/cash-flow",
    });
  }

  const categories = Array.isArray(review?.categories) ? review.categories : [];
  categories.forEach((category) => {
    candidates.push({
      id: `category-${category.label}`,
      kind: "category",
      priority: PRIORITY.category,
      label: category.label,
      monthYen: category.monthYen,
      averageYen: category.averageYen,
      excessYen: category.excessYen,
      ratioPct: category.ratioPct,
      linkTo: "/cash-flow",
    });
  });

  if (review?.livingCostOverAverage) {
    candidates.push({
      id: "living-cost",
      kind: "living-cost",
      priority: PRIORITY.livingCost,
      month: review.month,
      amountYen: review.livingCostYen,
      averageYen: review.averageLivingCostYen,
      linkTo: "/cash-flow",
    });
  }

  const specialItems = Array.isArray(review?.special?.items) ? review.special.items : [];
  if (specialItems.length) {
    const largest = specialItems.reduce((max, item) =>
      item.amountYen > max.amountYen ? item : max,
    );
    if (largest.amountYen >= ATTENTION_SPECIAL_EXPENSE_YEN) {
      candidates.push({
        id: "special",
        kind: "special",
        priority: PRIORITY.special,
        month: review.month,
        name: largest.name,
        date: largest.date,
        amountYen: largest.amountYen,
        linkTo: "/cash-flow",
      });
    }
  }

  // 優先度順（同優先度内は候補を作った順 = カテゴリは超過額順を維持）。
  const sorted = [...candidates].sort((a, b) => a.priority - b.priority);
  return {
    items: sorted.slice(0, ATTENTION_ITEM_LIMIT),
    totalCount: sorted.length,
  };
}
