import { toNumber } from "../src/domain/parse.js";

/**
 * Reduce a raw Money Forward detail row to the oracle contract using
 * the asset repo's real `toNumber`. Absent field -> 0;
 * `hasProfit` mirrors the engine's `"評価損益" in row` check.
 */
export function extractRow(row) {
  const isObj = row !== null && typeof row === "object";
  return {
    eval: toNumber(row?.["評価額"]),
    cur: toNumber(row?.["現在価値"]),
    bal: toNumber(row?.["残高"]),
    profit: toNumber(row?.["評価損益"]),
    hasProfit: isObj && "評価損益" in row,
  };
}

export function extractHoldings(holdings) {
  const pick = (rows) => (Array.isArray(rows) ? rows : []).map(extractRow);
  return {
    stocks: pick(holdings?.stocks),
    funds: pick(holdings?.funds),
    pensions: pick(holdings?.pensions),
    crypto: pick(holdings?.crypto),
  };
}
