import { toNumber } from "./parse";
import { dailyChangeYen } from "./format";

const OWNER_RULES = [
  { id: "wife", label: "妻", suffix: "@chipop" },
  { id: "daughter", label: "娘", suffix: "@aojiru.pudding" },
];

const DEFAULT_OWNER = { id: "me", label: "私" };

const ASSET_FIELD_CANDIDATES = ["残高", "評価額", "現在価値", "現在の価値", "amount_yen", "金額"];

function ownerFromText(text) {
  const normalized = String(text ?? "").toLowerCase();
  const matched = OWNER_RULES.find((rule) => normalized.includes(rule.suffix));
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

export function assetDisplayName(row) {
  return (
    row?.["名称・説明"] ?? row?.["種類・名称"] ?? row?.["銘柄名"] ?? row?.["名称"] ?? row?.["種類"] ?? "-"
  );
}

export function summarizeFamilyAssets(holdings) {
  const groups = {
    me: { ownerLabel: "私", totalYen: 0, stockFundYen: 0, dailyMoveYen: 0, hasDailyMove: false, items: [] },
    wife: { ownerLabel: "妻", totalYen: 0, stockFundYen: 0, dailyMoveYen: 0, hasDailyMove: false, items: [] },
    daughter: { ownerLabel: "娘", totalYen: 0, stockFundYen: 0, dailyMoveYen: 0, hasDailyMove: false, items: [] },
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
      const item = {
        type: label,
        name: assetDisplayName(row),
        institution: row?.["保有金融機関"] ?? "-",
        amountYen,
        dailyMoveYen: move,
      };

      groups[owner.id].totalYen += amountYen;
      if (trackMove) {
        groups[owner.id].stockFundYen += amountYen;
        if (move != null) {
          groups[owner.id].dailyMoveYen += move;
          groups[owner.id].hasDailyMove = true;
        }
      }
      groups[owner.id].items.push(item);
    });
  });

  return [groups.me, groups.wife, groups.daughter];
}
