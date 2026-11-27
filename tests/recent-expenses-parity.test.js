import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRecentExpenses } from "../src/domain/home/recentExpenses";

const item = (date, name, category, amount, isTransfer = false) =>
  ({ date, name, category, amount, isTransfer });

const food = "食費/食料品";
const special = "特別な支出/家具・家電";
const cases = [
  {
    name: "year boundary, latest income, exclusions and descending item order",
    rows: [
      item("2027-01-02", "給与", "収入/給与", 100000),
      item("2027-01-01", "パン", food, -300),
      item("2026-12-30", "範囲外", food, -999),
      item("2026-12-31", "日用品", "日用品", -700),
      item("2027-01-01", "家具", special, -5000),
      item("2027-01-02", "精算", "カード/引き落とし", -9000),
      item("2027-01-01", "引き出し", "現金/引き出し", -8000),
      item("2026-12-31", "チャージ", "電子マネーチャージ", -6000),
      item("2027-01-02", "振替", special, -10000, true),
    ],
    expected: {
      hasData: true,
      latestDate: "2027-01-02",
      fromDate: "2026-12-31",
      groups: [
        {
          date: "2027-01-01",
          items: [
            { date: "2027-01-01", name: "家具", category: special, amountYen: 5000 },
            { date: "2027-01-01", name: "パン", category: food, amountYen: 300 },
          ],
          totalYen: 5300,
        },
        {
          date: "2026-12-31",
          items: [{ date: "2026-12-31", name: "日用品", category: "日用品", amountYen: 700 }],
          totalYen: 700,
        },
      ],
      totalYen: 6000,
    },
  },
  {
    name: "leap day with no spending",
    rows: [item("2024-03-02", "給与", "収入/給与", 1000)],
    expected: { hasData: false, latestDate: "2024-03-02", fromDate: "2024-02-29", groups: [], totalYen: 0 },
  },
  {
    name: "empty transaction list",
    rows: [],
    expected: { hasData: false, latestDate: "", fromDate: "", groups: [], totalYen: 0 },
  },
];

describe("recent-expense contract", () => {
  it.each(cases)("$name in asset", ({ rows, expected }) => {
    expect(buildRecentExpenses(structuredClone(rows))).toEqual(expected);
  });

  // Optional offline locally; the dedicated CI job supplies a fresh asset-gas checkout.
  const gasSource = process.env.ASSET_GAS_SOURCE;
  it.skipIf(!gasSource).each(cases)("$name in asset-gas", ({ rows, expected }) => {
    const { dashboardBuildRecentExpenses_ } = createRequire(import.meta.url)(resolve(gasSource));
    expect(dashboardBuildRecentExpenses_(structuredClone(rows))).toEqual(expected);
  });
});
