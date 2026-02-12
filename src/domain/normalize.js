import { toNumber, toPercent } from "./parse";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

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

export function normalizePortfolio(api) {
  const safeApi = api ?? {};

  const assetsByClass = asArray(safeApi.breakdown).map((item) => ({
    name: String(item?.category ?? ""),
    amountYen: toNumber(item?.amount_yen),
    percentage: toPercent(item?.percentage),
  }));

  const liabilitiesByCategory = asArray(safeApi["breakdown-liability"]).map((item) => ({
    category: String(item?.category ?? ""),
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
      points: asArray(safeApi.details__portfolio_det_po__t0),
      liabilitiesDetail: asArray(safeApi["details__liability_det__t0-liability"]),
    },
  };
}
