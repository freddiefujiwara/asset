import { toNumber } from "../parse";

/**
 * トップページの「資産推移」ブロックの材料。
 * 保有明細（株式・投資信託）の行が持つ前日比を集計し、
 * リスク資産の前日比合計と、寄与の大きい銘柄トップ3を返す。
 *
 * 前日比の出どころ: asset-gas の API が返す保有明細の各行には、
 * Money Forward 由来の前日比カラム（「前日比」等）が含まれており、
 * 資産画面（バランスシート）の「前日比合計」も同じ値を使っている。
 * ここでは当日の値動きを表すキーだけを対象にし、format.js の
 * dailyChangeYen が最後の手段として使う「評価損益」（累計の含み損益）
 * にはフォールバックしない。当日の値動きが無い行は集計から外し、
 * 何件中何件に前日比があるかを rowsWithData / rowsTotal で返す。
 * 原因は実データの寄与額だけで示し、推測はしない。
 */
const DAILY_CHANGE_KEYS = ["前日比", "前日からの値動き", "前日損益", "前日比損益", "当日損益"];

/** 寄与銘柄の表示件数。 */
export const ASSET_DAILY_CONTRIBUTOR_LIMIT = 3;

function strictDailyChangeYen(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  for (const key of DAILY_CHANGE_KEYS) {
    if (key in row) {
      return toNumber(row[key]);
    }
  }
  return null;
}

function holdingRows(holdings, key) {
  const rows = holdings?.[key];
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {object} holdings normalize済みの保有明細
 * @returns {{
 *   hasData: boolean,
 *   totalDailyChangeYen: number,
 *   contributors: Array<{name: string, changeYen: number}>,
 *   rowsWithData: number,
 *   rowsTotal: number,
 * }}
 */
export function buildAssetDailyChange(holdings) {
  const rows = [...holdingRows(holdings, "stocks"), ...holdingRows(holdings, "funds")];
  const byName = new Map();
  let totalDailyChangeYen = 0;
  let rowsWithData = 0;

  rows.forEach((row) => {
    const changeYen = strictDailyChangeYen(row);
    if (changeYen == null) return;
    rowsWithData += 1;
    totalDailyChangeYen += changeYen;
    const name = row["銘柄名"] || row["銘柄コード"] || "名称未設定";
    byName.set(name, (byName.get(name) ?? 0) + changeYen);
  });

  const contributors = Array.from(byName, ([name, changeYen]) => ({ name, changeYen }))
    .sort((a, b) => Math.abs(b.changeYen) - Math.abs(a.changeYen))
    .slice(0, ASSET_DAILY_CONTRIBUTOR_LIMIT);

  return {
    hasData: rowsWithData > 0,
    totalDailyChangeYen,
    contributors,
    rowsWithData,
    rowsTotal: rows.length,
  };
}
