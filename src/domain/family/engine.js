import { getOwnerRules } from "../familyConfig";
import { toNumber } from "../parse";
import { dailyChangeYen } from "../format";
import { totalProfitRate } from "../signed";

const DEFAULT_OWNER = { id: "me", label: "私" };

/**
 * Calculate age based on birth date string and a base date.
 * @param {string} birthDateStr - ISO date string (YYYY-MM-DD)
 * @param {Date} [baseDate=new Date()] - Date to calculate age at
 * @returns {number}
 */
export function calculateAge(birthDateStr, baseDate = new Date()) {
  const birthDate = new Date(birthDateStr);
  let age = baseDate.getFullYear() - birthDate.getFullYear();
  const m = baseDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && baseDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const ASSET_FIELD_CANDIDATES = ["残高", "評価額", "現在価値", "現在の価値", "amount_yen", "金額"];

function evaluationProfitYen(row) {
  if (!row || typeof row !== "object" || !("評価損益" in row)) {
    return null;
  }

  return toNumber(row["評価損益"]);
}

function evaluationProfitRate(row) {
  if (!row || typeof row !== "object" || !("評価損益率" in row)) {
    return null;
  }

  return toNumber(row["評価損益率"]);
}

export function ownerFromText(text) {
  const normalized = String(text ?? "").toLowerCase();
  const matched = getOwnerRules().find((rule) => normalized.includes(rule.suffix));
  return matched ? { id: matched.id, label: matched.label } : DEFAULT_OWNER;
}

export function detectAssetOwner(row) {
  if (!row || typeof row !== "object") {
    return DEFAULT_OWNER;
  }

  const merged = Object.values(row)
    .filter((value) => typeof value === "string")
    .join(" ");

  return ownerFromText(merged);
}

export function assetAmountYen(row) {
  if (!row || typeof row !== "object") {
    return 0;
  }

  for (const key of ASSET_FIELD_CANDIDATES) {
    if (key in row) {
      return toNumber(row[key]);
    }
  }

  return 0;
}

const ASSET_NAME_FIELDS = ["名称・説明", "種類・名称", "銘柄名", "名称", "種類"];

export function assetDisplayName(row) {
  // Always returns a string: raw API rows can carry non-string name
  // fields, and consumers interpolate the result or feed it to
  // String()-based classifiers that throw on unstringifiable values.
  for (const key of ASSET_NAME_FIELDS) {
    const value = row?.[key];
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }
  return "-";
}

export function summarizeFamilyAssets(holdings) {
  const rules = getOwnerRules();
  const labelFor = (id) => rules.find((rule) => rule.id === id)?.label ?? id;
  const groups = {
    me: { ownerLabel: "私", totalYen: 0, stockFundYen: 0, dailyMoveYen: 0, hasDailyMove: false, profitYen: 0, profitRatePct: null, items: [] },
    wife: { ownerLabel: labelFor("wife"), totalYen: 0, stockFundYen: 0, dailyMoveYen: 0, hasDailyMove: false, profitYen: 0, profitRatePct: null, items: [] },
    daughter: { ownerLabel: labelFor("daughter"), totalYen: 0, stockFundYen: 0, dailyMoveYen: 0, hasDailyMove: false, profitYen: 0, profitRatePct: null, items: [] },
  };

  const categories = [
    { key: "cashLike", label: "現金・預金", trackMove: false },
    { key: "stocks", label: "株式", trackMove: true },
    { key: "funds", label: "投資信託", trackMove: true },
    { key: "pensions", label: "年金", trackMove: false },
    { key: "points", label: "ポイント", trackMove: false },
  ];

  categories.forEach(({ key, label, trackMove }) => {
    const rows = Array.isArray(holdings?.[key]) ? holdings[key] : [];

    rows.forEach((row) => {
      const owner = detectAssetOwner(row);
      const amountYen = assetAmountYen(row);
      const move = dailyChangeYen(row);
      const profit = evaluationProfitYen(row);
      const profitRate = evaluationProfitRate(row);
      const item = {
        type: label,
        name: assetDisplayName(row),
        institution: row?.["保有金融機関"] ?? "-",
        amountYen,
        dailyMoveYen: move,
        profitYen: profit,
        profitRatePct: profitRate,
      };

      groups[owner.id].totalYen += amountYen;
      if (trackMove) {
        groups[owner.id].stockFundYen += amountYen;
        if (move != null) {
          groups[owner.id].dailyMoveYen += move;
          groups[owner.id].hasDailyMove = true;
        }
        if (profit != null) {
          groups[owner.id].profitYen += profit;
        }
      }
      groups[owner.id].items.push(item);
    });
  });

  [groups.me, groups.wife, groups.daughter].forEach((group) => {
    group.profitRatePct = totalProfitRate(group.stockFundYen, group.profitYen);
  });

  return [groups.me, groups.wife, groups.daughter];
}
