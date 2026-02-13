import { toNumber } from "./parse";

const DAILY_CHANGE_KEYS = [
  "前日比",
  "前日からの値動き",
  "前日損益",
  "前日比損益",
  "評価損益",
  "当日損益",
];

export function formatYen(value) {
  return `¥${toNumber(value).toLocaleString("ja-JP")}`;
}

export function formatSignedYen(value) {
  const amount = toNumber(value);
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : "±";
  return `${sign}¥${Math.abs(amount).toLocaleString("ja-JP")}`;
}

export function dailyChangeYen(row) {
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

export function holdingRowKey(row) {
  const institution = row?.["保有金融機関"] ?? "";
  const name =
    row?.["名称・説明"] ?? row?.["種類・名称"] ?? row?.["銘柄名"] ?? row?.["名称"] ?? "";
  return `${institution}__${name}`;
}

export function truncate(text, length = 25) {
  if (typeof text !== "string") return text;
  if (text.length <= length) return text;
  return text.substring(0, length) + "...";
}
