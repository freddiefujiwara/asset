import fc from "fast-check";

/** Amount values in the shapes Money Forward rows actually carry:
    plain integers, comma-grouped strings, yen-marked strings,
    accounting negatives, zero, empty, and junk. */
const amountArb = fc.oneof(
  fc.integer({ min: -1_000_000, max: 100_000_000 }),
  fc.integer({ min: 0, max: 100_000_000 }).map((n) => n.toLocaleString("en-US")),
  fc.integer({ min: 0, max: 1_000_000 }).map((n) => `¥${n.toLocaleString("en-US")}`),
  fc.integer({ min: 0, max: 1_000_000 }).map((n) => `(${n.toLocaleString("en-US")})`),
  fc.integer({ min: 0, max: 1_000_000 }).map((n) => `▲${n}`),
  fc.constantFrom("0", "", "―", "-"),
  fc.constant(null),
);

const rowArb = fc.record(
  {
    "評価額": amountArb,
    "現在価値": amountArb,
    "残高": amountArb,
    "評価損益": amountArb,
  },
  { requiredKeys: [] },
);

const rowsArb = fc.array(rowArb, { maxLength: 8 });

export const holdingsArb = fc.record({
  stocks: rowsArb,
  funds: rowsArb,
  pensions: rowsArb,
  crypto: rowsArb,
  cashLike: fc.constant([]),
  points: fc.constant([]),
  liabilitiesDetail: fc.constant([]),
});
