function hasAccountingNegativeMarker(raw) {
  const normalized = String(raw ?? "").trim();
  return (normalized.startsWith("(") && normalized.endsWith(")")) || /^[▲△]/.test(normalized);
}

export function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const isNegative = hasAccountingNegativeMarker(value);

  const normalized = value
    .replace(/[￥¥,\s]/g, "")
    .replace(/円/g, "")
    .replace(/[()▲△]/g, "")
    .replace(/[^0-9.+-]/g, "");

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return isNegative ? -Math.abs(parsed) : parsed;
}

export function toPercent(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const isNegative = hasAccountingNegativeMarker(value);
  const normalized = value.replace(/[%()▲△]/g, "").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return isNegative ? -Math.abs(parsed) : parsed;
}
