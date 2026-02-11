import { toNumber } from "./parse";

export function formatYen(value) {
  return `¥${toNumber(value).toLocaleString("ja-JP")}`;
}

export function holdingRowKey(row) {
  const institution = row?.["保有金融機関"] ?? "";
  const name =
    row?.["名称・説明"] ?? row?.["種類・名称"] ?? row?.["銘柄名"] ?? row?.["名称"] ?? "";
  return `${institution}__${name}`;
}
