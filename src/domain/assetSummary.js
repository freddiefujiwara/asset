import { UNIVERSITY_FUND_YEN } from "./progress";
import { assetAmountYen, assetDisplayName } from "./family";
import { toNumber } from "./parse";

/**
 * 資産画面（バランスシート）先頭の3区分サマリ・集中表示・前月比の
 * ドメインロジック。金額は資産画面に表示している集計（カテゴリ別カードと
 * 合計）と突き合わせられるよう、画面側の集計値を入力に取る。
 */

/**
 * 60歳まで引き出せない（年齢ロックのある）資産のカテゴリ。
 * 年金（iDeCo・確定給付/確定拠出年金など）は原則60歳まで受給・引き出しが
 * できないため、「60歳前に使いやすい資産」から除く。
 */
export const AGE_LOCKED_CATEGORY_KEYS = ["pensions"];
export const AGE_LOCKED_LABEL = "年金（60歳まで引き出し不可）";

/**
 * 3区分サマリ。
 * - 総資産: 画面表示の総資産そのもの
 * - FIRE対象資産: 総資産 − 大学資金（設定値。第1段のFIRE進捗と共用）
 * - 60歳前に使いやすい資産: 総資産 − 年金（年齢ロック分）
 *
 * @param {object} args
 * @param {number} args.totalAssetsYen 画面表示の総資産
 * @param {Array<{key: string, amountYen: number}>} args.categoryCards カテゴリ別集計
 * @param {number} [args.universityFundYen]
 */
export function buildAssetSegments({
  totalAssetsYen,
  categoryCards,
  universityFundYen = UNIVERSITY_FUND_YEN,
}) {
  const total = Number(totalAssetsYen ?? 0);
  const cards = Array.isArray(categoryCards) ? categoryCards : [];
  const ageLockedYen = cards
    .filter((card) => AGE_LOCKED_CATEGORY_KEYS.includes(card.key))
    .reduce((sum, card) => sum + Number(card.amountYen ?? 0), 0);

  return {
    totalAssetsYen: total,
    universityFundYen,
    fireTargetAssetsYen: Math.max(0, total - universityFundYen),
    ageLockedYen,
    ageLockedLabel: AGE_LOCKED_LABEL,
    usableBefore60Yen: Math.max(0, total - ageLockedYen),
  };
}

/** 集中表示の対象カテゴリ（リスク資産）。 */
export const CONCENTRATION_CATEGORY_DEFS = [
  { key: "stocks", title: "株式" },
  { key: "funds", title: "投資信託" },
  { key: "pensions", title: "年金" },
];

/**
 * 単一銘柄の集中表示: リスク資産（株式・投資信託・年金）の中で
 * 評価額が最大の銘柄を取り出す。比率の分母はリスク資産合計
 * （保有明細テーブルの「リスク比」と同じ分母）。
 * 売買の指示ではなく「偏りの見える化」が目的。
 *
 * @param {object} holdings 正規化済み保有明細（カテゴリ別）
 * @param {number} riskAssetsTotalYen リスク資産合計（画面表示値）
 */
export function findLargestHolding(holdings, riskAssetsTotalYen) {
  const total = Number(riskAssetsTotalYen ?? 0);
  let largest = null;
  CONCENTRATION_CATEGORY_DEFS.forEach(({ key, title }) => {
    const rows = Array.isArray(holdings?.[key]) ? holdings[key] : [];
    rows.forEach((row) => {
      const amountYen = assetAmountYen(row);
      if (amountYen <= 0) return;
      if (!largest || amountYen > largest.amountYen) {
        largest = {
          name: assetDisplayName(row),
          categoryKey: key,
          categoryTitle: title,
          amountYen,
          profitYen: toNumber(row?.["評価損益"]),
        };
      }
    });
  });
  if (!largest) return null;
  return {
    ...largest,
    riskAssetsTotalYen: total,
    ratioOfRiskAssetsPct: total > 0 ? (largest.amountYen / total) * 100 : null,
  };
}

/**
 * 前月比（月次スナップショット）。
 * スナップショットは世帯全体の月末値で、ホーム画面ブロックCと同じく
 * 2か月分未満なら available=false（画面では「来月から表示されます」）。
 * 資産画面では判断に使う総資産と純資産の前月比を出す。
 */
export function buildBalanceMonthlyChanges(snapshots) {
  const rows = Array.isArray(snapshots) ? snapshots : [];
  if (rows.length < 2) {
    return { available: false, month: rows[0]?.month ?? "", previousMonth: "", rows: [] };
  }
  const previous = rows[rows.length - 2];
  const current = rows[rows.length - 1];
  const definitions = [
    { key: "totalAssets", label: "総資産", pick: (row) => row.totalAssetsYen },
    { key: "netAssets", label: "純資産", pick: (row) => row.netAssetsYen },
  ];
  return {
    available: true,
    month: current.month,
    previousMonth: previous.month,
    rows: definitions.map((definition) => {
      const currentYen = definition.pick(current);
      const previousYen = definition.pick(previous);
      return {
        key: definition.key,
        label: definition.label,
        currentYen,
        previousYen,
        diffYen: currentYen - previousYen,
      };
    }),
  };
}
