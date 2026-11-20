export function getMonthKey(item) {
  // Only string dates carry a month; anything else (numbers from a
  // deformed row, a missing row) reads as "no month" instead of
  // throwing on .substring.
  const month = typeof item?.date === "string" ? item.date.substring(0, 7) : "";
  return month.length === 7 ? month : "";
}
