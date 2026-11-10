import { CASH_FLOW_CONFIG, CATEGORY_DELIMITER, UNCATEGORIZED } from "./constants";

/**
 * カテゴリ文字列または明細オブジェクトから分類を返す (fixed | variable | exclude)
 * @param {string|object} categoryOrItem
 */
export const getExpenseType = (categoryOrItem) => {
  const isObj = categoryOrItem && typeof categoryOrItem === "object";
  const isTransfer = isObj ? categoryOrItem.isTransfer : false;
  const rawCategory = isObj ? categoryOrItem.category : categoryOrItem;
  const category = String(rawCategory ?? "");

  if (isTransfer) return "exclude";
  if (category.startsWith("特別な支出")) return "exclude";
  if (category.startsWith("現金")) return "exclude";
  if (category.startsWith("カード")) return "exclude";
  if (CASH_FLOW_CONFIG.EXCLUDE.some((k) => category.includes(k))) return "exclude";
  if (CASH_FLOW_CONFIG.FIXED.some((k) => category.includes(k))) return "fixed";
  return "variable"; // それ以外はすべて変動費
};

/**
 * 特別支出かどうか（カテゴリが「特別な支出」で始まる出金）。
 * getExpenseType では "exclude" 扱いとなり生活費には含めないが、
 * 収支画面の要確認リストと月次グラフでは通常の除外と分けて扱うため、
 * 判定をここに一本化する。
 */
export function isSpecialExpense(item) {
  if (!item || item.isTransfer || Number(item.amount) >= 0) return false;
  return String(item.category ?? "").startsWith("特別な支出");
}

export function getCategoryLabel(item) {
  const category = item?.category;
  return typeof category === "string" && category.length > 0 ? category : UNCATEGORIZED;
}

export function getCategoryParts(item) {
  const [large = UNCATEGORIZED, small = ""] = getCategoryLabel(item).split(CATEGORY_DELIMITER);
  return { large, small };
}
