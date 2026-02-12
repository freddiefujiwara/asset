import { describe, expect, it } from "vitest";
import { normalizePortfolio } from "./normalize";

describe("normalizePortfolio", () => {
  it("numeric strings are parsed and totals computed", () => {
    const api = {
      breakdown: [
        { category: "預金", amount_yen: "1,000", percentage: "50" },
        { category: "株式", amount_yen: "￥ 2,000", percentage: "50%" },
      ],
      "total-liability": [{ total_yen: "500" }],
      "breakdown-liability": [{ category: "カード", amount_yen: "500", percentage: "100" }],
    };

    const normalized = normalizePortfolio(api);

    expect(normalized.totals.assetsYen).toBe(3000);
    expect(normalized.totals.liabilitiesYen).toBe(500);
    expect(normalized.totals.netWorthYen).toBe(2500);
    expect(normalized.summary.assetsByClass[1].percentage).toBe(50);
  });

  it("missing keys are safe and holdings fallback to empty arrays", () => {
    const normalized = normalizePortfolio({});

    expect(normalized.totals.assetsYen).toBe(0);
    expect(normalized.totals.liabilitiesYen).toBe(0);
    expect(normalized.summary.assetsByClass).toEqual([]);
    expect(normalized.holdings.cashLike).toEqual([]);
    expect(normalized.holdings.stocks).toEqual([]);
    expect(normalized.holdings.liabilitiesDetail).toEqual([]);
  });

  it("derives pension profit from current value and profit rate", () => {
    const normalized = normalizePortfolio({
      details__portfolio_det_pns__t0: [{ 名称: "iDeCo", 現在価値: "120000", 評価損益率: "20" }],
    });

    expect(normalized.holdings.pensions[0]["評価損益"]).toBe("20000");
  });

});
