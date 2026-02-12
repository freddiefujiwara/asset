import { describe, expect, it } from "vitest";
import { EMPTY_HOLDINGS, HOLDING_TABLE_CONFIGS, stockFundSummary, stockTiles, stockFundRows } from "./holdings";

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
      dailyChange: 10,
      isNegative: false,
    });
    expect(tiles[1]).toMatchObject({
      name: "B",
      value: 100,
      dailyChange: -1,
      isNegative: true,
    });
    expect(tiles[0].fontScale).toBeGreaterThan(tiles[1].fontScale);

    const firstArea = tiles[0].width * tiles[0].height;
    const secondArea = tiles[1].width * tiles[1].height;
    expect(Math.round((firstArea / secondArea) * 10) / 10).toBe(2);
  });

  it("handles empty or non-array stocks in stockTiles", () => {
    expect(stockTiles([])).toEqual([]);
    expect(stockTiles(null)).toEqual([]);
    expect(stockTiles([{ 評価額: "0" }])).toEqual([]);
  });

  it("handles same valuation in stockTiles sort", () => {
    const tiles = stockTiles([
      { 銘柄名: "B", 評価額: "100" },
      { 銘柄名: "A", 評価額: "100" },
    ]);
    expect(tiles[0].name).toBe("B"); // Stable sort by original index
    expect(tiles[1].name).toBe("A");
  });

  it("triggers vertical split and deep treemap layout", () => {
    // Width < Height to trigger vertical split
    // Need enough items to trigger while loop
    const manyStocks = [
      { 銘柄名: "A", 評価額: "1000" },
      { 銘柄名: "B", 評価額: "500" },
      { 銘柄名: "C", 評価額: "300" },
      { 銘柄名: "D", 評価額: "200" },
    ];
    // We can't directly control width/height of the root call from stockTiles as it is fixed at 100x100.
    // However, layoutTreemap is recursive.
    // If it splits horizontally, one of the children will have width < height if we are lucky or provide enough items.
    // e.g. root 100x100. Split at 1000 vs (500+300+200=1000).
    // Left: 50x100, Right: 50x100.
    // In both children, width (50) < height (100) -> triggers vertical split!
    const tiles = stockTiles(manyStocks);
    expect(tiles).toHaveLength(4);
    expect(tiles.every(t => t.width > 0 && t.height > 0)).toBe(true);

    // [100, 100, 100] to trigger while loop in treemap
    const threeStocks = [
      { 銘柄名: "A", 評価額: "100" },
      { 銘柄名: "B", 評価額: "100" },
      { 銘柄名: "C", 評価額: "100" },
    ];
    const tiles2 = stockTiles(threeStocks);
    expect(tiles2).toHaveLength(3);
  });

  it("handles missing name fields in stockTiles", () => {
    const tiles = stockTiles([
      { 銘柄コード: "1234", 評価額: "100" },
      { 評価額: "200" },
    ]);
    expect(tiles.find(t => t.value === 100).name).toBe("1234");
    expect(tiles.find(t => t.value === 200).name).toBe("名称未設定");
  });

  it("handles null input in stockFundRows", () => {
    expect(stockFundRows(null)).toEqual([]);
  });

});
