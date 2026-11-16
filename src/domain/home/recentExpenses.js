import { getExpenseType, isSpecialExpense } from "../cashFlow/classifiers";

/**
 * トップページの「過去3日間の支出」ブロックの材料。
 * 明細の最新日を末日として、そこから3日分の支出を日別に返す。
 * 「今日」を末日にしないのは、取り込みの都合で明細の最新日が
 * 1〜2日前になるのが通常のため（鮮度カードと同じ考え方）。
 *
 * 支出の数え方: 振替と収入は除く。カード引き落とし・現金引き出し・
 * 電子マネーチャージなど getExpenseType が "exclude" にする行は、
 * 実際の買い物と二重計上になるため除く。ただし「特別な支出」は
 * 実支出そのものなので含める。
 */
export const RECENT_EXPENSE_DAYS = 3;

function isSpending(item) {
  if (!item || item.isTransfer || Number(item.amount) >= 0) return false;
  return getExpenseType(item) !== "exclude" || isSpecialExpense(item);
}

function shiftDateKey(dateKey, deltaDays) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + deltaDays);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * @param {Array} cashFlow 正規化済み明細
 * @returns {{
 *   hasData: boolean,
 *   latestDate: string,
 *   fromDate: string,
 *   groups: Array<{date: string, totalYen: number, items: Array<{date: string, name: string, category: string, amountYen: number}>}>,
 *   totalYen: number,
 * }}
 */
export function buildRecentExpenses(cashFlow) {
  const rows = Array.isArray(cashFlow) ? cashFlow : [];

  let latestDate = "";
  rows.forEach((item) => {
    if (item?.date && item.date > latestDate) latestDate = item.date;
  });
  if (!latestDate) {
    return { hasData: false, latestDate: "", fromDate: "", groups: [], totalYen: 0 };
  }

  const fromDate = shiftDateKey(latestDate, -(RECENT_EXPENSE_DAYS - 1));
  const byDate = new Map();
  rows.filter(isSpending).forEach((item) => {
    if (!item.date || item.date < fromDate || item.date > latestDate) return;
    const entries = byDate.get(item.date) ?? [];
    entries.push({
      date: item.date,
      name: item.name,
      category: item.category,
      amountYen: Math.abs(Number(item.amount)),
    });
    byDate.set(item.date, entries);
  });

  const groups = Array.from(byDate, ([date, items]) => {
    const sorted = [...items].sort((a, b) => b.amountYen - a.amountYen);
    return {
      date,
      items: sorted,
      totalYen: sorted.reduce((sum, entry) => sum + entry.amountYen, 0),
    };
  }).sort((a, b) => b.date.localeCompare(a.date));

  return {
    hasData: groups.length > 0,
    latestDate,
    fromDate,
    groups,
    totalYen: groups.reduce((sum, group) => sum + group.totalYen, 0),
  };
}
