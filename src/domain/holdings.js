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

export function stockTiles(stocks) {
  const safeRows = Array.isArray(stocks) ? stocks : [];
  const prepared = safeRows
    .map((row, idx) => {
      const value = toNumber(row?.["評価額"]);
      return {
        row,
        idx,
        value,
        dailyChange: dailyChangeYen(row),
      };
    })
    .filter((entry) => entry.value > 0)
    .sort((a, b) => {
      if (a.value === b.value) {
        return a.idx - b.idx;
      }
      return b.value - a.value;
    });

  if (!prepared.length) {
    return [];
  }

  const maxValue = prepared[0].value;
  const minValue = prepared[prepared.length - 1].value;
  const range = Math.max(1, maxValue - minValue);

  const layouted = [];
  layoutTreemap(prepared, 0, 0, 100, 100, layouted);

  return layouted.map((entry) => ({
    name: entry.row?.["銘柄名"] ?? entry.row?.["銘柄コード"] ?? "名称未設定",
    value: entry.value,
    dailyChange: entry.dailyChange,
    isNegative: entry.dailyChange != null && entry.dailyChange < 0,
    x: entry.x,
    y: entry.y,
    width: entry.width,
    height: entry.height,
    fontScale: 0.9 + ((entry.value - minValue) / range) * 0.9,
  }));
}

function layoutTreemap(items, x, y, width, height, output) {
  if (items.length === 1) {
    output.push({ ...items[0], x, y, width, height });
    return;
  }

  const total = items.reduce((sum, item) => sum + item.value, 0);
  const target = total / 2;

  let splitIndex = 1;
  let leftSum = items[0].value;
  while (splitIndex < items.length - 1 && leftSum < target) {
    leftSum += items[splitIndex].value;
    splitIndex += 1;
  }

  const leftItems = items.slice(0, splitIndex);
  const rightItems = items.slice(splitIndex);
  const leftRatio = leftSum / total;

  if (width >= height) {
    const leftWidth = width * leftRatio;
    layoutTreemap(leftItems, x, y, leftWidth, height, output);
    layoutTreemap(rightItems, x + leftWidth, y, width - leftWidth, height, output);
    return;
  }

  const topHeight = height * leftRatio;
  layoutTreemap(leftItems, x, y, width, topHeight, output);
  layoutTreemap(rightItems, x, y + topHeight, width, height - topHeight, output);
}
