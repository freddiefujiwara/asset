import { EMPTY_HOLDINGS } from "./holdings";
import { assetAmountYen, detectAssetOwner } from "./family";

export const OWNER_FILTERS = [
  { id: "all", label: "全体" },
  { id: "me", label: "私" },
  { id: "wife", label: "妻" },
  { id: "daughter", label: "娘" },
];

function rowOwnerId(row) {
  const explicitOwner = row?.Owner ?? row?.owner;
  if (explicitOwner) {
    return String(explicitOwner).toLowerCase();
  }

  return detectAssetOwner(row).id;
}

export function filterHoldingsByOwner(holdings, ownerId = "all") {
  const safe = holdings ?? EMPTY_HOLDINGS;

  if (ownerId === "all") {
    return safe;
  }

  const filtered = {};
  for (const [key, rows] of Object.entries(safe)) {
    filtered[key] = Array.isArray(rows) ? rows.filter((row) => rowOwnerId(row) === ownerId) : [];
  }

  return filtered;
}

export function summarizeByCategory(holdings) {
  const safe = holdings ?? EMPTY_HOLDINGS;

  return [
    { key: "cashLike", title: "現金・預金", amountYen: safe.cashLike.reduce((sum, row) => sum + assetAmountYen(row), 0), count: safe.cashLike.length },
    { key: "stocks", title: "株式", amountYen: safe.stocks.reduce((sum, row) => sum + assetAmountYen(row), 0), count: safe.stocks.length },
    { key: "funds", title: "投資信託", amountYen: safe.funds.reduce((sum, row) => sum + assetAmountYen(row), 0), count: safe.funds.length },
    { key: "pensions", title: "年金", amountYen: safe.pensions.reduce((sum, row) => sum + assetAmountYen(row), 0), count: safe.pensions.length },
    { key: "points", title: "ポイント", amountYen: safe.points.reduce((sum, row) => sum + assetAmountYen(row), 0), count: safe.points.length },
    { key: "liabilitiesDetail", title: "負債", amountYen: safe.liabilitiesDetail.reduce((sum, row) => sum + assetAmountYen(row), 0), count: safe.liabilitiesDetail.length },
  ];
}
