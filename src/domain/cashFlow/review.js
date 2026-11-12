import { getExpenseType } from "./classifiers";
import { getMonthKey } from "./shared";
import {
  LIVING_COST_ATTENTION_RATE,
  formatMonthKey,
  listSpecialExpenses,
  shiftMonthKey,
} from "../home/cards";

/**
 * 収支画面の先頭に出す「要確認リスト」の判定ロジック。
 * 判定の考え方はホーム画面の生活費カード（buildLivingCostCard）と揃える:
 * - 評価対象は先月（確定分）
 * - 基準は直近12か月平均（当月除く、窓の合計 ÷ 12）
 * - 生活費は固定費＋変動費のみ（特別支出・その他の除外は含めない）
 * リストに載せるのは、大カテゴリ単位で基準の +10% を超えたもの。
 * 超過額の大きい順に最大3件まで（設計書 第4章）。
 */
export const REVIEW_CATEGORY_LIMIT = 3;

function livingCostByLargeCategory(cashFlow, monthKey) {
  const byLargeCategory = {};
  let total = 0;
  (cashFlow ?? []).forEach((item) => {
    if (getMonthKey(item) !== monthKey) return;
    if (item.isTransfer || Number(item.amount) >= 0) return;
    if (getExpenseType(item) === "exclude") return;
    const absAmount = Math.abs(Number(item.amount));
    total += absAmount;
    const largeCategory = String(item.category ?? "未分類").split("/")[0] || "未分類";
    byLargeCategory[largeCategory] = (byLargeCategory[largeCategory] ?? 0) + absAmount;
  });
  return { total, byLargeCategory };
}

/**
 * @param {Array} cashFlow 正規化済み明細
 * @param {Date} [now]
 * @returns {{
 *   month: string,
 *   livingCostYen: number,
 *   averageLivingCostYen: number,
 *   livingCostOverAverage: boolean,
 *   categories: Array<{label: string, monthYen: number, averageYen: number, excessYen: number, ratioPct: number|null}>,
 *   special: { totalYen: number, items: Array<{date: string, name: string, category: string, amountYen: number}> },
 * }}
 */
export function buildCashFlowReview(cashFlow, now = new Date()) {
  const currentMonth = formatMonthKey(now);
  const targetMonth = shiftMonthKey(currentMonth, -1);
  const target = livingCostByLargeCategory(cashFlow, targetMonth);

  let windowTotal = 0;
  const windowByCategory = {};
  for (let i = 1; i <= 12; i++) {
    const monthResult = livingCostByLargeCategory(cashFlow, shiftMonthKey(currentMonth, -i));
    windowTotal += monthResult.total;
    Object.entries(monthResult.byLargeCategory).forEach(([label, value]) => {
      windowByCategory[label] = (windowByCategory[label] ?? 0) + value;
    });
  }
  const average = windowTotal / 12;

  const labels = new Set([...Object.keys(windowByCategory), ...Object.keys(target.byLargeCategory)]);
  const categories = Array.from(labels)
    .map((label) => {
      const monthYen = target.byLargeCategory[label] ?? 0;
      /* v8 ignore next -- labels are the union of both maps and the window includes the target month */
      const averageYen = (windowByCategory[label] ?? 0) / 12;
      return {
        label,
        monthYen,
        averageYen: Math.round(averageYen),
        excessYen: Math.round(monthYen - averageYen),
        /* v8 ignore next -- the window includes the target month, so a listed label always has a positive average */
        ratioPct: averageYen > 0 ? Math.round((monthYen / averageYen - 1) * 100) : null,
      };
    })
    // カテゴリ単位の掲載条件: 基準（12か月平均）の +10% 超。
    // 平均が0のカテゴリは、新規に支出が発生した時点で掲載する。
    .filter(
      (category) =>
        category.monthYen > 0 &&
        category.monthYen > category.averageYen * LIVING_COST_ATTENTION_RATE,
    )
    .sort((a, b) => b.excessYen - a.excessYen)
    .slice(0, REVIEW_CATEGORY_LIMIT);

  // 特別支出は生活費とは分けて出す（ホームの特別支出カードと同じ明細抽出）。
  const specialItems = listSpecialExpenses(cashFlow, targetMonth);

  return {
    month: targetMonth,
    livingCostYen: target.total,
    averageLivingCostYen: Math.round(average),
    livingCostOverAverage:
      average > 0 && target.total > average * LIVING_COST_ATTENTION_RATE,
    categories,
    special: {
      totalYen: specialItems.reduce((sum, item) => sum + item.amountYen, 0),
      items: specialItems,
    },
  };
}
