import { toNumber, toPercent } from "./parse";

/**
 * normalize層: APIレスポンス契約をアプリ内部ドメイン形に変換する責務のみを持つ。
 * - 文字列/数値の型正規化はparse層に委譲
 * - 表示整形は行わない
 */

/**
 * @param {unknown} value
 * @returns {Array<unknown>}
 */
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * 年金行で評価損益が欠落しているケースを補完する。
 * @param {any} row
 * @returns {any}
 */
function withDerivedPensionProfit(row) {
  if (!row || typeof row !== "object") {
    return row;
  }

  if (row["評価損益"] != null) {
    return row;
  }

  const currentValue = toNumber(row["現在価値"]);
  const ratePercent = toPercent(row["評価損益率"]);
  const denominator = 100 + ratePercent;

  if (!Number.isFinite(currentValue) || !Number.isFinite(ratePercent) || denominator === 0) {
    return row;
  }

  const profitYen = Math.round((currentValue * ratePercent) / denominator);
  return {
    ...row,
    評価損益: String(profitYen),
  };
}


function normalizeText(value, fallback = "") {
  try {
    return String(value ?? fallback).trim();
  } catch {
    // JSON can carry values whose toString is not callable; one such
    // field must not fail the whole payload conversion.
    return String(fallback).trim();
  }
}

/**
 * 文字列化できない値が来ても例外にせず空文字として読む。
 * @param {unknown} value
 * @returns {string}
 */
function asText(value) {
  try {
    return String(value ?? "");
  } catch {
    return "";
  }
}

/**
 * 月次スナップショット（asset-gas の snapshots.csv）を内部形へ変換する。
 * 値はCSV由来で文字列のため数値化し、月順に並べる。
 */
function normalizeSnapshots(rows) {
  return asArray(rows)
    .map((row) => ({
      month: normalizeText(row?.month),
      totalAssetsYen: toNumber(row?.total_assets),
      totalLiabilitiesYen: toNumber(row?.total_liabilities),
      netAssetsYen: toNumber(row?.net_assets),
      cashYen: toNumber(row?.cash),
      riskAssetsYen: toNumber(row?.risk_assets),
      livingCost12mAvgYen: toNumber(row?.living_cost_12m_avg),
      income12mAvgYen: toNumber(row?.income_12m_avg),
    }))
    .filter((row) => /^\d{4}-\d{2}$/.test(row.month))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * 実質地域配分の重み（asset-gas の region-weights.csv 由来）を
 * 内部形へ変換する。取れない場合は null を返し、ドメイン層の
 * フォールバック初期値に委ねる。
 */
function normalizeRegionWeights(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const sets = {};
  for (const setName of ["acwi", "acwi_ex_japan", "developed", "emerging"]) {
    const set = raw[setName];
    if (!set || typeof set !== "object") {
      continue;
    }
    sets[setName] = {
      japan: toNumber(set.japan),
      us: toNumber(set.us),
      developed_other: toNumber(set.developed_other),
      emerging: toNumber(set.emerging),
      other: toNumber(set.other),
      effectiveDate: normalizeText(set.effective_date),
    };
  }
  return Object.keys(sets).length ? sets : null;
}

function normalizeCashFlowRows(rows) {
  const normalized = rows
    .filter((item) => item !== null && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      date: normalizeText(item?.date),
      amount: toNumber(item?.amount),
      currency: normalizeText(item?.currency, "JPY") || "JPY",
      name: normalizeText(item?.name),
      category: normalizeText(item?.category),
      isTransfer: Boolean(item?.is_transfer),
    }));

  const seen = new Set();
  return normalized.flatMap((item) => {
    const rowKey = `${item.date}::${item.amount}::${item.currency}::${item.name}::${item.category}::${item.isTransfer ? 1 : 0}`;
    if (seen.has(rowKey)) {
      return [];
    }
    seen.add(rowKey);
    return [{
      id: rowKey,
      ...item,
    }];
  });
}

/**
 * @param {any} api
 */
export function normalizePortfolio(api) {
  const safeApi = api ?? {};

  const assetsByClass = asArray(safeApi.breakdown).map((item) => ({
    name: asText(item?.category),
    amountYen: toNumber(item?.amount_yen),
    percentage: toPercent(item?.percentage),
  }));

  const liabilitiesByCategory = asArray(safeApi["breakdown-liability"]).map((item) => ({
    category: asText(item?.category),
    amountYen: toNumber(item?.amount_yen),
    percentage: toPercent(item?.percentage),
  }));

  const assetsYen = assetsByClass.reduce((sum, item) => sum + item.amountYen, 0);
  const liabilitiesYen = toNumber(safeApi["total-liability"]?.[0]?.total_yen);

  return {
    totals: {
      assetsYen,
      liabilitiesYen,
      netWorthYen: assetsYen - liabilitiesYen,
    },
    summary: {
      assetsByClass,
      liabilitiesByCategory,
    },
    holdings: {
      cashLike: asArray(safeApi.details__portfolio_det_depo__t0),
      stocks: asArray(safeApi.details__portfolio_det_eq__t0),
      funds: asArray(safeApi.details__portfolio_det_mf__t0),
      pensions: asArray(safeApi.details__portfolio_det_pns__t0).map((row) => withDerivedPensionProfit(row)),
      crypto: asArray(safeApi.details__portfolio_det_crpt__t0),
      points: asArray(safeApi.details__portfolio_det_po__t0),
      liabilitiesDetail: asArray(safeApi["details__liability_det__t0-liability"]),
    },
    cashFlow: normalizeCashFlowRows(asArray(safeApi.mfcf)),
    snapshots: normalizeSnapshots(safeApi.snapshots),
    weights: normalizeRegionWeights(safeApi.weights),
  };
}
