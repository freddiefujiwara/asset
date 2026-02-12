import { describe, expect, it } from "vitest";
import { EMPTY_HOLDINGS, HOLDING_TABLE_CONFIGS, stockFundSummary, stockTiles } from "./holdings";

describe("holdings domain", () => {
  it("provides stable default shape", () => {
    expect(Object.keys(EMPTY_HOLDINGS)).toEqual([
      "cashLike",
      "stocks",
      "funds",
      "pensions",
      "points",
      "liabilitiesDetail",
    ]);
    expect(HOLDING_TABLE_CONFIGS).toHaveLength(6);
  });

  it("computes stock/fund summary", () => {
    const summary = stockFundSummary({
      ...EMPTY_HOLDINGS,
      stocks: [{ 評価額: "100", 前日比: "10" }],
      funds: [{ 評価額: "300", 前日比: "-20" }, { 評価額: "not number" }],
    });

    expect(summary.totalYen).toBe(400);
    expect(summary.dailyMoves).toEqual([10, -20]);
    expect(summary.dailyMoveTotal).toBe(-10);
  });

  it("builds stock tiles sorted by valuation with sign color flag", () => {
    const tiles = stockTiles([
      { 銘柄名: "A", 評価額: "200", 前日比: "10" },
      { 銘柄名: "B", 評価額: "100", 前日比: "-1" },
      { 銘柄名: "C", 評価額: "0", 前日比: "0" },
    ]);

    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toMatchObject({
      name: "A",
      value: 200,
      isNegative: false,
      columnSpan: 12,
      rowSpan: 2,
    });
    expect(tiles[1]).toMatchObject({
      name: "B",
      value: 100,
      isNegative: true,
      columnSpan: 6,
      rowSpan: 1,
    });
  });
});
