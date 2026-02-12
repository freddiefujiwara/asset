import { describe, expect, it } from "vitest";
import { EMPTY_HOLDINGS, HOLDING_TABLE_CONFIGS, stockFundSummary } from "./holdings";

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
});
