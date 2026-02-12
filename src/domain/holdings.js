import { dailyChangeYen } from "./format";
import { toNumber } from "./parse";

export const EMPTY_HOLDINGS = {
  cashLike: [],
  stocks: [],
  funds: [],
  pensions: [],
  points: [],
  liabilitiesDetail: [],
};

export const HOLDING_TABLE_CONFIGS = [
  {
    title: "現金・預金",
    key: "cashLike",
    columns: [
      { key: "種類・名称", label: "名称" },
      { key: "残高", label: "残高" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
  {
    title: "株式",
    key: "stocks",
    columns: [
      { key: "銘柄コード", label: "コード" },
      { key: "銘柄名", label: "銘柄名" },
      { key: "評価額", label: "評価額" },
      { key: "評価損益", label: "評価損益" },
      { key: "評価損益率", label: "評価損益率" },
      { key: "__dailyChange", label: "前日比" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
  {
    title: "投資信託",
    key: "funds",
    columns: [
      { key: "銘柄名", label: "銘柄名" },
      { key: "評価額", label: "評価額" },
      { key: "評価損益", label: "評価損益" },
      { key: "評価損益率", label: "評価損益率" },
      { key: "__dailyChange", label: "前日比" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
  {
    title: "年金",
    key: "pensions",
    columns: [
      { key: "名称", label: "名称" },
      { key: "現在価値", label: "現在価値" },
      { key: "評価損益", label: "評価損益" },
      { key: "評価損益率", label: "評価損益率" },
    ],
  },
  {
    title: "ポイント",
    key: "points",
    columns: [
      { key: "名称", label: "名称" },
      { key: "現在の価値", label: "現在の価値" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
  {
    title: "負債詳細",
    key: "liabilitiesDetail",
    columns: [
      { key: "種類", label: "種類" },
      { key: "名称・説明", label: "名称" },
      { key: "残高", label: "残高" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
];

export function stockFundRows(holdings) {
  const safe = holdings ?? EMPTY_HOLDINGS;
  return [...safe.stocks, ...safe.funds];
}

export function stockFundSummary(holdings) {
  const rows = stockFundRows(holdings);
  const totalYen = rows.reduce((sum, row) => sum + toNumber(row?.["評価額"]), 0);
  const dailyMoves = rows.map((row) => dailyChangeYen(row)).filter((value) => value != null);
  const dailyMoveTotal = dailyMoves.reduce((sum, value) => sum + value, 0);

  return {
    rows,
    totalYen,
    dailyMoves,
    dailyMoveTotal,
  };
}
