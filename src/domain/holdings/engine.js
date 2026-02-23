import { dailyChangeYen } from "../format";
import { toNumber } from "../parse";
import { totalProfitRate } from "../signed";

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
      { key: "__riskAssetRatio", label: "リスク比" },
      { key: "__totalAssetRatio", label: "全体比" },
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
      { key: "__riskAssetRatio", label: "リスク比" },
      { key: "__totalAssetRatio", label: "全体比" },
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
      { key: "__riskAssetRatio", label: "リスク比" },
      { key: "__totalAssetRatio", label: "全体比" },
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
    isLiability: true,
    columns: [
      { key: "種類", label: "種類" },
      { key: "名称・説明", label: "名称" },
      { key: "残高", label: "残高" },
      { key: "保有金融機関", label: "金融機関" },
    ],
  },
];

function holdingRows(holdings, key) {
  const rows = holdings?.[key];
  return Array.isArray(rows) ? rows : [];
}

export function stockFundRows(holdings) {
  const safe = holdings ?? EMPTY_HOLDINGS;
  return [...holdingRows(safe, "stocks"), ...holdingRows(safe, "funds")];
}

export function riskAssetSummary(holdings) {
  const sfRows = stockFundRows(holdings);
  const safe = holdings ?? EMPTY_HOLDINGS;
  const pRows = Array.isArray(safe.pensions) ? safe.pensions : [];
  const allRows = [...sfRows, ...pRows];

  const totalYen = allRows.reduce(
    (sum, row) => sum + (toNumber(row?.["評価額"]) || toNumber(row?.["現在価値"])),
    0,
  );
  const dailyMoves = sfRows.map((row) => dailyChangeYen(row)).filter((value) => value != null);
  const dailyMoveTotal = dailyMoves.reduce((sum, value) => sum + value, 0);
  const totalProfitYen = allRows.reduce((sum, row) => {
    if (!row || !("評価損益" in row)) {
      return sum;
    }
    return sum + toNumber(row["評価損益"]);
  }, 0);
  const totalProfitRatePct = totalProfitRate(totalYen, totalProfitYen);

  return {
    rows: allRows,
    totalYen,
    dailyMoves,
    dailyMoveTotal,
    totalProfitYen,
    totalProfitRatePct,
  };
}

/**
 * Aggregates rows by name and builds treemap tiles.
 */
function buildTiles(rows, { aggregate = false } = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];

  let processedRows = safeRows;
  if (aggregate) {
    const map = new Map();
    safeRows.forEach((row) => {
      const name = row?.["銘柄名"] || row?.["名称"] || "名称未設定";
      const value = toNumber(row?.["評価額"]) || toNumber(row?.["現在価値"]) || 0;
      let profit = toNumber(row?.["評価損益"]) || 0;
      const profitRate = toNumber(row?.["評価損益率"]);
      if (!profit && profitRate && value > 0) {
        profit = (profitRate * value) / (100 + profitRate);
      }
      const dailyChange = dailyChangeYen(row) || 0;
      const useProfitRate = !!row?.__useProfitRate;
      const institution = row?.["保有金融機関"] || "不明";
      const code = row?.["銘柄コード"] || "";

      if (!map.has(name)) {
        map.set(name, {
          name,
          symbol: code,
          value: 0,
          profit: 0,
          dailyChange: 0,
          useProfitRate: false,
          details: [],
        });
      }
      const entry = map.get(name);
      entry.value += value;
      entry.profit += profit;
      entry.dailyChange += dailyChange;
      if (useProfitRate) entry.useProfitRate = true;
      entry.details.push({ institution, value });
      if (!entry.symbol && code) {
        entry.symbol = code;
      }
    });
    processedRows = Array.from(map.values());
  } else {
    processedRows = safeRows.map((row, idx) => {
      const value = toNumber(row?.["評価額"]) || toNumber(row?.["現在価値"]) || 0;
      let profit = toNumber(row?.["評価損益"]) || 0;
      const profitRate = toNumber(row?.["評価損益率"]);
      if (!profit && profitRate && value > 0) {
        profit = (profitRate * value) / (100 + profitRate);
      }
      return {
        name: row?.["銘柄名"] ?? row?.["銘柄コード"] ?? row?.["名称"] ?? "名称未設定",
        symbol: row?.["銘柄コード"] ?? "",
        value,
        profit,
        dailyChange: dailyChangeYen(row),
        useProfitRate: !!row?.__useProfitRate,
        idx,
      };
    });
  }

  return processedRows
    .filter((entry) => entry.value > 0)
    .sort((a, b) => {
      if (a.value === b.value) {
        return (a.idx ?? 0) - (b.idx ?? 0);
      }
      return b.value - a.value;
    })
    .map((entry) => {
      let changeRate = 0;
      let isNegative = false;

      if (entry.useProfitRate) {
        const cost = entry.value - (entry.profit || 0);
        changeRate = cost > 0 ? (entry.profit / cost) * 100 : 0;
        isNegative = (entry.profit || 0) < 0;
      } else {
        const prevValue = entry.value - (entry.dailyChange || 0);
        changeRate = prevValue > 0 ? (entry.dailyChange / prevValue) * 100 : 0;
        isNegative = (entry.dailyChange || 0) < 0;
      }

      return {
        ...entry,
        changeRate,
        isNegative,
      };
    });
}

export function stockTiles(stocks) {
  return buildTiles(stocks, { aggregate: false });
}

export function fundTiles(funds) {
  return buildTiles(funds, { aggregate: true });
}

export function pensionTiles(pensions) {
  const processed = (pensions || []).map((p) => ({ ...p, __useProfitRate: true }));
  return buildTiles(processed, { aggregate: true });
}

export function allRiskTiles(holdings) {
  const stocks = holdings?.stocks || [];
  const funds = holdings?.funds || [];
  const pensions = (holdings?.pensions || []).map((p) => ({ ...p, __useProfitRate: true }));
  const combined = [...stocks, ...funds, ...pensions];
  return buildTiles(combined, { aggregate: true });
}

/**
 * Returns Yahoo Finance symbol if applicable.
 */
export function getYahooSymbol(code) {
  const sCode = String(code ?? "");
  if (/^[0-9]{4}$/.test(sCode)) {
    return `${sCode}.T`;
  }
  if (/^[0-9]{5}$/.test(sCode)) {
    return `${sCode.substring(0, 4)}.T`;
  }
  if (/^[A-Z]+$/.test(sCode)) {
    return sCode;
  }
  return null;
}

/**
 * Returns external URL for stock price.
 */
export function stockPriceUrl(name, code) {
  const symbol = getYahooSymbol(code);
  if (symbol) {
    if (/^[A-Z]+$/.test(symbol)) {
      return `https://finance.yahoo.com/quote/${symbol}/`;
    }
    return `https://finance.yahoo.co.jp/quote/${symbol}?term=1d`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(String(name ?? ""))}`;
}

/**
 * Generates CSV string for stocks (symbol,quantity).
 */
export function generateStockCsv(stocks) {
  const rows = Array.isArray(stocks) ? stocks : [];
  return rows
    .map((row) => {
      const code = row?.["銘柄コード"];
      const symbol = getYahooSymbol(code) || String(code ?? "");
      const quantity = toNumber(row?.["保有数"] || row?.["数量"]);
      return `${symbol},${quantity}`;
    })
    .join("\n");
}

