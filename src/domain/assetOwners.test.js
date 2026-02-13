import { describe, expect, it } from "vitest";
import { filterHoldingsByOwner, summarizeByCategory } from "./assetOwners";

describe("assetOwners domain", () => {
  const holdings = {
    cashLike: [
      { "種類・名称": "普通預金", "残高": "100", Owner: "me" },
      { "種類・名称": "普通預金", "残高": "200", Owner: "wife" },
    ],
    stocks: [
      { "銘柄名": "A", "評価額": "1000", owner: "daughter" },
      { "銘柄名": "B", "評価額": "500", "保有金融機関": "test@chipop" },
    ],
    funds: [],
    pensions: [],
    points: [],
    liabilitiesDetail: [],
  };

  it("filters by explicit owner property first", () => {
    const wife = filterHoldingsByOwner(holdings, "wife");
    expect(wife.cashLike).toHaveLength(1);
    expect(wife.cashLike[0]["残高"]).toBe("200");
  });

  it("falls back to owner detection from text", () => {
    const wife = filterHoldingsByOwner(holdings, "wife");
    expect(wife.stocks).toHaveLength(1);
    expect(wife.stocks[0]["銘柄名"]).toBe("B");
  });

  it("summarizes each category amount and count", () => {
    const summary = summarizeByCategory(holdings);
    const stock = summary.find((entry) => entry.key === "stocks");
    expect(stock.amountYen).toBe(1500);
    expect(stock.count).toBe(2);
  });
});
