export function signedClass(value) {
  return value > 0 ? "is-positive" : value < 0 ? "is-negative" : "";
}

export function formatSignedPercent(value, digits = 2) {
  if (value == null) {
    return "-";
  }

  const sign = value > 0 ? "+" : value < 0 ? "-" : "±";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

export function totalProfitRate(totalAmountYen, totalProfitYen) {
  const principal = totalAmountYen - totalProfitYen;

  if (principal === 0) {
    return totalAmountYen === 0 && totalProfitYen === 0 ? 0 : null;
  }

  return (totalProfitYen / principal) * 100;
}
