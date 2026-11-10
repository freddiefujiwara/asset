import { formatMonthKey } from "./cards";

/**
 * ブロックB: 月次チェックリスト。
 * 毎月3日の家計総括・15日の中旬チェックと同じ観点の4項目。
 * 状態は端末内（localStorage）に月単位のキーで保存し、月替わりで自動リセットされる。
 */
export const MONTHLY_CHECKLIST_ITEMS = [
  { id: "special-expenses", label: "先月の特別支出を確認した" },
  { id: "investment-standard", label: "先月の投資が基準どおりだった" },
  { id: "living-cost-categories", label: "生活費の超過カテゴリを見た" },
  { id: "fire-progress", label: "FIRE進捗を確認した" },
];

export function checklistStorageKey(now = new Date()) {
  return `asset-monthly-checklist:${formatMonthKey(now)}`;
}

/**
 * 保存済みの生値をチェック済みIDの配列に正規化する（未知のIDは捨てる）。
 */
export function parseChecklistState(raw) {
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const knownIds = new Set(MONTHLY_CHECKLIST_ITEMS.map((item) => item.id));
  return parsed.filter((id) => knownIds.has(id));
}
